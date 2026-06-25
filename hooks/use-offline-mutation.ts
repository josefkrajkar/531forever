"use client"

/**
 * use-offline-mutation.ts — Hook pro offline-first mutace přes outbox.
 *
 * Místo přímého `useMutation` z Convexu UI použije tento hook.
 * Mutace se nejdřív zapíše do perzistentního outboxu a pak se okamžitě
 * zkusí flush přes flushNow() (singleton klient + registry + conflict callback).
 * Pokud flush projde, položka zmizí z outboxu hned.
 * Pokud selže (offline/auth), zůstane a bude zopakována při dalším
 * volání flushNow (triggery: online event, visibilitychange, mount).
 */

import { useCallback } from "react"
import { enqueue } from "@/lib/outbox"
import { flushNow } from "@/lib/sync-runtime"

/** Výsledek hooku useOfflineMutation */
export interface UseOfflineMutationReturn {
  /**
   * Zařadí mutaci do outboxu a okamžitě zkusí flush.
   *
   * @param mutationName Klíč mutace v registry (např. "programs.completeWorkout")
   * @param args         Argumenty mutace — musí být JSON-serializovatelné
   * @returns Promise<void> — resolve po zapsání do outboxu (ne po flushe)
   */
  enqueueMutation: (mutationName: string, args: Record<string, unknown>) => Promise<void>
}

/**
 * Hook pro offline-first mutace.
 *
 * Použití:
 * ```tsx
 * const { enqueueMutation } = useOfflineMutation()
 * await enqueueMutation("programs.completeWorkout", { exercises: [...], ... })
 * ```
 */
export function useOfflineMutation(): UseOfflineMutationReturn {
  const enqueueMutation = useCallback(
    async (mutationName: string, args: Record<string, unknown>): Promise<void> => {
      // 1. Zapiš do perzistentního outboxu (pendingCount++ notifikuje UI)
      await enqueue({
        mutationName,
        args,
        enqueuedAt: Date.now(),
        state: "pending",
        attempts: 0,
      })

      // 2. Okamžitě zkus flush — fire-and-forget (chyby ignorujeme,
      //    položka zůstane v outboxu pro příští pokus)
      flushNow().catch((err) => {
        console.error("[use-offline-mutation] Flush selhal:", err)
      })
    },
    [] // flushNow je stabilní (module-level export)
  )

  return { enqueueMutation }
}
