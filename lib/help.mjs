// Helping an inhaler from another machine. The inhaler collects; reading is the costly part, and
// any machine with a model and a key may do some of it: take a few unread items, read them with
// its own model, send the readings back. The inhaler checks each reading as it checks its own.
//
//   INHALE_HELP_KEY=<key> inhale help https://inhaler.exe.xyz [--every 300] [--n 5]
//
// A helper is never needed: an item nobody has read after the inhaler's waiting time is read by
// the inhaler itself. So a helper can come and go.
import { readItem } from './passes/digest.mjs'

export async function help(base, { every = 300, n = 5, once = false, log = console.log } = {}) {
  const key = process.env.INHALE_HELP_KEY; if (!key) throw new Error('INHALE_HELP_KEY is not set')
  const call = async (path, body) => { const r = await fetch(base.replace(/\/$/, '') + path, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${path}: ${r.status} ${(await r.text()).slice(0, 120)}`); return r.json() }
  for (;;) {
    let total = 0
    try {
      for (;;) {
        const { items, beats } = await call('/work/claim', { n }); if (!items.length) break
        for (const it of items) {
          try { const { json, tier, cut } = await readItem(beats[it.beat], it); const r = await call('/work/done', { id: it.id, json, tier, cut }); total++; log(`help     ${json.relevant ? '+' : '·'} ${(it.title || it.text).slice(0, 70).replace(/\s+/g, ' ')} (${r.facts} facts kept, ${tier})`) }
          catch (e) { log(`help     could not read ${it.id}: ${String(e.message).slice(0, 120)}`); if (e.unavailable) throw e }
        }
      }
    } catch (e) { log(`help     stopped this round: ${String(e.message).slice(0, 160)}`) }
    log(`help     ${total} read for ${base}`)
    if (once) return total
    await new Promise((r) => setTimeout(r, every * 1000))
  }
}
