/**
 * Edge case testy pro decideProgression a isStalling
 *
 * Pokrývají případy, které stávající testy nezachycují:
 * - Missy v každém týdnu (week 1, 2, 3) a přesně na hranici minReps
 * - RESET s floor na BAR_WEIGHT (TM pod 20 kg)
 * - isStalling s identickými hodnotami a mezerami z autoregulated cyklů
 * - Chybějící AMRAP data (no_clean_signal větev)
 * - Fallback pro týden mimo 1–3 (AMRAP_MIN_REPS default)
 */

import { describe, it, expect } from "vitest"
import {
  decideProgression,
  isStalling,
  BAR_WEIGHT,
  DEFAULT_INCREMENTS,
  DEFAULT_ROUNDING,
  type ProgressionState,
  type Week3TopSet,
} from "@/lib/531"

// ============================================================================
// Sdílený base state
// ============================================================================

const makeBaseState = (overrides: Partial<ProgressionState> = {}): ProgressionState => ({
  trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 50 },
  increments: DEFAULT_INCREMENTS,
  misses: { squat: 0, bench: 0, deadlift: 0, press: 0 },
  e1rmHistory: { squat: [], bench: [], deadlift: [], press: [] },
  rounding: DEFAULT_ROUNDING,
  ...overrides,
})

// ============================================================================
// 1. MISS v jednotlivých týdnech
// ============================================================================

