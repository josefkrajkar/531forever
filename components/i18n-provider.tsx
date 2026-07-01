"use client"

/**
 * I18nProvider — synchronizuje i18next jazyk se serverovým prop `lang` (z cookie).
 *
 * Proč useEffect místo přímého volání v renderu:
 * i18n.changeLanguage() triggeruje state update v react-i18next subscriberech
 * (každá komponenta s useTranslation). Volání v těle renderu by způsobilo React
 * warning "Cannot update a component while rendering a different component".
 *
 * useEffect + ref pattern:
 * - changeLanguage se volá až po commitu, mimo render fázi → žádná React chyba
 * - ref sleduje, jaký lang byl naposledy aplikován z prop — změna proběhne jen
 *   tehdy, kdy se prop skutečně změní (nový RSC payload po router.refresh)
 * - tím se zabrání přepsání jazyka nastaveného uživatelem přes LanguageSwitcher
 *   při re-renderech před dokončením router.refresh()
 *
 * Hydration-safe: lib/i18n.ts inicializuje klienta na DEFAULT_LANG (shodně se SSR),
 * takže první render nezpůsobí hydration mismatch. Skutečný jazyk z cookie (server
 * prop `lang`) se aplikuje zde v useEffect po hydrataci — u ne-defaultního jazyka
 * proto může na první paint krátce probliknout DEFAULT_LANG (viz lib/i18n.ts).
 */

import { useEffect, useRef } from "react"
import i18n from "@/lib/i18n"
import { isSupportedLang, DEFAULT_LANG } from "@/lib/i18n-config"

interface I18nProviderProps {
  lang: string
  children: React.ReactNode
}

export function I18nProvider({ lang, children }: I18nProviderProps) {
  const resolvedLang = isSupportedLang(lang) ? lang : DEFAULT_LANG
  const lastAppliedRef = useRef<string | null>(null)

  useEffect(() => {
    // Aplikuj jazyk jen pokud se prop skutečně změnil (ne při každém re-renderu)
    if (lastAppliedRef.current !== resolvedLang) {
      lastAppliedRef.current = resolvedLang
      if (i18n.language !== resolvedLang) {
        i18n.changeLanguage(resolvedLang)
      }
    }
  }, [resolvedLang])

  return <>{children}</>
}
