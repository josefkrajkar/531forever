/**
 * Simulace celého makrocyklu 5/3/1 Forever
 *
 * Makrocyklus: leader1 (2 cykly) → 7th (tm_test) → leader2 (2 cykly) → 7th → anchor (1 cyklus) → 7th
 *
 * Testy ověřují (doménové rozhodnutí F1.2):
 * - TM se zvýší právě po každém dokončeném 3týdenním cyklu se splněnými AMRAP cíli
 * - TM se NIKDY nezmění během 7th week (ani tm_test, ani deload)
 * - HOLD při missu AMRAP cíle, RESET při druhém missu
 */

import { describe, it, expect } from "vitest"
import {
  applyCycleProgression,
  type ProgressionState,
  type CycleProgressionSummary,
} from "@/lib/531"

// Počáteční TM
const START_TM = { squat: 100, bench: 80, deadlift: 120, press: 50 }
const INCREMENTS = { squat: 5, bench: 2.5, deadlift: 5, press: 2.5 }
const ROUNDING = 2.5

function makeState(
  trainingMaxes: Record<string, number>,
  misses: Record<string, number>,
  e1rmHistory: Record<string, number[]>
): ProgressionState {
  return {
    trainingMaxes: trainingMaxes as ProgressionState["trainingMaxes"],
    increments: INCREMENTS,
    misses: misses as ProgressionState["misses"],
    e1rmHistory: e1rmHistory as ProgressionState["e1rmHistory"],
    rounding: ROUNDING,
  }
}

/**
 * Vytvoří "dobré" AMRAP výsledky pro daný cyklus (week 3, všechny lifty splnily cíl).
 * Váhy rostou s každým cyklem, aby se předešlo detekci stagnace e1RM (isStalling),
 * která by po 3 identických výsledcích přepnula na HOLD.
 */
function goodAmraps(cycle: number) {
  // Váhy rostou s cyklem — simulujeme reálný progress atleta
  const delta = (cycle - 1) * 2.5
  return [
    { cycle, week: 3, lift: "squat",    weight: 95   + delta, targetReps: 1, actualReps: 5, autoregulated: false },
    { cycle, week: 3, lift: "bench",    weight: 75   + delta, targetReps: 1, actualReps: 3, autoregulated: false },
    { cycle, week: 3, lift: "deadlift", weight: 115  + delta, targetReps: 1, actualReps: 4, autoregulated: false },
    { cycle, week: 3, lift: "press",    weight: 47.5 + delta, targetReps: 1, actualReps: 2, autoregulated: false },
  ]
}

/** Vytvoří AMRAP výsledky kde squat miss (0 reps) */
function squatMissAmraps(cycle: number) {
  return [
    { cycle, week: 3, lift: "squat",    weight: 95,   targetReps: 1, actualReps: 0, autoregulated: false },
    { cycle, week: 3, lift: "bench",    weight: 75,   targetReps: 1, actualReps: 3, autoregulated: false },
    { cycle, week: 3, lift: "deadlift", weight: 115,  targetReps: 1, actualReps: 4, autoregulated: false },
    { cycle, week: 3, lift: "press",    weight: 47.5, targetReps: 1, actualReps: 2, autoregulated: false },
  ]
}

