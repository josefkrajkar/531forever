/**
 * Testy pro lib/bodyweight.ts — weightAtDate
 *
 * Pokrývá:
 * - Přesná shoda pro dané datum
 * - Nejbližší starší log (datum <= target)
 * - Pouze novější logy → vrátí nejstarší novější
 * - Prázdné pole → fallback
 * - Smíšené (past + future) → vybere nejnovější past
 */

import { describe, it, expect } from "vitest"
import { weightAtDate } from "@/lib/bodyweight"

describe("weightAtDate", () => {
  describe("prázdné pole", () => {
    it("vrátí fallback pro prázdné pole logů", () => {
      expect(weightAtDate([], "2024-06-01", 80)).toBe(80)
    })

    it("vrátí fallback i pro nulový fallback", () => {
      expect(weightAtDate([], "2024-06-01", 0)).toBe(0)
    })
  })

  describe("přesná shoda", () => {
    it("vrátí váhu pro přesnou shodu data", () => {
      const logs = [
        { date: "2024-06-01", weightKg: 82 },
        { date: "2024-06-10", weightKg: 83 },
      ]
      expect(weightAtDate(logs, "2024-06-01", 80)).toBe(82)
      expect(weightAtDate(logs, "2024-06-10", 80)).toBe(83)
    })
  })

  describe("nejbližší starší log", () => {
    it("vrátí nejnovější log s datem <= target", () => {
      const logs = [
        { date: "2024-05-01", weightKg: 80 },
        { date: "2024-05-15", weightKg: 81 },
        { date: "2024-06-01", weightKg: 82 },
      ]
      // Target 2024-05-20 → nejbližší past je 2024-05-15
      expect(weightAtDate(logs, "2024-05-20", 75)).toBe(81)
    })

    it("vrátí nejnovější past log (ne starší)", () => {
      const logs = [
        { date: "2024-01-01", weightKg: 78 },
        { date: "2024-03-01", weightKg: 80 },
        { date: "2024-05-01", weightKg: 82 },
      ]
      // Target 2024-04-01 → nejbližší past je 2024-03-01
      expect(weightAtDate(logs, "2024-04-01", 75)).toBe(80)
    })

    it("vrátí log přesně k datu target (boundary — <= funguje)", () => {
      const logs = [{ date: "2024-06-15", weightKg: 85 }]
      expect(weightAtDate(logs, "2024-06-15", 70)).toBe(85)
    })

    it("neseřazené logy — stále vrátí správný výsledek", () => {
      const logs = [
        { date: "2024-05-01", weightKg: 80 },
        { date: "2024-03-01", weightKg: 78 },
        { date: "2024-04-15", weightKg: 79 },
      ]
      // Target 2024-04-20 → nejbližší past je 2024-04-15
      expect(weightAtDate(logs, "2024-04-20", 70)).toBe(79)
    })
  })

  describe("pouze novější logy", () => {
    it("vrátí nejstarší novější log, pokud žádný past neexistuje", () => {
      const logs = [
        { date: "2024-07-01", weightKg: 84 },
        { date: "2024-08-01", weightKg: 85 },
      ]
      // Target 2024-06-01 → žádný past, vrátí nejstarší future = 2024-07-01
      expect(weightAtDate(logs, "2024-06-01", 70)).toBe(84)
    })

    it("neseřazené future logy — vrátí nejstarší", () => {
      const logs = [
        { date: "2024-09-01", weightKg: 87 },
        { date: "2024-07-01", weightKg: 84 },
        { date: "2024-08-01", weightKg: 85 },
      ]
      // Target 2024-06-01 → nejstarší future je 2024-07-01
      expect(weightAtDate(logs, "2024-06-01", 70)).toBe(84)
    })
  })

  describe("smíšené (past + future)", () => {
    it("upřednostní past log před future logem", () => {
      const logs = [
        { date: "2024-04-01", weightKg: 79 },
        { date: "2024-06-01", weightKg: 83 },
      ]
      // Target 2024-05-01 → past = 2024-04-01, future = 2024-06-01 → vrátí past
      expect(weightAtDate(logs, "2024-05-01", 70)).toBe(79)
    })

    it("upřednostní přesnou shodu před past logem", () => {
      const logs = [
        { date: "2024-04-01", weightKg: 79 },
        { date: "2024-05-01", weightKg: 82 },
        { date: "2024-06-01", weightKg: 83 },
      ]
      expect(weightAtDate(logs, "2024-05-01", 70)).toBe(82)
    })
  })

  describe("okrajové případy", () => {
    it("jeden log — přesná shoda", () => {
      const logs = [{ date: "2024-06-01", weightKg: 80 }]
      expect(weightAtDate(logs, "2024-06-01", 75)).toBe(80)
    })

    it("jeden log — target před logem → vrátí future fallback", () => {
      const logs = [{ date: "2024-06-01", weightKg: 80 }]
      expect(weightAtDate(logs, "2024-05-01", 75)).toBe(80)
    })

    it("jeden log — target po logu → vrátí past", () => {
      const logs = [{ date: "2024-06-01", weightKg: 80 }]
      expect(weightAtDate(logs, "2024-07-01", 75)).toBe(80)
    })

    it("fallback se použije jen pokud žádný log nevyhovuje", () => {
      const logs = [{ date: "2024-06-01", weightKg: 80 }]
      // Existuje log → fallback se nepoužije
      expect(weightAtDate(logs, "2024-07-01", 999)).toBe(80)
    })
  })
})
