/**
 * Serverová (RSC-safe) i18n instance pro React Server Components (např. landing app/page.tsx).
 *
 * Klíčové: NEPOUŽÍVÁ react-i18next. react-i18next volá React.createContext při načtení
 * modulu, což v RSC spadne ("createContext is not a function"). Čistá i18next instance
 * je framework-agnostická a v RSC bezpečná. Pro `i18n.t()` v server komponentách.
 *
 * Klientské komponenty používají lib/i18n.ts (react-i18next + useTranslation).
 *
 * Exportuje getServerI18n(lang) — vrátí PER-REQUEST instanci s nastavením dle lang.
 * Každé volání vytvoří novou instanci přes createInstance(), čímž eliminuje race condition
 * mezi souběžnými requesty (jeden EN, jeden CS) na sdíleném singletonu.
 */

import { createInstance } from "i18next"

import { defaultNS, resources, isSupportedLang, DEFAULT_LANG, SupportedLang } from "@/lib/i18n-config"

/**
 * Vrátí novou i18n instanci inicializovanou pro daný jazyk.
 * Per-request: každé volání dostane svoji vlastní instanci — bez race condition.
 * Async: i18next init vrací Promise (i když je s inline resources de facto synchronní).
 */
export async function getServerI18n(lang: string) {
  const resolvedLang: SupportedLang = isSupportedLang(lang) ? lang : DEFAULT_LANG
  const instance = createInstance()
  await instance.init({
    lng: resolvedLang,
    fallbackLng: DEFAULT_LANG,
    supportedLngs: ["cs", "en"],
    resources,
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
  })
  return instance
}
