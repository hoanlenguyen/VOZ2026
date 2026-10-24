// Pages for signed-in readers: send others to the login page and back afterwards.
export default defineNuxtRouteMiddleware((to) => {
  if (!useAccount().account.value) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
