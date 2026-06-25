/**
 * 5/3/1 Program Calculator
 * 
 * Deterministic calculation of training weights based on Training Max (TM)
 * and current week in the cycle.
 * 
 * Updated for 5/3/1 Forever: Leader/Anchor system with multiple templates.
 */

import {
  SupplementalTemplate,
  ProgramPhase,
  SeventhWeekType,
  TEMPLATES,
  PHASES,
  SEVENTH_WEEK_PROTOCOLS,
  getSupplementalWeight,
} from "./templates"
import { estimateE1RM as estimateE1RMFromCalc } from "./strength-calculations"

// Re-export template types for convenience
export type { SupplementalTemplate, ProgramPhase, SeventhWeekType }

// Lift types
export type Lift = "squat" | "bench" | "deadlift" | "press"

// Wave definitions: [percentage of TM, target reps]
// "+" suffix indicates AMRAP (As Many Reps As Possible)
// Now 3-week cycles (no automatic deload week - handled by 7th Week Protocol)
const WAVES: Record<number, [number, string][]> = {
  1: [[0.65, "5"], [0.75, "5"], [0.85, "5+"]], // Week 1: 5/5/5+
  2: [[0.70, "3"], [0.80, "3"], [0.90, "3+"]], // Week 2: 3/3/3+
  3: [[0.75, "5"], [0.85, "3"], [0.95, "1+"]], // Week 3: 5/3/1+
}

// BBB (Boring But Big) supplemental: 5x10 @ 50% TM
const BBB_SETS = 5
const BBB_REPS = 10
const BBB_PERCENTAGE = 0.50

// Default increments per cycle
export const DEFAULT_INCREMENTS = {
  squat: 5,      // +5 kg for lower body
  bench: 2.5,    // +2.5 kg for upper body
  deadlift: 5,
  press: 2.5,
}

// Plate rounding
export const DEFAULT_ROUNDING = 2.5

// Minimum TM can never go below empty bar
export const BAR_WEIGHT = 20 // kg

/**
 * Round weight to nearest plate increment
 * Guard: pokud je step neplatný (0, záporný, NaN, Infinity), vrátí kg beze změny.
 */
export function roundToPlate(kg: number, step = DEFAULT_ROUNDING): number {
  if (!Number.isFinite(step) || step <= 0) return kg
  return Math.round(kg / step) * step
}

/**
 * Epley formula for estimating 1RM from weight × reps
 * 1RM ≈ weight × (1 + reps/30)
 *
 * Kanonická implementace žije v strength-calculations.ts (zaokrouhluje na celé kg,
 * guardy: weight <= 0 || reps <= 0 → vrací 0). Tato funkce je re-export pro
 * zpětnou kompatibilitu a zachování jediného zdroje pravdy.
 */
export function estimateE1RM(weight: number, reps: number): number {
  return estimateE1RMFromCalc(weight, reps)
}

/**
 * Calculate conservative starting TM from calibration set
 * TM = 90% of e1RM × 90% (extra safety for new program)
 */
export function calibrateStartTM(
  topSet: { weight: number; reps: number },
  rounding = DEFAULT_ROUNDING
): number {
  const e1rm = estimateE1RM(topSet.weight, topSet.reps)
  const tm = e1rm * 0.9 * 0.9 // = 0.81 × e1RM (conservative start)
  return roundToPlate(tm, rounding)
}

/**
 * Calculate TM after successful cycle (normal progression)
 * TM = 90% of e1RM from best AMRAP
 */
export function calculateTMFromAmrap(
  weight: number,
  reps: number,
  rounding = DEFAULT_ROUNDING
): number {
  const e1rm = estimateE1RM(weight, reps)
  const tm = e1rm * 0.9
  return roundToPlate(tm, rounding)
}

export interface MainSet {
  weight: number
  targetReps: number
  isAmrap: boolean
  percentage: number
  isAllOutAmrap?: boolean  // Anchor phase: go for PR
}

export interface BBBSet {
  weight: number
  reps: number
}

export interface DailyWorkout {
  lift: Lift
  liftDisplayName: string
  week: number
  cycle: number
  mainSets: MainSet[]
  bbbSets: BBBSet[]
  totalSets: number
}

