"use client"

/**
 * use-cached-query.ts — obal nad Convex useQuery s offline-first caching.
 *
 * Logika:
 * 1. Vždy (bezpodmínečně) zavolá useQuery z Convexu.
 * 2. Když live data přijdou (≠ undefined), uloží je do IndexedDB.
 * 3. Když jsou live data undefined (offline/loading), zkusí hydratovat
 *    z IndexedDB cache a vrátí cached hodnotu jako fallback.
 * 4. Vrátí i příznak `isStale` — true = data pochází z cache, ne z live Convexu.
 */

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import type { FunctionReference, OptionalRestArgs } from "convex/server"
import { getSnapshot, putSnapshot } from "@/lib/offline-store"

export interface CachedQueryResult<T> {
  /** Aktuální data (live nebo cached) */
  data: T | undefined
  /**
   * true = data pochází z IndexedDB cache (Convex je nedostupný/loading).
   * false = data jsou živá z Convexu.
   */
  isStale: boolean
}

/**
 * Obal nad Convex `useQuery` s automatickým offline caching.
 *
 * @param queryRef  Reference na Convex query funkci (např. api.programs.getCurrentProgram)
 * @param args      Argumenty query (stejné jako pro useQuery)
 * @param cacheKey  Klíč pod kterým se data uloží do IndexedDB
 */
export function useCachedQuery<
  Query extends FunctionReference<"query", "public">,
>(
  queryRef: Query,
  args: OptionalRestArgs<Query>[0] extends undefined
    ? Record<string, never>
    : OptionalRestArgs<Query>[0],
  cacheKey: string
): CachedQueryResult<Awaited<ReturnType<Query["_returnType"]>>> {
  type T = Awaited<ReturnType<Query["_returnType"]>>

  // Bezpodmínečné volání useQuery — Rules of Hooks
  const liveData = useQuery(queryRef, args as OptionalRestArgs<Query>[0]) as
    | T
    | undefined

  // Cached data z IndexedDB spolu s klíčem, ke kterému patří.
  // Klíč držíme u dat, abychom při jeho změně nevrátili stará cached data
  // (vyhneme se tak synchronnímu resetu stavu v efektu).
  const [cached, setCached] = useState<{ key: string; data: T | undefined } | null>(
    null
  )

  // Efekt: Hydratuj z cache při startu nebo změně klíče
  useEffect(() => {
    let cancelled = false

    getSnapshot<T>(cacheKey).then((value) => {
      if (!cancelled) {
        // value === undefined znamená "klíč v cache chybí".
        // Uložená hodnota (včetně null = "žádný program") se zachová.
        setCached({ key: cacheKey, data: value })
      }
    })

    return () => {
      cancelled = true
    }
  }, [cacheKey])

  // Efekt: Při příchodu live dat je ulož do cache
  useEffect(() => {
    if (liveData !== undefined) {
      putSnapshot(cacheKey, liveData).catch(() => {
        // Tichá chyba — cache je best-effort
      })
    }
  }, [liveData, cacheKey])

  // Rozhodnutí: live data mají přednost, fallback na cache
  if (liveData !== undefined) {
    return { data: liveData, isStale: false }
  }

  // Live data jsou undefined — vrátíme cache, jen pokud patří k aktuálnímu klíči.
  // Pozor: podmínka je `!== undefined`, NE `!= null` — `null` je validní cached
  // hodnota (= "žádný program"), kdežto `undefined` znamená "klíč v cache chybí".
  if (cached && cached.key === cacheKey && cached.data !== undefined) {
    return { data: cached.data, isStale: true }
  }

  // Ještě se načítá (ani live, ani cache) — vrátíme undefined
  return { data: undefined, isStale: false }
}
