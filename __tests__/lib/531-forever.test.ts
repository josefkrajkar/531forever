import { describe, it, expect } from "vitest"
import {
  buildMainSets,
  buildDailyWorkoutForever,
  buildSeventhWeekWorkout,
  advanceDayForever,
  isCycleCompleteForever,
  roundToPlate,
  estimateE1RM,
  calibrateStartTM,
  calculateTMFromAmrap,
  getLiftDisplayName,
  DEFAULT_SPLIT,
  type Lift,
} from "@/lib/531"

describe("roundToPlate()", () => {
  it("rounds to nearest 2.5 kg by default", () => {
    expect(roundToPlate(47.3)).toBe(47.5)
    expect(roundToPlate(48.7)).toBe(47.5) // 48.7 / 2.5 = 19.48 → rounds to 19 → 47.5
    expect(roundToPlate(48.8)).toBe(50)   // 48.8 / 2.5 = 19.52 → rounds to 20 → 50
    expect(roundToPlate(46.2)).toBe(45)
  })

  it("rounds to custom step", () => {
    expect(roundToPlate(47, 5)).toBe(45)
    expect(roundToPlate(48, 5)).toBe(50)
    expect(roundToPlate(52.5, 5)).toBe(55)
  })
})

describe("estimateE1RM()", () => {
  // Sjednocená implementace: guardy weight<=0||reps<=0 → 0, výsledek zaokrouhlen (Math.round)
  it("returns weight for single rep", () => {
    expect(estimateE1RM(100, 1)).toBe(100)
  })

  it("returns 0 for 0 or negative reps (sjednocená implementace)", () => {
    expect(estimateE1RM(100, 0)).toBe(0)
    expect(estimateE1RM(100, -1)).toBe(0)
  })

  it("calculates Epley formula correctly (zaokrouhleno)", () => {
    // E1RM = round(weight × (1 + reps/30))
    // 100 kg × 5 reps = round(100 × 1.167) = round(116.67) = 117
    expect(estimateE1RM(100, 5)).toBe(117)
    // 100 kg × 10 reps = round(100 × 1.333) = round(133.33) = 133
    expect(estimateE1RM(100, 10)).toBe(133)
  })
})

describe("calibrateStartTM()", () => {
  it("calculates conservative TM from calibration set", () => {
    // TM = e1RM × 0.9 × 0.9 = e1RM × 0.81
    // 100 kg × 5 reps → e1RM ≈ 116.67 → TM = 116.67 × 0.81 ≈ 94.5 → rounds to 95
    const tm = calibrateStartTM({ weight: 100, reps: 5 })
    expect(tm).toBe(95)
  })

  it("respects rounding parameter", () => {
    const tm = calibrateStartTM({ weight: 100, reps: 5 }, 5)
    expect(tm % 5).toBe(0) // Must be divisible by 5
  })
})

describe("calculateTMFromAmrap()", () => {
  it("calculates TM as 90% of e1RM", () => {
    // 100 kg × 5 reps → e1RM ≈ 116.67 → TM = 116.67 × 0.9 ≈ 105
    const tm = calculateTMFromAmrap(100, 5)
    expect(tm).toBe(105)
  })
})

describe("getLiftDisplayName()", () => {
  it("returns i18n keys for all lifts", () => {
    expect(getLiftDisplayName("squat")).toBe("lifts.squat")
    expect(getLiftDisplayName("bench")).toBe("lifts.bench")
    expect(getLiftDisplayName("deadlift")).toBe("lifts.deadlift")
    expect(getLiftDisplayName("press")).toBe("lifts.press")
  })
})

describe("buildMainSets()", () => {
  const tm = 100

  it("builds week 1 sets (5/5/5+)", () => {
    const sets = buildMainSets(tm, 1)
    expect(sets).toHaveLength(3)
    
    expect(sets[0].weight).toBe(65) // 65%
    expect(sets[0].targetReps).toBe(5)
    expect(sets[0].isAmrap).toBe(false)
    
    expect(sets[1].weight).toBe(75) // 75%
    expect(sets[1].targetReps).toBe(5)
    expect(sets[1].isAmrap).toBe(false)
    
    expect(sets[2].weight).toBe(85) // 85%
    expect(sets[2].targetReps).toBe(5)
    expect(sets[2].isAmrap).toBe(true)
  })

  it("builds week 2 sets (3/3/3+)", () => {
    const sets = buildMainSets(tm, 2)
    expect(sets).toHaveLength(3)
    
    expect(sets[0].weight).toBe(70)
    expect(sets[0].targetReps).toBe(3)
    
    expect(sets[1].weight).toBe(80)
    expect(sets[1].targetReps).toBe(3)
    
    expect(sets[2].weight).toBe(90)
    expect(sets[2].targetReps).toBe(3)
    expect(sets[2].isAmrap).toBe(true)
  })

  it("builds week 3 sets (5/3/1+)", () => {
    const sets = buildMainSets(tm, 3)
    expect(sets).toHaveLength(3)
    
    expect(sets[0].weight).toBe(75)
    expect(sets[0].targetReps).toBe(5)
    
    expect(sets[1].weight).toBe(85)
    expect(sets[1].targetReps).toBe(3)
    
    expect(sets[2].weight).toBe(95)
    expect(sets[2].targetReps).toBe(1)
    expect(sets[2].isAmrap).toBe(true)
  })

  it("returns empty array for invalid week (3-week cycles)", () => {
    const sets = buildMainSets(tm, 4)
    expect(sets).toHaveLength(0)
  })

  it("marks all-out AMRAP in Anchor phase", () => {
    const sets = buildMainSets(tm, 1, 2.5, "anchor")
    const amrapSet = sets.find(s => s.isAmrap)
    expect(amrapSet?.isAllOutAmrap).toBe(true)
  })

  it("does not mark all-out AMRAP in Leader phase", () => {
    const sets = buildMainSets(tm, 1, 2.5, "leader1")
    const amrapSet = sets.find(s => s.isAmrap)
    expect(amrapSet?.isAllOutAmrap).toBeUndefined()
  })
})

