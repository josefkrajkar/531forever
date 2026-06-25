"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Výchozí délky pauzy (sekundy)
export const REST_TIMER_MAIN_SET = 180  // 3 minuty — main sety
export const REST_TIMER_AMRAP = 300     // 5 minut — AMRAP set
export const REST_TIMER_BBB = 90        // 1.5 minuty — supplemental/BBB sety

export interface RestTimerState {
  running: boolean
  remainingSec: number
  totalSec: number
  start: (sec: number, onDone?: () => void) => void
  stop: () => void
  addTime: (sec: number) => void
}

/**
 * Timestamp-based odpočet (přesný i při throttlingu záložky).
 * Počítá z cílového Date.now() namísto kumulace intervalů.
 *
 * Při doběhnutí: vibrace navigator.vibrate?.([200, 100, 200]) + volitelný onDone callback.
 */
export function useRestTimer(): RestTimerState {
  const [running, setRunning] = useState(false)
  const [remainingSec, setRemainingSec] = useState(0)
  const [totalSec, setTotalSec] = useState(0)

  // targetTime: Unix ms kdy má timer skončit
  const targetTimeRef = useRef<number>(0)
  // total: původní délka timeru (pro progress bar)
  const totalRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onDoneRef = useRef<(() => void) | undefined>(undefined)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000))
    setRemainingSec(remaining)

    if (remaining <= 0) {
      clearTimer()
      setRunning(false)
      // Vibrace při doběhnutí
      navigator.vibrate?.([200, 100, 200])
      onDoneRef.current?.()
    }
  }, [clearTimer])

  const start = useCallback(
    (sec: number, onDone?: () => void) => {
      clearTimer()
      const target = Date.now() + sec * 1000
      targetTimeRef.current = target
      totalRef.current = sec
      onDoneRef.current = onDone
      setTotalSec(sec)
      setRemainingSec(sec)
      setRunning(true)
      intervalRef.current = setInterval(tick, 500)
    },
    [clearTimer, tick]
  )

  const stop = useCallback(() => {
    clearTimer()
    setRunning(false)
    setRemainingSec(0)
    setTotalSec(0)
  }, [clearTimer])

  const addTime = useCallback((sec: number) => {
    if (!running) return
    targetTimeRef.current += sec * 1000
    totalRef.current += sec
    setTotalSec((prev) => prev + sec)
    // Okamžitý tick pro aktualizaci zobrazení
    const remaining = Math.max(0, Math.ceil((targetTimeRef.current - Date.now()) / 1000))
    setRemainingSec(remaining)
  }, [running])

  // Cleanup při unmount
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return { running, remainingSec, totalSec, start, stop, addTime }
}
