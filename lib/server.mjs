// The read side: what another program asks the inhaler. JSON over HTTP, read-only, open to any
// origin. An item is given as its link, a short excerpt and the inhaler's own one-sentence
// summary, never the publisher's full text.
//
//   GET /beats                         the beats and their counts
//   GET /beats/<id>/sources            what is read, with each source's health
//   GET /beats/<id>/items?since=&limit=&relevant=1&kind=&category=     each with its picture and point when it has them
//   GET /beats/<id>/places             the place's gazetteer: names and where they are
//   GET /beats/<id>/facts?since=&limit=       add .geojson for the located ones as points
//   GET /beats/<id>/issues             each issue with the facts it rests on
//   GET /                              a plain page saying what this is and how it is doing
//
// And the one way in, for helpers: a machine with a model takes unread items, reads them and sends
// its readings back (lib/help.mjs). Both calls need a key, `Authorization: Bearer <secret>`, from
// INHALE_KEYS (a comma list of name:secret). A helper is given an item's full text; nobody else is.
//
//   POST /work/claim  { n }                        -> { items: [...], beats: { id: { name, about } } }
//   POST /work/done   { id, json, tier, cut }      -> { facts }      the reading is checked before it is kept
import http from 'node:http'
import * as store from './store.mjs'
import { beatIds, loadBeat } from './beats.mjs'
import { keepReading } from './passes/digest.mjs'
import { page, placePage } from './page.mjs'

const KEYS = new Map((process.env.INHALE_KEYS || '').split(',').map((s) => s.trim()).filter((s) => s.includes(':')).map((s) => [s.slice(s.indexOf(':') + 1), s.slice(0, s.indexOf(':'))]))
const bodyOf = (req) => new Promise((ok, no) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 2e6) { no(new Error('too large')); req.destroy() } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')) } catch { no(new Error('not JSON')) } }) })

export function serve(port = 5191, host = '127.0.0.1') {
  const beats = Object.fromEntries(beatIds().map((id) => [id, loadBeat(id)]))
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), parts = u.pathname.split('/').filter(Boolean), q = u.searchParams
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(body)) }
    try {
      if (req.method === 'POST' && parts[0] === 'work') {
        const who = KEYS.get((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
        if (!who) return send(401, { error: 'a helper needs a key' })
        const b = await bodyOf(req)
        if (parts[1] === 'claim') { const items = store.claimItems(Math.min(Math.max(1, Number(b.n) || 5), 20), who).map((i) => ({ id: i.id, beat: i.beat, title: i.title, text: i.text, author: i.author, published: i.published }))
          return send(200, { items, beats: Object.fromEntries([...new Set(items.map((i) => i.beat))].map((id) => [id, { id, name: beats[id]?.name, about: beats[id]?.about }])) }) }
        if (parts[1] === 'done') { const it = store.itemById(String(b.id)); if (!it) return send(404, { error: 'no such item' })
          if (it.digest !== 'new') return send(200, { facts: 0, note: 'already read' })
          return send(200, { facts: keepReading(it, b.json, `${String(b.tier || 'unknown')} via ${who}`, !!b.cut) }) }
        return send(404, { error: 'not found' })
      }
      if (req.method !== 'GET') return send(405, { error: 'read-only' })
      if (!parts.length || (parts[0] === 'place' && beats[parts[1]])) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(parts.length ? placePage(beats[parts[1]]) : page(Object.values(beats))) }
      if (parts[0] === 'about.json') return send(200, { service: 'inhaler', about: 'A general reader of public news and media, as a service: it collects what is published about the places it follows and does the simple analysis on it. Read-only.', source: 'https://github.com/anselm/inhaler', start: '/beats' })
      if (parts.length === 1 && parts[0] === 'beats') return send(200, Object.values(beats).map((b) => ({ id: b.id, name: b.name, about: b.about, center: b.center, bbox: b.bbox, media: b.media || [], ...store.counts(b.id) })))
      const b = parts[0] === 'beats' && beats[parts[1]]
      if (!b) return send(404, { error: 'no such beat' })
      const since = Number(q.get('since')) || 0, limit = Math.min(Number(q.get('limit')) || 200, 2000)
      if (parts[2] === 'sources') return send(200, store.sources(b.id))
      if (parts[2] === 'items') return send(200, store.items(b.id, { since, limit, relevant: q.has('relevant') ? Number(q.get('relevant')) : null, kind: q.get('kind'), category: q.get('category') }))
      if (parts[2] === 'places') return send(200, store.places(b.id).map((p) => ({ name: p.name, kind: p.kind, lat: p.lat, lon: p.lon })))
      if (parts[2] === 'facts') return send(200, store.facts(b.id, { since, limit }))
      if (parts[2] === 'facts.geojson') return send(200, { type: 'FeatureCollection', features: store.facts(b.id, { since, limit }).filter((f) => f.lat != null).map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] }, properties: { ...f, lat: undefined, lon: undefined } })) })
      if (parts[2] === 'issues') { const all = new Map(store.facts(b.id, { limit: 5000 }).map((f) => [f.id, f])); return send(200, store.issues(b.id).map((x) => ({ ...x, facts: x.facts.map((id) => all.get(id)).filter(Boolean) }))) }
      send(404, { error: 'not found' })
    } catch (e) { send(/shape of a reading|not JSON|too large/.test(e.message) ? 400 : 500, { error: e.message }) }
  }).listen(port, host, () => console.log(`inhale   read API on http://${host}:${port}/beats`))
}
