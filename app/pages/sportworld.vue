<script setup lang="ts">
// SportWorld API docs: a Swagger-style page for the mock sports server (/sportworld/api, open, no
// key). Each operation expands to its parameters, "Execute" calls it and shows the request URL,
// status and JSON response. "Simulate 1–2 new matches" (POST /generate) is open by default.
import { COMPETITIONS, competitionName } from '#shared/utils/competitions'

definePageMeta({ layout: 'news' })
const { t, locale } = useI18n()
useHead({ title: () => t('sportworld.pageTitle') })

const BASE = '/sportworld/api'
const { data: info } = await useFetch<{ competitions: Array<{ id: string }> }>(BASE)
const lang = computed(() => (locale.value === 'fi' ? 'fi' : 'en'))
const competitions = computed(() => (info.value?.competitions ?? []).map((c) => {
  const def = COMPETITIONS.find(x => x.id === c.id)
  return { value: c.id, label: def ? competitionName(def, lang.value) : c.id }
}))

type Method = 'GET' | 'POST' | 'DELETE'
interface Param { name: string, in: 'path' | 'query' | 'body', type: 'string' | 'integer', required?: boolean, options?: 'competitions' | 'count' }
interface Op { id: 'generate' | 'list' | 'one' | 'remove' | 'info', method: Method, path: string, params: Param[], open?: boolean }
const OPS: Op[] = [
  { id: 'generate', method: 'POST', path: '/generate', open: true, params: [
    { name: 'competition', in: 'body', type: 'string', options: 'competitions' },
    { name: 'count', in: 'body', type: 'integer', options: 'count' },
  ] },
  { id: 'list', method: 'GET', path: '/matches', params: [
    { name: 'competition', in: 'query', type: 'string', options: 'competitions' },
    { name: 'since', in: 'query', type: 'string' },
    { name: 'limit', in: 'query', type: 'integer' },
  ] },
  { id: 'one', method: 'GET', path: '/matches/{id}', params: [{ name: 'id', in: 'path', type: 'string', required: true }] },
  { id: 'remove', method: 'DELETE', path: '/matches/{id}', params: [{ name: 'id', in: 'path', type: 'string', required: true }] },
  { id: 'info', method: 'GET', path: '', params: [] },
]

// Form values and the last result per operation.
const values = reactive<Record<string, Record<string, string>>>(Object.fromEntries(OPS.map(o => [o.id, {}])))
values.generate!.competition = 'premier-league'
const results = reactive<Record<string, { url: string, status: number, body: string } | null>>({})
const busy = ref<string | null>(null)

function request(op: Op) {
  const v = values[op.id]!
  let path = op.path
  const query = new URLSearchParams()
  const body: Record<string, string | number> = {}
  for (const p of op.params) {
    const val = (v[p.name] ?? '').trim()
    if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(val))
    else if (val && p.in === 'query') query.set(p.name, val)
    else if (val) body[p.name] = p.type === 'integer' ? Number(val) : val
  }
  const qs = query.toString()
  return { url: `${BASE}${path}${qs ? `?${qs}` : ''}`, body: op.method === 'POST' ? body : undefined }
}
const missing = (op: Op) => op.params.some(p => p.required && !(values[op.id]![p.name] ?? '').trim())

