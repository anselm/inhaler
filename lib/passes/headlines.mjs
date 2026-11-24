// Pass 5, headlines: a fact's claim is a full sentence, good to read and too long for a map or a list.
// This pass writes a headline of a few words for every fact that has none: those read before the
// digest asked for one, and those read by a helper that gave none. Many facts go in one question,
// so a beat's backlog costs a handful of calls. A headline is a shortening of the claim and of
// nothing else: the model is shown only the claim, and an answer that is long or empty is dropped
// and asked for again next round.
import { ask } from '../llm.mjs'
import * as store from '../store.mjs'
import { cleanHeadline } from './digest.mjs'

const SCHEMA = { type: 'object', additionalProperties: false, required: ['headlines'], properties: { headlines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'headline'], properties: { id: { type: 'string' }, headline: { type: 'string' } } } } } }
const SYSTEM = `You are given statements drawn from local news, one per line, each with an id. For each, write a news headline of four to nine words that says the same thing and is complete in itself: plain, present tense, naming the place or body when there is room, no full stop. Do not add anything the statement does not say, and do not make it more certain than it is ("reported", "proposed" and "planned" stay). Answer in JSON: { "headlines": [{ "id": "...", "headline": "..." }] } with one entry per line given.`

export async function headlinesPass(beat, { batch = 25, rounds = 4, log = console.log } = {}) {
  let written = 0, asked = 0
  for (let r = 0; r < rounds; r++) {
    const todo = store.factsToHead(beat.id, batch); if (!todo.length) break
    const short = new Map(todo.map((f, i) => [`h${i + 1}`, f]))
    let json, tier
    try { ({ json, tier } = await ask(SYSTEM, [...short].map(([k, f]) => `${k} ${f.claim}`).join('\n'), SCHEMA)) } catch (e) { log(`headline stopped: ${String(e.message).slice(0, 160)}`); break }
    asked += todo.length; let got = 0
    for (const h of json.headlines || []) { const f = short.get(h.id), t = cleanHeadline(h.headline); if (f && t) { store.headed(f.id, t); got++ } }
    written += got; log(`headline ${got} of ${todo.length} written (${tier})`)
    if (!got) break                                   // nothing usable came back: do not ask the same question again this round
  }
  return { written, asked, left: store.factsToHead(beat.id, 100000).length }
}
