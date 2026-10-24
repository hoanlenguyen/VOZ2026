// Newsroom moderation: story ids an editor has hidden from the front page. Stored in "kvcache"
// (Workers KV in production, memory in dev) as one small list, so it survives across instances.

const KEY = 'newsroom:hidden-stories'

export async function hiddenStories(): Promise<Set<string>> {
  const list = await useStorage('kvcache').getItem<string[]>(KEY).catch(() => null)
  return new Set(Array.isArray(list) ? list : [])
}

export async function setStoryHidden(id: string, hidden: boolean): Promise<Set<string>> {
  const set = await hiddenStories()
  if (hidden) set.add(id)
  else set.delete(id)
  await useStorage('kvcache').setItem(KEY, [...set])
  return set
}