describe("decideProgression — miss v týdnu 1 (minReps=5)", () => {
  it("vrátí HOLD při prvním missu v týdnu 1 (reps < 5)", () => {
    // Týden 1: 5+ AMRAP — lifter zvládl jen 4 opakování → miss
    const set: Week3TopSet = { weight: 85, repsAchieved: 4, autoregulated: false, week: 1 }
    const { result, updatedMisses } = decideProgression("squat", set, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("first_miss")
    expect(result.change).toBe(0)
    expect(updatedMisses).toBe(1)
  })

  it("vrátí HOLD při prvním missu v týdnu 1 (reps = 0)", () => {
    // Krajní případ: lifter neudělal žádné opakování
    const set: Week3TopSet = { weight: 85, repsAchieved: 0, autoregulated: false, week: 1 }
    const { result, updatedMisses } = decideProgression("squat", set, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("first_miss")
    expect(updatedMisses).toBe(1)
  })

  it("vrátí RESET při druhém missu v týdnu 1", () => {
    const state = makeBaseState({ misses: { squat: 1, bench: 0, deadlift: 0, press: 0 } })
    const set: Week3TopSet = { weight: 85, repsAchieved: 3, autoregulated: false, week: 1 }
    const { result, updatedMisses } = decideProgression("squat", set, state)

    expect(result.action).toBe("RESET")
    expect(result.reason).toBe("repeated_miss")
    expect(result.newTM).toBeLessThan(100) // 100 × 0.9 = 90
    expect(updatedMisses).toBe(0) // miss counter se resetuje po RESET
  })
})

describe("decideProgression — miss v týdnu 2 (minReps=3)", () => {
  it("vrátí HOLD při prvním missu v týdnu 2 (reps < 3)", () => {
    // Týden 2: 3+ AMRAP — lifter zvládl jen 2 opakování → miss
    const set: Week3TopSet = { weight: 90, repsAchieved: 2, autoregulated: false, week: 2 }
    const { result, updatedMisses } = decideProgression("bench", set, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("first_miss")
    expect(result.change).toBe(0)
    expect(updatedMisses).toBe(1)
  })

  it("vrátí HOLD při prvním missu v týdnu 2 (reps = 0)", () => {
    const set: Week3TopSet = { weight: 90, repsAchieved: 0, autoregulated: false, week: 2 }
    const { result } = decideProgression("bench", set, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("first_miss")
  })
})

describe("decideProgression — miss v týdnu 3 (minReps=1)", () => {
  it("vrátí HOLD při prvním missu v týdnu 3 (reps = 0 — nula opakování)", () => {
    // Týden 3: 1+ AMRAP — lifter nezdvihl nic (0 reps) → miss
    const set: Week3TopSet = { weight: 95, repsAchieved: 0, autoregulated: false, week: 3 }
    const { result, updatedMisses } = decideProgression("deadlift", set, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("first_miss")
    expect(updatedMisses).toBe(1)
  })

  it("vrátí RESET při druhém missu v týdnu 3 (reps = 0)", () => {
    const state = makeBaseState({ misses: { squat: 0, bench: 0, deadlift: 1, press: 0 } })
    const set: Week3TopSet = { weight: 114, repsAchieved: 0, autoregulated: false, week: 3 }
    const { result, updatedMisses } = decideProgression("deadlift", set, state)

    expect(result.action).toBe("RESET")
    expect(result.reason).toBe("repeated_miss")
    // 120 × 0.9 = 108.0, roundToPlate(108, 2.5) = 107.5 (nejbližší násobek 2.5)
    expect(result.newTM).toBe(107.5)
    expect(result.change).toBeLessThan(0)
    expect(updatedMisses).toBe(0)
  })
})

// ============================================================================
// 2. Přesně na hranici minReps (reps === minReps) → PROGRESS
// ============================================================================

describe("decideProgression — splnění přesně na hranici minReps", () => {
  it("vrátí PROGRESS pokud repsAchieved === 5 v týdnu 1 (hranice 5+)", () => {
    const set: Week3TopSet = { weight: 85, repsAchieved: 5, autoregulated: false, week: 1 }
    const { result } = decideProgression("squat", set, makeBaseState())

    expect(result.action).toBe("PROGRESS")
    expect(result.reason).toBe("standard")
    expect(result.newTM).toBe(105) // 100 + 5
  })

  it("vrátí PROGRESS pokud repsAchieved === 3 v týdnu 2 (hranice 3+)", () => {
    const set: Week3TopSet = { weight: 90, repsAchieved: 3, autoregulated: false, week: 2 }
    const { result } = decideProgression("bench", set, makeBaseState())

    expect(result.action).toBe("PROGRESS")
    expect(result.newTM).toBe(82.5) // 80 + 2.5
  })

  it("vrátí PROGRESS pokud repsAchieved === 1 v týdnu 3 (hranice 1+)", () => {
    const set: Week3TopSet = { weight: 95, repsAchieved: 1, autoregulated: false, week: 3 }
    const { result } = decideProgression("squat", set, makeBaseState())

    expect(result.action).toBe("PROGRESS")
    expect(result.reason).toBe("standard")
  })

  it("vrátí PROGRESS i bez explicitního `week` (default = týden 3, minReps=1)", () => {
    // Zpětná kompatibilita: week není uvedeno → default 3 → minReps=1
    const set: Week3TopSet = { weight: 95, repsAchieved: 1, autoregulated: false }
    const { result } = decideProgression("squat", set, makeBaseState())

    expect(result.action).toBe("PROGRESS")
  })
})

// ============================================================================
// 3. RESET větev: floor na BAR_WEIGHT
// ============================================================================

describe("decideProgression — RESET s floor na BAR_WEIGHT", () => {
  it("nový TM nikdy neklesne pod BAR_WEIGHT (20 kg) při RESETu z malého TM", () => {
    // TM = 21 kg, 0.9 × 21 = 18.9 → roundToPlate(18.9, 2.5) = 17.5 < 20
    // → floor na BAR_WEIGHT = 20
    const state = makeBaseState({
      trainingMaxes: { squat: 100, bench: 100, deadlift: 100, press: 21 },
      misses: { squat: 0, bench: 0, deadlift: 0, press: 1 },
    })
    const set: Week3TopSet = { weight: 20, repsAchieved: 0, autoregulated: false, week: 3 }
    const { result } = decideProgression("press", set, state)

    expect(result.action).toBe("RESET")
    expect(result.newTM).toBe(BAR_WEIGHT)  // 20 kg — nikdy pod tyč
    expect(result.newTM).toBeGreaterThanOrEqual(BAR_WEIGHT)
  })

  it("RESET s TM přesně rovným BAR_WEIGHT zůstane na BAR_WEIGHT", () => {
    // TM = 20 kg, 0.9 × 20 = 18 → floor na BAR_WEIGHT = 20
    const state = makeBaseState({
      trainingMaxes: { squat: 100, bench: 100, deadlift: 100, press: BAR_WEIGHT },
      misses: { squat: 0, bench: 0, deadlift: 0, press: 1 },
    })
    const set: Week3TopSet = { weight: 19, repsAchieved: 0, autoregulated: false, week: 3 }
    const { result } = decideProgression("press", set, state)

    expect(result.action).toBe("RESET")
    expect(result.newTM).toBe(BAR_WEIGHT)
  })

  it("RESET s normálním TM (100 kg) vrátí 90 kg (bez floor aktivace)", () => {
    const state = makeBaseState({ misses: { squat: 1, bench: 0, deadlift: 0, press: 0 } })
    const set: Week3TopSet = { weight: 95, repsAchieved: 0, autoregulated: false, week: 3 }
    const { result } = decideProgression("squat", set, state)

    expect(result.action).toBe("RESET")
    expect(result.newTM).toBe(90) // 100 × 0.9 = 90 (přesně, žádný rounding issue)
    expect(result.newTM).toBeGreaterThan(BAR_WEIGHT)
  })
})

// ============================================================================
// 4. isStalling: 3 identické e1RM → HOLD
// ============================================================================

describe("isStalling — detailní edge cases", () => {
  it("vrátí true pro 3 identické e1RM hodnoty", () => {
    // Klasický stall: síla stagnuje tři cykly v řadě
    expect(isStalling([120, 120, 120])).toBe(true)
  })

  it("vrátí true i s delší historií, kde poslední 3 jsou stejné", () => {
    expect(isStalling([100, 105, 110, 115, 115, 115])).toBe(true)
  })

  it("vrátí false pokud nejnovější hodnota je přísně větší než předposlední (progres)", () => {
    expect(isStalling([115, 115, 116])).toBe(false)
  })

  it("vrátí false pokud nejnovější je větší než hodnota před 2 cykly, ale ne než předposlední", () => {
    // 100 → 105 → 103: 103 <= 105, ale 103 > 100 → není stall
    expect(isStalling([100, 105, 103])).toBe(false)
  })

  it("vrátí false pro historii o délce přesně 2", () => {
    expect(isStalling([100, 100])).toBe(false)
  })

  it("vrátí false pro prázdnou historii", () => {
    expect(isStalling([])).toBe(false)
  })

  it("vrátí true pokud nejnovější je menší než oba předchozí", () => {
    // Regres: síla klesá
    expect(isStalling([110, 112, 108])).toBe(true) // 108 <= 112 AND 108 <= 110
  })
})

describe("decideProgression — isStalling s mezerami z autoregulated zápisů", () => {
  it("autoregulated záznamy se nepromítají do e1rmHistory → nedojde k false HOLD", () => {
    // Stav: e1rmHistory má 3 rostoucí záznamy (progresuje)
    // Autoregulated AMRAP set → HOLD z důvodu no_clean_signal, e1rmHistory se NEMĚNÍ
    const state = makeBaseState({
      e1rmHistory: { squat: [110, 112, 115], bench: [], deadlift: [], press: [] },
    })
    const autoSet: Week3TopSet = { weight: 95, repsAchieved: 5, autoregulated: true, week: 3 }
    const { result, updatedE1rmHistory } = decideProgression("squat", autoSet, state)

    // no_clean_signal → HOLD — e1rmHistory se nemění
    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("no_clean_signal")
    expect(updatedE1rmHistory).toEqual([110, 112, 115]) // beze změny
  })

  it("čistý set po autoregulated cyklu přidá e1RM a správně vyhodnotí stall", () => {
    // Stav: history vypadá jako stagnace [110, 112, 112]
    // Po přidání dalšího čistého výkonu [112] bude poslední slice [112, 112, nové_e1RM]
    // nové e1RM závisí na výkonu — pokud je menší nebo rovno → stall
    const state = makeBaseState({
      e1rmHistory: { squat: [110, 112, 112], bench: [], deadlift: [], press: [] },
    })
    // Slabý výkon: e1RM = estimateE1RM(95, 1) = 95 (reps=1, week=3)
    // Po přidání: [110, 112, 112, 95] → window [112, 112, 95] → 95 <= 112 AND 95 <= 112 → stall
    const set: Week3TopSet = { weight: 95, repsAchieved: 1, autoregulated: false, week: 3 }
    const { result } = decideProgression("squat", set, state)

    // Splněno (reps >= 1), ale e1RM stagnuje → HOLD (e1rm_stall)
    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("e1rm_stall")
  })
})

// ============================================================================
// 5. Chybějící AMRAP data pro cyklus (no_clean_signal větev)
// ============================================================================

describe("decideProgression — no_clean_signal větev", () => {
  it("vrátí HOLD pro null top set (AMRAP v cyklu nezaznamenáno)", () => {
    const { result, updatedMisses } = decideProgression("squat", null, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("no_clean_signal")
    expect(result.change).toBe(0)
    expect(result.newTM).toBe(100)
    expect(updatedMisses).toBe(0) // miss counter se NEMĚNÍ
  })

  it("vrátí HOLD pro undefined top set", () => {
    const { result } = decideProgression("bench", undefined, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("no_clean_signal")
    expect(result.newTM).toBe(80)
  })

  it("no_clean_signal nemodifikuje e1rmHistory", () => {
    const state = makeBaseState({
      e1rmHistory: { squat: [100, 105], bench: [], deadlift: [], press: [] },
    })
    const { updatedE1rmHistory } = decideProgression("squat", null, state)

    expect(updatedE1rmHistory).toEqual([100, 105]) // beze změny
  })

  it("no_clean_signal nemodifikuje miss counter (ani nezvyšuje)", () => {
    const state = makeBaseState({ misses: { squat: 2, bench: 0, deadlift: 0, press: 0 } })
    const { updatedMisses } = decideProgression("squat", null, state)

    // Miss counter se nemění — autoregulated/null není "miss", jen chybí signál
    expect(updatedMisses).toBe(2)
  })
})

// ============================================================================
// 6. Default week mapping — week mimo 1–3
// ============================================================================

describe("decideProgression — fallback pro AMRAP week mimo rozsah 1–3", () => {
  it("týden mimo 1–3 použije default minReps=1 (zpětná kompatibilita)", () => {
    // week=0 nebo week=5 → AMRAP_MIN_REPS[0] = undefined → ?? 1 → minReps=1
    // repsAchieved=1 ≥ 1 → PROGRESS
    const setWeek0: Week3TopSet = { weight: 95, repsAchieved: 1, autoregulated: false, week: 0 }
    const { result: result0 } = decideProgression("squat", setWeek0, makeBaseState())

    expect(result0.action).toBe("PROGRESS")

    const setWeek5: Week3TopSet = { weight: 95, repsAchieved: 1, autoregulated: false, week: 5 }
    const { result: result5 } = decideProgression("squat", setWeek5, makeBaseState())

    expect(result5.action).toBe("PROGRESS")
  })

  it("týden mimo 1–3, repsAchieved=0 → miss (minReps=1 default)", () => {
    // week=99 → minReps default=1, repsAchieved=0 < 1 → HOLD (first miss)
    const set: Week3TopSet = { weight: 95, repsAchieved: 0, autoregulated: false, week: 99 }
    const { result } = decideProgression("squat", set, makeBaseState())

    expect(result.action).toBe("HOLD")
    expect(result.reason).toBe("first_miss")
  })
})
