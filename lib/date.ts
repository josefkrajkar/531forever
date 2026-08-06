/**
 * Sdílený util pro lokální datum — nahrazuje .toISOString() vzory,
 * které v UTC+ časových pásmech posouvají "dnešek" o den zpět.
 */

export function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
