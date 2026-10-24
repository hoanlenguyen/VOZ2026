// NUXT_OPENAI_MODEL can be written the way people say it ("GPT-6 Luna") or as the API id
// ("gpt-6-luna"). The API always gets the id; readers always see the display name.

/** "GPT-6 Luna" -> "gpt-6-luna"; ids pass through unchanged. */
export function modelId(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
}

/** "gpt-6-luna" -> "GPT-6 Luna", "gpt-6-sol-mini" -> "GPT-6 Sol Mini". */
export function modelLabel(idOrName: string): string {
  const [family = '', ...rest] = modelId(idOrName).split('-')
  const version = rest[0] && /^\d/.test(rest[0]) ? rest.shift() : null
  const head = family === 'gpt' ? 'GPT' : family.charAt(0).toUpperCase() + family.slice(1)
  const tail = rest.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return [version ? `${head}-${version}` : head, tail].filter(Boolean).join(' ')
}
