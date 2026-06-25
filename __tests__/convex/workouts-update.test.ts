/**
 * Tests for workouts.updateCompletedWorkout
 *
 * Covers:
 * - Úspěšná editace sétů, poznámky, hodnocení
 * - Cizí workout → throw (ownership)
 * - Draft/building workout → throw (status guard)
 * - Invalidní hodnoty → throw (validace)
 * - Program dokument zůstává nezměněn po editaci
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

async function seedUser(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Test User",
      email: "test@example.com",
    })
  })
}

async function seedCompletedWorkout(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  overrides: Partial<{
    note: string
    rating: number
    exercises: {
      id: string
      name: string
      rpe?: number
      sets: { weight: number; reps: number; completed: boolean }[]
    }[]
  }> = {}
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("workouts", {
      userId,
      date: "2024-03-15",
      status: "completed",
      note: overrides.note,
      rating: overrides.rating,
      exercises: overrides.exercises ?? [
        {
          id: "ex1",
          name: "Squat",
          sets: [
            { weight: 100, reps: 5, completed: true },
            { weight: 100, reps: 5, completed: true },
            { weight: 100, reps: 3, completed: false },
          ],
        },
        {
          id: "ex2",
          name: "Press",
          sets: [
            { weight: 50, reps: 5, completed: true },
          ],
        },
      ],
    })
  })
}

async function seedDraftWorkout(t: ReturnType<typeof makeT>, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("workouts", {
      userId,
      date: "2024-03-15",
      status: "building",
      exercises: [
        {
          id: "ex1",
          name: "Bench",
          sets: [{ weight: 80, reps: 5, completed: false }],
        },
      ],
    })
  })
}

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
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
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

// ============================================================================
// ÚSPĚŠNÁ EDITACE
// ============================================================================

describe("workouts.updateCompletedWorkout — úspěšná editace", () => {
  it("aktualizuje sety cviku", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        {
          id: "ex1",
          sets: [
            { weight: 102.5, reps: 5, completed: true },
            { weight: 102.5, reps: 5, completed: true },
            { weight: 102.5, reps: 5, completed: true },
          ],
        },
        {
          id: "ex2",
          sets: [{ weight: 52.5, reps: 6, completed: true }],
        },
      ],
    })

    const updated = await t.run(async (ctx) => ctx.db.get(workoutId))
    expect(updated!.exercises[0].sets[0].weight).toBe(102.5)
    expect(updated!.exercises[0].sets[2].completed).toBe(true)
    expect(updated!.exercises[1].sets[0].reps).toBe(6)
  })

  it("zachová název a rpe cviku při editaci sétů", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId, {
      exercises: [
        {
          id: "ex1",
          name: "Deadlift",
          rpe: 8,
          sets: [{ weight: 120, reps: 5, completed: true }],
        },
      ],
    })

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        {
          id: "ex1",
          sets: [{ weight: 125, reps: 4, completed: true }],
        },
      ],
    })

    const updated = await t.run(async (ctx) => ctx.db.get(workoutId))
    expect(updated!.exercises[0].name).toBe("Deadlift")
    expect(updated!.exercises[0].rpe).toBe(8)
    expect(updated!.exercises[0].sets[0].weight).toBe(125)
  })

  it("aktualizuje poznámku", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId, { note: "Starý text" })

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        { id: "ex1", sets: [{ weight: 100, reps: 5, completed: true }, { weight: 100, reps: 5, completed: true }, { weight: 100, reps: 3, completed: false }] },
        { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
      ],
      note: "Nový text po editaci",
    })

    const updated = await t.run(async (ctx) => ctx.db.get(workoutId))
    expect(updated!.note).toBe("Nový text po editaci")
  })

  it("aktualizuje hodnocení", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId, { rating: 3 })

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        { id: "ex1", sets: [{ weight: 100, reps: 5, completed: true }, { weight: 100, reps: 5, completed: true }, { weight: 100, reps: 3, completed: false }] },
        { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
      ],
      rating: 5,
    })

    const updated = await t.run(async (ctx) => ctx.db.get(workoutId))
    expect(updated!.rating).toBe(5)
  })

  it("zachová status, date, programCycle, programWeek, programLift při editaci", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await t.run(async (ctx) =>
      ctx.db.insert("workouts", {
        userId,
        date: "2024-01-10",
        status: "completed",
        exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 100, reps: 5, completed: true }] }],
        programCycle: 2,
        programWeek: 3,
        programLift: "squat",
      })
    )

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        { id: "ex1", sets: [{ weight: 105, reps: 5, completed: true }] },
      ],
    })

    const updated = await t.run(async (ctx) => ctx.db.get(workoutId))
    expect(updated!.status).toBe("completed")
    expect(updated!.date).toBe("2024-01-10")
    expect(updated!.programCycle).toBe(2)
    expect(updated!.programWeek).toBe(3)
    expect(updated!.programLift).toBe("squat")
  })
})

// ============================================================================
// OWNERSHIP + STATUS GUARD
// ============================================================================

describe("workouts.updateCompletedWorkout — bezpečnostní guardy", () => {
  it("throws při cizím workoutu", async () => {
    const t = makeT()
    const ownerUserId = await seedUser(t)
    const otherUserId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "Other User", email: "other@example.com" })
    )
    const workoutId = await seedCompletedWorkout(t, ownerUserId)

    await expect(
      t.withIdentity({ subject: otherUserId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: 100, reps: 5, completed: true }, { weight: 100, reps: 5, completed: true }, { weight: 100, reps: 3, completed: false }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Workout not found")
  })

  it("throws bez přihlášení", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await expect(
      t.mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: 100, reps: 5, completed: true }, { weight: 100, reps: 5, completed: true }, { weight: 100, reps: 3, completed: false }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Not authenticated")
  })

  it("throws při editaci draft/building workoutu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const draftId = await seedDraftWorkout(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId: draftId,
        exercises: [
          { id: "ex1", sets: [{ weight: 80, reps: 5, completed: false }] },
        ],
      })
    ).rejects.toThrow("Editovat lze pouze dokončené tréninky")
  })
})

// ============================================================================
// VALIDACE VSTUPŮ
// ============================================================================

describe("workouts.updateCompletedWorkout — validace vstupů", () => {
  it("throws při záporné váze", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: -1, reps: 5, completed: true }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Váha musí být číslo v rozsahu 0–1000 kg")
  })

  it("throws při váze přes 1000 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: 1001, reps: 5, completed: true }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Váha musí být číslo v rozsahu 0–1000 kg")
  })

  it("throws při necelém počtu opakování", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: 100, reps: 4.5, completed: true }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Počet opakování musí být celé číslo v rozsahu 0–100")
  })

  it("throws při opakování nad 100", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: 100, reps: 101, completed: true }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Počet opakování musí být celé číslo v rozsahu 0–100")
  })

  it("throws při více než 20 sériích v jednom cviku", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    const tooManySets = Array.from({ length: 21 }, () => ({ weight: 100, reps: 5, completed: true }))
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: tooManySets },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
      })
    ).rejects.toThrow("Maximálně 20 sérií na cvik")
  })

  it("throws při více než 30 cvicích", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    const tooManyExercises = Array.from({ length: 31 }, (_, i) => ({
      id: `ex${i}`,
      sets: [{ weight: 50, reps: 5, completed: true }],
    }))
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: tooManyExercises,
      })
    ).rejects.toThrow("Maximálně 30 cviků na trénink")
  })

  it("throws při hodnocení mimo rozsah 0–5", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
        workoutId,
        exercises: [
          { id: "ex1", sets: [{ weight: 100, reps: 5, completed: true }, { weight: 100, reps: 5, completed: true }, { weight: 100, reps: 3, completed: false }] },
          { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
        ],
        rating: 6,
      })
    ).rejects.toThrow("Hodnocení musí být v rozsahu 0–5")
  })
})

// ============================================================================
// PROGRAM NEZMĚNĚN
// ============================================================================

describe("workouts.updateCompletedWorkout — program zůstává nezměněn", () => {
  it("editace workoutu nezmění program (TM, pozice, amrapResults, e1rmHistory)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveProgram(t, userId)
    const workoutId = await seedCompletedWorkout(t, userId)

    // Snapshot programu před editací
    const programBefore = await t.run(async (ctx) => ctx.db.get(programId))

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        {
          id: "ex1",
          sets: [
            { weight: 110, reps: 5, completed: true },
            { weight: 110, reps: 5, completed: true },
            { weight: 110, reps: 5, completed: true },
          ],
        },
        {
          id: "ex2",
          sets: [{ weight: 55, reps: 5, completed: true }],
        },
      ],
      note: "Upravená poznámka",
      rating: 4,
    })

    // Program musí být identický
    const programAfter = await t.run(async (ctx) => ctx.db.get(programId))
    expect(programAfter!.trainingMaxes).toEqual(programBefore!.trainingMaxes)
    expect(programAfter!.cycle).toBe(programBefore!.cycle)
    expect(programAfter!.week).toBe(programBefore!.week)
    expect(programAfter!.dayIndex).toBe(programBefore!.dayIndex)
    expect(programAfter!.amrapResults).toEqual(programBefore!.amrapResults)
    expect(programAfter!.e1rmHistory).toEqual(programBefore!.e1rmHistory)
    expect(programAfter!.misses).toEqual(programBefore!.misses)
  })

  it("editace workoutu nezapíše žádný programs dokument, pokud uživatel nemá program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const workoutId = await seedCompletedWorkout(t, userId)

    await t.withIdentity({ subject: userId }).mutation(api.workouts.updateCompletedWorkout, {
      workoutId,
      exercises: [
        { id: "ex1", sets: [{ weight: 105, reps: 5, completed: true }, { weight: 105, reps: 5, completed: true }, { weight: 105, reps: 3, completed: false }] },
        { id: "ex2", sets: [{ weight: 50, reps: 5, completed: true }] },
      ],
    })

    const programs = await t.run(async (ctx) =>
      ctx.db.query("programs").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    )
    expect(programs).toHaveLength(0)
  })
})
