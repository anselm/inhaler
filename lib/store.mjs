// The store: the only file that touches the database. Everything else calls the functions
// below. SQLite in one file (node:sqlite, built into Node), so the inhaler needs no database
// server; the shapes are plain enough to move to another store behind the same functions.
//
// sources  what is read, per beat, with its health and when it is next due
// items    one thing a source published (an article, a post, a notice), as fetched
// facts    what a digesting pass drew out of an item: a dated, located, sourced claim
// places   a beat's gazetteer: names and where they are
// issues   what a beat is talking about, each with the facts it rests on
// spend    model calls per day and tier, for the budget
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const file = process.env.INHALE_DB || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'inhale.db')
fs.mkdirSync(path.dirname(file), { recursive: true })
const db = new DatabaseSync(file)
db.exec(`
pragma journal_mode = wal;
create table if not exists sources (id text primary key, beat text, kind text, name text, url text, config text, every_s integer,
  fails integer default 0, next_at integer default 0, etag text, last_modified text, last_ok integer, last_error text, last_count integer);
create table if not exists items (id text primary key, beat text, source_id text, key text, url text, title text, text text, author text,
  published integer, fetched integer, seen integer, gone_at integer, hash text, raw text,
  digest text default 'new', digest_tier text, relevant integer, summary text, topics text);
create index if not exists items_beat on items (beat, published);
create index if not exists items_digest on items (digest);
create table if not exists facts (id text primary key, item_id text, beat text, kind text, claim text, when_text text, at integer,
  where_text text, who text, quantity text, quote text, locate text default 'new', lat real, lon real, place text, place_how text);
create index if not exists facts_beat on facts (beat, at);
create table if not exists places (beat text, norm text, name text, kind text, lat real, lon real, primary key (beat, norm));
create table if not exists issues (id text primary key, beat text, title text, summary text, facts text, first_at integer, last_at integer, made integer, tier text);
create table if not exists names (id integer primary key, name text, norm text, alts text, lat real, lon real, class text, code text, country text, pop integer);
create index if not exists names_norm on names (norm);
create index if not exists names_box on names (country, lat);
create table if not exists names_loaded (country text primary key, at integer, rows integer);
create table if not exists item_places (item_id text, beat text, name text, lat real, lon real, how text, primary key (item_id, name));
create table if not exists kv (k text primary key, v text);
create table if not exists spend (day text, tier text, calls integer, primary key (day, tier));
`)
for (const col of ['lease_until integer', 'lease_by text', 'image text', 'lat real', 'lon real', 'place text', 'category text', "locate text default 'new'", 'place_how text']) try { db.exec(`alter table items add column ${col}`) } catch { /* already there */ }
db.exec('pragma busy_timeout = 15000')
const now = () => Math.floor(Date.now() / 1000)
export const sha = (s) => crypto.createHash('sha1').update(s).digest('hex')
const J = (v) => (v == null ? null : JSON.stringify(v)), P = (s, d = null) => { try { return s == null ? d : JSON.parse(s) } catch { return d } }

// ---- sources
export function upsertSource(beat, s) {
  const id = sha(`${beat}|${s.kind}|${s.url}`).slice(0, 16)
  db.prepare(`insert into sources (id, beat, kind, name, url, config, every_s) values (?,?,?,?,?,?,?)
    on conflict (id) do update set name = excluded.name, config = excluded.config, every_s = excluded.every_s`).run(id, beat, s.kind, s.name || s.url, s.url, J(s), s.every_s || 3600)
  return id
}
/// A beat file is the list of what is read: a source no longer in it is dropped (its items are kept).
export const keepSources = (beat, ids) => { for (const r of db.prepare('select id from sources where beat = ?').all(beat)) if (!ids.includes(r.id)) db.prepare('delete from sources where id = ?').run(r.id) }
const src = (r) => r && { ...r, config: P(r.config, {}) }
export const sourcesDue = (beat, all = false) => db.prepare(`select * from sources where beat = ? and (? or next_at <= ?) order by next_at`).all(beat, all ? 1 : 0, now()).map(src)
export const sources = (beat) => db.prepare(`select id, kind, name, url, every_s, fails, next_at, last_ok, last_error, last_count from sources where beat = ? order by name`).all(beat)
export function sourceResult(id, { ok, error = null, etag, lastModified, nextIn, count = null }) {
  if (ok) db.prepare(`update sources set fails = 0, last_ok = ?, last_error = null, next_at = ?, etag = coalesce(?, etag), last_modified = coalesce(?, last_modified), last_count = coalesce(?, last_count) where id = ?`).run(now(), now() + nextIn, etag ?? null, lastModified ?? null, count, id)
  else db.prepare(`update sources set fails = fails + 1, last_error = ?, next_at = ? where id = ?`).run(String(error).slice(0, 300), now() + nextIn, id)
}

