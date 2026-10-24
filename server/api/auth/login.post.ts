export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown, password?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  const account = await verifyLogin(email, password)
  if (!account) throw createError({ statusCode: 401, statusMessage: 'Wrong email or password' })
  await startSession(event, account)
  return { account, entitlements: entitlements(account.plan) }
})
