// Pass 1, fetch: ask every source that is due, keep what it lists, and set when it is next asked.
// A source that fails is asked again later and later (lib/fetch.mjs, backoffSeconds); one failing
// source never stops the others. Nothing here reads meaning into an item.
import { KINDS } from '../sources/index.mjs'
import { politeGet, backoffSeconds } from '../fetch.mjs'
import * as store from '../store.mjs'
import { notify } from '../notify.mjs'

export async function fetchPass(beat, { all = false, log = console.log } = {}) {
  const due = store.sourcesDue(beat.id, all); let fresh = 0
  await Promise.all(due.map(async (s) => {
    const kind = KINDS[s.kind]
    if (!kind) return store.sourceResult(s.id, { ok: false, error: `no source kind ${s.kind}`, nextIn: 86400 })
    try {
      const r = await kind(s, politeGet, beat)
      // a regional paper is read for one place by a pattern its beat file gives ("filter"): what does not match is not kept
      if (s.config.filter && !r.notModified) { const re = new RegExp(s.config.filter, 'i'); r.listed = r.items.length; r.items = r.items.filter((i) => re.test(`${i.title || ''} ${i.text || ''}`)) }
      const n = r.notModified ? 0 : store.saveItems(s, r.items)
      fresh += n
      store.sourceResult(s.id, { ok: true, etag: r.etag, lastModified: r.lastModified, nextIn: s.every_s, count: r.notModified ? null : r.items.length })
      log(`fetch    ${s.name}: ${r.notModified ? 'not modified' : `${r.listed ?? r.items.length} listed${r.listed != null ? `, ${r.items.length} matching` : ''}, ${n} new`}`)
    } catch (e) {
      const wait = backoffSeconds(s.every_s, s.fails + 1, e.retryAfter)
      store.sourceResult(s.id, { ok: false, error: e.message, nextIn: wait })
      if (s.fails + 1 === 3) notify(`a source keeps failing (${beat.id})`, `${s.name}: ${e.message}. Three failures in a row; it is asked again later and later, up to a day.`)
      log(`fetch    ${s.name}: FAILED (${e.message}); failure ${s.fails + 1} in a row, asked again in ${Math.round(wait / 60)} min`)
    }
  }))
  return { asked: due.length, fresh }
}
