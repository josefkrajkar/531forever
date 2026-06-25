import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import {
  applyCycleProgression,
  estimateE1RM,
  roundToPlate,
  type ProgressionState,
  type CycleProgressionSummary,
  type Lift,
} from "../lib/531"

// Type definitions for 5/3/1 Forever
type ProgramPhase = "leader1" | "leader2" | "anchor" | "seventh_week"

// Phase configuration
const PHASE_WEEKS: Record<ProgramPhase, number> = {
  leader1: 6,      // 2 cycles × 3 weeks
  leader2: 6,      // 2 cycles × 3 weeks
  anchor: 3,       // 1 cycle × 3 weeks
  seventh_week: 1, // Just 1 week
}

// Shared helper: advance program position by one day (3-week Forever cycle)
// Returns new { dayIndex, week, cycle } without mutating the program.
function advanceProgramPosition(program: {
  dayIndex: number
  week: number
  cycle: number
}): { dayIndex: number; week: number; cycle: number } {
  const newDayIndex = (program.dayIndex + 1) % 4
  let newWeek = program.week
  let newCycle = program.cycle

  if (newDayIndex === 0) {
    // Completed all 4 days this week — advance to next week (3-week cycle)
    newWeek = (program.week % 3) + 1
    if (newWeek === 1) {
      // Wrapped from week 3 back to week 1 → new cycle
      newCycle = program.cycle + 1
    }
  }

  return { dayIndex: newDayIndex, week: newWeek, cycle: newCycle }
}

// Determine next phase after completing the 7th week, based on the phase that
// preceded it (the next phase does NOT depend on macrocycleNumber).
function getNextPhaseAfterSeventh(
  completedPhase: ProgramPhase | null
): { nextPhase: ProgramPhase; newMacrocycle: boolean } {
  // 7th week comes after leader1, leader2, or anchor
  // Sequence: leader1 → 7th → leader2 → 7th → anchor → 7th → (new macrocycle) leader1
  if (!completedPhase || completedPhase === "anchor") {
    return { nextPhase: "leader1", newMacrocycle: true }
  }
  if (completedPhase === "leader1") {
    return { nextPhase: "leader2", newMacrocycle: false }
  }
  if (completedPhase === "leader2") {
    return { nextPhase: "anchor", newMacrocycle: false }
  }
  return { nextPhase: "leader1", newMacrocycle: true }
}

// Get user's active program
export const getActiveProgram = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()
  },
})

// Get user's calibrating program
export const getCalibratingProgram = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "calibrating"))
      .first()
  },
})

// Get any program (active, calibrating, or paused)
export const getCurrentProgram = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    // First check for active
    const active = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()
    if (active) return active

    // Then check for paused (user paused the program — show resume UI)
    const paused = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "paused"))
      .first()
    if (paused) return paused

    // Then check for calibrating
    const calibrating = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "calibrating"))
      .first()
    return calibrating
  },
})

