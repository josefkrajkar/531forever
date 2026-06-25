/**
 * Testy pro lib/upcoming.ts — náhled nadcházejících tréninků
 *
 * Pokrývají:
 * - Postup přes hranici týdne (day 4 → week+1 day 1)
 * - Postup přes hranici cyklu (week 3 → cycle+1 week 1) + tmMayChange
 * - Vstup do seventh_week po 2. cyklu leader1
 * - Výstup ze seventh_week do další fáze (leader2)
 * - anchor → seventh_week → nový makrocyklus (leader1)
 * - Správné váhy z TM pro každý týden (buildMainSets)
 * - tmMayChange flag
 * - Počet výsledků odpovídá parametru count
 */

import { describe, it, expect } from "vitest"
import { getUpcomingWorkouts, type ProgramSnapshot } from "@/lib/upcoming"

// ============================================================================
// Test fixtures
// ============================================================================

const TM = {
  squat: 100,
  bench: 80,
  deadlift: 120,
  press: 60,
}

const DEFAULT_SPLIT = ["squat", "bench", "deadlift", "press"]

function makeProgram(overrides: Partial<ProgramSnapshot> = {}): ProgramSnapshot {
  return {
    cycle: 1,
    week: 1,
    dayIndex: 0,
    programPhase: "leader1",
    phaseWeek: 1,
    phaseBeforeSeventhWeek: null,
    trainingMaxes: { ...TM },
    split: DEFAULT_SPLIT,
    supplementalTemplate: "bbb",
    seventhWeekType: null,
    rounding: 2.5,
    ...overrides,
  }
}

// ============================================================================
// 1. Základní funkčnost — počet výsledků a první trénink
// ============================================================================

describe("getUpcomingWorkouts() — základní funkčnost", () => {
  it("vrátí count položek (default 8)", () => {
    const result = getUpcomingWorkouts(makeProgram())
    expect(result).toHaveLength(8)
  })

  it("vrátí count=4 pokud je explicitně nastaveno", () => {
    const result = getUpcomingWorkouts(makeProgram(), 4)
    expect(result).toHaveLength(4)
  })

  it("první položka je NÁSLEDUJÍCÍ trénink po aktuální pozici (dayIndex posunuto o 1)", () => {
    // Aktuální pozice: cycle=1, week=1, dayIndex=0 (squat)
    // Následující: dayIndex=1 (bench)
    const result = getUpcomingWorkouts(makeProgram({ dayIndex: 0 }))
    expect(result[0].dayIndex).toBe(1)
    expect(result[0].lift).toBe("bench")
  })

  it("index v poli odpovídá pořadí (0-based)", () => {
    const result = getUpcomingWorkouts(makeProgram(), 4)
    result.forEach((w, i) => {
      expect(w.index).toBe(i)
    })
  })

  it("každý workout má liftDisplayName jako i18n klíč", () => {
    const result = getUpcomingWorkouts(makeProgram())
    const i18nKeys = new Set(["lifts.squat", "lifts.bench", "lifts.deadlift", "lifts.press"])
    for (const w of result) {
      expect(i18nKeys.has(w.liftDisplayName)).toBe(true)
    }
  })
})

// ============================================================================
// 2. Postup přes hranici týdne (day 4 → week+1 day 1)
// ============================================================================

describe("getUpcomingWorkouts() — postup přes hranici týdne", () => {
  it("po day 3 se posune na day 0 týdne+1", () => {
    // Aktuální: week=1, dayIndex=3 (press) → další: week=2, dayIndex=0 (squat)
    const program = makeProgram({ week: 1, dayIndex: 3, phaseWeek: 1 })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].week).toBe(2)
    expect(result[0].dayIndex).toBe(0)
    expect(result[0].lift).toBe("squat")
  })

  it("phaseWeek se inkrementuje po přechodu týdne", () => {
    // Aktuální: week=1, dayIndex=3, phaseWeek=1 → po přechodu: phaseWeek=2
    const program = makeProgram({ week: 1, dayIndex: 3, phaseWeek: 1 })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phaseWeek).toBe(2)
  })

  it("fáze zůstane leader1 uprostřed fáze", () => {
    // phaseWeek=2, přejdeme do phaseWeek=3 — stále leader1
    const program = makeProgram({ week: 2, dayIndex: 3, phaseWeek: 2 })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("leader1")
    expect(result[0].phaseWeek).toBe(3)
  })

  it("sekvence 4 dnů správně rotuje přes celý split", () => {
    // dayIndex=0 → výsledky: 1, 2, 3, 0 (rotace přes split)
    const program = makeProgram({ week: 1, dayIndex: 0 })
    const result = getUpcomingWorkouts(program, 4)
    expect(result[0].dayIndex).toBe(1) // bench
    expect(result[1].dayIndex).toBe(2) // deadlift
    expect(result[2].dayIndex).toBe(3) // press
    expect(result[3].dayIndex).toBe(0) // squat (nový týden)
  })
})

