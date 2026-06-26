"use client"

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"

const STORAGE_KEY = "wake-lock-enabled"

type WakeLockNav = Navigator & {
  wakeLock: { request: (type: string) => Promise<WakeLockSentinel> }
}

/**
 * Hook nad Screen Wake Lock API.
 * - supported: API existuje v prohlížeči
 * - active: lock je aktuálně držen
 * - toggle: přepne prefer (uloží do localStorage) a aktivuje/deaktivuje lock
 *
 * Lock se automaticky uvolní při minimalizaci záložky a re-acquire při návratu.
 * Preference (zapnuto/vypnuto) je uložena v localStorage, default = zapnuto pokud supported.
 */
export function useWakeLock() {
  const supported =
    typeof window !== "undefined" && "wakeLock" in navigator

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const stored = localStorage.getItem(STORAGE_KEY)
    // Default: zapnuto pokud API existuje
    return stored !== null ? stored === "true" : supported
  })

  const [active, setActive] = useState(false)
  const lockRef = useRef<WakeLockSentinel | null>(null)

  // useEffectEvent: non-reactive callbacks that always read current
  // supported/enabled/setActive but do NOT re-trigger effects when those
  // values change. setState calls inside useEffectEvent are not flagged by
  // react-hooks/set-state-in-effect because they are effect events, not
  // synchronous effect body calls.
  // Rules: never put these in a dependency array, never pass as prop.
  const acquireEvent = useEffectEvent(async () => {
    if (!supported || !enabled) return
    try {
      lockRef.current = await (navigator as WakeLockNav).wakeLock.request("screen")
      setActive(true)
      lockRef.current.addEventListener("release", () => {
        setActive(false)
        lockRef.current = null
      })
    } catch {
      // Může selhat např. na iOS Safari nebo při nízkém baterii
      setActive(false)
    }
  })

  const releaseEvent = useEffectEvent(async () => {
    if (lockRef.current) {
      await lockRef.current.release()
      lockRef.current = null
      setActive(false)
    }
  })

  // Acquire/release podle preference
  useEffect(() => {
    if (enabled) {
      void acquireEvent()
    } else {
      void releaseEvent()
    }
    return () => {
      void releaseEvent()
    }
  }, [enabled])

  // Re-acquire po návratu záložky na popředí (lock se uvolní při minimalizaci)
  useEffect(() => {
    if (!supported) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && enabled) {
        void acquireEvent()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [supported, enabled])

  const toggle = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }, [enabled])

  return { supported, active, toggle, enabled }
}
