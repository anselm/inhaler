// Pass 3, locate: put facts, and then items, on the map. A fact is placed from the place its source named. The name is looked up
// in the beat's gazetteer: the whole name, else the longest gazetteer name found inside it. A
// fact whose place is only the beat itself, or that names no place, gets no point: it is marked
// as being about the beat as a whole. Nothing is scattered or guessed, and how each fact was
// placed is kept beside it (name, part, beat, none).
import { norm, buildGazetteer } from '../gazetteer.mjs'
import * as store from '../store.mjs'

const tried = new Map()
export async function locatePass(beat, { limit = 2000, log = console.log } = {}) {
  let places = store.places(beat.id)
  if (!places.length && beat.bbox) {
    // No gazetteer yet. If OpenStreetMap does not answer, nothing is placed and nothing is marked: the rows wait,
    // and the build is tried again in an hour, not every round.
    if (Date.now() - (tried.get(beat.id) || 0) < 3600e3) return { waiting: 'for a gazetteer; OpenStreetMap did not answer earlier' }
    tried.set(beat.id, Date.now())
    try { log(`locate   building the gazetteer for ${beat.name} from OpenStreetMap`); log(`locate   ${await buildGazetteer(beat, { log })} names`) }
    catch (e) { log(`locate   no gazetteer for ${beat.name}: ${e.message}`); return { waiting: `for a gazetteer (${e.message})` } }
    places = store.places(beat.id)
  }
  const by = new Map(places.map((p) => [p.norm, p])), long = places.filter((p) => p.norm.includes(' ') || p.norm.length >= 7).sort((a, b) => b.norm.length - a.norm.length)
  // a beat that is a subject and has no box (world news) has no gazetteer: its items keep only a point their source gave
  const self = norm(beat.name); const tally = { name: 0, part: 0, beat: 0, none: 0 }
  for (const f of store.factsToLocate(beat.id, limit)) {
    const w = norm(f.where_text); let hit = null, how = 'none'
    if (w) {
      if (by.has(w) && w !== self) { hit = by.get(w); how = 'name' }
      else { hit = long.find((p) => p.norm !== self && (` ${w} `).includes(` ${p.norm} `)) || null; how = hit ? 'part' : w.includes(self) ? 'beat' : 'none' }
    } else how = 'beat'
    tally[how]++
    store.located(f.id, hit ? { lat: hit.lat, lon: hit.lon, place: hit.name, how } : { place: how === 'beat' ? beat.name : null, how })
  }
  // then the items themselves, so a program that wants raw items (a photograph, a post, an article) gets a point
  // without a model: the source's own point, else a point one of its facts was given, else its place or title
  // looked up the same way. Recorded as source, fact, name, part or none.
  const items = { source: 0, fact: 0, name: 0, part: 0, none: 0 }
  for (const it of store.itemsToLocate(beat.id, limit)) {
    let r
    if (it.lat != null) r = { how: 'source' }
    else { const f = store.bestFactPoint(it.id)
      if (f) r = { lat: f.lat, lon: f.lon, place: f.place, how: 'fact' }
      else { const w = norm(it.place || ''), t = ` ${norm(it.title || '')} `
        const hit = (w && by.get(w) !== undefined && w !== self && by.get(w)) || long.find((p) => p.norm !== self && ((w && (` ${w} `).includes(` ${p.norm} `)) || t.includes(` ${p.norm} `)))
        r = hit ? { lat: hit.lat, lon: hit.lon, place: hit.name, how: w && by.has(w) ? 'name' : 'part' } : { how: 'none' } } }
    items[r.how]++; store.itemLocated(it.id, r)
  }
  return { facts: tally, items }
}
