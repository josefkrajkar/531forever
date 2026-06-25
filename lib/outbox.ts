/**
 * outbox.ts — Perzistentní fronta mutací pro offline-first podporu.
 *
 * Ukládá nevyřízené mutace do vlastní IndexedDB databáze (oddělená
 * od silovy-denik-offline, aby se nekřížily onupgradeneeded handlery).
 *
 * Defenzivní: pokud IndexedDB není dostupný (SSR, starý prohlížeč),
 * všechny funkce jsou no-op nebo vrátí prázdnou hodnotu bez vyhozené chyby.
 *
 * Fronta je FIFO díky autoIncrement klíči — getAll() vrátí položky
 * vzestupně dle ID (pořadí vložení).
 */

/** Název IndexedDB databáze pro outbox — záměrně jiný než offline-store */
const DB_NAME = "silovy-denik-outbox"

/** Verze schématu */
const DB_VERSION = 1

/** Název object store */
const OUTBOX_STORE = "outbox"

/**
 * Jedna položka ve frontě mutací.
 * `id` je autoIncrement klíč přidělený IndexedDB (chybí před vložením).
 */
export interface OutboxItem {
  /** Autoincrement ID — přiděleno při vložení (undefined před enqueue) */
  id?: number
  /** Název Convex mutace (klíč do MutationRegistry), např. "programs.completeWorkout" */
  mutationName: string
  /** Argumenty mutace — musí být JSON-serializovatelné */
  args: Record<string, unknown>
  /** Čas vložení do fronty (Date.now()) */
  enqueuedAt: number
  /** Stav zpracování */
  state: "pending" | "failed"
  /** Počet dosavadních pokusů o odeslání */
  attempts: number
  /** Chybová zpráva z posledního neúspěšného pokusu */
  lastError?: string
}

// ─── Interní pomocné funkce ───────────────────────────────────────────────────

/**
 * Vrátí true pokud jsme v prostředí kde IndexedDB existuje (klientský prohlížeč).
 */
function isIndexedDbAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    window.indexedDB !== null
  )
}

/** Singleton promise na otevřenou DB instanci outboxu */
let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Otevře (nebo vrátí existující) IndexedDB databázi outboxu.
 * Pokud IndexedDB není dostupné, vrátí null.
 */
function openDb(): Promise<IDBDatabase> | null {
  if (!isIndexedDbAvailable()) return null

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        // autoIncrement = FIFO pořadí garantováno klíčem (vzestupné ID)
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { autoIncrement: true, keyPath: "id" })
        }
      }

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result)
      }

      request.onerror = () => {
        dbPromise = null // reset pro případ budoucího pokusu
        reject(request.error)
      }
    })
  }

  return dbPromise
}

/**
 * Spustí transakci nad outbox store.
 * @returns výsledek operace nebo null při chybě / nedostupnosti IndexedDB
 */
async function withOutboxStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  const promise = openDb()
  if (!promise) return null

  try {
    const db = await promise
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, mode)
      const store = tx.objectStore(OUTBOX_STORE)
      const request = operation(store)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Tichá chyba — vracíme null, nepadáme
    return null
  }
}

// ─── Veřejné API ──────────────────────────────────────────────────────────────

/**
 * Vloží novou položku do fronty.
 * Přidělí autoIncrement ID (FIFO pořadí).
 *
 * @param item Položka bez `id` — ID přidělí IndexedDB
 * @returns Přidělené ID nebo -1 pokud IndexedDB není dostupný
 */
export async function enqueue(item: Omit<OutboxItem, "id">): Promise<number> {
  await ensurePendingCountInitialized()
  const result = await withOutboxStore<IDBValidKey>("readwrite", (store) =>
    store.add(item)
  )
  if (typeof result === "number") {
    pendingCount++
    notifyPendingListeners()
    return result
  }
  return -1
}

/**
 * Vrátí všechny položky fronty vzestupně dle ID (FIFO pořadí).
 * Vrátí prázdné pole pokud IndexedDB není dostupný nebo nastala chyba.
 */
