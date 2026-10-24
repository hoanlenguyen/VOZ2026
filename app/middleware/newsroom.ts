// The newsroom dashboard: newsroom accounts only (the API checks again on the server).
export default defineNuxtRouteMiddleware((to) => {
  const { account, can } = useAccount()
  if (!account.value) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  if (!can.value.newsroom) return navigateTo('/account')
})
