"use client"

/**
 * use-sync-triggers.ts — Flush triggery pro offline-first sync.
 *
 * Registruje event listenery, které zavolají flushNow() při:
 * - Mountu komponenty (flush po otevření/reload stránky — hlavní pro iOS)
 * - window 'online' eventu (zařízení se připojilo k síti)
 * - document 'visibilitychange' → visible (přepnutí tab/aplikace zpět do popředí)
 *
 * Toto je hlavní cross-platform mechanismus pro offline sync.
 * Funguje i na iOS Safari, kde Background Sync API není dostupné.
 *
 * Pravidla hooks:
 * - ŽÁDNÉ setState — listenery volají pouze flushNow (external side effect)
 * - Cleanup listenerů při unmountu
 * - useSyncExternalStore by bylo zbytečné — nepotřebujeme re-render z těchto eventů
 */

import { useEffect } from "react"
import { flushNow } from "@/lib/sync-runtime"
import { initPendingCount } from "@/lib/outbox"

/**
 * Hook pro registraci flush triggerů.
 *
 * Mountni jednou v kořenové komponentě (WorkoutPage).
 * Automaticky se odregistruje při unmountu.
 */
export function useSyncTriggers(): void {
  useEffect(() => {
    // Inicializuj pendingCount z IndexedDB při mountu
    initPendingCount().catch((err) => {
      console.error("[use-sync-triggers] initPendingCount selhal:", err)
    })

    // Flush při mountu — zpracuj položky z předchozí offline session
    flushNow().catch((err) => {
      console.error("[use-sync-triggers] Flush při mountu selhal:", err)
    })

    // Handler pro 'online' event — zařízení se připojilo
    function handleOnline(): void {
      flushNow().catch((err) => {
        console.error("[use-sync-triggers] Flush při online eventu selhal:", err)
      })
    }

    // Handler pro 'visibilitychange' — aplikace je viditelná (přepnutí zpět na iOS)
    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        flushNow().catch((err) => {
          console.error("[use-sync-triggers] Flush při visibilitychange selhal:", err)
        })
      }
    }

    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, []) // Prázdné deps — registruj jednou při mountu, cleanup při unmountu
}
