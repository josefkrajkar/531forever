/**
 * Testy pro Convex rate-limit modul — login brute-force ochrana.
 *
 * Pokrývá checkAndIncrementLoginRateLimit:
 * - povolí až LOGIN_MAX_COUNT (10) pokusů, 11. vyhodí ConvexError
 * - normalizuje e-mail (lowercase + trim) → varianty sdílí jedno počítadlo
 * - resetuje počítadlo po uplynutí okna (15 min)
 */

import { convexTest } from "convex-test"
import { describe, it, expect } from "vitest"
import { ConvexError } from "convex/values"
import schema from "../../convex/schema"
import { internal } from "../../convex/_generated/api"

function makeT() {
  // @ts-expect-error import.meta.glob je Vite-specific
  return convexTest(schema, import.meta.glob("../../convex/**/*.*s"))
}

const LOGIN_MAX_COUNT = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

describe("checkAndIncrementLoginRateLimit", () => {
  it("povolí až 10 pokusů, 11. vyhodí ConvexError", async () => {
    const t = makeT()
    const email = "attacker@example.com"

    for (let i = 0; i < LOGIN_MAX_COUNT; i++) {
      await t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, {
        email,
      })
    }

    await expect(
      t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, { email }),
    ).rejects.toThrow(ConvexError)
  })

  it("normalizuje e-mail — varianty sdílí jedno počítadlo", async () => {
    const t = makeT()

    // 10 pokusů s různě formátovanou stejnou adresou
    const variants = [
      "User@Example.com",
      "  user@example.com  ",
      "USER@EXAMPLE.COM",
    ]
    for (let i = 0; i < LOGIN_MAX_COUNT; i++) {
      await t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, {
        email: variants[i % variants.length],
      })
    }

    // 11. pokus (opět jiná varianta) už musí být zablokován
    await expect(
      t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, {
        email: "user@example.com",
      }),
    ).rejects.toThrow(ConvexError)

    // Ověř že existuje jediný záznam
    const rows = await t.run(async (ctx) => ctx.db.query("loginRateLimits").collect())
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe("user@example.com")
  })

  it("resetuje počítadlo po uplynutí okna", async () => {
    const t = makeT()
    const email = "user@example.com"

    // Nasyp záznam s vyčerpaným limitem, ale prošlým oknem
    await t.run(async (ctx) => {
      await ctx.db.insert("loginRateLimits", {
        email,
        count: LOGIN_MAX_COUNT,
        windowStart: Date.now() - LOGIN_WINDOW_MS - 1000,
      })
    })

    // Další pokus nesmí selhat (okno vypršelo) a počítadlo se resetuje na 1
    await t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, {
      email,
    })

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("loginRateLimits")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first(),
    )
    expect(row?.count).toBe(1)
  })
})

describe("resetLoginRateLimit", () => {
  it("smaže záznam po úspěšném přihlášení a odemkne další pokusy", async () => {
    const t = makeT()
    const email = "user@example.com"

    // Vyčerpej limit
    for (let i = 0; i < LOGIN_MAX_COUNT; i++) {
      await t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, {
        email,
      })
    }
    // Reset (simuluje úspěšné přihlášení)
    await t.mutation(internal.rateLimit.resetLoginRateLimit, { email })

    // Záznam je pryč
    const rows = await t.run(async (ctx) =>
      ctx.db.query("loginRateLimits").collect(),
    )
    expect(rows).toHaveLength(0)

    // A další pokus opět projde (nezačíná na limitu)
    await expect(
      t.mutation(internal.rateLimit.checkAndIncrementLoginRateLimit, { email }),
    ).resolves.not.toThrow()
  })

  it("normalizuje e-mail a je no-op pro neexistující záznam", async () => {
    const t = makeT()
    // Nesmí vyhodit, i když žádný záznam neexistuje
    await expect(
      t.mutation(internal.rateLimit.resetLoginRateLimit, {
        email: "  Nobody@Example.com ",
      }),
    ).resolves.not.toThrow()
  })
})
