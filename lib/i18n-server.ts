/**
 * Serverová (RSC-safe) i18n instance pro React Server Components (např. landing app/page.tsx).
 *
 * Klíčové: NEPOUŽÍVÁ react-i18next. react-i18next volá React.createContext při načtení
 * modulu, což v RSC spadne ("createContext is not a function"). Čistá i18next instance
 * je framework-agnostická a v RSC bezpečná. Pro `i18n.t()` v server komponentách.
 *
 * Klientské komponenty používají lib/i18n.ts (react-i18next + useTranslation).
 */

import { createInstance } from "i18next"

import { defaultNS, resources } from "@/lib/i18n-config"

const i18nServer = createInstance()

if (!i18nServer.isInitialized) {
  i18nServer.init({
    resources,
    defaultNS,
    lng: "cs",
    fallbackLng: "cs",
    supportedLngs: ["cs"],
    interpolation: {
      escapeValue: false,
    },
  })
}

export default i18nServer
