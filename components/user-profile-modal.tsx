"use client"

import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { api } from "../convex/_generated/api"
import { toExportJson, toWorkoutsCsv } from "@/lib/export"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  type Gender,
  type ExperienceLevel,
  normalizeGender,
  normalizeExperience,
} from "@/lib/profile"

export interface UserProfile {
  gender: string
  age: number
  height: number
  weight: number
  experience: string
}

interface Props {
  initialProfile?: UserProfile | null
  onSubmit: (profile: UserProfile) => void
  onClose: () => void
  submitLabel?: string
  subtitle?: string
}

export default function UserProfileModal({
  initialProfile,
  onSubmit,
  onClose,
  submitLabel,
  subtitle,
}: Props) {
  const { t } = useTranslation()

  // State holds stable enum values — normalized from whatever was stored in DB (legacy or new).
  const [gender, setGender] = useState<Gender>(normalizeGender(initialProfile?.gender))
  const [age, setAge] = useState(String(initialProfile?.age ?? "25"))
  const [height, setHeight] = useState(String(initialProfile?.height ?? "175"))
  const [weight, setWeight] = useState(String(initialProfile?.weight ?? "80"))
  const [experience, setExperience] = useState<ExperienceLevel>(
    normalizeExperience(initialProfile?.experience)
  )
  const [downloadingJson, setDownloadingJson] = useState(false)
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  const [loggingWeight, setLoggingWeight] = useState(false)

  // Modal je podmíněně mountován — query/mutation je aktivní jen když je modal otevřen
  const exportData = useQuery(api.exports.exportData, {})
  const lastBwLog = useQuery(api.bodyweight.getBodyweightHistory)
  const logBodyweight = useMutation(api.bodyweight.logBodyweight)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit({
      gender,
      age: parseInt(age) || 25,
      height: parseInt(height) || 175,
      weight: parseFloat(weight) || 80,
      experience,
    })
  }

  // Poslední zaznamenaná váha (pro hint pod polem)
  const sortedLogs = lastBwLog ? [...lastBwLog].sort((a, b) => b.date.localeCompare(a.date)) : []
  const latestLog = sortedLogs[0] ?? null

  const handleLogWeight = async () => {
    const parsedWeight = parseFloat(weight)
    if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
      toast.error(t("profile.errorInvalidWeight"))
      return
    }
    setLoggingWeight(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      await logBodyweight({ date: today, weightKg: parsedWeight })
      toast.success(t("profile.weightLogged", { weight: parsedWeight }))
    } catch {
      toast.error(t("profile.errorWeightLog"))
    } finally {
      setLoggingWeight(false)
    }
  }

  const getDateSuffix = () => new Date().toISOString().split("T")[0]

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJson = () => {
    if (!exportData) return
    setDownloadingJson(true)
    try {
      const json = toExportJson(exportData, new Date().toISOString())
      triggerDownload(
        json,
        `531forever-export-${getDateSuffix()}.json`,
        "application/json;charset=utf-8"
      )
      toast.success(t("profile.exportJsonSuccess"))
    } catch {
      toast.error(t("profile.exportFailed"))
    } finally {
      setDownloadingJson(false)
    }
  }

  const handleDownloadCsv = () => {
    if (!exportData) return
    setDownloadingCsv(true)
    try {
      const csv = toWorkoutsCsv(exportData)
      triggerDownload(
        csv,
        `531forever-export-${getDateSuffix()}.csv`,
        "text/csv;charset=utf-8"
      )
      toast.success(t("profile.exportCsvSuccess"))
    } catch {
      toast.error(t("profile.exportFailed"))
    } finally {
      setDownloadingCsv(false)
    }
  }

  const isLoading = exportData === undefined

  // Stable enum value stored/compared; label from i18n for display only.
  const genderOptions: Array<{ value: Gender; labelKey: string }> = [
    { value: "male", labelKey: "profile.genderMale" },
    { value: "female", labelKey: "profile.genderFemale" },
  ]

  // Stable enum value stored/compared; label from i18n for display only.
  const experienceOptions: Array<{ value: ExperienceLevel; labelKey: string }> = [
    { value: "beginner", labelKey: "profile.expBeginner" },
    { value: "intermediate", labelKey: "profile.expIntermediate" },
    { value: "advanced", labelKey: "profile.expAdvanced" },
    { value: "competitive", labelKey: "profile.expCompetitive" },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border w-full sm:max-w-md rounded-t-xl sm:rounded-xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="border-b border-border px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-0.5">{t("profile.sectionLabel")}</p>
            <h2 className="font-heading font-extrabold uppercase tracking-widest text-lg leading-tight">
              {t("profile.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors"
            aria-label={t("profile.closeAria")}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
          )}

          {/* Gender */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("profile.genderLabel")}</label>
            <div className="flex gap-2">
              {genderOptions.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value)}
                  aria-pressed={gender === g.value}
                  className={`flex-1 py-2.5 text-xs font-heading font-bold uppercase tracking-widest rounded border transition-all ${
                    gender === g.value
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  }`}
                >
                  {t(g.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Age / Height / Weight */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("profile.ageLabel")}</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="12"
                max="80"
                required
                className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm font-heading font-bold text-center focus:outline-none focus:border-primary transition-colors"
              />
              <p className="text-xs text-muted-foreground/50 mt-1 text-center">{t("profile.ageSuffix")}</p>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("profile.heightLabel")}</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                min="140"
                max="220"
                required
                className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm font-heading font-bold text-center focus:outline-none focus:border-primary transition-colors"
              />
              <p className="text-xs text-muted-foreground/50 mt-1 text-center">{t("profile.heightSuffix")}</p>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("profile.weightLabel")}</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                min="40"
                max="200"
                required
                className="w-full bg-background border border-border rounded px-3 py-2.5 text-sm font-heading font-bold text-center focus:outline-none focus:border-primary transition-colors"
              />
              <p className="text-xs text-muted-foreground/50 mt-1 text-center">{t("profile.weightSuffix")}</p>
              {latestLog && (
                <p className="text-[10px] text-muted-foreground/40 mt-0.5 text-center leading-tight">
                  Log: {latestLog.weightKg} kg<br />{latestLog.date}
                </p>
              )}
              <button
                type="button"
                onClick={handleLogWeight}
                disabled={loggingWeight}
                className="mt-2 w-full py-1.5 text-[10px] font-heading font-bold uppercase tracking-widest rounded border border-border text-muted-foreground hover:border-primary hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loggingWeight ? t("profile.loggingWeight") : t("profile.logWeightBtn")}
              </button>
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{t("profile.experienceLabel")}</label>
            <div className="flex flex-col gap-2">
              {experienceOptions.map((exp) => (
                <button
                  key={exp.value}
                  type="button"
                  onClick={() => setExperience(exp.value)}
                  aria-pressed={experience === exp.value}
                  className={`w-full py-3 px-4 text-xs font-heading font-bold uppercase tracking-widest rounded border text-left transition-all ${
                    experience === exp.value
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {t(exp.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground font-heading font-extrabold uppercase tracking-widest py-4 rounded hover:opacity-90 active:scale-95 transition-all text-sm"
          >
            {submitLabel ?? t("profile.saveProfile")}
          </button>
        </form>

        {/* Jazyk */}
        <div className="px-6 pb-5 border-t border-border pt-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("language.label")}</p>
          <LanguageSwitcher />
        </div>

        {/* Export dat */}
        <div className="px-6 pb-6 border-t border-border pt-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("profile.exportSection")}</p>
          <p className="text-xs text-muted-foreground/70">
            {t("profile.exportDescription")}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={isLoading || downloadingJson || exportData === null}
              className="flex-1 py-3 px-4 text-xs font-heading font-bold uppercase tracking-widest rounded border border-border text-muted-foreground hover:border-primary hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingJson ? t("profile.downloadingLabel") : isLoading ? t("profile.loadingLabel") : t("profile.downloadJson")}
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={isLoading || downloadingCsv || exportData === null}
              className="flex-1 py-3 px-4 text-xs font-heading font-bold uppercase tracking-widest rounded border border-border text-muted-foreground hover:border-primary hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingCsv ? t("profile.downloadingLabel") : isLoading ? t("profile.loadingLabel") : t("profile.downloadCsv")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
