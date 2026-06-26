/**
 * Strength calculation utilities for powerlifting statistics
 * Includes: Wilks, DOTS, IPF GL Points, Bodyweight Multiples, Strength Standards
 */

// Wilks coefficients (2020 revision)
// Source: https://worldpowerlifting.com/wilks-formula/
const WILKS_MALE_COEFFICIENTS = {
  a: -216.0475144,
  b: 16.2606339,
  c: -0.002388645,
  d: -0.00113732,
  e: 7.01863e-6,
  f: -1.291e-8,
}

const WILKS_FEMALE_COEFFICIENTS = {
  a: 594.31747775582,
  b: -27.23842536447,
  c: 0.82112226871,
  d: -0.00930733913,
  e: 4.731582e-5,
  f: -9.054e-8,
}

// DOTS coefficients
// Source: https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf
const DOTS_MALE_COEFFICIENTS = {
  a: -307.75076,
  b: 24.0900756,
  c: -0.1918759221,
  d: 0.0007391293,
  e: -0.000001093,
}

const DOTS_FEMALE_COEFFICIENTS = {
  a: -57.96288,
  b: 13.6175032,
  c: -0.1126655495,
  d: 0.0005158568,
  e: -0.0000010706,
}

// IPF GL Points coefficients (for equipped/raw)
const IPF_GL_MALE_RAW = {
  a: 1199.72839,
  b: 1025.18162,
  c: 0.009210,
}

const IPF_GL_FEMALE_RAW = {
  a: 610.32796,
  b: 1045.59282,
  c: 0.03048,
}

// Import from canonical shared module for local use, then re-export so that
// existing importers of "@/lib/strength-calculations" continue to work
// without any changes.
import { type Gender, normalizeGender } from "./profile"
export { type Gender, normalizeGender }

export type StrengthLevelKey =
  | "strengthLevels.beginner"
  | "strengthLevels.novice"
  | "strengthLevels.intermediate"
  | "strengthLevels.advanced"
  | "strengthLevels.elite"

/**
 * Calculate Wilks points
 * @param total - Total weight lifted (SBD total or single lift)
 * @param bodyweight - Athlete bodyweight in kg
 * @param gender - "male" or "female" (or "other")
 */
export function calculateWilks(total: number, bodyweight: number, gender: Gender): number {
  if (bodyweight <= 0 || total <= 0) return 0

  // "other" uses female coefficients — this preserves the original behaviour where
  // anything other than the explicit male value fell back to female coefficients.
  const coef = gender === "male" ? WILKS_MALE_COEFFICIENTS : WILKS_FEMALE_COEFFICIENTS
  const bw = bodyweight
  
  const denominator = 
    coef.a +
    coef.b * bw +
    coef.c * Math.pow(bw, 2) +
    coef.d * Math.pow(bw, 3) +
    coef.e * Math.pow(bw, 4) +
    coef.f * Math.pow(bw, 5)
  
  if (denominator <= 0) return 0
  
  return Math.round((total * 500 / denominator) * 100) / 100
}

/**
 * Calculate DOTS points (newer formula, replacing Wilks in IPF)
 * @param total - Total weight lifted
 * @param bodyweight - Athlete bodyweight in kg
 * @param gender - "male" or "female" (or "other")
 */
export function calculateDOTS(total: number, bodyweight: number, gender: Gender): number {
  if (bodyweight <= 0 || total <= 0) return 0

  // "other" uses female coefficients — see calculateWilks for rationale.
  const coef = gender === "male" ? DOTS_MALE_COEFFICIENTS : DOTS_FEMALE_COEFFICIENTS
  const bw = bodyweight
  
  const denominator =
    coef.a +
    coef.b * bw +
    coef.c * Math.pow(bw, 2) +
    coef.d * Math.pow(bw, 3) +
    coef.e * Math.pow(bw, 4)
  
  if (denominator <= 0) return 0
  
  return Math.round((total * 500 / denominator) * 100) / 100
}

/**
 * Calculate IPF GL Points (Goodlift Points)
 * @param total - Total weight lifted
 * @param bodyweight - Athlete bodyweight in kg
 * @param gender - "male" or "female" (or "other")
 */
export function calculateIPFGL(total: number, bodyweight: number, gender: Gender): number {
  if (bodyweight <= 0 || total <= 0) return 0

  // "other" uses female coefficients — see calculateWilks for rationale.
  const coef = gender === "male" ? IPF_GL_MALE_RAW : IPF_GL_FEMALE_RAW
  
  const denominator = coef.a - coef.b * Math.exp(-coef.c * bodyweight)
  
  if (denominator <= 0) return 0
  
  return Math.round((total * 100 / denominator) * 100) / 100
}

