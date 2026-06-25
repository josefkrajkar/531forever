import { query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

/**
 * Kompletní export dat přihlášeného uživatele.
 * Vrací profil (bez citlivých auth polí), aktivní program, dokončené workouty
 * a accessory logy. Žádná mutace — jen čtení.
 */
export const exportData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    // ── Profil uživatele (bez citlivých auth polí) ──────────────────────────
    const user = await ctx.db.get(userId)
    const profile = user
      ? {
          name: user.name ?? null,
          email: user.email ?? null,
          athleteProfile: user.athleteProfile ?? null,
        }
      : null

    // ── Aktivní program ──────────────────────────────────────────────────────
    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    const activeProgram = program
      ? {
          trainingMaxes: program.trainingMaxes,
          programPhase: program.programPhase ?? null,
          supplementalTemplate: program.supplementalTemplate ?? null,
          cycle: program.cycle,
          week: program.week,
          dayIndex: program.dayIndex,
          macrocycleNumber: program.macrocycleNumber ?? null,
          phaseWeek: program.phaseWeek ?? null,
          split: program.split,
          increments: program.increments,
          rounding: program.rounding,
          amrapResults: program.amrapResults ?? [],
          e1rmHistory: program.e1rmHistory ?? null,
          createdAt: program.createdAt,
          updatedAt: program.updatedAt,
        }
      : null

    // ── Dokončené workouty (cap 1000, od nejnovějších) ───────────────────────
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user_status_date", (q) =>
        q.eq("userId", userId).eq("status", "completed")
      )
      .order("desc")
      .take(1000)

    // ── Accessory logy (cap 2000, index by_user_date) ────────────────────────
    // by_user_date index: první pole userId — sesbíráme přes userId prefix
    const accessoryLogs = await ctx.db
      .query("accessoryLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(2000)

    return {
      profile,
      activeProgram,
      workouts,
      accessoryLogs,
    }
  },
})
