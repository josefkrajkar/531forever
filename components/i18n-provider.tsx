"use client"

/**
 * I18nProvider — inicializuje i18next jako side effect.
 * I18nextProvider záměrně NEPOUŽÍVÁME — react-i18next v17 + Next.js 16 RSC
 * nejsou kompatibilní. initReactI18next plugin registruje instanci globálně
 * přes setI18n(), takže useTranslation() funguje bez provideru.
 */

import "@/lib/i18n"

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
