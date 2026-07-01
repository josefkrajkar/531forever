/**
 * OTP rate-limiting — ochrana před spamem OTP kódů.
 *
 * Limit: max 3 požadavků na e-mail za 10 minut (klouzavé okno).
 * Záznam v otpRateLimits se resetuje po uplynutí okna.
 *
 * Známé omezení: plus-aliasy (user+tag@example.com) nejsou záměrně blokovány —
 * adresa se normalizuje jen na lowercase+trim, ne na kanonický tvar bez tagu.
 */

import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { internalMutation } from "./_generated/server"

// Délka okna v ms (10 minut)
const OTP_WINDOW_MS = 10 * 60 * 1000
// Max počet OTP požadavků v okně
const OTP_MAX_COUNT = 3

// Délka okna pro přihlášení heslem v ms (15 minut)
const LOGIN_WINDOW_MS = 15 * 60 * 1000
// Max počet pokusů o přihlášení v okně (brute-force ochrana)
const LOGIN_MAX_COUNT = 10

/**
 * Atomicky zkontroluje a inkrementuje počet OTP požadavků pro daný e-mail.
 * Pokud byl limit překročen, hodí ConvexError.
 *
 * Počítá se jen jako „slot obsazen" — pokud odeslání následně selže,
 * zavolej rollbackOtpRateLimit pro dekrementaci.
 *
 * Volá se jako ctx.runMutation(internal.rateLimit.checkAndIncrementOtpRateLimit, { email }).
 *
 * Pozn.: mezi read a write existuje per-email race okno (P2, nízký dopad —
 * Convex mutace jsou serializovány per-document, souběžné požadavky na jiné
 * e-maily se navzájem neblokují).
 */
export const checkAndIncrementOtpRateLimit = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    // Email je již normalizován volajícím; normalizujeme znovu pro jistotu
    const normalizedEmail = args.email.toLowerCase().trim()

    const existing = await ctx.db
      .query("otpRateLimits")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first()

    if (!existing) {
      // První požadavek — vytvoř nový záznam
      await ctx.db.insert("otpRateLimits", {
        email: normalizedEmail,
        count: 1,
        windowStart: now,
      })
      return
    }

    const windowAge = now - existing.windowStart

    if (windowAge >= OTP_WINDOW_MS) {
      // Okno vypršelo — resetuj počítadlo
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
      })
      return
    }

    // Jsme v aktivním okně
    if (existing.count >= OTP_MAX_COUNT) {
      throw new ConvexError(
        "Příliš mnoho požadavků o kód. Zkus to za chvíli."
      )
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
    })
  },
})

/**
 * Dekrementuje počítadlo OTP požadavků o 1 pro daný e-mail.
 * Slouží jako rollback po selhání odeslání — aby neúspěšné odeslání
 * nepočítalo do rate-limit kvóty uživatele.
 *
 * No-op pokud záznam neexistuje nebo je count již 0.
 * Nikdy nesnižuje count pod 0.
 *
 * Volá se jako ctx.runMutation(internal.rateLimit.rollbackOtpRateLimit, { email }).
 */
export const rollbackOtpRateLimit = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim()

    const existing = await ctx.db
      .query("otpRateLimits")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first()

    if (!existing || existing.count <= 0) {
      // Záznam neexistuje nebo je count již 0 — nic k dekrementaci
      return
    }

    await ctx.db.patch(existing._id, {
      count: existing.count - 1,
    })
  },
})

/**
 * Brute-force ochrana pro přihlášení heslem.
 *
 * Atomicky zkontroluje a inkrementuje počet pokusů o přihlášení pro daný e-mail.
 * Pokud byl limit překročen (LOGIN_MAX_COUNT za LOGIN_WINDOW_MS), hodí ConvexError.
 *
 * Na rozdíl od OTP limitu se NErollbackuje — každý pokus (úspěšný i neúspěšný)
 * počítá, protože smyslem je omezit počet hádání hesla. Okno se resetuje po uplynutí,
 * takže legitimní uživatel s několika překlepy není trvale zablokován.
 *
 * Volá se z auth wrapperu pro `signIn` flow (viz convex/auth.ts):
 * ctx.runMutation(internal.rateLimit.checkAndIncrementLoginRateLimit, { email }).
 */
export const checkAndIncrementLoginRateLimit = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const normalizedEmail = args.email.toLowerCase().trim()

    const existing = await ctx.db
      .query("loginRateLimits")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first()

    if (!existing) {
      await ctx.db.insert("loginRateLimits", {
        email: normalizedEmail,
        count: 1,
        windowStart: now,
      })
      return
    }

    const windowAge = now - existing.windowStart

    if (windowAge >= LOGIN_WINDOW_MS) {
      // Okno vypršelo — resetuj počítadlo
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
      })
      return
    }

    if (existing.count >= LOGIN_MAX_COUNT) {
      throw new ConvexError(
        "Příliš mnoho pokusů o přihlášení. Zkus to za chvíli."
      )
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
    })
  },
})

/**
 * Vynuluje login rate-limit záznam pro daný e-mail smazáním řádku.
 *
 * Volá se po ÚSPĚŠNÉM přihlášení (viz convex/auth.ts) — aby pár překlepů před
 * úspěchem nezůstalo započítáno a zároveň aby se tabulka průběžně čistila.
 * No-op, pokud záznam neexistuje.
 */
export const resetLoginRateLimit = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim()

    const existing = await ctx.db
      .query("loginRateLimits")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
