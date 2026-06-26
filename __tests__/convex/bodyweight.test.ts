/**
 * Testy pro Convex bodyweight modul
 *
 * Pokrývá:
 * - logBodyweight: log + UPSERT (týž den přepíše)
 * - logBodyweight: validace (rozsah váhy, formát data)
 * - logBodyweight: auth — nepřihlášený uživatel vyhodí chybu
 * - logBodyweight: athleteProfile.weight se aktualizuje jen při nejnovějším datu
 * - deleteBodyweightLog: smazání + ownership check
 * - getBodyweightHistory: řazení vzestupně dle data + cap 730
 */

import { convexTest } from "convex-test"
import { describe, it, expect } from "vitest"
import schema from "../../convex/schema"
import { api } from "../../convex/_generated/api"

function makeT() {
  // @ts-expect-error import.meta.glob je Vite-specific
  return convexTest(schema, import.meta.glob("../../convex/**/*.*s"))
}

async function seedUser(t: ReturnType<typeof makeT>, weight = 80) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name: "BW Tester",
      email: "bw@example.com",
      athleteProfile: {
        gender: "male",
        age: 25,
        height: 175,
        weight,
        experience: "intermediate",
      },
    })
  })
}

// ============================================================================
// Auth
// ============================================================================

describe("bodyweight.logBodyweight — autentizace", () => {
  it("vyhodí chybu pro nepřihlášeného uživatele", async () => {
    const t = makeT()
    await expect(
      t.mutation(api.bodyweight.logBodyweight, { date: "2024-01-15", weightKg: 80 })
    ).rejects.toThrow()
  })

  it("getBodyweightHistory vrátí [] pro nepřihlášeného", async () => {
    const t = makeT()
    const result = await t.query(api.bodyweight.getBodyweightHistory, {})
    expect(result).toEqual([])
  })
})

// ============================================================================
// Základní log + UPSERT
// ============================================================================

describe("bodyweight.logBodyweight — log + UPSERT", () => {
  it("vloží nový záznam", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-01", weightKg: 82.5 })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    expect(history).toHaveLength(1)
    expect(history[0].date).toBe("2024-03-01")
    expect(history[0].weightKg).toBe(82.5)
    // Bez explicitního source → default "manual"
    expect(history[0].source).toBe("manual")
  })

  it("uloží explicitní source (např. garmin)", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-02", weightKg: 81, source: "garmin" })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    expect(history[0].source).toBe("garmin")
  })

  it("UPSERT — týž den přepíše váhu", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-01", weightKg: 82.5 })

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-01", weightKg: 83.0 })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    // Stále jen 1 záznam (UPSERT)
    expect(history).toHaveLength(1)
    expect(history[0].weightKg).toBe(83.0)
  })

  it("různé dny — vloží samostatné záznamy", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-01", weightKg: 82 })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-02", weightKg: 82.5 })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    expect(history).toHaveLength(2)
  })
})

// ============================================================================
// Validace
// ============================================================================

describe("bodyweight.logBodyweight — validace", () => {
  it("odmítne váhu < 30 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "2024-01-01", weightKg: 29 })
    ).rejects.toThrow()
  })

  it("odmítne váhu > 300 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "2024-01-01", weightKg: 301 })
    ).rejects.toThrow()
  })

  it("povolí váhu na hranici — 30 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "2024-01-01", weightKg: 30 })
    ).resolves.not.toThrow()
  })

  it("povolí váhu na hranici — 300 kg", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "2024-01-01", weightKg: 300 })
    ).resolves.not.toThrow()
  })

  it("odmítne nevalidní formát data", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "01-01-2024", weightKg: 80 })
    ).rejects.toThrow()
  })

  it("odmítne nevalidní formát data (bez číslic)", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "invalid-date", weightKg: 80 })
    ).rejects.toThrow()
  })

  it("povolí validní datum YYYY-MM-DD", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.logBodyweight, { date: "2024-12-31", weightKg: 80 })
    ).resolves.not.toThrow()
  })
})

// ============================================================================
// athleteProfile.weight sync
// ============================================================================

