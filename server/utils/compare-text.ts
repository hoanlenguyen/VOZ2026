// Comparison labels and notes per language (server/utils/compare.ts picks the numbers).
import type { Lang } from '#shared/utils/format'

interface CompareText {
  periods: Record<SportId, string[]>
  goals: string
  penalties: string
  shootoutWon: (team: string, sport: SportId) => string
  thisMatch: string
  matchStats: string
  /** Labels by row id / MatchTeam.stats key. */
  rows: Record<string, string>
  puckNote: string
  beforeStart: (sport: SportId) => string
  noGamesYet: (league: string) => string
  gamesBefore: (league: string, sport: SportId, home: number, away: number) => string
  cleanSheets: (sport: SportId) => string
  failedToScore: (sport: SportId) => string
  lastFive: string
  meetings: string
  meetingsNote: (n: number, drawn: number) => string
}

const en: CompareText = {
  periods: {
    football: ['1st half goals', '2nd half goals', 'Extra-time goals'],
    hockey: ['1st period goals', '2nd period goals', '3rd period goals', 'Overtime goals'],
  },
  goals: 'Goals',
  penalties: 'Penalty shootout',
  shootoutWon: (team, sport) => `${team} won the ${sport === 'hockey' ? 'shootout' : 'penalty shootout'}.`,
  thisMatch: 'This match',
  matchStats: 'Match stats',
  rows: {
    'puck-control': 'Puck control',
    'possessionPct': 'Possession',
    'xg': 'Expected goals (xG)',
    'shots': 'Shots',
    'shotsOnTarget': 'Shots on target',
    'bigChances': 'Big chances created',
    'corners': 'Corners',
    'blockedShots': 'Blocked shots',
    'faceoffWins': 'Faceoffs won',
    'passes': 'Passes',
    'pass-accuracy': 'Pass accuracy',
    'tackles': 'Tackles',
    'saves': 'Saves',
    'fouls': 'Fouls',
    'offsides': 'Offsides',
    'yellowCards': 'Yellow cards',
    'powerplayGoals': 'Power-play goals',
    'powerplayChances': 'Power plays',
    'shortHandedGoals': 'Short-handed goals',
    'penaltyMinutes': 'Penalty minutes',
    'distanceKm': 'Distance skated',
    'points': 'Points',
    'ppg': 'Points per game',
    'venue-ppg': 'Points per game home / away',
    'won': 'Wins',
    'lost': 'Defeats',
    'scored': 'Goals scored',
    'conceded': 'Goals conceded',
    'gpg': 'Goals per game',
    'form-points': 'Points from last 5',
    'meetings-won': 'Wins',
  },
  puckNote: 'Puck control leaves out time when neither team had the puck.',
  beforeStart: sport => `Before ${sport === 'hockey' ? 'puck drop' : 'kick-off'}`,
  noGamesYet: league => `Neither team had played in ${league} yet this season.`,
  gamesBefore: (league, sport, h, a) =>
    `${league} ${sport === 'hockey' ? 'games' : 'matches'} this season before ${sport === 'hockey' ? 'puck drop' : 'kick-off'}: ${h} and ${a} played.`,
  cleanSheets: sport => (sport === 'hockey' ? 'Shutouts' : 'Clean sheets'),
  failedToScore: sport => (sport === 'hockey' ? 'Shut out' : 'Failed to score'),
  lastFive: 'Last five matches',
  meetings: 'Earlier meetings this season',
  meetingsNote: (n, drawn) => `${n} match${n === 1 ? '' : 'es'}${drawn ? `, ${drawn} drawn` : ''}.`,
}

const fi: CompareText = {
  periods: {
    football: ['1. puoliajan maalit', '2. puoliajan maalit', 'Jatkoajan maalit'],
    hockey: ['1. erän maalit', '2. erän maalit', '3. erän maalit', 'Jatkoajan maalit'],
  },
  goals: 'Maalit',
  penalties: 'Rangaistuspotkukilpailu',
  shootoutWon: (team, sport) => `${sport === 'hockey' ? 'Voittolaukauskilpailun' : 'Rangaistuspotkukilpailun'} voitti ${team}.`,
  thisMatch: 'Tämä ottelu',
  matchStats: 'Ottelutilastot',
  rows: {
    'puck-control': 'Kiekonhallinta',
    'possessionPct': 'Pallonhallinta',
    'xg': 'Maaliodottama (xG)',
    'shots': 'Laukaukset',
    'shotsOnTarget': 'Laukaukset maalia kohti',
    'bigChances': 'Isot maalipaikat',
    'corners': 'Kulmapotkut',
    'blockedShots': 'Blokatut laukaukset',
    'faceoffWins': 'Voitetut aloitukset',
    'passes': 'Syötöt',
    'pass-accuracy': 'Syöttötarkkuus',
    'tackles': 'Taklaukset',
    'saves': 'Torjunnat',
    'fouls': 'Rikkeet',
    'offsides': 'Paitsiot',
    'yellowCards': 'Keltaiset kortit',
    'powerplayGoals': 'Ylivoimamaalit',
    'powerplayChances': 'Ylivoimat',
    'shortHandedGoals': 'Alivoimamaalit',
    'penaltyMinutes': 'Jäähyminuutit',
    'distanceKm': 'Luisteltu matka',
    'points': 'Pisteet',
    'ppg': 'Pisteet per ottelu',
    'venue-ppg': 'Pisteet per ottelu koti / vieras',
    'won': 'Voitot',
    'lost': 'Tappiot',
    'scored': 'Tehdyt maalit',
    'conceded': 'Päästetyt maalit',
    'gpg': 'Maalit per ottelu',
    'form-points': 'Pisteet viidestä viimeisestä',
    'meetings-won': 'Voitot',
  },
  puckNote: 'Kiekonhallinnasta on jätetty pois aika, jolloin kiekko ei ollut kummankaan joukkueen hallussa.',
  beforeStart: sport => (sport === 'hockey' ? 'Ennen aloitusta' : 'Ennen avausta'),
  noGamesYet: league => `Kumpikaan joukkue ei ollut vielä pelannut tällä kaudella (${league}).`,
  gamesBefore: (league, _sport, h, a) => `Kauden ottelut ennen tätä peliä (${league}): ${h} ja ${a}.`,
  cleanSheets: sport => (sport === 'hockey' ? 'Nollapelit' : 'Nollapelit'),
  failedToScore: sport => (sport === 'hockey' ? 'Jäi ilman maalia' : 'Jäi ilman maalia'),
  lastFive: 'Viisi viimeisintä ottelua',
  meetings: 'Aiemmat kohtaamiset tällä kaudella',
  meetingsNote: (n, drawn) => `${n} ${n === 1 ? 'ottelu' : 'ottelua'}${drawn ? `, ${drawn} tasapeli${drawn === 1 ? '' : 'ä'}` : ''}.`,
}

export const COMPARE_TEXT: Record<Lang, CompareText> = { en, fi }