// ============================================================================
// 3. Postup přes hranici cyklu (week 3 → cycle+1 week 1) + tmMayChange
// ============================================================================

describe("getUpcomingWorkouts() — postup přes hranici cyklu", () => {
  it("po week=3 dayIndex=3 se cyklus inkrementuje", () => {
    // Aktuální: cycle=1, week=3, dayIndex=3 → první výsledek: cycle=2, week=1, dayIndex=0
    const program = makeProgram({ cycle: 1, week: 3, dayIndex: 3, phaseWeek: 3 })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].cycle).toBe(2)
    expect(result[0].week).toBe(1)
    expect(result[0].dayIndex).toBe(0)
  })

  it("tmMayChange=false pro tréninky v aktuálním cyklu", () => {
    // Aktuální: week=1, dayIndex=0 → první 3 výsledky jsou v cycle=1
    const program = makeProgram({ cycle: 1, week: 1, dayIndex: 0 })
    const result = getUpcomingWorkouts(program, 3)
    // Všechny jsou v cyklu 1 → tmMayChange=false
    result.forEach((w) => {
      if (w.cycle === 1) {
        expect(w.tmMayChange).toBe(false)
      }
    })
  })

  it("tmMayChange=true pro tréninky v cyklech > aktuálního (po hranici cyklu)", () => {
    // Aktuální: week=3, dayIndex=3 → po prvním výsledku jsme v cycle=2 → tmMayChange=true
    const program = makeProgram({ cycle: 1, week: 3, dayIndex: 3, phaseWeek: 3 })
    const result = getUpcomingWorkouts(program, 4)
    // Výsledky jsou v cycle=2 (po překročení hranice) → tmMayChange=true
    result.forEach((w) => {
      expect(w.tmMayChange).toBe(true)
    })
  })

  it("tmMayChange=false pro seventh_week (TM se nemění)", () => {
    // Ve seventh_week se TM nemění bez ohledu na cycle
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "leader1",
      week: 1,
      dayIndex: 0,
    })
    const result = getUpcomingWorkouts(program, 4)
    result.forEach((w) => {
      if (w.isSeventhWeek) {
        expect(w.tmMayChange).toBe(false)
      }
    })
  })
})

// ============================================================================
// 4. Vstup do seventh_week po 2. cyklu leader1 (phaseWeek=6)
// ============================================================================

