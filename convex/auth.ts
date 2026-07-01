import { convexAuth } from "@convex-dev/auth/server"
import type { GenericActionCtx } from "convex/server"
import { ResendOTP } from "./ResendOTP"
import { Password } from "@convex-dev/auth/providers/Password"
import { internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"

/**
 * Password provider s vlastní brute-force ochranou přihlášení (per e-mail).
 *
 * Proč vlastní vrstva, když @convex-dev/auth už jeden rate limiter má?
 * Vestavěný limiter (tabulka `authRateLimits`) je klíčovaný podle `authAccounts._id`,
 * takže se aktivuje jen pro EXISTUJÍCÍ účty — přihlašovací pokusy proti neexistujícím
 * e-mailům (credential-stuffing / enumerace) jím nejsou nijak omezeny. Náš wrapper
 * běží PŘED dohledáním účtu a limituje podle e-mailu, čímž tuto mezeru pokrývá.
 *
 * Mechanika obalení: @convex-dev/auth nemá veřejný "onSignInAttempt" hook, ale
 * `Password()` interně vrací `ConvexCredentials`, kde skutečná `authorize` funkce žije
 * v `.options.authorize` (materializace pak provede `merge(provider, provider.options)`,
 * viz provider_utils.js). Obalíme ji: pro `signIn` flow nejprve zkontrolujeme rate limit,
 * poté deleguji na originální `authorize`, a při úspěchu čítač vynuluji. Žádná logika
 * auth se nereimplementuje. OTP flow (ResendOTP) je rate-limitovaný zvlášť.
 */
const passwordProvider = Password({ reset: ResendOTP, verify: ResendOTP })

// `options` je interní pole knihovny (viz @ts-expect-error v ConvexCredentials) —
// přistupujeme přes cast na tvar, který runtime skutečně vrací.
const providerOptions = (
  passwordProvider as unknown as {
    options: {
      authorize: (
        params: Record<string, unknown>,
        ctx: GenericActionCtx<DataModel>,
      ) => Promise<unknown>
    }
  }
).options

const originalAuthorize = providerOptions.authorize

// Fail-fast, kdyby budoucí verze @convex-dev/auth přejmenovala/přesunula options.authorize —
// ať se breaking change projeví srozumitelnou chybou při deployi/testech, ne tichým výpadkem ochrany.
if (typeof originalAuthorize !== "function") {
  throw new Error(
    "@convex-dev/auth Password provider změnil tvar: options.authorize není funkce. " +
      "Rate-limit wrapper v convex/auth.ts je potřeba aktualizovat.",
  )
}

providerOptions.authorize = async (params, ctx) => {
  const email =
    typeof params.email === "string" ? params.email.toLowerCase().trim() : null
  const isSignIn = params.flow === "signIn" && email !== null && email.length > 0

  if (isSignIn) {
    // Vyhodí ConvexError při překročení limitu — přeruší přihlášení před ověřením hesla.
    await ctx.runMutation(internal.rateLimit.checkAndIncrementLoginRateLimit, {
      email: email!,
    })
  }

  const result = await originalAuthorize(params, ctx)

  // Úspěšné přihlášení → vynuluj čítač, ať pár překlepů před úspěchem nezůstane
  // započítáno v okně. Při chybném heslu originalAuthorize vyhodí a sem se nedostaneme,
  // takže neúspěšné pokusy se korektně počítají dál.
  if (isSignIn && result) {
    await ctx.runMutation(internal.rateLimit.resetLoginRateLimit, {
      email: email!,
    })
  }

  return result
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendOTP, passwordProvider],
})
