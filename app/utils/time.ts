// All match times are shown in Finnish time, the home market of the product.
const TZ = 'Europe/Helsinki'
const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })

/** "22:00, Today" / "17:00, Tomorrow" / "19:30, Sat 25 Oct" */
export function fixtureTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const tomorrow = new Date(now.getTime() + 86_400_000)
  const day = dayKey(d) === dayKey(now)
    ? 'Today'
    : dayKey(d) === dayKey(tomorrow)
      ? 'Tomorrow'
      : d.toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
  return `${time}, ${day}`
}

/** "17:36 23/10/2026" style stamp for story lists. */
export function storyStamp(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('en-GB', { timeZone: TZ })}`
}
