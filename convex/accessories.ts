import { v } from "convex/values"
import { internalMutation, mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { estimateE1RM } from "../lib/strength-calculations"

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const MAX_SETS_PER_EXERCISE = 20
const MAX_EXERCISES_PER_LOG = 30
const MAX_ACCESSORY_ID_LENGTH = 50

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a single accessory set.
 * weight: konečné číslo 0–1000 kg (0 = bodyweight cviky)
 * reps:   celé číslo 0–100
 * completed: boolean (validátor Convex vynutí typ)
 */
function validateAccessorySet(
  set: { weight: number; reps: number; completed: boolean },
  index: number
): void {
  if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000) {
    throw new Error(
      `Neplatná váha v setu ${index + 1}: musí být číslo od 0 do 1000 kg`
    )
  }
  if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 100) {
    throw new Error(
      `Neplatný počet opakování v setu ${index + 1}: musí být celé číslo od 0 do 100`
    )
  }
}

/**
 * Validates accessoryId length (against catalog max + safe margin).
 */
function validateAccessoryId(accessoryId: string): void {
  if (accessoryId.length === 0 || accessoryId.length > MAX_ACCESSORY_ID_LENGTH) {
    throw new Error(
      `Neplatné ID cviku: délka musí být 1 až ${MAX_ACCESSORY_ID_LENGTH} znaků`
    )
  }
}

/**
 * Validates a set array — count limit + per-set validation.
 */
function validateSets(
  sets: Array<{ weight: number; reps: number; completed: boolean }>
): void {
  if (sets.length > MAX_SETS_PER_EXERCISE) {
    throw new Error(
      `Příliš mnoho setů: maximum je ${MAX_SETS_PER_EXERCISE} setů na cvik`
    )
  }
  sets.forEach((set, i) => validateAccessorySet(set, i))
}

// Lift type validator (shared)
const liftValidator = v.union(
  v.literal("squat"),
  v.literal("bench"),
  v.literal("deadlift"),
  v.literal("press")
)

// ============================================================================
// ACCESSORY SETTINGS
// ============================================================================

// Get accessory settings from active program
export const getAccessorySettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) return null

    return program.accessorySettings || null
  },
})

// Update accessory settings (equipment, BBB config, excluded tags)
export const updateAccessorySettings = mutation({
  args: {
    bbb: v.optional(v.object({
      enabled: v.boolean(),
      percent: v.number(),
      sets: v.number(),
      reps: v.number(),
    })),
    availableEquipment: v.optional(v.array(v.string())),
    excludeTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    // Merge with existing settings
    const currentSettings = program.accessorySettings || {
      bbb: { enabled: true, percent: 0.50, sets: 5, reps: 10 },
      availableEquipment: [],
      excludeTags: [],
      perDay: { squat: [], bench: [], deadlift: [], press: [] },
    }

    const updatedSettings = {
      ...currentSettings,
      ...(args.bbb !== undefined && { bbb: args.bbb }),
      ...(args.availableEquipment !== undefined && { availableEquipment: args.availableEquipment }),
      ...(args.excludeTags !== undefined && { excludeTags: args.excludeTags }),
    }

    await ctx.db.patch(program._id, {
      accessorySettings: updatedSettings,
      updatedAt: new Date().toISOString(),
    })

    console.log("[accessories] Updated settings:", updatedSettings)
    return updatedSettings
  },
})

// Set accessories for a specific training day
export const setDayAccessories = mutation({
  args: {
    lift: liftValidator,
    accessoryIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    const currentSettings = program.accessorySettings || {
      bbb: { enabled: true, percent: 0.50, sets: 5, reps: 10 },
      availableEquipment: [],
      excludeTags: [],
      perDay: { squat: [], bench: [], deadlift: [], press: [] },
    }

    const updatedPerDay = {
      ...currentSettings.perDay,
      [args.lift]: args.accessoryIds,
    }

    const updatedSettings = {
      ...currentSettings,
      perDay: updatedPerDay,
    }

    await ctx.db.patch(program._id, {
      accessorySettings: updatedSettings,
      updatedAt: new Date().toISOString(),
    })

    console.log("[accessories] Set accessories for", args.lift, ":", args.accessoryIds)
    return updatedSettings
  },
})

