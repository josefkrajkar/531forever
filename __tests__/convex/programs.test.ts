/**
 * Tests for Convex programs module
 * 
 * Covers:
 * - Calibration flow (start → save → activate)
 * - Program advancement
 * - AMRAP result saving
 * - TM adjustments with progression state
 * - Workout completion
 * - Program deletion
 * - Authentication requirements
 */

import { convexTest } from "convex-test"
import { describe, it, expect } from "vitest"
import schema from "../../convex/schema"
import { api } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"

function makeT() {
  // @ts-expect-error import.meta.glob is Vite-specific
  return convexTest(schema, import.meta.glob("../../convex/**/*.*s"))
}

// Seed a user for testing
async function seedUser(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    })
  })
}

// Seed a calibrating program
async function seedCalibratingProgram(t: ReturnType<typeof makeT>, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const now = new Date().toISOString()
    return await ctx.db.insert("programs", {
      userId,
      template: "531_bbb",
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
      increments: { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 },
      rounding: 2.5,
      misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
      e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
      calibration: {},
      amrapResults: [],
      createdAt: now,
      updatedAt: now,
    })
  })
}

// Seed an active program with full calibration
async function seedActiveProgram(t: ReturnType<typeof makeT>, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const now = new Date().toISOString()
    return await ctx.db.insert("programs", {
      userId,
      template: "531_bbb",
      status: "active",
      cycle: 1,
      week: 1,
      dayIndex: 0,
      split: ["squat", "bench", "deadlift", "press"],
      trainingMaxes: {
        squat: 100,
        bench: 80,
        deadlift: 120,
        press: 50,
      },
      increments: { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 },
      rounding: 2.5,
      misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
      e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
      calibration: {
        squat: { weight: 100, reps: 5 },
        bench: { weight: 80, reps: 5 },
        deadlift: { weight: 120, reps: 5 },
        press: { weight: 50, reps: 5 },
      },
      amrapResults: [],
      createdAt: now,
      updatedAt: now,
    })
  })
}

// Seed an active Forever program with given phase state
async function seedForeverProgram(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  overrides: {
    programPhase?: "leader1" | "leader2" | "anchor" | "seventh_week"
    phaseWeek?: number
    macrocycleNumber?: number
    cycle?: number
    week?: number
    dayIndex?: number
    seventhWeekType?: "tm_test" | "deload"
    phaseBeforeSeventhWeek?: "leader1" | "leader2" | "anchor"
  } = {}
) {
  return await t.run(async (ctx) => {
    const now = new Date().toISOString()
    return await ctx.db.insert("programs", {
      userId,
      template: "531_bbb",
      status: "active",
      cycle: overrides.cycle ?? 1,
      week: overrides.week ?? 1,
      dayIndex: overrides.dayIndex ?? 0,
      split: ["squat", "bench", "deadlift", "press"],
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
      increments: { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 },
      rounding: 2.5,
      misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
      e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
      calibration: {
        squat: { weight: 100, reps: 5 },
        bench: { weight: 80, reps: 5 },
        deadlift: { weight: 120, reps: 5 },
        press: { weight: 50, reps: 5 },
      },
      amrapResults: [],
      // Forever fields
      programPhase: overrides.programPhase ?? "leader1",
      supplementalTemplate: "bbb",
      macrocycleNumber: overrides.macrocycleNumber ?? 1,
      phaseWeek: overrides.phaseWeek ?? 1,
      seventhWeekType: overrides.seventhWeekType,
      phaseBeforeSeventhWeek: overrides.phaseBeforeSeventhWeek,
      createdAt: now,
      updatedAt: now,
    })
  })
}

// Helper: run completeWorkout with minimal args
// position musí odpovídat aktuální pozici programu (idempotenční guard)
async function doCompleteWorkout(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  position: { expectedCycle: number; expectedWeek: number; expectedDayIndex: number } = {
    expectedCycle: 1,
    expectedWeek: 1,
    expectedDayIndex: 0,
  }
) {
  return await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
    exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 85, reps: 5, completed: true }] }],
    ...position,
  })
}


// ============================================================================
// QUERIES
// ============================================================================

