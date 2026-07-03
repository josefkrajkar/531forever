"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  type WeightUnit,
  toDisplay,
  fromDisplay,
  unitLabel,
  barWeightInUnit,
  LB_PLATES,
  DEFAULT_PLATES_KG,
} from "@/lib/units"

export { type WeightUnit }

/**
 * Hook vracející preferovanou jednotku aktuálně přihlášeného uživatele.
 *
 * - `unit`         — "kg" nebo "lb"
 * - `toDisplay`    — převede kg → zobrazovaná hodnota
 * - `fromDisplay`  — převede zadanou hodnotu → kg pro uložení
 * - `label`        — "kg" nebo "lb"
 * - `barWeight`    — váha tyče v preferované jednotce (20 nebo 45)
 * - `plates`       — standardní sada kotoučů v preferované jednotce
 * - `isLoading`    — true dokud user data nejsou načtena
 */
export function usePreferredUnit() {
  const user = useQuery(api.users.currentLoggedInUser)
  const unit: WeightUnit = (user?.preferredUnit as WeightUnit | undefined) ?? "kg"

  return {
    unit,
    toDisplay: (kg: number) => toDisplay(kg, unit),
    fromDisplay: (value: number) => fromDisplay(value, unit),
    label: unitLabel(unit),
    barWeight: barWeightInUnit(unit),
    plates: unit === "lb" ? LB_PLATES : DEFAULT_PLATES_KG,
    isLoading: user === undefined,
  }
}
