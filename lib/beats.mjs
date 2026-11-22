// A beat is what the inhaler follows: a place (a name, a box, a centre), a sentence saying what
// counts as being about it, and the sources read for it. One JSON file per beat in beats/.
// Loading a beat writes its sources into the store, where their health and schedule are kept.
import fs from 'node:fs'
import path from 'node:path'
import * as store from './store.mjs'
const DIR = process.env.INHALE_BEATS || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'beats')
export const beatIds = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
export function loadBeat(id) {
  const beat = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8'))
  if (beat.id !== id) throw new Error(`beats/${id}.json says its id is ${beat.id}`)
  store.keepSources(id, beat.sources.map((s) => store.upsertSource(id, s)))
  return beat
}
