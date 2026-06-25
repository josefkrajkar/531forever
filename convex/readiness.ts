/**
 * readiness.ts — ukládání readiness signálů (HRV, klidový tep, spánek, pocit).
 *
 * Vstup pro deterministické readiness skóre (lib/readiness.ts). UPSERT per
 * (user, date) s MERGE sémantikou — manuální vstup a pozdější wearable (Garmin/
 * Apple) mohou doplnit různé metriky téhož dne, aniž by se navzájem přepsaly.
 *
 * Datum přijímáme Z KLIENTA (povinný arg), stejně jako u bodyweight.
 * POZOR (GDPR čl. 9): HRV/spánek/tep = zvláštní kategorie — jen pro vlastníka.
 */

import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const sourceValidator = v.union(
  v.literal("manual"),
  v.literal("garmin"),
  v.literal("apple_health")
)

/**
 * Zaznamená/aktualizuje readiness signály pro daný den (UPSERT + merge).
 * Přepíší se jen ty metriky, které přijdou; ostatní zůstanou zachované.
 * Vyžaduje aspoň jednu metriku.
 */
export const upsertReadinessSignal = mutation({
  args: {
    date: v.string(),
    hrvMs: v.optional(v.number()),
    restingHrBpm: v.optional(v.number()),
    sleepHours: v.optional(v.number()),
    sleepQuality: v.optional(v.number()),
    subjectiveFeel: v.optional(
      v.union(v.literal("great"), v.literal("normal"), v.literal("bad"))
    ),
    source: v.optional(sourceValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Není přihlášen")

    if (!DATE_REGEX.test(args.date)) {
      throw new Error("Neplatný formát data — očekáváno YYYY-MM-DD")
    }

    // Validace rozsahů (jen pro dodané metriky)
    if (args.hrvMs !== undefined) {
      if (!Number.isFinite(args.hrvMs) || args.hrvMs <= 0 || args.hrvMs > 1000) {
        throw new Error("Neplatné HRV: musí být konečné číslo nad 0 a max 1000 ms")
      }
    }
    if (args.restingHrBpm !== undefined) {
      if (!Number.isFinite(args.restingHrBpm) || args.restingHrBpm < 20 || args.restingHrBpm > 220) {
        throw new Error("Neplatný klidový tep: musí být od 20 do 220 bpm")
      }
    }
    if (args.sleepHours !== undefined) {
      if (!Number.isFinite(args.sleepHours) || args.sleepHours < 0 || args.sleepHours > 24) {
        throw new Error("Neplatná délka spánku: musí být od 0 do 24 hodin")
      }
    }
    if (args.sleepQuality !== undefined) {
      if (!Number.isFinite(args.sleepQuality) || args.sleepQuality < 0 || args.sleepQuality > 100) {
        throw new Error("Neplatná kvalita spánku: musí být od 0 do 100")
      }
    }

    const hasSignal =
      args.hrvMs !== undefined ||
      args.restingHrBpm !== undefined ||
      args.sleepHours !== undefined ||
      args.sleepQuality !== undefined ||
      args.subjectiveFeel !== undefined
    if (!hasSignal) {
      throw new Error("Žádná readiness metrika — zadej aspoň jednu hodnotu")
    }

    const source = args.source ?? "manual"

    // Sestav patch jen z dodaných metrik (merge — nepřepisuj chybějící).
    // `source` se přidává až v zápisu, ať se neduplikuje (vzor bodyweight.ts).
    const patch: Record<string, unknown> = {}
    if (args.hrvMs !== undefined) patch.hrvMs = args.hrvMs
    if (args.restingHrBpm !== undefined) patch.restingHrBpm = args.restingHrBpm
    if (args.sleepHours !== undefined) patch.sleepHours = args.sleepHours
    if (args.sleepQuality !== undefined) patch.sleepQuality = args.sleepQuality
    if (args.subjectiveFeel !== undefined) patch.subjectiveFeel = args.subjectiveFeel

    const existing = await ctx.db
      .query("readinessSignals")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { ...patch, source })
    } else {
      await ctx.db.insert("readinessSignals", {
        userId,
        date: args.date,
        ...patch,
        source,
      })
    }

    console.log("[readiness] upsert", args.date, "source", source, "for", userId)
  },
})

/** Smaže readiness záznam pro daný den (ownership check). */
export const deleteReadinessSignal = mutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Není přihlášen")

    const record = await ctx.db
      .query("readinessSignals")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first()

    if (!record) throw new Error("Záznam nenalezen")
    if (record.userId !== userId) throw new Error("Nemáš oprávnění smazat tento záznam")

    await ctx.db.delete(record._id)
    console.log("[readiness] deleted", args.date, "for", userId)
  },
})

/** Vrátí historii readiness signálů vzestupně dle data, max 365 záznamů. */
export const getReadinessHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    return await ctx.db
      .query("readinessSignals")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("asc")
      .take(365)
  },
})

/** Vrátí readiness záznam pro konkrétní den (nebo null). */
export const getReadinessForDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query("readinessSignals")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first()
  },
})
