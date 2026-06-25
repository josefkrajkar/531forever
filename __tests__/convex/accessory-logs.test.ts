/**
 * Testy pro Convex accessory log mutace:
 *   - accessories.logAccessory
 *   - accessories.logMultipleAccessories
 *
 * F4.2 — idempotence klientského data:
 *   - S klientským date → zaloguje na to datum
 *   - Bez date → fallback na serverové datum (zpětná kompatibilita)
 *   - UPSERT: 2× stejný (user, date, accessoryId) → žádný duplikát
 *   - Neplatný formát date → chyba
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

async function seedUser(
  t: ReturnType<typeof makeT>,
  email = "user@example.com"
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name: "Test User", email })
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
      week: 2,
      dayIndex: 1,
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

const EXAMPLE_SETS = [
  { weight: 50, reps: 10, completed: true },
  { weight: 50, reps: 8, completed: true },
]

// ============================================================================
// logAccessory — klientské datum (F4.2)
// ============================================================================

describe("accessories.logAccessory — klientské datum (F4.2)", () => {
  it("uloží log na klientské datum, ne serverové", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const clientDate = "2025-03-15"
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logAccessory, {
        accessoryId: "pullups",
        sets: EXAMPLE_SETS,
        date: clientDate,
      })

    const log = await t.run(async (ctx) => ctx.db.get(logId))
    expect(log).not.toBeNull()
    expect(log!.date).toBe(clientDate)
  })

  it("bez date → fallback na serverové datum (zpětná kompatibilita)", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logAccessory, {
        accessoryId: "dips",
        sets: EXAMPLE_SETS,
        // date záměrně neposlán — starý klient
      })

    const log = await t.run(async (ctx) => ctx.db.get(logId))
    expect(log).not.toBeNull()
    // Datum musí být formátu YYYY-MM-DD (ze serveru)
    expect(log!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("UPSERT: 2× stejný (user, date, accessoryId) → žádný duplikát, patch sets", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const clientDate = "2025-04-01"

    const firstId = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logAccessory, {
        accessoryId: "cable_rows",
        sets: [{ weight: 40, reps: 12, completed: true }],
        date: clientDate,
      })

    // Druhé volání se stejným datem a accessoryId → UPSERT
    const secondId = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logAccessory, {
        accessoryId: "cable_rows",
        sets: [{ weight: 45, reps: 10, completed: true }],
        date: clientDate,
      })

    // Musí vrátit stejné ID (update, ne insert)
    expect(secondId).toBe(firstId)

    // Databáze smí obsahovat jen 1 záznam pro tento (user, date, accessoryId)
    const allLogs = await t.run(async (ctx) => {
      return await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", clientDate)
        )
        .collect()
    })
    expect(allLogs).toHaveLength(1)
    // Sets jsou aktualizovány (druhé volání)
    expect(allLogs[0].sets[0].weight).toBe(45)
  })

  it("odmítne neplatný formát date", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.accessories.logAccessory, {
        accessoryId: "pullups",
        sets: EXAMPLE_SETS,
        date: "15-03-2025", // špatný formát
      })
    ).rejects.toThrow("Neplatný formát data")
  })
})

// ============================================================================
// logMultipleAccessories — klientské datum (F4.2)
// ============================================================================

describe("accessories.logMultipleAccessories — klientské datum (F4.2)", () => {
  it("uloží logy na klientské datum", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    await seedActiveProgram(t, userId)

    const clientDate = "2025-05-10"
    const logIds = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logMultipleAccessories, {
        date: clientDate,
        logs: [
          { accessoryId: "pullups", sets: EXAMPLE_SETS },
          { accessoryId: "dips", sets: [{ weight: 0, reps: 10, completed: true }] },
        ],
      })

    expect(logIds).toHaveLength(2)

    const logsInDb = await t.run(async (ctx) => {
      return await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", clientDate)
        )
        .collect()
    })
    expect(logsInDb).toHaveLength(2)
    for (const log of logsInDb) {
      expect(log.date).toBe(clientDate)
    }
  })

  it("bez date → fallback na serverové datum (zpětná kompatibilita)", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const logIds = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logMultipleAccessories, {
        // date záměrně neposlán
        logs: [{ accessoryId: "lat_pulldown", sets: EXAMPLE_SETS }],
      })

    expect(logIds).toHaveLength(1)
    // Ověř datum přes query (ne db.get — return type je string[], ne Id[])
    const allLogs = await t.run(async (ctx) => {
      return await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_accessory", (q) =>
          q.eq("userId", userId).eq("accessoryId", "lat_pulldown")
        )
        .collect()
    })
    expect(allLogs).toHaveLength(1)
    expect(allLogs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("UPSERT: 2× stejný (user, date, accessoryId) → žádný duplikát", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const clientDate = "2025-06-01"

    await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logMultipleAccessories, {
        date: clientDate,
        logs: [{ accessoryId: "barbell_rows", sets: [{ weight: 60, reps: 8, completed: true }] }],
      })

    // Druhé volání se stejnými parametry (replay)
    await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logMultipleAccessories, {
        date: clientDate,
        logs: [{ accessoryId: "barbell_rows", sets: [{ weight: 65, reps: 8, completed: true }] }],
      })

    const logsInDb = await t.run(async (ctx) => {
      return await ctx.db
        .query("accessoryLogs")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", clientDate)
        )
        .collect()
    })
    // Jen 1 záznam — ne 2
    expect(logsInDb).toHaveLength(1)
    // Sets z druhého volání (patch)
    expect(logsInDb[0].sets[0].weight).toBe(65)
  })

  it("odmítne neplatný formát date", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.accessories.logMultipleAccessories, {
        date: "2025/06/01", // špatný formát (lomítka)
        logs: [{ accessoryId: "pullups", sets: EXAMPLE_SETS }],
      })
    ).rejects.toThrow("Neplatný formát data")
  })

  it("prázdné logs → vrátí prázdné pole bez chyby", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.accessories.logMultipleAccessories, {
        date: "2025-07-01",
        logs: [],
      })

    expect(result).toEqual([])
  })
})