describe("Simulace makrocyklu: TM progrese", () => {
  it("5 cyklů se splněnými AMRAP → TM zvýšeno 5×, každý lift o správný inkrement", () => {
    // Makrocyklus: leader1 (C1, C2) → leader2 (C3, C4) → anchor (C5)
    // Celkem 5 cyklů ve kterých se aplikuje progrese
    let state = makeState(
      { ...START_TM },
      { squat: 0, bench: 0, deadlift: 0, press: 0 },
      { squat: [], bench: [], deadlift: [], press: [] }
    )

    const summaries: CycleProgressionSummary[] = []

    for (let cycle = 1; cycle <= 5; cycle++) {
      const summary = applyCycleProgression(state, goodAmraps(cycle), cycle)
      summaries.push(summary)

      // Pokračuj s novým stavem (jako by completeWorkout uložil do DB)
      state = makeState(
        summary.newTrainingMaxes,
        summary.updatedMisses,
        summary.updatedE1rmHistory
      )
    }

    // Po 5 cyklech by mělo být TM zvýšeno 5× o příslušný inkrement
    expect(state.trainingMaxes.squat).toBe(START_TM.squat + 5 * INCREMENTS.squat)     // 100 + 25 = 125
    expect(state.trainingMaxes.bench).toBe(START_TM.bench + 5 * INCREMENTS.bench)     // 80 + 12.5 = 92.5
    expect(state.trainingMaxes.deadlift).toBe(START_TM.deadlift + 5 * INCREMENTS.deadlift) // 120 + 25 = 145
    expect(state.trainingMaxes.press).toBe(START_TM.press + 5 * INCREMENTS.press)     // 50 + 12.5 = 62.5

    // Každá progrese byla PROGRESS
    for (const summary of summaries) {
      for (const lift of summary.lifts) {
        expect(lift.action).toBe("PROGRESS")
      }
    }
  })

  it("7th week NIKDY nemění TM — applyCycleProgression se nevolá", () => {
    // Simulujeme 7th week: server-side completeWorkout nekvolá applyCycleProgression
    // při seventh_week. Testy v programs.test.ts ověřují toto chování na úrovni mutace.
    // Zde ověříme, že pokud bychom omylem zavolali applyCycleProgression s prázdnými AMRAP
    // (jak by se stalo při deloadu), výsledek je HOLD pro všechny lifty.
    const state = makeState(
      { ...START_TM },
      { squat: 0, bench: 0, deadlift: 0, press: 0 },
      { squat: [], bench: [], deadlift: [], press: [] }
    )

    // Žádné AMRAP výsledky (deload nemá žádné AMRAP)
    const summary = applyCycleProgression(state, [], 1)

    for (const lift of summary.lifts) {
      expect(lift.action).toBe("HOLD")
      expect(lift.reason).toBe("no_clean_signal")
      expect(lift.newTM).toBe(lift.oldTM)
    }

    // TM se nezměnilo
    expect(summary.newTrainingMaxes.squat).toBe(START_TM.squat)
    expect(summary.newTrainingMaxes.bench).toBe(START_TM.bench)
  })

  it("HOLD při prvním missu — TM nezměněno, misses incremented", () => {
    const state = makeState(
      { ...START_TM },
      { squat: 0, bench: 0, deadlift: 0, press: 0 },
      { squat: [], bench: [], deadlift: [], press: [] }
    )

    const summary = applyCycleProgression(state, squatMissAmraps(1), 1)

    const squatLift = summary.lifts.find(l => l.lift === "squat")!
    expect(squatLift.action).toBe("HOLD")
    expect(squatLift.reason).toBe("first_miss")
    expect(squatLift.newTM).toBe(START_TM.squat)
    expect(summary.updatedMisses.squat).toBe(1)

    // Ostatní lifty progredovaly normálně
    const benchLift = summary.lifts.find(l => l.lift === "bench")!
    expect(benchLift.action).toBe("PROGRESS")
  })

  it("RESET při druhém missu — TM sníženo o 10 %, misses reset na 0", () => {
    const state = makeState(
      { ...START_TM },
      { squat: 1, bench: 0, deadlift: 0, press: 0 },  // squat již miss=1
      { squat: [], bench: [], deadlift: [], press: [] }
    )

    const summary = applyCycleProgression(state, squatMissAmraps(2), 2)

    const squatLift = summary.lifts.find(l => l.lift === "squat")!
    expect(squatLift.action).toBe("RESET")
    expect(squatLift.reason).toBe("repeated_miss")
    expect(squatLift.newTM).toBeLessThan(START_TM.squat)
    expect(summary.updatedMisses.squat).toBe(0)  // reset
  })

  it("po HOLD (miss=1) → dalším PROGRESS → misses reset na 0", () => {
    // Cyklus 1: miss → HOLD, misses.squat = 1
    const stateAfterMiss = makeState(
      { ...START_TM },
      { squat: 1, bench: 0, deadlift: 0, press: 0 },
      { squat: [], bench: [], deadlift: [], press: [] }
    )

    // Cyklus 2: squat splní AMRAP → PROGRESS, misses.squat = 0
    const summary = applyCycleProgression(stateAfterMiss, goodAmraps(2), 2)

    const squatLift = summary.lifts.find(l => l.lift === "squat")!
    expect(squatLift.action).toBe("PROGRESS")
    expect(summary.updatedMisses.squat).toBe(0)
    expect(summary.newTrainingMaxes.squat).toBeGreaterThan(START_TM.squat)
  })

  it("simulace leader1→7th→leader2→7th→anchor→7th: TM zvýšeno právě 5× (L1×2 + L2×2 + Anchor×1)", () => {
    // Toto je kanonická simulace celého makrocyklu.
    // Fáze: leader1 (C1, C2) → 7th → leader2 (C3, C4) → 7th → anchor (C5) → 7th
    // Pro každý 3-týdenní cyklus (C1..C5) voláme applyCycleProgression.
    // 7th week se NEPOČÍTÁ (server-side completeWorkout to skipuje) — simulujeme tím, že prostě nevoláme.

    let state = makeState(
      { ...START_TM },
      { squat: 0, bench: 0, deadlift: 0, press: 0 },
      { squat: [], bench: [], deadlift: [], press: [] }
    )

    const progressionEvents: string[] = []

    // leader1: 2 cykly
    for (let c = 1; c <= 2; c++) {
      const s = applyCycleProgression(state, goodAmraps(c), c)
      progressionEvents.push(`leader1-C${c}`)
      state = makeState(s.newTrainingMaxes, s.updatedMisses, s.updatedE1rmHistory)
    }
    // 7th week po leader1: NE VOLÁME applyCycleProgression
    const tmAfterLeader1_7th = { ...state.trainingMaxes }

    // leader2: 2 cykly
    for (let c = 3; c <= 4; c++) {
      const s = applyCycleProgression(state, goodAmraps(c), c)
      progressionEvents.push(`leader2-C${c}`)
      state = makeState(s.newTrainingMaxes, s.updatedMisses, s.updatedE1rmHistory)
    }
    // 7th week po leader2: NE VOLÁME

    // anchor: 1 cyklus
    const s5 = applyCycleProgression(state, goodAmraps(5), 5)
    progressionEvents.push(`anchor-C5`)
    state = makeState(s5.newTrainingMaxes, s5.updatedMisses, s5.updatedE1rmHistory)
    // 7th week po anchor: NE VOLÁME

    // Ověření počtu progression eventů
    expect(progressionEvents).toHaveLength(5)

    // TM bylo zvýšeno 5× o příslušný inkrement
    expect(state.trainingMaxes.squat).toBe(START_TM.squat + 5 * INCREMENTS.squat)
    expect(state.trainingMaxes.bench).toBe(START_TM.bench + 5 * INCREMENTS.bench)
    expect(state.trainingMaxes.deadlift).toBe(START_TM.deadlift + 5 * INCREMENTS.deadlift)
    expect(state.trainingMaxes.press).toBe(START_TM.press + 5 * INCREMENTS.press)

    // 7th week nezvýšilo TM (TM po 7th == TM před 7th — overřeno pro 1. 7th week)
    // Squat po leader1-C2: 100 + 2×5 = 110
    expect(tmAfterLeader1_7th.squat).toBe(START_TM.squat + 2 * INCREMENTS.squat)
  })
})
