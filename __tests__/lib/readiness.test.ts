/**
 * Testy pro lib/readiness.ts — deterministická readiness logika.
 *
 * Pokrývá:
 * - computeReadinessScore: plné skóre, hranice pásem komponent, chybějící
 *   metriky + renormalizace, žádná data → null, determinismus
 * - decideReadinessBand: hranice 80/60/40 + 5/3/1-native doporučení
 * - computeBaseline: rolling window dle asOfDate, málo dat, SD, dělení nulou
 */

import { describe, it, expect } from "vitest"
import {
  computeReadinessScore,
  decideReadinessBand,
  computeBaseline,
  READINESS_WEIGHTS,
  type ReadinessBaseline,
  type ReadinessHistoryEntry,
} from "@/lib/readiness"

const FULL_BASELINE: ReadinessBaseline = {
  hrv: { mean: 60, sd: 10 },
  restingHr: { mean: 50 },
}

describe("decideReadinessBand", () => {
  it("mapuje hranice pásem správně", () => {
    expect(decideReadinessBand(100)).toEqual({ band: "high", recommendation: "push_pr" })
    expect(decideReadinessBand(80)).toEqual({ band: "high", recommendation: "push_pr" })
    expect(decideReadinessBand(79)).toEqual({ band: "good", recommendation: "on_plan" })
    expect(decideReadinessBand(60)).toEqual({ band: "good", recommendation: "on_plan" })
    expect(decideReadinessBand(59)).toEqual({ band: "moderate", recommendation: "grind_min_reps" })
    expect(decideReadinessBand(40)).toEqual({ band: "moderate", recommendation: "grind_min_reps" })
    expect(decideReadinessBand(39)).toEqual({ band: "low", recommendation: "consider_deload" })
    expect(decideReadinessBand(0)).toEqual({ band: "low", recommendation: "consider_deload" })
  })

  it("doporučení NIKDY není o snižování váhy (jen 5/3/1-native enumy)", () => {
    const valid = new Set(["push_pr", "on_plan", "grind_min_reps", "consider_deload"])
    for (let s = 0; s <= 100; s += 1) {
      expect(valid.has(decideReadinessBand(s).recommendation)).toBe(true)
    }
  })
})

describe("computeReadinessScore — plné a prázdné", () => {
  it("ideální signály → 100, high, push_pr", () => {
    const score = computeReadinessScore(
      { hrvMs: 65, restingHrBpm: 49, sleepHours: 8, sleepQuality: 90, subjectiveFeel: "great" },
      FULL_BASELINE
    )
    expect(score).not.toBeNull()
    expect(score!.total).toBe(100)
    expect(score!.band).toBe("high")
    expect(score!.recommendation).toBe("push_pr")
  })

  it("žádná použitelná data → null", () => {
    expect(computeReadinessScore({}, FULL_BASELINE)).toBeNull()
    // HRV/RHR bez baseline + žádné spánek/pocit → null
    expect(computeReadinessScore({ hrvMs: 60, restingHrBpm: 50 })).toBeNull()
  })

  it("nejhorší signály → 0, low, consider_deload", () => {
    const score = computeReadinessScore(
      { hrvMs: 40, restingHrBpm: 56, sleepHours: 4, subjectiveFeel: "bad" },
      FULL_BASELINE
    )
    expect(score!.total).toBe(0)
    expect(score!.band).toBe("low")
    expect(score!.recommendation).toBe("consider_deload")
  })
})

