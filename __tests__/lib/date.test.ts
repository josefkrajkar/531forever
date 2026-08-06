/**
 * Testy pro lib/date.ts — localToday().
 *
 * Pokrývá:
 * - TZ-independent důkaz: localToday() vrací lokální datum bez posunu
 *   způsobeného .toISOString() (starý přístup by v UTC+ pásmech vrátil
 *   předchozí den).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { localToday } from "@/lib/date"

describe("localToday", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("vrátí lokální datum nezávisle na TZ běžícího runneru", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30))
    expect(localToday()).toBe("2026-01-01")
  })
})
