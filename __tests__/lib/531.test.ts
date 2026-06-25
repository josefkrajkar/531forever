/**
 * Tests for 5/3/1 Program Calculator
 * 
 * Covers:
 * - Weight rounding
 * - e1RM calculations
 * - TM calibration
 * - Main sets and BBB sets
 * - Daily workout building
 * - Cycle/day advancement
 * - Progression algorithm (PROGRESS/HOLD/RESET)
 * - Stall detection
 */

import { describe, it, expect } from "vitest"
import {
  roundToPlate,
  estimateE1RM,
  calibrateStartTM,
  calculateTMFromAmrap,
  buildMainSets,
  buildBBBSets,
  getLiftDisplayName,
  advanceDay,
  isCycleComplete,
  decideProgression,
  calculateCycleProgressions,
  isStalling,
  getWeekName,
  getDayName,
  DEFAULT_SPLIT,
  DEFAULT_INCREMENTS,
  DEFAULT_ROUNDING,
  BAR_WEIGHT,
  type Lift,
  type ProgressionState,
  type Week3TopSet,
} from "@/lib/531"


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe("roundToPlate", () => {
  it("rounds to nearest 2.5 kg by default", () => {
    expect(roundToPlate(100)).toBe(100)
    expect(roundToPlate(101.2)).toBe(100)
    expect(roundToPlate(101.3)).toBe(102.5)
    expect(roundToPlate(103.75)).toBe(105)
  })

  it("rounds to custom step", () => {
    expect(roundToPlate(100, 5)).toBe(100)
    expect(roundToPlate(102.4, 5)).toBe(100)
    expect(roundToPlate(102.6, 5)).toBe(105)
  })

  it("handles edge case of zero", () => {
    expect(roundToPlate(0)).toBe(0)
  })

  it("handles small weights", () => {
    expect(roundToPlate(1.2)).toBe(0)
    expect(roundToPlate(1.3)).toBe(2.5)
  })
})

describe("estimateE1RM", () => {
  // Sjednocená implementace: guardy weight<=0||reps<=0 → 0, výsledek zaokrouhlen (Math.round)
  it("returns 0 for 0 or negative reps (sjednocená implementace)", () => {
    expect(estimateE1RM(100, 0)).toBe(0)
    expect(estimateE1RM(100, -1)).toBe(0)
  })

  it("returns 0 for zero or negative weight", () => {
    expect(estimateE1RM(0, 5)).toBe(0)
    expect(estimateE1RM(-10, 5)).toBe(0)
  })

  it("returns weight for single rep", () => {
    expect(estimateE1RM(100, 1)).toBe(100)
  })

  it("calculates e1RM using Epley formula (zaokrouhleno)", () => {
    // e1RM = round(weight × (1 + reps/30))
    expect(estimateE1RM(100, 5)).toBe(117)  // round(100 × 1.1667) = round(116.67) = 117
    expect(estimateE1RM(100, 10)).toBe(133) // round(100 × 1.333) = round(133.33) = 133
    expect(estimateE1RM(100, 15)).toBe(150) // round(100 × 1.5) = 150
  })

  it("handles high rep ranges", () => {
    expect(estimateE1RM(60, 20)).toBe(100)  // round(60 × 1.667) = round(100) = 100
    expect(estimateE1RM(50, 30)).toBe(100)  // round(50 × 2.0) = 100
  })
})

describe("calibrateStartTM", () => {
  it("calculates conservative TM (0.81 × e1RM)", () => {
    // 100kg × 5 reps → e1RM ≈ 116.67 → TM = 116.67 × 0.81 ≈ 94.5 → round to 95
    const tm = calibrateStartTM({ weight: 100, reps: 5 })
    expect(tm).toBe(95)
  })

  it("handles single rep max", () => {
    // 100kg × 1 rep → e1RM = 100 → TM = 100 × 0.81 = 81 → round to 80
    const tm = calibrateStartTM({ weight: 100, reps: 1 })
    expect(tm).toBe(80)
  })

  it("uses custom rounding", () => {
    const tm = calibrateStartTM({ weight: 100, reps: 5 }, 5)
    expect(tm % 5).toBe(0)
  })
})

describe("calculateTMFromAmrap", () => {
  it("calculates TM as 90% of e1RM", () => {
    // 100kg × 5 reps → e1RM ≈ 116.67 → TM = 116.67 × 0.9 ≈ 105
    const tm = calculateTMFromAmrap(100, 5)
    expect(tm).toBe(105)
  })

  it("rounds to plate increments", () => {
    const tm = calculateTMFromAmrap(93, 3)
    expect(tm % DEFAULT_ROUNDING).toBe(0)
  })
})


// ============================================================================
// SET BUILDING
// ============================================================================