// Start calibration (create new program in calibrating state)
export const startCalibration = mutation({
  args: {
    // Optional: pre-select template during calibration
    supplementalTemplate: v.optional(v.union(
      v.literal("bbb"),
      v.literal("fsl"),
      v.literal("ssl"),
      v.literal("bbs")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Check if user already has a program
    const existing = await ctx.db
      .query("programs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
    
    if (existing) {
      // If there's an existing program, delete it and start fresh
      await ctx.db.delete(existing._id)
      console.log("[programs] Deleted existing program for user:", userId)
    }

    const now = new Date().toISOString()
    const programId = await ctx.db.insert("programs", {
      userId,
      template: "531_bbb",  // Legacy field, kept for compatibility
      status: "calibrating",
      cycle: 1,
      week: 1,
      dayIndex: 0,
      split: ["squat", "bench", "deadlift", "press"],
      trainingMaxes: {
        squat: undefined,
        bench: undefined,
        deadlift: undefined,
        press: undefined,
      },
      increments: {
        squat: 5,
        bench: 2.5,
        deadlift: 5,
        press: 2.5,
      },
      rounding: 2.5,
      // Consecutive miss counter per lift (for inter-cycle progression)
      misses: {
        squat: 0,
        bench: 0,
        deadlift: 0,
        press: 0,
      },
      // e1RM history from non-autoregulated week-3 top sets
      e1rmHistory: {
        squat: [],
        bench: [],
        deadlift: [],
        press: [],
      },
      calibration: {},
      amrapResults: [],
      // 5/3/1 Forever fields
      programPhase: "leader1",
      supplementalTemplate: args.supplementalTemplate || "bbb",
      macrocycleNumber: 1,
      phaseWeek: 1,
      createdAt: now,
      updatedAt: now,
    })

    console.log("[programs] Started calibration for user:", userId, "programId:", programId, "template:", args.supplementalTemplate || "bbb")
    return programId
  },
})

// Save calibration set for a lift
export const saveCalibrationSet = mutation({
  args: {
    lift: v.union(v.literal("squat"), v.literal("bench"), v.literal("deadlift"), v.literal("press")),
    weight: v.number(),
    reps: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    if (!Number.isFinite(args.weight) || args.weight <= 0 || args.weight >= 1000) {
      throw new Error("Neplatná váha: musí být kladné číslo menší než 1000 kg")
    }
    if (!Number.isInteger(args.reps) || args.reps < 1 || args.reps > 100) {
      throw new Error("Neplatný počet opakování: musí být celé číslo od 1 do 100")
    }

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "calibrating"))
      .first()

    if (!program) throw new Error("No calibrating program found")

    const calibration = program.calibration || {}
    calibration[args.lift] = { weight: args.weight, reps: args.reps }

    await ctx.db.patch(program._id, {
      calibration,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Saved calibration for", args.lift, ":", args.weight, "kg x", args.reps)
    return calibration
  },
})

// Activate program after calibration is complete
// This calculates TMs from calibration sets
export const activateProgram = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "calibrating"))
      .first()

    if (!program) throw new Error("No calibrating program found")

    const cal = program.calibration
    if (!cal?.squat || !cal?.bench || !cal?.deadlift || !cal?.press) {
      throw new Error("All 4 lifts must be calibrated before activation")
    }

    // Calculate TMs using canonical Epley e1RM (from lib/strength-calculations via lib/531):
    //   reps === 1 → e1RM = weight (no extrapolation)
    //   reps > 1  → e1RM = Math.round(weight × (1 + reps/30))
    // TM = 90% of e1RM × 90% (conservative start) = 0.81 × e1RM, rounded to plate
    const calcTM = (set: { weight: number; reps: number }) => {
      const e1rm = estimateE1RM(set.weight, set.reps)
      const tm = e1rm * 0.81 // Conservative: 90% × 90%
      return Math.round(tm / program.rounding) * program.rounding
    }

    const trainingMaxes = {
      squat: calcTM(cal.squat),
      bench: calcTM(cal.bench),
      deadlift: calcTM(cal.deadlift),
      press: calcTM(cal.press),
    }

    await ctx.db.patch(program._id, {
      status: "active",
      trainingMaxes,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Activated program with TMs:", trainingMaxes)
    return trainingMaxes
  },
})

// Advance to next training day
export const advanceDay = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    const { dayIndex: newDayIndex, week: newWeek, cycle: newCycle } = advanceProgramPosition(program)

    await ctx.db.patch(program._id, {
      week: newWeek,
      dayIndex: newDayIndex,
      cycle: newCycle,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Advanced to cycle", newCycle, "week", newWeek, "day", newDayIndex)
    return { cycle: newCycle, week: newWeek, dayIndex: newDayIndex }
  },
})