describe("computeReadinessScore — hranice komponent", () => {
  it("HRV pásma vůči baseline (mean 60, sd 10)", () => {
    const sleepFull = { sleepHours: 8 } // doplněk, ať skóre není jen HRV
    // 55 = mean − 0.5SD → plných 40
    expect(computeReadinessScore({ hrvMs: 55, ...sleepFull }, FULL_BASELINE)!.components.hrv.points).toBe(40)
    // 54 (mezi −1SD a −0.5SD) → 20
    expect(computeReadinessScore({ hrvMs: 54, ...sleepFull }, FULL_BASELINE)!.components.hrv.points).toBe(20)
    // 50 = mean − 1SD → 20
    expect(computeReadinessScore({ hrvMs: 50, ...sleepFull }, FULL_BASELINE)!.components.hrv.points).toBe(20)
    // 49 (< −1SD) → 0
    expect(computeReadinessScore({ hrvMs: 49, ...sleepFull }, FULL_BASELINE)!.components.hrv.points).toBe(0)
    // nad baseline → plných 40
    expect(computeReadinessScore({ hrvMs: 80, ...sleepFull }, FULL_BASELINE)!.components.hrv.points).toBe(40)
  })

  it("HRV bez baseline (nebo sd<=0) → not present", () => {
    const noBase = computeReadinessScore({ hrvMs: 60, sleepHours: 8 })
    expect(noBase!.components.hrv.present).toBe(false)
    const zeroSd = computeReadinessScore({ hrvMs: 60, sleepHours: 8 }, { hrv: { mean: 60, sd: 0 } })
    expect(zeroSd!.components.hrv.present).toBe(false)
  })

  it("klidový tep pásma (mean 50 → +2 % = 51, +5 % = 52.5)", () => {
    const s = { sleepHours: 8 }
    expect(computeReadinessScore({ restingHrBpm: 51, ...s }, FULL_BASELINE)!.components.restingHr.points).toBe(20)
    expect(computeReadinessScore({ restingHrBpm: 52, ...s }, FULL_BASELINE)!.components.restingHr.points).toBe(10)
    expect(computeReadinessScore({ restingHrBpm: 52.5, ...s }, FULL_BASELINE)!.components.restingHr.points).toBe(10)
    expect(computeReadinessScore({ restingHrBpm: 53, ...s }, FULL_BASELINE)!.components.restingHr.points).toBe(0)
  })

  it("spánek pásma (hodiny + volitelná kvalita)", () => {
    const feel = { subjectiveFeel: "normal" as const }
    expect(computeReadinessScore({ sleepHours: 7, ...feel })!.components.sleep.points).toBe(20)
    expect(computeReadinessScore({ sleepHours: 8, sleepQuality: 90, ...feel })!.components.sleep.points).toBe(20)
    // 7h ale kvalita 70 → spadne na druhý práh → 10
    expect(computeReadinessScore({ sleepHours: 7, sleepQuality: 70, ...feel })!.components.sleep.points).toBe(10)
    // 7h kvalita 50 → 0
    expect(computeReadinessScore({ sleepHours: 7, sleepQuality: 50, ...feel })!.components.sleep.points).toBe(0)
    expect(computeReadinessScore({ sleepHours: 6, ...feel })!.components.sleep.points).toBe(10)
    expect(computeReadinessScore({ sleepHours: 5.9, ...feel })!.components.sleep.points).toBe(0)
    // přesné hranice kvality: 75 → plné, 74 → partial; 60 → partial, 59 → 0
    expect(computeReadinessScore({ sleepHours: 7, sleepQuality: 75, ...feel })!.components.sleep.points).toBe(20)
    expect(computeReadinessScore({ sleepHours: 7, sleepQuality: 74, ...feel })!.components.sleep.points).toBe(10)
    expect(computeReadinessScore({ sleepHours: 6, sleepQuality: 60, ...feel })!.components.sleep.points).toBe(10)
    expect(computeReadinessScore({ sleepHours: 6, sleepQuality: 59, ...feel })!.components.sleep.points).toBe(0)
  })

  it("subjektivní pocit great/normal/bad → 20/10/0", () => {
    expect(computeReadinessScore({ subjectiveFeel: "great" })!.components.subjective.points).toBe(20)
    expect(computeReadinessScore({ subjectiveFeel: "normal" })!.components.subjective.points).toBe(10)
    expect(computeReadinessScore({ subjectiveFeel: "bad" })!.components.subjective.points).toBe(0)
  })
})

