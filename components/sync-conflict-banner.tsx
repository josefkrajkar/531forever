"use client"

/**
 * sync-conflict-banner.tsx — Banner pro zobrazení sync konfliktů.
 *
 * Zobrazí se pokud flushOutbox detekoval konflikt (server wins):
 * workout byl dokončen na jiném zařízení a offline změny byly zahozeny.
 *
 * Použití useSyncExternalStore — idiomatický React 19 pattern (viz use-connection-state.ts).
 * ŽÁDNÉ setState v useEffect.
 */

import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { subscribeConflicts, getConflicts, dismissConflict } from "@/lib/sync-conflicts"
import type { SyncConflict } from "@/lib/sync-conflicts"

/** Stabilní prázdné pole pro SSR server snapshot — referenčně neměnné */
const EMPTY_CONFLICTS: SyncConflict[] = []

/** Server snapshot — prázdné pole (SSR nezná konflikty) */
function getServerSnapshot(): SyncConflict[] {
  return EMPTY_CONFLICTS
}

export function SyncConflictBanner() {
  const { t } = useTranslation()
  const conflicts = useSyncExternalStore(
    subscribeConflicts,
    getConflicts,
    getServerSnapshot
  )

  if (conflicts.length === 0) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full"
    >
      {conflicts.map((conflict) => {
        const args = conflict.item.args
        const cycle = typeof args.expectedCycle === "number" ? args.expectedCycle : null
        const week = typeof args.expectedWeek === "number" ? args.expectedWeek : null
        const detail = cycle !== null && week !== null
          ? t("offline.conflictDetail", { cycle, week })
          : ""

        return (
          <div
            key={conflict.id}
            className="flex items-start justify-between gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-sm"
          >
            <span className="flex-1">
              {t("offline.conflictMessage", { detail })}
            </span>
            <button
              onClick={() => dismissConflict(conflict.id)}
              className="shrink-0 font-heading font-bold uppercase tracking-widest text-xs px-3 py-1 border border-destructive/50 hover:bg-destructive/20 transition-colors rounded-sm"
              aria-label={t("offline.dismissAria")}
            >
              {t("offline.dismiss")}
            </button>
          </div>
        )
      })}
    </div>
  )
}
