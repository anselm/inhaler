// The pages: what this service is and how it is doing, for a person who lands on it. Plain HTML
// made on the server, no script. An appliance's status plate, not an application.
import * as store from './store.mjs'
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const ago = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() / 1000 - t) / 60); return m < 2 ? 'just now' : m < 90 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` }
const shell = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>:root{color-scheme:light dark}body{font:15px/1.5 system-ui,sans-serif;max-width:54rem;margin:2.5rem auto;padding:0 1rem}h1{font-size:1.5rem;margin:0}h2{margin-top:2.2rem;font-size:1.2rem}h3{font-size:1rem;margin-top:1.4rem}
.m{opacity:.65}.bad{color:#c0392b}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:4px 10px 4px 0;vertical-align:top;border-top:1px solid #8884;text-align:left}th{font-weight:600;border-top:0}td.n{text-align:right;font-variant-numeric:tabular-nums}li{margin:.5rem 0}a{color:inherit}code{font-size:13px}</style></head><body>${body}</body></html>`

export function page(beats) {
  const rows = beats.map((b) => { const c = store.counts(b.id), bad = store.sources(b.id).filter((s) => s.fails).length
    return `<tr><td><a href="/place/${b.id}"><b>${esc(b.name)}</b></a></td><td class="n">${c.sources}${bad ? ` <span class="bad">(${bad} failing)</span>` : ''}</td><td class="n">${c.items}</td><td class="n">${c.facts}</td><td class="n">${c.items_on_the_map}</td><td class="n">${c.issues}</td><td class="n">${c.waiting.to_be_read}</td></tr>` }).join('')
  return shell('inhaler', `<h1>inhaler</h1>
<p>A general reader of public news and media, as a service. It collects what is published about the places it follows (local papers, official notices, weather alerts, public posts, photographs, sightings) and does the simple analysis on it, so that the programs which use it do not each have to fetch for themselves.</p>
<p>It works in passes. <b>Collect</b>: each source is asked on its own schedule, politely, and what it lists is kept as it came. <b>Read</b>: a model reads each news item once and says whether it concerns the place, what it reports in a sentence, and which facts it states, with their dates. <b>Place</b>: facts and items are put on the map from the place names in them. <b>Gather</b>: once a day the recent facts of a place are read together and its standing issues are named. Each item carries a mark for each pass, so a pass can stop anywhere and resume, and deeper analysis is left to the programs that use it.</p>
<h2>What it follows now</h2>
<table><tr><th>beat</th><th>sources</th><th>items</th><th>facts</th><th>items on the map</th><th>issues</th><th>waiting to be read</th></tr>${rows}</table>
<p class="m">It is a few days old. A beat is a place, with a box on the map, or a subject, without one. Adding one is adding a file that names its sources.</p>
<h2>Asking it</h2>
<p>JSON over HTTP, read-only: <code>/beats</code>, then <code>/beats/&lt;place&gt;/items</code>, <code>/facts</code>, <code>/facts.geojson</code>, <code>/issues</code>, <code>/places</code>, <code>/sources</code>. A machine with a model and a key may also help with the reading.</p>
<p class="m">A fact here means "this source said this". Nothing is checked for truth. Items belong to their publishers: this service gives out links, short excerpts and its own one-sentence summaries, not full texts. Source code: <a href="https://github.com/anselm/inhaler">github.com/anselm/inhaler</a>.</p>`)
}

export function placePage(b) {
  const c = store.counts(b.id), src = store.sources(b.id), iss = store.issues(b.id)
  return shell(`inhaler: ${b.name}`, `<p class="m"><a href="/">inhaler</a></p><h1>${esc(b.name)}</h1><p class="m">${esc(b.about || '')}</p>
<p><b>${c.items}</b> items from <b>${c.sources}</b> sources · <b>${c.relevant}</b> news items concern the place · <b>${c.facts}</b> facts, <b>${c.located}</b> on the map · <b>${c.kept_as_is}</b> items kept as they came (photographs, sightings, reference) · <b>${c.items_on_the_map}</b> items on the map</p>
<p class="m">Waiting: ${c.waiting.to_be_read} to be read, ${c.waiting.facts_to_be_placed} facts and ${c.waiting.items_to_be_placed} items to be placed.</p>
${iss.length ? `<h3>What it is dealing with, as read on ${new Date(iss[0].made * 1000).toISOString().slice(0, 10)}</h3><ul>${iss.map((x) => `<li><b>${esc(x.title)}</b> <span class="m">(${x.facts.length} facts)</span><br>${esc(x.summary)}</li>`).join('')}</ul><p class="m">A model's reading of the facts, made again each day. Each issue lists its facts and their sources at <a href="/beats/${b.id}/issues">/beats/${b.id}/issues</a>.</p>` : ''}
<h3>Sources</h3><table>${src.map((s) => `<tr><td>${s.fails ? '<b class="bad">failing</b>' : s.last_ok ? 'ok' : 'new'}</td><td>${esc(s.name)}</td><td class="m">${esc(s.kind)}</td><td class="m">${s.last_count ?? '–'} listed</td><td class="m">${ago(s.last_ok)}</td><td class="m">${esc(s.last_error || '')}</td></tr>`).join('')}</table>
${(b.media || []).length ? `<p class="m">Also of this place, not read: ${b.media.map((m) => esc(m.name)).join('; ')}.</p>` : ''}
<p class="m">JSON: <a href="/beats/${b.id}/items">items</a> · <a href="/beats/${b.id}/facts">facts</a> · <a href="/beats/${b.id}/facts.geojson">facts on the map</a> · <a href="/beats/${b.id}/issues">issues</a> · <a href="/beats/${b.id}/places">places</a> · <a href="/beats/${b.id}/sources">sources</a></p>`)
}
