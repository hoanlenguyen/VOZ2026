// Run explicitly before deployment (or by CI). Never print credentials or provider response bodies.
const queues = ['voz-news-dead', 'voz-news']
if (process.argv.includes('--check')) {
  process.stdout.write(`Required Cloudflare queues: ${queues.join(', ')}\nD1 is provisioned automatically from wrangler.jsonc.\n`)
}
else {
  const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !account || !/^[a-f0-9]{32}$/i.test(account)) throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to provision news queues.')
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/queues`
  const names = new Set<string>()
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`${endpoint}?page=${page}&per_page=100`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Cannot list Cloudflare queues (HTTP ${response.status}). Check Queue Edit permissions.`)
    const body = await response.json() as { success: boolean, result?: { queue_name: string }[], result_info?: { total_pages?: number } }
    if (!body.success) throw new Error('Cloudflare queue listing was unsuccessful.')
    for (const queue of body.result ?? []) names.add(queue.queue_name)
    if (page >= (body.result_info?.total_pages ?? 1)) break
    if (page === 20) throw new Error('Queue inventory exceeds the provisioning bound.')
  }
  for (const queue_name of queues) {
    if (names.has(queue_name)) { process.stdout.write(`Queue ready: ${queue_name}\n`); continue }
    const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ queue_name }), signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`Cannot create ${queue_name} (HTTP ${response.status}).`)
    const body = await response.json() as { success: boolean }
    if (!body.success) throw new Error(`Cloudflare did not create ${queue_name}.`)
    process.stdout.write(`Created queue: ${queue_name}\n`)
  }
}
