/**
 * sync-failures.ts — In-memory store pro dead-letter sync selhání.
 *
 * Lehký pub/sub modul: flushOutbox notifikuje přes pushFailure (onDeadLetter),
 * UI subscribuje přes subscribeFailures a zobrazí banner s Retry/Discard akcemi.
 *
 * Stabilní reference (definované na úrovni modulu) — bezpečné pro
 * useSyncExternalStore bez useCallback/useMemo.
 */

import * as outbox from "@/lib/outbox"
import type { OutboxItem } from "@/lib/outbox"
import { flushNow } from "@/lib/sync-runtime"

// ─── Typy ─────────────────────────────────────────────────────────────────────

/** Jeden záznam o dead-letter selhání */
export interface SyncFailure {
  /** Unikátní ID selhání — outbox item ID nebo náhodné číslo */
  id: number
  /** Původní položka z outboxu, která byla dead-lettered */
  item: OutboxItem
  /** Čas vzniku selhání */
  detectedAt: number
}

// ─── Interní stav ─────────────────────────────────────────────────────────────

let failures: SyncFailure[] = []
const listeners = new Set<() => void>()

/** Notifikuje všechny přihlášené listenery */
function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

// ─── Pub/sub API ──────────────────────────────────────────────────────────────

/**
 * Subscribe na změny v failures store — pro useSyncExternalStore.
 * Vrátí unsubscribe funkci.
 * Reference je stabilní (modulo-level) — bezpečná jako subscribe arg.
 */
export function subscribeFailures(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Synchronní getter pro aktuální selhání — snapshot pro useSyncExternalStore.
 * Vrátí stabilní referenci na pole (mění se jen při pushFailure/dismissFailure).
 */
export function getFailures(): SyncFailure[] {
  return failures
}

/**
 * Přidá nové dead-letter selhání do store.
 * Volá flushOutbox přes onDeadLetter callback.
 *
 * Idempotentní vůči id — pokud selhání se stejným id už ve store existuje
 * (např. rehydrateDeadLetters zavolán dvakrát kvůli StrictMode double-invoke
 * nebo remountu), druhé volání je no-op. Dedup žije zde, ne u volajícího,
 * aby platil bez ohledu na to, kdo pushFailure zavolá.
 *
 * @param item OutboxItem, který byl dead-lettered (vyčerpán MAX_ATTEMPTS)
 */
export function pushFailure(item: OutboxItem): void {
  const detectedAt = Date.now()
  // item.id je u položek z outboxu vždy definované (autoIncrement);
  // fallback na timestamp pro robustnost (žádná kolize, žádný Math.random).
  const id = item.id ?? detectedAt
  if (failures.some((failure) => failure.id === id)) {
    return
  }
  const newFailure: SyncFailure = { id, item, detectedAt }
  // Vytvoř nové pole (immutable update pro React snapshotting)
  failures = [...failures, newFailure]
  notifyListeners()
}

/**
 * Odstraní selhání ze store (uživatel kliknul Zavřít/Retry/Discard).
 *
 * @param id ID selhání k odstranění
 */
export function dismissFailure(id: number): void {
  const next = failures.filter((f) => f.id !== id)
  if (next.length !== failures.length) {
    failures = next
    notifyListeners()
  }
}

/**
 * Znovu zařadí dead-letter položku do fronty jako pending a okamžitě
 * spustí flush. Volá se z UI (tlačítko "Zkusit znovu" na failure banneru).
 *
 * @param id ID outbox položky (shodné s SyncFailure.id, pokud item.id existoval)
 */
export async function retryFailure(id: number): Promise<void> {
  await outbox.update(id, { state: "pending", attempts: 0, lastError: undefined })
  dismissFailure(id)
  await flushNow()
}

/**
 * Trvale zahodí dead-letter položku (uživatel se rozhodl mutaci nezkoušet znovu).
 * Volá se z UI (tlačítko "Zahodit" na failure banneru).
 *
 * @param id ID outbox položky k odstranění
 */
export async function discardFailure(id: number): Promise<void> {
  await outbox.remove(id)
  dismissFailure(id)
}

/**
 * Reset pro testy.
 * @internal — nepoužívat v produkčním kódu
 */
export function _resetFailuresForTests(): void {
  failures = []
  // Nenotifikujeme listenery — test si sám spravuje stav
}