describe("buildMainSets", () => {
  const tm = 100

  it("builds week 1 sets (5/5/5+)", () => {
    const sets = buildMainSets(tm, 1)
    expect(sets).toHaveLength(3)
    expect(sets[0]).toMatchObject({ percentage: 65, targetReps: 5, isAmrap: false })
    expect(sets[1]).toMatchObject({ percentage: 75, targetReps: 5, isAmrap: false })
    expect(sets[2]).toMatchObject({ percentage: 85, targetReps: 5, isAmrap: true })
  })

  it("builds week 2 sets (3/3/3+)", () => {
    const sets = buildMainSets(tm, 2)
    expect(sets).toHaveLength(3)
    expect(sets[0]).toMatchObject({ percentage: 70, targetReps: 3, isAmrap: false })
    expect(sets[1]).toMatchObject({ percentage: 80, targetReps: 3, isAmrap: false })
    expect(sets[2]).toMatchObject({ percentage: 90, targetReps: 3, isAmrap: true })
  })

  it("builds week 3 sets (5/3/1+)", () => {
    const sets = buildMainSets(tm, 3)
    expect(sets).toHaveLength(3)
    expect(sets[0]).toMatchObject({ percentage: 75, targetReps: 5, isAmrap: false })
    expect(sets[1]).toMatchObject({ percentage: 85, targetReps: 3, isAmrap: false })
    expect(sets[2]).toMatchObject({ percentage: 95, targetReps: 1, isAmrap: true })
  })

  it("returns empty array for week 4 (3-week Forever cycles)", () => {
    // In Forever system, there is no automatic week 4 - only 3 weeks per cycle
    // 7th Week Protocol is used between phases instead
    const sets = buildMainSets(tm, 4)
    expect(sets).toEqual([])
  })

  it("rounds weights to plate increments", () => {
    const sets = buildMainSets(107.5, 1)
    sets.forEach((set) => {
      expect(set.weight % DEFAULT_ROUNDING).toBe(0)
    })
  })

  it("returns empty array for invalid week", () => {
    const sets = buildMainSets(100, 5)
    expect(sets).toEqual([])
  })
})

describe("buildBBBSets", () => {
  it("builds 5 sets of 10 at 50% TM", () => {
    const sets = buildBBBSets(100)
    expect(sets).toHaveLength(5)
    sets.forEach((set) => {
      expect(set.reps).toBe(10)
      expect(set.weight).toBe(50) // 50% of 100
    })
  })

  it("rounds weights to plate increments", () => {
    const sets = buildBBBSets(110)
    expect(sets[0].weight).toBe(55) // 50% of 110 = 55
  })
})


describe("getLiftDisplayName", () => {
  it("returns i18n keys for all lifts", () => {
    expect(getLiftDisplayName("squat")).toBe("lifts.squat")
    expect(getLiftDisplayName("bench")).toBe("lifts.bench")
    expect(getLiftDisplayName("deadlift")).toBe("lifts.deadlift")
    expect(getLiftDisplayName("press")).toBe("lifts.press")
  })
})


// ============================================================================
// CYCLE AND DAY ADVANCEMENT
// ============================================================================

describe("advanceDay", () => {
  it("advances to next day in same week", () => {
    expect(advanceDay(1, 0, 1)).toEqual({ week: 1, dayIndex: 1, cycle: 1 })
    expect(advanceDay(1, 1, 1)).toEqual({ week: 1, dayIndex: 2, cycle: 1 })
    expect(advanceDay(1, 2, 1)).toEqual({ week: 1, dayIndex: 3, cycle: 1 })
  })

  it("advances to next week after 4 days", () => {
    expect(advanceDay(1, 3, 1)).toEqual({ week: 2, dayIndex: 0, cycle: 1 })
    expect(advanceDay(2, 3, 1)).toEqual({ week: 3, dayIndex: 0, cycle: 1 })
    expect(advanceDay(3, 3, 1)).toEqual({ week: 4, dayIndex: 0, cycle: 1 })
  })

  it("advances to new cycle after week 4", () => {
    expect(advanceDay(4, 3, 1)).toEqual({ week: 1, dayIndex: 0, cycle: 2 })
    expect(advanceDay(4, 3, 5)).toEqual({ week: 1, dayIndex: 0, cycle: 6 })
  })
})

describe("isCycleComplete", () => {
  it("returns true only after last day of week 4", () => {
    expect(isCycleComplete(4, 3)).toBe(true)
  })

  it("returns false for incomplete cycles", () => {
    expect(isCycleComplete(1, 0)).toBe(false)
    expect(isCycleComplete(3, 3)).toBe(false)
    expect(isCycleComplete(4, 2)).toBe(false)
  })
})


// ============================================================================
// PROGRESSION ALGORITHM
// ============================================================================

