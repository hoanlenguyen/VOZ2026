<script setup lang="ts">
// Sign-in for the three demo accounts (data/accounts/accounts.json). After signing in, the reader
// goes back to ?redirect= (same-site paths only).
definePageMeta({ layout: 'news' })
const { t } = useI18n()
useHead({ title: () => t('login.pageTitle') })

const route = useRoute()
const { login } = useAccount()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')

const DEMO = [
  { email: 'subscription@demo.com', plan: 'subscriber' },
  { email: 'free@demo.com', plan: 'free' },
  { email: 'newsroom@demo.com', plan: 'newsroom' },
] as const

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await login(email.value, password.value)
    await navigateTo(safeRedirect(route.query.redirect))
  }
  catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    error.value = t(status === 401 ? 'login.error' : 'login.failed')
  }
  finally {
    busy.value = false
  }
}
function useDemo(address: string) {
  email.value = address
  password.value = 'demo'
  submit()
}
</script>

<template>
  <main id="main" class="wrap">
    <h1 class="title">{{ t('login.title') }}</h1>
    <p class="lead">{{ t('login.lead') }}</p>

    <form class="form" novalidate @submit.prevent="submit">
      <label for="email">{{ t('login.email') }}</label>
      <input id="email" v-model="email" type="email" autocomplete="username" required>
      <label for="password">{{ t('login.password') }}</label>
      <input id="password" v-model="password" type="password" autocomplete="current-password" required>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button type="submit" class="submit" :disabled="busy || !email || !password">{{ busy ? t('login.busy') : t('login.submit') }}</button>
    </form>

    <section class="demo" aria-labelledby="demo-title">
      <h2 id="demo-title" class="demo-title">{{ t('login.demoTitle') }}</h2>
      <p class="hint">{{ t('login.demoHint') }}</p>
      <ul class="demo-list">
        <li v-for="d in DEMO" :key="d.email">
          <button type="button" class="demo-btn" :disabled="busy" @click="useDemo(d.email)">
            <span class="demo-plan" :class="`demo-plan--${d.plan}`">{{ t(`plan.${d.plan}`) }}</span>
            <span class="demo-email">{{ d.email }}</span>
            <span class="demo-text">{{ t(`login.demo.${d.plan}`) }}</span>
          </button>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(440px + 32px); margin: 0 auto; padding: 32px 16px 0; }
.title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.lead { margin: 8px 0 24px; color: var(--summary); }
.form { display: flex; flex-direction: column; gap: 6px; }
.form label { margin-top: 10px; font-size: 14px; font-weight: 600; color: var(--headline); }
.form input {
  min-height: 48px; padding: 0 14px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline);
}
.form input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.error { margin: 10px 0 0; color: var(--loss); font-weight: 600; font-size: 14px; }
.submit {
  margin-top: 18px; min-height: 48px; border: 0; border-radius: 999px; background: var(--accent);
  color: var(--on-accent); font-weight: 700; font-size: 15px;
}
.submit:disabled { opacity: 0.55; cursor: not-allowed; }
.submit:focus-visible, .demo-btn:focus-visible { outline: 2px solid var(--headline); outline-offset: 2px; }
.demo { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line-strong); }
.demo-title { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.hint { margin: 6px 0 14px; font-size: 14px; color: var(--summary); }
.demo-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.demo-btn {
  width: 100%; padding: 12px 14px; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: center;
  border: 1px solid var(--line-strong); border-radius: 4px; background: var(--bg); text-align: left;
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}
.demo-btn:hover { border-color: var(--border-control); background: var(--surface); }
.demo-plan {
  grid-row: span 2; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; background: var(--surface-2); color: var(--headline);
}
.demo-plan--subscriber { background: var(--accent); color: var(--on-accent); }
.demo-plan--newsroom { background: var(--board); color: var(--board-text); }
.demo-email { font-weight: 700; color: var(--headline); font-size: 14px; }
.demo-text { font-size: 13px; color: var(--summary); }
</style>
