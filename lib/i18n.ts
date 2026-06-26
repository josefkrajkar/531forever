/**
 * KLIENTSKÁ i18n konfigurace (react-i18next) — pro useTranslation() v client komponentách.
 * Jazyk pevně nastaven na cs, připraveno na EN v budoucnu.
 * LanguageDetector záměrně nepoužíváme — přistupuje k browser API a způsobuje
 * SSR/RSC chyby v Next.js App Routeru.
 *
 * POZOR: tento modul importuje react-i18next, který volá React.createContext při načtení
 * → NESMÍ se importovat do React Server Component. Pro RSC (landing) viz lib/i18n-server.ts.
 */

import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { defaultNS, resources } from "@/lib/i18n-config"

export { defaultNS, resources }

// Zabraňuje vícenásobnému volání init (hot reload, Strict mode)
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      defaultNS,
      lng: "cs",
      fallbackLng: "cs",
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