describe("isStalling", () => {
  it("returns false for insufficient history", () => {
    expect(isStalling([])).toBe(false)
    expect(isStalling([100])).toBe(false)
    expect(isStalling([100, 102])).toBe(false)
  })

  it("returns false when making progress", () => {
    expect(isStalling([100, 102, 105])).toBe(false)
    expect(isStalling([100, 100, 105])).toBe(false) // Latest is new max
  })

  it("returns true when stalling (no new max in last 2 cycles)", () => {
    // isStalling = current <= prev AND current <= prev2
    expect(isStalling([110, 108, 105])).toBe(true) // 105 ≤ 108 AND 105 ≤ 110
    expect(isStalling([105, 105, 105])).toBe(true) // Equal throughout = stall
    expect(isStalling([100, 103, 100])).toBe(true) // 100 ≤ 103 AND 100 ≤ 100
  })

  it("returns false when latest is better than oldest", () => {
    expect(isStalling([100, 105, 103])).toBe(false) // 103 > 100, not stalling
    expect(isStalling([100, 105, 105])).toBe(false) // 105 > 100, not stalling
  })
})

describe("decideProgression", () => {
  const baseState: ProgressionState = {
    trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
    increments: DEFAULT_INCREMENTS,
    misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
    e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
    rounding: DEFAULT_ROUNDING,
  }

  describe("No clean signal → HOLD", () => {
    it("returns HOLD when week3TopSet is null", () => {
      const { result, updatedMisses } = decideProgression("squat", null, baseState)
      
      expect(result.action).toBe("HOLD")
      expect(result.reason).toBe("no_clean_signal")
      expect(result.change).toBe(0)
      expect(result.newTM).toBe(100)
      expect(updatedMisses).toBe(0)
    })

    it("returns HOLD when autoregulated", () => {
      const autoregulatedSet: Week3TopSet = {
        weight: 95,
        repsAchieved: 5,
        autoregulated: true,
      }
      
      const { result } = decideProgression("squat", autoregulatedSet, baseState)
      
      expect(result.action).toBe("HOLD")
      expect(result.reason).toBe("no_clean_signal")
    })
  })

  describe("Missed minimum → HOLD or RESET", () => {
    // Minreps závisí na týdnu AMRAP setu: týden 1 = 5+, týden 2 = 3+, týden 3 = 1+
    // Miss = repsAchieved < cílový počet reps daného týdne

    it("returns HOLD on first miss (week 2, cíl 3+, dosaženo 1)", () => {
      // Realistický scénář: week 2 AMRAP (3+) — lifter zvládl jen 1 rep
      const missedSet: Week3TopSet = {
        weight: 90, // 90% TM = top set week 2
        repsAchieved: 1, // pod cílem 3 = miss
        autoregulated: false,
        week: 2,
      }

      const { result, updatedMisses } = decideProgression("squat", missedSet, baseState)

      expect(result.action).toBe("HOLD")
      expect(result.reason).toBe("first_miss")
      expect(result.change).toBe(0)
      expect(updatedMisses).toBe(1) // Miss counter incremented
    })

    it("returns HOLD on first miss (week 1, cíl 5+, dosaženo 3)", () => {
      // Realistický scénář: week 1 AMRAP (5+) — lifter zvládl jen 3 reps
      const missedSet: Week3TopSet = {
        weight: 85, // 85% TM = top set week 1
        repsAchieved: 3, // pod cílem 5 = miss
        autoregulated: false,
        week: 1,
      }

      const { result, updatedMisses } = decideProgression("squat", missedSet, baseState)

      expect(result.action).toBe("HOLD")
      expect(result.reason).toBe("first_miss")
      expect(result.change).toBe(0)
      expect(updatedMisses).toBe(1)
    })

    it("returns RESET on second consecutive miss (week 2, cíl 3+, dosaženo 2)", () => {
      const stateWithOneMiss: ProgressionState = {
        ...baseState,
        misses: { ...baseState.misses, squat: 1 },
      }

      const missedSet: Week3TopSet = {
        weight: 90,
        repsAchieved: 2, // pod cílem 3 = miss podruhé → RESET
        autoregulated: false,
        week: 2,
      }

      const { result, updatedMisses } = decideProgression("squat", missedSet, stateWithOneMiss)

      expect(result.action).toBe("RESET")
      expect(result.reason).toBe("repeated_miss")
      expect(result.newTM).toBe(90) // 100 × 0.9 = 90
      expect(result.change).toBe(-10)
      expect(updatedMisses).toBe(0) // Reset after RESET
    })

    it("respects minimum TM floor (BAR_WEIGHT)", () => {
      const lowTMState: ProgressionState = {
        ...baseState,
        trainingMaxes: { ...baseState.trainingMaxes, press: 22.5 },
        misses: { ...baseState.misses, press: 1 },
      }

      // Druhý miss při week 2 (minReps=3) s reálnými hodnotami
      const missedSet: Week3TopSet = {
        weight: 21.375, // 95% of 22.5
        repsAchieved: 1, // pod cílem 3 = miss
        autoregulated: false,
        week: 2,
      }

      const { result } = decideProgression("press", missedSet, lowTMState)

      expect(result.action).toBe("RESET")
      expect(result.newTM).toBe(BAR_WEIGHT) // Never below 20kg
    })
  })

  describe("Hit minimum → PROGRESS", () => {
    it("returns PROGRESS with standard increment for lower body", () => {
      const successSet: Week3TopSet = {
        weight: 95, // 95% of 100
        repsAchieved: 3,
        autoregulated: false,
      }
      
      const { result, updatedMisses, updatedE1rmHistory } = decideProgression("squat", successSet, baseState)
      
      expect(result.action).toBe("PROGRESS")
      expect(result.reason).toBe("standard")
      expect(result.newTM).toBe(105) // 100 + 5
      expect(result.change).toBe(5)
      expect(updatedMisses).toBe(0) // Reset on success
      expect(updatedE1rmHistory).toHaveLength(1)
    })

    it("returns PROGRESS with standard increment for upper body", () => {
      const successSet: Week3TopSet = {
        weight: 76, // 95% of 80
        repsAchieved: 2,
        autoregulated: false,
      }
      
      const { result } = decideProgression("bench", successSet, baseState)
      
      expect(result.action).toBe("PROGRESS")
      expect(result.newTM).toBe(82.5) // 80 + 2.5
      expect(result.change).toBe(2.5)
    })

    it("resets miss counter on success after previous miss", () => {
      const stateWithMiss: ProgressionState = {
        ...baseState,
        misses: { ...baseState.misses, squat: 1 },
      }
      
      const successSet: Week3TopSet = {
        weight: 95,
        repsAchieved: 1,
        autoregulated: false,
      }
      
      const { updatedMisses } = decideProgression("squat", successSet, stateWithMiss)
      
      expect(updatedMisses).toBe(0)
    })
  })

  describe("e1RM stall detection → HOLD", () => {
    it("returns HOLD when e1RM is stalling", () => {
      const stallingState: ProgressionState = {
        ...baseState,
        e1rmHistory: {
          ...baseState.e1rmHistory,
          squat: [120, 125, 122], // Stalling - latest not improving
        },
      }
      
      const successSet: Week3TopSet = {
        weight: 95,
        repsAchieved: 1, // e1RM ≈ 95 (less than previous)
        autoregulated: false,
      }
      
      const { result } = decideProgression("squat", successSet, stallingState)
      
      expect(result.action).toBe("HOLD")
      expect(result.reason).toBe("e1rm_stall")
    })
  })

  describe("e1RM history management", () => {
    it("adds e1RM to history on success", () => {
      const successSet: Week3TopSet = {
        weight: 95,
        repsAchieved: 5,
        autoregulated: false,
      }
      
      const { updatedE1rmHistory } = decideProgression("squat", successSet, baseState)
      
      expect(updatedE1rmHistory).toHaveLength(1)
      expect(updatedE1rmHistory[0]).toBeCloseTo(estimateE1RM(95, 5), 1)
    })

    it("limits history to 10 entries", () => {
      const historyWith10: ProgressionState = {
        ...baseState,
        e1rmHistory: {
          ...baseState.e1rmHistory,
          squat: [100, 102, 104, 106, 108, 110, 112, 114, 116, 118],
        },
      }
      
      const successSet: Week3TopSet = {
        weight: 95,
        repsAchieved: 5,
        autoregulated: false,
      }
      
      const { updatedE1rmHistory } = decideProgression("squat", successSet, historyWith10)
      
      expect(updatedE1rmHistory).toHaveLength(10)
      expect(updatedE1rmHistory[0]).toBe(102) // Oldest removed
    })

    it("does not modify history on miss", () => {
      const historyState: ProgressionState = {
        ...baseState,
        e1rmHistory: {
          ...baseState.e1rmHistory,
          squat: [100, 105, 110],
        },
      }
      
      const missedSet: Week3TopSet = {
        weight: 95,
        repsAchieved: 0,
        autoregulated: false,
      }
      
      const { updatedE1rmHistory } = decideProgression("squat", missedSet, historyState)
      
      expect(updatedE1rmHistory).toEqual([100, 105, 110])
    })
  })
})

