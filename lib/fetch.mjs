// The polite fetcher. Every request any source makes goes through here, so the manners are in
// one place: one request at a time per host with a gap between them, a time limit, an honest
// user-agent, and conditional requests (ETag, Last-Modified) so an unchanged feed costs the
// publisher almost nothing. It retries nothing by itself: a failure is returned, and the
// schedule (lib/passes/fetch.mjs) decides when the source is asked again.

const UA = process.env.INHALE_UA || 'esimv1-social/0.1 (a reader of public local news; https://github.com/anselm/esimv1-social)'
const GAP_MS = Number(process.env.INHALE_GAP_MS || 1500), LIMIT_MS = 30000
const last = new Map(), queue = new Map()          // per host: when it was last asked, and the tail of its line

/// -> { status, ok, notModified, text, etag, lastModified, error }
export function politeGet(url, { etag = null, lastModified = null, accept = '*/*', headers = {} } = {}) {
  const host = new URL(url).host
  const turn = (queue.get(host) || Promise.resolve()).then(async () => {
    const wait = (last.get(host) || 0) + GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(LIMIT_MS),
        headers: { 'User-Agent': UA, Accept: accept, ...(etag ? { 'If-None-Match': etag } : {}), ...(lastModified ? { 'If-Modified-Since': lastModified } : {}), ...headers } })
      if (r.status === 304) return { status: 304, ok: true, notModified: true }
      const text = await r.text()
      return { status: r.status, ok: r.ok, notModified: false, text, etag: r.headers.get('etag'), lastModified: r.headers.get('last-modified'),
        retryAfter: Number(r.headers.get('retry-after')) || null, error: r.ok ? null : `HTTP ${r.status}` }
    } catch (e) { return { status: 0, ok: false, error: e.name === 'TimeoutError' ? 'timed out' : String(e.cause?.code || e.message) } }
    finally { last.set(host, Date.now()) }
  })
  queue.set(host, turn.catch(() => {}))
  return turn
}

/// When to ask a failing source again: its usual interval doubled per failure in a row, capped at
/// a day, with a quarter of jitter so sources that failed together do not return together. A
/// server's own Retry-After is respected when it is longer.
export function backoffSeconds(everyS, fails, retryAfter = null) {
  const base = Math.min(86400, everyS * 2 ** Math.min(fails, 10))
  return Math.max(retryAfter || 0, Math.round(base * (0.75 + Math.random() * 0.5)))
}
