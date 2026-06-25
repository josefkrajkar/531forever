"use client"

/**
 * use-connection-state.ts — stav připojení k Convexu a síti.
 *
 * Kombinuje:
 * - Convex subscribeToConnectionState() pro stav WebSocket (inflight requesty)
 * - navigator.onLine + online/offline eventy pro síťový stav
 *
 * Implementováno přes useSyncExternalStore — idiomatický React 19 způsob
 * subscribování k externím zdrojům bez setState v efektu.
 *
 * Vrací { isOnline, isSyncing }:
 * - isOnline: true = prohlížeč je online (navigator.onLine + live events)
 * - isSyncing: true = Convex má probíhající inflight requesty
 */

import { useSyncExternalStore } from "react"
import { convex } from "@/components/convex-client-provider"

export interface ConnectionState {
  /** Prohlížeč je online (navigator.onLine + live events) */
  isOnline: boolean
  /** Convex má probíhající inflight requesty */
  isSyncing: boolean
}

// ─── Online/offline store (stabilní reference mimo komponentu) ───────────────
function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}
function getOnlineSnapshot(): boolean {
  return navigator.onLine
}
function getOnlineServerSnapshot(): boolean {
  // SSR/první render — předpokládáme online (hydration bezpečné)
  return true
}

// ─── Convex inflight store ───────────────────────────────────────────────────
function subscribeSyncing(callback: () => void): () => void {
  // Defenzivně: starší klient nemusí mít subscribeToConnectionState.
  // V takovém případě se subscriber nikdy nezavolá a getSyncingSnapshot
  // (taktéž s guardem) vrací vždy false — isSyncing degraduje na false,
  // což je pro offline indikátor přijatelné.
  if (typeof convex.subscribeToConnectionState !== "function") return () => {}
  return convex.subscribeToConnectionState(() => callback())
}
function getSyncingSnapshot(): boolean {
  if (typeof convex.connectionState !== "function") return false
  return convex.connectionState().hasInflightRequests
}
function getSyncingServerSnapshot(): boolean {
  return false
}

/**
 * Hook pro sledování stavu připojení k síti a Convex backendu.
 * Bezpečný pro SSR — useSyncExternalStore vrací server snapshot do hydratace.
 */
export function useConnectionState(): ConnectionState {
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  )
  const isSyncing = useSyncExternalStore(
    subscribeSyncing,
    getSyncingSnapshot,
    getSyncingServerSnapshot
  )

  return { isOnline, isSyncing }
}