// Extended workout for 5/3/1 Forever with template support
export interface ForeverDailyWorkout extends DailyWorkout {
  phase: ProgramPhase
  phaseWeek: number
  supplementalTemplate: SupplementalTemplate
  supplementalSets: SupplementalSet[]
  isSeventhWeek: boolean
  amrapStyle: "conservative" | "all_out"
}

export interface SupplementalSet {
  weight: number
  reps: number
  percentage: number
}

/**
 * Get i18n key for lift display name.
 * Consumer calls t(getLiftDisplayName(lift)).
 */
export function getLiftDisplayName(lift: Lift): string {
  return `lifts.${lift}`
}

/**
 * Build main working sets for a given TM and week
 *
 * @param tm Training Max
 * @param week Week number (1-3)
 * @param rounding Plate rounding
 * @param phase Optional phase for AMRAP behavior
 */
export function buildMainSets(
  tm: number,
  week: number,
  rounding = DEFAULT_ROUNDING,
  phase?: ProgramPhase
): MainSet[] {
  const wave = WAVES[week]
  if (!wave) {
    console.error("[531] Invalid week:", week)
    return []
  }

  // In Anchor phase, all AMRAP sets are "all out"
  // In Leader phase, AMRAP sets are "conservative" (not tracked differently in data, but UI hint)
  const isAnchorPhase = phase === "anchor"

  return wave.map(([pct, repsStr]) => ({
    weight: roundToPlate(tm * pct, rounding),
    targetReps: parseInt(repsStr.replace("+", "")),
    isAmrap: repsStr.includes("+"),
    percentage: Math.round(pct * 100),
    // Additional flag for UI hints (not stored, just for display)
    ...(isAnchorPhase && repsStr.includes("+") ? { isAllOutAmrap: true } : {}),
  }))
}

/**
 * Build BBB supplemental sets (5x10 @ 50%)
 */
export function buildBBBSets(
  tm: number,
  rounding = DEFAULT_ROUNDING
): BBBSet[] {
  const weight = roundToPlate(tm * BBB_PERCENTAGE, rounding)
  // Array.from zajistí, že každý set je samostatný objekt (ne sdílená reference)
  return Array.from({ length: BBB_SETS }, () => ({ weight, reps: BBB_REPS }))
}

/**
 * Build complete daily workout for 5/3/1 Forever
 * Supports Leader/Anchor phases and multiple supplemental templates
 */
export function buildDailyWorkoutForever(
  trainingMaxes: Record<Lift, number | undefined>,
  split: string[],
  week: number,  // 1-3 within cycle
  cycle: number,
  dayIndex: number,
  phase: ProgramPhase,
  phaseWeek: number,
  supplementalTemplate: SupplementalTemplate,
  rounding = DEFAULT_ROUNDING
): ForeverDailyWorkout | null {
  const liftKey = split[dayIndex] as Lift
  if (!liftKey) {
    console.error("[531] Invalid dayIndex:", dayIndex, "split:", split)
    return null
  }

  const tm = trainingMaxes[liftKey]
  if (!tm) {
    console.error("[531] No TM for lift:", liftKey)
    return null
  }

  const phaseConfig = PHASES[phase]
  const templateConfig = TEMPLATES[supplementalTemplate]
  
  // Check if this is 7th week
  const isSeventhWeek = phase === "seventh_week"
  
  // Build main sets (no AMRAP during 7th week)
  let mainSets: MainSet[]
  if (isSeventhWeek) {
    // 7th week uses special protocol - handled separately
    mainSets = []
  } else {
    mainSets = buildMainSets(tm, week, rounding, phase)
  }

  // Build supplemental sets based on template
  let supplementalSets: SupplementalSet[] = []
  if (!isSeventhWeek) {
    const supplementalWeight = getSupplementalWeight(supplementalTemplate, week, tm, rounding)
    const percent = typeof templateConfig.percentOfTM === "function"
      ? templateConfig.percentOfTM(week)
      : templateConfig.percentOfTM
    
    supplementalSets = Array(templateConfig.sets).fill(null).map(() => ({
      weight: supplementalWeight,
      reps: templateConfig.reps,
      percentage: Math.round(percent * 100),
    }))
  }

  // Convert supplemental sets to BBB format for backwards compatibility
  const bbbSets: BBBSet[] = supplementalSets.map(s => ({
    weight: s.weight,
    reps: s.reps,
  }))

  return {
    lift: liftKey,
    liftDisplayName: getLiftDisplayName(liftKey),
    week,
    cycle,
    mainSets,
    bbbSets,
    totalSets: mainSets.length + supplementalSets.length,
    // Forever-specific
    phase,
    phaseWeek,
    supplementalTemplate,
    supplementalSets,
    isSeventhWeek,
    amrapStyle: phaseConfig.amrapStyle,
  }
}

