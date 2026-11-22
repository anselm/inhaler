// A beat's gazetteer: the names of things inside its box and where they are, from OpenStreetMap
// (© OpenStreetMap contributors, ODbL) through the Overpass API. Built once per beat and kept in
// the store. A street is many pieces of one name; it is placed at the mean of their centres.
import { politeGet } from './fetch.mjs'
import * as store from './store.mjs'

export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/\b(street|st)\b\.?/g, 'street').replace(/\b(avenue|ave)\b\.?/g, 'avenue')
  .replace(/\b(boulevard|blvd)\b\.?/g, 'boulevard').replace(/\b(road|rd)\b\.?/g, 'road').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export async function buildGazetteer(beat, { log = console.log } = {}) {
  const [s, w, n, e] = beat.bbox
  const q = `[out:json][timeout:90];(nwr["name"]["place"](${s},${w},${n},${e});way["name"]["highway"](${s},${w},${n},${e});nwr["name"]["amenity"](${s},${w},${n},${e});nwr["name"]["leisure"](${s},${w},${n},${e});nwr["name"]["natural"](${s},${w},${n},${e});nwr["name"]["tourism"](${s},${w},${n},${e});nwr["name"]["man_made"](${s},${w},${n},${e});nwr["name"]["landuse"](${s},${w},${n},${e});nwr["name"]["building"](${s},${w},${n},${e});nwr["name"]["waterway"](${s},${w},${n},${e});nwr["name"]["harbour"](${s},${w},${n},${e}););out tags center;`
  let data = null, why = ''
  for (const m of MIRRORS) { const r = await politeGet(`${m}?data=${encodeURIComponent(q)}`, { accept: 'application/json' }); if (r.ok && r.text.startsWith('{')) { data = JSON.parse(r.text); break } why = r.error || 'not JSON'; log(`gazetteer ${new URL(m).host}: ${why}`) }
  if (!data) throw new Error(`no Overpass mirror answered (${why})`)
  const by = new Map()
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon, t = el.tags || {}
    if (lat == null || !t.name) continue
    const kind = ['place', 'highway', 'amenity', 'leisure', 'natural', 'tourism', 'man_made', 'landuse', 'waterway', 'harbour', 'building'].find((k) => t[k]) || 'thing'
    for (const name of [t.name, t.alt_name, t.short_name, t.old_name].filter(Boolean)) {
      const k = norm(name); if (k.length < 4) continue
      const g = by.get(k) || { norm: k, name, kind, lat: 0, lon: 0, n: 0 }; g.lat += lat; g.lon += lon; g.n++; by.set(k, g)
    }
  }
  const list = [...by.values()].map((g) => ({ norm: g.norm, name: g.name, kind: g.kind, lat: g.lat / g.n, lon: g.lon / g.n }))
  store.savePlaces(beat.id, list)
  return list.length
}
