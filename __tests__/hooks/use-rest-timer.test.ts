/**
 * Testy pro hooks/use-rest-timer.ts
 *
 * Pokrývají:
 * - start → odpočet (remainingSec klesá)
 * - stop → timer se zastaví
 * - addTime → přidá sekundy
 * - doběhnutí → callback + navigator.vibrate volán
 */

import { renderHook, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { useRestTimer } from "@/hooks/use-rest-timer"

describe("useRestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Mock navigator.vibrate
    Object.defineProperty(navigator, "vibrate", {
      value: vi.fn(),
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("počáteční stav: running=false, remainingSec=0", () => {
    const { result } = renderHook(() => useRestTimer())
    expect(result.current.running).toBe(false)
    expect(result.current.remainingSec).toBe(0)
    expect(result.current.totalSec).toBe(0)
  })

  it("start(10) → running=true, remainingSec=10", () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => {
      result.current.start(10)
    })
    expect(result.current.running).toBe(true)
    expect(result.current.remainingSec).toBe(10)
    expect(result.current.totalSec).toBe(10)
  })

  it("po 3 sekundách remainingSec klesne přibližně na 7", () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => {
      result.current.start(10)
    })
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    // Timestamp-based: může být 7 nebo 8 (závisí na přesnosti fake timeru)
    expect(result.current.remainingSec).toBeGreaterThanOrEqual(6)
    expect(result.current.remainingSec).toBeLessThanOrEqual(8)
  })

  it("stop() → running=false, remainingSec=0", () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => {
      result.current.start(60)
    })
    expect(result.current.running).toBe(true)
    act(() => {
      result.current.stop()
    })
    expect(result.current.running).toBe(false)
    expect(result.current.remainingSec).toBe(0)
  })

  it("addTime(30) přidá 30 sekund k remainingSec", () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => {
      result.current.start(60)
    })
    act(() => {
      vi.advanceTimersByTime(5000) // 5 s uplynulo
    })
    const before = result.current.remainingSec
    act(() => {
      result.current.addTime(30)
    })
    expect(result.current.remainingSec).toBeGreaterThan(before)
    expect(result.current.totalSec).toBe(90)
  })

  it("po doběhnutí: running=false, callback zavolán, navigator.vibrate zavolán", () => {
    const { result } = renderHook(() => useRestTimer())
    const onDone = vi.fn()
    act(() => {
      result.current.start(5, onDone)
    })
    act(() => {
      vi.advanceTimersByTime(6000) // přetečení o 1 s
    })
    expect(result.current.running).toBe(false)
    expect(result.current.remainingSec).toBe(0)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledWith([200, 100, 200])
  })

  it("addTime nemá efekt když timer neběží", () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => {
      result.current.addTime(30)
    })
    expect(result.current.totalSec).toBe(0)
    expect(result.current.remainingSec).toBe(0)
  })

  it("nový start přepíše předchozí timer", () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => {
      result.current.start(60)
    })
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    act(() => {
      result.current.start(30)
    })
    expect(result.current.totalSec).toBe(30)
    expect(result.current.remainingSec).toBe(30)
    expect(result.current.running).toBe(true)
  })
})