describe("getUpcomingWorkouts() — vstup do seventh_week", () => {
  it("po dokončení 6. phaseWeek leader1 přejde do seventh_week", () => {
    // Aktuální: leader1, phaseWeek=6, week=3, dayIndex=3
    // Po přechodu: seventh_week, phaseWeek=1
    const program = makeProgram({
      programPhase: "leader1",
      phaseWeek: 6,
      week: 3,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("seventh_week")
    expect(result[0].isSeventhWeek).toBe(true)
    expect(result[0].phaseWeek).toBe(1)
  })

  it("seventh_week workout má prázdné mainSets (protokol neznámý)", () => {
    const program = makeProgram({
      programPhase: "leader1",
      phaseWeek: 6,
      week: 3,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 4)
    const swWorkout = result.find((w) => w.isSeventhWeek)
    expect(swWorkout).toBeDefined()
    // Budoucí seventh_week — protokol neznámý → prázdné mainSets
    expect(swWorkout!.mainSets).toHaveLength(0)
    expect(swWorkout!.seventhWeekProtocol).toBeNull()
    expect(swWorkout!.topSetWeight).toBeNull()
  })

  it("pokud jsme v seventh_week s vybraným tm_test, první výsledky mají mainSets", () => {
    // Aktuální: seventh_week, tm_test vybrán
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "leader1",
      week: 1,
      dayIndex: 0,
      seventhWeekType: "tm_test",
    })
    const result = getUpcomingWorkouts(program, 1)
    // Výsledek je stále v seventh_week (dayIndex=1, stejný týden)
    expect(result[0].isSeventhWeek).toBe(true)
    // protokol tm_test je zachován pro aktuální seventh_week
    expect(result[0].seventhWeekProtocol).toBe("tm_test")
    expect(result[0].mainSets.length).toBeGreaterThan(0)
  })

  it("pokud jsme v seventh_week s vybraným deload, mainSets mají lehké váhy (40/50/60%)", () => {
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "leader1",
      week: 1,
      dayIndex: 0,
      seventhWeekType: "deload",
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 60 },
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].isSeventhWeek).toBe(true)
    expect(result[0].seventhWeekProtocol).toBe("deload")
    // Deload: 40%, 50%, 60% TM pro daný lift (dayIndex=1 = bench, TM=80)
    // Ale dayIndex se posune na 1 → bench
    const sets = result[0].mainSets
    expect(sets).toHaveLength(3)
    // 40% * 80 = 32 → roundToPlate(32, 2.5) = 32.5
    // 50% * 80 = 40 → 40
    // 60% * 80 = 48 → 47.5
    expect(sets[0].weight).toBe(32.5)
    expect(sets[1].weight).toBe(40)
    expect(sets[2].weight).toBe(47.5)
  })
})

// ============================================================================
// 5. Výstup ze seventh_week do další fáze
// ============================================================================

