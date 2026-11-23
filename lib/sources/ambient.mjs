// Sources that give the feel of a place more than its news: sightings, photographs, reference
// pages, public posts under a tag. They came from the Cortes and Salt Spring island projects,
// which each fetched them for themselves. Most are marked "digest": false in a beat file: an
// item is kept as it came, with its picture and its point, and no model reads it.
import { plain } from './feed.mjs'
const need = (r) => { if (!r.ok) throw Object.assign(new Error(r.error), { retryAfter: r.retryAfter }); return JSON.parse(r.text) }
const secs = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? Math.floor(t / 1000) : null }

/// iNaturalist: wildlife observations with photographs inside the beat's box. No key. `url` is unused.
export async function inaturalist(source, get, beat) {
  const [s, w, n, e] = beat.bbox
  const d = need(await get(`https://api.inaturalist.org/v1/observations?nelat=${n}&nelng=${e}&swlat=${s}&swlng=${w}&per_page=60&order_by=observed_on&order=desc&photos=true&geoprivacy=open`, { accept: 'application/json' }))
  return { items: (d.results || []).map((o) => { const [lat, lon] = (o.location || '').split(',').map(Number), t = o.taxon || {}
    const name = t.preferred_common_name ? (t.name ? `${t.preferred_common_name} (${t.name})` : t.preferred_common_name) : t.name || o.species_guess || 'Unidentified observation'
    return { key: o.id, url: o.uri || `https://www.inaturalist.org/observations/${o.id}`, title: name, author: o.user?.name || o.user?.login || null, published: secs(o.time_observed_at || o.observed_on || o.created_at),
      text: [o.description, o.place_guess ? `Seen at ${o.place_guess}` : null, o.quality_grade === 'research' ? 'Research-grade identification' : null].filter(Boolean).join('. '),
      image: o.photos?.[0]?.url?.replace('square', 'medium') || null, lat, lon, place: o.place_guess || null, category: 'wildlife', raw: { iconic: t.iconic_taxon_name || null, grade: o.quality_grade, licence: o.license_code || null } } }).filter((i) => Number.isFinite(i.lat)) }
}
/// Mastodon: public posts under a hashtag. `url` is the tag; "host" in the beat file is the server (mastodon.social).
export async function mastodon(source, get) {
  const host = source.config.host || 'mastodon.social', d = need(await get(`https://${host}/api/v1/timelines/tag/${encodeURIComponent(source.url.replace(/^#/, ''))}?limit=30`, { accept: 'application/json' }))
  return { items: d.map((p) => ({ key: p.uri || p.id, url: p.url || p.uri, title: null, text: plain(p.content), author: p.account?.display_name || p.account?.acct || null, published: secs(p.created_at),
    image: p.media_attachments?.find((m) => m.type === 'image')?.preview_url || null, category: 'social', raw: { host, reblogs: p.reblogs_count, favourites: p.favourites_count, tags: (p.tags || []).map((t) => t.name) } })).filter((i) => i.text || i.image) }
}
/// Flickr: public photographs under a tag (the public feed, no key). `url` is the tag or tags.
export async function flickr(source, get) {
  const d = need(await get(`https://www.flickr.com/services/feeds/photos_public.gne?tags=${encodeURIComponent(source.url)}&format=json&nojsoncallback=1`, { accept: 'application/json' }))
  return { items: (d.items || []).map((p) => ({ key: p.link, url: p.link, title: p.title || 'Photograph', text: plain(p.description).replace(/^.*?posted a photo:?\s*/i, ''), author: (p.author || '').replace(/^.*\("(.+)"\)$/, '$1') || null,
    published: secs(p.date_taken || p.published), image: p.media?.m?.replace('_m.', '_z.') || null, category: 'photo', raw: { tags: p.tags } })) }
}
/// Wikipedia: the articles about things within "radius_m" (10 km) of the beat's centre, each with its summary.
export async function wikipedia(source, get, beat) {
  const [lat, lon] = beat.center, lang = source.config.lang || 'en'
  const g = need(await get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${source.config.radius_m || 10000}&gslimit=${source.config.limit || 30}&format=json`, { accept: 'application/json' }))
  const items = []
  for (const p of g.query?.geosearch || []) { const r = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, { accept: 'application/json' }); if (!r.ok) continue; const s = JSON.parse(r.text)
    items.push({ key: p.pageid, url: s.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}`, title: p.title, text: s.extract || '', author: 'Wikipedia', published: secs(s.timestamp), image: s.thumbnail?.source || null, lat: p.lat, lon: p.lon, category: 'reference' }) }
  return { items }
}
/// Wikimedia Commons: freely licensed photographs taken within "radius_m" of the beat's centre.
export async function commons(source, get, beat) {
  const [lat, lon] = beat.center
  const d = need(await get(`https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggscoord=${lat}%7C${lon}&ggsradius=${source.config.radius_m || 10000}&ggslimit=${source.config.limit || 40}&prop=imageinfo%7Ccoordinates&iiprop=url%7Cextmetadata%7Ctimestamp%7Cuser&iiurlwidth=640&format=json`, { accept: 'application/json' }))
  return { items: Object.values(d.query?.pages || {}).map((p) => { const i = p.imageinfo?.[0] || {}, m = i.extmetadata || {}, c = p.coordinates?.[0]
    return { key: p.pageid, url: i.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`, title: p.title.replace(/^File:/, '').replace(/\.\w+$/, ''), text: plain(m.ImageDescription?.value || ''), author: plain(m.Artist?.value || i.user || '') || null,
      published: secs(m.DateTimeOriginal?.value || i.timestamp), image: i.thumburl || i.url || null, lat: c?.lat, lon: c?.lon, category: 'photo', raw: { licence: m.LicenseShortName?.value || null } } }).filter((i) => i.image) }
}
/// Openverse: openly licensed images matching a phrase. `url` is the phrase.
export async function openverse(source, get) {
  const d = need(await get(`https://api.openverse.org/v1/images/?q=${encodeURIComponent('"' + source.url + '"')}&page_size=20&license_type=all-cc`, { accept: 'application/json' }))
  return { items: (d.results || []).map((p) => ({ key: p.id, url: p.foreign_landing_url || p.url, title: p.title || 'Image', text: (p.tags || []).map((t) => t.name).slice(0, 12).join(', '), author: p.creator || null, published: null,
    image: p.thumbnail || p.url, category: 'photo', raw: { licence: `${p.license} ${p.license_version || ''}`.trim(), provider: p.source } })) }
}