describe("programs.getActiveProgram", () => {
  it("returns null when not authenticated", async () => {
    const t = makeT()
    const result = await t.query(api.programs.getActiveProgram, {})
    expect(result).toBeNull()
  })

  it("returns null when user has no program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getActiveProgram, {})
    
    expect(result).toBeNull()
  })

  it("returns active program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getActiveProgram, {})
    
    expect(result).not.toBeNull()
    expect(result!.status).toBe("active")
    expect(result!.trainingMaxes.squat).toBe(100)
  })

  it("ignores calibrating programs", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedCalibratingProgram(t, userId)
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getActiveProgram, {})
    
    expect(result).toBeNull()
  })
})

describe("programs.getCalibratingProgram", () => {
  it("returns calibrating program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedCalibratingProgram(t, userId)
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getCalibratingProgram, {})
    
    expect(result).not.toBeNull()
    expect(result!.status).toBe("calibrating")
  })
})

describe("programs.getCurrentProgram", () => {
  it("prefers active over calibrating", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedCalibratingProgram(t, userId)
    await seedActiveProgram(t, userId)
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getCurrentProgram, {})
    
    expect(result).not.toBeNull()
    expect(result!.status).toBe("active")
  })

  it("falls back to calibrating if no active", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedCalibratingProgram(t, userId)
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getCurrentProgram, {})
    
    expect(result).not.toBeNull()
    expect(result!.status).toBe("calibrating")
  })
})


// ============================================================================
// CALIBRATION FLOW
// ============================================================================

describe("programs.startCalibration", () => {
  it("throws when not authenticated", async () => {
    const t = makeT()
    await expect(
      t.mutation(api.programs.startCalibration, {})
    ).rejects.toThrow("Not authenticated")
  })

  it("creates a new calibrating program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    
    const programId = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.startCalibration, {})
    
    expect(programId).toBeDefined()
    
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program).toMatchObject({
      status: "calibrating",
      cycle: 1,
      week: 1,
      dayIndex: 0,
      misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
      e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
    })
  })

  it("deletes existing program and creates fresh one", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const oldProgramId = await seedActiveProgram(t, userId)
    
    const newProgramId = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.startCalibration, {})
    
    // Old program should be deleted
    const oldProgram = await t.run(async (ctx) => ctx.db.get(oldProgramId))
    expect(oldProgram).toBeNull()
    
    // New program should exist
    const newProgram = await t.run(async (ctx) => ctx.db.get(newProgramId))
    expect(newProgram).not.toBeNull()
    expect(newProgram!.status).toBe("calibrating")
  })
})

describe("programs.saveCalibrationSet", () => {
  it("throws when not authenticated", async () => {
    const t = makeT()
    await expect(
      t.mutation(api.programs.saveCalibrationSet, {
        lift: "squat",
        weight: 100,
        reps: 5,
      })
    ).rejects.toThrow("Not authenticated")
  })

  it("throws when no calibrating program exists", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    
    await expect(
      t.withIdentity({ subject: userId })
        .mutation(api.programs.saveCalibrationSet, {
          lift: "squat",
          weight: 100,
          reps: 5,
        })
    ).rejects.toThrow("No calibrating program found")
  })

  it("saves calibration set for a lift", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedCalibratingProgram(t, userId)
    
    await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.saveCalibrationSet, {
        lift: "squat",
        weight: 100,
        reps: 5,
      })
    
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.calibration).toMatchObject({
      squat: { weight: 100, reps: 5 },
    })
  })

  it("saves multiple lifts", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedCalibratingProgram(t, userId)
    
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "squat", weight: 100, reps: 5 })
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "bench", weight: 80, reps: 3 })
    
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.calibration).toMatchObject({
      squat: { weight: 100, reps: 5 },
      bench: { weight: 80, reps: 3 },
    })
  })
})

describe("programs.activateProgram", () => {
  it("throws when not all lifts calibrated", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedCalibratingProgram(t, userId)
    
    // Only calibrate squat
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "squat", weight: 100, reps: 5 })
    
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.activateProgram, {})
    ).rejects.toThrow("All 4 lifts must be calibrated")
  })

  it("activates program with calculated TMs", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedCalibratingProgram(t, userId)
    
    // Calibrate all lifts
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "squat", weight: 100, reps: 5 })
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "bench", weight: 80, reps: 5 })
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "deadlift", weight: 120, reps: 5 })
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveCalibrationSet, { lift: "press", weight: 50, reps: 5 })
    
    const tms = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.activateProgram, {})
    
    expect(tms).toBeDefined()
    expect(tms.squat).toBeGreaterThan(0)
    expect(tms.bench).toBeGreaterThan(0)
    
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.status).toBe("active")
  })
})