// Save AMRAP result
export const saveAmrapResult = mutation({
  args: {
    lift: v.string(),
    weight: v.number(),
    targetReps: v.number(),
    actualReps: v.number(),
    autoregulated: v.optional(v.boolean()), // Was this session autoregulated?
    clientId: v.optional(v.string()),        // Idempotenční dedup ID — offline replay posílá stejné ID
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    if (!Number.isFinite(args.weight) || args.weight <= 0 || args.weight >= 1000) {
      throw new Error("Neplatná váha: musí být kladné číslo menší než 1000 kg")
    }
    if (!Number.isInteger(args.targetReps) || args.targetReps < 0 || args.targetReps > 100) {
      throw new Error("Neplatný cílový počet opakování: musí být celé číslo od 0 do 100")
    }
    if (!Number.isInteger(args.actualReps) || args.actualReps < 0 || args.actualReps > 100) {
      throw new Error("Neplatný skutečný počet opakování: musí být celé číslo od 0 do 100")
    }

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    const amrapResults = program.amrapResults || []

    // Idempotenční dedup: pokud clientId přišlo, zkontroluj zda záznam již existuje
    if (args.clientId) {
      const duplicate = amrapResults.find(
        (a: { clientId?: string }) => a.clientId === args.clientId
      )
      if (duplicate) {
        console.log("[programs] saveAmrapResult: duplicate clientId, no-op:", args.clientId)
        return amrapResults
      }
    }

    amrapResults.push({
      cycle: program.cycle,
      week: program.week,
      lift: args.lift,
      weight: args.weight,
      targetReps: args.targetReps,
      actualReps: args.actualReps,
      autoregulated: args.autoregulated || false,
      date: new Date().toISOString().split("T")[0],
      clientId: args.clientId,
    })

    await ctx.db.patch(program._id, {
      amrapResults,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Saved AMRAP:", args.lift, args.weight, "kg x", args.actualReps, "reps", args.autoregulated ? "(autoregulated)" : "", args.clientId ? `(clientId: ${args.clientId})` : "")
    return amrapResults
  },
})

// Get deviation notes from autoregulated sessions in a cycle (for LLM coaching)
export const getCycleDeviationNotes = query({
  args: {
    cycle: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []

    // Cap at 500 to avoid unbounded collect on large histories
    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "completed"))
      .take(500)

    // Filter to autoregulated workouts from the specified cycle
    return workouts
      .filter((w) =>
        w.programCycle === args.cycle &&
        w.autoregulated &&
        w.deviationNote
      )
      .map((w) => ({
        week: w.programWeek,
        lift: w.programLift,
        note: w.deviationNote,
        date: w.date,
      }))
  },
})