describe("computeReadinessScore — renormalizace chybějících metrik", () => {
  it("jen subjektivní pocit se renormalizuje na 0–100", () => {
    expect(computeReadinessScore({ subjectiveFeel: "great" })!.total).toBe(100) // 20/20
    expect(computeReadinessScore({ subjectiveFeel: "normal" })!.total).toBe(50) //  10/20
    expect(computeReadinessScore({ subjectiveFeel: "bad" })!.total).toBe(0) //    0/20
  })

  it("HRV(20) + subjektivní(10) → renorm 30/60 = 50", () => {
    // HRV 54 = 20 b (mezi −1 a −0.5 SD), subjektivní normal = 10 b; available = 40+20 = 60
    const score = computeReadinessScore({ hrvMs: 54, subjectiveFeel: "normal" }, FULL_BASELINE)
    expect(score!.components.hrv.present).toBe(true)
    expect(score!.components.sleep.present).toBe(false)
    expect(score!.total).toBe(50)
  })

  it("chybějící komponenty jsou present:false a nepenalizují", () => {
    const score = computeReadinessScore({ sleepHours: 8 })!
    expect(score.components.sleep.present).toBe(true)
    expect(score.components.hrv.present).toBe(false)
    expect(score.components.restingHr.present).toBe(false)
    expect(score.components.subjective.present).toBe(false)
    expect(score.total).toBe(100) // 20/20
  })

  it("je deterministický (stejný vstup → stejný výstup)", () => {
    const input = { hrvMs: 58, restingHrBpm: 51, sleepHours: 7, subjectiveFeel: "normal" as const }
    const a = computeReadinessScore(input, FULL_BASELINE)
    const b = computeReadinessScore(input, FULL_BASELINE)
    expect(a).toEqual(b)
  })

  it("nemutuje vstupní signals objekt", () => {
    const input = { hrvMs: 58, restingHrBpm: 51, sleepHours: 7, subjectiveFeel: "normal" as const }
    const snapshot = { ...input }
    computeReadinessScore(input, FULL_BASELINE)
    expect(input).toEqual(snapshot)
  })

  it("veřejné váhy mají součet 100", () => {
    const sum =
      READINESS_WEIGHTS.hrv +
      READINESS_WEIGHTS.restingHr +
      READINESS_WEIGHTS.sleep +
      READINESS_WEIGHTS.subjective
    expect(sum).toBe(100)
  })
})

describe("computeBaseline", () => {
  const history: ReadinessHistoryEntry[] = [
    { date: "2026-06-01", signals: { hrvMs: 50, restingHrBpm: 48 } },
    { date: "2026-06-02", signals: { hrvMs: 60, restingHrBpm: 50 } },
    { date: "2026-06-03", signals: { hrvMs: 55, restingHrBpm: 52 } },
  ]

  it("spočítá mean a SD (n−1) pro HRV a mean pro klidový tep", () => {
    const base = computeBaseline(history, "2026-06-10")
    // hrv mean = 55, variance = (25+25+0)/2 = 25 → sd = 5
    expect(base.hrv).toEqual({ mean: 55, sd: 5 })
    expect(base.restingHr).toEqual({ mean: 50 })
  })

  it("vyloučí záznamy s datem >= asOfDate", () => {
    const withFuture: ReadinessHistoryEntry[] = [
      ...history,
      { date: "2026-06-10", signals: { hrvMs: 999, restingHrBpm: 999 } }, // == asOfDate → vyloučeno
      { date: "2026-06-11", signals: { hrvMs: 999, restingHrBpm: 999 } }, // > asOfDate → vyloučeno
    ]
    const base = computeBaseline(withFuture, "2026-06-10")
    expect(base.hrv!.mean).toBe(55) // 999 se nezapočítalo
  })

  it("okno bere jen posledních windowDays záznamů (dle data sestupně)", () => {
    const many: ReadinessHistoryEntry[] = [
      { date: "2026-06-01", signals: { restingHrBpm: 40 } },
      { date: "2026-06-02", signals: { restingHrBpm: 40 } },
      { date: "2026-06-08", signals: { restingHrBpm: 60 } },
      { date: "2026-06-09", signals: { restingHrBpm: 60 } },
      { date: "2026-06-09", signals: { restingHrBpm: 60 } },
    ]
    // windowDays 3 → poslední tři (8., 9., 9.) → mean 60, ne ovlivněno starými 40
    const base = computeBaseline(many, "2026-06-10", 3)
    expect(base.restingHr).toEqual({ mean: 60 })
  })

  it("málo vzorků (<3) → metrika se vynechá", () => {
    const few: ReadinessHistoryEntry[] = [
      { date: "2026-06-01", signals: { hrvMs: 50 } },
      { date: "2026-06-02", signals: { hrvMs: 60 } },
    ]
    const base = computeBaseline(few, "2026-06-10")
    expect(base.hrv).toBeUndefined()
    expect(base.restingHr).toBeUndefined()
  })

  it("nulová variabilita HRV (sd=0) → HRV baseline se vynechá", () => {
    const identical: ReadinessHistoryEntry[] = [
      { date: "2026-06-01", signals: { hrvMs: 55 } },
      { date: "2026-06-02", signals: { hrvMs: 55 } },
      { date: "2026-06-03", signals: { hrvMs: 55 } },
    ]
    const base = computeBaseline(identical, "2026-06-10")
    expect(base.hrv).toBeUndefined()
  })

  it("prázdná historie → prázdný baseline (žádný pád)", () => {
    expect(computeBaseline([], "2026-06-10")).toEqual({})
  })
})
