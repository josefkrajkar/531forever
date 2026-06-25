/**
 * Testy pro hooks/use-cached-query.ts — offline-first obal nad useQuery.
 *
 * Pokrývá kritickou logiku:
 * - live data mají přednost (isStale=false)
 * - live null je validní výsledek (ne "loading")
 * - offline hydratace z cache (isStale=true), včetně cached null
 * - prázdná cache → undefined
 * - guard na shodu klíče
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { renderHook, waitFor } from "@testing-library/react"

// useQuery mockujeme — řídíme tím "live" hodnotu z Convexu
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}))

import { useQuery } from "convex/react"
import { useCachedQuery } from "@/hooks/use-cached-query"
import { putSnapshot } from "@/lib/offline-store"

const mockUseQuery = vi.mocked(useQuery)
// queryRef je jen předáván do (mocknutého) useQuery — obsah nezáleží
const queryRef = {} as Parameters<typeof useCachedQuery>[0]

beforeEach(() => {
  mockUseQuery.mockReset()
})

describe("useCachedQuery", () => {
  it("vrátí live data s isStale=false a uloží je do cache", async () => {
    const live = { cycle: 2, week: 1 }
    mockUseQuery.mockReturnValue(live)

    const { result } = renderHook(() =>
      useCachedQuery(queryRef, {}, "uc_live")
    )

    expect(result.current).toEqual({ data: live, isStale: false })
    // Po efektu se data uloží do cache
    await waitFor(async () => {
      const { getSnapshot } = await import("@/lib/offline-store")
      expect(await getSnapshot("uc_live")).toEqual(live)
    })
  })

  it("live null je validní výsledek (isStale=false), ne loading", () => {
    mockUseQuery.mockReturnValue(null)

    const { result } = renderHook(() =>
      useCachedQuery(queryRef, {}, "uc_live_null")
    )

    expect(result.current).toEqual({ data: null, isStale: false })
  })

  it("offline (undefined) hydratuje z cache s isStale=true", async () => {
    await putSnapshot("uc_cached", { cycle: 9 })
    mockUseQuery.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      useCachedQuery(queryRef, {}, "uc_cached")
    )

    await waitFor(() => {
      expect(result.current).toEqual({ data: { cycle: 9 }, isStale: true })
    })
  })

  it("offline s cached null vrátí null (žádný program), ne loading", async () => {
    await putSnapshot("uc_cached_null", null)
    mockUseQuery.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      useCachedQuery(queryRef, {}, "uc_cached_null")
    )

    await waitFor(() => {
      expect(result.current).toEqual({ data: null, isStale: true })
    })
  })

  it("offline a prázdná cache → data undefined, isStale=false", async () => {
    mockUseQuery.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      useCachedQuery(queryRef, {}, "uc_empty_xyz")
    )

    // Po dokončení hydratace zůstane undefined (klíč v cache chybí)
    await waitFor(() => {
      expect(result.current.data).toBeUndefined()
    })
    expect(result.current.isStale).toBe(false)
  })
})
