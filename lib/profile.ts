/**
 * Shared profile helpers — canonical module for gender/experience types,
 * normalization functions, and locale-key mappers.
 *
 * IMPORTANT: This module is intentionally free of React, react-i18next, i18next,
 * and any browser API. It is safe to import from Convex/Node runtimes as well as
 * React Server Components.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stable enum for biological sex / gender stored in the DB. */
export type Gender = "male" | "female"

/** Stable enum for training experience level stored in the DB. */
export type ExperienceLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "competitive"

// ---------------------------------------------------------------------------
// normalizeGender
// ---------------------------------------------------------------------------

/**
 * Normalize a gender value to the stable enum.
 *
 * Handles legacy Czech strings stored before the i18n-stable enum was
 * introduced, as well as potential English strings. The "other" option was
 * removed from the UI; any legacy "other"/"Jiné" value (and every unknown
 * value) maps to "female" — which is also how "other" was always scored, so
 * this preserves existing users' Wilks/DOTS/standards results.
 */
export function normalizeGender(value: string | null | undefined): Gender {
  if (!value) return "female"
  const v = value.trim()
  // Stable enum — already normalized
  if (v === "male" || v === "female") return v
  // Legacy Czech
  if (v === "Muž") return "male"
  if (v === "Žena") return "female"
  // Possible English legacy (case-insensitive)
  if (v.toLowerCase() === "male") return "male"
  if (v.toLowerCase() === "female") return "female"
  // Legacy "other"/"Jiné" and any unknown value — default to "female"
  // (matches the historic scoring behaviour for "other")
  return "female"
}

// ---------------------------------------------------------------------------
// normalizeExperience
// ---------------------------------------------------------------------------

/**
 * Normalize a legacy (localized) experience string to the stable enum.
 *
 * Handles Czech strings stored before the i18n-stable enum was introduced
 * as well as English strings. Unknown values fall back to "intermediate".
 *
 * Czech legacy notes:
 * - "Závodní" and "Soutěžní" are both historic Czech labels for "competitive"
 *   (older UI used "Závodní", later changed to "Soutěžní"). Both are handled.
 */
export function normalizeExperience(
  value: string | null | undefined
): ExperienceLevel {
  if (!value) return "intermediate"
  const v = value.trim()
  // Already a stable enum value
  if (
    v === "beginner" ||
    v === "intermediate" ||
    v === "advanced" ||
    v === "competitive"
  )
    return v
  // Legacy Czech strings
  if (v.startsWith("Začátečník")) return "beginner"
  if (v.startsWith("Středně pokročilý")) return "intermediate"
  if (v.startsWith("Pokročilý")) return "advanced"
  // Both Czech legacy labels for competitive
  if (v.startsWith("Závodní") || v.startsWith("Soutěžní")) return "competitive"
  // Legacy English strings
  if (v.startsWith("Beginner")) return "beginner"
  if (v.startsWith("Intermediate")) return "intermediate"
  if (v.startsWith("Advanced")) return "advanced"
  if (v.startsWith("Competitive")) return "competitive"
  return "intermediate"
}

// ---------------------------------------------------------------------------
// Locale key mappers
// ---------------------------------------------------------------------------

/**
 * Map a raw gender value to its i18n key.
 *
 * Accepts raw `string | null | undefined` and normalizes via normalizeGender
 * internally, so callers can pass either an already-normalized Gender enum or
 * a legacy string — both are handled identically.
 */
export function genderLabelKey(value: string | null | undefined): string {
  const g = normalizeGender(value)
  return g === "male" ? "profile.genderMale" : "profile.genderFemale"
}

/**
 * Map a raw experience value to its i18n key.
 *
 * Accepts raw `string | null | undefined` and normalizes via
 * normalizeExperience internally.
 */
export function experienceLabelKey(value: string | null | undefined): string {
  const e = normalizeExperience(value)
  if (e === "beginner") return "profile.expBeginner"
  if (e === "intermediate") return "profile.expIntermediate"
  if (e === "advanced") return "profile.expAdvanced"
  return "profile.expCompetitive"
}