describe("buildDailyWorkoutForever()", () => {
  const trainingMaxes: Record<Lift, number | undefined> = {
    squat: 140,
    bench: 100,
    deadlift: 160,
    press: 60,
  }

  it("builds complete workout for Leader phase with BBB", () => {
    const workout = buildDailyWorkoutForever(
      trainingMaxes,
      DEFAULT_SPLIT,
      1, // week
      1, // cycle
      0, // dayIndex (squat)
      "leader1",
      1, // phaseWeek
      "bbb"
    )

    expect(workout).not.toBeNull()
    expect(workout!.lift).toBe("squat")
    expect(workout!.liftDisplayName).toBe("lifts.squat")
    expect(workout!.phase).toBe("leader1")
    expect(workout!.supplementalTemplate).toBe("bbb")
    expect(workout!.mainSets).toHaveLength(3)
    expect(workout!.supplementalSets).toHaveLength(5)
    expect(workout!.amrapStyle).toBe("conservative")
    expect(workout!.isSeventhWeek).toBe(false)
  })

  it("builds workout with FSL template (varying weight by week)", () => {
    const tm = 100
    const testMaxes: Record<Lift, number | undefined> = {
      squat: tm,
      bench: tm,
      deadlift: tm,
      press: tm,
    }

    // Week 1: FSL = 65%
    const week1 = buildDailyWorkoutForever(
      testMaxes, DEFAULT_SPLIT, 1, 1, 0, "leader1", 1, "fsl"
    )
    expect(week1!.supplementalSets[0].weight).toBe(65)

    // Week 2: FSL = 70%
    const week2 = buildDailyWorkoutForever(
      testMaxes, DEFAULT_SPLIT, 2, 1, 0, "leader1", 2, "fsl"
    )
    expect(week2!.supplementalSets[0].weight).toBe(70)

    // Week 3: FSL = 75%
    const week3 = buildDailyWorkoutForever(
      testMaxes, DEFAULT_SPLIT, 3, 1, 0, "leader1", 3, "fsl"
    )
    expect(week3!.supplementalSets[0].weight).toBe(75)
  })

  it("builds workout with BBS template (10×5)", () => {
    const workout = buildDailyWorkoutForever(
      trainingMaxes,
      DEFAULT_SPLIT,
      1, 1, 1, // bench day
      "leader1", 1,
      "bbs"
    )

    expect(workout!.supplementalSets).toHaveLength(10)
    expect(workout!.supplementalSets[0].reps).toBe(5)
  })

  it("builds Anchor workout with all-out AMRAP style", () => {
    const workout = buildDailyWorkoutForever(
      trainingMaxes,
      DEFAULT_SPLIT,
      1, 1, 0,
      "anchor", 1,
      "fsl"
    )

    expect(workout!.amrapStyle).toBe("all_out")
  })

  it("returns null for invalid dayIndex", () => {
    const workout = buildDailyWorkoutForever(
      trainingMaxes,
      DEFAULT_SPLIT,
      1, 1, 10, // invalid
      "leader1", 1,
      "bbb"
    )
    expect(workout).toBeNull()
  })

  it("returns null for missing TM", () => {
    const incompleteMaxes: Record<Lift, number | undefined> = {
      squat: undefined,
      bench: 100,
      deadlift: 160,
      press: 60,
    }

    const workout = buildDailyWorkoutForever(
      incompleteMaxes,
      DEFAULT_SPLIT,
      1, 1, 0, // squat day but no squat TM
      "leader1", 1,
      "bbb"
    )
    expect(workout).toBeNull()
  })

  it("builds 7th week workout with empty main sets", () => {
    const workout = buildDailyWorkoutForever(
      trainingMaxes,
      DEFAULT_SPLIT,
      1, 1, 0,
      "seventh_week", 1,
      "bbb"
    )

    expect(workout!.isSeventhWeek).toBe(true)
    expect(workout!.mainSets).toHaveLength(0)
    expect(workout!.supplementalSets).toHaveLength(0)
  })
})

