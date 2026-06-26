import { Email } from "@convex-dev/auth/providers/Email"
import { internal } from "./_generated/api"
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server"
import type { DataModel } from "./_generated/dataModel"

function generateOTP(length: number): string {
  const digits = "0123456789"
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (num) => digits[num % digits.length]).join("")
}

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return generateOTP(6)
  },
  // @convex-dev/auth předává ctx jako druhý argument (viz signIn.js, řádek s @ts-expect-error).
  // Auth.js typ deklaruje jen 1 parametr — překonáváme přes `unknown`.
  sendVerificationRequest: (async (
    { identifier: email, token }: { identifier: string; token: string; [key: string]: unknown },
    ctx: GenericActionCtxWithAuthConfig<DataModel>
  ) => {
    // Normalizace proběhne jednou zde a stejná hodnota se použije všude:
    // jako rate-limit klíč, pro rollback i v těle požadavku na OTP endpoint.
    // E-mailové adresy jsou case-insensitive (RFC 5321), lowercase+trim je bezpečný.
    const normalizedEmail = email.toLowerCase().trim()

    // Rate-limit kontrola: max 3 OTP požadavků na e-mail za 10 minut.
    // Slot se inkrementuje před odesláním; při selhání endpointu se rollbackuje.
    await ctx.runMutation(internal.rateLimit.checkAndIncrementOtpRateLimit, {
      email: normalizedEmail,
    })

    try {
      const response = await fetch(`${process.env.OTP_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          token,
          chatId: process.env.CHAT_ID,
          appName: process.env.APP_NAME || "Silový deník",
          secretKey: process.env.SECRET_KEY,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Vrátit Error (ne ConvexError) — klient tak rozliší selhání endpointu
        // od rate-limit zamítnutí (rate-limit = ConvexError s českou hláškou).
        throw new Error(errorData.error || "Failed to send verification email")
      }
    } catch (sendError) {
      // Odeslání selhalo — odvolej inkrementaci, aby uživatel nebyl penalizován
      // za kód, který nikdy nedoručíme.
      await ctx.runMutation(internal.rateLimit.rollbackOtpRateLimit, {
        email: normalizedEmail,
      })
      throw sendError
    }
  }) as unknown as Parameters<typeof Email>[0]["sendVerificationRequest"],
})
