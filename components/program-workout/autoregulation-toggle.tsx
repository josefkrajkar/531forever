"use client"

import { useTranslation } from "react-i18next"

interface AutoregulationToggleProps {
  autoregulated: boolean
  deviationNote: string
  onToggle: () => void
  onNoteChange: (note: string) => void
}

export default function AutoregulationToggle({
  autoregulated,
  deviationNote,
  onToggle,
  onNoteChange,
}: AutoregulationToggleProps) {
  const { t } = useTranslation()

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between"
        >
          <div className="text-left">
            <p className="text-sm font-medium">{t("autoreg.title")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("autoreg.subtitle")}
            </p>
          </div>
          <div
            className={`w-12 h-6 rounded-full transition-colors relative ${
              autoregulated ? "bg-primary" : "bg-muted"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                autoregulated ? "left-7" : "left-1"
              }`}
            />
          </div>
        </button>

        {/* Deviation note input (only shown when autoregulated) */}
        {autoregulated && (
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-xs text-muted-foreground uppercase tracking-widest block mb-2">
              {t("autoreg.noteLabel")}
            </label>
            <textarea
              value={deviationNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t("autoreg.notePlaceholder")}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              {t("autoreg.noteHint")}
            </p>
          </div>
        )}
      </div>

      {/* Autoregulation warning banner */}
      {autoregulated && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-4 py-3">
          <p className="text-sm text-yellow-200">
            <strong>{t("autoreg.warningBold")}</strong>{" "}
            {t("autoreg.warningText")}
          </p>
        </div>
      )}
    </>
  )
}
