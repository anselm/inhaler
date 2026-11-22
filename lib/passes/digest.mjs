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

const CUT = 6000
const KINDS = ['event', 'decision', 'proposal', 'plan', 'hazard', 'incident', 'measurement', 'opinion', 'other']
const SCHEMA = { type: 'object', additionalProperties: false, required: ['relevant', 'summary', 'topics', 'facts'], properties: {
  relevant: { type: 'boolean' }, summary: { type: 'string' }, topics: { type: 'array', items: { type: 'string' } },
  facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'claim', 'when', 'where', 'who', 'quantity', 'quote'], properties: {
    kind: { type: 'string', enum: KINDS }, claim: { type: 'string' }, when: { type: ['string', 'null'] }, where: { type: ['string', 'null'] },
    who: { type: 'array', items: { type: 'string' } }, quantity: { type: ['string', 'null'] }, quote: { type: ['string', 'null'] } } } } } }

const system = (beat) => `You read public news, notices and posts for a record of what is happening in one place: ${beat.name}. ${beat.about || ''}

For the item you are given, answer in JSON:
- relevant: true only if the item concerns ${beat.name} itself: something happening there, decided about it, or affecting the people or the ground there. A regional item counts when it names ${beat.name} or plainly covers it (a weather warning for its coast, a ferry or road that serves it). An item that only mentions the name in passing is not relevant.
- summary: one plain sentence saying what the item reports. No opinion of your own.
- topics: one to four short lower-case subjects, such as "flooding", "housing", "ferry", "budget", "wildfire", "traffic", "harbor".
- facts: every separate thing the item states as having happened, been decided, been proposed, been measured or being planned, that concerns ${beat.name}. Empty when not relevant. For each:
  - kind: one of ${KINDS.join(', ')}. Use "opinion" for what someone argues or feels, and say who.
  - claim: one sentence that stands on its own, with names written out, saying what the source says. Do not add anything the text does not say.
  - when: the date it happened or will happen, as YYYY-MM-DD, worked out from the item's own date when the text says "Tuesday" or "next week"; null when the text gives none.
  - where: the place as the text names it, as specific as the text is (a street, a harbor, a building, a neighbourhood); null when it gives none.
  - who: organisations, agencies and holders of public office named as acting. Do not name private individuals: write "a resident", "a boat owner".
  - quantity: the number that matters with its unit ("$160 million", "724 homes", "20 to 30 feet"); null when none.
  - quote: the few words of the text, copied exactly, that the claim rests on (at most 200 characters).`

export async function digestPass(beat, { limit = 50, log = console.log } = {}) {
  const todo = store.itemsToDigest(beat.id, limit); let done = 0, relevant = 0, facts = 0, failed = 0
  for (const it of todo) {
    const cut = it.text.length > CUT, text = it.text.slice(0, CUT)
    const user = `Source: ${it.author || 'unknown'}\nItem's date: ${it.published ? new Date(it.published * 1000).toISOString().slice(0, 10) : 'not given'}\n${it.title ? `Title: ${it.title}\n` : ''}\n${text}${cut ? '\n[the text was cut here]' : ''}`
    try {
      const { json, tier } = await ask(system(beat), user, SCHEMA)
      const flat = it.text.replace(/\s+/g, ' ')
      const kept = (json.relevant ? json.facts : []).filter((f) => f.claim?.trim()).map((f) => {
        const quote = f.quote && flat.includes(f.quote.replace(/\s+/g, ' ').trim()) ? f.quote.trim() : null     // words not found in the text are not kept as its words
        const at = f.when && /^\d{4}-\d{2}-\d{2}/.test(f.when) && Number.isFinite(Date.parse(f.when.slice(0, 10))) ? Date.parse(f.when.slice(0, 10)) / 1000 : null
        return { kind: KINDS.includes(f.kind) ? f.kind : 'other', claim: f.claim.trim(), when_text: f.when, at, where_text: f.where?.trim() || null, who: f.who || [], quantity: f.quantity, quote }
      })
      store.digested(it.id, { state: 'done', tier: tier + (cut ? ` (text cut at ${CUT} characters)` : ''), relevant: !!json.relevant, summary: json.summary, topics: (json.topics || []).slice(0, 4).map((t) => String(t).toLowerCase()), facts: kept })
      done++; if (json.relevant) relevant++; facts += kept.length
      log(`digest   ${json.relevant ? '+' : '·'} ${(it.title || it.text).slice(0, 70).replace(/\s+/g, ' ')} (${kept.length} facts, ${tier})`)
    } catch (e) {
      if (e.unavailable) { log(`digest   stopped: no model could be asked (${String(e.message).slice(0, 160)}); ${todo.length - done - failed} items left as they were`); break }
      failed++; store.digested(it.id, { state: 'failed', summary: String(e.message).slice(0, 300) }); log(`digest   FAILED ${it.id}: ${String(e.message).slice(0, 140)}`) }
  }
  return { read: done, relevant, facts, failed, left: store.counts(beat.id).undigested }
}
