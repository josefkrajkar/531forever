/**
 * sync-engine.ts — Sériový flush orchestrátor pro offline outbox.
 *
 * Navržen s čistou dependency injection (client + registry jako parametry),
 * aby byl plně testovatelný s mock klientem bez sítě.
 *
 * Klíčová rozhodnutí:
 * - SÉRIOVÝ FIFO flush: každá mutace se čeká před další (kauzální integrita)
 * - Konflikt (server vrátí { alreadyCompleted: true }) → server wins, položka zahozena
 * - Chyba (mutace vyhodí výjimku) → položka označena jako failed, flush ZASTAVEN
 *   (neskáčeme dál — items za chybou závisí na ní)
 * - NEzahazovat při auth/network chybě (retry příště)
 * - Guard proti souběhu: modul-level `flushing` flag
 */

import type { FunctionReference } from "convex/server"
import * as outbox from "@/lib/outbox"
import type { OutboxItem } from "@/lib/outbox"

// ─── Typy ────────────────────────────────────────────────────────────────────

/**
 * Mapování mutationName → FunctionReference.
 * Klíče jsou řetězce ve formátu "module.functionName" (např. "programs.completeWorkout").
 */
export type MutationRegistry = Record<string, FunctionReference<"mutation">>

/**
 * Minimální interface klienta pro flush.
 * ConvexReactClient i mock musí splňovat tento kontrakt.
 */
export interface SyncClient {
  mutation(
    ref: FunctionReference<"mutation">,
    args: Record<string, unknown>
  ): Promise<unknown>
}

/** Výsledek jednoho flush průchodu */
export interface FlushResult {
  /** Počet úspěšně odeslaných a odstraněných položek */
  flushed: number
  /** Počet konfliktních položek (server wins → odstraněno) */
  conflicts: number
  /** true = flush byl zastaven kvůli chybě mutace */
  failedStopped: boolean
}

/** Závislosti předávané do flushOutbox */
export interface FlushDeps {
  /** Convex klient (nebo mock) */
  client: SyncClient
  /** Registr mutací: mutationName → FunctionReference */
  registry: MutationRegistry
  /**
   * Detektor konfliktu — vrátí true pokud result signalizuje "server wins".
   * Default: result je objekt s `alreadyCompleted === true`.
   */
  isConflict?: (mutationName: string, result: unknown) => boolean
  /**
   * Callback volaný při konfliktu (server wins).
   * UI ho může použít k zobrazení banneru.
   */
  onConflict?: (item: OutboxItem) => void
}

// ─── Výchozí detektor konfliktu ──────────────────────────────────────────────

/**
 * Výchozí detektor konfliktu.
 * Vrátí true pokud server vrátil objekt s `alreadyCompleted === true`.
 */
function defaultIsConflict(_mutationName: string, result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "alreadyCompleted" in result &&
    (result as Record<string, unknown>)["alreadyCompleted"] === true
  )
}

// ─── Guard proti souběhu ─────────────────────────────────────────────────────

/** Příznak: právě probíhá flush (zabránění souběžným voláním) */
let flushing = false

// ─── Kanonický registry builder ──────────────────────────────────────────────

/**
 * Sestaví kanonický MutationRegistry z objektu `api`.
 * Importujte api z convex/_generated/api a předejte sem.
 *
 * Použití v produkci:
 * ```ts
 * import { api } from "@/convex/_generated/api"
 * const registry = buildRegistry(api)
 * ```
 *
 * @param api Vygenerovaný Convex API objekt
 */
