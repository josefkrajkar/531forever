import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { normalizeGender, normalizeExperience } from "../lib/profile"

export const currentLoggedInUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    return await ctx.db.get(userId)
  },
})

export const updateAthleteProfile = mutation({
  args: {
    gender: v.string(),
    age: v.number(),
    height: v.number(),
    weight: v.number(),
    experience: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Validace vstupů
    if (!Number.isInteger(args.age) || args.age < 10 || args.age > 120) {
      throw new Error("Neplatný věk: musí být celé číslo od 10 do 120")
    }
    if (!Number.isFinite(args.height) || args.height <= 0 || args.height > 300) {
      throw new Error("Neplatná výška: musí být kladné číslo do 300 cm")
    }
    if (!Number.isFinite(args.weight) || args.weight <= 0 || args.weight > 500) {
      throw new Error("Neplatná váha: musí být kladné číslo do 500 kg")
    }

    // Normalize to stable enums — handles clients sending legacy localized strings
    // (old Czech/English values) as well as clients already sending enum values.
    const gender = normalizeGender(args.gender)
    const experience = normalizeExperience(args.experience)

    await ctx.db.patch(userId, {
      athleteProfile: {
        gender,
        age: args.age,
        height: args.height,
        weight: args.weight,
        experience,
      },
    })
    console.log("[users] athleteProfile updated for:", userId)
  },
})

