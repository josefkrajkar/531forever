/**
 * Sdílená i18n konfigurace (resources + defaultNS).
 * RSC-safe: žádný import i18next ani react-i18next — jen data.
 * Importují ji klientská lib/i18n.ts i serverová lib/i18n-server.ts.
 */

import csCommon from "@/public/locales/cs/common.json"

export const defaultNS = "common"

export const resources = {
  cs: { common: csCommon },
  // en: { common: enCommon },  // připraveno pro budoucí překlad
} as const
