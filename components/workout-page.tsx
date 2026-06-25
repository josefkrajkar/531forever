"use client"

import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { useTranslation } from "react-i18next"
import { api } from "@/convex/_generated/api"
import Link from "next/link"
import { BarChart3 } from "lucide-react"
import { toast } from "sonner"
import WorkoutHistory from "./workout-history"
import UserProfileModal, { UserProfile } from "./user-profile-modal"
import CalibrationFlow from "./calibration-flow"
import ProgramWorkout from "./program-workout"
import UpcomingWorkouts from "./upcoming-workouts"
import ProgramSettings from "./program-settings"
import type { ProgramSnapshot } from "./upcoming-workouts"
import { useCachedQuery } from "@/hooks/use-cached-query"
import { clearOfflineCache } from "@/lib/offline-store"
import { clearOutbox } from "@/lib/outbox"
import { OfflineIndicator } from "./offline-indicator"
import { SyncConflictBanner } from "./sync-conflict-banner"
import ReadinessCard from "./readiness-card"
import { useSyncTriggers } from "@/hooks/use-sync-triggers"

type Tab = "workout" | "history" | "plan"

export default function WorkoutPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>("workout")
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  const { signOut } = useAuthActions()
  const { data: currentUser } = useCachedQuery(api.users.currentLoggedInUser, {}, "currentUser")
  const updateAthleteProfile = useMutation(api.users.updateAthleteProfile)

  // 5/3/1 Program
  const { data: currentProgram } = useCachedQuery(api.programs.getCurrentProgram, {}, "currentProgram")
  const startCalibration = useMutation(api.programs.startCalibration)
  const deleteProgram = useMutation(api.programs.deleteProgram)
  const resumeProgram = useMutation(api.programs.resumeProgram)

  const athleteProfile = currentUser?.athleteProfile ?? null

  // Flush triggery pro offline sync — mount, online event, visibilitychange
  useSyncTriggers()

  // Registruj service worker jen v produkci — v devu SW koliduje s HMR
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[SW] Registered:", reg.scope))
        .catch((err) => console.error("[SW] Registration failed:", err))
    }
  }, [])

  const handleStartCalibration = async () => {
    try {
      await startCalibration({})
      console.log("[workout-page] Started calibration")
    } catch (err) {
      console.error("[workout-page] Start calibration error:", err)
    }
  }

  const handleResetProgram = async () => {
    try {
      await deleteProgram({})
      console.log("[workout-page] Program deleted")
    } catch (err) {
      console.error("[workout-page] Delete program error:", err)
    }
  }

  const handleResumeProgram = async () => {
    try {
      await resumeProgram({})
      toast.success(t("program.resumed"))
      console.log("[workout-page] Program resumed")
    } catch (err) {
      console.error("[workout-page] Resume program error:", err)
      toast.error(t("program.resumeFailed"))
    }
  }

  const handleProfileSave = async (profile: UserProfile) => {
    await updateAthleteProfile(profile)
    setProfileModalOpen(false)
    console.log("[workout-page] Athlete profile saved to Convex")
  }

  const handleSignOut = async () => {
    setMenuOpen(false)
    // Vyčisti offline cache i outbox PŘED odhlášením — jinak by další uživatel
    // na stejném zařízení získal offline přístup k datům této session (cached
    // snapshoty + authSeen) nebo by se přehrály mutace předchozí session.
    // allSettled: i kdyby čištění selhalo (IDB chyba), odhlášení MUSÍ proběhnout.
    await Promise.allSettled([clearOfflineCache(), clearOutbox()])
    await signOut()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-primary text-xl">⚡</span>
            <span className="font-heading font-extrabold text-2xl uppercase tracking-widest">
              {t("app.name")}
            </span>
            <OfflineIndicator />
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col gap-1.5 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("nav.menu")}
          >
            <span className="block w-5 h-0.5 bg-current" />
            <span className="block w-5 h-0.5 bg-current" />
            <span className="block w-3.5 h-0.5 bg-current" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-0">
          <button
            onClick={() => setActiveTab("workout")}
            className={`px-6 py-3 font-heading font-bold uppercase tracking-widest text-sm transition-colors border-b-2 ${
              activeTab === "workout"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {t("nav.workout")}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-3 font-heading font-bold uppercase tracking-widest text-sm transition-colors border-b-2 ${
              activeTab === "history"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {t("nav.history")}
          </button>
          {currentProgram &&
            (currentProgram.status === "active" || currentProgram.status === "paused") &&
            currentProgram.programPhase && (
              <button
                onClick={() => setActiveTab("plan")}
                className={`px-6 py-3 font-heading font-bold uppercase tracking-widest text-sm transition-colors border-b-2 ${
                  activeTab === "plan"
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {t("nav.plan")}
              </button>
            )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Banner pro sync konflikty (server wins) — zobrazí se pokud byl trénink uložen na jiném zařízení */}
        <SyncConflictBanner />

        {activeTab === "plan" &&
        currentProgram &&
        (currentProgram.status === "active" || currentProgram.status === "paused") &&
        currentProgram.programPhase ? (
          <>
            {/* Readiness check — nenápadný, opt-in; nezávislý návrh, nesahá na program */}
            <ReadinessCard />
            {currentProgram.status === "active" && (
              <UpcomingWorkouts
                program={{
                  cycle: currentProgram.cycle,
                  week: currentProgram.week,
                  dayIndex: currentProgram.dayIndex,
                  programPhase: currentProgram.programPhase as ProgramSnapshot["programPhase"],
                  phaseWeek: currentProgram.phaseWeek ?? 1,
                  phaseBeforeSeventhWeek:
                    (currentProgram.phaseBeforeSeventhWeek as ProgramSnapshot["phaseBeforeSeventhWeek"]) ?? null,
                  trainingMaxes: currentProgram.trainingMaxes as ProgramSnapshot["trainingMaxes"],
                  split: currentProgram.split,
                  supplementalTemplate:
                    (currentProgram.supplementalTemplate ?? "bbb") as ProgramSnapshot["supplementalTemplate"],
                  seventhWeekType:
                    (currentProgram.seventhWeekType as ProgramSnapshot["seventhWeekType"]) ?? null,
                  rounding: currentProgram.rounding,
                }}
              />
            )}
            <ProgramSettings program={currentProgram} />
          </>
        ) : activeTab === "workout" ? (
          // 5/3/1 Program Flow
          currentProgram === undefined ? (
            // Loading
            <div className="flex items-center justify-center h-40">
              <div className="text-muted-foreground text-xs uppercase tracking-widest animate-pulse">
                {t("app.loading")}
              </div>
            </div>
          ) : currentProgram === null ? (
            // No program — show start button
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="text-6xl select-none">🏋️</div>
              <div className="text-center">
                <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl mb-2">
                  {t("program.title")}
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {t("program.description")}
                </p>
              </div>
              <button
                onClick={handleStartCalibration}
                className="bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest px-10 py-4 text-sm hover:opacity-90 active:scale-95 transition-all"
              >
                {t("program.startCalibration")}
              </button>
              <p className="text-xs text-muted-foreground/50 text-center max-w-xs">
                {t("program.calibrationHint")}
              </p>
            </div>
          ) : currentProgram.status === "calibrating" ? (
            // Calibration in progress
            <CalibrationFlow onComplete={() => console.log("[workout-page] Calibration complete!")} />
          ) : currentProgram.status === "paused" ? (
            // Program paused — show resume card
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="text-6xl select-none">⏸</div>
              <div className="text-center">
                <h2 className="font-heading font-extrabold uppercase tracking-widest text-xl mb-2">
                  {t("program.paused")}
                </h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {t("program.pausedDescription")}
                </p>
              </div>
              <button
                onClick={handleResumeProgram}
                className="bg-primary text-primary-foreground font-heading font-bold uppercase tracking-widest px-10 py-4 text-sm hover:opacity-90 active:scale-95 transition-all"
                style={{ minHeight: "44px" }}
              >
                {t("program.resume")}
              </button>
            </div>
          ) : (
            // Active program — show today's workout
            <ProgramWorkout program={currentProgram} onResetProgram={handleResetProgram} />
          )
        ) : (
          <WorkoutHistory />
        )}
      </main>

      {/* Side menu overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Side menu panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-card border-l border-border z-50 flex flex-col transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-border px-5 py-5 flex items-center justify-between">
          <span className="font-heading font-extrabold uppercase tracking-widest text-base">{t("nav.menu")}</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors"
            aria-label={t("nav.close")}
          >
            ×
          </button>
        </div>

        {/* Logged-in user */}
        {currentUser?.email && (
          <div className="px-5 py-3 border-b border-border/50">
            <p className="text-xs text-muted-foreground/50 uppercase tracking-widest mb-0.5">{t("auth.signedIn")}</p>
            <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
          </div>
        )}

        <nav className="flex-1 px-4 py-4 space-y-1">
          {/* Profile item */}
          <button
            onClick={() => {
              setMenuOpen(false)
              setProfileModalOpen(true)
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded text-left font-heading font-bold uppercase tracking-widest text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors group"
          >
            <span className="text-primary text-base">◎</span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground">{t("nav.athleteProfile")}</p>
              {athleteProfile ? (
                <p className="text-xs text-muted-foreground font-normal normal-case tracking-normal mt-0.5 truncate">
                  {athleteProfile.gender}, {athleteProfile.age} let · {athleteProfile.experience.split(" ")[0]}
                </p>
              ) : (
                <p className="text-xs text-primary/70 font-normal normal-case tracking-normal mt-0.5">
                  {t("nav.notSet")}
                </p>
              )}
            </div>
            <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">›</span>
          </button>

          {/* Statistics link */}
          <Link
            href="/statistics"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded text-left font-heading font-bold uppercase tracking-widest text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors group"
          >
            <BarChart3 className="w-4 h-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-foreground">{t("nav.statistics")}</p>
              <p className="text-xs text-muted-foreground font-normal normal-case tracking-normal mt-0.5">
                {t("nav.statsSubtitle")}
              </p>
            </div>
            <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">›</span>
          </Link>

        </nav>

        {/* Sign out */}
        <div className="px-4 pb-6 pt-2 border-t border-border space-y-1">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded text-left font-heading font-bold uppercase tracking-widest text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <span className="text-base">↪</span>
            {t("auth.signOut")}
          </button>
        </div>
      </div>

      {/* Profile modal */}
      {profileModalOpen && (
        <UserProfileModal
          initialProfile={athleteProfile}
          onSubmit={handleProfileSave}
          onClose={() => setProfileModalOpen(false)}
          submitLabel={t("profile.saveProfile")}
          subtitle={t("profile.subtitle")}
        />
      )}
    </div>
  )
}
