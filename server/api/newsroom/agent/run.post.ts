// "Run now": writes posts for the waiting SportWorld matches at once, whatever the interval.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  return runNewsroomAgent('manual')
})
