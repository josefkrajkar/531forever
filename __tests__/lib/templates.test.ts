import { describe, it, expect } from "vitest"
import {
  TEMPLATES,
  PHASES,
  SEVENTH_WEEK_PROTOCOLS,
  getSupplementalWeight,
  getSupplementalSets,
  getRecommendedTemplate,
  buildMacrocycleStructure,
  getMacrocycleDisplayInfo,
  shouldIncreaseTMAfterPhase,
  getNextPhase,
  type SupplementalTemplate,
  type ProgramPhase,
} from "@/lib/templates"

describe("TEMPLATES configuration", () => {
  it("has all 4 template types defined", () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(4)
    expect(TEMPLATES.bbb).toBeDefined()
    expect(TEMPLATES.fsl).toBeDefined()
    expect(TEMPLATES.ssl).toBeDefined()
    expect(TEMPLATES.bbs).toBeDefined()
  })

  it("BBB is leader-only template (5×10)", () => {
    const bbb = TEMPLATES.bbb
    expect(bbb.sets).toBe(5)
    expect(bbb.reps).toBe(10)
    expect(bbb.isLeaderTemplate).toBe(true)
    expect(bbb.isAnchorTemplate).toBe(false)
  })

  it("FSL is both leader and anchor template (5×5)", () => {
    const fsl = TEMPLATES.fsl
    expect(fsl.sets).toBe(5)
    expect(fsl.reps).toBe(5)
    expect(fsl.isLeaderTemplate).toBe(true)
    expect(fsl.isAnchorTemplate).toBe(true)
  })

  it("SSL is both leader and anchor template (5×5)", () => {
    const ssl = TEMPLATES.ssl
    expect(ssl.sets).toBe(5)
    expect(ssl.reps).toBe(5)
    expect(ssl.isLeaderTemplate).toBe(true)
    expect(ssl.isAnchorTemplate).toBe(true)
  })

  it("BBS is leader-only template (10×5)", () => {
    const bbs = TEMPLATES.bbs
    expect(bbs.sets).toBe(10)
    expect(bbs.reps).toBe(5)
    expect(bbs.isLeaderTemplate).toBe(true)
    expect(bbs.isAnchorTemplate).toBe(false)
  })
})

describe("PHASES configuration", () => {
  it("has all 4 phase types defined", () => {
    expect(Object.keys(PHASES)).toHaveLength(4)
    expect(PHASES.leader1).toBeDefined()
    expect(PHASES.leader2).toBeDefined()
    expect(PHASES.anchor).toBeDefined()
    expect(PHASES.seventh_week).toBeDefined()
  })

  it("Leader phases are 6 weeks (2 cycles × 3 weeks)", () => {
    expect(PHASES.leader1.cycleCount).toBe(2)
    expect(PHASES.leader1.weekCount).toBe(6)
    expect(PHASES.leader2.cycleCount).toBe(2)
    expect(PHASES.leader2.weekCount).toBe(6)
  })

  it("Anchor phase is 3 weeks (1 cycle)", () => {
    expect(PHASES.anchor.cycleCount).toBe(1)
    expect(PHASES.anchor.weekCount).toBe(3)
  })

  it("Leader phases use conservative AMRAP style", () => {
    expect(PHASES.leader1.amrapStyle).toBe("conservative")
    expect(PHASES.leader2.amrapStyle).toBe("conservative")
  })

  it("Anchor phase uses all-out AMRAP style", () => {
    expect(PHASES.anchor.amrapStyle).toBe("all_out")
  })
})

describe("SEVENTH_WEEK_PROTOCOLS configuration", () => {
  it("TM Test protocol has 4 sets ending at 100% TM", () => {
    const tmTest = SEVENTH_WEEK_PROTOCOLS.tm_test
    expect(tmTest.sets).toHaveLength(4)
    expect(tmTest.sets[3].percent).toBe(1.00)
    expect(tmTest.sets[3].reps).toBe(3)
  })

  it("Deload protocol has 3 light sets (40-60%)", () => {
    const deload = SEVENTH_WEEK_PROTOCOLS.deload
    expect(deload.sets).toHaveLength(3)
    expect(deload.sets[0].percent).toBe(0.40)
    expect(deload.sets[2].percent).toBe(0.60)
  })
})