/**
 * Build 7th Week Protocol workout
 */
export function buildSeventhWeekWorkout(
  trainingMaxes: Record<Lift, number | undefined>,
  split: string[],
  dayIndex: number,
  seventhWeekType: SeventhWeekType,
  rounding = DEFAULT_ROUNDING
): { lift: Lift; liftDisplayName: string; sets: MainSet[]; isTMTest: boolean } | null {
  const liftKey = split[dayIndex] as Lift
  if (!liftKey) return null

  const tm = trainingMaxes[liftKey]
  if (!tm) return null

  const protocol = SEVENTH_WEEK_PROTOCOLS[seventhWeekType]
  
  const sets: MainSet[] = protocol.sets.map((s, idx) => ({
    weight: roundToPlate(tm * s.percent, rounding),
    targetReps: s.reps,
    isAmrap: seventhWeekType === "tm_test" && idx === protocol.sets.length - 1,
    percentage: Math.round(s.percent * 100),
  }))

  return {
    lift: liftKey,
    liftDisplayName: getLiftDisplayName(liftKey),
    sets,
    isTMTest: seventhWeekType === "tm_test",
  }
}

/**
 * Default split for 5/3/1 (4 days)
 */
export const DEFAULT_SPLIT: Lift[] = ["squat", "bench", "deadlift", "press"]

/**
 * Check if a cycle is complete (all 4 weeks done)
 * Legacy function for backwards compatibility
 */
export function isCycleComplete(week: number, dayIndex: number): boolean {
  return week === 4 && dayIndex === 3 // After last day of deload week
}

/**
 * Check if a 3-week cycle is complete (5/3/1 Forever)
 */
export function isCycleCompleteForever(week: number, dayIndex: number): boolean {
  return week === 3 && dayIndex === 3 // After last day of week 3
}

/**
 * Advance to next training day (legacy 4-week cycles)
 * Returns { week, dayIndex, cycle } for new position
 */
export function advanceDay(
  week: number,
  dayIndex: number,
  cycle: number
): { week: number; dayIndex: number; cycle: number } {
  const newDayIndex = (dayIndex + 1) % 4
  
  if (newDayIndex === 0) {
    // Completed all 4 days this week, advance week
    const newWeek = (week % 4) + 1
    
    if (newWeek === 1) {
      // Completed week 4, start new cycle
      return { week: 1, dayIndex: 0, cycle: cycle + 1 }
    }
    
    return { week: newWeek, dayIndex: 0, cycle }
  }
  
  return { week, dayIndex: newDayIndex, cycle }
}

/**
 * Advance to next training day (5/3/1 Forever 3-week cycles)
 * Returns { week, dayIndex, cycle, cycleComplete } for new position
 */
export function advanceDayForever(
  week: number,
  dayIndex: number,
  cycle: number
): { week: number; dayIndex: number; cycle: number; cycleComplete: boolean } {
  const newDayIndex = (dayIndex + 1) % 4
  
  if (newDayIndex === 0) {
    // Completed all 4 days this week, advance week
    const newWeek = (week % 3) + 1  // 3-week cycles
    
    if (newWeek === 1) {
      // Completed week 3, start new cycle
      return { week: 1, dayIndex: 0, cycle: cycle + 1, cycleComplete: true }
    }
    
    return { week: newWeek, dayIndex: 0, cycle, cycleComplete: false }
  }
  
  return { week, dayIndex: newDayIndex, cycle, cycleComplete: false }
}

// ============================================================================
// SERVER-SIDE CYCLE PROGRESSION (single source of truth)
// ============================================================================

/**
 * Summary of TM progression applied for one lift after completing a cycle.
 */