export function buildRegistry(api: {
  programs: {
    completeWorkout: FunctionReference<"mutation">
    saveAmrapResult: FunctionReference<"mutation">
    setSeventhWeekType: FunctionReference<"mutation">
    setTrainingMax: FunctionReference<"mutation">
  }
  accessories: {
    logMultipleAccessories: FunctionReference<"mutation">
    logAccessory: FunctionReference<"mutation">
  }
  bodyweight: {
    logBodyweight: FunctionReference<"mutation">
  }
  users: {
    updateAthleteProfile: FunctionReference<"mutation">
  }
}): MutationRegistry {
  return {
    "programs.completeWorkout": api.programs.completeWorkout,
    "programs.saveAmrapResult": api.programs.saveAmrapResult,
    "programs.setSeventhWeekType": api.programs.setSeventhWeekType,
    "programs.setTrainingMax": api.programs.setTrainingMax,
    "accessories.logMultipleAccessories": api.accessories.logMultipleAccessories,
    "accessories.logAccessory": api.accessories.logAccessory,
    "bodyweight.logBodyweight": api.bodyweight.logBodyweight,
    "users.updateAthleteProfile": api.users.updateAthleteProfile,
  }
}

// ─── Veřejné API ──────────────────────────────────────────────────────────────

/**
 * Sériově zpracuje všechny pending položky v outboxu (FIFO pořadí).
 *
 * Chování:
 * - Načte getAll() (seřazeno dle autoIncrement = FIFO).
 * - Pro každou položku sériově (await každou před další):
 *   - Najde FunctionReference v registry (chybí → bug, zastav flush).
 *   - Zavolá client.mutation(ref, args).
 *   - Úspěch → outbox.remove(id).
 *   - Konflikt (isConflict vrátí true) → remove + onConflict(item).
 *   - Chyba (výjimka) → update(id, failed) + ZASTAV flush (FIFO integrita).
 * - Guard: pokud již probíhá flush, druhé volání je no-op.
 *
 * @param deps Závislosti (client, registry, volitelné isConflict/onConflict)
 * @returns Výsledek flush průchodu
 */
export async function flushOutbox(deps: FlushDeps): Promise<FlushResult> {
  // Guard proti souběhu — druhé volání vrátí prázdný výsledek
  if (flushing) {
    return { flushed: 0, conflicts: 0, failedStopped: false }
  }

  flushing = true

  const result: FlushResult = { flushed: 0, conflicts: 0, failedStopped: false }
  const isConflict = deps.isConflict ?? defaultIsConflict

  try {
    const items = await outbox.getAll()

    for (const item of items) {
      if (item.id === undefined) {
        // Nemělo by nastat — ale defenzivně přeskočíme
        continue
      }

      // Najdi FunctionReference v registry
      const ref = deps.registry[item.mutationName]
      if (!ref) {
        // Neznámá mutace je bug — zaznamenej jako failed a ZASTAV
        console.error(
          `[sync-engine] Neznámá mutace v registry: "${item.mutationName}" — flush zastaven`
        )
        await outbox.update(item.id, {
          state: "failed",
          attempts: item.attempts + 1,
          lastError: `Neznámá mutace: ${item.mutationName}`,
        })
        result.failedStopped = true
        break
      }

      try {
        const mutationResult = await deps.client.mutation(ref, item.args)

        if (isConflict(item.mutationName, mutationResult)) {
          // Konflikt: server wins — zahoď položku a informuj UI
          await outbox.remove(item.id)
          result.conflicts++
          deps.onConflict?.(item)
        } else {
          // Úspěch — odstraň z fronty
          await outbox.remove(item.id)
          result.flushed++
        }
      } catch (err) {
        // Chyba mutace (síť, auth, server error) — NEzahazujeme, zkusíme příště
        const errorMessage =
          err instanceof Error ? err.message : String(err)

        await outbox.update(item.id, {
          state: "failed",
          attempts: item.attempts + 1,
          lastError: errorMessage,
        })

        // ZASTAV flush — položky za touto závisí na FIFO pořadí
        result.failedStopped = true
        break
      }
    }
  } finally {
    flushing = false
  }

  return result
}

/**
 * Vyexportuje interní flushing příznak pro reset v testech.
 * @internal — nepoužívat v produkčním kódu
 */
export function _resetFlushingForTests(): void {
  flushing = false
}