// ============================================================================
// PROGRAM ADVANCEMENT
// ============================================================================

describe("programs.advanceDay", () => {
  it("advances day index within week", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId) // dayIndex: 0
    
    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.advanceDay, {})
    
    expect(result).toMatchObject({ cycle: 1, week: 1, dayIndex: 1 })
  })

  it("advances to next week after 4 days", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)
    
    // Set to last day of week
    await t.run(async (ctx) => ctx.db.patch(programId, { dayIndex: 3 }))
    
    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.advanceDay, {})
    
    expect(result).toMatchObject({ cycle: 1, week: 2, dayIndex: 0 })
  })

  it("advances to new cycle after week 3 (3týdenní Forever cyklus)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    // Set to last day of week 3 (poslední týden cyklu — žádný week 4 deload)
    await t.run(async (ctx) => ctx.db.patch(programId, { week: 3, dayIndex: 3 }))

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.advanceDay, {})

    expect(result).toMatchObject({ cycle: 2, week: 1, dayIndex: 0 })
  })
})


// ============================================================================
// AMRAP & WORKOUT TRACKING
// ============================================================================

describe("programs.saveAmrapResult", () => {
  it("saves AMRAP result to program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)
    
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "squat",
      weight: 95,
      targetReps: 5,
      actualReps: 8,
    })
    
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.amrapResults).toHaveLength(1)
    expect(program!.amrapResults![0]).toMatchObject({
      lift: "squat",
      weight: 95,
      actualReps: 8,
      autoregulated: false,
    })
  })

  it("saves autoregulated flag", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)
    
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "squat",
      weight: 95,
      targetReps: 5,
      actualReps: 3,
      autoregulated: true,
    })
    
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.amrapResults![0].autoregulated).toBe(true)
  })
})

describe("programs.completeWorkout", () => {
  it("saves workout to history with program metadata", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [
        {
          id: "ex1",
          name: "Squat",
          sets: [{ weight: 85, reps: 5, completed: true }],
        },
      ],
      note: "Test workout",
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })

    expect(result.workoutId).toBeDefined()

    const workout = await t.run(async (ctx) => ctx.db.get(result.workoutId!))
    expect(workout).toMatchObject({
      status: "completed",
      programCycle: 1,
      programWeek: 1,
      programLift: "squat",
      autoregulated: false,
    })
  })

  it("saves autoregulated flag and deviation note", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 85, reps: 5, completed: true }] }],
      autoregulated: true,
      deviationNote: "Bolest zad, snížil jsem váhu",
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })

    const workout = await t.run(async (ctx) => ctx.db.get(result.workoutId!))
    expect(workout!.autoregulated).toBe(true)
    expect(workout!.deviationNote).toBe("Bolest zad, snížil jsem váhu")
  })

  it("advances program after workout", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [] }],
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })

    expect(result.dayIndex).toBe(1)

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.dayIndex).toBe(1)
  })

  // ── Idempotenční guard ───────────────────────────────────────────────────
  it("druhé volání se stejnou pozicí je no-op — nevytvoří druhý workout", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    // První volání — standardní dokončení (cycle=1, week=1, dayIndex=0)
    const r1 = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 85, reps: 5, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })
    expect(r1.alreadyCompleted).toBeUndefined() // první volání = skutečné dokončení
    expect(r1.workoutId).toBeDefined()

    // Druhé volání se stejnou (původní) pozicí — program se ale posunul → no-op
    const r2 = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 85, reps: 5, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })
    expect(r2.alreadyCompleted).toBe(true)
    expect(r2.workoutId).toBeNull()

    // V historii existuje jen jeden workout
    const workouts = await t.run(async (ctx) =>
      ctx.db.query("workouts").withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "completed")).collect()
    )
    expect(workouts).toHaveLength(1)
  })

  it("no-op neposune program — pozice zůstane po prvním dokončení", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    // První volání posune dayIndex 0 → 1
    await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [] }],
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })

    // Retry se stejnou starou pozicí → no-op
    const r2 = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [] }],
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })
    expect(r2.alreadyCompleted).toBe(true)

    // Pozice programu zůstala na dayIndex=1 (ne 2)
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.dayIndex).toBe(1)
  })

  it("no-op neaplikuje TM progresi podruhé — TM se změní jen jednou", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgramWithAmraps(t, userId, {
      programPhase: "leader1",
      phaseWeek: 3,
      cycle: 1,
      week: 3,
      dayIndex: 3,
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
      amrapResults: [
        { cycle: 1, week: 3, lift: "squat", weight: 95, targetReps: 1, actualReps: 5, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "bench", weight: 75, targetReps: 1, actualReps: 4, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "deadlift", weight: 115, targetReps: 1, actualReps: 3, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "press", weight: 47.5, targetReps: 1, actualReps: 2, date: "2024-01-01" },
      ],
    })

    // První volání — TM se zvýší
    const r1 = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Press", sets: [] }],
      expectedCycle: 1,
      expectedWeek: 3,
      expectedDayIndex: 3,
    })
    expect((r1 as { progressionSummary?: unknown }).progressionSummary).not.toBeNull()
    const programAfter1 = await t.run(async (ctx) => ctx.db.get(programId))
    const tmAfter1 = (programAfter1!.trainingMaxes.squat as number)
    expect(tmAfter1).toBeGreaterThan(100)

    // Druhé volání se starou pozicí → no-op, TM se nezmění
    const r2 = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Press", sets: [] }],
      expectedCycle: 1,
      expectedWeek: 3,
      expectedDayIndex: 3,
    })
    expect(r2.alreadyCompleted).toBe(true)

    const programAfter2 = await t.run(async (ctx) => ctx.db.get(programId))
    expect((programAfter2!.trainingMaxes.squat as number)).toBe(tmAfter1) // TM nezměněno
  })
})


