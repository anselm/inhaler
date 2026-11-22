// Sources. A source kind is one module with one function:
//
//   fetch(source, get) -> { items: [{ key, url, title, text, author, published, raw }], notModified? }
//
// `source` is the row from the store (url, config from the beat file, etag, last_modified);
// `get` is the polite fetcher. `key` is the publisher's own name for the item, so the same item
// fetched again is recognised. `published` is Unix seconds. A kind reads; it does not judge,
// filter by place, or call a model. Add a kind by adding a file and a line here.
import { feed } from './feed.mjs'
import { fxtwitter } from './fxtwitter.mjs'
import { nwsAlerts } from './nws-alerts.mjs'
import { googleNews } from './google-news.mjs'

export const KINDS = { feed, fxtwitter, 'nws-alerts': nwsAlerts, 'google-news': googleNews }
