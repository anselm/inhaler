// Pass 4, issues: read the recent facts of a beat together and name what the place is dealing
// with. Each issue lists the facts it rests on by id, and an id the model made up is dropped, so
// every issue can be followed back to its sources. This is a reading, made again from scratch
// each time, and it is only as wide as the sources the beat follows.
import { ask } from '../llm.mjs'
import * as store from '../store.mjs'

const SCHEMA = { type: 'object', additionalProperties: false, required: ['issues'], properties: { issues: { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['title', 'summary', 'facts'], properties: { title: { type: 'string' }, summary: { type: 'string' }, facts: { type: 'array', items: { type: 'string' } } } } } } }

export async function issuesPass(beat, { days = 90, cap = 160, log = console.log } = {}) {
  const since = Math.floor(Date.now() / 1000) - days * 86400
  // only facts whose supporting words were found in their source: the first reading of Sausalito called a
  // ballot measure approved from a fact with no such words, when three other facts said it was defeated
  const facts = store.facts(beat.id, { since, limit: cap * 2 }).filter((f) => f.kind !== 'other' && f.quote).slice(0, cap)
  if (facts.length < 5) { log(`issues   only ${facts.length} facts in ${days} days; not enough to read`); return { issues: 0 } }
  const short = new Map(facts.map((f, i) => [`f${i + 1}`, f]))
  const lines = [...short].map(([k, f]) => `${k} [${f.kind}${f.at ? ', ' + new Date(f.at * 1000).toISOString().slice(0, 10) : ''}${f.place ? ', ' + f.place : ''}] ${f.claim}`).join('\n')
  const { json, tier } = await ask(`You are given facts drawn from public news, notices and posts about ${beat.name} over the last ${days} days, one per line, each with an id. Group them into the issues the place is dealing with: standing matters a resident or an official would recognise ("flooding on Gate 5 Road", "the housing plan"), not one-off events. Give between 3 and 12 issues. For each: a short plain title; a summary of two or three sentences saying what is at stake and where it stands, using only what the facts say; and the ids of the facts it rests on. A fact may be left out. Do not invent facts or ids. Facts can disagree, because some were written before an outcome and some after: where they do, go by the later ones and by the greater number, say in the summary that the sources differ, and never state an outcome that only one fact gives. Do not name private individuals.`, lines, SCHEMA)
  const list = (json.issues || []).map((x) => { const got = (x.facts || []).filter((k) => short.has(k)).map((k) => short.get(k)); const at = got.map((f) => f.at || f.published).filter(Boolean)
    return { title: x.title, summary: x.summary, facts: got.map((f) => f.id), first_at: at.length ? Math.min(...at) : null, last_at: at.length ? Math.max(...at) : null } }).filter((x) => x.facts.length)
  store.saveIssues(beat.id, list, tier)
  for (const x of list) log(`issues   ${x.title} (${x.facts.length} facts)`)
  return { issues: list.length, from: facts.length, tier }
}
