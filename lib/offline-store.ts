/**
 * offline-store.ts — IndexedDB read-cache pro offline-first podporu.
 *
 * Poskytuje jednoduché key-value API nad IndexedDB.
 * Defenzivní: pokud IndexedDB není dostupný (SSR, starý prohlížeč),
 * všechny funkce jsou no-op/null bez vyhozené chyby.
 *
 * Verze DB: bump DB_VERSION při změně schématu store.
 */

/** Název IndexedDB databáze */
const DB_NAME = "silovy-denik-offline"

/** Verze schématu — zvyšuj při změně object store struktury */
const DB_VERSION = 1

/** Store pro datové snapshoty (program, user, atd.) */
const SNAPSHOT_STORE = "snapshots"

/** Store pro boolean příznaky (authSeen, atd.) */
const FLAG_STORE = "flags"

// ─── Interní pomocné funkce ───────────────────────────────────────────────────

/**
 * Vrátí true pokud jsme v prostředí kde IndexedDB existuje (klientský prohlížeč).
 * Na serveru (SSR) nebo v prostředí bez IndexedDB vrátí false.
 */
function isIndexedDbAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    window.indexedDB !== null
  )
}

/** Singleton promise na otevřenou DB instanci */
let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Otevře (nebo vrátí existující) IndexedDB databázi.
 * Pokud IndexedDB není dostupné, vrátí null.
 */
function openDb(): Promise<IDBDatabase> | null {
  if (!isIndexedDbAvailable()) return null

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        // Vytvoř stores pokud neexistují
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE)
        }
        if (!db.objectStoreNames.contains(FLAG_STORE)) {
          db.createObjectStore(FLAG_STORE)
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
 * Spustí transakci nad daným store a operací.
 * @returns hodnotu z operace nebo null při chybě / nedostupnosti IndexedDB
 */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  const promise = openDb()
  if (!promise) return null

  try {
    const db = await promise
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
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
 * Obal hodnoty uložené v IndexedDB.
 * Hodnotu zabalujeme do `{ v }`, abychom odlišili "uložená hodnota null"
 * (validní výsledek Convex query = "nic zde") od "klíč chybí" / chyby.
 * Uložená hodnota tak nikdy není přímo null — null sentinel z withStore
 * pak jednoznačně znamená chybu/nedostupnost, undefined znamená chybějící klíč.
 */
interface SnapshotWrapper<T> {
  v: T
}

/**
 * Zapíše snapshot hodnoty pod daným klíčem.
 * No-op pokud IndexedDB není dostupný.
 *
 * @param key   Klíč snapshotů (např. "currentProgram", "currentUser")
 * @param value Libovolná serializovatelná hodnota (i null)
 */
export async function putSnapshot(key: string, value: unknown): Promise<void> {
  await withStore(SNAPSHOT_STORE, "readwrite", (store) =>
    store.put({ v: value }, key)
  )
}

/**
 * Načte snapshot pod daným klíčem.
 * Vrátí `undefined` pokud klíč neexistuje, nastala chyba nebo IndexedDB
 * není dostupný. Uloženou hodnotu (včetně `null`) vrátí tak, jak byla uložena.
 *
 * @param key Klíč snapshotů
 */
export async function getSnapshot<T>(key: string): Promise<T | undefined> {
  const result = await withStore<SnapshotWrapper<T>>(
    SNAPSHOT_STORE,
    "readonly",
    (store) => store.get(key)
  )
  // withStore vrací null při chybě/nedostupnosti a undefined při chybějícím
  // klíči (store.get u neexistujícího klíče vrací undefined) → obojí = "nic".
  if (result === null || result === undefined) return undefined
  return result.v
}

/**
 * Vymaže veškerou offline cache (snapshoty i příznaky).
 * Volat při odhlášení — zabrání tomu, aby další uživatel na stejném
 * zařízení získal offline přístup k datům předchozí session.
 */
export async function clearOfflineCache(): Promise<void> {
  await withStore(SNAPSHOT_STORE, "readwrite", (store) => store.clear())
  await withStore(FLAG_STORE, "readwrite", (store) => store.clear())
}

/**
 * Nastaví boolean příznak.
 * No-op pokud IndexedDB není dostupný.
 *
 * @param key   Název příznaku (např. "authSeen")
 * @param value Hodnota příznaku
 */
export async function setFlag(key: string, value: boolean): Promise<void> {
  await withStore(FLAG_STORE, "readwrite", (store) => store.put(value, key))
}

/**
 * Načte boolean příznak.
 * Vrátí null pokud příznak nebyl nastaven nebo IndexedDB není dostupný.
 *
 * @param key Název příznaku
 */
export async function getFlag(key: string): Promise<boolean | null> {
  const result = await withStore<boolean>(FLAG_STORE, "readonly", (store) => store.get(key))
  return result ?? null
}
