/**
 * Bodyweight time series — logování tělesné váhy po dnech.
 *
 * Datum vždy přijímáme Z KLIENTA (povinný arg) — Convex mutace jsou
 * deterministické a `new Date()` v mutaci není garantováno být aktuální.
 */

import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

// Regex pro validaci formátu YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Zaloguje tělesnou váhu pro daný den (UPSERT — druhé zalogování v týž den přepíše).
 * Pokud je datum >= poslednímu záznamu, aktualizuje také athleteProfile.weight.
 *
 * @param date - YYYY-MM-DD, povinné (klient posílá dnešní datum)
 * @param weightKg - tělesná váha v kg (30–300)
 */
export const logBodyweight = mutation({
  args: {
    date: v.string(),
    weightKg: v.number(),
    // Provenience záznamu (volitelné, default "manual") — pro GDPR a UX
    source: v.optional(v.union(v.literal("manual"), v.literal("garmin"), v.literal("apple_health"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Není přihlášen")

    // Validace formátu data
    if (!DATE_REGEX.test(args.date)) {
      throw new Error("Neplatný formát data — očekáváno YYYY-MM-DD")
    }

    // Validace váhy
    if (!Number.isFinite(args.weightKg) || args.weightKg < 30 || args.weightKg > 300) {
      throw new Error("Neplatná váha: musí být konečné číslo od 30 do 300 kg")
    }

    const source = args.source ?? "manual"

    // UPSERT — najdi existující záznam pro tento den
    const existing = await ctx.db
      .query("bodyweightLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", args.date)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { weightKg: args.weightKg, source })
    } else {
      await ctx.db.insert("bodyweightLogs", {
        userId,
        date: args.date,
        weightKg: args.weightKg,
        source,
      })
    }

    // Aktualizuj athleteProfile.weight, jen pokud je toto datum >= poslednímu logu
    // (chceme, aby profil vždy reflektoval nejaktuálnější váhu)
    const latestLog = await ctx.db
      .query("bodyweightLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .first()

    // latestLog je buď právě vložený/updatovaný záznam, nebo pozdější
    const isLatestOrEqual = !latestLog || latestLog.date <= args.date
    if (isLatestOrEqual) {
      const user = await ctx.db.get(userId)
      if (user) {
        await ctx.db.patch(userId, {
          athleteProfile: {
            gender: user.athleteProfile?.gender ?? "male",
            age: user.athleteProfile?.age ?? 25,
            height: user.athleteProfile?.height ?? 175,
            weight: args.weightKg,
            experience: user.athleteProfile?.experience ?? "intermediate",
          },
        })
      }
    }

    console.log("[bodyweight] logged", args.date, args.weightKg, "kg for", userId)
  },
})

/**
 * Smaže záznam tělesné váhy pro daný den (ownership check).
 */
export const deleteBodyweightLog = mutation({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Není přihlášen")

    const log = await ctx.db
      .query("bodyweightLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("date", args.date)
      )
      .first()

    if (!log) throw new Error("Záznam nenalezen")
    if (log.userId !== userId) throw new Error("Nemáš oprávnění smazat tento záznam")

    await ctx.db.delete(log._id)

    // Resync athleteProfile.weight — pokud byl smazán nejnovější log,
    // profil musí reflektovat nový nejnovější záznam (jinak by zůstal stale)
    const latestLog = await ctx.db
      .query("bodyweightLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .first()

    if (latestLog && latestLog.date < args.date) {
      // Smazaný log byl nejnovější → profil přepiš na nový nejnovější
      const user = await ctx.db.get(userId)
      if (user?.athleteProfile) {
        await ctx.db.patch(userId, {
          athleteProfile: { ...user.athleteProfile, weight: latestLog.weightKg },
        })
      }
    }
    // Pokud nezbyl žádný log, athleteProfile.weight ponecháváme — je to poslední známá váha

    console.log("[bodyweight] deleted", args.date, "for", userId)
  },
})

/**
 * Vrátí historii tělesné váhy vzestupně dle data, max 730 záznamů (~2 roky).
 */
export const getBodyweightHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const logs = await ctx.db
      .query("bodyweightLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("asc")
      .take(730)

    return logs
  },
})
