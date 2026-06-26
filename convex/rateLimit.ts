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