describe("calculateCycleProgressions", () => {
  const baseState: ProgressionState = {
    trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
    increments: DEFAULT_INCREMENTS,
    misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
    e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
    rounding: DEFAULT_ROUNDING,
  }

  it("processes all lifts", () => {
    const week3Results: Partial<Record<Lift, Week3TopSet | null>> = {
      squat: { weight: 95, repsAchieved: 3, autoregulated: false },
      bench: { weight: 76, repsAchieved: 2, autoregulated: false },
      deadlift: { weight: 114, repsAchieved: 4, autoregulated: false },
      press: { weight: 47.5, repsAchieved: 1, autoregulated: false },
    }

    const { progressions } = calculateCycleProgressions(baseState, week3Results)

    expect(progressions).toHaveLength(4)
    expect(progressions.map((p) => p.lift)).toEqual(["squat", "bench", "deadlift", "press"])
  })

  it("handles mixed results (some missing, some autoregulated)", () => {
    const week3Results: Partial<Record<Lift, Week3TopSet | null>> = {
      squat: { weight: 95, repsAchieved: 3, autoregulated: false },
      bench: null, // Missing
      deadlift: { weight: 114, repsAchieved: 4, autoregulated: true }, // Autoregulated
      press: { weight: 47.5, repsAchieved: 1, autoregulated: false },
    }

    const { progressions } = calculateCycleProgressions(baseState, week3Results)

    expect(progressions.find((p) => p.lift === "squat")!.action).toBe("PROGRESS")
    expect(progressions.find((p) => p.lift === "bench")!.action).toBe("HOLD")
    expect(progressions.find((p) => p.lift === "deadlift")!.action).toBe("HOLD")
    expect(progressions.find((p) => p.lift === "press")!.action).toBe("PROGRESS")
  })

  it("updates state correctly for all lifts", () => {
    const stateWithMiss: ProgressionState = {
      ...baseState,
      misses: { squat: 0, bench: 1, deadlift: 0, press: 0 },
    }

    const week3Results: Partial<Record<Lift, Week3TopSet | null>> = {
      squat: { weight: 95, repsAchieved: 3, autoregulated: false },
      bench: { weight: 76, repsAchieved: 0, autoregulated: false }, // Second miss → RESET
      deadlift: { weight: 114, repsAchieved: 0, autoregulated: false }, // First miss → HOLD
      press: { weight: 47.5, repsAchieved: 1, autoregulated: false },
    }

    const { progressions, updatedMisses, updatedE1rmHistory } = 
      calculateCycleProgressions(stateWithMiss, week3Results)

    expect(progressions.find((p) => p.lift === "squat")!.action).toBe("PROGRESS")
    expect(progressions.find((p) => p.lift === "bench")!.action).toBe("RESET")
    expect(progressions.find((p) => p.lift === "deadlift")!.action).toBe("HOLD")
    expect(progressions.find((p) => p.lift === "press")!.action).toBe("PROGRESS")

    expect(updatedMisses.squat).toBe(0)
    expect(updatedMisses.bench).toBe(0) // Reset after RESET
    expect(updatedMisses.deadlift).toBe(1) // Incremented
    expect(updatedMisses.press).toBe(0)

    expect(updatedE1rmHistory.squat.length).toBeGreaterThan(0)
    expect(updatedE1rmHistory.bench.length).toBe(0) // No e1RM recorded for miss
    expect(updatedE1rmHistory.deadlift.length).toBe(0) // No e1RM for miss
    expect(updatedE1rmHistory.press.length).toBeGreaterThan(0)
  })
})


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