export interface LiftProgressionSummary {
  lift: Lift
  action: ProgressionAction
  reason: ProgressionReason
  oldTM: number
  newTM: number
  change: number
  reps?: number
}

/**
 * Full summary returned by completeWorkout when a cycle is closed.
 * Carries all data the CycleReviewModal needs — no extra Convex queries required.
 */
export interface CycleProgressionSummary {
  completedCycle: number
  lifts: LiftProgressionSummary[]
  newTrainingMaxes: Record<Lift, number>
  updatedMisses: Record<Lift, number>
  updatedE1rmHistory: Record<Lift, number[]>
}

/**
 * Apply cycle progression for all lifts atomically.
 *
 * Pravidla (Wendler 5/3/1 Forever, doménové rozhodnutí):
 * - TM se zvyšuje po KAŽDÉM dokončeném 3týdenním cyklu (leader i anchor) se splněnými AMRAP cíli.
 * - Modulace výkonem: PROGRESS při splnění, HOLD při prvním missu, RESET při opakovaném missu.
 * - Tato funkce se volá výhradně server-side uvnitř completeWorkout, atomicky se posunem pozice.
 * - 7th week NIKDY neaplikuje další zvýšení TM (volající přeskočí tuto funkci).
 *
 * @param state       Aktuální stav programu (TM, incrementy, missy, e1rmHistory, rounding)
 * @param amrapResults Pole všech AMRAP výsledků pro právě dokončený cyklus
 * @param completedCycle Číslo dokončeného cyklu (pro popis v summary)
 * @returns CycleProgressionSummary s novými TM a aktualizovaným stavem
 */
export function applyCycleProgression(
  state: ProgressionState,
  amrapResults: Array<{
    lift: string
    weight: number
    targetReps: number
    actualReps: number
    week: number
    autoregulated?: boolean
  }>,
  completedCycle: number
): CycleProgressionSummary {
  // Najdi week-3 top set pro každý lift (kanonický signál progrese)
  const week3Results: Partial<Record<Lift, Week3TopSet | null>> = {}
  for (const lift of DEFAULT_SPLIT) {
    const amrap = amrapResults.find((a) => a.lift === lift && a.week === 3)
    if (amrap) {
      week3Results[lift] = {
        weight: amrap.weight,
        repsAchieved: amrap.actualReps,
        autoregulated: amrap.autoregulated || false,
        week: 3,
      }
    } else {
      week3Results[lift] = null
    }
  }

  const { progressions, updatedMisses, updatedE1rmHistory } =
    calculateCycleProgressions(state, week3Results)

  const newTrainingMaxes: Record<Lift, number> = { ...state.trainingMaxes }
  const lifts: LiftProgressionSummary[] = []

  for (const p of progressions) {
    newTrainingMaxes[p.lift] = p.newTM
    lifts.push({
      lift: p.lift,
      action: p.action,
      reason: p.reason,
      oldTM: p.currentTM,
      newTM: p.newTM,
      change: p.change,
      reps: p.reps,
    })
  }

  return {
    completedCycle,
    lifts,
    newTrainingMaxes,
    updatedMisses,
    updatedE1rmHistory,
  }
}

// ============================================================================
// INTER-CYCLE PROGRESSION ALGORITHM
// ============================================================================

/**
 * Progression action types
 */
export type ProgressionAction = "PROGRESS" | "HOLD" | "RESET"

/**
 * Reason for progression decision
 */
export type ProgressionReason = 
  | "standard"           // Hit minimum, normal increment
  | "no_clean_signal"    // Missing or autoregulated data
  | "first_miss"         // First missed minimum
  | "repeated_miss"      // Second consecutive miss → reset
  | "e1rm_stall"         // e1RM not improving (optional detection)

/**
 * Week 3 top set data (input for progression)
 *
 * Pole `week` udává, z jakého týdne AMRAP pochází (1=5+, 2=3+, 3=1+).
 * Výchozí hodnota je 3, protože progrese standardně stojí na týdnu 3.
 */
export interface Week3TopSet {
  weight: number
  repsAchieved: number
  autoregulated: boolean
  week?: number  // týden AMRAP setu (1-3); výchozí 3
}

