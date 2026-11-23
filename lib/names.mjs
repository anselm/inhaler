// The name server: place names of the world, kept in this service's own store, so that placing a
// thing on the map asks nobody. The names are GeoNames' (geonames.org, Creative Commons Attribution
// 4.0), one file per country, about seventy megabytes zipped for the United States. They are
// fetched a country at a time, in the background of the loop, for the countries the beats name;
// until a country has arrived, a beat makes do with what it has. GeoNames has towns,
// neighbourhoods, hills, bays, parks and many buildings; it does not have streets, which come
// from OpenStreetMap when its servers answer (lib/gazetteer.mjs).
//
// Needs `curl` and `unzip` on the machine (the download resumes; the file is read as a stream).
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { spawn } from 'node:child_process'
import * as store from './store.mjs'
import { norm } from './gazetteer.mjs'

const DIR = path.join(path.dirname(store.file), 'geonames')
const run = (cmd, args) => new Promise((ok, no) => { const p = spawn(cmd, args, { stdio: 'ignore' }); p.on('close', (c) => (c === 0 ? ok() : no(new Error(`${cmd} ended with ${c}`)))); p.on('error', no) })

/// Load one country's names, if it is not loaded. -> rows loaded, or 0 when it was there already.
export async function loadCountry(cc, { log = console.log } = {}) {
  cc = cc.toUpperCase(); if (!/^[A-Z]{2}$/.test(cc)) throw new Error(`not a country code: ${cc}`)
  if (store.namesLoaded().some((r) => r.country === cc)) return 0
  fs.mkdirSync(DIR, { recursive: true }); const zip = path.join(DIR, `${cc}.zip`)
  log(`names    fetching ${cc} from GeoNames`)
  await run('curl', ['-sS', '-f', '-L', '-C', '-', '--retry', '3', '-A', 'inhaler name server', '-o', zip, `https://download.geonames.org/export/dump/${cc}.zip`])
  const child = spawn('unzip', ['-p', zip, `${cc}.txt`], { stdio: ['ignore', 'pipe', 'ignore'] }); let batch = [], n = 0
  for await (const line of readline.createInterface({ input: child.stdout, crlfDelay: Infinity })) {
    const c = line.split('\t'); if (c.length < 15) continue
    const lat = +c[4], lon = +c[5]; if (!Number.isFinite(lat) || !c[1]) continue
    // other names of the same thing, kept when they are in Latin letters and long enough to be told apart
    const alts = c[3] ? [...new Set(c[3].split(',').filter((a) => a.length >= 4 && /^[\x20-\x7eÀ-ɏ]+$/.test(a) && a !== c[1]))].slice(0, 12).join('|') : ''
    batch.push({ id: +c[0], name: c[1], norm: norm(c[1]), alts, lat, lon, class: c[6], code: c[7], pop: +c[14] || 0 }); n++
    if (batch.length >= 5000) { store.saveNames(cc, batch); batch = []; await new Promise((r) => setImmediate(r)) }     // small writes, so the loop's own are not kept waiting
  }
  if (batch.length) store.saveNames(cc, batch)
  if (n < 100) throw new Error(`${cc}: only ${n} names read; the download may be incomplete`)
  store.namesDone(cc, n); fs.rmSync(zip, { force: true })
  log(`names    ${cc}: ${n} names`)
  return n
}

/// One step: the first country a beat names that is not loaded. Called once per round of the loop.
export async function namesStep(beats, opts) {
  const want = [...new Set(beats.flatMap((b) => b.countries || []))].map((c) => c.toUpperCase()), have = new Set(store.namesLoaded().map((r) => r.country))
  const next = want.find((c) => !have.has(c)); if (!next) return null
  return { country: next, rows: await loadCountry(next, opts) }
}

/// The names inside a beat's box, in the shape the locate pass uses. A name of one short word is
/// kept only for a populated place or a large thing, because "Park" and "Bay" are also plain words.
export function namesFor(beat) {
  if (!beat.bbox) return []
  const out = []
  for (const r of store.namesIn(beat.bbox)) for (const name of [r.name, ...(r.alts ? r.alts.split('|') : [])]) { const k = norm(name); if (k.length >= 4) out.push({ norm: k, name: r.name, kind: `geonames:${r.class}.${r.code}`, lat: r.lat, lon: r.lon }) }
  return out
}
/// Ask the name server directly: every place of that name, most populous first.
export const lookup = (name, limit = 20) => store.namesLike(norm(name), limit)