// ============================================================================
// TM ADJUSTMENTS
// ============================================================================

// applyTMAdjustments byla odstraněna — TM progrese nyní probíhá server-side
// uvnitř completeWorkout (atomicky se posunem pozice). Testy jsou níže v sekci
// "SERVER-SIDE TM PROGRESSION".

// ============================================================================
// SERVER-SIDE TM PROGRESSION
// ============================================================================

// Seed Forever program + AMRAP results for cycle N
async function seedForeverProgramWithAmraps(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  overrides: {
    programPhase?: "leader1" | "leader2" | "anchor" | "seventh_week"
    phaseWeek?: number
    cycle?: number
    week?: number
    dayIndex?: number
    trainingMaxes?: { squat: number; bench: number; deadlift: number; press: number }
    misses?: { squat: number; bench: number; deadlift: number; press: number }
    amrapResults?: Array<{
      cycle: number; week: number; lift: string
      weight: number; targetReps: number; actualReps: number
      autoregulated?: boolean; date: string
    }>
  } = {}
) {
  return await t.run(async (ctx) => {
    const now = new Date().toISOString()
    return await ctx.db.insert("programs", {
      userId,
      template: "531_bbb",
      status: "active",
      cycle: overrides.cycle ?? 1,
      week: overrides.week ?? 3,
      dayIndex: overrides.dayIndex ?? 3,
      split: ["squat", "bench", "deadlift", "press"],
      trainingMaxes: overrides.trainingMaxes ?? { squat: 100, bench: 80, deadlift: 120, press: 50 },
      increments: { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 },
      rounding: 2.5,
      misses: overrides.misses ?? { squat: 0, bench: 0, deadlift: 0, press: 0 },
      e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
      calibration: {},
      amrapResults: overrides.amrapResults ?? [],
      programPhase: overrides.programPhase ?? "leader1",
      supplementalTemplate: "bbb",
      macrocycleNumber: 1,
      phaseWeek: overrides.phaseWeek ?? 6,
      createdAt: now,
      updatedAt: now,
    })
  })
}

