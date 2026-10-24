// The signed-in demo account and what it unlocks. Signing in or out refreshes the page's data,
// because the server leaves premium parts out for free and signed-out readers.
import type { Entitlements, SessionInfo } from '#shared/types/account'

const SIGNED_OUT: Entitlements = { premium: false, ads: true, newsroom: false }

export function useAccount() {
  const session = useState<SessionInfo | null>('session', () => null)
  const account = computed(() => session.value?.account ?? null)
  const can = computed(() => session.value?.entitlements ?? SIGNED_OUT)

  async function login(email: string, password: string) {
    session.value = await $fetch<SessionInfo>('/api/auth/login', { method: 'POST', body: { email, password } })
    await refreshNuxtData()
  }
  async function logout() {
    session.value = await $fetch<SessionInfo>('/api/auth/logout', { method: 'POST' })
    await refreshNuxtData()
  }
  return { account, can, login, logout }
}

/** Only same-site paths, so ?redirect= cannot send a reader to another site after signing in. */
export const safeRedirect = (to: unknown) => (typeof to === 'string' && to.startsWith('/') && !to.startsWith('//') ? to : '/')
