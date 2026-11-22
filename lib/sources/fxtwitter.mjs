// An account's recent posts on X, through the FixTweet API (api.fxtwitter.com), which answers
// without a key. `url` in the beat file is the account's name. It gives timelines; it has no
// search ("unavailable due to current API limitations", 22 November 2026), so a place is followed
// by the accounts that speak about it, and the digesting pass decides which posts concern it.
export async function fxtwitter(source, get) {
  const name = source.url.replace(/^@/, '')
  const r = await get(`https://api.fxtwitter.com/2/profile/${encodeURIComponent(name)}/statuses`, { accept: 'application/json' })
  if (!r.ok) throw Object.assign(new Error(r.error), { retryAfter: r.retryAfter })
  const d = JSON.parse(r.text)
  if (d.code !== 200) throw new Error(d.message || `fxtwitter ${d.code}`)
  return { items: (d.results || []).filter((s) => s.type === 'status' && s.text).map((s) => ({
    key: s.id, url: s.url, title: null, text: s.text + (s.quote?.text ? `\n(quoting ${s.quote.author?.screen_name || 'a post'}: ${s.quote.text})` : ''),
    author: s.author?.name || name, published: s.created_timestamp || (Date.parse(s.created_at) / 1000 | 0) || null,
    raw: { likes: s.likes, reposts: s.reposts ?? s.retweets, replies: s.replies, media: (s.media?.all || []).map((m) => m.url).slice(0, 4), reposted_by: s.reposted_by?.screen_name || null } })) }
}
