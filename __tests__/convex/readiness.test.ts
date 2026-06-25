/**
 * Testy pro convex/readiness.ts — ukládání readiness signálů.
 *
 * Pokrývá: upsert + merge sémantiku, validace rozsahů, ownership/auth,
 * getReadinessHistory (řazení + cap), getReadinessForDate, delete, izolaci uživatelů.
 */

import { describe, it, expect } from "vitest"
import { convexTest } from "convex-test"
import schema from "../../convex/schema"
import { api } from "../../convex/_generated/api"

function makeT() {
  // @ts-expect-error import.meta.glob je Vite-specific
  return convexTest(schema, import.meta.glob("../../convex/**/*.*s"))
}

async function seedUser(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "Readiness Tester",
      email: "readiness@example.com",
    })
  })
}

describe("readiness.upsertReadinessSignal — auth", () => {
  it("nepřihlášený → throw", async () => {
    const t = makeT()
    await expect(
      t.mutation(api.readiness.upsertReadinessSignal, { date: "2026-06-15", subjectiveFeel: "great" })
    ).rejects.toThrow()
  })
})

describe("readiness.upsertReadinessSignal — vložení a merge", () => {
  it("vloží nový záznam s defaultním source manual", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const identity = t.withIdentity({ subject: userId })

    await identity.mutation(api.readiness.upsertReadinessSignal, {
      date: "2026-06-15",
      subjectiveFeel: "great",
    })

    const rec = await identity.query(api.readiness.getReadinessForDate, { date: "2026-06-15" })
    expect(rec).not.toBeNull()
    expect(rec!.subjectiveFeel).toBe("great")
    expect(rec!.source).toBe("manual")
  })

  it("merge — druhý zápis téhož dne doplní metriku, nepřepíše ostatní", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const identity = t.withIdentity({ subject: userId })

    await identity.mutation(api.readiness.upsertReadinessSignal, {
      date: "2026-06-15",
      subjectiveFeel: "normal",
    })
    await identity.mutation(api.readiness.upsertReadinessSignal, {
      date: "2026-06-15",
      hrvMs: 60,
      restingHrBpm: 50,
      source: "garmin",
    })

    const rec = await identity.query(api.readiness.getReadinessForDate, { date: "2026-06-15" })
    expect(rec!.subjectiveFeel).toBe("normal") // zachováno z prvního zápisu
    expect(rec!.hrvMs).toBe(60)
    expect(rec!.restingHrBpm).toBe(50)
    expect(rec!.source).toBe("garmin") // poslední zdroj

    // Jen jeden záznam pro daný den (UPSERT, ne duplikát)
    const all = await identity.query(api.readiness.getReadinessHistory, {})
    expect(all).toHaveLength(1)
  })

  it("explicitní source garmin se uloží", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const identity = t.withIdentity({ subject: userId })
    await identity.mutation(api.readiness.upsertReadinessSignal, {
      date: "2026-06-15",
      hrvMs: 55,
      source: "garmin",
    })
    const rec = await identity.query(api.readiness.getReadinessForDate, { date: "2026-06-15" })
    expect(rec!.source).toBe("garmin")
  })
})

describe("readiness.upsertReadinessSignal — validace", () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ["špatný formát data", { date: "15.6.2026", subjectiveFeel: "great" }],
    ["HRV mimo rozsah", { date: "2026-06-15", hrvMs: 5000 }],
    ["HRV nula", { date: "2026-06-15", hrvMs: 0 }],
    ["klidový tep mimo rozsah", { date: "2026-06-15", restingHrBpm: 5 }],
    ["spánek > 24 h", { date: "2026-06-15", sleepHours: 30 }],
    ["kvalita spánku > 100", { date: "2026-06-15", sleepQuality: 150 }],
    ["žádná metrika", { date: "2026-06-15" }],
  ]
  for (const [name, args] of cases) {
    it(`odmítne: ${name}`, async () => {
      const t = makeT()
      const userId = await seedUser(t)
      await expect(
        t.withIdentity({ subject: userId }).mutation(api.readiness.upsertReadinessSignal, args as never)
      ).rejects.toThrow()
    })
  }
})

describe("readiness — historie, delete, izolace", () => {
  it("getReadinessHistory řadí vzestupně dle data", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const identity = t.withIdentity({ subject: userId })
    await identity.mutation(api.readiness.upsertReadinessSignal, { date: "2026-06-15", subjectiveFeel: "great" })
    await identity.mutation(api.readiness.upsertReadinessSignal, { date: "2026-06-13", subjectiveFeel: "bad" })
    await identity.mutation(api.readiness.upsertReadinessSignal, { date: "2026-06-14", subjectiveFeel: "normal" })

    const history = await identity.query(api.readiness.getReadinessHistory, {})
    expect(history.map((r) => r.date)).toEqual(["2026-06-13", "2026-06-14", "2026-06-15"])
  })

  it("getReadinessHistory vrátí [] pro nepřihlášeného", async () => {
    const t = makeT()
    expect(await t.query(api.readiness.getReadinessHistory, {})).toEqual([])
  })

  it("getReadinessForDate vrátí null pro nepřihlášeného", async () => {
    const t = makeT()
    expect(await t.query(api.readiness.getReadinessForDate, { date: "2026-06-15" })).toBeNull()
  })

  it("delete odstraní záznam; neexistující → throw", async () => {
    const t = makeT()
    const userId = await seedUser(t)
    const identity = t.withIdentity({ subject: userId })
    await identity.mutation(api.readiness.upsertReadinessSignal, { date: "2026-06-15", subjectiveFeel: "great" })
    await identity.mutation(api.readiness.deleteReadinessSignal, { date: "2026-06-15" })
    expect(await identity.query(api.readiness.getReadinessForDate, { date: "2026-06-15" })).toBeNull()
    await expect(
      identity.mutation(api.readiness.deleteReadinessSignal, { date: "2026-06-15" })
    ).rejects.toThrow()
  })

  it("data dvou uživatelů se nemíchají", async () => {
    const t = makeT()
    const userA = await seedUser(t)
    const userB = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "B", email: "b@example.com" })
    )
    await t.withIdentity({ subject: userA }).mutation(api.readiness.upsertReadinessSignal, {
      date: "2026-06-15",
      subjectiveFeel: "great",
    })
    const bHistory = await t.withIdentity({ subject: userB }).query(api.readiness.getReadinessHistory, {})
    expect(bHistory).toHaveLength(0)
  })
})