/**
 * Result of progression decision for one lift
 */
export interface ProgressionResult {
  lift: Lift
  action: ProgressionAction
  reason: ProgressionReason
  currentTM: number
  newTM: number
  change: number
  e1rm?: number
  reps?: number
}

/**
 * State needed for progression calculation
 */
export interface ProgressionState {
  trainingMaxes: Record<Lift, number>
  increments: Record<Lift, number>
  misses: Record<Lift, number>        // consecutive miss counter
  e1rmHistory: Record<Lift, number[]> // chronological e1RM from clean week-3 sets
  rounding: number
}

/**
 * Detect e1RM stalling: no new max in last 3 cycles
 */
export function isStalling(history: number[]): boolean {
  if (history.length < 3) return false
  const now = history[history.length - 1]
  const prev = history[history.length - 2]
  const prev2 = history[history.length - 3]
  // No new maximum two cycles in a row
  return now <= prev && now <= prev2
}

/**
 * Decide progression for one lift based on week-3 top set
 * 
 * Rules:
 * 1. No clean signal (missing or autoregulated) → HOLD
 * 2. Missed minimum reps → increment miss counter
 *    - First miss → HOLD
 *    - Second consecutive miss → RESET (0.9 × TM)
 * 3. Hit minimum → reset miss counter, PROGRESS (standard increment)
 *    - Optional: if e1RM is stalling → HOLD instead
 */
export function decideProgression(
  lift: Lift,
  week3TopSet: Week3TopSet | null | undefined,
  state: ProgressionState
): { result: ProgressionResult; updatedMisses: number; updatedE1rmHistory: number[] } {
  const currentTM = state.trainingMaxes[lift]
  const increment = state.increments[lift]
  let misses = state.misses[lift]
  let e1rmHistory = [...state.e1rmHistory[lift]]
  
  // 1. No clean signal → HOLD
  if (!week3TopSet || week3TopSet.autoregulated) {
    return {
      result: {
        lift,
        action: "HOLD",
        reason: "no_clean_signal",
        currentTM,
        newTM: currentTM,
        change: 0,
      },
      updatedMisses: misses,
      updatedE1rmHistory: e1rmHistory,
    }
  }

  const { weight, repsAchieved } = week3TopSet

  // Minimální počet opakování pro "splněno" odpovídá cílovému počtu reps daného AMRAP setu.
  // Wendler: týden 1 = 5+, týden 2 = 3+, týden 3 = 1+
  // Nesplnění cílového počtu (pod target) = miss.
  // Výchozí je týden 3 (minReps=1) pro zpětnou kompatibilitu s dosavadní logikou.
  const amrapWeek = week3TopSet.week ?? 3
  const AMRAP_MIN_REPS: Record<number, number> = { 1: 5, 2: 3, 3: 1 }
  const minReps = AMRAP_MIN_REPS[amrapWeek] ?? 1

  const e1rm = estimateE1RM(weight, repsAchieved)

  // 2. Missed minimum — repsAchieved musí splnit alespoň cílový počet pro daný týden
  if (repsAchieved < minReps) {
    misses += 1
    
    if (misses >= 2) {
      // RESET at second consecutive miss
      misses = 0
      let newTM = roundToPlate(currentTM * 0.9, state.rounding)
      newTM = Math.max(newTM, BAR_WEIGHT) // Never below empty bar
      
      return {
        result: {
          lift,
          action: "RESET",
          reason: "repeated_miss",
          currentTM,
          newTM,
          change: newTM - currentTM,
          reps: repsAchieved,
        },
        updatedMisses: misses,
        updatedE1rmHistory: e1rmHistory,
      }
    } else {
      // First miss → HOLD
      return {
        result: {
          lift,
          action: "HOLD",
          reason: "first_miss",
          currentTM,
          newTM: currentTM,
          change: 0,
          reps: repsAchieved,
        },
        updatedMisses: misses,
        updatedE1rmHistory: e1rmHistory,
      }
    }
  }

  // 3. Hit minimum → reset miss counter
  misses = 0
  e1rmHistory.push(e1rm)
  
  // Keep only last 10 entries
  if (e1rmHistory.length > 10) {
    e1rmHistory = e1rmHistory.slice(-10)
  }

  // Optional: check for stalling
  if (isStalling(e1rmHistory)) {
    return {
      result: {
        lift,
        action: "HOLD",
        reason: "e1rm_stall",
        currentTM,
        newTM: currentTM,
        change: 0,
        e1rm,
        reps: repsAchieved,
      },
      updatedMisses: misses,
      updatedE1rmHistory: e1rmHistory,
    }
  }

  // Standard progression
  const newTM = roundToPlate(currentTM + increment, state.rounding)
  
  return {
    result: {
      lift,
      action: "PROGRESS",
      reason: "standard",
      currentTM,
      newTM,
      change: newTM - currentTM,
      e1rm,
      reps: repsAchieved,
    },
    updatedMisses: misses,
    updatedE1rmHistory: e1rmHistory,
  }
}