// Complete workout and save to history
export const completeWorkout = mutation({
  args: {
    exercises: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        rpe: v.optional(v.number()),
        sets: v.array(
          v.object({
            weight: v.number(),
            reps: v.number(),
            completed: v.boolean(),
          })
        ),
      })
    ),
    note: v.optional(v.string()),
    rating: v.optional(v.number()),
    autoregulated: v.optional(v.boolean()),    // User marked session as autoregulated
    deviationNote: v.optional(v.string()),     // Free text for LLM context only
    // Idempotenční guard — klient posílá pozici, kterou renderoval.
    // Pokud se program mezitím posunul (dvojklik, retry, multi-tab), mutace je no-op.
    expectedCycle: v.number(),
    expectedWeek: v.number(),
    expectedDayIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    // ── Idempotenční guard ──────────────────────────────────────────────────
    // Pokud se pozice programu neshoduje s tím, co klient renderoval, znamená to
    // že workout byl již uložen (retry, dvojklik, druhá záložka). Vrátíme no-op
    // se stejným tvarem výsledku, aby retry nevyhodil chybu uživateli.
    if (
      program.cycle !== args.expectedCycle ||
      program.week !== args.expectedWeek ||
      program.dayIndex !== args.expectedDayIndex
    ) {
      console.log(
        "[programs] completeWorkout: pozice programu se neshoduje — no-op",
        { expected: { cycle: args.expectedCycle, week: args.expectedWeek, dayIndex: args.expectedDayIndex },
          actual: { cycle: program.cycle, week: program.week, dayIndex: program.dayIndex } }
      )
      return {
        alreadyCompleted: true,
        workoutId: null,
        cycle: program.cycle,
        week: program.week,
        dayIndex: program.dayIndex,
        progressionSummary: null,
      }
    }

    // Determine if this is a Forever program (has phase + supplemental template)
    const isForeverProgram = !!(program.programPhase && program.supplementalTemplate)

    // Build workout note — Forever programs include phase name
    const today = new Date().toISOString().split("T")[0]
    const lift = program.split[program.dayIndex]
    let workoutNote = args.note
    if (!workoutNote) {
      if (isForeverProgram) {
        const phase = program.programPhase as ProgramPhase
        const phaseName: Record<ProgramPhase, string> = {
          leader1: "Leader 1",
          leader2: "Leader 2",
          anchor: "Anchor",
          seventh_week: "7. týden",
        }
        workoutNote = `${phaseName[phase]} — Cyklus ${program.cycle}, Týden ${program.week} — ${lift}`
      } else {
        workoutNote = `5/3/1 Cyklus ${program.cycle}, Týden ${program.week} — ${lift}`
      }
    }

    const workoutId = await ctx.db.insert("workouts", {
      userId,
      date: today,
      status: "completed",
      note: workoutNote,
      rating: args.rating,
      exercises: args.exercises,
      // 5/3/1 program tracking
      programCycle: program.cycle,
      programWeek: program.week,
      programLift: lift,
      autoregulated: args.autoregulated || false,
      deviationNote: args.deviationNote,
    })

    console.log("[programs] Saved workout to history:", workoutId, args.autoregulated ? "(autoregulated)" : "")

    // Advance to next day using shared helper (3-week Forever cycle)
    const { dayIndex: newDayIndex, week: newWeek, cycle: newCycle } = advanceProgramPosition(program)

    if (isForeverProgram) {
      // Forever programs: advance phase state in addition to day/week/cycle
      const phase = (program.programPhase || "leader1") as ProgramPhase
      const phaseWeek = program.phaseWeek || 1
      const macrocycleNumber = program.macrocycleNumber || 1

      let newPhaseWeek = phaseWeek
      let newPhase = phase
      let newMacrocycleNumber = macrocycleNumber
      let phaseComplete = false
      let needsSeventhWeek = false

      // Phase-week advancement only happens when a full training week is completed
      if (newDayIndex === 0) {
        if (phase === "seventh_week") {
          // 7th week is exactly 1 week — always complete after one full week
          phaseComplete = true
        } else {
          // Advance phase week counter
          newPhaseWeek = phaseWeek + 1

          // Check if phase is complete (exceeded its week limit)
          const phaseWeekLimit = PHASE_WEEKS[phase]
          if (newPhaseWeek > phaseWeekLimit) {
            phaseComplete = true
            needsSeventhWeek = true
          }
        }
      }

      // Track which phase we came from when entering the 7th week — needed to
      // resolve the next phase correctly when leaving it.
      let newPhaseBeforeSeventhWeek = program.phaseBeforeSeventhWeek as
        | "leader1"
        | "leader2"
        | "anchor"
        | undefined

      // Handle phase transition
      if (phaseComplete) {
        if (phase === "seventh_week") {
          // Determine the next phase from the phase that preceded this 7th week.
          // (macrocycleNumber is constant across a whole macrocycle, so it cannot
          // tell leader1's 7th week apart from leader2's — we read the stored phase.)
          const completedPhase = newPhaseBeforeSeventhWeek ?? null
          const nextResult = getNextPhaseAfterSeventh(completedPhase)

          newPhase = nextResult.nextPhase
          newPhaseWeek = 1
          if (nextResult.newMacrocycle) {
            newMacrocycleNumber = macrocycleNumber + 1
          }
          // Cleared on exit (see updateData below)
          newPhaseBeforeSeventhWeek = undefined
        } else if (needsSeventhWeek) {
          // Transition to 7th week protocol — remember the phase we came from
          newPhaseBeforeSeventhWeek = phase as "leader1" | "leader2" | "anchor"
          newPhase = "seventh_week"
          newPhaseWeek = 1
        }
      }

      // -----------------------------------------------------------------------
      // SERVER-SIDE TM PROGRESSION (single source of truth — doménové rozhodnutí)
      //
      // TM se zvyšuje po každém dokončeném 3týdenním cyklu v leader/anchor fázi,
      // VÝHRADNĚ zde (nikdy na klientovi, nikdy přes applyTMAdjustments).
      // 7th week TM NIKDY nezvyšuje — je to jen kontrolní bod nebo deload.
      // -----------------------------------------------------------------------
      let progressionSummary: CycleProgressionSummary | null = null

      // Cyklus je dokončen právě tehdy, když newCycle > program.cycle
      // (tj. week 3 day 3 → přeskočilo na nový cyklus). Zároveň nesmí jít o seventh_week.
      const cycleJustCompleted = newCycle > program.cycle
      const isRegularPhase =
        phase !== "seventh_week" &&
        (phase === "leader1" || phase === "leader2" || phase === "anchor")

      // Build update — reset seventhWeekType when leaving 7th week so user picks again next time
      const updateData: Record<string, unknown> = {
        week: newWeek,
        dayIndex: newDayIndex,
        cycle: newCycle,
        programPhase: newPhase,
        phaseWeek: newPhaseWeek,
        macrocycleNumber: newMacrocycleNumber,
        phaseBeforeSeventhWeek: newPhaseBeforeSeventhWeek,
        updatedAt: new Date().toISOString(),
      }

      if (phase === "seventh_week" && phaseComplete) {
        updateData.seventhWeekType = undefined
      }

      if (cycleJustCompleted && isRegularPhase) {
        // Sbírej AMRAP výsledky pro právě dokončený cyklus
        const cycleAmraps = (program.amrapResults || []).filter(
          (a: { cycle: number }) => a.cycle === program.cycle
        )

        const progressionState: ProgressionState = {
          trainingMaxes: {
            squat: (program.trainingMaxes.squat as number) || 0,
            bench: (program.trainingMaxes.bench as number) || 0,
            deadlift: (program.trainingMaxes.deadlift as number) || 0,
            press: (program.trainingMaxes.press as number) || 0,
          },
          increments: program.increments as Record<Lift, number>,
          misses: (program.misses as Record<Lift, number>) || {
            squat: 0, bench: 0, deadlift: 0, press: 0,
          },
          e1rmHistory: (program.e1rmHistory as Record<Lift, number[]>) || {
            squat: [], bench: [], deadlift: [], press: [],
          },
          rounding: program.rounding,
        }

        progressionSummary = applyCycleProgression(
          progressionState,
          cycleAmraps as Array<{
            lift: string; weight: number; targetReps: number
            actualReps: number; week: number; autoregulated?: boolean
          }>,
          program.cycle
        )

        // Přidej TM a stav do updateData — aktualizuje se atomicky s posunem pozice
        updateData.trainingMaxes = progressionSummary.newTrainingMaxes
        updateData.misses = progressionSummary.updatedMisses
        updateData.e1rmHistory = progressionSummary.updatedE1rmHistory

        console.log("[programs] TM progrese po cyklu", program.cycle, ":", {
          lifts: progressionSummary.lifts.map((l) => `${l.lift}: ${l.oldTM}→${l.newTM} (${l.action})`),
        })
      }

      await ctx.db.patch(program._id, updateData)

      console.log("[programs] Advanced Forever to:", {
        phase: newPhase,
        phaseWeek: newPhaseWeek,
        cycle: newCycle,
        week: newWeek,
        day: newDayIndex,
        macrocycle: newMacrocycleNumber,
      })

      return {
        workoutId,
        cycle: newCycle,
        week: newWeek,
        dayIndex: newDayIndex,
        phase: newPhase,
        phaseWeek: newPhaseWeek,
        phaseComplete,
        needsSeventhWeek,
        progressionSummary,
      }
    }

    // Legacy (non-Forever) program: update only day/week/cycle
    await ctx.db.patch(program._id, {
      week: newWeek,
      dayIndex: newDayIndex,
      cycle: newCycle,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Advanced to cycle", newCycle, "week", newWeek, "day", newDayIndex)
    return { workoutId, cycle: newCycle, week: newWeek, dayIndex: newDayIndex }
  },
})

