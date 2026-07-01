/**
 * KLIENTSKÁ i18n konfigurace (react-i18next) — pro useTranslation() v client komponentách.
 * LanguageDetector záměrně nepoužíváme — přistupuje k browser API a způsobuje
 * SSR/RSC chyby v Next.js App Routeru.
 *
 * Počáteční jazyk je záměrně DEFAULT_LANG — stejný, jaký použije SSR klientských
 * komponent (na serveru není cookie dostupná v module scope). Díky tomu se první
 * (hydratační) render na klientovi shoduje se serverovým HTML → žádný hydration
 * mismatch. Skutečný jazyk z cookie aplikuje až I18nProvider ve svém useEffect
 * (po hydrataci) přes serverový prop `lang`.
 *
 * POZOR: tento modul importuje react-i18next, který volá React.createContext při načtení
 * → NESMÍ se importovat do React Server Component. Pro RSC (landing) viz lib/i18n-server.ts.
 */

import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { defaultNS, resources, DEFAULT_LANG } from "@/lib/i18n-config"

export { defaultNS, resources }

// Zabraňuje vícenásobnému volání init (hot reload, Strict mode)
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      defaultNS,
      lng: DEFAULT_LANG,
      fallbackLng: DEFAULT_LANG,
      supportedLngs: ["cs", "en"],
      interpolation: {
        escapeValue: false, // React escapuje sám
      },
      react: {
        useSuspense: false, // Kompatibilita s SSR / Next.js
      },
    })
    .catch((err: unknown) => console.error("[i18n] init failed:", err))
}

export default i18n
