/**
 * Testy pro accessory trends queries:
 *   - accessories.getAccessoryTrends
 *   - accessories.getUsedAccessories
 *
 * Pokryté případy:
 * - Agregace více logů v různých dnech
 * - Jen completed sety se počítají (incompleted sety ignorovány)
 * - bestE1RM z nejlepšího completed setu
 * - Bodyweight cvik (weight === 0) — e1RM = 0, volume = 0, pouze totalReps
 * - Neautentizovaný uživatel → prázdné pole
 * - Cizí data se do výsledku nemíchají
 * - Cap 500 logů
 * - getUsedAccessories vrátí unikátní seznam
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

async function seedUser(
  t: ReturnType<typeof makeT>,
  email = "user@example.com"
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name: "Test User", email })
  })
}

async function seedAccessoryLog(
  t: ReturnType<typeof makeT>,
  userId: Id<"users">,
  accessoryId: string,
  date: string,
  sets: { weight: number; reps: number; completed: boolean }[]
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("accessoryLogs", {
      userId,
      accessoryId,
      date,
      sets,
    })
  })
}

// ============================================================================
// getAccessoryTrends — autentizace
// ============================================================================

describe("accessories.getAccessoryTrends — autentizace", () => {
  it("vrátí prázdné pole pro nepřihlášeného uživatele", async () => {
    const t = makeT()
    const result = await t.query(api.accessories.getAccessoryTrends, {
      accessoryId: "pullups",
    })
    expect(result).toEqual([])
  })

  it("vrátí prázdné pole pro přihlášeného uživatele bez logů", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "pullups" })
    expect(result).toEqual([])
  })
})

// ============================================================================
// getAccessoryTrends — základní agregace
// ============================================================================

describe("accessories.getAccessoryTrends — základní agregace", () => {
  it("vrátí jeden bod pro jediný log", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedAccessoryLog(t, userId, "pullups", "2025-01-10", [
      { weight: 10, reps: 8, completed: true },
      { weight: 10, reps: 8, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "pullups" })

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe("2025-01-10")
    // e1RM = round(10 * (1 + 8/30)) = round(10 * 1.2667) = round(12.667) = 13
    expect(result[0].bestE1RM).toBe(13)
    expect(result[0].topWeight).toBe(10)
    // volume = 10*8 + 10*8 = 160
    expect(result[0].totalVolume).toBe(160)
    expect(result[0].totalReps).toBe(16)
  })

  it("vrátí více bodů pro různé dny — seřazeno vzestupně", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedAccessoryLog(t, userId, "db_rows", "2025-02-01", [
      { weight: 20, reps: 10, completed: true },
    ])
    await seedAccessoryLog(t, userId, "db_rows", "2025-02-08", [
      { weight: 22, reps: 10, completed: true },
    ])
    await seedAccessoryLog(t, userId, "db_rows", "2025-02-15", [
      { weight: 24, reps: 10, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "db_rows" })

    expect(result).toHaveLength(3)
    expect(result[0].date).toBe("2025-02-01")
    expect(result[1].date).toBe("2025-02-08")
    expect(result[2].date).toBe("2025-02-15")
    // bestE1RM roste
    expect(result[2].bestE1RM).toBeGreaterThan(result[0].bestE1RM)
  })
})

// ============================================================================
// getAccessoryTrends — jen completed sety
// ============================================================================

describe("accessories.getAccessoryTrends — jen completed sety", () => {
  it("ignoruje incompleted sety při výpočtu volume a e1RM", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedAccessoryLog(t, userId, "cable_rows", "2025-03-01", [
      { weight: 50, reps: 10, completed: true },   // počítá se
      { weight: 50, reps: 10, completed: false },  // ignoruje se
      { weight: 50, reps: 8, completed: false },   // ignoruje se
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "cable_rows" })

    expect(result).toHaveLength(1)
    // Jen první set (50 × 10)
    expect(result[0].totalVolume).toBe(500)
    expect(result[0].totalReps).toBe(10)
    // bestE1RM z completed setu: round(50 * (1 + 10/30)) = round(50 * 1.333) = round(66.67) = 67
    expect(result[0].bestE1RM).toBe(67)
  })

  it("vrátí prázdné pole pokud jsou všechny sety incompleted", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedAccessoryLog(t, userId, "lat_pulldown", "2025-03-05", [
      { weight: 60, reps: 8, completed: false },
      { weight: 60, reps: 6, completed: false },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "lat_pulldown" })

    expect(result).toEqual([])
  })

  it("bestE1RM pochází z nejlepšího completed setu, ne z nejhoršího", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    // Tři různé completed sety — nejlepší je třetí (100kg × 1 = 100 kg e1RM,
    // ale 80kg × 5 = round(80 * 1.167) = 93, 60kg × 8 = round(60 * 1.267) = 76)
    // Nejlepší e1RM: 80 × 5 → round(80*(1+5/30)) = round(80*1.1667) = round(93.33) = 93
    await seedAccessoryLog(t, userId, "barbell_rows", "2025-03-10", [
      { weight: 60, reps: 8, completed: true },
      { weight: 80, reps: 5, completed: true },
      { weight: 100, reps: 1, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "barbell_rows" })

    expect(result).toHaveLength(1)
    // bestE1RM = max z (76, 93, 100) = 100 (1 rep → e1RM = váha)
    expect(result[0].bestE1RM).toBe(100)
    expect(result[0].topWeight).toBe(100)
  })
})

// ============================================================================
// getAccessoryTrends — bodyweight cviky
// ============================================================================

describe("accessories.getAccessoryTrends — bodyweight cviky (weight === 0)", () => {
  it("u bodyweight cviků je e1RM = 0, topWeight = 0, totalVolume = 0, totalReps > 0", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedAccessoryLog(t, userId, "pullups", "2025-04-01", [
      { weight: 0, reps: 10, completed: true },
      { weight: 0, reps: 8, completed: true },
      { weight: 0, reps: 6, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "pullups" })

    expect(result).toHaveLength(1)
    expect(result[0].bestE1RM).toBe(0)
    expect(result[0].topWeight).toBe(0)
    expect(result[0].totalVolume).toBe(0)
    expect(result[0].totalReps).toBe(24)
  })

  it("bodyweight cvik — incompleted sety se nepočítají do totalReps", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedAccessoryLog(t, userId, "pushups", "2025-04-05", [
      { weight: 0, reps: 15, completed: true },
      { weight: 0, reps: 15, completed: false }, // ignorovat
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "pushups" })

    expect(result).toHaveLength(1)
    expect(result[0].totalReps).toBe(15)
  })
})

// ============================================================================
// getAccessoryTrends — izolace dat (cizí uživatel)
// ============================================================================

describe("accessories.getAccessoryTrends — izolace dat", () => {
  it("nevrátí logy cizího uživatele", async () => {
    const t = makeT()
    const userId = await seedUser(t, "owner@example.com")
    const otherId = await seedUser(t, "other@example.com")

    // Vlastní log
    await seedAccessoryLog(t, userId, "face_pulls", "2025-05-01", [
      { weight: 30, reps: 15, completed: true },
    ])
    // Cizí log pro stejný accessoryId
    await seedAccessoryLog(t, otherId, "face_pulls", "2025-05-01", [
      { weight: 50, reps: 15, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "face_pulls" })

    expect(result).toHaveLength(1)
    // Vlastní log má volume 30*15=450, cizí by byl 50*15=750
    expect(result[0].totalVolume).toBe(450)
  })

  it("vrátí jen data pro daný accessoryId, ne pro jiné cviky téhož uživatele", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await seedAccessoryLog(t, userId, "face_pulls", "2025-05-10", [
      { weight: 30, reps: 15, completed: true },
    ])
    await seedAccessoryLog(t, userId, "cable_rows", "2025-05-10", [
      { weight: 60, reps: 10, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "face_pulls" })

    expect(result).toHaveLength(1)
    expect(result[0].totalVolume).toBe(450)
  })
})

// ============================================================================
// getUsedAccessories
// ============================================================================

describe("accessories.getUsedAccessories — autentizace", () => {
  it("vrátí prázdné pole pro nepřihlášeného uživatele", async () => {
    const t = makeT()
    const result = await t.query(api.accessories.getUsedAccessories, {})
    expect(result).toEqual([])
  })

  it("vrátí prázdné pole pro uživatele bez logů", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getUsedAccessories, {})
    expect(result).toEqual([])
  })
})

describe("accessories.getUsedAccessories — unikátní seznam", () => {
  it("vrátí unikátní accessoryIds i při více lozích pro stejný cvik", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    // Více logů pro stejný cvik ve různé dny
    await seedAccessoryLog(t, userId, "pullups", "2025-06-01", [
      { weight: 0, reps: 10, completed: true },
    ])
    await seedAccessoryLog(t, userId, "pullups", "2025-06-08", [
      { weight: 0, reps: 12, completed: true },
    ])
    await seedAccessoryLog(t, userId, "face_pulls", "2025-06-01", [
      { weight: 30, reps: 15, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getUsedAccessories, {})

    expect(result).toHaveLength(2)
    expect(result).toContain("pullups")
    expect(result).toContain("face_pulls")
  })

  it("nevrátí accessoryIds cizího uživatele", async () => {
    const t = makeT()
    const userId = await seedUser(t, "owner2@example.com")
    const otherId = await seedUser(t, "other2@example.com")

    await seedAccessoryLog(t, userId, "dips", "2025-06-10", [
      { weight: 0, reps: 10, completed: true },
    ])
    await seedAccessoryLog(t, otherId, "rdl", "2025-06-10", [
      { weight: 80, reps: 8, completed: true },
    ])

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getUsedAccessories, {})

    expect(result).toHaveLength(1)
    expect(result).toContain("dips")
    expect(result).not.toContain("rdl")
  })
})

// ============================================================================
// Cap test
// ============================================================================

describe("accessories.getAccessoryTrends — cap 500 logů", () => {
  it("zpracuje 501 logů aniž by padl (cap 500 — výsledek má ≤ 500 bodů)", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    // Seed 510 logů pro různé dny
    for (let i = 0; i < 510; i++) {
      const year = 2020 + Math.floor(i / 365)
      const dayOfYear = i % 365
      const date = new Date(year, 0, 1)
      date.setDate(date.getDate() + dayOfYear)
      const dateStr = date.toISOString().split("T")[0]
      await seedAccessoryLog(t, userId, "db_rows", dateStr, [
        { weight: 20, reps: 10, completed: true },
      ])
    }

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.accessories.getAccessoryTrends, { accessoryId: "db_rows" })

    expect(result.length).toBeLessThanOrEqual(500)
  })
})
