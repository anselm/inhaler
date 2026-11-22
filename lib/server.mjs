// The read side: what another program asks the inhaler. JSON over HTTP, read-only, open to any
// origin. An item is given as its link, a short excerpt and the inhaler's own one-sentence
// summary, never the publisher's full text.
//
//   GET /beats                         the beats and their counts
//   GET /beats/<id>/sources            what is read, with each source's health
//   GET /beats/<id>/items?since=&limit=&relevant=1
//   GET /beats/<id>/facts?since=&limit=       add .geojson for the located ones as points
//   GET /beats/<id>/issues             each issue with the facts it rests on
import http from 'node:http'
import * as store from './store.mjs'
import { beatIds, loadBeat } from './beats.mjs'

export function serve(port = 5191) {
  const beats = Object.fromEntries(beatIds().map((id) => [id, loadBeat(id)]))
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), parts = u.pathname.split('/').filter(Boolean), q = u.searchParams
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(body)) }
    try {
      if (req.method !== 'GET') return send(405, { error: 'read-only' })
      if (parts.length === 1 && parts[0] === 'beats') return send(200, Object.values(beats).map((b) => ({ id: b.id, name: b.name, about: b.about, center: b.center, bbox: b.bbox, ...store.counts(b.id) })))
      const b = parts[0] === 'beats' && beats[parts[1]]
      if (!b) return send(404, { error: 'no such beat' })
      const since = Number(q.get('since')) || 0, limit = Math.min(Number(q.get('limit')) || 200, 2000)
      if (parts[2] === 'sources') return send(200, store.sources(b.id))
      if (parts[2] === 'items') return send(200, store.items(b.id, { since, limit, relevant: q.has('relevant') ? Number(q.get('relevant')) : null }))
      if (parts[2] === 'facts') return send(200, store.facts(b.id, { since, limit }))
      if (parts[2] === 'facts.geojson') return send(200, { type: 'FeatureCollection', features: store.facts(b.id, { since, limit }).filter((f) => f.lat != null).map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] }, properties: { ...f, lat: undefined, lon: undefined } })) })
      if (parts[2] === 'issues') { const all = new Map(store.facts(b.id, { limit: 5000 }).map((f) => [f.id, f])); return send(200, store.issues(b.id).map((x) => ({ ...x, facts: x.facts.map((id) => all.get(id)).filter(Boolean) }))) }
      send(404, { error: 'not found' })
    } catch (e) { send(500, { error: e.message }) }
  }).listen(port, '127.0.0.1', () => console.log(`inhale   read API on http://127.0.0.1:${port}/beats`))
}
