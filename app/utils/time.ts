// All match times are shown in Finnish time, the home market of the product.
import { INTL_LOCALE, type Lang } from '#shared/utils/format'

const TZ = 'Europe/Helsinki'
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })

/**
 * Kick-off time and day: { time: "22:00", day: "Sat 25 Oct", relative: null }, or relative
 * 'today' / 'tomorrow' (then `day` is empty and the caller shows its own translated word).
 */
export function fixtureParts(iso: string, lang: Lang = 'en', now = new Date()) {
  const d = new Date(iso)
  const locale = INTL_LOCALE[lang]
  const time = d.toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const tomorrow = new Date(now.getTime() + 86_400_000)
  const relative = dayKey(d) === dayKey(now) ? 'today' as const : dayKey(d) === dayKey(tomorrow) ? 'tomorrow' as const : null
  const day = relative ? '' : d.toLocaleDateString(locale, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
  return { time, day, relative }
}

/** "17:36 23/10/2026" (fi: "17.36 23.10.2026") style stamp for story lists. */
export function storyStamp(iso: string, lang: Lang = 'en'): string {
  const d = new Date(iso)
  const locale = INTL_LOCALE[lang]
  return `${d.toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString(locale, { timeZone: TZ })}`
}
