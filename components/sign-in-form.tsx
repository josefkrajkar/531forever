"use client"

import { useAuthActions } from "@convex-dev/auth/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { LanguageSwitcher } from "@/components/language-switcher"

type Step =
  | "signIn"
  | "signUp"
  | "forgot"
  | { type: "verifyEmail"; email: string }
  | { type: "resetPassword"; email: string }

export function SignInForm() {
  const { signIn } = useAuthActions()
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>("signIn")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const reset = (s: Step) => { setStep(s); setError(null); setPassword("") }

  // ─── E-mail verifikace po registraci ───────────────────────────────────────
  if (typeof step === "object" && step.type === "verifyEmail") {
    return (
      <AuthShell
        label={t("auth.signUp")}
        title={t("auth.verifyEmail")}
        subtitle={<>{t("auth.verifyEmailSubtitle")} <span className="text-foreground font-medium">{step.email}</span></>}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setIsLoading(true)
            try {
              const fd = new FormData(e.currentTarget)
              await signIn("password", fd)
            } catch {
              setError(t("auth.errors.invalidCode"))
            } finally {
              setIsLoading(false)
            }
          }}
          className="space-y-4"
        >
          <input name="email" type="hidden" value={step.email} />
          <input name="flow" type="hidden" value="email-verification" />
          <Field label={t("auth.codeLabel")}>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              placeholder="123456"
              required
              autoFocus
              autoComplete="one-time-code"
              disabled={isLoading}
              className="input tracking-[0.5em] text-center font-heading font-bold"
            />
          </Field>
          <ErrorBox msg={error} />
          <SubmitButton loading={isLoading} label={t("auth.verifyAndEnter")} loadingLabel={t("auth.verifying")} />
          <LinkBtn onClick={() => reset("signIn")}>{t("auth.backToSignIn")}</LinkBtn>
        </form>
      </AuthShell>
    )
  }

  // ─── Reset hesla — zadání kódu + nového hesla ──────────────────────────────
  if (typeof step === "object" && step.type === "resetPassword") {
    return (
      <AuthShell
        label={t("auth.forgotPasswordReset")}
        title={t("auth.resetPasswordTitle")}
        subtitle={<>{t("auth.resetPasswordSubtitle")}</>}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setIsLoading(true)
            try {
              const fd = new FormData(e.currentTarget)
              await signIn("password", fd)
            } catch {
              setError(t("auth.errors.invalidCodeOrShortPassword"))
            } finally {
              setIsLoading(false)
            }
          }}
          className="space-y-4"
        >
          <input name="email" type="hidden" value={step.email} />
          <input name="flow" type="hidden" value="reset-verification" />
          <Field label={t("auth.codeLabel")}>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              placeholder="123456"
              required
              autoFocus
              disabled={isLoading}
              className="input tracking-[0.5em] text-center font-heading font-bold"
            />
          </Field>
          <Field label={t("auth.newPasswordLabel")}>
            <input
              name="newPassword"
              type="password"
              placeholder={t("auth.passwordMinHint")}
              required
              minLength={8}
              disabled={isLoading}
              className="input"
            />
          </Field>
          <ErrorBox msg={error} />
          <SubmitButton loading={isLoading} label={t("auth.setPassword")} loadingLabel={t("auth.settingPassword")} />
          <LinkBtn onClick={() => reset("signIn")}>{t("auth.backToSignIn")}</LinkBtn>
        </form>
      </AuthShell>
    )
  }

  // ─── Zapomenuté heslo ──────────────────────────────────────────────────────
  if (step === "forgot") {
    return (
      <AuthShell
        label={t("auth.forgotPasswordReset")}
        title={t("auth.forgotPasswordTitle")}
        subtitle={t("auth.forgotPasswordSubtitle")}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setIsLoading(true)
            const fd = new FormData(e.currentTarget)
            try {
              await signIn("password", fd)
              setStep({ type: "resetPassword", email: fd.get("email") as string })
            } catch {
              setError(t("auth.errors.emailNotFound"))
            } finally {
              setIsLoading(false)
            }
          }}
          className="space-y-4"
        >
          <input name="flow" type="hidden" value="reset" />
          <Field label={t("auth.emailLabel")}>
            <input
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
              autoFocus
              disabled={isLoading}
              className="input"
            />
          </Field>
          <ErrorBox msg={error} />
          <SubmitButton loading={isLoading} label={t("auth.sendCode")} loadingLabel={t("auth.sendingCode")} />
          <LinkBtn onClick={() => reset("signIn")}>{t("auth.backToSignIn")}</LinkBtn>
        </form>
      </AuthShell>
    )
  }

  // ─── Přihlášení / Registrace ───────────────────────────────────────────────
  const isSignUp = step === "signUp"

  return (
    <AuthShell
      label={isSignUp ? t("auth.signUp") : t("auth.signIn")}
      title={isSignUp ? t("auth.createAccount") : t("auth.enterJournal")}
      subtitle={isSignUp ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          setIsLoading(true)
          const fd = new FormData(e.currentTarget)
          try {
            await signIn("password", fd)
            if (isSignUp) {
              setStep({ type: "verifyEmail", email: fd.get("email") as string })
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : ""
            if (msg.includes("Příliš mnoho pokusů")) {
              setError(t("auth.errors.tooManyAttempts"))
            } else if (msg.includes("already exists")) {
              setError(t("auth.errors.accountExists"))
            } else if (msg.includes("Invalid password") || msg.includes("too short")) {
              setError(t("auth.errors.passwordTooShort"))
            } else if (msg.includes("InvalidSecret") || msg.includes("wrong password")) {
              setError(t("auth.errors.wrongPassword"))
            } else {
              setError(t("auth.errors.signInFailed"))
            }
          } finally {
            setIsLoading(false)
          }
        }}
        className="space-y-4"
      >
        <input name="flow" type="hidden" value={isSignUp ? "signUp" : "signIn"} />
        <Field label={t("auth.emailLabel")}>
          <input
            name="email"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            required
            autoComplete="email"
            disabled={isLoading}
            onChange={() => error && setError(null)}
            className="input"
          />
        </Field>
        <Field label={isSignUp ? t("auth.passwordLabelWithMin") : t("auth.passwordLabel")}>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            required
            minLength={isSignUp ? 8 : undefined}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            disabled={isLoading}
            value={password}
            onChange={(e) => { setPassword(e.target.value); error && setError(null) }}
            className="input"
          />
        </Field>

        <ErrorBox msg={error} />

        <SubmitButton
          loading={isLoading}
          label={isSignUp ? t("auth.submitSignUp") : t("auth.submitSignIn")}
          loadingLabel={isSignUp ? t("auth.submittingSignUp") : t("auth.submittingSignIn")}
        />

        <div className="flex flex-col items-center gap-2 pt-1">
            <LinkBtn onClick={() => reset(isSignUp ? "signIn" : "signUp")}>
              {isSignUp ? t("auth.switchToSignIn") : t("auth.switchToSignUp")}
            </LinkBtn>
          {!isSignUp && (
            <LinkBtn onClick={() => reset("forgot")}>{t("auth.forgotPassword")}</LinkBtn>
          )}
        </div>
      </form>
    </AuthShell>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AuthShell({
  label,
  title,
  subtitle,
  children,
}: {
  label: string
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <img
              src="/icons/icon-192.png"
              alt="531Forever"
              className="w-8 h-8 rounded-sm"
            />
            <span className="font-heading font-extrabold text-2xl uppercase tracking-widest">
              {t("app.name")}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <h1 className="font-heading font-extrabold uppercase tracking-widest text-3xl leading-tight">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2 leading-relaxed">
      {msg}
    </p>
  )
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-primary text-primary-foreground font-heading font-extrabold uppercase tracking-widest py-4 rounded hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

function LinkBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
    >
      {children}
    </button>
  )
}

// Tailwind class for inputs — defined globally via globals.css or inline
// Using inline to avoid global.css pollution:
// className="input" → added to globals.css as @layer components