describe("buildSeventhWeekWorkout()", () => {
  const trainingMaxes: Record<Lift, number | undefined> = {
    squat: 100,
    bench: 80,
    deadlift: 120,
    press: 50,
  }

  it("builds TM Test workout with 4 sets", () => {
    const workout = buildSeventhWeekWorkout(
      trainingMaxes,
      DEFAULT_SPLIT,
      0, // squat
      "tm_test"
    )

    expect(workout).not.toBeNull()
    expect(workout!.lift).toBe("squat")
    expect(workout!.sets).toHaveLength(4)
    expect(workout!.isTMTest).toBe(true)

    // Check sets: 70%, 80%, 90%, 100%
    expect(workout!.sets[0].weight).toBe(70)
    expect(workout!.sets[0].targetReps).toBe(5)
    expect(workout!.sets[1].weight).toBe(80)
    expect(workout!.sets[2].weight).toBe(90)
    expect(workout!.sets[3].weight).toBe(100)
    expect(workout!.sets[3].targetReps).toBe(3)
  })

  it("TM Test has AMRAP on last set only", () => {
    const workout = buildSeventhWeekWorkout(
      trainingMaxes, DEFAULT_SPLIT, 0, "tm_test"
    )

    expect(workout!.sets[0].isAmrap).toBe(false)
    expect(workout!.sets[1].isAmrap).toBe(false)
    expect(workout!.sets[2].isAmrap).toBe(false)
    expect(workout!.sets[3].isAmrap).toBe(true)
  })

  it("builds Deload workout with 3 light sets", () => {
    const workout = buildSeventhWeekWorkout(
      trainingMaxes,
      DEFAULT_SPLIT,
      0,
      "deload"
    )

    expect(workout).not.toBeNull()
    expect(workout!.sets).toHaveLength(3)
    expect(workout!.isTMTest).toBe(false)

    // Check sets: 40%, 50%, 60%
    expect(workout!.sets[0].weight).toBe(40)
    expect(workout!.sets[1].weight).toBe(50)
    expect(workout!.sets[2].weight).toBe(60)
  })

  it("Deload has no AMRAP sets", () => {
    const workout = buildSeventhWeekWorkout(
      trainingMaxes, DEFAULT_SPLIT, 0, "deload"
    )

    workout!.sets.forEach(set => {
      expect(set.isAmrap).toBe(false)
    })
  })

  it("returns null for invalid dayIndex", () => {
    const workout = buildSeventhWeekWorkout(
      trainingMaxes, DEFAULT_SPLIT, 10, "tm_test"
    )
    expect(workout).toBeNull()
  })

  it("returns null for missing TM", () => {
    const incompleteMaxes: Record<Lift, number | undefined> = {
      squat: undefined,
      bench: 80,
      deadlift: 120,
      press: 50,
    }

    const workout = buildSeventhWeekWorkout(
      incompleteMaxes, DEFAULT_SPLIT, 0, "tm_test"
    )
    expect(workout).toBeNull()
  })
})

describe("advanceDayForever()", () => {
  it("advances to next day in same week", () => {
    const result = advanceDayForever(1, 0, 1)
    expect(result).toEqual({
      week: 1,
      dayIndex: 1,
      cycle: 1,
      cycleComplete: false,
    })
  })

  it("advances from day 3 to next week", () => {
    const result = advanceDayForever(1, 3, 1)
    expect(result).toEqual({
      week: 2,
      dayIndex: 0,
      cycle: 1,
      cycleComplete: false,
    })
  })

  it("advances from week 3 day 3 to new cycle", () => {
    const result = advanceDayForever(3, 3, 1)
    expect(result).toEqual({
      week: 1,
      dayIndex: 0,
      cycle: 2,
      cycleComplete: true,
    })
  })

  it("cycles correctly through multiple iterations", () => {
    let state = { week: 1, dayIndex: 0, cycle: 1, cycleComplete: false }
    
    // Advance through entire cycle (3 weeks × 4 days = 12 workouts)
    for (let i = 0; i < 12; i++) {
      state = advanceDayForever(state.week, state.dayIndex, state.cycle)
    }

    // Should be at start of cycle 2
    expect(state.cycle).toBe(2)
    expect(state.week).toBe(1)
    expect(state.dayIndex).toBe(0)
  })
})

describe("isCycleCompleteForever()", () => {
  it("returns false before week 3 day 3", () => {
    expect(isCycleCompleteForever(1, 3)).toBe(false)
    expect(isCycleCompleteForever(2, 3)).toBe(false)
    expect(isCycleCompleteForever(3, 2)).toBe(false)
  })

  it("returns true at week 3 day 3", () => {
    expect(isCycleCompleteForever(3, 3)).toBe(true)
  })
})

