// Loads the signed-in account once per page load (on the server it forwards the session cookie);
// the client reuses the state from the payload.
import type { SessionInfo } from '#shared/types/account'

export default defineNuxtPlugin(async () => {
  const session = useState<SessionInfo | null>('session', () => null)
  if (!session.value) session.value = await useRequestFetch()<SessionInfo>('/api/auth/me').catch(() => null)
})