/**
 * Calculate progressions for all lifts after week 3
 * 
 * @param state Current program state
 * @param week3Results Map of lift → week 3 top set data
 * @returns Array of progression results and updated state
 */
export function calculateCycleProgressions(
  state: ProgressionState,
  week3Results: Partial<Record<Lift, Week3TopSet | null>>
): {
  progressions: ProgressionResult[]
  updatedMisses: Record<Lift, number>
  updatedE1rmHistory: Record<Lift, number[]>
} {
  const progressions: ProgressionResult[] = []
  const updatedMisses = { ...state.misses }
  const updatedE1rmHistory: Record<Lift, number[]> = {
    squat: [...state.e1rmHistory.squat],
    bench: [...state.e1rmHistory.bench],
    deadlift: [...state.e1rmHistory.deadlift],
    press: [...state.e1rmHistory.press],
  }

  for (const lift of DEFAULT_SPLIT) {
    const topSet = week3Results[lift]
    const { result, updatedMisses: newMisses, updatedE1rmHistory: newHistory } = 
      decideProgression(lift, topSet, {
        ...state,
        misses: { ...state.misses, [lift]: updatedMisses[lift] },
        e1rmHistory: { ...state.e1rmHistory, [lift]: updatedE1rmHistory[lift] },
      })
    
    progressions.push(result)
    updatedMisses[lift] = newMisses
    updatedE1rmHistory[lift] = newHistory
  }

  return { progressions, updatedMisses, updatedE1rmHistory }
}

/**
 * Get i18n key for week name.
 * Consumer calls t(getWeekName(week, isSeventhWeek)).
 */
export function getWeekName(week: number, isSeventhWeek = false): string {
  if (isSeventhWeek) {
    return "weeks.seventh"
  }
  const keys: Record<number, string> = {
    1: "weeks.1",
    2: "weeks.2",
    3: "weeks.3",
  }
  return keys[week] || "weeks.unknown"
}

/**
 * Get i18n key for phase name.
 * Consumer calls t(getPhaseName(phase)).
 */
export function getPhaseName(phase: ProgramPhase): string {
  return `program.phases.${phase}`
}

/**
 * Get i18n key for supplemental template name.
 * Consumer calls t(getTemplateName(template)).
 */
export function getTemplateName(template: SupplementalTemplate): string {
  return `templates.${template}.name`
}

/**
 * Get i18n key for supplemental template short description.
 * Consumer calls t(getTemplateDescription(template)).
 */
export function getTemplateDescription(template: SupplementalTemplate): string {
  return `templates.${template}.shortDescription`
}

/**
 * Get day name in Czech (which lift)
 */
export function getDayName(dayIndex: number, split: string[]): string {
  const lift = split[dayIndex] as Lift
  return getLiftDisplayName(lift)
}

// ============================================================================
// ACCESSORY DOUBLE PROGRESSION
// ============================================================================

/**
 * Double progression scheme: increase reps within range, then add weight
 * 
 * Example: 3×8-12 @ 20kg
 * - Start: 3×8 @ 20kg
 * - Progress reps: 3×9, 3×10, 3×11, 3×12
 * - When all sets hit 12 reps: bump to 3×8 @ 22.5kg (or +5kg depending on exercise)
 */

export interface AccessoryScheme {
  sets: number
  minReps: number
  maxReps: number
  weight: number
  increment: number  // weight to add when progressing
}

export interface AccessorySetLog {
  weight: number
  reps: number
  completed: boolean
}

