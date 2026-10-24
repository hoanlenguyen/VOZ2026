// Demo accounts and sessions. Accounts come from data/accounts/accounts.json (server asset
// "accounts"); passwords are PBKDF2-SHA256 hashes. The session is a signed cookie
// "<accountId>.<expiry>.<hmac>" (HMAC-SHA256 with NUXT_SESSION_SECRET), httpOnly, 7 days.
import type { H3Event } from 'h3'
import type { Entitlements, Plan, PublicAccount, SessionInfo } from '#shared/types/account'

interface StoredAccount extends PublicAccount {
  password: { algo: 'PBKDF2-SHA256', iterations: number, salt: string, hash: string }
}

const COOKIE = 'voz_session'
const MAX_AGE = 7 * 86_400
const DEV_SECRET = 'voz-dev-session-secret'
const encoder = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

export function entitlements(plan: Plan | null): Entitlements {
  return {
    premium: plan === 'subscriber' || plan === 'newsroom',
    ads: plan !== 'subscriber' && plan !== 'newsroom',
    newsroom: plan === 'newsroom',
  }
}

async function loadAccounts(): Promise<StoredAccount[]> {
  const file = await useStorage('assets:accounts').getItem<{ accounts: StoredAccount[] }>('accounts.json')
  return file?.accounts ?? []
}

const toPublic = ({ password: _password, ...a }: StoredAccount): PublicAccount => a

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256))
}

/** Constant-time string compare (same length hex strings). */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyLogin(email: string, password: string): Promise<PublicAccount | null> {
  const account = (await loadAccounts()).find(a => a.email.toLowerCase() === email.trim().toLowerCase())
  // Hash even when the email is unknown, so the response time does not reveal which emails exist.
  const p = account?.password ?? { salt: 'unknown', iterations: 100_000, hash: '' }
  const hash = await pbkdf2(password, p.salt, p.iterations)
  return account && equal(hash, p.hash) ? toPublic(account) : null
}

function secret(): string {
  const s = String(useRuntimeConfig().sessionSecret || '')
  if (!s && !import.meta.dev) console.warn('[accounts] NUXT_SESSION_SECRET is not set; using the demo secret')
  return s || DEV_SECRET
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export async function startSession(event: H3Event, account: PublicAccount) {
  const value = `${account.id}.${Math.floor(Date.now() / 1000) + MAX_AGE}`
  setCookie(event, COOKIE, `${value}.${await sign(value)}`, {
    httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, path: '/', maxAge: MAX_AGE,
  })
}

export function endSession(event: H3Event) {
  deleteCookie(event, COOKIE, { path: '/' })
}

/** The signed-in account, or null for a missing, expired or tampered cookie. */
export async function currentAccount(event: H3Event): Promise<PublicAccount | null> {
  const raw = getCookie(event, COOKIE)
  if (!raw) return null
  const [id, expiry, mac] = raw.split('.')
  if (!id || !expiry || !mac || Number(expiry) * 1000 < Date.now()) return null
  if (!equal(await sign(`${id}.${expiry}`), mac)) return null
  const account = (await loadAccounts()).find(a => a.id === id)
  return account ? toPublic(account) : null
}

export async function sessionInfo(event: H3Event): Promise<SessionInfo> {
  const account = await currentAccount(event)
  return { account, entitlements: entitlements(account?.plan ?? null) }
}

/** Throws 401 when signed out, 403 when the plan does not include `need`. */
export async function requireEntitlement(event: H3Event, need: keyof Entitlements): Promise<SessionInfo> {
  const info = await sessionInfo(event)
  if (!info.entitlements[need]) {
    throw createError({ statusCode: info.account ? 403 : 401, statusMessage: need === 'newsroom' ? 'Newsroom accounts only' : 'Subscribers only' })
  }
  return info
}