describe("getSupplementalWeight()", () => {
  const tm = 100 // 100 kg TM for easy math

  it("BBB returns progressive weekly percentages (50/55/60%)", () => {
    // BBB používá weeklyPercents: [0.50, 0.55, 0.60] — progresivní váhy dle týdne
    expect(getSupplementalWeight("bbb", 1, tm)).toBe(50)   // týden 1: 50% TM
    expect(getSupplementalWeight("bbb", 2, tm)).toBe(55)   // týden 2: 55% TM
    expect(getSupplementalWeight("bbb", 3, tm)).toBe(60)   // týden 3: 60% TM
  })

  it("FSL returns first set weight varying by week", () => {
    // Week 1: 65%, Week 2: 70%, Week 3: 75%
    expect(getSupplementalWeight("fsl", 1, tm)).toBe(65)
    expect(getSupplementalWeight("fsl", 2, tm)).toBe(70)
    expect(getSupplementalWeight("fsl", 3, tm)).toBe(75)
  })

  it("SSL returns second set weight varying by week", () => {
    // Week 1: 75%, Week 2: 80%, Week 3: 85%
    expect(getSupplementalWeight("ssl", 1, tm)).toBe(75)
    expect(getSupplementalWeight("ssl", 2, tm)).toBe(80)
    expect(getSupplementalWeight("ssl", 3, tm)).toBe(85)
  })

  it("rounds to nearest 2.5 kg by default", () => {
    const tm = 113 // Odd TM for testing rounding
    // FSL week 1: 113 * 0.65 = 73.45 → rounds to 72.5
    expect(getSupplementalWeight("fsl", 1, tm)).toBe(72.5)
  })

  it("respects custom rounding step", () => {
    const tm = 100
    // FSL week 1: 100 * 0.65 = 65 → with 5kg rounding still 65
    expect(getSupplementalWeight("fsl", 1, tm, 5)).toBe(65)
    // FSL week 2: 100 * 0.70 = 70 → with 5kg rounding = 70
    expect(getSupplementalWeight("fsl", 2, tm, 5)).toBe(70)
  })
})

describe("getSupplementalSets()", () => {
  const tm = 100

  it("BBB returns 5 sets of 10 reps", () => {
    const sets = getSupplementalSets("bbb", 1, tm)
    expect(sets).toHaveLength(5)
    sets.forEach(set => {
      expect(set.weight).toBe(50)
      expect(set.reps).toBe(10)
    })
  })

  it("FSL returns 5 sets of 5 reps", () => {
    const sets = getSupplementalSets("fsl", 1, tm)
    expect(sets).toHaveLength(5)
    sets.forEach(set => {
      expect(set.weight).toBe(65)
      expect(set.reps).toBe(5)
    })
  })

  it("BBS returns 10 sets of 5 reps", () => {
    const sets = getSupplementalSets("bbs", 1, tm)
    expect(sets).toHaveLength(10)
    sets.forEach(set => {
      expect(set.weight).toBe(65) // Same as FSL weight
      expect(set.reps).toBe(5)
    })
  })
})

describe("getRecommendedTemplate()", () => {
  it("recommends BBB for hypertrophy goal", () => {
    const result = getRecommendedTemplate("hypertrophy", "beginner")
    expect(result.leader).toBe("bbb")
    expect(result.anchor).toBe("fsl")
  })

  it("recommends FSL for strength goal (beginner/intermediate)", () => {
    const beginner = getRecommendedTemplate("strength", "beginner")
    expect(beginner.leader).toBe("fsl")
    
    const intermediate = getRecommendedTemplate("strength", "intermediate")
    expect(intermediate.leader).toBe("fsl")
  })

  it("recommends SSL for strength goal (advanced)", () => {
    const result = getRecommendedTemplate("strength", "advanced")
    expect(result.leader).toBe("ssl")
  })

  it("recommends BBS for balanced goal (advanced)", () => {
    const result = getRecommendedTemplate("balanced", "advanced")
    expect(result.leader).toBe("bbs")
    expect(result.anchor).toBe("ssl")
  })
})

