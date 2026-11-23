// The one page: what this service is and how it is doing, for a person who lands on it. Plain
// HTML made on the server, no script. It is an appliance's status plate, not an application.
import * as store from './store.mjs'
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() / 1000 - t) / 60); return m < 2 ? 'just now' : m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` }

export function page(beats) {
  const sections = beats.map((b) => { const c = store.counts(b.id), src = store.sources(b.id), iss = store.issues(b.id)
    return `<section><h2>${esc(b.name)}</h2><p class="m">${esc(b.about || '')}</p>
<p><b>${c.items}</b> items read from <b>${c.sources}</b> sources · <b>${c.relevant}</b> concern the place · <b>${c.facts}</b> facts, <b>${c.located}</b> on the map · <b>${c.undigested}</b> waiting to be read</p>
${iss.length ? `<h3>What it is dealing with, as read on ${new Date(iss[0].made * 1000).toISOString().slice(0, 10)}</h3><ul>${iss.map((x) => `<li><b>${esc(x.title)}</b> <span class="m">(${x.facts.length} facts)</span><br>${esc(x.summary)}</li>`).join('')}</ul><p class="m">A model's reading of the facts, made again each day. Each issue lists its facts and their sources at <a href="/beats/${b.id}/issues">/beats/${b.id}/issues</a>.</p>` : ''}
<h3>Sources</h3><table>${src.map((s) => `<tr><td>${s.fails ? '<b class="bad">failing</b>' : s.last_ok ? 'ok' : 'new'}</td><td>${esc(s.name)}</td><td class="m">${esc(s.kind)}</td><td class="m">${s.last_count ?? '–'} listed</td><td class="m">${ago(s.last_ok)}</td><td class="m">${esc(s.last_error || '')}</td></tr>`).join('')}</table>
<p class="m">JSON: <a href="/beats/${b.id}/items">items</a> · <a href="/beats/${b.id}/facts">facts</a> · <a href="/beats/${b.id}/facts.geojson">facts on the map</a> · <a href="/beats/${b.id}/issues">issues</a> · <a href="/beats/${b.id}/sources">sources</a></p></section>` }).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>inhaler</title>
<style>:root{color-scheme:light dark}body{font:15px/1.5 system-ui,sans-serif;max-width:52rem;margin:2.5rem auto;padding:0 1rem}h1{font-size:1.5rem;margin:0}h2{margin-top:2.2rem;font-size:1.2rem}h3{font-size:1rem;margin-top:1.4rem}
.m{opacity:.65}.bad{color:#c0392b}table{border-collapse:collapse;width:100%;font-size:13px}td{padding:3px 8px 3px 0;vertical-align:top;border-top:1px solid #8884}li{margin:.5rem 0}a{color:inherit}</style></head><body>
<h1>inhaler</h1>
<p>A service that reads what is published about a place (local news, official notices, weather alerts, public posts) and digests it into facts: what a source said happened, was decided, was proposed or was measured, with its date, its place on a map where the source named one, and a link back.</p>
<p class="m">A fact here means "this source said this". Nothing is checked for truth. Items belong to their publishers; this service gives out links, short excerpts and its own one-sentence summaries. It has no interface beyond this page: other programs ask it over HTTP. ${store.waiting()} items are waiting to be read across all places.</p>
${sections}
</body></html>`
}
