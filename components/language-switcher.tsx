"use client"

import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { isSupportedLang, SUPPORTED_LANGS, type SupportedLang } from "@/lib/i18n-config"
import i18n from "@/lib/i18n"

const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 rok v sekundách

function setLangCookie(lang: SupportedLang): void {
  document.cookie = `lang=${lang}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`
}

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const router = useRouter()

  const currentLang = isSupportedLang(i18n.language) ? i18n.language : "cs"

  const handleSwitch = (lang: SupportedLang) => {
    if (lang === currentLang) return
    i18n.changeLanguage(lang)
    setLangCookie(lang)
    router.refresh()
  }

  return (
    <div
      role="group"
      aria-label={t("language.switchAria")}
      className="flex gap-1"
    >
      {SUPPORTED_LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => handleSwitch(lang)}
          aria-pressed={lang === currentLang}
          className={`px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-widest rounded border transition-all ${
            lang === currentLang
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-background border-border text-muted-foreground hover:border-primary hover:text-foreground"
          }`}
        >
          {t(`language.${lang}`)}
        </button>
      ))}
    </div>
  )
}
