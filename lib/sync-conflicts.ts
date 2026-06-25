/**
 * sync-conflicts.ts — In-memory store pro sync konflikty (server wins).
 *
 * Lehký pub/sub modul: flushOutbox notifikuje přes pushConflict,
 * UI subscribuje přes subscribeConflicts a zobrazí banner.
 *
 * Stabilní reference (definované na úrovni modulu) — bezpečné pro
 * useSyncExternalStore bez useCallback/useMemo.
 */

import type { OutboxItem } from "@/lib/outbox"

// ─── Typy ─────────────────────────────────────────────────────────────────────

/** Jeden záznam o konfliktu */
export interface SyncConflict {
  /** Unikátní ID konfliktu — outbox item ID nebo náhodné číslo */
  id: number
  /** Původní položka z outboxu, která způsobila konflikt */
  item: OutboxItem
  /** Čas vzniku konfliktu */
  detectedAt: number
}

// ─── Interní stav ─────────────────────────────────────────────────────────────

let conflicts: SyncConflict[] = []
const listeners = new Set<() => void>()

/** Notifikuje všechny přihlášené listenery */
function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

// ─── Pub/sub API ──────────────────────────────────────────────────────────────

/**
 * Subscribe na změny v conflicts store — pro useSyncExternalStore.
 * Vrátí unsubscribe funkci.
 * Reference je stabilní (modulo-level) — bezpečná jako subscribe arg.
 */
export function subscribeConflicts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Synchronní getter pro aktuální konflikty — snapshot pro useSyncExternalStore.
 * Vrátí stabilní referenci na pole (mění se jen při pushConflict/dismissConflict).
 */
export function getConflicts(): SyncConflict[] {
  return conflicts
}

/**
 * Přidá nový konflikt do store.
 * Volá flushOutbox přes onConflict callback.
 *
 * @param item OutboxItem, který vyvolal konflikt (server wins)
 */
export function pushConflict(item: OutboxItem): void {
  const detectedAt = Date.now()
  const newConflict: SyncConflict = {
    // item.id je u položek z outboxu vždy definované (autoIncrement);
    // fallback na timestamp pro robustnost (žádná kolize, žádný Math.random).
    id: item.id ?? detectedAt,
    item,
    detectedAt,
  }
  // Vytvoř nové pole (immutable update pro React snapshotting)
  conflicts = [...conflicts, newConflict]
  notifyListeners()
}

/**
 * Odstraní konflikt ze store (uživatel kliknul Zavřít).
 *
 * @param id ID konfliktu k odstranění
 */
export function dismissConflict(id: number): void {
  const next = conflicts.filter((c) => c.id !== id)
  if (next.length !== conflicts.length) {
    conflicts = next
    notifyListeners()
  }
}

/**
 * Reset pro testy.
 * @internal — nepoužívat v produkčním kódu
 */
export function _resetConflictsForTests(): void {
  conflicts = []
  // Nenotifikujeme listenery — test si sám spravuje stav
}
