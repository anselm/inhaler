// Pass 3, locate: put facts, and then items, on the map, from names this service holds itself.
//
// A beat's names come from two places: the name server (GeoNames, lib/names.mjs), which is this
// service's own and covers a country once that country has loaded; and OpenStreetMap's local
// names for the beat's box (streets, harbours, buildings), fetched once when its servers answer.
// Local names win where both have one. The pass works with whatever has arrived; when more
// arrives, everything that found no place is looked for again.
//
// A fact is placed from the place its source named: the whole name, else the longest known name
// found inside it. A fact about the beat as a whole, or that names no place, gets no point.
// An item then gets every place it names: the points of its facts, and for an item no model
// read, every known name found in its title and text. Its own point is its source's, else the
// first of those. Nothing is scattered or guessed, and how each was placed is kept beside it.
import { norm, buildGazetteer } from '../gazetteer.mjs'
import { namesFor } from '../names.mjs'
import * as store from '../store.mjs'

const tried = new Map()
export async function locatePass(beat, { limit = 5000, log = console.log } = {}) {
  let local = store.places(beat.id)
  if (!local.length && beat.bbox && Date.now() - (tried.get(beat.id) || 0) > 3600e3) {
    // the local names are asked for again each hour until OpenStreetMap answers; the pass does not wait for them
    tried.set(beat.id, Date.now())
    try { log(`locate   asking OpenStreetMap for ${beat.name}'s local names`); log(`locate   ${await buildGazetteer(beat, { log })} local names`); local = store.places(beat.id) }
    catch (e) { log(`locate   no local names for ${beat.name} yet: ${e.message}`) }
  }
  const by = new Map()
  for (const p of namesFor(beat)) if (!by.has(p.norm)) by.set(p.norm, p)
  for (const p of local) by.set(p.norm, p)
  // more names than last time: look again for what found none
  const mark = `names:${beat.id}`, count = String(by.size)
  if (store.kv(mark) !== count) { store.lookAgain(beat.id); log(`locate   ${beat.name} has ${count} names now (it had ${store.kv(mark) ?? 'none counted'}); looking again for what found no place`); store.kv(mark, count) }
  const self = norm(beat.name)
  const long = [...by.values()].filter((p) => p.norm !== self && (p.norm.includes(' ') || p.norm.length >= 7)).sort((a, b) => b.norm.length - a.norm.length)
  const within = (w) => long.find((p) => (` ${w} `).includes(` ${p.norm} `)) || null
  const facts = { name: 0, part: 0, beat: 0, none: 0 }
  for (const f of store.factsToLocate(beat.id, limit)) {
    const w = norm(f.where_text); let hit = null, how = 'none'
    if (w) {
      if (by.has(w) && w !== self) { hit = by.get(w); how = 'name' }
      else { hit = within(w); how = hit ? 'part' : w.includes(self) ? 'beat' : 'none' }
    } else how = 'beat'
    facts[how]++
    store.located(f.id, hit ? { lat: hit.lat, lon: hit.lon, place: hit.name, how } : { place: how === 'beat' ? beat.name : null, how })
  }
  const items = { source: 0, fact: 0, name: 0, part: 0, none: 0 }; let named = 0
  for (const it of store.itemsToLocate(beat.id, limit)) {
    const found = new Map()
    for (const p of store.factPoints(it.id)) found.set(p.name, { name: p.name, lat: p.lat, lon: p.lon, how: 'fact' })
    const w = norm(it.place || '')
    if (w && by.has(w) && w !== self) { const p = by.get(w); found.set(p.name, { name: p.name, lat: p.lat, lon: p.lon, how: 'name' }) }
    if (it.digest !== 'done') {                              // no model read it: every known name in its own words
      const text = ` ${norm(`${it.title || ''} ${it.place || ''} ${it.text || ''}`)} `
      for (const p of long) if (text.includes(` ${p.norm} `) && !found.has(p.name)) found.set(p.name, { name: p.name, lat: p.lat, lon: p.lon, how: 'part' })
    }
    const list = [...found.values()].slice(0, 12); store.setItemPlaces(it.id, beat.id, list); named += list.length
    const own = it.lat != null && (it.place_how === 'source' || it.place_how == null)
    const r = own ? { how: 'source' } : list.length ? { lat: list[0].lat, lon: list[0].lon, place: list[0].name, how: list[0].how } : { how: 'none' }
    items[r.how]++; store.itemLocated(it.id, r)
  }
  return { names: by.size, facts, items, places_named_by_items: named }
}
