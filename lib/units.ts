/**
 * Jednotky hmotnosti — konverze kg ↔ lb
 *
 * Váhy jsou v databázi VŽDY uloženy v kg.
 * Konverze probíhá pouze při zobrazení a při zadávání vstupu uživatelem.
 */

export type WeightUnit = "kg" | "lb"

/** 1 kg = 2.20462 lb */
const KG_TO_LB = 2.20462

/**
 * Převede uloženou hodnotu v kg na zobrazovanou hodnotu v preferované jednotce.
 * Výsledek je zaokrouhlený na 1 desetinné místo.
 */
export function toDisplay(kg: number, unit: WeightUnit): number {
  if (unit === "lb") {
    return Math.round(kg * KG_TO_LB * 10) / 10
  }
  return kg
}

/**
 * Převede hodnotu zadanou uživatelem v preferované jednotce zpět na kg pro uložení.
 * Výsledek je zaokrouhlený na 3 desetinná místa (přesnost 0.001 kg).
 */
export function fromDisplay(value: number, unit: WeightUnit): number {
  if (unit === "lb") {
    return Math.round((value / KG_TO_LB) * 1000) / 1000
  }
  return value
}

/** Textový label jednotky pro zobrazení v UI */
export function unitLabel(unit: WeightUnit): string {
  return unit === "lb" ? "lb" : "kg"
}

/**
 * Standardní sada kotoučů v kg (NA JEDNU STRANU tyče).
 */
export const DEFAULT_PLATES_KG: number[] = [25, 20, 15, 10, 5, 2.5, 1.25]

/**
 * Standardní sada kotoučů v librách (NA JEDNU STRANU tyče).
 * Olympijský bar = 45 lb (≈ 20 kg).
 */
export const LB_PLATES: number[] = [45, 35, 25, 10, 5, 2.5]

/** Váha standardní olympijské tyče v librách */
export const LB_BAR_WEIGHT = 45

/** Váha standardní olympijské tyče v kg */
export const KG_BAR_WEIGHT = 20

/**
 * Vrátí váhu tyče v preferované jednotce.
 */
export function barWeightInUnit(unit: WeightUnit): number {
  return unit === "lb" ? LB_BAR_WEIGHT : KG_BAR_WEIGHT
}