describe("getWeekName", () => {
  it("returns i18n keys for known weeks", () => {
    expect(getWeekName(1)).toBe("weeks.1")
    expect(getWeekName(2)).toBe("weeks.2")
    expect(getWeekName(3)).toBe("weeks.3")
  })

  it("returns seventh week key when isSeventhWeek is true", () => {
    expect(getWeekName(1, true)).toBe("weeks.seventh")
    expect(getWeekName(7, true)).toBe("weeks.seventh")
  })

  it("returns fallback key for unknown week", () => {
    expect(getWeekName(4)).toBe("weeks.unknown")
    expect(getWeekName(5)).toBe("weeks.unknown")
  })
})

describe("getDayName", () => {
  it("returns i18n key for lift by day index", () => {
    expect(getDayName(0, DEFAULT_SPLIT)).toBe("lifts.squat")
    expect(getDayName(1, DEFAULT_SPLIT)).toBe("lifts.bench")
    expect(getDayName(2, DEFAULT_SPLIT)).toBe("lifts.deadlift")
    expect(getDayName(3, DEFAULT_SPLIT)).toBe("lifts.press")
  })
})


// ============================================================================
// CONSTANTS
// ============================================================================

describe("Constants", () => {
  it("has correct default values", () => {
    expect(DEFAULT_SPLIT).toEqual(["squat", "bench", "deadlift", "press"])
    expect(DEFAULT_ROUNDING).toBe(2.5)
    expect(BAR_WEIGHT).toBe(20)
    expect(DEFAULT_INCREMENTS).toEqual({
      squat: 5,
      bench: 2.5,
      deadlift: 5,
      press: 2.5,
    })
  })
})


// ============================================================================
// ACCESSORY DOUBLE PROGRESSION
// ============================================================================

