// Delete a comment (its replies too): its author or the newsroom.
export default defineEventHandler(async (event) => {
  const me = await commenter(event)
  const matchKey = await routeMatchKey(event)
  const thread = await loadThread(matchKey)
  const c = findComment(thread, getRouterParam(event, 'commentId') ?? '')
  if (c.author.id !== me.id && !me.newsroom) throw createError({ statusCode: 403, statusMessage: 'Not your comment' })
  removeComment(thread, c.id)
  await saveThread(matchKey, thread)
  return discussionFor(thread, me.id, me.newsroom)
})
