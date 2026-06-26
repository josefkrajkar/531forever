"use client"

/**
 * I18nProvider — inicializuje i18next jako side effect (import "@/lib/i18n")
 * a synchronně přepne jazyk dle prop `lang` ještě před vykreslením children.
 *
 * Hydration-safe: changeLanguage je synchronní (inline resources), takže
 * i18n.language === lang platí už při prvním (hydratačním) renderu.
 * Tím se vyhýbáme mismatch vůči serverovému HTML.
 *
 * I18nextProvider záměrně NEPOUŽÍVÁME — react-i18next v17 + Next.js 16 RSC
 * nejsou kompatibilní. initReactI18next plugin registruje instanci globálně
 * přes setI18n(), takže useTranslation() funguje bez provideru.
 */

import i18n from "@/lib/i18n"
import { isSupportedLang, DEFAULT_LANG } from "@/lib/i18n-config"

interface I18nProviderProps {
  lang: string
  children: React.ReactNode
}

export function I18nProvider({ lang, children }: I18nProviderProps) {
  const resolvedLang = isSupportedLang(lang) ? lang : DEFAULT_LANG

  // Synchronní guard: přepne jazyk ještě před renderem children.
  // changeLanguage je synchronní díky inline resources — nevzniká flicker ani loop.
  if (i18n.language !== resolvedLang) {
    i18n.changeLanguage(resolvedLang)
  }

  return <>{children}</>
}