// Reset/delete program
export const deleteProgram = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const programs = await ctx.db
      .query("programs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()

    for (const program of programs) {
      await ctx.db.delete(program._id)
    }

    console.log("[programs] Deleted all programs for user:", userId)
    return { deleted: programs.length }
  },
})

// ============================================================================
// 5/3/1 FOREVER FUNCTIONS
// ============================================================================

// Set supplemental template (can be changed during calibration or between phases)
export const setSupplementalTemplate = mutation({
  args: {
    template: v.union(
      v.literal("bbb"),
      v.literal("fsl"),
      v.literal("ssl"),
      v.literal("bbs")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    if (!program) throw new Error("No program found")

    await ctx.db.patch(program._id, {
      supplementalTemplate: args.template,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Set supplemental template to:", args.template)
    return args.template
  },
})

// Set 7th week protocol type
export const setSeventhWeekType = mutation({
  args: {
    type: v.union(v.literal("tm_test"), v.literal("deload")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    await ctx.db.patch(program._id, {
      seventhWeekType: args.type,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Set 7th week type to:", args.type)
    return args.type
  },
})

// Get current Forever program state with computed fields
export const getForeverState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) return null

    // Return enhanced state with Forever fields
    const phase = (program.programPhase || "leader1") as ProgramPhase
    const phaseWeekLimit = PHASE_WEEKS[phase]
    const currentPhaseWeek = program.phaseWeek || 1

    return {
      ...program,
      // Forever computed fields
      phase,
      phaseWeek: currentPhaseWeek,
      phaseWeekLimit,
      phaseProgress: currentPhaseWeek / phaseWeekLimit,
      supplementalTemplate: program.supplementalTemplate || "bbb",
      macrocycleNumber: program.macrocycleNumber || 1,
      isSeventhWeek: phase === "seventh_week",
      seventhWeekType: program.seventhWeekType || "deload",
    }
  },
})

// Manually trigger phase transition (for testing or corrections)
export const setPhase = mutation({
  args: {
    phase: v.union(
      v.literal("leader1"),
      v.literal("leader2"),
      v.literal("anchor"),
      v.literal("seventh_week")
    ),
    phaseWeek: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace phaseWeek
    const phaseWeek = args.phaseWeek ?? 1
    if (!Number.isInteger(phaseWeek) || phaseWeek < 1 || phaseWeek > 6) {
      throw new Error("Neplatný týden fáze: musí být celé číslo od 1 do 6")
    }

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    await ctx.db.patch(program._id, {
      programPhase: args.phase,
      phaseWeek,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] Manually set phase to:", args.phase, "week:", phaseWeek)
    return { phase: args.phase, phaseWeek }
  },
})

// ============================================================================
// PROGRAM MANAGEMENT
// ============================================================================

// Manuální úprava Training Maxu jednoho liftu
export const setTrainingMax = mutation({
  args: {
    lift: v.union(v.literal("squat"), v.literal("bench"), v.literal("deadlift"), v.literal("press")),
    newTM: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace hodnoty TM
    if (!Number.isFinite(args.newTM) || args.newTM < 20 || args.newTM > 1000) {
      throw new Error("Neplatný Training Max: musí být konečné číslo v rozsahu 20–1000 kg")
    }

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("Nenalezen aktivní program")

    // Ověř, že lift je součástí splitu programu
    if (!program.split.includes(args.lift)) {
      throw new Error(`Lift "${args.lift}" není součástí splitu tohoto programu`)
    }

    // Zaokrouhli na 2.5 kg
    const rounded = roundToPlate(args.newTM, program.rounding)

    // Aktualizuj TM a vynuluj misses pro daný lift (vědomý zásah = nový start)
    const newTrainingMaxes = { ...program.trainingMaxes, [args.lift]: rounded }
    const newMisses = { ...(program.misses ?? { squat: 0, bench: 0, deadlift: 0, press: 0 }), [args.lift]: 0 }

    await ctx.db.patch(program._id, {
      trainingMaxes: newTrainingMaxes,
      misses: newMisses,
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] setTrainingMax:", args.lift, "→", rounded, "kg (původní:", program.trainingMaxes[args.lift], ")")
    return { lift: args.lift, newTM: rounded }
  },
})

// Pozastavení aktivního programu
export const pauseProgram = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("Nenalezen aktivní program")

    await ctx.db.patch(program._id, {
      status: "paused",
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] pauseProgram: program pozastaven")
    return { status: "paused" }
  },
})

// Obnovení pozastaveného programu
export const resumeProgram = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "paused"))
      .first()

    if (!program) throw new Error("Nenalezen pozastavený program")

    await ctx.db.patch(program._id, {
      status: "active",
      updatedAt: new Date().toISOString(),
    })

    console.log("[programs] resumeProgram: program obnoven")
    return { status: "active" }
  },
})

