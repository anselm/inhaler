// The model behind the digesting passes, in tiers. INHALE_TIERS is a comma list tried in order,
// each "provider:model": ollama (a model on this machine, free), openrouter, anthropic. The tier
// that answered is returned and recorded on everything it produced, so a reader of a fact can see
// what read it. A paid tier stops for the day at INHALE_BUDGET calls (400 by default). Calls to
// OpenRouter carry this service's name, so a key shared with other projects shows who spent.
import * as store from './store.mjs'

const TIERS = (process.env.INHALE_TIERS || 'ollama:gpt-oss:20b').split(',').map((s) => s.trim()).filter(Boolean)
const BUDGET = Number(process.env.INHALE_BUDGET || 400)
const post = async (url, headers, body, ms = 180000) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.json()
}
const providers = {
  async ollama(model, system, user, schema) {
    const j = await post(`${process.env.OLLAMA_URL || 'http://127.0.0.1:11434'}/api/chat`, {}, { model, stream: false, format: schema, think: 'low', options: { temperature: 0, num_ctx: 16384 },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }, 600000)
    return j.message?.content || ''
  },
  async openrouter(model, system, user, schema) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('no OPENROUTER_API_KEY')
    const j = await post('https://openrouter.ai/api/v1/chat/completions', { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://inhaler.exe.xyz', 'X-Title': 'inhaler' }, { model, temperature: 0, max_tokens: 8000,
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema } }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    return j.choices?.[0]?.message?.content || ''
  },
  async anthropic(model, system, user, schema) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('no ANTHROPIC_API_KEY')
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, { model, max_tokens: 4000, system,
      tools: [{ name: 'answer', description: 'Give the answer.', input_schema: schema }], tool_choice: { type: 'tool', name: 'answer' }, messages: [{ role: 'user', content: user }] })
    return JSON.stringify(j.content?.find((b) => b.type === 'tool_use')?.input ?? null)
  },
}

/// Ask for an answer of a given JSON shape. -> { json, tier }; throws when every tier fails.
export async function ask(system, user, schema) {
  const errors = []; let answered = false
  for (const tier of TIERS) {
    const [provider, ...rest] = tier.split(':'), model = rest.join(':')
    if (!providers[provider]) { errors.push(`${tier}: no such provider`); continue }
    if (provider !== 'ollama' && store.spentToday(tier) >= BUDGET) { errors.push(`${tier}: the day's budget of ${BUDGET} calls is spent`); continue }
    let text
    try { text = await providers[provider](model, system, user, schema) } catch (e) { errors.push(`${tier}: ${e.message}`); continue }
    store.spent(tier)
    // a model sometimes wraps its JSON in a code fence or a sentence: the outermost braces are what is read
    const body = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    try { return { json: JSON.parse(body), tier } } catch { errors.push(`${tier}: the answer was not JSON (it began ${JSON.stringify(text.slice(0, 80))}, ${text.length} characters)`); answered = true }
  }
  // "unavailable" means no model could be asked (no key, no credit, not running): the caller leaves
  // its work for later. It is different from a model that answered badly, which is the item's failure.
  throw Object.assign(new Error(errors.join('; ')), { unavailable: !answered })
}
