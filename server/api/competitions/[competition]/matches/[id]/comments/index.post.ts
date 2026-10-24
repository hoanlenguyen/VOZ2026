// Post a comment or a reply: { text, parentId? }. Subscribers and the newsroom (newsroom badge).
export default defineEventHandler(async (event) => {
  const me = await commenter(event)
  const matchKey = await routeMatchKey(event)
  const thread = await loadThread(matchKey)
  addComment(thread, { id: me.id, name: me.name, role: me.role }, await readBody(event))
  await saveThread(matchKey, thread)
  return discussionFor(thread, me.id, me.newsroom)
})
