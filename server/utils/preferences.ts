// Readers' favourite teams, leagues and players (/my-teams), per account in "kvcache" (Workers KV in
// production, memory in dev). Choices are mock data for the demo: the teams of the mock "deep data"
// matches (today Ipswich and Nott'm Forest), their line-up players, and every competition we cover.
import type { Lang } from '#shared/utils/format'
import type { PreferenceOptions, Preferences } from '#shared/types/preferences'
import type { PublicAccount } from '#shared/types/account'

const key = (accountId: string) => `prefs:${accountId}`
const MAX = 50

export const playerSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export async function preferenceOptions(lang: Lang): Promise<PreferenceOptions> {
  const teams = new Map<string, PreferenceOptions['teams'][number]>()
  const players = new Map<string, PreferenceOptions['players'][number]>()
  await Promise.all(COMPETITIONS.map(async (def) => {
    const provider = providerFor(def)
    if (provider.unavailableReason(def)) return
    const season = await provider.matches(def, {}).then(r => r.data, () => [])
    for (const mock of await mockMatchesFor(def, season, lang)) {
      for (const side of ['home', 'away'] as const) {
        const team = mock.match[side]
        teams.set(team.key, { key: team.key, name: team.name, shortName: team.shortName, logo: team.logo, competitionId: def.id, competitionName: competitionName(def, lang) })
        const lineup = mock.extras?.lineups?.[side]
        for (const p of [...(lineup?.starters ?? []), ...(lineup?.substitutes ?? [])]) {
          const k = `${team.key}:${playerSlug(p.name)}`
          players.set(k, { key: k, name: p.name, number: p.number, position: p.position, teamKey: team.key })
        }
      }
    }
  }))
  return {
    teams: [...teams.values()].sort((a, b) => a.shortName.localeCompare(b.shortName)),
    leagues: COMPETITIONS.map((c) => {
      const d = describeCompetition(c, lang)
      return { id: d.id, name: d.name, country: d.country, sport: d.sport, available: d.available }
    }),
    players: [...players.values()],
  }
}

/** Saved preferences; before the first save, the account's followed teams and their leagues. */
export async function loadPreferences(account: PublicAccount): Promise<Preferences> {
  const saved = await useStorage('kvcache').getItem<Preferences>(key(account.id)).catch(() => null)
  if (saved) return saved
  return {
    teams: account.followedTeams,
    leagues: [...new Set(account.followedTeams.map(t => t.split(':')[0]!))],
    players: [],
  }
}

/** Keeps only choices that exist in the options. */
export function cleanPreferences(input: Partial<Record<keyof Preferences, unknown>> | undefined, options: PreferenceOptions): Preferences {
  const pick = (v: unknown, allowed: Set<string>) =>
    [...new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && allowed.has(x)) : [])].slice(0, MAX)
  return {
    teams: pick(input?.teams, new Set(options.teams.map(t => t.key))),
    leagues: pick(input?.leagues, new Set(options.leagues.map(l => l.id))),
    players: pick(input?.players, new Set(options.players.map(p => p.key))),
  }
}

export async function savePreferences(accountId: string, prefs: Preferences) {
  await useStorage('kvcache').setItem(key(accountId), prefs)
}
