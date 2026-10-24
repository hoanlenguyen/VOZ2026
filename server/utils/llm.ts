// Minimal OpenAI Responses API client (POST /v1/responses) using fetch, so it runs on Workers
// without an SDK. Only the fields the story agent uses are typed.

export interface FunctionTool {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
  strict: true
}

/** Items we send and receive in the input/output lists; other item types are passed through as-is. */
export type ResponseItem =
  | { role: 'user' | 'developer', content: string }
  | { type: 'function_call', call_id: string, name: string, arguments: string, [k: string]: unknown }
  | { type: 'function_call_output', call_id: string, output: string }
  | { type: string, [k: string]: unknown }

export interface ResponsesRequest {
  instructions: string
  input: ResponseItem[]
  tools: FunctionTool[]
  tool_choice?: 'auto' | 'required' | 'none'
  parallel_tool_calls?: boolean
  max_output_tokens?: number
}

export interface ResponsesResult {
  output: ResponseItem[]
  usage: { input_tokens: number, output_tokens: number }
}

export function llmConfig() {
  const c = useRuntimeConfig()
  // NUXT_OPENAI_MODEL may be a display name ("GPT-6 Luna"); the API needs the id ("gpt-6-luna").
  return { key: String(c.openaiApiKey || ''), model: modelId(String(c.openaiModel)), baseUrl: String(c.openaiBaseUrl), effort: String(c.storyReasoningEffort) }
}

export async function respond(req: ResponsesRequest): Promise<ResponsesResult> {
  const { key, model, baseUrl, effort } = llmConfig()
  if (!key) throw new Error('NUXT_OPENAI_API_KEY is not set')
  const body = JSON.stringify({ model, store: false, reasoning: { effort }, ...req })
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(45_000),
    })
    if (res.ok) return await res.json() as ResponsesResult
    // One retry for rate limits and server errors; the message never includes the key.
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      continue
    }
    const detail = await res.json().then((j: { error?: { message?: string } }) => j.error?.message ?? '', () => '')
    throw new Error(`OpenAI ${res.status}${detail ? `: ${detail}` : ''}`)
  }
}