describe("programs.completeWorkout — server-side TM progrese", () => {
  it("zvyšuje TM po dokončení cyklu se splněnými AMRAP cíli (PROGRESS)", async () => {
    // Pozice: week=3, dayIndex=3 (poslední den cyklu) → po workoutu newCycle = 2
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgramWithAmraps(t, userId, {
      programPhase: "leader1",
      phaseWeek: 3,
      cycle: 1,
      week: 3,
      dayIndex: 3,
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
      amrapResults: [
        { cycle: 1, week: 3, lift: "squat", weight: 95, targetReps: 1, actualReps: 5, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "bench", weight: 75, targetReps: 1, actualReps: 4, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "deadlift", weight: 115, targetReps: 1, actualReps: 3, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "press", weight: 47.5, targetReps: 1, actualReps: 2, date: "2024-01-01" },
      ],
    })

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Press", sets: [{ weight: 47.5, reps: 2, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 3,
      expectedDayIndex: 3,
    })

    // Výsledek musí obsahovat progressionSummary
    const summary = (result as { progressionSummary?: { lifts: Array<{ lift: string; action: string }> } | null }).progressionSummary
    expect(summary).not.toBeNull()
    expect(summary!.lifts).toHaveLength(4)

    // Všechny lifty splnily alespoň 1 rep (week 3 minReps = 1) → PROGRESS
    for (const liftSummary of summary!.lifts) {
      expect(liftSummary.action).toBe("PROGRESS")
    }

    // TM v databázi musí být zvýšeno
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect((program!.trainingMaxes.squat as number)).toBeGreaterThan(100)
    expect((program!.trainingMaxes.bench as number)).toBeGreaterThan(80)
    expect((program!.trainingMaxes.deadlift as number)).toBeGreaterThan(120)
    expect((program!.trainingMaxes.press as number)).toBeGreaterThan(50)
  })

  it("drží TM při missu AMRAP cíle (HOLD) a nastaví misses=1", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgramWithAmraps(t, userId, {
      programPhase: "leader1",
      phaseWeek: 3,
      cycle: 1,
      week: 3,
      dayIndex: 3,
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
      amrapResults: [
        // squat: 0 reps = miss (week 3 minReps = 1)
        { cycle: 1, week: 3, lift: "squat", weight: 95, targetReps: 1, actualReps: 0, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "bench", weight: 75, targetReps: 1, actualReps: 3, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "deadlift", weight: 115, targetReps: 1, actualReps: 2, date: "2024-01-01" },
        { cycle: 1, week: 3, lift: "press", weight: 47.5, targetReps: 1, actualReps: 1, date: "2024-01-01" },
      ],
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Press", sets: [{ weight: 47.5, reps: 1, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 3,
      expectedDayIndex: 3,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // squat HOLD → TM nezměněno
    expect(program!.trainingMaxes.squat).toBe(100)
    // misses.squat = 1
    expect((program!.misses as Record<string, number>).squat).toBe(1)
  })

  it("neaplikuje TM progresi při seventh_week (deload/tm_test)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgramWithAmraps(t, userId, {
      programPhase: "seventh_week",
      phaseWeek: 1,
      cycle: 1,
      week: 3,
      dayIndex: 3,
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
    })
    // Přidej phaseBeforeSeventhWeek přes přímý patch
    await t.run(async (ctx) => ctx.db.patch(programId, { phaseBeforeSeventhWeek: "leader1" }))

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 100, reps: 3, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 3,
      expectedDayIndex: 3,
    })

    // progressionSummary musí být null — seventh_week neprogreduje
    const summary = (result as { progressionSummary?: unknown }).progressionSummary
    expect(summary).toBeNull()

    // TM nezměněno
    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.trainingMaxes.squat).toBe(100)
    expect(program!.trainingMaxes.bench).toBe(80)
  })

  it("neaplikuje TM progresi uprostřed cyklu (ne poslední den week 3)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgramWithAmraps(t, userId, {
      programPhase: "leader1",
      phaseWeek: 2,
      cycle: 1,
      week: 2,  // week 2 — není poslední
      dayIndex: 2, // den 2 — není poslední
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
    })

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Deadlift", sets: [{ weight: 115, reps: 3, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 2,
      expectedDayIndex: 2,
    })

    // Cyklus nebyl dokončen → žádná progrese
    const summary = (result as { progressionSummary?: unknown }).progressionSummary
    expect(summary).toBeNull()

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.trainingMaxes.squat).toBe(100)
  })
})


// ============================================================================
// DEVIATION NOTES QUERY
// ============================================================================

describe("programs.getCycleDeviationNotes", () => {
  it("returns empty array when not authenticated", async () => {
    const t = makeT()
    const result = await t.query(api.programs.getCycleDeviationNotes, { cycle: 1 })
    expect(result).toEqual([])
  })

  it("returns deviation notes from autoregulated workouts", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    
    // Seed some workouts
    await t.run(async (ctx) => {
      // Autoregulated with note
      await ctx.db.insert("workouts", {
        userId,
        date: "2024-01-15",
        status: "completed",
        exercises: [],
        programCycle: 1,
        programWeek: 2,
        programLift: "squat",
        autoregulated: true,
        deviationNote: "Bolest kolene",
      })
      
      // Normal workout (should not appear)
      await ctx.db.insert("workouts", {
        userId,
        date: "2024-01-16",
        status: "completed",
        exercises: [],
        programCycle: 1,
        programWeek: 2,
        programLift: "bench",
        autoregulated: false,
      })
      
      // Different cycle (should not appear)
      await ctx.db.insert("workouts", {
        userId,
        date: "2024-01-20",
        status: "completed",
        exercises: [],
        programCycle: 2,
        programWeek: 1,
        programLift: "squat",
        autoregulated: true,
        deviationNote: "Jiný cyklus",
      })
    })
    
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.programs.getCycleDeviationNotes, { cycle: 1 })
    
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      week: 2,
      lift: "squat",
      note: "Bolest kolene",
    })
  })
})