// Získání pozastaveného programu (pro zobrazení v UI)
export const getPausedProgram = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    return await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "paused"))
      .first()
  },
})

// Upgrade existing legacy program to Forever system
// Preserves TMs, e1rmHistory, amrapResults - just adds Forever fields
export const upgradeToForever = mutation({
  args: {
    supplementalTemplate: v.union(
      v.literal("bbb"),
      v.literal("fsl"),
      v.literal("ssl"),
      v.literal("bbs")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const program = await ctx.db
      .query("programs")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first()

    if (!program) throw new Error("No active program found")

    // Check if already Forever
    if (program.programPhase && program.supplementalTemplate) {
      throw new Error("Program is already using Forever system")
    }

    // Determine starting phase based on current cycle
    // If cycle >= 3, start at leader2 (they've been training a while)
    // Otherwise start at leader1
    const startingPhase: ProgramPhase = program.cycle >= 3 ? "leader2" : "leader1"
    
    // Convert week 4 (deload) to week 1 of next cycle if needed
    let newWeek = program.week
    let newCycle = program.cycle
    if (program.week === 4) {
      newWeek = 1
      newCycle = program.cycle + 1
    }

    await ctx.db.patch(program._id, {
      programPhase: startingPhase,
      supplementalTemplate: args.supplementalTemplate,
      macrocycleNumber: 1,
      phaseWeek: newWeek, // Start at current week position
      week: newWeek,
      cycle: newCycle,
      seventhWeekType: undefined, // Clear any leftover
      updatedAt: new Date().toISOString(),
    })

    console.log(
      "[programs] Upgraded to Forever:",
      "template:", args.supplementalTemplate,
      "phase:", startingPhase,
      "phaseWeek:", newWeek,
      "preserved TMs:", program.trainingMaxes
    )
    
    return {
      phase: startingPhase,
      template: args.supplementalTemplate,
      preserved: {
        trainingMaxes: program.trainingMaxes,
        e1rmHistory: !!program.e1rmHistory,
        amrapResults: program.amrapResults?.length || 0,
      }
    }
  },
})
