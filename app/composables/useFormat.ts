// Dates, scores and numbers in the reader's language.
import type { Lang } from '#shared/utils/format'
import { INTL_LOCALE } from '#shared/utils/format'

export function useFormat() {
  const { locale, t } = useI18n()
  const lang = computed(() => locale.value as Lang)
  const fixture = (iso: string) => {
    const p = fixtureParts(iso, lang.value)
    return { ...p, day: p.relative ? t(`time.${p.relative}`) : p.day }
  }
  return {
    lang,
    fixture,
    /** "22:00, Today" / "17:00, Huomenna" for labels. */
    fixtureLabel: (iso: string) => {
      const f = fixture(iso)
      return `${f.time}, ${f.day}`
    },
    stamp: (iso: string) => storyStamp(iso, lang.value),
    score: (m: Parameters<typeof formatScore>[0]) => formatScore(m, lang.value),
    number: (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(INTL_LOCALE[lang.value], opts),
  }
}
