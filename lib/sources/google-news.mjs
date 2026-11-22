// Google News search as a feed: every outlet's stories that match a phrase. `url` in the beat file
// is the phrase ("Sausalito"). The links are Google's redirects and the text is only a headline
// and the outlet's name, so this finds stories; it does not hold them.
import { parseFeed } from './feed.mjs'
export async function googleNews(source, get) {
  const q = encodeURIComponent(source.url), c = source.config
  const r = await get(`https://news.google.com/rss/search?q=${q}&hl=${c.hl || 'en-US'}&gl=${c.gl || 'US'}&ceid=${c.gl || 'US'}:${(c.hl || 'en').slice(0, 2)}`, { accept: 'application/rss+xml' })
  if (!r.ok) throw Object.assign(new Error(r.error), { retryAfter: r.retryAfter })
  return { items: parseFeed(r.text).filter((i) => i.key).map((i) => ({ ...i, text: i.text || i.title })) }
}
