// A push to a phone when something needs a person: a source that has failed several times in a
// row, a pass that could not ask any model, a backup that did not go. Over ntfy: one POST to
// INHALE_NTFY (a full topic address such as https://ntfy.sh/<topic>). Without it, a line on the
// console and nothing else. The same subject is not sent twice within six hours.
const sent = new Map()
export async function notify(subject, body = '') {
  console.log(`notify   ${subject}${body ? ': ' + body : ''}`)
  const url = process.env.INHALE_NTFY; if (!url) return
  if (Date.now() - (sent.get(subject) || 0) < 6 * 3600e3) return
  sent.set(subject, Date.now())
  for (let i = 0; i < 3; i++) try { const r = await fetch(url, { method: 'POST', headers: { Title: `inhaler: ${subject}`.replace(/[^\x20-\x7e]/g, '') }, body: body || subject, signal: AbortSignal.timeout(10000) }); if (r.ok) return } catch { /* again */ }
}
