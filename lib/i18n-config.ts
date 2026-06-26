/**
 * Sdílená i18n konfigurace (resources + defaultNS).
 * RSC-safe: žádný import i18next ani react-i18next — jen data.
 * Importují ji klientská lib/i18n.ts i serverová lib/i18n-server.ts.
 */

import csCommon from "@/public/locales/cs/common.json"
import enCommon from "@/public/locales/en/common.json"

export const defaultNS = "common"

export const SUPPORTED_LANGS = ["cs", "en"] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]
export const DEFAULT_LANG: SupportedLang = "cs"

export function isSupportedLang(x: unknown): x is SupportedLang {
  return SUPPORTED_LANGS.includes(x as SupportedLang)
}

export const resources = {
  cs: { common: csCommon },
  en: { common: enCommon },
} as const
