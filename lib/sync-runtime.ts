/**
 * sync-runtime.ts — Standalone flushNow se singleton Convex klientem.
 *
 * Oddělen od sync-engine.ts (který zůstane pure/testovatelný bez singleton importu)
 * a od hooks/ (aby šel importovat i mimo React komponentu, např. v useSyncTriggers).
 *
 * flushNow() = flushOutbox se singleton klientem + buildRegistry(api) + onConflict→pushConflict.
 *
 * Volat odkudkoliv — má interní guard proti souběhu z flushOutbox.
 */

import { convex } from "@/components/convex-client-provider"
import { api } from "@/convex/_generated/api"
import { flushOutbox, buildRegistry } from "@/lib/sync-engine"
import { pushConflict } from "@/lib/sync-conflicts"

/** Kanonický registry — sestaví se jednou při importu modulu */
const registry = buildRegistry(api)

/**
 * Adaptér ConvexReactClient → SyncClient interface.
 * ConvexReactClient.mutation má jiný podpis než náš SyncClient —
 * přidáme cast aby fungovalo s FunctionReference.
 */
const syncClient = {
  mutation: (ref: Parameters<typeof convex.mutation>[0], args: Record<string, unknown>) =>
    convex.mutation(ref, args as never),
}

/**
 * Okamžitě zpracuje všechny pending položky v outboxu.
 *
 * - Bezpečné volat vícekrát paralelně — flushOutbox má interní guard.
 * - Konflikty (server wins) jsou přeposílány do sync-conflicts store.
 * - Chyby flushe jsou logovány, nevyhazovány (fire-and-forget vhodný pro triggery).
 *
 * @returns Promise<void> — resolve po dokončení flushe
 */
export async function flushNow(): Promise<void> {
  try {
    await flushOutbox({
      client: syncClient,
      registry,
      onConflict: pushConflict,
    })
  } catch (err) {
    console.error("[sync-runtime] flushNow selhal:", err)
  }
}
