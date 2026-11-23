// Sources. A source kind is one module with one function:
//
//   fetch(source, get, beat) -> { items: [{ key, url, title, text, author, published, image, lat, lon, place, category, raw }], notModified? }
//
// `source` is the row from the store (url, config from the beat file, etag, last_modified);
// `get` is the polite fetcher. `key` is the publisher's own name for the item, so the same item
// fetched again is recognised. `published` is Unix seconds. A kind reads; it does not judge,
// filter by place, or call a model. Options any source may carry in its beat file: "filter" (a pattern an
// item must match to be kept), "digest": false (kept as it came, read by no model), "category", "lists_all". Add a kind by adding a file and a line here.
import { feed } from './feed.mjs'
import { fxtwitter } from './fxtwitter.mjs'
import { nwsAlerts } from './nws-alerts.mjs'
import { googleNews } from './google-news.mjs'
import { inaturalist, mastodon, flickr, wikipedia, commons, openverse } from './ambient.mjs'

export const KINDS = { feed, fxtwitter, 'nws-alerts': nwsAlerts, 'google-news': googleNews, inaturalist, mastodon, flickr, wikipedia, commons, openverse }