// ============================================================================
// PROGRAM DELETION
// ============================================================================

describe("programs.deleteProgram", () => {
  it("throws when not authenticated", async () => {
    const t = makeT()
    await expect(
      t.mutation(api.programs.deleteProgram, {})
    ).rejects.toThrow("Not authenticated")
  })

  it("deletes all user programs", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)
    await seedCalibratingProgram(t, userId)

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.deleteProgram, {})

    expect(result.deleted).toBe(2)

    const remaining = await t.run(async (ctx) =>
      ctx.db.query("programs").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    )
    expect(remaining).toHaveLength(0)
  })

  it("returns 0 when no programs exist", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.programs.deleteProgram, {})

    expect(result.deleted).toBe(0)
  })
})


// ============================================================================
// FOREVER PHASE ADVANCEMENT (přes completeWorkout)
// ============================================================================

describe("programs.completeWorkout — Forever: posun phaseWeek v rámci leader fáze", () => {
  it("nezmění phaseWeek pokud nedokončí celý týden (dayIndex se nevrátí na 0)", async () => {
    // Startujeme na dayIndex 0 — po jednom workoutu bude dayIndex 1, ne 0 → phaseWeek zůstane 1
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, { programPhase: "leader1", phaseWeek: 1, dayIndex: 0 })

    await doCompleteWorkout(t, userId)

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.phaseWeek).toBe(1)       // phaseWeek nezměněn
    expect(program!.dayIndex).toBe(1)
    expect(program!.programPhase).toBe("leader1")
  })

  it("inkrementuje phaseWeek po dokončení celého týdne (dayIndex → 0)", async () => {
    // Startujeme na dayIndex 3 (poslední den týdne) — po dokončení se dayIndex otočí na 0
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "leader1",
      phaseWeek: 1,
      dayIndex: 3,
      week: 1,
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 1, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.phaseWeek).toBe(2)         // phaseWeek 1 → 2
    expect(program!.programPhase).toBe("leader1")
    expect(program!.dayIndex).toBe(0)
  })

  it("nezmění fázi ani macrocycle dokud phaseWeek nepřekročí limit leader1 (6 týdnů)", async () => {
    // phaseWeek 5, dayIndex 3 → po workoutu phaseWeek 6, fáze stále leader1
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "leader1",
      phaseWeek: 5,
      dayIndex: 3,
      week: 3,
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 3, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.phaseWeek).toBe(6)
    expect(program!.programPhase).toBe("leader1")
    expect(program!.macrocycleNumber).toBe(1)
  })
})

describe("programs.completeWorkout — Forever: přechod leader1 → seventh_week → leader2", () => {
  it("přechází na seventh_week po dokončení 6. týdne leader1", async () => {
    // phaseWeek 6 (limit leader1 = 6), dayIndex 3 → phaseWeek by bylo 7 > 6 → seventh_week
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "leader1",
      phaseWeek: 6,
      dayIndex: 3,
      week: 3,
    })

    const result = await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 3, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("seventh_week")
    expect(program!.phaseWeek).toBe(1)
    expect(program!.macrocycleNumber).toBe(1)
    // Při vstupu do 7. týdne se zapamatuje fáze, ze které se přišlo
    expect(program!.phaseBeforeSeventhWeek).toBe("leader1")
    // Výsledek z mutace má phaseComplete a needsSeventhWeek
    expect((result as { phaseComplete?: boolean }).phaseComplete).toBe(true)
    expect((result as { needsSeventhWeek?: boolean }).needsSeventhWeek).toBe(true)
  })

  it("přechází na leader2 po dokončení seventh_week, do kterého se vstoupilo z leader1", async () => {
    // seventh_week s phaseBeforeSeventhWeek=leader1 → getNextPhaseAfterSeventh("leader1") → leader2
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "seventh_week",
      phaseBeforeSeventhWeek: "leader1",
      phaseWeek: 1,
      macrocycleNumber: 1,
      dayIndex: 3,
      week: 1,
    })

    const result = await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 1, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("leader2")
    expect(program!.phaseWeek).toBe(1)
    expect(program!.macrocycleNumber).toBe(1)   // newMacrocycle: false pro leader1 → leader2
    expect((result as { phaseComplete?: boolean }).phaseComplete).toBe(true)
    // seventhWeekType i phaseBeforeSeventhWeek se vyčistí po opuštění seventh_week
    expect(program!.seventhWeekType).toBeUndefined()
    expect(program!.phaseBeforeSeventhWeek).toBeUndefined()
  })
})

