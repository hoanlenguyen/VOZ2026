// Head-to-head numbers for the match page. Every value is counted from Match records, so the
// comparison can only show what the results data contains (no shots or possession on the free plan).

export type FormResult = 'W' | 'D' | 'L'

export interface CompareRow {
  id: string
  label: string
  home: number
  away: number
  /** Decimal places for display (per-game averages). */
  decimals: number
  /** Appended to the value, e.g. "%" or " km". */
  unit: string
  /** Which side of the comparison is the stronger one; 'none' for neutral numbers (distance skated). */
  better: 'higher' | 'lower' | 'none'
}

export interface CompareGroup {
  id: string
  title: string
  note: string | null
  rows: CompareRow[]
}

export interface MatchCompare {
  groups: CompareGroup[]
  /** Last five results before kick-off, oldest first. Hockey has no draws: overtime results count as W / L. */
  form: { home: FormResult[], away: FormResult[] }
}
