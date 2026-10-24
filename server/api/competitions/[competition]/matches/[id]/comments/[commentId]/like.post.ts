// Like or unlike a comment: { liked }. Subscribers and the newsroom; one like per account.
export default defineEventHandler(async (event) => {
  const me = await commenter(event)
  const matchKey = await routeMatchKey(event)
  const thread = await loadThread(matchKey)
  const c = findComment(thread, getRouterParam(event, 'commentId') ?? '')
  c.likedBy = setLike(c.likedBy, me.id, (await readBody<{ liked?: unknown }>(event))?.liked === true)
  await saveThread(matchKey, thread)
  return discussionFor(thread, me.id, me.newsroom)
})