describe("programs.completeWorkout — Forever: přechod leader2 → seventh_week → anchor", () => {
  it("přechází na seventh_week po dokončení 6. týdne leader2", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "leader2",
      phaseWeek: 6,
      dayIndex: 3,
      week: 3,
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 3, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("seventh_week")
    expect(program!.phaseWeek).toBe(1)
    // Zapamatuje se, že se do 7. týdne přišlo z leader2
    expect(program!.phaseBeforeSeventhWeek).toBe("leader2")
  })

  it("přechází na anchor po dokončení seventh_week, do kterého se vstoupilo z leader2", async () => {
    // seventh_week s phaseBeforeSeventhWeek=leader2 → getNextPhaseAfterSeventh("leader2") → anchor
    // (Dříve zde byl bug: výběr fáze přes macrocycleNumber % 3 vracel leader2 místo anchor.)
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "seventh_week",
      phaseBeforeSeventhWeek: "leader2",
      phaseWeek: 1,
      macrocycleNumber: 1,
      dayIndex: 3,
      week: 1,
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 1, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("anchor")
    expect(program!.phaseWeek).toBe(1)
    expect(program!.macrocycleNumber).toBe(1)   // newMacrocycle: false pro leader2 → anchor
    expect(program!.phaseBeforeSeventhWeek).toBeUndefined()
  })
})

describe("programs.completeWorkout — Forever: anchor → seventh_week → nový macrocyklus", () => {
  it("přechází na seventh_week po dokončení 3. týdne anchor", async () => {
    // anchor limit je 3 týdny
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "anchor",
      phaseWeek: 3,
      macrocycleNumber: 1,
      dayIndex: 3,
      week: 3,
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 3, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("seventh_week")
    expect(program!.phaseWeek).toBe(1)
    expect(program!.macrocycleNumber).toBe(1)
    // Zapamatuje se, že se do 7. týdne přišlo z anchoru
    expect(program!.phaseBeforeSeventhWeek).toBe("anchor")
  })

  it("přechází na leader1 a inkrementuje macrocycleNumber po dokončení seventh_week na konci anchoru", async () => {
    // seventh_week s phaseBeforeSeventhWeek=anchor → getNextPhaseAfterSeventh("anchor") → leader1, newMacrocycle: true
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "seventh_week",
      phaseBeforeSeventhWeek: "anchor",
      phaseWeek: 1,
      macrocycleNumber: 3,
      dayIndex: 3,
      week: 1,
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 1, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("leader1")
    expect(program!.phaseWeek).toBe(1)
    expect(program!.macrocycleNumber).toBe(4)   // 3 + 1
    expect(program!.phaseBeforeSeventhWeek).toBeUndefined()
  })
})

describe("programs.completeWorkout — Forever: seventh_week se resetuje", () => {
  it("resetuje seventhWeekType po opuštění seventh_week", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "seventh_week",
      phaseWeek: 1,
      macrocycleNumber: 1,
      dayIndex: 3,
      week: 1,
      seventhWeekType: "tm_test",
    })

    await doCompleteWorkout(t, userId, { expectedCycle: 1, expectedWeek: 1, expectedDayIndex: 3 })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // Po opuštění seventh_week se seventhWeekType vymaže
    expect(program!.seventhWeekType).toBeUndefined()
  })

  it("nezmění seventh_week dokud není týden dokončen (dayIndex < 3)", async () => {
    // dayIndex 0 → po workoutu dayIndex 1, seventh_week zůstane, phaseWeek nezměněn
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedForeverProgram(t, userId, {
      programPhase: "seventh_week",
      phaseWeek: 1,
      macrocycleNumber: 1,
      dayIndex: 0,
      week: 1,
    })

    await doCompleteWorkout(t, userId)

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.programPhase).toBe("seventh_week")
    expect(program!.phaseWeek).toBe(1)
    expect(program!.dayIndex).toBe(1)
  })
})