// ============================================================================
// ACCESSORY LOGS (for double progression tracking)
// ============================================================================

// Regex pro validaci formátu YYYY-MM-DD (shodný s bodyweight.ts)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Log accessory performance
export const logAccessory = mutation({
  args: {
    accessoryId: v.string(),
    sets: v.array(v.object({
      weight: v.number(),
      reps: v.number(),
      completed: v.boolean(),
    })),
    date: v.optional(v.string()), // YYYY-MM-DD z klienta — offline replay zaloguje na správné datum
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    validateAccessoryId(args.accessoryId)
    validateSets(args.sets)

    // Validace klientského data (pokud přišlo)
    if (args.date !== undefined && !DATE_REGEX.test(args.date)) {
      throw new Error("Neplatný formát data — očekáváno YYYY-MM-DD")
    }

    // Get program context if available
    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    // Klientské datum má přednost; fallback na serverové (zpětná kompatibilita)
    const today = args.date ?? new Date().toISOString().split("T")[0]

    // Check for existing log today (UPSERT per user, date, accessoryId)
    const existingLog = await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .filter((q) => q.eq(q.field("accessoryId"), args.accessoryId))
      .first()

    if (existingLog) {
      // Update existing log
      await ctx.db.patch(existingLog._id, {
        sets: args.sets,
      })
      console.log("[accessories] Updated log for", args.accessoryId, "on", today)
      return existingLog._id
    }

    // Create new log
    const logId = await ctx.db.insert("accessoryLogs", {
      userId,
      accessoryId: args.accessoryId,
      date: today,
      sets: args.sets,
      programCycle: program?.cycle,
      programWeek: program?.week,
      dayIndex: program?.dayIndex,
    })

    console.log("[accessories] Created log for", args.accessoryId, ":", logId)
    return logId
  },
})

// Get recent logs for an accessory (for progression calculation)
export const getAccessoryHistory = query({
  args: {
    accessoryId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const logs = await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_accessory", (q) => q.eq("userId", userId).eq("accessoryId", args.accessoryId))
      .order("desc")
      .take(args.limit || 10)

    return logs
  },
})

// Get most recent log for an accessory
export const getLastAccessoryLog = query({
  args: {
    accessoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_accessory", (q) => q.eq("userId", userId).eq("accessoryId", args.accessoryId))
      .order("desc")
      .first()
  },
})

// Get all accessory logs for today (for workout view)
export const getTodayAccessoryLogs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const today = new Date().toISOString().split("T")[0]

    return await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .collect()
  },
})

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

// Log multiple accessories at once (for workout completion)
export const logMultipleAccessories = mutation({
  args: {
    logs: v.array(v.object({
      accessoryId: v.string(),
      sets: v.array(v.object({
        weight: v.number(),
        reps: v.number(),
        completed: v.boolean(),
      })),
    })),
    date: v.optional(v.string()), // YYYY-MM-DD z klienta — offline replay zaloguje na správné datum
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    if (args.logs.length > MAX_EXERCISES_PER_LOG) {
      throw new Error(
        `Příliš mnoho cviků: maximum je ${MAX_EXERCISES_PER_LOG} cviků najednou`
      )
    }
    for (const log of args.logs) {
      validateAccessoryId(log.accessoryId)
      validateSets(log.sets)
    }

    // Validace klientského data (pokud přišlo)
    if (args.date !== undefined && !DATE_REGEX.test(args.date)) {
      throw new Error("Neplatný formát data — očekáváno YYYY-MM-DD")
    }

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    // Klientské datum má přednost; fallback na serverové (zpětná kompatibilita)
    const today = args.date ?? new Date().toISOString().split("T")[0]
    const logIds: string[] = []

    for (const log of args.logs) {
      // Check for existing log (UPSERT per user, date, accessoryId)
      const existing = await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
        .filter((q) => q.eq(q.field("accessoryId"), log.accessoryId))
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, { sets: log.sets })
        logIds.push(existing._id)
      } else {
        const id = await ctx.db.insert("accessoryLogs", {
          userId,
          accessoryId: log.accessoryId,
          date: today,
          sets: log.sets,
          programCycle: program?.cycle,
          programWeek: program?.week,
          dayIndex: program?.dayIndex,
        })
        logIds.push(id)
      }
    }

    console.log("[accessories] Logged", logIds.length, "accessories")
    return logIds
  },
})

