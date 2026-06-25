/**
 * Testy kategorizace cviků ve statistikách
 *
 * Kategorizační logika žije inline v convex/statistics.ts (řádky ~59-70).
 * Testujeme ji přes getStatisticsData query s reálnými workout záznamy
 * (stejný vzor jako programs.test.ts — convex-test s seedovanými daty).
 *
 * Klíčové případy:
 * - "tlak na lavici" vs "tlak" — pořadí else-if (bench před press)
 * - "dřep", "mrtvý tah", "squat", "deadlift", "bench", "press"
 * - Anglické názvy
 * - Neznámý cvik → accessories fallback
 * - Výpočet volume (weight × reps × completed sets)
 */

import { convexTest } from "convex-test"
import { describe, it, expect } from "vitest"
import schema from "../../convex/schema"
import { api } from "../../convex/_generated/api"
import { Id } from "../../convex/_generated/dataModel"

function makeT() {
  // @ts-expect-error import.meta.glob je Vite-specific
  return convexTest(schema, import.meta.glob("../../convex/**/*.*s"))
}

async function seedUser(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Stats Tester",
      email: "stats@example.com",
    })
  })
}

// Helper: vytvoří workout s jedním cvikem a jedním completed setem
async function seedWorkout(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  exerciseName: string,
  weight: number,
  reps: number,
  completed = true
) {
  // Datum v rámci posledních 90 dní (jinak ho query nezahrne)
  const date = new Date()
  date.setDate(date.getDate() - 5)
  const dateStr = date.toISOString().split("T")[0]

  return await t.run(async (ctx) => {
    return await ctx.db.insert("workouts", {
      userId,
      date: dateStr,
      status: "completed",
      exercises: [
        {
          id: "ex1",
          name: exerciseName,
          sets: [{ weight, reps, completed }],
        },
      ],
    })
  })
}

// ============================================================================
// Základní autentizace a prázdný stav
// ============================================================================

describe("statistics.getStatisticsData — autentizace", () => {
  it("vrátí null pro nepřihlášeného uživatele", async () => {
    const t = makeT()
    const result = await t.query(api.statistics.getStatisticsData, {})
    expect(result).toBeNull()
  })

  it("vrátí prázdná data pro uživatele bez workoutů", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result).not.toBeNull()
    expect(result!.totalWorkouts).toBe(0)
    expect(result!.weeklyVolume).toEqual([])
    expect(result!.liftDistribution.squat).toBe(0)
    expect(result!.liftDistribution.bench).toBe(0)
    expect(result!.liftDistribution.deadlift).toBe(0)
    expect(result!.liftDistribution.press).toBe(0)
    expect(result!.liftDistribution.accessories).toBe(0)
  })
})

// ============================================================================
// Kategorizace — české názvy
// ============================================================================

describe("statistics kategorizace — české názvy cviků", () => {
  it('"Dřep" → squat kategorie', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Dřep", 100, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    // 100 kg × 5 reps = 500
    expect(result!.liftDistribution.squat).toBe(500)
    expect(result!.liftDistribution.accessories).toBe(0)
  })

  it('"dřep s činkou" → squat (substring match)', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "dřep s činkou", 120, 3)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.squat).toBe(360) // 120 × 3
    expect(result!.liftDistribution.accessories).toBe(0)
  })

  it('"Mrtvý tah" → deadlift kategorie', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Mrtvý tah", 150, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.deadlift).toBe(750) // 150 × 5
    expect(result!.liftDistribution.accessories).toBe(0)
  })

  it('"mrtvý tah rumunský" → deadlift (substring match)', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "mrtvý tah rumunský", 80, 8)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.deadlift).toBe(640) // 80 × 8
  })

  it('"Tlak nad hlavou" → press kategorie (ne bench)', async () => {
    // KLÍČOVÝ TEST: "tlak" bez "lavice" → press
    // else-if pořadí: bench se testuje dříve (contains "bench" nebo "tlak na lavici")
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Tlak nad hlavou", 60, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.press).toBe(300)   // 60 × 5
    expect(result!.liftDistribution.bench).toBe(0)     // nesmí spadnout do bench!
  })

  it('"tlak na lavici" → bench kategorie (ne press)', async () => {
    // KRITICKÝ TEST pořadí else-if:
    // Název obsahuje "tlak" (→ press) ALE také "tlak na lavici" (→ bench)
    // Správné pořadí: bench/tlak-na-lavici musí být testováno PŘED obecným "tlak"
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "tlak na lavici", 80, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.bench).toBe(400)   // 80 × 5
    expect(result!.liftDistribution.press).toBe(0)     // nesmí spadnout do press!
  })

  it('"Tlak na lavici se zádrží" → bench (substring "tlak na lavici")', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Tlak na lavici se zádrží", 70, 3)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.bench).toBe(210) // 70 × 3
    expect(result!.liftDistribution.press).toBe(0)
  })
})

