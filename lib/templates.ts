/**
 * 5/3/1 Forever Template Definitions
 * 
 * Templates define the supplemental work structure for each phase.
 * Based on Jim Wendler's 5/3/1 Forever book.
 */

export type SupplementalTemplate = "bbb" | "fsl" | "ssl" | "bbs"
export type ProgramPhase = "leader1" | "leader2" | "anchor" | "seventh_week"
export type SeventhWeekType = "tm_test" | "deload"

export interface TemplateConfig {
  id: SupplementalTemplate
  name: string
  description: string
  shortDescription: string
  sets: number
  reps: number
  percentOfTM: number | ((week: number) => number)  // Can vary by week
  isLeaderTemplate: boolean
  isAnchorTemplate: boolean
  // For progressive BBB (50/60/70%)
  weeklyPercents?: number[]
}

export interface PhaseConfig {
  id: ProgramPhase
  name: string
  displayName: string
  description: string
  cycleCount: number  // How many 3-week cycles in this phase
  weekCount: number   // Total weeks (cycleCount * 3)
  amrapStyle: "conservative" | "all_out"  // How to approach AMRAP sets
  supplementalIntensity: "high" | "medium" | "low"
}

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

export const TEMPLATES: Record<SupplementalTemplate, TemplateConfig> = {
  bbb: {
    id: "bbb",
    name: "templates.bbb.name",
    description: "templates.bbb.description",
    shortDescription: "templates.bbb.shortDescription",
    sets: 5,
    reps: 10,
    percentOfTM: 0.50,  // Can be 0.50, 0.55, 0.60, or 0.65
    weeklyPercents: [0.50, 0.55, 0.60],  // Progressive BBB option
    isLeaderTemplate: true,
    isAnchorTemplate: false,
  },
  fsl: {
    id: "fsl",
    name: "templates.fsl.name",
    description: "templates.fsl.description",
    shortDescription: "templates.fsl.shortDescription",
    sets: 5,
    reps: 5,
    percentOfTM: (week: number) => {
      // FSL uses first set weight which varies by week
      const weekPercents: Record<number, number> = {
        1: 0.65,  // Week 1: 5s week, first set is 65%
        2: 0.70,  // Week 2: 3s week, first set is 70%
        3: 0.75,  // Week 3: 5/3/1 week, first set is 75%
      }
      return weekPercents[week] || 0.65
    },
    isLeaderTemplate: true,
    isAnchorTemplate: true,
  },
  ssl: {
    id: "ssl",
    name: "templates.ssl.name",
    description: "templates.ssl.description",
    shortDescription: "templates.ssl.shortDescription",
    sets: 5,
    reps: 5,
    percentOfTM: (week: number) => {
      // SSL uses second set weight
      const weekPercents: Record<number, number> = {
        1: 0.75,  // Week 1: 5s week, second set is 75%
        2: 0.80,  // Week 2: 3s week, second set is 80%
        3: 0.85,  // Week 3: 5/3/1 week, second set is 85%
      }
      return weekPercents[week] || 0.75
    },
    isLeaderTemplate: true,
    isAnchorTemplate: true,
  },
  bbs: {
    id: "bbs",
    name: "templates.bbs.name",
    description: "templates.bbs.description",
    shortDescription: "templates.bbs.shortDescription",
    sets: 10,
    reps: 5,
    percentOfTM: (week: number) => {
      // Same as FSL weights
      const weekPercents: Record<number, number> = {
        1: 0.65,
        2: 0.70,
        3: 0.75,
      }
      return weekPercents[week] || 0.65
    },
    isLeaderTemplate: true,
    isAnchorTemplate: false,
  },
}

// ============================================
// PHASE DEFINITIONS
// ============================================

export const PHASES: Record<ProgramPhase, PhaseConfig> = {
  leader1: {
    id: "leader1",
    name: "leader1",
    displayName: "program.phases.leader1",
    description: "program.phaseDescriptions.leader1",
    cycleCount: 2,
    weekCount: 6,
    amrapStyle: "conservative",  // Don't go all-out, leave 1-2 reps in tank
    supplementalIntensity: "high",
  },
  leader2: {
    id: "leader2",
    name: "leader2",
    displayName: "program.phases.leader2",
    description: "program.phaseDescriptions.leader2",
    cycleCount: 2,
    weekCount: 6,
    amrapStyle: "conservative",
    supplementalIntensity: "high",
  },
  anchor: {
    id: "anchor",
    name: "anchor",
    displayName: "program.phases.anchor",
    description: "program.phaseDescriptions.anchor",
    cycleCount: 1,  // Can be 1-2 cycles
    weekCount: 3,
    amrapStyle: "all_out",  // Go for PRs
    supplementalIntensity: "low",
  },
  seventh_week: {
    id: "seventh_week",
    name: "seventh_week",
    displayName: "program.phases.seventh_week",
    description: "program.phaseDescriptions.seventh_week",
    cycleCount: 0,  // Special - just 1 week
    weekCount: 1,
    amrapStyle: "conservative",
    supplementalIntensity: "low",
  },
}

