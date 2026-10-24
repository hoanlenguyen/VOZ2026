// Hide or show a comment for readers: { hidden }. Newsroom only.
export default defineEventHandler(async (event) => {
  const me = await commenter(event)
  if (!me.newsroom) throw createError({ statusCode: 403, statusMessage: 'Newsroom only' })
  const matchKey = await routeMatchKey(event)
  const thread = await loadThread(matchKey)
  findComment(thread, getRouterParam(event, 'commentId') ?? '').hidden = (await readBody<{ hidden?: unknown }>(event))?.hidden === true
  await saveThread(matchKey, thread)
  return discussionFor(thread, me.id, me.newsroom)
})
