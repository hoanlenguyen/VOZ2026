import type { H3Event } from 'h3'
import { LANGS, type Lang } from '#shared/utils/format'

/** The reader's language from `?lang=`, English when missing or unknown. */
export function requestLang(event: H3Event): Lang {
  const lang = getQuery(event).lang
  return LANGS.includes(lang as Lang) ? lang as Lang : 'en'
}
