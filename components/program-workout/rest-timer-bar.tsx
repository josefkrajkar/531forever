"use client"

import { useTranslation } from "react-i18next"

interface RestTimerBarProps {
  running: boolean
  remainingSec: number
  totalSec: number
  onAddTime: (sec: number) => void
  onStop: () => void
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Kompaktní sticky lišta (bottom) viditelná jen když rest timer běží.
 * Zobrazuje zbývající čas, progress bar a tlačítka „+30 s" a „Zrušit".
 */
export default function RestTimerBar({
  running,
  remainingSec,
  totalSec,
  onAddTime,
  onStop,
}: RestTimerBarProps) {
  const { t } = useTranslation()

  if (!running) return null

  const progress = totalSec > 0 ? remainingSec / totalSec : 0

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("restTimer.ariaLabel", { time: formatTime(remainingSec) })}
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg"
    >
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Zbývající čas */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest leading-none mb-0.5">
            {t("restTimer.label")}
          </p>
          <p className="font-heading font-bold text-xl leading-none tabular-nums">
            {formatTime(remainingSec)}
          </p>
        </div>

        {/* Akce */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddTime(30)}
            className="min-h-[44px] px-4 text-sm font-heading font-bold uppercase tracking-widest bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors touch-manipulation"
            aria-label={t("restTimer.addTimeAria")}
          >
            {t("restTimer.addTime")}
          </button>
          <button
            onClick={onStop}
            className="min-h-[44px] px-4 text-sm font-heading font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
            aria-label={t("restTimer.stopAria")}
          >
            {t("restTimer.stop")}
          </button>
        </div>
      </div>
    </div>
  )
}