import {
  calculateAccessoryProgression,
  generateAccessorySets,
  buildBBBSetsWithAutoregulation,
  DEFAULT_BBB_CONFIG,
  type AccessoryScheme,
  type AccessorySetLog,
} from "@/lib/531"

describe("calculateAccessoryProgression", () => {
  const baseScheme: AccessoryScheme = {
    sets: 3,
    minReps: 8,
    maxReps: 12,
    weight: 20,
    increment: 2.5,
  }

  it("returns first_session for null history", () => {
    const result = calculateAccessoryProgression(baseScheme, null, null)
    expect(result.reason).toBe("first_session")
    expect(result.targetReps).toBe(8)  // minReps
    expect(result.newWeight).toBe(20)
  })

  it("returns first_session for empty history", () => {
    const result = calculateAccessoryProgression(baseScheme, [], null)
    expect(result.reason).toBe("first_session")
    expect(result.targetReps).toBe(8)
  })

  it("stays at same target when sets are not completed", () => {
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 8, completed: false },
      { weight: 20, reps: 8, completed: false },
      { weight: 20, reps: 8, completed: false },
    ]
    const result = calculateAccessoryProgression(baseScheme, previousSets, 8)
    expect(result.reason).toBe("stay")
    expect(result.targetReps).toBe(8)
  })

  it("stays when not hitting target reps", () => {
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 7, completed: true },  // under target
      { weight: 20, reps: 8, completed: true },
      { weight: 20, reps: 8, completed: true },
    ]
    const result = calculateAccessoryProgression(baseScheme, previousSets, 8)
    expect(result.reason).toBe("stay")
    expect(result.targetReps).toBe(8)
  })

  it("bumps reps when all sets hit target but not max", () => {
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 10, completed: true },
      { weight: 20, reps: 10, completed: true },
      { weight: 20, reps: 10, completed: true },
    ]
    const result = calculateAccessoryProgression(baseScheme, previousSets, 10)
    expect(result.reason).toBe("bump_reps")
    expect(result.targetReps).toBe(11)
    expect(result.newWeight).toBe(20)
  })

  it("bumps weight when all sets hit maxReps", () => {
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 12, completed: true },  // maxReps
      { weight: 20, reps: 12, completed: true },
      { weight: 20, reps: 13, completed: true },  // even over max
    ]
    const result = calculateAccessoryProgression(baseScheme, previousSets, 12)
    expect(result.reason).toBe("bump_weight")
    expect(result.targetReps).toBe(8)  // reset to minReps
    expect(result.newWeight).toBe(22.5)  // +2.5kg
  })

  it("respects rounding when bumping weight", () => {
    const schemeWithBigIncrement: AccessoryScheme = {
      ...baseScheme,
      increment: 5,
    }
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 12, completed: true },
      { weight: 20, reps: 12, completed: true },
      { weight: 20, reps: 12, completed: true },
    ]
    const result = calculateAccessoryProgression(schemeWithBigIncrement, previousSets, 12)
    expect(result.newWeight).toBe(25)
  })

  it("handles mixed completed/incomplete sets", () => {
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 10, completed: true },
      { weight: 20, reps: 10, completed: true },
      { weight: 20, reps: 8, completed: false },  // incomplete
    ]
    // Only completed sets count
    const result = calculateAccessoryProgression(baseScheme, previousSets, 10)
    expect(result.reason).toBe("bump_reps")
  })

  it("caps target reps at maxReps", () => {
    const previousSets: AccessorySetLog[] = [
      { weight: 20, reps: 11, completed: true },
      { weight: 20, reps: 11, completed: true },
      { weight: 20, reps: 11, completed: true },
    ]
    const result = calculateAccessoryProgression(baseScheme, previousSets, 11)
    expect(result.reason).toBe("bump_reps")
    expect(result.targetReps).toBe(12)  // capped at max
  })
})



describe("generateAccessorySets", () => {
  it("generates correct number of sets", () => {
    const scheme: AccessoryScheme = {
      sets: 4,
      minReps: 8,
      maxReps: 12,
      weight: 30,
      increment: 2.5,
    }
    const sets = generateAccessorySets(scheme, 10)
    expect(sets).toHaveLength(4)
  })

  it("uses provided target reps", () => {
    const scheme: AccessoryScheme = {
      sets: 3,
      minReps: 8,
      maxReps: 12,
      weight: 25,
      increment: 2.5,
    }
    const sets = generateAccessorySets(scheme, 11)
    expect(sets.every(s => s.targetReps === 11)).toBe(true)
    expect(sets.every(s => s.weight === 25)).toBe(true)
  })
})


// ============================================================================
// BBB AUTOREGULATION
// ============================================================================

describe("DEFAULT_BBB_CONFIG", () => {
  it("has correct default values", () => {
    expect(DEFAULT_BBB_CONFIG).toEqual({
      enabled: true,
      percent: 0.50,
      sets: 5,
      reps: 10,
    })
  })
})