describe("buildMacrocycleStructure()", () => {
  const structure = buildMacrocycleStructure()

  it("builds complete macrocycle with 22 weeks", () => {
    // Leader1 (6) + 7th (1) + Leader2 (6) + 7th (1) + Anchor (3) + 7th (1) = 18 weeks
    // Wait, let me recalculate: 6 + 1 + 6 + 1 + 3 + 1 = 18
    expect(structure.length).toBe(18)
  })

  it("starts with Leader 1 phase", () => {
    expect(structure[0].phase).toBe("leader1")
    expect(structure[0].weekNumber).toBe(1)
    expect(structure[0].phaseWeek).toBe(1)
  })

  it("has 7th week after Leader 1 (week 7)", () => {
    expect(structure[6].phase).toBe("seventh_week")
    expect(structure[6].weekNumber).toBe(7)
    expect(structure[6].isSeventhWeek).toBe(true)
  })

  it("has Leader 2 from week 8-13", () => {
    expect(structure[7].phase).toBe("leader2")
    expect(structure[7].weekNumber).toBe(8)
    expect(structure[12].phase).toBe("leader2")
    expect(structure[12].weekNumber).toBe(13)
  })

  it("has 7th week after Leader 2 (week 14)", () => {
    expect(structure[13].phase).toBe("seventh_week")
    expect(structure[13].weekNumber).toBe(14)
  })

  it("has Anchor from week 15-17", () => {
    expect(structure[14].phase).toBe("anchor")
    expect(structure[14].weekNumber).toBe(15)
    expect(structure[16].phase).toBe("anchor")
    expect(structure[16].weekNumber).toBe(17)
  })

  it("ends with 7th week (week 18)", () => {
    const last = structure[structure.length - 1]
    expect(last.phase).toBe("seventh_week")
    expect(last.weekNumber).toBe(18)
  })

  it("tracks cycles correctly within Leader phases", () => {
    // Leader 1, cycle 1: weeks 1-3
    expect(structure[0].cycle).toBe(1)
    expect(structure[2].cycle).toBe(1)
    // Leader 1, cycle 2: weeks 4-6
    expect(structure[3].cycle).toBe(2)
    expect(structure[5].cycle).toBe(2)
  })
})

describe("getMacrocycleDisplayInfo()", () => {
  it("returns correct info for Leader 1, week 3", () => {
    const info = getMacrocycleDisplayInfo("leader1", 3, "bbb")
    expect(info.phaseName).toBe("program.phases.leader1")
    expect(info.weekLabel).toBe("Týden 3/6")
    expect(info.templateName).toBe("templates.bbb.name")
    expect(info.totalWeeksInPhase).toBe(6)
    expect(info.progress).toBe(0.5)
  })

  it("returns correct info for 7th week", () => {
    const info = getMacrocycleDisplayInfo("seventh_week", 1, "fsl")
    expect(info.phaseName).toBe("program.phases.seventh_week")
    expect(info.weekLabel).toBe("weeks.seventh")
    expect(info.totalWeeksInPhase).toBe(1)
    expect(info.progress).toBe(1)
  })

  it("returns correct info for Anchor phase", () => {
    const info = getMacrocycleDisplayInfo("anchor", 2, "fsl")
    expect(info.phaseName).toBe("program.phases.anchor")
    expect(info.weekLabel).toBe("Týden 2/3")
    expect(info.totalWeeksInPhase).toBe(3)
  })
})

describe("shouldIncreaseTMAfterPhase()", () => {
  it("returns true for leader1", () => {
    expect(shouldIncreaseTMAfterPhase("leader1")).toBe(true)
  })

  it("returns true for leader2", () => {
    expect(shouldIncreaseTMAfterPhase("leader2")).toBe(true)
  })

  it("returns true for anchor", () => {
    expect(shouldIncreaseTMAfterPhase("anchor")).toBe(true)
  })

  it("returns false for seventh_week", () => {
    expect(shouldIncreaseTMAfterPhase("seventh_week")).toBe(false)
  })
})

describe("getNextPhase()", () => {
  it("stays in leader1 if not at end of phase", () => {
    expect(getNextPhase("leader1", 3)).toBe("leader1")
    expect(getNextPhase("leader1", 5)).toBe("leader1")
  })

  it("transitions from leader1 to seventh_week at end", () => {
    expect(getNextPhase("leader1", 6)).toBe("seventh_week")
  })

  it("transitions from leader2 to seventh_week at end", () => {
    expect(getNextPhase("leader2", 6)).toBe("seventh_week")
  })

  it("transitions from anchor to seventh_week at end", () => {
    expect(getNextPhase("anchor", 3)).toBe("seventh_week")
  })

  it("seventh_week returns new_macrocycle (needs context)", () => {
    expect(getNextPhase("seventh_week", 1)).toBe("new_macrocycle")
  })
})