export async function getAll(): Promise<OutboxItem[]> {
  const promise = openDb()
  if (!promise) return []

  try {
    const db = await promise
    return await new Promise<OutboxItem[]>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly")
      const store = tx.objectStore(OUTBOX_STORE)
      const request = store.getAll()

      request.onsuccess = () => resolve((request.result as OutboxItem[]) ?? [])
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

/**
 * Odstraní položku z fronty dle ID.
 * No-op pokud IndexedDB není dostupný nebo ID neexistuje.
 *
 * @param id Autoincrement ID položky
 */
export async function remove(id: number): Promise<void> {
  // Počkej na inicializaci čítače PŘED dekrementem — jinak by remove během
  // probíhajícího initu mohl dekrementovat ze stale hodnoty (viz enqueue).
  await ensurePendingCountInitialized()
  await withOutboxStore("readwrite", (store) => store.delete(id))
  if (pendingCount > 0) {
    pendingCount--
    notifyPendingListeners()
  }
}

/**
 * Aktualizuje existující položku (patch).
 * Slouží k označení chyby (state: "failed", attempts++, lastError).
 * No-op pokud IndexedDB není dostupný nebo ID neexistuje.
 *
 * @param id    ID položky
 * @param patch Část polí k přepsání
 */
export async function update(
  id: number,
  patch: Partial<Omit<OutboxItem, "id" | "mutationName" | "args" | "enqueuedAt">>
): Promise<void> {
  const promise = openDb()
  if (!promise) return

  try {
    const db = await promise
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite")
      const store = tx.objectStore(OUTBOX_STORE)
      const getReq = store.get(id)

      getReq.onsuccess = () => {
        const existing = getReq.result as OutboxItem | undefined
        if (!existing) {
          resolve()
          return
        }
        const updated: OutboxItem = { ...existing, ...patch }
        const putReq = store.put(updated)
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    })
  } catch {
    // Tichá chyba
  }
}

/**
 * Vrátí počet položek ve frontě.
 * Vrátí 0 pokud IndexedDB není dostupný.
 */
export async function count(): Promise<number> {
  const result = await withOutboxStore<number>("readonly", (store) => store.count())
  return result ?? 0
}

/**
 * Vymaže celý outbox.
 * Volat při odhlášení — zabrání replay cizích mutací.
 * No-op pokud IndexedDB není dostupný.
 */
export async function clearOutbox(): Promise<void> {
  await withOutboxStore("readwrite", (store) => store.clear())
  if (pendingCount !== 0) {
    pendingCount = 0
    notifyPendingListeners()
  }
}

/**
 * Vyexportuje interní dbPromise pro reset v testech.
 * @internal — nepoužívat v produkčním kódu
 */
export function _resetDbForTests(): void {
  dbPromise = null
}

// ─── Pub/sub pro pendingCount ─────────────────────────────────────────────────

/**
 * In-memory čítač čekajících položek.
 * Synchronně drží stav vedle IndexedDB — bez async roundtripů pro UI.
 * Inicializace z count() probíhá lazy při prvním enqueue/remove nebo explicitním initPendingCount().
 */
let pendingCount = 0
let pendingCountInitialized = false
/** Sdílený init promise — zabrání souběžné dvojí inicializaci čítače */
let pendingCountInitPromise: Promise<void> | null = null

/** Množina listenerů přihlášených k notifikacím o změně pendingCount */
const pendingListeners = new Set<() => void>()

/** Notifikuje všechny přihlášené listenery */
function notifyPendingListeners(): void {
  for (const listener of pendingListeners) {
    listener()
  }
}

/**
 * Inicializuje pendingCount z IndexedDB (jen jednou).
 * Volat před první operací, která mění počet — lazy init.
 */
function ensurePendingCountInitialized(): Promise<void> {
  if (pendingCountInitialized) return Promise.resolve()
  // Sdílený promise — souběžní volající (enqueue/remove/initPendingCount)
  // čekají na TÝŽ init. Flag se nastaví AŽ PO count(), takže delta z
  // enqueue/remove během initu se aplikuje až na hotovou inicializovanou hodnotu.
  if (!pendingCountInitPromise) {
    pendingCountInitPromise = (async () => {
      try {
        const loaded = await count()
        const changed = loaded !== pendingCount
        pendingCount = loaded
        pendingCountInitialized = true
        // Notifikuj jen pokud se hodnota skutečně změnila — zabrání spuriózní
        // notifikaci při prázdné frontě (init z 0 na 0).
        if (changed) notifyPendingListeners()
      } catch (err) {
        // count() selhal (IDB chyba) — resetuj promise, ať se init může
        // zopakovat při příštím enqueue/remove (zrcadlí vzor openDb.onerror).
        pendingCountInitPromise = null
        throw err
      }
    })()
  }
  return pendingCountInitPromise
}

/**
 * Explicitní inicializace pendingCount z IndexedDB.
 * Volat při startu aplikace (mount) pro přesný počáteční stav.
 */
export async function initPendingCount(): Promise<void> {
  await ensurePendingCountInitialized()
}

/**
 * Synchronní getter pro pendingCount — bezpečný pro useSyncExternalStore.
 * Vrátí 0 dokud není inicializováno.
 */
export function getPendingSnapshot(): number {
  return pendingCount
}

/**
 * Subscribe na změny pendingCount — pro useSyncExternalStore.
 * Vrátí unsubscribe funkci.
 * Reference je stabilní (definovaná na úrovni modulu) — bezpečná pro React.
 */
export function subscribePending(listener: () => void): () => void {
  pendingListeners.add(listener)
  return () => {
    pendingListeners.delete(listener)
  }
}

/**
 * Reset pendingCount pro testy.
 * @internal — nepoužívat v produkčním kódu
 */
export function _resetPendingCountForTests(): void {
  pendingCount = 0
  pendingCountInitialized = false
  pendingCountInitPromise = null
}