export interface AccessoryProgressionResult {
  shouldProgress: boolean
  newWeight: number
  targetReps: number  // will be minReps after weight bump
  reason: "bump_weight" | "bump_reps" | "stay" | "first_session"
}

/**
 * Calculate next session targets based on previous performance
 * 
 * Rules:
 * 1. First session (no history) → start at minReps
 * 2. All completed sets >= maxReps → bump weight, reset to minReps
 * 3. All completed sets >= previous target → bump target reps by 1
 * 4. Otherwise → stay at same target
 */
export function calculateAccessoryProgression(
  scheme: AccessoryScheme,
  previousSets: AccessorySetLog[] | null,
  previousTargetReps: number | null,
  rounding = DEFAULT_ROUNDING
): AccessoryProgressionResult {
  // First session
  if (!previousSets || previousSets.length === 0) {
    return {
      shouldProgress: false,
      newWeight: scheme.weight,
      targetReps: scheme.minReps,
      reason: "first_session",
    }
  }

  const completedSets = previousSets.filter(s => s.completed)
  if (completedSets.length === 0) {
    // No sets completed → stay
    return {
      shouldProgress: false,
      newWeight: scheme.weight,
      targetReps: previousTargetReps || scheme.minReps,
      reason: "stay",
    }
  }

  // Check if all completed sets hit target
  const targetReps = previousTargetReps || scheme.minReps
  const allHitTarget = completedSets.every(s => s.reps >= targetReps)

  if (!allHitTarget) {
    // Didn't hit target → stay
    return {
      shouldProgress: false,
      newWeight: scheme.weight,
      targetReps,
      reason: "stay",
    }
  }

  // Check if all completed sets hit maxReps → bump weight
  const allHitMax = completedSets.every(s => s.reps >= scheme.maxReps)

  if (allHitMax) {
    const newWeight = roundToPlate(scheme.weight + scheme.increment, rounding)
    return {
      shouldProgress: true,
      newWeight,
      targetReps: scheme.minReps,  // Reset to bottom of range
      reason: "bump_weight",
    }
  }

  // Hit target but not max → bump reps
  const newTargetReps = Math.min(targetReps + 1, scheme.maxReps)
  return {
    shouldProgress: newTargetReps > targetReps,
    newWeight: scheme.weight,
    targetReps: newTargetReps,
    reason: newTargetReps > targetReps ? "bump_reps" : "stay",
  }
}

/**
 * Generate target sets for accessory (what to display in UI)
 */
export function generateAccessorySets(
  scheme: AccessoryScheme,
  targetReps: number
): { weight: number; targetReps: number }[] {
  return Array(scheme.sets).fill(null).map(() => ({
    weight: scheme.weight,
    targetReps,
  }))
}

// ============================================================================
// BBB AUTOREGULATION
// ============================================================================

export interface BBBConfig {
  enabled: boolean
  percent: number
  sets: number
  reps: number
}

export const DEFAULT_BBB_CONFIG: BBBConfig = {
  enabled: true,
  percent: 0.50,
  sets: 5,
  reps: 10,
}

/**
 * Calculate BBB sets with optional autoregulation reduction
 * 
 * Autoregulation modes:
 * - "normal": 5×10
 * - "reduced_reps": 5×8
 * - "reduced_sets": 3×10
 */
export type BBBAutoregulationMode = "normal" | "reduced_reps" | "reduced_sets"

export function buildBBBSetsWithAutoregulation(
  tm: number,
  config: BBBConfig,
  mode: BBBAutoregulationMode = "normal",
  rounding = DEFAULT_ROUNDING
): BBBSet[] {
  if (!config.enabled) return []
  
  const weight = roundToPlate(tm * config.percent, rounding)
  
  let sets = config.sets
  let reps = config.reps
  
  switch (mode) {
    case "reduced_reps":
      reps = Math.max(8, config.reps - 2)  // 10 → 8
      break
    case "reduced_sets":
      sets = Math.max(3, config.sets - 2)  // 5 → 3
      break
  }
  
  // Array.from zajistí, že každý set je samostatný objekt (ne sdílená reference)
  return Array.from({ length: sets }, () => ({ weight, reps }))
}