// ============================================================================
// Kategorizace — anglické názvy
// ============================================================================

describe("statistics kategorizace — anglické názvy cviků", () => {
  it('"Squat" → squat kategorie', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Squat", 100, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.squat).toBe(500)
  })

  it('"Back Squat" → squat (substring "squat")', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Back Squat", 120, 3)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.squat).toBe(360)
  })

  it('"Bench Press" → bench kategorie (obsahuje "bench")', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Bench Press", 80, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.bench).toBe(400)
    expect(result!.liftDistribution.press).toBe(0)
  })

  it('"Deadlift" → deadlift kategorie', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Deadlift", 150, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.deadlift).toBe(750)
  })

  it('"Overhead Press" → press kategorie (obsahuje "press")', async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Overhead Press", 60, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.press).toBe(300)
    expect(result!.liftDistribution.bench).toBe(0)
  })
})

// ============================================================================
// Fallback — neznámý cvik → accessories
// ============================================================================

describe("statistics kategorizace — accessories fallback", () => {
  it("neznámý cvik spadne do accessories", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Bicep curl", 20, 12)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.accessories).toBe(240) // 20 × 12
    expect(result!.liftDistribution.squat).toBe(0)
    expect(result!.liftDistribution.bench).toBe(0)
    expect(result!.liftDistribution.deadlift).toBe(0)
    expect(result!.liftDistribution.press).toBe(0)
  })

  it("předání prázdného názvu cviku → accessories", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "", 50, 5)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.accessories).toBe(250)
  })

  it("cvik s meziserami ale bez klíčového slova → accessories", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedWorkout(t, userId, "Farmer walk", 40, 1)

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.accessories).toBe(40)
  })
})

// ============================================================================
// Volume výpočet — pouze completed sety
// ============================================================================

describe("statistics — volume zahrnuje pouze completed sety", () => {
  it("incomplete sety se nepočítají do volume", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const date = new Date()
    date.setDate(date.getDate() - 3)
    const dateStr = date.toISOString().split("T")[0]

    await t.run(async (ctx) => {
      await ctx.db.insert("workouts", {
        userId,
        date: dateStr,
        status: "completed",
        exercises: [
          {
            id: "ex1",
            name: "Squat",
            sets: [
              { weight: 100, reps: 5, completed: true },   // +500
              { weight: 100, reps: 5, completed: false },  // nepočítá se
              { weight: 100, reps: 5, completed: true },   // +500
            ],
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.squat).toBe(1000) // jen 2 completed sety × 100 × 5
    expect(result!.totalWorkouts).toBe(1)
  })

  it("totalVolume v weeklyVolume je zaokrouhleno na celé číslo (Math.round)", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const date = new Date()
    date.setDate(date.getDate() - 2)
    const dateStr = date.toISOString().split("T")[0]

    await t.run(async (ctx) => {
      await ctx.db.insert("workouts", {
        userId,
        date: dateStr,
        status: "completed",
        exercises: [
          {
            id: "ex1",
            name: "Squat",
            sets: [{ weight: 97.5, reps: 3, completed: true }], // 97.5 × 3 = 292.5
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    // totalVolume v liftDistribution se neokrouhluje, ale weeklyVolume.total ano
    // liftDistribution je suma volumeData.squat (nezaokrouhlená)
    expect(result!.liftDistribution.squat).toBe(97.5 * 3) // 292.5 (raw)
    // weeklyVolume.total je Math.round(totalVolume)
    expect(result!.weeklyVolume[0].total).toBe(293) // Math.round(292.5) = 293
  })
})

// ============================================================================
// Celkové volume — více cviků v jednom workoutu
// ============================================================================

describe("statistics — více cviků v jednom workoutu", () => {
  it("správně rozdělí volume mezi squat, bench a accessories", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const date = new Date()
    date.setDate(date.getDate() - 1)
    const dateStr = date.toISOString().split("T")[0]

    await t.run(async (ctx) => {
      await ctx.db.insert("workouts", {
        userId,
        date: dateStr,
        status: "completed",
        exercises: [
          {
            id: "ex1",
            name: "Squat",
            sets: [{ weight: 100, reps: 5, completed: true }], // 500
          },
          {
            id: "ex2",
            name: "Bench Press",
            sets: [{ weight: 80, reps: 3, completed: true }], // 240
          },
          {
            id: "ex3",
            name: "Cable row",
            sets: [{ weight: 50, reps: 10, completed: true }], // 500 → accessories
          },
        ],
      })
    })

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.squat).toBe(500)
    expect(result!.liftDistribution.bench).toBe(240)
    expect(result!.liftDistribution.accessories).toBe(500)
    expect(result!.liftDistribution.deadlift).toBe(0)
    expect(result!.liftDistribution.press).toBe(0)
  })
})
