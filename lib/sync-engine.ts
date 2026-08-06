/**
 * sync-engine.ts — Sériový flush orchestrátor pro offline outbox.
 *
 * Navržen s čistou dependency injection (client + registry jako parametry),
 * aby byl plně testovatelný s mock klientem bez sítě.
 *
 * Klíčová rozhodnutí:
 * - SÉRIOVÝ FIFO flush: každá mutace se čeká před další (kauzální integrita)
 * - Konflikt (server vrátí { alreadyCompleted: true }) → server wins, položka zahozena
 * - Chyba (mutace vyhodí výjimku) → attempts++; pokud attempts >= MAX_ATTEMPTS,
 *   položka je dead-lettered (state: "dead") a flush POKRAČUJE dál (neblokuje
 *   FIFO frontu trvale rozbitou položkou); jinak je jen "failed" a flush ZASTAVEN
 *   (transientní chyby zachovávají kauzální pořadí — zkusí se celá fronta znovu)
 * - Dead položky (state: "dead") se při dalším flushi PŘESKAKUJÍ, nikdy se
 *   znovu nezkouší (dokud uživatel nezvolí retryFailure)
 * - NEzahazovat při auth/network chybě (retry příště)
 * - Guard proti souběhu: modul-level `flushing` flag; souběžný požadavek
 *   během běžícího flushe se nezahazuje — nastaví `rerunRequested` a po
 *   dokončení aktuálního průchodu proběhne ještě jeden navíc (coalesced rerun)
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
  /** Počet položek, které vyčerpaly MAX_ATTEMPTS a byly dead-lettered */
  deadLettered: number
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
  /**
   * Callback volaný při dead-letterování položky (vyčerpán MAX_ATTEMPTS,
   * nebo neznámá mutace v registry).
   * UI ho může použít k zobrazení failure banneru s Retry/Discard akcemi.
   */
  onDeadLetter?: (item: OutboxItem) => void
}

/**
 * Maximální počet pokusů o odeslání mutace, než je položka dead-lettered.
 * Po dosažení tohoto počtu se položka trvale přeskočí (state: "dead") a
 * flush pokračuje dál, aby nezablokoval zbytek FIFO fronty navždy.
 */
export const MAX_ATTEMPTS = 5

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

/**
 * Příznak: flush byl vyžádán, zatímco jiný již běžel — po dokončení
 * aktuálního průchodu se provede ještě jeden navíc, aby položky zařazené/
 * resetované během běžícího flushe (např. retryFailure) nečekaly na další
 * externí trigger.
 */
let rerunRequested = false

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
 * - Dead položky (state: "dead") jsou přeskočeny — nikdy znovu nezkoušeny.
 * - Pro každou (nedead) položku sériově (await každou před další):
 *   - Najde FunctionReference v registry (chybí → neznámá mutace, dead-letter + pokračuj).
 *   - Zavolá client.mutation(ref, args).
 *   - Úspěch → outbox.remove(id).
 *   - Konflikt (isConflict vrátí true) → remove + onConflict(item).
 *   - Chyba (výjimka):
 *     - attempts >= MAX_ATTEMPTS → dead-letter (state: "dead") + onDeadLetter(item) + POKRAČUJ
 *       (dead položka už dál neblokuje FIFO frontu).
 *     - jinak → update(id, failed) + ZASTAV flush (transientní chyba zachovává FIFO pořadí).
 * - Guard: pokud již probíhá flush, druhé volání je no-op, ALE nastaví
 *   `rerunRequested` — po dokončení aktuálního průchodu proběhne ještě
 *   jeden navíc (coalesced rerun), takže položky zařazené/resetované
 *   souběžně (např. retryFailure) nečekají na další externí trigger.
 *
 * @param deps Závislosti (client, registry, volitelné isConflict/onConflict/onDeadLetter)
 * @returns Výsledek flush průchodu (agregace přes všechny coalesced průchody)
 */
export async function flushOutbox(deps: FlushDeps): Promise<FlushResult> {
  // Guard proti souběhu — souběžné volání se neztratí, jen se doraz
  if (flushing) {
    rerunRequested = true
    return { flushed: 0, conflicts: 0, failedStopped: false, deadLettered: 0 }
  }

  flushing = true

  const result: FlushResult = {
    flushed: 0,
    conflicts: 0,
    failedStopped: false,
    deadLettered: 0,
  }
  const isConflict = deps.isConflict ?? defaultIsConflict

  try {
    do {
      rerunRequested = false
      const pass = await runFlushPass(deps, isConflict)
      result.flushed += pass.flushed
      result.conflicts += pass.conflicts
      result.deadLettered += pass.deadLettered
      result.failedStopped = pass.failedStopped
    } while (rerunRequested)
  } finally {
    flushing = false
  }

  return result
}

/**
 * Jeden sériový průchod frontou (bez guardu proti souběhu — ten řeší
 * flushOutbox). Volán z flushOutbox jednou, případně vícekrát při
 * coalesced rerunu.
 */
async function runFlushPass(
  deps: FlushDeps,
  isConflict: (mutationName: string, result: unknown) => boolean
): Promise<FlushResult> {
  const result: FlushResult = {
    flushed: 0,
    conflicts: 0,
    failedStopped: false,
    deadLettered: 0,
  }

  const items = await outbox.getAll()

  for (const item of items) {
    if (item.id === undefined) {
      // Nemělo by nastat — ale defenzivně přeskočíme
      continue
    }

    if (item.state === "dead") {
      // Trvale vynechaná položka — nikdy znovu nezkoušet (jen retryFailure z UI)
      continue
    }

    // Bezpečný výchozí počet pokusů — chrání proti NaN/undefined z poškozeného záznamu
    const priorAttempts = Number.isFinite(item.attempts) ? item.attempts : 0

    // Najdi FunctionReference v registry
    const ref = deps.registry[item.mutationName]
    if (!ref) {
      // Neznámá mutace je bug — okamžitě dead-letter, ale POKRAČUJ (neblokuj frontu)
      console.error(
        `[sync-engine] Neznámá mutace v registry: "${item.mutationName}" — položka dead-lettered`
      )
      const lastError = `Neznámá mutace: ${item.mutationName}`
      const attempts = priorAttempts + 1
      await outbox.update(item.id, { state: "dead", attempts, lastError })
      result.deadLettered++
      deps.onDeadLetter?.({ ...item, state: "dead", attempts, lastError })
      continue
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
      // Chyba mutace (síť, auth, server error)
      const lastError = err instanceof Error ? err.message : String(err)
      const attempts = priorAttempts + 1

      if (attempts >= MAX_ATTEMPTS) {
        // Vyčerpány pokusy — dead-letter a POKRAČUJ (neblokuj zbytek fronty navždy)
        await outbox.update(item.id, { state: "dead", attempts, lastError })
        result.deadLettered++
        deps.onDeadLetter?.({ ...item, state: "dead", attempts, lastError })
        continue
      }

      // Transientní chyba — NEzahazujeme, zkusíme příště
      await outbox.update(item.id, { state: "failed", attempts, lastError })

      // ZASTAV flush — položky za touto závisí na FIFO pořadí
      result.failedStopped = true
      break
    }
  }

  return result
}

/**
 * Vyexportuje interní flushing/rerunRequested příznaky pro reset v testech.
 * @internal — nepoužívat v produkčním kódu
 */
export function _resetFlushingForTests(): void {
  flushing = false
  rerunRequested = false
}
