// The match discussion. Subscribers and the newsroom only (signed out 401, free 403); hidden comments
// only for the newsroom.
export default defineEventHandler(async (event) => {
  const me = await commenter(event)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return discussionFor(await loadThread(await routeMatchKey(event)), me.id, me.newsroom)
})