describe("programs.completeWorkout — legacy (ne-Forever) program beze změny", () => {
  it("neaktualizuje programPhase/phaseWeek/macrocycleNumber pro legacy program", async () => {
    // Legacy program = nemá programPhase a supplementalTemplate
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    const result = await doCompleteWorkout(t, userId)

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // Legacy program nezískal žádné Forever pole
    expect(program!.programPhase).toBeUndefined()
    expect(program!.phaseWeek).toBeUndefined()
    expect(program!.macrocycleNumber).toBeUndefined()
    // Ale stále správně posunul day/week/cycle
    expect(program!.dayIndex).toBe(1)
    expect(result.cycle).toBe(1)
    expect(result.week).toBe(1)
    expect(result.dayIndex).toBe(1)
  })

  it("nevrací Forever pole (phase, phaseWeek, phaseComplete) pro legacy program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const result = await doCompleteWorkout(t, userId)

    // Legacy výsledek nemá Forever pole
    expect((result as { phase?: unknown }).phase).toBeUndefined()
    expect((result as { phaseWeek?: unknown }).phaseWeek).toBeUndefined()
    expect((result as { phaseComplete?: unknown }).phaseComplete).toBeUndefined()
    // Ale má workoutId, cycle, week, dayIndex
    expect(result.workoutId).toBeDefined()
    expect(result.dayIndex).toBe(1)
  })

  it("správně použije legacy workout note bez phase prefixu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const result = await doCompleteWorkout(t, userId)

    const workout = await t.run(async (ctx) => ctx.db.get(result.workoutId!))
    // Legacy note format: "5/3/1 Cyklus X, Týden Y — lift"
    expect((workout as { note?: string })!.note).toMatch(/^5\/3\/1 Cyklus/)
    expect((workout as { note?: string })!.note).not.toMatch(/Leader|Anchor|7\. týden/)
  })

  it("Forever program použije phase note místo legacy note", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedForeverProgram(t, userId, { programPhase: "leader1" })

    const result = await doCompleteWorkout(t, userId)

    const workout = await t.run(async (ctx) => ctx.db.get(result.workoutId!))
    // Forever note format: "Leader 1 — Cyklus X, Týden Y — lift"
    expect((workout as { note?: string })!.note).toMatch(/^Leader 1/)
    expect((workout as { note?: string })!.note).not.toMatch(/^5\/3\/1 Cyklus/)
  })
})


// ============================================================================
// F4.1 — saveAmrapResult idempotence (clientId dedup)
// ============================================================================

describe("programs.saveAmrapResult — idempotence (F4.1)", () => {
  it("stejný clientId → pouze 1 záznam v amrapResults (no-op při replay)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    const clientId = "test-client-id-abc123"

    // První volání
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "squat",
      weight: 95,
      targetReps: 5,
      actualReps: 8,
      clientId,
    })

    // Druhé volání se stejným clientId (replay)
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "squat",
      weight: 95,
      targetReps: 5,
      actualReps: 8,
      clientId,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // Musí být jen 1 záznam, ne 2
    expect(program!.amrapResults).toHaveLength(1)
    expect(program!.amrapResults![0].clientId).toBe(clientId)
  })

  it("různé clientId → 2 záznamy v amrapResults", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "bench",
      weight: 80,
      targetReps: 3,
      actualReps: 5,
      clientId: "client-id-1",
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "bench",
      weight: 80,
      targetReps: 3,
      actualReps: 7,
      clientId: "client-id-2",
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.amrapResults).toHaveLength(2)
    expect(program!.amrapResults![0].clientId).toBe("client-id-1")
    expect(program!.amrapResults![1].clientId).toBe("client-id-2")
  })

  it("bez clientId (starý klient) → funguje jako dosud, ukládá vždy", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)

    // Dvě volání bez clientId — bez dedup logiky se obě uloží (starý klient)
    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "deadlift",
      weight: 120,
      targetReps: 1,
      actualReps: 3,
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.saveAmrapResult, {
      lift: "deadlift",
      weight: 120,
      targetReps: 1,
      actualReps: 4,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // Starý klient bez clientId nedeuplikuje — oba záznamy se uloží
    expect(program!.amrapResults).toHaveLength(2)
    // clientId pole není přítomné (undefined)
    expect(program!.amrapResults![0].clientId).toBeUndefined()
  })
})
