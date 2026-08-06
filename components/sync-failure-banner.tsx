"use client"

/**
 * sync-failure-banner.tsx — Banner pro zobrazení dead-letter sync selhání.
 *
 * Zobrazí se pokud flushOutbox trvale dead-letteroval položku (vyčerpán
 * MAX_ATTEMPTS): mutace opakovaně selhávala a byla přeskočena, aby neblokovala
 * zbytek FIFO fronty. Uživatel může zkusit znovu (Retry) nebo zahodit (Discard).
 *
 * Použití useSyncExternalStore — idiomatický React 19 pattern (viz use-connection-state.ts).
 * ŽÁDNÉ setState v useEffect.
 */

import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import {
  subscribeFailures,
  getFailures,
  retryFailure,
  discardFailure,
} from "@/lib/sync-failures"
import type { SyncFailure } from "@/lib/sync-failures"

/** Stabilní prázdné pole pro SSR server snapshot — referenčně neměnné */
const EMPTY_FAILURES: SyncFailure[] = []

/** Server snapshot — prázdné pole (SSR nezná selhání) */
function getServerSnapshot(): SyncFailure[] {
  return EMPTY_FAILURES
}

export function SyncFailureBanner() {
  const { t } = useTranslation()
  const failures = useSyncExternalStore(
    subscribeFailures,
    getFailures,
    getServerSnapshot
  )

  if (failures.length === 0) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full"
    >
      {failures.map((failure) => (
        <div
          key={failure.id}
          className="flex items-start justify-between gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-sm"
        >
          <span className="flex-1">
            {t("offline.syncFailedMessage")}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => retryFailure(failure.id)}
              className="font-heading font-bold uppercase tracking-widest text-xs px-3 border border-destructive/50 hover:bg-destructive/20 transition-colors rounded-sm"
              style={{ minHeight: "44px" }}
              aria-label={t("offline.retryAria")}
            >
              {t("offline.retry")}
            </button>
            <button
              onClick={() => discardFailure(failure.id)}
              className="font-heading font-bold uppercase tracking-widest text-xs px-3 border border-destructive/50 hover:bg-destructive/20 transition-colors rounded-sm"
              style={{ minHeight: "44px" }}
              aria-label={t("offline.discardAria")}
            >
              {t("offline.discard")}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
