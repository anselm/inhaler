// Pass 3, locate: put a fact on the map from the place its source named. The name is looked up
// in the beat's gazetteer: the whole name, else the longest gazetteer name found inside it. A
// fact whose place is only the beat itself, or that names no place, gets no point: it is marked
// as being about the beat as a whole. Nothing is scattered or guessed, and how each fact was
// placed is kept beside it (name, part, beat, none).
import { norm, buildGazetteer } from '../gazetteer.mjs'
import * as store from '../store.mjs'

export async function locatePass(beat, { limit = 2000, log = console.log } = {}) {
  let places = store.places(beat.id)
  if (!places.length) { log(`locate   building the gazetteer for ${beat.name} from OpenStreetMap`); log(`locate   ${await buildGazetteer(beat, { log })} names`); places = store.places(beat.id) }
  const by = new Map(places.map((p) => [p.norm, p])), long = places.filter((p) => p.norm.includes(' ') || p.norm.length >= 7).sort((a, b) => b.norm.length - a.norm.length)
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
  return tally
}
