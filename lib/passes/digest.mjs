// Pass 2, digest: read one item and say whether it concerns the beat, what it is about in a
// sentence, and which facts it states. A fact is one claim that stands on its own, with what the
// text gives of when, where, who and how much, and the words of the text it rests on. Each item
// is read once (its state in the store says so) and again only if its text changes.
//
// What is checked without the model: the supporting words must be found in the text, or they are
// dropped; a date must parse. What is not checked: whether the claim is true. A fact here means
// "this source said this", never more.
import { ask } from '../llm.mjs'
import * as store from '../store.mjs'
import { notify } from '../notify.mjs'

const CUT = 6000
const KINDS = ['event', 'decision', 'proposal', 'plan', 'hazard', 'incident', 'measurement', 'opinion', 'other']
const SCHEMA = { type: 'object', additionalProperties: false, required: ['relevant', 'summary', 'topics', 'facts'], properties: {
  relevant: { type: 'boolean' }, summary: { type: 'string' }, topics: { type: 'array', items: { type: 'string' } },
  facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'headline', 'claim', 'when', 'where', 'who', 'quantity', 'quote'], properties: {
    kind: { type: 'string', enum: KINDS }, headline: { type: 'string' }, claim: { type: 'string' }, when: { type: ['string', 'null'] }, where: { type: ['string', 'null'] },
    who: { type: 'array', items: { type: 'string' } }, quantity: { type: ['string', 'null'] }, quote: { type: ['string', 'null'] } } } } } }

const system = (beat) => `You read public news, notices and posts for a record of what is happening in one place: ${beat.name}. ${beat.about || ''}

For the item you are given, answer in JSON:
- relevant: true only if the item concerns ${beat.name} itself: something happening there, decided about it, or affecting the people or the ground there. A regional item counts when it names ${beat.name} or plainly covers it (a weather warning for its coast, a ferry or road that serves it). An item that only mentions the name in passing is not relevant.
- summary: one plain sentence saying what the item reports. No opinion of your own.
- topics: one to four short lower-case subjects, such as "flooding", "housing", "ferry", "budget", "wildfire", "traffic", "harbor".
- facts: every separate thing the item states as having happened, been decided, been proposed, been measured or being planned, that concerns ${beat.name}. Empty when not relevant. For each:
  - kind: one of ${KINDS.join(', ')}. Use "opinion" for what someone argues or feels, and say who.
  - headline: the claim as a news headline of four to nine words, complete in itself, plain, present tense, naming the place or body when there is room ("Bridgeway floods at Gate 5 Road on king tide"). No full stop, no opinion, nothing the text does not say.
  - claim: one sentence that stands on its own, with names written out, saying what the source says. Do not add anything the text does not say.
  - when: the date it happened or will happen, as YYYY-MM-DD, worked out from the item's own date when the text says "Tuesday" or "next week"; null when the text gives none.
  - where: the place as the text names it, as specific as the text is (a street, a harbor, a building, a neighbourhood); null when it gives none.
  - who: organisations, agencies and holders of public office named as acting. Do not name private individuals: write "a resident", "a boat owner".
  - quantity: the number that matters with its unit ("$160 million", "724 homes", "20 to 30 feet"); null when none.
  - quote: the few words of the text, copied exactly, that the claim rests on (at most 200 characters).`

/// A headline is kept only if it is short and whole; otherwise the fact has none and the headlines pass writes one.
export const cleanHeadline = (h) => { const t = typeof h === 'string' ? h.replace(/\s+/g, ' ').replace(/[.…]+$/, '').trim() : ''; return t && t.length <= 90 && t.split(' ').length >= 2 ? t : null }

/// Ask the model about one item. -> { json, tier, cut }
export async function readItem(beat, it) {
  const cut = it.text.length > CUT, text = it.text.slice(0, CUT)
  const user = `Source: ${it.author || 'unknown'}\nItem's date: ${it.published ? new Date(it.published * 1000).toISOString().slice(0, 10) : 'not given'}\n${it.title ? `Title: ${it.title}\n` : ''}\n${text}${cut ? '\n[the text was cut here]' : ''}`
  return { ...(await ask(system(beat), user, SCHEMA)), cut }
}
/// Check a model's answer against the item it was about and keep it. The same checks whoever did
/// the reading, this machine or a helper: an answer is never stored as it arrived.
export function keepReading(it, json, tier, cut = it.text.length > CUT) {
  if (typeof json?.relevant !== 'boolean' || !Array.isArray(json.facts)) throw new Error('the answer has not the shape of a reading')
  const flat = it.text.replace(/\s+/g, ' ')
  const kept = (json.relevant ? json.facts : []).filter((f) => typeof f?.claim === 'string' && f.claim.trim()).slice(0, 40).map((f) => {
    const quote = typeof f.quote === 'string' && flat.includes(f.quote.replace(/\s+/g, ' ').trim()) ? f.quote.trim().slice(0, 300) : null     // words not found in the text are not kept as its words
    const at = typeof f.when === 'string' && /^\d{4}-\d{2}-\d{2}/.test(f.when) && Number.isFinite(Date.parse(f.when.slice(0, 10))) ? Date.parse(f.when.slice(0, 10)) / 1000 : null
    return { kind: KINDS.includes(f.kind) ? f.kind : 'other', headline: cleanHeadline(f.headline), claim: f.claim.trim().slice(0, 600), when_text: typeof f.when === 'string' ? f.when.slice(0, 40) : null, at, where_text: typeof f.where === 'string' ? f.where.trim().slice(0, 200) || null : null,
      who: Array.isArray(f.who) ? f.who.filter((w) => typeof w === 'string').slice(0, 8) : [], quantity: typeof f.quantity === 'string' ? f.quantity.slice(0, 80) : null, quote }
  })
  store.digested(it.id, { state: 'done', tier: String(tier).slice(0, 80) + (cut ? ` (text cut at ${CUT} characters)` : ''), relevant: json.relevant, summary: String(json.summary || '').slice(0, 500),
    topics: (Array.isArray(json.topics) ? json.topics : []).slice(0, 4).map((t) => String(t).toLowerCase().slice(0, 40)), facts: kept })
  return kept.length
}

export async function digestPass(beat, { limit = 50, heldFor = 0, log = console.log } = {}) {
  const todo = store.itemsToDigest(beat.id, limit, heldFor); let done = 0, relevant = 0, facts = 0, failed = 0
  for (const it of todo) {
    try {
      const { json, tier, cut } = await readItem(beat, it)
      const n = keepReading(it, json, tier, cut)
      done++; if (json.relevant) relevant++; facts += n
      log(`digest   ${json.relevant ? '+' : '·'} ${(it.title || it.text).slice(0, 70).replace(/\s+/g, ' ')} (${n} facts, ${tier})`)
    } catch (e) {
      if (e.unavailable) { notify('no model to read with', String(e.message).slice(0, 200)); log(`digest   stopped: no model could be asked (${String(e.message).slice(0, 160)}); ${todo.length - done - failed} items left as they were`); break }
      failed++; store.digested(it.id, { state: 'failed', summary: String(e.message).slice(0, 300) }); log(`digest   FAILED ${it.id}: ${String(e.message).slice(0, 140)}`)
    }
  }
  return { read: done, relevant, facts, failed, left: store.counts(beat.id).undigested }
}
