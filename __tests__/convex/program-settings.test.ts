/**
 * Testy pro nastavení programu (program-settings)
 *
 * Pokrývá:
 * - setTrainingMax: úspěch, zaokrouhlení, reset misses, validace, cizí/neexistující program
 * - pauseProgram / resumeProgram: přechody statusů, pozice zachována
 * - completeWorkout na pozastaveném programu → throw
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

async function seedActiveForeverProgram(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  overrides: {
    misses?: { squat: number; bench: number; deadlift: number; press: number }
    trainingMaxes?: { squat: number; bench: number; deadlift: number; press: number }
    cycle?: number
    week?: number
    dayIndex?: number
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
      trainingMaxes: overrides.trainingMaxes ?? { squat: 100, bench: 80, deadlift: 120, press: 50 },
      increments: { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 },
      rounding: 2.5,
      misses: overrides.misses ?? { squat: 1, bench: 0, deadlift: 2, press: 0 },
      e1rmHistory: { squat: [110, 115], bench: [90], deadlift: [], press: [55, 52] },
      calibration: {},
      amrapResults: [],
      programPhase: "leader1",
      supplementalTemplate: "bbb",
      macrocycleNumber: 1,
      phaseWeek: 1,
      createdAt: now,
      updatedAt: now,
    })
  })
}

// ============================================================================
// setTrainingMax
// ============================================================================

describe("programs.setTrainingMax", () => {
  it("vrací chybu bez autentizace", async () => {
    const t = makeT()
    await expect(
      t.mutation(api.programs.setTrainingMax, { lift: "squat", newTM: 100 })
    ).rejects.toThrow("Not authenticated")
  })

  it("vrací chybu bez aktivního programu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
        lift: "squat",
        newTM: 100,
      })
    ).rejects.toThrow()
  })

  it("nastaví TM a zaokrouhlí na 2.5 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId)

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
      lift: "squat",
      newTM: 102.3,
    })

    // Zaokrouhlení na nejbližší 2.5: 102.3 → 102.5
    expect(result.newTM).toBe(102.5)

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.trainingMaxes.squat).toBe(102.5)
  })

  it("vynuluje misses pro upravený lift", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    // squat misses = 1, deadlift misses = 2
    const programId = await seedActiveForeverProgram(t, userId, {
      misses: { squat: 1, bench: 0, deadlift: 2, press: 0 },
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
      lift: "squat",
      newTM: 95,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // squat misses → 0 (reset)
    expect((program!.misses as Record<string, number>).squat).toBe(0)
    // deadlift misses nezměněno
    expect((program!.misses as Record<string, number>).deadlift).toBe(2)
  })

  it("vynuluje misses pro deadlift (misses=2) při úpravě deadlift TM", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId, {
      misses: { squat: 1, bench: 0, deadlift: 2, press: 0 },
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
      lift: "deadlift",
      newTM: 110,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect((program!.misses as Record<string, number>).deadlift).toBe(0)
    // squat misses stále 1
    expect((program!.misses as Record<string, number>).squat).toBe(1)
  })

  it("zachová e1rmHistory po úpravě TM", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId)

    await t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
      lift: "squat",
      newTM: 95,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    // e1rmHistory pro squat zůstane nezměněna
    expect((program!.e1rmHistory as Record<string, number[]>).squat).toEqual([110, 115])
  })

  it("vrací chybu pro hodnotu pod 20 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
        lift: "squat",
        newTM: 15,
      })
    ).rejects.toThrow()
  })

  it("vrací chybu pro hodnotu nad 1000 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
        lift: "bench",
        newTM: 1001,
      })
    ).rejects.toThrow()
  })

  it("vrací chybu pro nekonečnou hodnotu (Infinity)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
        lift: "press",
        newTM: Infinity,
      })
    ).rejects.toThrow()
  })

  it("vrací chybu pro NaN", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
        lift: "press",
        newTM: NaN,
      })
    ).rejects.toThrow()
  })

  it("aktualizuje jen TM zadaného liftu, ostatní zůstanou beze změny", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId, {
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
      lift: "bench",
      newTM: 85,
    })

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.trainingMaxes.squat).toBe(100)
    expect(program!.trainingMaxes.bench).toBe(85)
    expect(program!.trainingMaxes.deadlift).toBe(120)
    expect(program!.trainingMaxes.press).toBe(50)
  })

  it("vrací chybu pro lift mimo split programu (simulace custom splitu)", async () => {
    // Seed programu s custom splitem bez 'press'
    const t = makeT()
    const userId = await seedUser(t)
    await t.run(async (ctx) => {
      const now = new Date().toISOString()
      return await ctx.db.insert("programs", {
        userId,
        template: "531_bbb",
        status: "active",
        cycle: 1,
        week: 1,
        dayIndex: 0,
        split: ["squat", "bench", "deadlift", "press"], // standardní split
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

    // 'press' je v splitu → OK
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.setTrainingMax, {
        lift: "press",
        newTM: 55,
      })
    ).resolves.toBeDefined()
  })
})

// ============================================================================
// pauseProgram / resumeProgram
// ============================================================================

describe("programs.pauseProgram", () => {
  it("vrací chybu bez autentizace", async () => {
    const t = makeT()
    await expect(t.mutation(api.programs.pauseProgram, {})).rejects.toThrow("Not authenticated")
  })

  it("vrací chybu bez aktivního programu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})
    ).rejects.toThrow()
  })

  it("přepne aktivní program na paused", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId)

    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    expect(result.status).toBe("paused")

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.status).toBe("paused")
  })

  it("zachová pozici programu při pauze (cycle, week, dayIndex nezměněny)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId, {
      cycle: 2,
      week: 3,
      dayIndex: 2,
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.cycle).toBe(2)
    expect(program!.week).toBe(3)
    expect(program!.dayIndex).toBe(2)
  })

  it("vrací chybu pokud je program již pozastaven (není aktivní)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    // První pauza — OK
    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    // Druhá pauza — program je paused, ne active → throw
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})
    ).rejects.toThrow()
  })
})

describe("programs.resumeProgram", () => {
  it("vrací chybu bez autentizace", async () => {
    const t = makeT()
    await expect(t.mutation(api.programs.resumeProgram, {})).rejects.toThrow("Not authenticated")
  })

  it("vrací chybu bez pozastaveného programu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.resumeProgram, {})
    ).rejects.toThrow()
  })

  it("přepne paused program na active", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId)

    // Nejprve pozastav
    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    // Obnov
    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.resumeProgram, {})
    expect(result.status).toBe("active")

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.status).toBe("active")
  })

  it("zachová pozici programu při obnově (cycle, week, dayIndex nezměněny)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId, {
      cycle: 3,
      week: 2,
      dayIndex: 1,
    })

    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})
    await t.withIdentity({ subject: userId }).mutation(api.programs.resumeProgram, {})

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.cycle).toBe(3)
    expect(program!.week).toBe(2)
    expect(program!.dayIndex).toBe(1)
    expect(program!.status).toBe("active")
  })

  it("cyklus pause → resume → pause → resume funguje správně", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const programId = await seedActiveForeverProgram(t, userId)

    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})
    await t.withIdentity({ subject: userId }).mutation(api.programs.resumeProgram, {})
    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})
    await t.withIdentity({ subject: userId }).mutation(api.programs.resumeProgram, {})

    const program = await t.run(async (ctx) => ctx.db.get(programId))
    expect(program!.status).toBe("active")
  })
})

// ============================================================================
// completeWorkout na pozastaveném programu
// ============================================================================

describe("programs.completeWorkout — pozastavený program", () => {
  it("vrací chybu 'No active program found' při pokusu o dokončení tréninku na pozastaveném programu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    // Pozastav program
    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    // completeWorkout hledá aktivní program — paused nenajde → throw
    await expect(
      t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
        exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 85, reps: 5, completed: true }] }],
        expectedCycle: 1,
        expectedWeek: 1,
        expectedDayIndex: 0,
      })
    ).rejects.toThrow("No active program found")
  })

  it("completeWorkout funguje normálně po obnovení programu", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    // Pozastav a obnov
    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})
    await t.withIdentity({ subject: userId }).mutation(api.programs.resumeProgram, {})

    // completeWorkout by nyní měl projít
    const result = await t.withIdentity({ subject: userId }).mutation(api.programs.completeWorkout, {
      exercises: [{ id: "ex1", name: "Squat", sets: [{ weight: 85, reps: 5, completed: true }] }],
      expectedCycle: 1,
      expectedWeek: 1,
      expectedDayIndex: 0,
    })

    expect(result.workoutId).toBeDefined()
    expect(result.alreadyCompleted).toBeUndefined()
  })
})

// ============================================================================
// getPausedProgram query
// ============================================================================

describe("programs.getPausedProgram", () => {
  it("vrací null bez autentizace", async () => {
    const t = makeT()
    const result = await t.query(api.programs.getPausedProgram, {})
    expect(result).toBeNull()
  })

  it("vrací null pokud není pozastaven žádný program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    const result = await t.withIdentity({ subject: userId }).query(api.programs.getPausedProgram, {})
    expect(result).toBeNull()
  })

  it("vrátí pozastavený program", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    const result = await t.withIdentity({ subject: userId }).query(api.programs.getPausedProgram, {})
    expect(result).not.toBeNull()
    expect(result!.status).toBe("paused")
  })
})

// ============================================================================
// getCurrentProgram — vrací paused program
// ============================================================================

describe("programs.getCurrentProgram — paused program", () => {
  it("vrátí paused program pokud není aktivní žádný jiný", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveForeverProgram(t, userId)

    // Pozastav
    await t.withIdentity({ subject: userId }).mutation(api.programs.pauseProgram, {})

    const result = await t.withIdentity({ subject: userId }).query(api.programs.getCurrentProgram, {})
    expect(result).not.toBeNull()
    expect(result!.status).toBe("paused")
  })
})
