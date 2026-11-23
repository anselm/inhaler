// An RSS or Atom feed: a news site's tag feed, a blog, a podcast, a YouTube channel's feed.
import { XMLParser } from 'fast-xml-parser'
// entities are left as written and undone in plain(): a long feed has more of them than the parser will expand
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#', cdataPropName: '#c', processEntities: false })
const str = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : v['#c'] ?? v['#'] ?? '')
export const plain = (html) => str(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#8217;|&rsquo;/g, '’').replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
const when = (s) => { const t = Date.parse(str(s)); return Number.isFinite(t) ? Math.floor(t / 1000) : null }
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])

export function parseFeed(text) {
  const d = xml.parse(text)
  if (d.rss?.channel) return list(d.rss.channel.item).map((i) => ({
    key: str(i.guid) || str(i.link), url: str(i.link), title: plain(i.title), author: plain(i['dc:creator'] || i.author),
    text: plain(i['content:encoded'] || i.description), published: when(i.pubDate || i['dc:date']) }))
  // RSS 1.0 (RDF): the items sit beside the channel, not inside it
  if (d['rdf:RDF']) return list(d['rdf:RDF'].item).map((i) => ({ key: str(i['@rdf:about']) || str(i.link), url: str(i.link), title: plain(i.title), author: plain(i['dc:creator']), text: plain(i['content:encoded'] || i.description), published: when(i['dc:date'] || i.pubDate) }))
  if (d.feed) return list(d.feed.entry).map((e) => { const link = list(e.link).find((l) => l['@rel'] !== 'self' && l['@href']) || {}
    return { key: str(e.id) || link['@href'], url: link['@href'] || '', title: plain(e.title), author: plain(e.author?.name), text: plain(e.content || e.summary || e['media:group']?.['media:description']), published: when(e.published || e.updated) } })
  throw new Error('not an RSS or Atom feed')
}
export async function feed(source, get) {
  const r = await get(source.url, { etag: source.etag, lastModified: source.last_modified, accept: 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8', charset: source.config.charset || null })
  if (r.notModified) return { notModified: true, items: [] }
  if (!r.ok) throw Object.assign(new Error(r.error), { retryAfter: r.retryAfter })
  return { items: parseFeed(r.text).filter((i) => i.key), etag: r.etag, lastModified: r.lastModified }
}
