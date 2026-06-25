"use client"

/**
 * offline-indicator.tsx — nenápadný badge stavu připojení a čekajících mutací.
 *
 * Zobrazí "Offline" badge pokud !isOnline.
 * Pokud je offline a jsou čekající položky, zobrazí také počet: "⟳ N čeká".
 * Skrytý pokud je online a nejsou žádné čekající položky.
 *
 * pendingCount čte přes useSyncExternalStore (subscribePending/getPendingSnapshot)
 * — bez setState, bez useEffect, idiomatický React 19 pattern.
 */

import { useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { useConnectionState } from "@/hooks/use-connection-state"
import { subscribePending, getPendingSnapshot } from "@/lib/outbox"

/** Server snapshot pro pendingCount — 0 (SSR nezná IndexedDB stav) */
function getPendingServerSnapshot(): number {
  return 0
}

export function OfflineIndicator() {
  const { t } = useTranslation()
  const { isOnline } = useConnectionState()
  const pendingCount = useSyncExternalStore(
    subscribePending,
    getPendingSnapshot,
    getPendingServerSnapshot
  )

  if (isOnline && pendingCount === 0) return null

  const ariaLabel = isOnline
    ? t("offline.syncingAria", { count: pendingCount })
    : pendingCount > 0
      ? t("offline.offlineWithPendingAria", { count: pendingCount })
      : t("offline.offlineAria")

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-destructive/90 text-destructive-foreground text-xs font-bold uppercase tracking-widest rounded-sm"
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {!isOnline && <span>{t("offline.indicator")}</span>}
      {pendingCount > 0 && (
        <span aria-hidden="true">{t("offline.pendingBadge", { count: pendingCount })}</span>
      )}
    </span>
  )
}
