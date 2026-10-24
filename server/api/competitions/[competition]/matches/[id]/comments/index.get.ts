// The match discussion: subscribers and the newsroom get it all (hidden comments only for the
// newsroom); free and signed-out readers a preview of the newest top-level comments.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const { account, entitlements } = await sessionInfo(event)
  const thread = await loadThread(await routeMatchKey(event))
  if (!account || !entitlements.premium) return discussionPreview(thread)
  return discussionFor(thread, account.id, entitlements.newsroom)
})