// ============================================================================
// TREND QUERIES (per-accessory history for statistics page)
// ============================================================================

/**
 * Per-accessory time series for the statistics/trends view.
 *
 * Returns one entry per calendar day the user logged this accessory.
 * Only COMPLETED sets are counted (sets.completed === true).
 *
 * Bodyweight cviky (weight === 0 for all sets):
 *   – bestE1RM = 0 (e1RM bez váhy nedává smysl)
 *   – topWeight = 0
 *   – totalVolume = 0 (nelze počítat v kg)
 *   – totalReps = Σ reps completed setů (jediná smysluplná metrika)
 *
 * Weighted cviky:
 *   – bestE1RM = max estimateE1RM(weight, reps) přes completed sety
 *   – topWeight = max weight completed setů
 *   – totalVolume = Σ weight × reps completed setů (v kg)
 *   – totalReps = Σ reps completed setů
 *
 * Cap: 500 logů, seřazeno vzestupně dle data.
 */
export const getAccessoryTrends = query({
  args: {
    accessoryId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    // Validace délky accessoryId
    if (args.accessoryId.length === 0 || args.accessoryId.length > MAX_ACCESSORY_ID_LENGTH) {
      return []
    }

    // Načteme posledních 500 logů pro daný cvik (cap)
    const logs = await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_accessory", (q) =>
        q.eq("userId", userId).eq("accessoryId", args.accessoryId)
      )
      .order("asc")
      .take(500)

    // Agregujeme per datum (může být více logů pro stejný den — bereme nejlepší)
    const byDate: Record<
      string,
      { bestE1RM: number; topWeight: number; totalVolume: number; totalReps: number }
    > = {}

    for (const log of logs) {
      const completedSets = log.sets.filter((s) => s.completed)
      if (completedSets.length === 0) continue

      const isBodyweight = completedSets.every((s) => s.weight === 0)

      let bestE1RM = 0
      let topWeight = 0
      let totalVolume = 0
      let totalReps = 0

      for (const s of completedSets) {
        totalReps += s.reps
        if (!isBodyweight) {
          totalVolume += s.weight * s.reps
          if (s.weight > topWeight) topWeight = s.weight
          const e1rm = estimateE1RM(s.weight, s.reps)
          if (e1rm > bestE1RM) bestE1RM = e1rm
        }
      }

      const existing = byDate[log.date]
      if (!existing) {
        byDate[log.date] = { bestE1RM, topWeight, totalVolume, totalReps }
      } else {
        // Zachováme nejlepší hodnoty pokud existuje duplicitní záznam pro den
        byDate[log.date] = {
          bestE1RM: Math.max(existing.bestE1RM, bestE1RM),
          topWeight: Math.max(existing.topWeight, topWeight),
          totalVolume: existing.totalVolume + totalVolume,
          totalReps: existing.totalReps + totalReps,
        }
      }
    }

    // Převedeme na seřazené pole
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, metrics]) => ({ date, ...metrics }))
  },
})

/**
 * Returns list of unique accessoryIds that the logged-in user has any logs for.
 * Cap 500 most recent logs to keep it cheap.
 */
export const getUsedAccessories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    const logs = await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(500)

    const seen = new Set<string>()
    for (const log of logs) {
      seen.add(log.accessoryId)
    }

    return Array.from(seen)
  },
})

// Delete accessory logs (for cleanup/testing — internal only, not exposed to UI)
// Caller must pass userId explicitly since there is no auth context in internalMutation.
export const deleteAccessoryLogs = internalMutation({
  args: {
    userId: v.id("users"),
    accessoryId: v.optional(v.string()),  // if not provided, deletes all for user
  },
  handler: async (ctx, args) => {
    let logs
    if (args.accessoryId) {
      const accessoryId = args.accessoryId  // narrow type
      logs = await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_accessory", (q) => q.eq("userId", args.userId).eq("accessoryId", accessoryId))
        .collect()
    } else {
      logs = await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
        .collect()
    }

    for (const log of logs) {
      await ctx.db.delete(log._id)
    }

    console.log("[accessories] Deleted", logs.length, "logs for user:", args.userId)
    return { deleted: logs.length }
  },
})
