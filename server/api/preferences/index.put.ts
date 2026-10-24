// Save the reader's favourites: { teams, leagues, players } (unknown choices are dropped).
// Subscribers only: free accounts may choose on /my-teams but are asked to subscribe to save.
export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'premium')
  const options = await preferenceOptions(requestLang(event))
  const prefs = cleanPreferences(await readBody(event), options)
  await savePreferences(account!.id, prefs)
  return { preferences: prefs }
})
