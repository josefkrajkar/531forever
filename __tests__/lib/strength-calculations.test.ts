import { describe, it, expect } from "vitest"
import {
  calculateWilks,
  calculateDOTS,
  calculateBWMultiple,
  getStrengthLevel,
  getStrengthStandards,
  calculateTotal,
  getWilksDescription,
  estimateE1RM,
  normalizeGender,
} from "@/lib/strength-calculations"

describe("strength-calculations", () => {
  describe("calculateWilks", () => {
    it("returns 0 for invalid inputs", () => {
      expect(calculateWilks(0, 80, "male")).toBe(0)
      expect(calculateWilks(500, 0, "male")).toBe(0)
      expect(calculateWilks(-100, 80, "male")).toBe(0)
      expect(calculateWilks(500, -80, "male")).toBe(0)
    })

    it("calculates Wilks for male lifter", () => {
      // 80kg male with 500kg total should be around 350-400 Wilks
      const wilks = calculateWilks(500, 80, "male")
      expect(wilks).toBeGreaterThan(300)
      expect(wilks).toBeLessThan(450)
    })

    it("calculates Wilks for female lifter", () => {
      // 60kg female with 350kg total should be around 350-450 Wilks
      const wilks = calculateWilks(350, 60, "female")
      expect(wilks).toBeGreaterThan(300)
      expect(wilks).toBeLessThan(500)
    })

    it("heavier lifter needs more weight for same Wilks", () => {
      const light = calculateWilks(500, 70, "male")
      const heavy = calculateWilks(500, 100, "male")
      expect(light).toBeGreaterThan(heavy)
    })

    it("returns a number with max 2 decimal places", () => {
      const wilks = calculateWilks(500, 80, "male")
      const decimals = wilks.toString().split(".")[1]?.length ?? 0
      expect(decimals).toBeLessThanOrEqual(2)
    })
  })

  describe("calculateDOTS", () => {
    it("returns 0 for invalid inputs", () => {
      expect(calculateDOTS(0, 80, "male")).toBe(0)
      expect(calculateDOTS(500, 0, "male")).toBe(0)
    })

    it("calculates DOTS for male lifter", () => {
      const dots = calculateDOTS(500, 80, "male")
      expect(dots).toBeGreaterThan(200)
      expect(dots).toBeLessThan(500)
    })

    it("calculates DOTS for female lifter", () => {
      const dots = calculateDOTS(350, 60, "female")
      expect(dots).toBeGreaterThan(200)
      expect(dots).toBeLessThan(500)
    })

    it("DOTS and Wilks produce similar relative rankings", () => {
      // Both should show lighter lifter has higher points for same total
      const wilksLight = calculateWilks(500, 70, "male")
      const wilksHeavy = calculateWilks(500, 100, "male")
      const dotsLight = calculateDOTS(500, 70, "male")
      const dotsHeavy = calculateDOTS(500, 100, "male")

      expect(wilksLight > wilksHeavy).toBe(dotsLight > dotsHeavy)
    })
  })

  describe("calculateBWMultiple", () => {
    it("returns 0 for invalid inputs", () => {
      expect(calculateBWMultiple(0, 80)).toBe(0)
      expect(calculateBWMultiple(160, 0)).toBe(0)
    })

    it("calculates bodyweight multiple correctly", () => {
      expect(calculateBWMultiple(160, 80)).toBe(2)
      expect(calculateBWMultiple(200, 80)).toBe(2.5)
      expect(calculateBWMultiple(120, 80)).toBe(1.5)
    })

    it("rounds to 2 decimal places", () => {
      const multiple = calculateBWMultiple(167, 80) // 2.0875
      expect(multiple).toBe(2.09)
    })
  })

  describe("getStrengthLevel", () => {
    it("returns beginner key for invalid inputs", () => {
      const level = getStrengthLevel("squat", 0, 80, "male")
      expect(level.level).toBe("strengthLevels.beginner")
    })

    it("returns correct i18n key for male squat", () => {
      const bodyweight = 80

      // 0.5x BW = 40kg -> beginner
      expect(getStrengthLevel("squat", 40, bodyweight, "male").level).toBe("strengthLevels.beginner")

      // 1.0x BW = 80kg -> novice
      expect(getStrengthLevel("squat", 80, bodyweight, "male").level).toBe("strengthLevels.novice")

      // 1.5x BW = 120kg -> intermediate
      expect(getStrengthLevel("squat", 120, bodyweight, "male").level).toBe("strengthLevels.intermediate")

      // 2.0x BW = 160kg -> advanced
      expect(getStrengthLevel("squat", 160, bodyweight, "male").level).toBe("strengthLevels.advanced")

      // 2.5x BW = 200kg -> elite
      expect(getStrengthLevel("squat", 200, bodyweight, "male").level).toBe("strengthLevels.elite")
    })

    it("returns correct i18n key for female squat (lower thresholds)", () => {
      const bodyweight = 60

      // 0.5x BW = 30kg -> beginner (female threshold is 0.75x)
      expect(getStrengthLevel("squat", 30, bodyweight, "female").level).toBe("strengthLevels.beginner")

      // 0.75x BW = 45kg -> novice
      expect(getStrengthLevel("squat", 45, bodyweight, "female").level).toBe("strengthLevels.novice")

      // 2.0x BW = 120kg -> elite for female
      expect(getStrengthLevel("squat", 120, bodyweight, "female").level).toBe("strengthLevels.elite")
    })

    it("returns correct i18n key for bench press", () => {
      const bodyweight = 80

      // Bench has lower thresholds than squat
      // 1.0x BW = 80kg -> intermediate for bench
      expect(getStrengthLevel("bench", 80, bodyweight, "male").level).toBe("strengthLevels.intermediate")

      // 1.5x BW = 120kg -> advanced for bench
      expect(getStrengthLevel("bench", 120, bodyweight, "male").level).toBe("strengthLevels.advanced")
    })

    it("returns correct i18n key for deadlift", () => {
      const bodyweight = 80

      // Deadlift has higher thresholds
      // 1.75x BW = 140kg -> intermediate
      expect(getStrengthLevel("deadlift", 140, bodyweight, "male").level).toBe("strengthLevels.intermediate")

      // 2.75x BW = 220kg -> elite
      expect(getStrengthLevel("deadlift", 220, bodyweight, "male").level).toBe("strengthLevels.elite")
    })

    it("returns correct i18n key for press", () => {
      const bodyweight = 80

      // Press has lowest thresholds
      // 0.75x BW = 60kg -> intermediate
      expect(getStrengthLevel("press", 60, bodyweight, "male").level).toBe("strengthLevels.intermediate")

      // 1.0x BW = 80kg -> advanced
      expect(getStrengthLevel("press", 80, bodyweight, "male").level).toBe("strengthLevels.advanced")
    })

    it("includes color and description i18n key in result", () => {
      const level = getStrengthLevel("squat", 160, 80, "male")
      expect(level.color).toBeTruthy()
      expect(level.description).toBe("strengthLevels.advanced_desc")
    })
  })

  describe("getStrengthStandards", () => {
    it("returns 5 levels for each lift", () => {
      expect(getStrengthStandards("squat", "male")).toHaveLength(5)
      expect(getStrengthStandards("bench", "male")).toHaveLength(5)
      expect(getStrengthStandards("deadlift", "female")).toHaveLength(5)
    })

    it("returns standards sorted by minMultiple", () => {
      const standards = getStrengthStandards("squat", "male")
      for (let i = 1; i < standards.length; i++) {
        expect(standards[i].minMultiple).toBeGreaterThan(standards[i - 1].minMultiple)
      }
    })

    it("falls back to squat standards for unknown lift", () => {
      const unknown = getStrengthStandards("unknown", "male")
      const squat = getStrengthStandards("squat", "male")
      expect(unknown).toEqual(squat)
    })
  })

  describe("calculateTotal", () => {
    it("sums squat, bench, and deadlift", () => {
      expect(calculateTotal(200, 140, 250)).toBe(590)
    })

    it("handles zero values", () => {
      expect(calculateTotal(0, 0, 0)).toBe(0)
      expect(calculateTotal(200, 0, 250)).toBe(450)
    })
  })

  describe("getWilksDescription", () => {
    it("returns correct i18n key for each range", () => {
      expect(getWilksDescription(520)).toBe("wilks.world_class")
      expect(getWilksDescription(470)).toBe("wilks.elite")
      expect(getWilksDescription(420)).toBe("wilks.advanced_competitor")
      expect(getWilksDescription(370)).toBe("wilks.intermediate")
      expect(getWilksDescription(320)).toBe("wilks.solid_base")
      expect(getWilksDescription(270)).toBe("wilks.advanced_beginner")
      expect(getWilksDescription(200)).toBe("wilks.beginner")
    })

    it("handles edge cases at boundaries", () => {
      expect(getWilksDescription(500)).toBe("wilks.world_class")
      expect(getWilksDescription(450)).toBe("wilks.elite")
      expect(getWilksDescription(400)).toBe("wilks.advanced_competitor")
      expect(getWilksDescription(350)).toBe("wilks.intermediate")
      expect(getWilksDescription(300)).toBe("wilks.solid_base")
      expect(getWilksDescription(250)).toBe("wilks.advanced_beginner")
    })
  })

  describe("estimateE1RM", () => {
    it("returns 0 for invalid inputs", () => {
      expect(estimateE1RM(0, 5)).toBe(0)
      expect(estimateE1RM(100, 0)).toBe(0)
      expect(estimateE1RM(100, -1)).toBe(0)
    })

    it("returns weight for 1 rep", () => {
      expect(estimateE1RM(100, 1)).toBe(100)
      expect(estimateE1RM(200, 1)).toBe(200)
    })

    it("estimates higher 1RM for more reps (Epley formula)", () => {
      // Epley: e1RM = weight * (1 + reps/30)
      expect(estimateE1RM(100, 5)).toBe(117) // 100 * (1 + 5/30) = 116.67 -> 117
      expect(estimateE1RM(100, 10)).toBe(133) // 100 * (1 + 10/30) = 133.33 -> 133
      expect(estimateE1RM(100, 3)).toBe(110) // 100 * (1 + 3/30) = 110
    })

    it("returns rounded integer", () => {
      const e1rm = estimateE1RM(100, 7)
      expect(Number.isInteger(e1rm)).toBe(true)
    })
  })

  // LIFT_NAMES_CZ was removed — lift names are now provided by the i18n system.
  // Client components use t(`lifts.${lift}`), backed by the existing lifts.* keys in common.json.

  describe("integration scenarios", () => {
    it("calculates full stats for typical male lifter", () => {
      const bodyweight = 80
      const gender = "male" as const
      const e1rms = { squat: 160, bench: 120, deadlift: 200, press: 70 }

      const total = calculateTotal(e1rms.squat, e1rms.bench, e1rms.deadlift)
      expect(total).toBe(480)

      const wilks = calculateWilks(total, bodyweight, gender)
      expect(wilks).toBeGreaterThan(300)

      const dots = calculateDOTS(total, bodyweight, gender)
      expect(dots).toBeGreaterThan(250)

      // Check strength levels (i18n keys)
      // squat 160/80 = 2.0x BW -> advanced (threshold 2.0x)
      expect(getStrengthLevel("squat", e1rms.squat, bodyweight, gender).level).toBe("strengthLevels.advanced")
      // bench 120/80 = 1.5x BW -> advanced (threshold 1.5x)
      expect(getStrengthLevel("bench", e1rms.bench, bodyweight, gender).level).toBe("strengthLevels.advanced")
      // deadlift 200/80 = 2.5x BW -> advanced (threshold 2.25x, elite is 2.75x)
      expect(getStrengthLevel("deadlift", e1rms.deadlift, bodyweight, gender).level).toBe("strengthLevels.advanced")
      // press 70/80 = 0.875x BW -> intermediate (threshold 0.75x, advanced is 1.0x)
      expect(getStrengthLevel("press", e1rms.press, bodyweight, gender).level).toBe("strengthLevels.intermediate")
    })

    it("calculates full stats for typical female lifter", () => {
      const bodyweight = 60
      const gender = "female" as const
      const e1rms = { squat: 90, bench: 55, deadlift: 110, press: 35 }

      const total = calculateTotal(e1rms.squat, e1rms.bench, e1rms.deadlift)
      expect(total).toBe(255)

      const wilks = calculateWilks(total, bodyweight, gender)
      expect(wilks).toBeGreaterThan(200)

      // Check strength levels (i18n keys): squat 90/60 = 1.5x BW -> advanced for female (threshold 1.5x)
      expect(getStrengthLevel("squat", e1rms.squat, bodyweight, gender).level).toBe("strengthLevels.advanced")
    })
  })

  describe("normalizeGender — backward compatibility", () => {
    it("passes through stable enum values unchanged", () => {
      expect(normalizeGender("male")).toBe("male")
      expect(normalizeGender("female")).toBe("female")
      expect(normalizeGender("other")).toBe("other")
    })

    it("normalizes legacy Czech strings", () => {
      expect(normalizeGender("Muž")).toBe("male")
      expect(normalizeGender("Žena")).toBe("female")
      expect(normalizeGender("Jiné")).toBe("other")
    })

    it("normalizes legacy English strings (case-insensitive)", () => {
      expect(normalizeGender("Male")).toBe("male")
      expect(normalizeGender("Female")).toBe("female")
      expect(normalizeGender("Other")).toBe("other")
    })

    it("returns female for null/undefined/unknown (safe fallback)", () => {
      expect(normalizeGender(null)).toBe("female")
      expect(normalizeGender(undefined)).toBe("female")
      expect(normalizeGender("")).toBe("female")
      expect(normalizeGender("unknown_value")).toBe("female")
    })

    it("legacy Czech 'Muž' produces male Wilks — end-to-end backward compat", () => {
      // Old DB row with Czech gender string must yield the same result as explicit "male"
      const legacyGender = normalizeGender("Muž")
      const wilksLegacy = calculateWilks(500, 80, legacyGender)
      const wilksMale = calculateWilks(500, 80, "male")
      expect(wilksLegacy).toBe(wilksMale)
      // And it must be strictly greater than female (different coefficients)
      const wilksFemale = calculateWilks(500, 80, "female")
      expect(wilksLegacy).not.toBe(wilksFemale)
    })
  })
})