describe("buildBBBSetsWithAutoregulation", () => {
  const tm = 100
  const config = DEFAULT_BBB_CONFIG

  it("builds 5x10 in normal mode", () => {
    const sets = buildBBBSetsWithAutoregulation(tm, config, "normal")
    expect(sets).toHaveLength(5)
    expect(sets.every(s => s.reps === 10)).toBe(true)
    expect(sets.every(s => s.weight === 50)).toBe(true)  // 50% of 100
  })

  it("reduces reps in reduced_reps mode (5x8)", () => {
    const sets = buildBBBSetsWithAutoregulation(tm, config, "reduced_reps")
    expect(sets).toHaveLength(5)
    expect(sets.every(s => s.reps === 8)).toBe(true)  // 10 - 2 = 8
  })

  it("reduces sets in reduced_sets mode (3x10)", () => {
    const sets = buildBBBSetsWithAutoregulation(tm, config, "reduced_sets")
    expect(sets).toHaveLength(3)  // 5 - 2 = 3
    expect(sets.every(s => s.reps === 10)).toBe(true)
  })

  it("returns empty array when BBB is disabled", () => {
    const disabledConfig = { ...config, enabled: false }
    const sets = buildBBBSetsWithAutoregulation(tm, disabledConfig, "normal")
    expect(sets).toHaveLength(0)
  })

  it("rounds weight correctly", () => {
    const sets = buildBBBSetsWithAutoregulation(87.5, config, "normal")
    // 87.5 × 0.50 = 43.75 → rounded to 45
    expect(sets[0].weight).toBe(45)
  })

  it("respects custom BBB config", () => {
    const customConfig = {
      enabled: true,
      percent: 0.60,
      sets: 4,
      reps: 8,
    }
    const sets = buildBBBSetsWithAutoregulation(100, customConfig, "normal")
    expect(sets).toHaveLength(4)
    expect(sets.every(s => s.reps === 8)).toBe(true)
    expect(sets.every(s => s.weight === 60)).toBe(true)  // 60% of 100
  })

  it("doesn't reduce below minimum in reduced modes", () => {
    const smallConfig = {
      enabled: true,
      percent: 0.50,
      sets: 3,  // minimum
      reps: 8,  // minimum
    }
    
    const setsReduced = buildBBBSetsWithAutoregulation(100, smallConfig, "reduced_sets")
    expect(setsReduced).toHaveLength(3)  // stays at minimum
    
    const repsReduced = buildBBBSetsWithAutoregulation(100, smallConfig, "reduced_reps")
    expect(repsReduced.every(s => s.reps === 8)).toBe(true)  // stays at minimum
  })
})


// ============================================================================
// applyCycleProgression (server-side single source of truth)
// ============================================================================

import {
  applyCycleProgression,
  type ProgressionState as PS,
} from "@/lib/531"