describe("bodyweight.logBodyweight — atletický profil sync", () => {
  it("aktualizuje athleteProfile.weight při nejnovějším datu", async () => {
    const t = makeT()
    const userId = await seedUser(t, 80)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-06-01", weightKg: 85 })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.athleteProfile?.weight).toBe(85)
  })

  it("aktualizuje profil UPSERT (stejný den)", async () => {
    const t = makeT()
    const userId = await seedUser(t, 80)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-06-01", weightKg: 85 })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-06-01", weightKg: 86 })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    expect(user?.athleteProfile?.weight).toBe(86)
  })

  it("NEaktualizuje profil při starším datu (existuje novější log)", async () => {
    const t = makeT()
    const userId = await seedUser(t, 80)

    // Nejdříve zaloguj novější datum
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-06-10", weightKg: 88 })

    // Teď zaloguj starší datum — profil by se měl zachovat na 88
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-06-01", weightKg: 82 })

    const user = await t.run(async (ctx) => ctx.db.get(userId))
    // athleteProfile.weight musí zůstat 88 (novější log)
    expect(user?.athleteProfile?.weight).toBe(88)
  })
})

// ============================================================================
// getBodyweightHistory — řazení + cap
// ============================================================================

describe("bodyweight.getBodyweightHistory", () => {
  it("vrátí záznamy vzestupně dle data", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    // Vkládáme záměrně v obráceném pořadí
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-03", weightKg: 83 })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-01", weightKg: 81 })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-03-02", weightKg: 82 })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    expect(history).toHaveLength(3)
    expect(history[0].date).toBe("2024-03-01")
    expect(history[1].date).toBe("2024-03-02")
    expect(history[2].date).toBe("2024-03-03")
  })

  it("cap 730 záznamů — nevrátí více", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    // Vložíme 732 záznamů (2 navíc nad cap)
    await t.run(async (ctx) => {
      for (let i = 0; i < 732; i++) {
        const date = new Date("2020-01-01")
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split("T")[0]
        await ctx.db.insert("bodyweightLogs", {
          userId,
          date: dateStr,
          weightKg: 80 + (i % 5),
        })
      }
    })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    expect(history.length).toBe(730)
  })
})

// ============================================================================
// deleteBodyweightLog
// ============================================================================

describe("bodyweight.deleteBodyweightLog", () => {
  it("smaže existující záznam", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.logBodyweight, { date: "2024-04-01", weightKg: 82 })

    await t
      .withIdentity({ subject: userId })
      .mutation(api.bodyweight.deleteBodyweightLog, { date: "2024-04-01" })

    const history = await t
      .withIdentity({ subject: userId })
      .query(api.bodyweight.getBodyweightHistory, {})

    expect(history).toHaveLength(0)
  })

  it("vyhodí chybu pro neexistující záznam", async () => {
    const t = makeT()
    const userId = await seedUser(t)

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.bodyweight.deleteBodyweightLog, { date: "2024-04-01" })
    ).rejects.toThrow()
  })

  it("nepřihlášený uživatel nemůže smazat", async () => {
    const t = makeT()

    await expect(
      t.mutation(api.bodyweight.deleteBodyweightLog, { date: "2024-04-01" })
    ).rejects.toThrow()
  })

  it("smazání nejnovějšího logu resyncne athleteProfile.weight na předchozí log", async () => {
    const t = makeT()
    const userId = await seedUser(t, 80)
    const identity = t.withIdentity({ subject: userId })

    await identity.mutation(api.bodyweight.logBodyweight, { date: "2024-04-01", weightKg: 81 })
    await identity.mutation(api.bodyweight.logBodyweight, { date: "2024-04-10", weightKg: 84 })

    // Profil drží nejnovější váhu
    let user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.athleteProfile?.weight).toBe(84)

    // Smazání nejnovějšího logu → profil se vrátí na předchozí (81)
    await identity.mutation(api.bodyweight.deleteBodyweightLog, { date: "2024-04-10" })
    user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.athleteProfile?.weight).toBe(81)
  })

  it("smazání staršího logu athleteProfile.weight nemění", async () => {
    const t = makeT()
    const userId = await seedUser(t, 80)
    const identity = t.withIdentity({ subject: userId })

    await identity.mutation(api.bodyweight.logBodyweight, { date: "2024-04-01", weightKg: 81 })
    await identity.mutation(api.bodyweight.logBodyweight, { date: "2024-04-10", weightKg: 84 })

    await identity.mutation(api.bodyweight.deleteBodyweightLog, { date: "2024-04-01" })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.athleteProfile?.weight).toBe(84)
  })

  it("smazání jediného logu ponechá athleteProfile.weight (poslední známá váha)", async () => {
    const t = makeT()
    const userId = await seedUser(t, 80)
    const identity = t.withIdentity({ subject: userId })

    await identity.mutation(api.bodyweight.logBodyweight, { date: "2024-04-01", weightKg: 85 })
    await identity.mutation(api.bodyweight.deleteBodyweightLog, { date: "2024-04-01" })

    const user = await t.run(async (ctx) => await ctx.db.get(userId))
    expect(user?.athleteProfile?.weight).toBe(85)
  })
})
