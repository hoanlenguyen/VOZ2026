// Like or unlike the match story: { liked }. Subscribers and the newsroom; one like per account.
export default defineEventHandler(async (event) => {
  const me = await commenter(event)
  const matchKey = await routeMatchKey(event)
  const thread = await loadThread(matchKey)
  thread.storyLikedBy = setLike(thread.storyLikedBy, me.id, (await readBody<{ liked?: unknown }>(event))?.liked === true)
  await saveThread(matchKey, thread)
  return discussionFor(thread, me.id, me.newsroom)
})
