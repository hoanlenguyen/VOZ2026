// The reader's favourites and what they can choose from. Signed-out readers get `preferences: null`.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const { account } = await sessionInfo(event)
  const options = await preferenceOptions(requestLang(event))
  return { preferences: account ? await loadPreferences(account) : null, options }
})