// ============================================
// 7TH WEEK PROTOCOL
// ============================================

export interface SeventhWeekConfig {
  id: SeventhWeekType
  name: string
  description: string
  sets: { percent: number; reps: number }[]
}

export const SEVENTH_WEEK_PROTOCOLS: Record<SeventhWeekType, SeventhWeekConfig> = {
  tm_test: {
    id: "tm_test",
    name: "seventhWeek.protocols.tm_test.name",
    description: "seventhWeek.protocols.tm_test.description",
    sets: [
      { percent: 0.70, reps: 5 },
      { percent: 0.80, reps: 5 },
      { percent: 0.90, reps: 3 },
      { percent: 1.00, reps: 3 },  // TM test - should get 3-5 strong reps
    ],
  },
  deload: {
    id: "deload",
    name: "seventhWeek.protocols.deload.name",
    description: "seventhWeek.protocols.deload.description",
    sets: [
      { percent: 0.40, reps: 5 },
      { percent: 0.50, reps: 5 },
      { percent: 0.60, reps: 5 },
    ],
  },
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the supplemental weight for a given template, week, and TM.
 *
 * BBB progresivní váhy: pokud template má `weeklyPercents`, použije procento podle týdne.
 * Wendler doporučuje 50→55→60 % TM pro progresivní BBB (Leader blok).
 * Tím se odstraňuje nedosažitelná konfigurace — weeklyPercents je nyní aktivně používáno.
 */
export function getSupplementalWeight(
  template: SupplementalTemplate,
  week: number,
  trainingMax: number,
  rounding: number = 2.5
): number {
  const config = TEMPLATES[template]

  let percent: number
  if (config.weeklyPercents && config.weeklyPercents.length > 0) {
    // Progresivní procenta podle týdne (index 0 = týden 1, atd.)
    const idx = Math.max(0, Math.min(week - 1, config.weeklyPercents.length - 1))
    percent = config.weeklyPercents[idx]
  } else if (typeof config.percentOfTM === "function") {
    percent = config.percentOfTM(week)
  } else {
    percent = config.percentOfTM
  }

  return Math.round((trainingMax * percent) / rounding) * rounding
}

/**
 * Get supplemental sets for a workout
 */
export function getSupplementalSets(
  template: SupplementalTemplate,
  week: number,
  trainingMax: number,
  rounding: number = 2.5
): { weight: number; reps: number }[] {
  const config = TEMPLATES[template]
  const weight = getSupplementalWeight(template, week, trainingMax, rounding)

  // Array.from zajistí, že každý set je samostatný objekt (ne sdílená reference)
  return Array.from({ length: config.sets }, () => ({ weight, reps: config.reps }))
}

/**
 * Get recommended template based on training goal
 */
export function getRecommendedTemplate(
  goal: "strength" | "hypertrophy" | "balanced",
  experience: "beginner" | "intermediate" | "advanced"
): { leader: SupplementalTemplate; anchor: SupplementalTemplate } {
  if (goal === "hypertrophy") {
    return { leader: "bbb", anchor: "fsl" }
  }
  
  if (goal === "strength") {
    if (experience === "advanced") {
      return { leader: "ssl", anchor: "fsl" }
    }
    return { leader: "fsl", anchor: "fsl" }
  }
  
  // Balanced
  if (experience === "advanced") {
    return { leader: "bbs", anchor: "ssl" }
  }
  return { leader: "bbb", anchor: "fsl" }
}

/**
 * Calculate the full macrocycle structure
 * Returns array of phases with their weeks
 */
export interface MacrocycleWeek {
  weekNumber: number       // 1-22 in full macrocycle
  phase: ProgramPhase
  phaseWeek: number       // Week within phase (1-6 for leader, 1-3 for anchor, 1 for 7th week)
  cycle: number           // Which 3-week cycle within phase
  weekInCycle: number     // 1-3 within cycle
  isSeventhWeek: boolean
}

export function buildMacrocycleStructure(): MacrocycleWeek[] {
  const structure: MacrocycleWeek[] = []
  let weekNumber = 1
  
  // Leader 1: 2 cycles = 6 weeks
  for (let cycle = 1; cycle <= 2; cycle++) {
    for (let weekInCycle = 1; weekInCycle <= 3; weekInCycle++) {
      structure.push({
        weekNumber: weekNumber++,
        phase: "leader1",
        phaseWeek: (cycle - 1) * 3 + weekInCycle,
        cycle,
        weekInCycle,
        isSeventhWeek: false,
      })
    }
  }
  
  // 7th Week after Leader 1
  structure.push({
    weekNumber: weekNumber++,
    phase: "seventh_week",
    phaseWeek: 1,
    cycle: 0,
    weekInCycle: 1,
    isSeventhWeek: true,
  })
  
  // Leader 2: 2 cycles = 6 weeks
  for (let cycle = 1; cycle <= 2; cycle++) {
    for (let weekInCycle = 1; weekInCycle <= 3; weekInCycle++) {
      structure.push({
        weekNumber: weekNumber++,
        phase: "leader2",
        phaseWeek: (cycle - 1) * 3 + weekInCycle,
        cycle,
        weekInCycle,
        isSeventhWeek: false,
      })
    }
  }
  
  // 7th Week after Leader 2
  structure.push({
    weekNumber: weekNumber++,
    phase: "seventh_week",
    phaseWeek: 1,
    cycle: 0,
    weekInCycle: 1,
    isSeventhWeek: true,
  })
  
  // Anchor: 1 cycle = 3 weeks (can be extended to 2 cycles)
  for (let weekInCycle = 1; weekInCycle <= 3; weekInCycle++) {
    structure.push({
      weekNumber: weekNumber++,
      phase: "anchor",
      phaseWeek: weekInCycle,
      cycle: 1,
      weekInCycle,
      isSeventhWeek: false,
    })
  }
  
  // Final 7th Week after Anchor (optional but recommended)
  structure.push({
    weekNumber: weekNumber++,
    phase: "seventh_week",
    phaseWeek: 1,
    cycle: 0,
    weekInCycle: 1,
    isSeventhWeek: true,
  })
  
  return structure
}

/**
 * Get display info for current position in macrocycle
 */
export function getMacrocycleDisplayInfo(
  phase: ProgramPhase,
  phaseWeek: number,
  supplementalTemplate: SupplementalTemplate
): {
  phaseName: string
  weekLabel: string
  templateName: string
  totalWeeksInPhase: number
  progress: number  // 0-1
} {
  const phaseConfig = PHASES[phase]
  const templateConfig = TEMPLATES[supplementalTemplate]
  
  const totalWeeks = phase === "seventh_week" ? 1 : phaseConfig.weekCount
  
  return {
    phaseName: phaseConfig.displayName,
    weekLabel: phase === "seventh_week"
      ? "weeks.seventh"
      : `Týden ${phaseWeek}/${totalWeeks}`,
    templateName: templateConfig.name,
    totalWeeksInPhase: totalWeeks,
    progress: phaseWeek / totalWeeks,
  }
}

/**
 * Determine if TM can be increased in the given phase
 *
 * TM zvýšení probíhá po KAŽDÉM dokončeném 3týdenním cyklu v leader a anchor fázích
 * (ne při vstupu do 7. týdne — to je jen kontrolní bod nebo deload).
 * Tato funkce indikuje, že fáze má aktivní 3týdenní cykly s progresními AMRAP sety.
 */
export function shouldIncreaseTMAfterPhase(phase: ProgramPhase): boolean {
  // TM progrese probíhá uvnitř leader a anchor fází, po každém 3týdenním cyklu.
  // seventh_week TM nikdy nezvyšuje — je to kontrolní bod nebo deload.
  return phase === "leader1" || phase === "leader2" || phase === "anchor"
}

/**
 * Get the next phase in the macrocycle
 */
export function getNextPhase(
  currentPhase: ProgramPhase,
  phaseWeek: number
): ProgramPhase | "new_macrocycle" {
  const phaseConfig = PHASES[currentPhase]
  
  // If not at end of phase, stay in current phase
  if (currentPhase !== "seventh_week" && phaseWeek < phaseConfig.weekCount) {
    return currentPhase
  }
  
  // Phase transitions
  switch (currentPhase) {
    case "leader1":
      return "seventh_week"
    case "leader2":
      return "seventh_week"
    case "anchor":
      return "seventh_week"
    case "seventh_week":
      // Need context to determine what comes next
      // This will be handled by the program logic
      return "new_macrocycle"
    default:
      return "leader1"
  }
}

// [templates] top-level console.log odstraněn — způsoboval výstup při každém importu