async function execute(op: Op) {
  const { url, body } = request(op)
  busy.value = op.id
  try {
    const res = await fetch(url, {
      method: op.method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let pretty = text
    try { pretty = JSON.stringify(JSON.parse(text), null, 2) }
    catch { /* not JSON: show as is */ }
    results[op.id] = { url, status: res.status, body: pretty }
    // Prefill the id fields with the newest match the server returned.
    const id = /"id": "(\d+)"/.exec(pretty)?.[1]
    if (id && (op.id === 'generate' || op.id === 'list')) for (const o of ['one', 'remove']) values[o]!.id ||= id
  }
  catch (err) {
    results[op.id] = { url, status: 0, body: String(err) }
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <main id="main" class="wrap">
    <header class="intro">
      <h1 class="title">{{ t('sportworld.title') }} <span class="version">v1</span></h1>
      <p class="badges">
        <span class="badge-sim">{{ t('sportworld.badge') }}</span>
        <span class="meta">{{ t('sportworld.base') }}: <code>{{ BASE }}</code> · {{ t('sportworld.noKey') }}</span>
      </p>
      <p class="lead">{{ t('sportworld.lead') }}</p>
    </header>

    <div class="ops">
      <details v-for="op in OPS" :key="op.id" class="op" :class="`op--${op.method.toLowerCase()}`" :open="op.open">
        <summary class="op-head">
          <span class="method">{{ op.method }}</span>
          <code class="path">{{ BASE }}{{ op.path }}</code>
          <span class="summary">{{ t(`sportworld.ops.${op.id}.summary`) }}</span>
        </summary>

        <div class="op-body">
          <p class="desc">{{ t(`sportworld.ops.${op.id}.description`) }}</p>
          <h3 class="label">{{ op.method === 'POST' ? t('sportworld.body') : t('sportworld.params') }}</h3>
          <p v-if="!op.params.length" class="meta">{{ t('sportworld.noParams') }}</p>
          <div v-for="p in op.params" :key="p.name" class="param">
            <label :for="`${op.id}-${p.name}`" class="param-name">
              <code>{{ p.name }}</code><span v-if="p.required" class="req">* {{ t('sportworld.required') }}</span>
              <span class="param-type">{{ p.type }} · {{ p.in }}</span>
            </label>
            <select v-if="p.options === 'competitions'" :id="`${op.id}-${p.name}`" v-model="values[op.id]![p.name]" class="input">
              <option v-if="op.method === 'GET'" :value="undefined">{{ t('sportworld.any') }}</option>
              <option v-for="c in competitions" :key="c.value" :value="c.value">{{ c.label }} ({{ c.value }})</option>
            </select>
            <select v-else-if="p.options === 'count'" :id="`${op.id}-${p.name}`" v-model="values[op.id]![p.name]" class="input">
              <option :value="undefined">{{ t('sportworld.random') }}</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
            <input
              v-else :id="`${op.id}-${p.name}`" v-model="values[op.id]![p.name]" class="input"
              :type="p.type === 'integer' ? 'number' : 'text'" :inputmode="p.type === 'integer' || p.name === 'id' ? 'numeric' : undefined"
              :placeholder="t(`sportworld.p.${p.name}`)" :aria-describedby="`${op.id}-${p.name}-hint`"
            >
            <span :id="`${op.id}-${p.name}-hint`" class="hint">{{ t(`sportworld.p.${p.name}`) }}</span>
          </div>

          <button type="button" class="execute" :disabled="!!busy || missing(op)" :aria-busy="busy === op.id" @click="execute(op)">
            {{ busy === op.id ? t('sportworld.executing') : t('sportworld.execute') }}
          </button>

          <div v-if="results[op.id]" class="result" aria-live="polite">
            <h3 class="label">{{ t('sportworld.requestUrl') }}</h3>
            <pre class="url"><code>{{ op.method }} {{ results[op.id]!.url }}</code></pre>
            <h3 class="label">
              {{ t('sportworld.response') }}
              <span class="status" :class="results[op.id]!.status >= 200 && results[op.id]!.status < 300 ? 'status--ok' : 'status--err'">{{ results[op.id]!.status }}</span>
            </h3>
            <pre class="json"><code>{{ results[op.id]!.body }}</code></pre>
          </div>
        </div>
      </details>
    </div>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(var(--page-max) + 2 * 16px); margin: 0 auto; padding: 32px 16px 0; }
@media (min-width: 768px) { .wrap { padding: 32px 30px 0; max-width: calc(var(--page-max) + 2 * 30px); } }
.title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.version {
  vertical-align: middle; padding: 2px 8px; border-radius: 999px; background: var(--headline); color: var(--bg);
  font-size: 12px; font-weight: 700;
}
.badges { margin: 10px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.badge-sim {
  padding: 2px 8px; border: 1px solid var(--link-hover); border-radius: 999px; font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--link-hover);
}
.meta { margin: 0; font-size: 13px; color: var(--meta); }
.lead { margin: 12px 0 0; max-width: 75ch; line-height: 1.5; color: var(--summary); }
code { font-size: 13px; overflow-wrap: anywhere; }

.ops { margin-top: 28px; display: flex; flex-direction: column; gap: 10px; }
/* Method colour = the operation's border and badge (Swagger convention); the method name is always written. */
.op { --op: var(--link-hover); border: 1px solid var(--op); border-radius: 4px; overflow: hidden; }
.op--get { --op: var(--link-hover); }
.op--post { --op: var(--win); }
.op--delete { --op: var(--loss); }
.op-head {
  min-height: 48px; padding: 8px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px;
  cursor: pointer; list-style: none; background: var(--surface);
}
.op-head::-webkit-details-marker { display: none; }
.op-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.method {
  min-width: 72px; padding: 4px 0; border-radius: 3px; background: var(--op); color: var(--board-text);
  font-size: 13px; font-weight: 700; text-align: center;
}
.path { font-weight: 700; color: var(--headline); }
.summary { font-size: 14px; color: var(--summary); }
.op-body { padding: 4px 16px 16px; border-top: 1px solid var(--op); }
.desc { margin: 12px 0 0; font-size: 14px; color: var(--summary); }
.label { margin: 16px 0 8px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--headline); }
.param { display: grid; grid-template-columns: 1fr; gap: 4px; padding: 8px 0; border-bottom: 1px solid var(--line); }
@media (min-width: 640px) { .param { grid-template-columns: 220px minmax(0, 320px) 1fr; align-items: center; gap: 12px; } }
.param-name { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; color: var(--headline); }
.req { font-size: 12px; color: var(--loss); }
.param-type { width: 100%; font-size: 12px; color: var(--meta); }
.input {
  min-height: 44px; width: 100%; padding: 0 10px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 16px;
}
.input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.hint { font-size: 12px; color: var(--meta); }
.execute {
  margin-top: 14px; min-height: 44px; padding: 0 22px; border: 0; border-radius: 4px;
  background: var(--accent); color: var(--on-accent); font-size: 14px; font-weight: 700; cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.execute:hover:not(:disabled) { opacity: 0.85; }
.execute:disabled { opacity: 0.5; cursor: default; }
.execute:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 2px; }
.status { padding: 1px 8px; border-radius: 999px; color: var(--board-text); font-size: 12px; }
.status--ok { background: var(--win); }
.status--err { background: var(--loss); }
.url, .json {
  margin: 0; padding: 10px 12px; border-radius: 4px; background: var(--board); color: var(--board-text);
  font-size: 13px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere;
}
.json { max-height: 420px; overflow: auto; }
</style>