// ---- items. An item is known by its source and the source's own key for it. Fetched again, it
// is marked seen; changed text makes it new to the digesting pass again; an item a source no
// longer lists is marked gone and kept.
export function saveItems(source, list) {
  // a source whose beat file says "digest": false is kept as it came (a photograph, a sighting, a reference page) and no model reads it
  const first = source.config.digest === false ? 'skip' : 'new'
  const put = db.prepare(`insert into items (id, beat, source_id, key, url, title, text, author, published, fetched, seen, hash, raw, digest, image, lat, lon, place, category) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    on conflict (id) do update set seen = excluded.seen, gone_at = null, image = excluded.image, lat = excluded.lat, lon = excluded.lon, place = excluded.place, category = excluded.category,
      digest = case when items.hash <> excluded.hash and items.digest <> 'skip' then 'new' else items.digest end,
      title = excluded.title, text = excluded.text, url = excluded.url, raw = excluded.raw, hash = excluded.hash`)
  let fresh = 0; const t = now(), ids = []
  for (const it of list) {
    const id = sha(`${source.id}|${it.key}`).slice(0, 20), hash = sha(`${it.title || ''}\n${it.text || ''}`)
    if (!db.prepare('select 1 from items where id = ?').get(id)) fresh++
    put.run(id, source.beat, source.id, String(it.key), it.url || null, it.title || null, it.text || '', it.author || null, it.published || null, t, t, hash, J(it.raw ?? null), first, it.image || null, Number.isFinite(it.lat) ? it.lat : null, Number.isFinite(it.lon) ? it.lon : null, it.place || null, it.category || source.config.category || null); ids.push(id)
  }
  if (ids.length && source.config.lists_all) db.prepare(`update items set gone_at = ? where source_id = ? and gone_at is null and seen < ?`).run(t, source.id, t)
  return fresh
}
const item = (r) => r && { ...r, topics: P(r.topics, []), raw: undefined }
// Unread items, newest first, leaving out any a helper holds a lease on. `heldFor` leaves the newest
// alone for that many seconds after they were fetched, so helpers get the first chance at them.
export const itemsToDigest = (beat, n, heldFor = 0) => db.prepare(`select * from items where beat = ? and digest = 'new' and coalesce(lease_until, 0) < ? and fetched <= ? order by published desc limit ?`).all(beat, now(), now() - heldFor, n).map(item)
/// A helper takes up to n unread items of any beat for `seconds`; if it does not come back, they are anyone's again.
export function claimItems(n, who, seconds = 900) {
  const rows = db.prepare(`select * from items where digest = 'new' and coalesce(lease_until, 0) < ? order by published desc limit ?`).all(now(), n)
  for (const r of rows) db.prepare('update items set lease_until = ?, lease_by = ? where id = ?').run(now() + seconds, who, r.id)
  return rows.map(item)
}
export const itemById = (id) => item(db.prepare('select * from items where id = ?').get(id))
export const waiting = () => db.prepare(`select count(*) n from items where digest = 'new'`).get().n
export function digested(id, { state, tier = null, relevant = null, summary = null, topics = null, facts = [] }) {
  db.prepare(`update items set lease_until = null, digest = ?, digest_tier = ?, relevant = ?, summary = ?, topics = ? where id = ?`).run(state, tier, relevant == null ? null : relevant ? 1 : 0, summary, J(topics), id)
  db.prepare('delete from facts where item_id = ?').run(id)
  const it = db.prepare('select beat from items where id = ?').get(id)
  facts.forEach((f, i) => db.prepare(`insert into facts (id, item_id, beat, kind, claim, when_text, at, where_text, who, quantity, quote) values (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(`${id}.${i}`, id, it.beat, f.kind || null, f.claim, f.when_text || null, f.at || null, f.where_text || null, J(f.who || []), f.quantity || null, f.quote || null))
}
export const items = (beat, { since = 0, limit = 100, relevant = null, kind = null, category = null } = {}) =>
  db.prepare(`select i.id, i.url, i.title, substr(i.text, 1, 280) as excerpt, i.author, i.published, i.fetched, i.gone_at, i.image, i.lat, i.lon, i.place, i.place_how, i.category, i.digest, i.digest_tier, i.relevant, i.summary, i.topics, s.name as source, s.kind as source_kind
    from items i join sources s on s.id = i.source_id where i.beat = ? and coalesce(i.published, i.fetched) >= ? and (? is null or i.relevant = ?) and (? is null or s.kind = ?) and (? is null or i.category = ?) order by coalesce(i.published, i.fetched) desc limit ?`).all(beat, since, relevant, relevant, kind, kind, category, category, limit).map(item).map((i) => ({ ...i, places: db.prepare('select name, lat, lon, how from item_places where item_id = ?').all(i.id) }))

// ---- facts and places
const fact = (r) => r && { ...r, who: P(r.who, []) }
export const factsToLocate = (beat, n) => db.prepare(`select * from facts where beat = ? and locate = 'new' limit ?`).all(beat, n).map(fact)
export const located = (id, { lat = null, lon = null, place = null, how }) => db.prepare(`update facts set locate = 'done', lat = ?, lon = ?, place = ?, place_how = ? where id = ?`).run(lat, lon, place, how, id)
export const facts = (beat, { since = 0, limit = 500 } = {}) =>
  db.prepare(`select f.id, f.kind, f.claim, f.when_text, f.at, f.where_text, f.who, f.quantity, f.quote, f.lat, f.lon, f.place, f.place_how, i.url, i.title, i.published, s.name as source
    from facts f join items i on i.id = f.item_id join sources s on s.id = i.source_id where f.beat = ? and coalesce(f.at, i.published, i.fetched) >= ? order by coalesce(f.at, i.published, i.fetched) desc limit ?`).all(beat, since, limit).map(fact)
export function savePlaces(beat, list) { const q = db.prepare('insert or replace into places (beat, norm, name, kind, lat, lon) values (?,?,?,?,?,?)'); for (const p of list) q.run(beat, p.norm, p.name, p.kind, p.lat, p.lon) }
// items waiting to be placed: not ones still waiting to be read (their facts may name the place)
export const itemsToLocate = (beat, n) => db.prepare(`select id, title, text, digest, place, lat, lon, place_how from items where beat = ? and coalesce(locate, 'new') = 'new' and digest <> 'new' limit ?`).all(beat, n)
export const itemLocated = (id, { lat = null, lon = null, place = null, how }) => how === 'source' ? db.prepare(`update items set locate = 'done', place_how = 'source' where id = ?`).run(id) : db.prepare(`update items set locate = 'done', lat = ?, lon = ?, place = coalesce(?, place), place_how = ? where id = ?`).run(lat, lon, place, how, id)
export const bestFactPoint = (itemId) => db.prepare(`select lat, lon, place from facts where item_id = ? and lat is not null limit 1`).get(itemId)
export const places = (beat) => db.prepare('select * from places where beat = ?').all(beat)

// ---- the name server: the world's place names (GeoNames), loaded a country at a time
export const namesLoaded = () => db.prepare('select country, at, rows from names_loaded order by country').all()
export function saveNames(country, rows) { const q = db.prepare('insert or replace into names (id, name, norm, alts, lat, lon, class, code, country, pop) values (?,?,?,?,?,?,?,?,?,?)'); db.exec('begin'); try { for (const r of rows) q.run(r.id, r.name, r.norm, r.alts, r.lat, r.lon, r.class, r.code, country, r.pop); db.exec('commit') } catch (e) { db.exec('rollback'); throw e } }
export const namesDone = (country, rows) => db.prepare('insert or replace into names_loaded (country, at, rows) values (?,?,?)').run(country, now(), rows)
export const namesIn = ([s, w, n, e]) => db.prepare('select name, alts, lat, lon, class, code, pop from names where lat between ? and ? and lon between ? and ?').all(s, n, w, e)
export const namesLike = (norm, limit = 20) => db.prepare('select name, lat, lon, class, code, country, pop from names where norm = ? order by pop desc limit ?').all(norm, limit)
export const kv = (k, v) => v === undefined ? db.prepare('select v from kv where k = ?').get(k)?.v ?? null : db.prepare('insert or replace into kv (k, v) values (?,?)').run(k, String(v))
/// When a beat's names change (a country finished loading, the local names arrived), what found no place is looked for again.
export function lookAgain(beat) { db.prepare(`update facts set locate = 'new' where beat = ? and place_how = 'none'`).run(beat); db.prepare(`update items set locate = 'new' where beat = ?`).run(beat) }
// every place an item names, not only its first
export function setItemPlaces(itemId, beat, list) { db.prepare('delete from item_places where item_id = ?').run(itemId); const q = db.prepare('insert or ignore into item_places (item_id, beat, name, lat, lon, how) values (?,?,?,?,?,?)'); for (const p of list) q.run(itemId, beat, p.name, p.lat, p.lon, p.how) }
export const factPoints = (itemId) => db.prepare('select place as name, lat, lon from facts where item_id = ? and lat is not null').all(itemId)

// ---- issues
export function saveIssues(beat, list, tier) {
  db.prepare('delete from issues where beat = ?').run(beat)
  for (const x of list) db.prepare('insert into issues (id, beat, title, summary, facts, first_at, last_at, made, tier) values (?,?,?,?,?,?,?,?,?)').run(sha(beat + x.title).slice(0, 12), beat, x.title, x.summary, J(x.facts), x.first_at || null, x.last_at || null, now(), tier)
}
export const issues = (beat) => db.prepare('select * from issues where beat = ? order by last_at desc').all(beat).map((r) => ({ ...r, facts: P(r.facts, []) }))

// ---- spend and counts
export function spent(tier) { const day = new Date().toISOString().slice(0, 10); db.prepare('insert into spend (day, tier, calls) values (?,?,1) on conflict (day, tier) do update set calls = calls + 1').run(day, tier); }
export const spentToday = (tier) => db.prepare('select calls from spend where day = ? and tier = ?').get(new Date().toISOString().slice(0, 10), tier)?.calls || 0
export const counts = (beat) => ({
  sources: db.prepare('select count(*) n from sources where beat = ?').get(beat).n,
  items: db.prepare('select count(*) n from items where beat = ?').get(beat).n,
  undigested: db.prepare(`select count(*) n from items where beat = ? and digest = 'new'`).get(beat).n,
  items_on_the_map: db.prepare('select count(*) n from items where beat = ? and lat is not null').get(beat).n,
  waiting: { to_be_read: db.prepare(`select count(*) n from items where beat = ? and digest = 'new'`).get(beat).n, facts_to_be_placed: db.prepare(`select count(*) n from facts where beat = ? and locate = 'new'`).get(beat).n, items_to_be_placed: db.prepare(`select count(*) n from items where beat = ? and coalesce(locate, 'new') = 'new' and digest <> 'new'`).get(beat).n },
  kept_as_is: db.prepare(`select count(*) n from items where beat = ? and digest = 'skip'`).get(beat).n,
  relevant: db.prepare('select count(*) n from items where beat = ? and relevant = 1').get(beat).n,
  facts: db.prepare('select count(*) n from facts where beat = ?').get(beat).n,
  located: db.prepare('select count(*) n from facts where beat = ? and lat is not null').get(beat).n,
  places: db.prepare('select count(*) n from places where beat = ?').get(beat).n,
  issues: db.prepare('select count(*) n from issues where beat = ?').get(beat).n,
})
