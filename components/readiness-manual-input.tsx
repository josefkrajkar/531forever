"use client"

/**
 * readiness-manual-input.tsx — ruční zadání readiness signálů.
 *
 * Plný manuální vstup pro web uživatele (kdo měří HRV/spánek na hodinkách,
 * ale appku má v prohlížeči). Subjektivní pocit je povinný (prominentní —
 * brání slepému následování čísel), ostatní metriky volitelné.
 */

import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { useTranslation } from "react-i18next"
import { api } from "@/convex/_generated/api"
import { toast } from "sonner"
import type { SubjectiveFeel } from "@/lib/readiness"

interface Props {
  /** Datum YYYY-MM-DD, ke kterému se readiness zapisuje */
  date: string
  /** Předvyplnění z existujícího záznamu (edit) */
  initial?: {
    hrvMs?: number
    restingHrBpm?: number
    sleepHours?: number
    sleepQuality?: number
    subjectiveFeel?: SubjectiveFeel
  }
  onClose: () => void
}

/** Parsuje volitelné číslo z inputu — prázdné/nevalidní → undefined */
function parseOptional(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : undefined
}

export default function ReadinessManualInput({ date, initial, onClose }: Props) {
  const { t } = useTranslation()
  const upsert = useMutation(api.readiness.upsertReadinessSignal)

  const FEEL_OPTIONS: { value: SubjectiveFeel; label: string }[] = [
    { value: "great", label: t("readinessInput.feelGreat") },
    { value: "normal", label: t("readinessInput.feelNormal") },
    { value: "bad", label: t("readinessInput.feelBad") },
  ]

  const [feel, setFeel] = useState<SubjectiveFeel | null>(initial?.subjectiveFeel ?? null)
  const [hrv, setHrv] = useState(initial?.hrvMs != null ? String(initial.hrvMs) : "")
  const [rhr, setRhr] = useState(initial?.restingHrBpm != null ? String(initial.restingHrBpm) : "")
  const [sleepHours, setSleepHours] = useState(initial?.sleepHours != null ? String(initial.sleepHours) : "")
  const [sleepQuality, setSleepQuality] = useState(
    initial?.sleepQuality != null ? String(initial.sleepQuality) : ""
  )
  const [saving, setSaving] = useState(false)

  // Zavření klávesou Escape (a11y)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const handleSave = async () => {
    if (saving) return
    if (!feel) {
      toast.error(t("readinessInput.errorNoFeel"))
      return
    }
    setSaving(true)
    try {
      await upsert({
        date,
        subjectiveFeel: feel,
        hrvMs: parseOptional(hrv),
        restingHrBpm: parseOptional(rhr),
        sleepHours: parseOptional(sleepHours),
        sleepQuality: parseOptional(sleepQuality),
        source: "manual",
      })
      toast.success(t("readinessInput.saveSuccess"))
      onClose()
    } catch (err) {
      console.error("[readiness] manual save error:", err)
      toast.error(t("readinessInput.saveError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("readinessInput.dialogAriaLabel")}
        className="bg-card border border-border w-full sm:max-w-md rounded-t-xl sm:rounded-xl overflow-y-auto max-h-[92vh]"
      >
        <div className="border-b border-border px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-0.5">
              {t("readinessInput.subtitle")}
            </p>
            <h2 className="font-heading font-extrabold uppercase tracking-widest text-lg leading-tight">
              {t("readinessInput.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors"
            aria-label={t("readinessInput.closeAria")}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Subjektivní pocit — povinný, prominentní */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("readinessInput.feelLabel")} <span className="text-primary">*</span>
            </label>
            <div className="flex gap-2">
              {FEEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFeel(opt.value)}
                  className={`flex-1 py-3 text-xs font-heading font-bold uppercase tracking-widest rounded border transition-all ${
                    feel === opt.value
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                  style={{ minHeight: "44px" }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Volitelné metriky z hodinek */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              {t("readinessInput.watchSection")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label={t("readinessInput.hrvLabel")} value={hrv} onChange={setHrv} placeholder={t("readinessInput.hrvPlaceholder")} />
              <NumberField label={t("readinessInput.rhrLabel")} value={rhr} onChange={setRhr} placeholder={t("readinessInput.rhrPlaceholder")} />
              <NumberField label={t("readinessInput.sleepHoursLabel")} value={sleepHours} onChange={setSleepHours} placeholder={t("readinessInput.sleepHoursPlaceholder")} />
              <NumberField label={t("readinessInput.sleepQualityLabel")} value={sleepQuality} onChange={setSleepQuality} placeholder={t("readinessInput.sleepQualityPlaceholder")} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            {t("readinessInput.disclaimer")}
          </p>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest py-3.5 text-sm rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ minHeight: "44px" }}
          >
            {saving ? t("readinessInput.savingBtn") : t("readinessInput.saveBtn")}
          </button>
        </div>
      </div>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm font-heading font-bold focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  )
}