describe("getUpcomingWorkouts() — výstup ze seventh_week", () => {
  it("po dokončení seventh_week (z leader1) přejde do leader2", () => {
    // seventh_week, phaseBeforeSeventhWeek=leader1, week=1, dayIndex=3
    // Po přechodu: leader2, phaseWeek=1
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "leader1",
      week: 1,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("leader2")
    expect(result[0].phaseWeek).toBe(1)
    expect(result[0].isSeventhWeek).toBe(false)
  })

  it("po dokončení seventh_week (z leader2) přejde do anchor", () => {
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "leader2",
      week: 1,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("anchor")
    expect(result[0].phaseWeek).toBe(1)
  })

  it("leader2 workout po seventh_week není seventh_week", () => {
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "leader1",
      week: 1,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 4)
    const leader2Workouts = result.filter((w) => w.phase === "leader2")
    expect(leader2Workouts.length).toBeGreaterThan(0)
    leader2Workouts.forEach((w) => {
      expect(w.isSeventhWeek).toBe(false)
      expect(w.mainSets.length).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// 6. Anchor → seventh_week → nový makrocyklus (leader1)
// ============================================================================

describe("getUpcomingWorkouts() — anchor → seventh_week → nový makrocyklus", () => {
  it("po dokončení anchor (phaseWeek=3) přejde do seventh_week", () => {
    // anchor, phaseWeek=3, week=3, dayIndex=3 → seventh_week
    const program = makeProgram({
      programPhase: "anchor",
      phaseWeek: 3,
      week: 3,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("seventh_week")
    expect(result[0].isSeventhWeek).toBe(true)
  })

  it("po dokončení seventh_week (z anchor) přejde do leader1 (nový makrocyklus)", () => {
    const program = makeProgram({
      programPhase: "seventh_week",
      phaseWeek: 1,
      phaseBeforeSeventhWeek: "anchor",
      week: 1,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("leader1")
    expect(result[0].phaseWeek).toBe(1)
    expect(result[0].isSeventhWeek).toBe(false)
  })

  it("plná sekvence: leader1(6 týdnů) → 7th → leader2 → 7th → anchor → 7th (obsahuje správné fáze)", () => {
    // Začínáme na začátku leader1
    const program = makeProgram({
      programPhase: "leader1",
      phaseWeek: 1,
      week: 1,
      dayIndex: 0,
      cycle: 1,
    })
    // Generujeme dost tréninků na pokrytí celého makrocyklu
    // leader1: 6 týdnů × 4 dny = 24 tréninků
    // 7th week: 4 tréninky
    // leader2: 24 tréninků
    // 7th week: 4 tréninky
    // anchor: 12 tréninků
    // 7th week: 4 tréninky
    // Celkem: 72+ tréninků; vezmeme 80
    const result = getUpcomingWorkouts(program, 80)

    // Ověříme, že se všechny fáze v sekvenci vyskytují
    const phases = result.map((w) => w.phase)
    expect(phases).toContain("leader1")
    expect(phases).toContain("seventh_week")
    expect(phases).toContain("leader2")
    expect(phases).toContain("anchor")
  })
})

// ============================================================================
// 7. Správné váhy z TM pro každý týden
// ============================================================================

describe("getUpcomingWorkouts() — správné váhy z TM", () => {
  it("week 1 (5/5/5+): váhy 65%/75%/85% TM", () => {
    // Aktuální: week=3, dayIndex=3 → next: cycle+1, week=1, day=0
    const program2 = makeProgram({
      cycle: 1,
      week: 3,
      dayIndex: 3,
      programPhase: "leader1",
      phaseWeek: 3,
    })
    const result = getUpcomingWorkouts(program2, 1)
    // Výsledek: cycle=2, week=1, dayIndex=0 (squat, TM=100)
    expect(result[0].week).toBe(1)
    expect(result[0].lift).toBe("squat")
    const sets = result[0].mainSets
    expect(sets).toHaveLength(3)
    // 65% × 100 = 65, 75% × 100 = 75, 85% × 100 = 85
    expect(sets[0].weight).toBe(65)
    expect(sets[0].targetReps).toBe(5)
    expect(sets[1].weight).toBe(75)
    expect(sets[1].targetReps).toBe(5)
    expect(sets[2].weight).toBe(85)
    expect(sets[2].targetReps).toBe(5)
    expect(sets[2].isAmrap).toBe(true)
  })

  it("week 2 (3/3/3+): váhy 70%/80%/90% TM", () => {
    // Aktuální: week=1, dayIndex=3 → next: week=2, dayIndex=0 (squat, TM=100)
    const program = makeProgram({
      week: 1,
      dayIndex: 3,
      programPhase: "leader1",
      phaseWeek: 1,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].week).toBe(2)
    expect(result[0].lift).toBe("squat")
    const sets = result[0].mainSets
    expect(sets).toHaveLength(3)
    expect(sets[0].weight).toBe(70) // 70% × 100
    expect(sets[0].targetReps).toBe(3)
    expect(sets[1].weight).toBe(80) // 80% × 100
    expect(sets[1].targetReps).toBe(3)
    expect(sets[2].weight).toBe(90) // 90% × 100
    expect(sets[2].targetReps).toBe(3)
    expect(sets[2].isAmrap).toBe(true)
  })

  it("week 3 (5/3/1+): váhy 75%/85%/95% TM", () => {
    // Aktuální: week=2, dayIndex=3 → next: week=3, dayIndex=0 (squat, TM=100)
    const program = makeProgram({
      week: 2,
      dayIndex: 3,
      programPhase: "leader1",
      phaseWeek: 2,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].week).toBe(3)
    expect(result[0].lift).toBe("squat")
    const sets = result[0].mainSets
    expect(sets).toHaveLength(3)
    expect(sets[0].weight).toBe(75)
    expect(sets[0].targetReps).toBe(5)
    expect(sets[1].weight).toBe(85)
    expect(sets[1].targetReps).toBe(3)
    expect(sets[2].weight).toBe(95)
    expect(sets[2].targetReps).toBe(1)
    expect(sets[2].isAmrap).toBe(true)
  })

  it("bench TM=80: week 1 top set = 85% × 80 = 68 kg", () => {
    // Aktuální: dayIndex=0 (squat) → next: dayIndex=1 (bench)
    const program = makeProgram({
      week: 1,
      dayIndex: 0,
      trainingMaxes: { squat: 100, bench: 80, deadlift: 120, press: 60 },
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].lift).toBe("bench")
    // 85% × 80 = 68 → roundToPlate(68, 2.5) = 67.5
    expect(result[0].topSetWeight).toBe(67.5)
  })

  it("zaokrouhluje váhy na 2.5 kg (rounding=2.5)", () => {
    // TM=87 → 85% × 87 = 73.95 → round(73.95/2.5)*2.5 = round(29.58)*2.5 = 30*2.5 = 75
    const program = makeProgram({
      week: 2,
      dayIndex: 3,
      trainingMaxes: { squat: 87, bench: 80, deadlift: 120, press: 60 },
      rounding: 2.5,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].lift).toBe("squat")
    // Všechny váhy musí být násobky 2.5
    result[0].mainSets.forEach((set) => {
      expect(set.weight % 2.5).toBe(0)
    })
  })

  it("anchor fáze: topSet v week 3 je AMRAP all-out (isAmrap=true)", () => {
    // V anchor fázi je AMRAP all-out — isAllOutAmrap by byl true
    // Pro náhled stačí ověřit isAmrap=true u posledního setu
    const program = makeProgram({
      programPhase: "anchor",
      phaseWeek: 1,
      week: 2,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 1)
    expect(result[0].phase).toBe("anchor")
    expect(result[0].week).toBe(3)
    const lastSet = result[0].mainSets[result[0].mainSets.length - 1]
    expect(lastSet.isAmrap).toBe(true)
  })
})

// ============================================================================
// 8. supplementalTemplate — přítomnost/nepřítomnost
// ============================================================================

describe("getUpcomingWorkouts() — supplementalTemplate", () => {
  it("non-seventh_week tréninky mají supplementalTemplate", () => {
    const program = makeProgram({ supplementalTemplate: "fsl" })
    const result = getUpcomingWorkouts(program, 4)
    result
      .filter((w) => !w.isSeventhWeek)
      .forEach((w) => {
        expect(w.supplementalTemplate).toBe("fsl")
      })
  })

  it("seventh_week tréninky mají supplementalTemplate=null", () => {
    const program = makeProgram({
      programPhase: "leader1",
      phaseWeek: 6,
      week: 3,
      dayIndex: 3,
    })
    const result = getUpcomingWorkouts(program, 8)
    result
      .filter((w) => w.isSeventhWeek)
      .forEach((w) => {
        expect(w.supplementalTemplate).toBeNull()
      })
  })
})

// ============================================================================
// 9. Sekvence fází v plné délce — konzistence
// ============================================================================

describe("getUpcomingWorkouts() — konzistence sekvence", () => {
  it("cycle nikdy neklesá", () => {
    const program = makeProgram({ cycle: 1, week: 1, dayIndex: 0 })
    const result = getUpcomingWorkouts(program, 20)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].cycle).toBeGreaterThanOrEqual(result[i - 1].cycle)
    }
  })

  it("fáze nepřeskakuje nevalidní hodnoty", () => {
    const validPhases = new Set(["leader1", "leader2", "anchor", "seventh_week"])
    const program = makeProgram({ cycle: 1, week: 1, dayIndex: 0 })
    const result = getUpcomingWorkouts(program, 80)
    result.forEach((w) => {
      expect(validPhases.has(w.phase)).toBe(true)
    })
  })

  it("dayIndex je vždy 0-3", () => {
    const program = makeProgram({ cycle: 1, week: 1, dayIndex: 0 })
    const result = getUpcomingWorkouts(program, 20)
    result.forEach((w) => {
      expect(w.dayIndex).toBeGreaterThanOrEqual(0)
      expect(w.dayIndex).toBeLessThanOrEqual(3)
    })
  })

  it("week je vždy 1-3 (mimo seventh_week kde je 1)", () => {
    const program = makeProgram({ cycle: 1, week: 1, dayIndex: 0 })
    const result = getUpcomingWorkouts(program, 30)
    result.forEach((w) => {
      expect(w.week).toBeGreaterThanOrEqual(1)
      expect(w.week).toBeLessThanOrEqual(3)
    })
  })
})
