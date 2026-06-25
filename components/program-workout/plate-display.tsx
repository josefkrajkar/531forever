"use client"

import { useTranslation } from "react-i18next"
import { calculatePlates } from "@/lib/plates"
import { cn } from "@/lib/utils"

interface PlateDisplayProps {
  /** Celková váha setu (tyč + kotouče obou stran) v kg */
  weight: number
  /** Váha tyče v kg, výchozí 20 kg */
  barWeight?: number
  className?: string
}

/**
 * Vrátí Tailwind třídy pro barvu pilulky dle váhy kotouče.
 * Odráží standardní barevné kódování kotoučů.
 */
function plateColorClass(weight: number): string {
  if (weight >= 25) return "bg-red-600 text-white border-red-700"
  if (weight >= 20) return "bg-blue-600 text-white border-blue-700"
  if (weight >= 15) return "bg-yellow-500 text-white border-yellow-600"
  if (weight >= 10) return "bg-green-600 text-white border-green-700"
  if (weight >= 5) return "bg-white text-gray-800 border-gray-400"
  if (weight >= 2.5) return "bg-red-400 text-white border-red-500"
  // 1.25 kg
  return "bg-gray-400 text-white border-gray-500"
}

/**
 * Vrátí relativní velikostní třídu pilulky (větší kotouče = vizuálně vyšší).
 */
function plateSizeClass(weight: number): string {
  if (weight >= 25) return "h-10 min-w-[2.25rem] text-xs font-bold"
  if (weight >= 20) return "h-9 min-w-[2rem] text-xs font-bold"
  if (weight >= 15) return "h-8 min-w-[1.85rem] text-xs font-semibold"
  if (weight >= 10) return "h-7 min-w-[1.75rem] text-xs font-semibold"
  if (weight >= 5) return "h-6 min-w-[1.6rem] text-xs"
  if (weight >= 2.5) return "h-5 min-w-[1.5rem] text-[10px]"
  // 1.25 kg
  return "h-4 min-w-[1.4rem] text-[9px]"
}

/**
 * Kompaktní vizuální zobrazení rozpadu váhy na kotouče.
 *
 * Zobrazuje tyč + kotouče NA JEDNU STRANU jako barevné pilulky.
 * Pokud váhu nelze přesně složit, zobrazí upozornění s nejbližší dosažitelnou váhou.
 */
export default function PlateDisplay({ weight, barWeight = 20, className }: PlateDisplayProps) {
  const { t } = useTranslation()
  const result = calculatePlates(weight, barWeight)
  const { plates, achievableWeight, residual, belowBar } = result

  // Cíl nižší než tyč — nelze naložit na tuto tyč (poctivé upozornění)
  if (belowBar) {
    return (
      <div className={cn("text-left", className)}>
        <p className="text-xs text-amber-500 leading-relaxed">
          {t("plates.belowBar", { weight, barWeight })}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("text-left", className)}>
      {/* Hint: na stranu */}
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">
        {t("plates.perSide")}
      </p>

      {/* Vizuální řada: tyč | kotouče */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Tyč */}
        <span className="inline-flex items-center justify-center rounded border border-muted-foreground/30 bg-muted text-muted-foreground text-[10px] font-mono px-1.5 h-6 shrink-0">
          {barWeight}
        </span>

        {/* Oddělovač */}
        <span className="text-muted-foreground/40 text-xs select-none">|</span>

        {/* Kotouče — každý typ opakujeme count-krát pro vizuální věrnost */}
        {plates.length === 0 ? (
          <span className="text-xs text-muted-foreground/50 italic">{t("plates.barOnly")}</span>
        ) : (
          plates.map(({ weight: pw, count }) =>
            Array.from({ length: count }, (_, i) => (
              <span
                key={`${pw}-${i}`}
                className={cn(
                  "inline-flex items-center justify-center rounded border px-1",
                  plateColorClass(pw),
                  plateSizeClass(pw),
                )}
                title={`${pw} kg`}
              >
                {pw}
              </span>
            )),
          )
        )}
      </div>

      {/* Upozornění při nesložitelné váze */}
      {residual > 0 && (
        <p className="text-[10px] text-amber-500 mt-1">
          {t("plates.residual", { achievableWeight })}
        </p>
      )}
    </div>
  )
}
