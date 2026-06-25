/**
 * Testy pro lib/plates.ts — rozpad váhy na kotouče
 *
 * Pokrývá:
 * - přesné složení (no residual)
 * - nesložitelná váha (residual > 0)
 * - váha == tyč (prázdné kotouče)
 * - váha < tyč
 * - záporné a NaN vstupy
 * - velké váhy
 * - 1.25 kg kotouče (102.5 kg total → 41.25/strana)
 */

import { describe, it, expect } from "vitest"
import { calculatePlates, DEFAULT_PLATES } from "@/lib/plates"

describe("calculatePlates", () => {
  // -------------------------------------------------------------------------
  // Základní přesné složení
  // -------------------------------------------------------------------------

  it("složí 100 kg (2× 40 kg/strana: 25+15)", () => {
    const result = calculatePlates(100)
    expect(result.achievableWeight).toBe(100)
    expect(result.residual).toBe(0)
    // Na jednu stranu: (100 - 20) / 2 = 40 → greedy: 25 + 15
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[25]).toBe(1)
    expect(weightMap[15]).toBe(1)
    expect(weightMap[20]).toBeUndefined()
  })

  it("složí 60 kg (2× 20 kg/strana: 20)", () => {
    const result = calculatePlates(60)
    expect(result.achievableWeight).toBe(60)
    expect(result.residual).toBe(0)
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[20]).toBe(1)
  })

  it("složí 142.5 kg (2× 61.25/strana: 25+25+10+1.25)", () => {
    const result = calculatePlates(142.5)
    expect(result.achievableWeight).toBe(142.5)
    expect(result.residual).toBe(0)
    // (142.5 - 20) / 2 = 61.25 → 25+25+10+1.25
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[25]).toBe(2)
    expect(weightMap[10]).toBe(1)
    expect(weightMap[1.25]).toBe(1)
  })

  it("složí 102.5 kg (2× 41.25/strana: 25+15+1.25)", () => {
    // Explicitní případ ze zadání — greedy s DEFAULT_PLATES preferuje 15 před 10+5
    const result = calculatePlates(102.5)
    expect(result.achievableWeight).toBe(102.5)
    expect(result.residual).toBe(0)
    // (102.5 - 20) / 2 = 41.25 → greedy: 25 + 15 + 1.25 = 41.25 ✓
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[25]).toBe(1)
    expect(weightMap[15]).toBe(1)
    expect(weightMap[1.25]).toBe(1)
    // Celková suma: 20 (tyč) + 2×(25+15+1.25) = 20 + 82.5 = 102.5
    expect(result.plates.reduce((acc, p) => acc + p.weight * p.count, 0) * 2 + 20).toBe(102.5)
  })

  it("složí 20 kg (pouze tyč, žádné kotouče)", () => {
    const result = calculatePlates(20)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
  })

  it("velká váha 260 kg (2× 120/strana: 4×25+10+5+5)", () => {
    // (260 - 20) / 2 = 120 → 4×25 + 10 + 5 + 5 = 100+15 = 120 ✓
    // Greedy: 4×25=100, zbytek 20 → 1×20, ale 20 je v DEFAULT_PLATES
    const result = calculatePlates(260)
    expect(result.achievableWeight).toBe(260)
    expect(result.residual).toBe(0)
    // 120 na stranu: 4×25=100, 1×20=20 → celkem 120
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[25]).toBe(4)
    expect(weightMap[20]).toBe(1)
  })

  it("složí 22.5 kg (2× 1.25/strana)", () => {
    const result = calculatePlates(22.5)
    expect(result.achievableWeight).toBe(22.5)
    expect(result.residual).toBe(0)
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[1.25]).toBe(1)
  })

  // -------------------------------------------------------------------------
  // Nesložitelná váha — residual
  // -------------------------------------------------------------------------

  it("nesložitelná váha: 21 kg → residual > 0, achievable = 20 kg", () => {
    // 21 kg: (21 - 20) / 2 = 0.5 kg na stranu — nejmenší kotouč je 1.25
    const result = calculatePlates(21)
    expect(result.achievableWeight).toBe(20) // jen tyč
    expect(result.residual).toBe(1)          // celkem 1 kg zbývá
    expect(result.plates).toHaveLength(0)
  })

  it("nesložitelná váha na custom sadě bez 1.25: 102.5 kg → residual", () => {
    const sadaBez125: number[] = [25, 20, 15, 10, 5, 2.5]
    // (102.5 - 20) / 2 = 41.25 → 25+10+5+2.5=42.5 > 41.25
    // Greedy: 25, pak 10, pak 5, pak 2.5 se nevejde (zbývá 1.25) → residual = 2×1.25 = 2.5
    const result = calculatePlates(102.5, 20, sadaBez125)
    expect(result.residual).toBeGreaterThan(0)
    expect(result.achievableWeight).toBeLessThan(102.5)
    expect(result.achievableWeight + result.residual).toBeCloseTo(102.5, 5)
  })

  // -------------------------------------------------------------------------
  // Edge cases — váha ≤ tyč
  // -------------------------------------------------------------------------

  it("váha přesně rovna tyči → prázdné kotouče", () => {
    const result = calculatePlates(20, 20)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
  })

  it("váha nižší než tyč → belowBar true (lehčí tyč / jednoručky)", () => {
    const result = calculatePlates(10, 20)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
    expect(result.belowBar).toBe(true)
  })

  it("17,5 kg na 20kg tyči → belowBar true (nedosažitelné)", () => {
    const result = calculatePlates(17.5, 20)
    expect(result.belowBar).toBe(true)
    expect(result.plates).toHaveLength(0)
  })

  it("váha == tyč → belowBar false (legitimní prázdná tyč)", () => {
    const result = calculatePlates(20, 20)
    expect(result.belowBar).toBe(false)
    expect(result.plates).toHaveLength(0)
  })

  it("17,5 kg na 15kg tyči → 1,25 kg/strana, belowBar false", () => {
    const result = calculatePlates(17.5, 15)
    expect(result.belowBar).toBe(false)
    expect(result.achievableWeight).toBe(17.5)
    expect(result.plates).toEqual([{ weight: 1.25, count: 1 }])
  })

  it("váha 0 → prázdný výsledek", () => {
    const result = calculatePlates(0)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
  })

  it("záporná váha → prázdný výsledek", () => {
    const result = calculatePlates(-50)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
  })

  it("NaN → prázdný výsledek", () => {
    const result = calculatePlates(NaN)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
  })

  it("Infinity → prázdný výsledek", () => {
    const result = calculatePlates(Infinity)
    expect(result.plates).toHaveLength(0)
    expect(result.achievableWeight).toBe(20)
    expect(result.residual).toBe(0)
  })

  // -------------------------------------------------------------------------
  // Custom barWeight
  // -------------------------------------------------------------------------

  it("custom barWeight 15 kg, target 35 kg → 1×10/strana", () => {
    const result = calculatePlates(35, 15)
    expect(result.achievableWeight).toBe(35)
    expect(result.residual).toBe(0)
    // (35 - 15) / 2 = 10
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[10]).toBe(1)
  })

  // -------------------------------------------------------------------------
  // DEFAULT_PLATES export
  // -------------------------------------------------------------------------

  it("DEFAULT_PLATES obsahuje 1.25 kg", () => {
    expect(DEFAULT_PLATES).toContain(1.25)
  })

  it("DEFAULT_PLATES je seřazen od nejtěžšího dolů (nebo ne — funkce si ho seřadí sama)", () => {
    // Funkce seřadí interně, takže výsledné plates musí být od nejtěžšího
    const result = calculatePlates(200)
    const weights = result.plates.map((p) => p.weight)
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThanOrEqual(weights[i - 1])
    }
  })

  // -------------------------------------------------------------------------
  // Velké váhy
  // -------------------------------------------------------------------------

  it("300 kg (2× 140/strana: 5×25+10+5)", () => {
    // (300 - 20) / 2 = 140 → 5×25=125, zbytek 15 → 1×15
    const result = calculatePlates(300)
    expect(result.achievableWeight).toBe(300)
    expect(result.residual).toBe(0)
    const weightMap = Object.fromEntries(result.plates.map((p) => [p.weight, p.count]))
    expect(weightMap[25]).toBe(5)
    expect(weightMap[15]).toBe(1)
  })

  it("achievableWeight + residual vždy rovno targetWeight (přesné složení)", () => {
    const targets = [100, 102.5, 142.5, 200, 260]
    for (const t of targets) {
      const result = calculatePlates(t)
      expect(result.achievableWeight + result.residual).toBeCloseTo(t, 5)
    }
  })
})
