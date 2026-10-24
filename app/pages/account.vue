<script setup lang="ts">
// The signed-in reader's plan: what it includes, and for newsroom accounts the way to the dashboard.
definePageMeta({ layout: 'news', middleware: 'auth' })
const { t } = useI18n()
const { account } = useAccount()
const { lang } = useFormat()
useHead({ title: () => t('account.pageTitle') })
const date = (iso: string) => new Date(iso).toLocaleDateString(lang.value === 'fi' ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const price = (n: number) => n.toLocaleString(lang.value === 'fi' ? 'fi-FI' : 'en-GB', { minimumFractionDigits: 2 })
</script>

<template>
  <main v-if="account" id="main" class="wrap">
    <h1 class="title">{{ t('account.title') }}</h1>
    <p class="who"><strong>{{ account.name }}</strong> · {{ account.email }}</p>

    <section class="card" :class="`card--${account.plan}`" aria-labelledby="plan-title">
      <p class="eyebrow-l">{{ t('account.plan') }}</p>
      <h2 id="plan-title" class="plan">{{ t(`plan.${account.plan}`) }}</h2>
      <template v-if="account.plan === 'subscriber' && account.subscription">
        <p class="perks">{{ t('account.subscriber.perks') }}</p>
        <ul class="facts">
          <li>{{ t('account.subscriber.since', { date: date(account.subscription.since) }) }}</li>
          <li>{{ t('account.subscriber.renews', { date: date(account.subscription.renewsOn) }) }}</li>
          <li class="num">{{ t('account.subscriber.price', { price: price(account.subscription.priceEurPerMonth) }) }}</li>
        </ul>
      </template>
      <template v-else-if="account.plan === 'free'">
        <p class="perks">{{ t('account.free.perks') }}</p>
        <p class="note">{{ t('account.free.upgradeDemo') }}</p>
      </template>
      <template v-else-if="account.newsroom">
        <p class="perks">{{ t('account.newsroom.perks') }}</p>
        <p class="facts">{{ t('account.newsroom.role', { role: account.newsroom.role, desk: account.newsroom.desk }) }}</p>
        <NuxtLink to="/newsroom" class="btn">{{ t('account.newsroom.open') }}</NuxtLink>
      </template>
    </section>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(640px + 32px); margin: 0 auto; padding: 32px 16px 0; }
.title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.who { margin: 8px 0 24px; color: var(--summary); }
.who strong { color: var(--headline); }
.card { padding: 24px; border: 1px solid var(--line-strong); border-top: 3px solid var(--surface-2); border-radius: 4px; }
.card--subscriber { border-top-color: var(--accent); }
.card--newsroom { border-top-color: var(--board); }
.eyebrow-l { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.plan { margin: 4px 0 10px; font-size: 26px; font-weight: 700; color: var(--headline); }
.perks { margin: 0 0 12px; color: var(--headline); line-height: 1.5; }
.facts { margin: 0; padding-left: 18px; color: var(--summary); line-height: 1.8; }
p.facts { padding: 0; }
.note { margin: 0; padding: 12px 14px; border-radius: 4px; background: var(--surface); color: var(--summary); font-size: 14px; }
.btn {
  margin-top: 16px; min-height: 44px; padding: 0 20px; border-radius: 999px; display: inline-flex; align-items: center;
  background: var(--board); color: var(--board-text); font-weight: 700; font-size: 14px; text-decoration: none;
}
.btn:hover { color: var(--board-text); filter: brightness(1.2); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
