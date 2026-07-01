/**
 * Kanonická URL nasazené aplikace a náhledový obrázek pro social sharing.
 *
 * V produkci nastav `NEXT_PUBLIC_SITE_URL` (např. https://tvoje-domena.cz) —
 * použije se pro `metadataBase`, OpenGraph a Twitter karty. Pokud není nastavená,
 * padá zpět na localhost pro lokální vývoj.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

/**
 * Absolutní URL náhledového obrázku pro OG/Twitter karty.
 * Soubor umísti do `public/og-image.png` (doporučeno 1200×630).
 */
export const OG_IMAGE = `${SITE_URL}/og-image.png`
