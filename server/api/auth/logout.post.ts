export default defineEventHandler((event) => {
  endSession(event)
  return { account: null, entitlements: entitlements(null) }
})