/**
 * Calculate bodyweight multiple
 * @param weight - Weight lifted
 * @param bodyweight - Athlete bodyweight
 */
export function calculateBWMultiple(weight: number, bodyweight: number): number {
  if (bodyweight <= 0 || weight <= 0) return 0
  return Math.round((weight / bodyweight) * 100) / 100
}

// Strength standards based on bodyweight multiples
// Sources: Symmetric Strength, Strength Level, ExRx
export type StrengthLevel = StrengthLevelKey

interface StrengthStandard {
  level: StrengthLevelKey
  minMultiple: number
  color: string
  description: string
}

// Standards as BW multiples for each lift
const MALE_STANDARDS: Record<string, StrengthStandard[]> = {
  squat: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 1.0, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 1.5, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 2.0, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 2.5, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
  bench: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 0.75, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 1.0, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 1.5, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 2.0, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
  deadlift: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 1.25, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 1.75, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 2.25, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 2.75, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
  press: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 0.5, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 0.75, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 1.0, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 1.25, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
}

const FEMALE_STANDARDS: Record<string, StrengthStandard[]> = {
  squat: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 0.75, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 1.0, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 1.5, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 2.0, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
  bench: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 0.5, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 0.75, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 1.0, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 1.25, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
  deadlift: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 1.0, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 1.25, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 1.75, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 2.25, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
  press: [
    { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" },
    { level: "strengthLevels.novice", minMultiple: 0.35, color: "#22c55e", description: "strengthLevels.novice_desc" },
    { level: "strengthLevels.intermediate", minMultiple: 0.5, color: "#3b82f6", description: "strengthLevels.intermediate_desc" },
    { level: "strengthLevels.advanced", minMultiple: 0.75, color: "#a855f7", description: "strengthLevels.advanced_desc" },
    { level: "strengthLevels.elite", minMultiple: 1.0, color: "#f59e0b", description: "strengthLevels.elite_desc" },
  ],
}

/**
 * Get strength level for a lift
 * @param lift - "squat", "bench", "deadlift", or "press"
 * @param weight - Weight lifted (e1RM)
 * @param bodyweight - Athlete bodyweight
 * @param gender - "male" or "female" (or "other")
 *
 * Poznámka: pro neznámý lift se vrací standardy pro dřep jako neutrální fallback.
 * To zajišťuje, že funkce nikdy nevyhodí chybu, ale hodnota může být zavádějící —
 * volající by měl předávat pouze validní lift ("squat"|"bench"|"deadlift"|"press").
 */
export function getStrengthLevel(
  lift: string,
  weight: number,
  bodyweight: number,
  gender: Gender
): StrengthStandard {
  if (bodyweight <= 0 || weight <= 0) {
    return { level: "strengthLevels.beginner", minMultiple: 0, color: "#6b7280", description: "strengthLevels.beginner_desc" }
  }

  const multiple = weight / bodyweight
  // "other" uses female standards — see calculateWilks for rationale.
  const standards = gender === "male" ? MALE_STANDARDS : FEMALE_STANDARDS
  // Neznámý lift: fallback na dřep standardy (bezpečný neutrální výběr)
  const liftStandards = standards[lift] ?? standards.squat
  
  // Find highest matching level
  let result = liftStandards[0]
  for (const standard of liftStandards) {
    if (multiple >= standard.minMultiple) {
      result = standard
    }
  }
  
  return result
}

/**
 * Get all strength standards for a lift (for progress bar display)
 */
export function getStrengthStandards(lift: string, gender: Gender): StrengthStandard[] {
  // "other" uses female standards — see calculateWilks for rationale.
  const standards = gender === "male" ? MALE_STANDARDS : FEMALE_STANDARDS
  return standards[lift] || standards.squat
}

/**
 * Calculate SBD total from e1RMs
 */
export function calculateTotal(squat: number, bench: number, deadlift: number): number {
  return squat + bench + deadlift
}

/**
 * Wilks benchmark descriptions
 * Returns an i18n key — caller must pass through t() to get the translated string.
 */
export function getWilksDescription(wilks: number): string {
  if (wilks >= 500) return "wilks.world_class"
  if (wilks >= 450) return "wilks.elite"
  if (wilks >= 400) return "wilks.advanced_competitor"
  if (wilks >= 350) return "wilks.intermediate"
  if (wilks >= 300) return "wilks.solid_base"
  if (wilks >= 250) return "wilks.advanced_beginner"
  return "wilks.beginner"
}

/**
 * Estimate 1RM from weight and reps (Epley formula)
 */
export function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

// LIFT_NAMES_CZ removed — use t(`lifts.${lift}`) in client components.
// The keys lifts.squat / lifts.bench / lifts.deadlift / lifts.press already exist in common.json.