describe("applyCycleProgression()", () => {
  const baseState: PS = {
    trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
    increments: { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 },
    misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
    e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
    rounding: 2.5,
  }

  const goodAmraps = [
    { cycle: 1, week: 3, lift: "squat",    weight: 95,   targetReps: 1, actualReps: 5, autoregulated: false },
    { cycle: 1, week: 3, lift: "bench",    weight: 75,   targetReps: 1, actualReps: 3, autoregulated: false },
    { cycle: 1, week: 3, lift: "deadlift", weight: 115,  targetReps: 1, actualReps: 4, autoregulated: false },
    { cycle: 1, week: 3, lift: "press",    weight: 47.5, targetReps: 1, actualReps: 2, autoregulated: false },
  ]

  it("vrátí PROGRESS pro všechny lifty se splněnými AMRAP cíli", () => {
    const summary = applyCycleProgression(baseState, goodAmraps, 1)

    expect(summary.completedCycle).toBe(1)
    expect(summary.lifts).toHaveLength(4)

    for (const l of summary.lifts) {
      expect(l.action).toBe("PROGRESS")
      expect(l.newTM).toBeGreaterThan(l.oldTM)
    }

    // Konkrétní inkrementy
    expect(summary.newTrainingMaxes.squat).toBe(105)      // +5
    expect(summary.newTrainingMaxes.bench).toBe(82.5)     // +2.5
    expect(summary.newTrainingMaxes.deadlift).toBe(125)   // +5
    expect(summary.newTrainingMaxes.press).toBe(52.5)     // +2.5
  })

  it("vrátí HOLD pro lift s misssem (0 reps v week 3)", () => {
    const amrapsWithMiss = [
      ...goodAmraps.filter(a => a.lift !== "squat"),
      { cycle: 1, week: 3, lift: "squat", weight: 95, targetReps: 1, actualReps: 0, autoregulated: false },
    ]

    const summary = applyCycleProgression(baseState, amrapsWithMiss, 1)

    const squatResult = summary.lifts.find(l => l.lift === "squat")!
    expect(squatResult.action).toBe("HOLD")
    expect(squatResult.newTM).toBe(100)    // beze změny
    expect(summary.newTrainingMaxes.squat).toBe(100)
    expect(summary.updatedMisses.squat).toBe(1)
  })

  it("vrátí RESET při druhém missu (misses=1 před cyklem)", () => {
    const stateWithMiss: PS = {
      ...baseState,
      misses: { ...baseState.misses, squat: 1 },  // squat již jednou miss
    }
    const amrapsWithMiss = [
      ...goodAmraps.filter(a => a.lift !== "squat"),
      { cycle: 2, week: 3, lift: "squat", weight: 95, targetReps: 1, actualReps: 0, autoregulated: false },
    ]

    const summary = applyCycleProgression(stateWithMiss, amrapsWithMiss, 2)

    const squatResult = summary.lifts.find(l => l.lift === "squat")!
    expect(squatResult.action).toBe("RESET")
    expect(squatResult.newTM).toBeLessThan(100)         // -10%
    expect(summary.updatedMisses.squat).toBe(0)         // reset miss counter
  })

  it("vrátí HOLD pro autoregulovaný lift (no_clean_signal)", () => {
    const autoAmraps = [
      ...goodAmraps.filter(a => a.lift !== "bench"),
      { cycle: 1, week: 3, lift: "bench", weight: 75, targetReps: 1, actualReps: 5, autoregulated: true },
    ]

    const summary = applyCycleProgression(baseState, autoAmraps, 1)

    const benchResult = summary.lifts.find(l => l.lift === "bench")!
    expect(benchResult.action).toBe("HOLD")
    expect(benchResult.reason).toBe("no_clean_signal")
    expect(benchResult.newTM).toBe(80)
  })

  it("vrátí HOLD pokud chybí AMRAP výsledek pro lift", () => {
    // Pouze bench a deadlift mají výsledky — squat a press chybí
    const partialAmraps = [
      { cycle: 1, week: 3, lift: "bench",    weight: 75,  targetReps: 1, actualReps: 3, autoregulated: false },
      { cycle: 1, week: 3, lift: "deadlift", weight: 115, targetReps: 1, actualReps: 4, autoregulated: false },
    ]

    const summary = applyCycleProgression(baseState, partialAmraps, 1)

    const squatResult = summary.lifts.find(l => l.lift === "squat")!
    expect(squatResult.action).toBe("HOLD")
    expect(squatResult.reason).toBe("no_clean_signal")

    const pressResult = summary.lifts.find(l => l.lift === "press")!
    expect(pressResult.action).toBe("HOLD")
  })

  it("správně aktualizuje misses a e1rmHistory ve výsledku", () => {
    const summary = applyCycleProgression(baseState, goodAmraps, 1)

    // Po PROGRESS se misses resetuje na 0
    for (const lift of ["squat", "bench", "deadlift", "press"] as const) {
      expect(summary.updatedMisses[lift]).toBe(0)
    }

    // e1rmHistory dostala nové záznamy (po PROGRESS)
    expect(summary.updatedE1rmHistory.squat.length).toBeGreaterThan(0)
    expect(summary.updatedE1rmHistory.bench.length).toBeGreaterThan(0)
  })
})


// ============================================================================
// E1RM PARITA: activateProgram vs estimateE1RM
// ============================================================================

import { estimateE1RM as libEstimateE1RM } from "@/lib/531"
import { estimateE1RM as calcEstimateE1RM } from "@/lib/strength-calculations"

describe("e1RM parita: lib/531 re-export == lib/strength-calculations kanonická implementace", () => {
  const cases: [number, number][] = [
    [100, 1],   // single rep
    [100, 3],
    [100, 5],
    [80, 10],
    [60, 1],
    [0, 5],     // guard: weight <= 0 → 0
    [100, 0],   // guard: reps <= 0 → 0
    [100, -1],  // guard: negative reps → 0
  ]

  for (const [weight, reps] of cases) {
    it(`estimateE1RM(${weight}, ${reps}) je stejné v obou implementacích`, () => {
      expect(libEstimateE1RM(weight, reps)).toBe(calcEstimateE1RM(weight, reps))
    })
  }

  it("reps === 1 vrátí přesně weight (bez Epley extrapolace)", () => {
    expect(libEstimateE1RM(100, 1)).toBe(100)
    expect(libEstimateE1RM(87.5, 1)).toBe(87.5)
  })

  it("výsledek je zaokrouhlený na celé kg (Math.round)", () => {
    // 100 × (1 + 5/30) = 116.67 → Math.round = 117
    expect(libEstimateE1RM(100, 5)).toBe(117)
    // 80 × (1 + 3/30) = 88 → přesné celé číslo
    expect(libEstimateE1RM(80, 3)).toBe(88)
  })
})
