// Demo accounts (data/accounts/accounts.json). What a plan unlocks is decided on the server
// (server/utils/accounts.ts entitlements); the browser only gets this public view.

export type Plan = 'free' | 'subscriber' | 'newsroom'

export interface Entitlements {
  /** AI match stories, comparison, timeline and line-ups. */
  premium: boolean
  /** Advertisers' posts and sponsor slots: shown to every reader today. */
  ads: boolean
  /** /newsroom dashboard and moderation. */
  newsroom: boolean
}

export interface PublicAccount {
  id: string
  email: string
  name: string
  plan: Plan
  followedTeams: string[]
  subscription: { product: string, since: string, renewsOn: string, priceEurPerMonth: number } | null
  newsroom: { role: string, desk: string } | null
}

/** GET /api/auth/me: the signed-in account (null when signed out) and what the visitor may see. */
export interface SessionInfo {
  account: PublicAccount | null
  entitlements: Entitlements
}
