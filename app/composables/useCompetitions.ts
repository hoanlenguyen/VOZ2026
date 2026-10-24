/** Competitions grouped by sport, for pickers. */
export async function useCompetitions() {
  const { t, locale } = useI18n()
  const { data, error } = await useFetch('/api/competitions', { query: { lang: locale } })
  const bySport = computed(() => {
    const groups = new Map<SportId, Competition[]>()
    for (const c of data.value?.competitions ?? []) groups.set(c.sport, [...(groups.get(c.sport) ?? []), c])
    return [...groups].map(([sport, competitions]) => ({ sport, label: t(`sport.${sport}`), competitions }))
  })
  return { competitions: computed(() => data.value?.competitions ?? []), bySport, error }
}
