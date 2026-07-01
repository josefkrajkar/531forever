/**
 * Testy pro statistics.getStatisticsData — kategorizace objemu do liftů.
 *
 * Pokryté případy:
 * - Nepřihlášený uživatel → null
 * - Hlavní lift + supplemental (BBB) se přičtou k programLift
 * - Accessory z katalogu (i s "lift" slovem v názvu, např. "Leg press",
 *   "Bulharské dřepy") NEsmí zatéct do hlavních liftů → jde do accessories
 * - Jen completed sety se počítají
 * - Legacy workout bez programLift → fallback na název (accessory katalog stále vyhraje)
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

async function seedUser(t: ReturnType<typeof makeT>, email = "user@example.com") {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name: "Test User", email })
  })
}

// Datum v rámci 90denního okna (query filtruje date >= now-90d)
const TODAY = new Date().toISOString().split("T")[0]

interface Ex {
  name: string
  sets: { weight: number; reps: number; completed: boolean }[]
}

async function seedWorkout(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  opts: { programLift?: string; exercises: Ex[]; date?: string }
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("workouts", {
      userId,
      date: opts.date ?? TODAY,
      status: "completed",
      programLift: opts.programLift,
      exercises: opts.exercises.map((e, i) => ({ id: `ex-${i}`, name: e.name, sets: e.sets })),
    })
  })
}

describe("statistics.getStatisticsData — autentizace", () => {
  it("vrátí null pro nepřihlášeného uživatele", async () => {
    const t = makeT()
    const result = await t.query(api.statistics.getStatisticsData, {})
    expect(result).toBeNull()
  })
})

describe("statistics.getStatisticsData — kategorizace objemu", () => {
  it("hlavní lift + BBB jdou do programLift, accessories se nemíchají", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedWorkout(t, userId, {
      programLift: "squat",
      exercises: [
        // Hlavní dřep (lokalizovaný název) → squat
        { name: "Dřep", sets: [{ weight: 100, reps: 5, completed: true }] }, // 500
        // BBB dřep → squat
        { name: "Dřep (BBB)", sets: [{ weight: 60, reps: 10, completed: true }] }, // 600
        // Accessory s "press" v názvu → NESMÍ jít do press
        { name: "Leg press", sets: [{ weight: 200, reps: 10, completed: true }] }, // 2000
        // Accessory s "dřep" v názvu → NESMÍ jít do squat
        { name: "Bulharské dřepy", sets: [{ weight: 20, reps: 10, completed: true }] }, // 200
      ],
    })

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result).not.toBeNull()
    const dist = result!.liftDistribution
    expect(dist.squat).toBe(1100) // 500 + 600 (main + BBB)
    expect(dist.press).toBe(0) // "Leg press" NEsmí zatéct sem
    expect(dist.bench).toBe(0)
    expect(dist.deadlift).toBe(0)
    expect(dist.accessories).toBe(2200) // 2000 + 200 (oba accessory)
  })

  it("počítá jen completed sety", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedWorkout(t, userId, {
      programLift: "bench",
      exercises: [
        {
          name: "Tlak na lavici",
          sets: [
            { weight: 80, reps: 5, completed: true }, // 400
            { weight: 80, reps: 5, completed: false }, // ignorováno
          ],
        },
      ],
    })

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    expect(result!.liftDistribution.bench).toBe(400)
  })

  it("legacy workout bez programLift → fallback na název, accessory katalog stále vyhraje", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedWorkout(t, userId, {
      // žádný programLift (stará data)
      exercises: [
        { name: "Dřep", sets: [{ weight: 100, reps: 5, completed: true }] }, // 500 → squat (fallback)
        { name: "Leg press", sets: [{ weight: 200, reps: 10, completed: true }] }, // 2000 → accessories (katalog)
      ],
    })

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.statistics.getStatisticsData, {})

    const dist = result!.liftDistribution
    expect(dist.squat).toBe(500)
    expect(dist.press).toBe(0)
    expect(dist.accessories).toBe(2000)
  })
})
