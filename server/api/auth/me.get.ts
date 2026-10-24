// The signed-in account and its entitlements; never cached (it depends on the cookie).
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return sessionInfo(event)
})
