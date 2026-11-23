# Chores

Open work, one line each; the thinking is in `devlog/`.

## Sources
- [ ] City pages with no feed: sausalito.gov news, council agendas and staff reports (a `page` kind: fetch, find the dated entries, follow them).
- [ ] Calendars (iCal), YouTube channel feeds (council meetings), podcasts and radio that publish a feed.
- [ ] Mastodon and Bluesky tag feeds; Reddit (it refuses data-centre addresses, by the Salt Spring notes).
- [ ] Follow a headline to its article: Google News gives only a title, so its facts are thin.
- [ ] A probe that turns a name or address into a source definition, and a `candidate` state for sources a person suggested (matchmaker has both).

## Places and subjects (Anselm's questions, 23 November; `devlog/20261123-places-subjects-and-the-world.md`)
- [x] Its own name server on GeoNames, loaded a country at a time by the loop, used as it arrives (23 November).
- [x] Every place an item names is kept (`item_places`), not one point (23 November).
- [ ] Two names for one thing come back as two places ("Smelt Bay" and "Smelt Bay Provincial Park"); keep the longer where one contains the other and they are close.
- [ ] A plain word that is also a place's name still matches; nothing weighs how likely a name is to be meant.
- [ ] Streets without OpenStreetMap: its servers refused both islands for a day. A country extract read on the machine would end that.
- [ ] Mentions as the digest's by-product: the organisations, offices and things named, typed, as written. Identity and relations stay with the ontology project.
- [ ] A small fixed list of topics in place of free words.

## Passes
- [ ] The same story from several outlets is digested several times. Group by title likeness before the digest and read one.
- [ ] Dates: a fact's date is the model's reading of "Tuesday"; check it against the item's date and flag the far ones.
- [ ] Locate: street numbers and intersections; a fallback geocoder for names OpenStreetMap lacks; say how many facts found no place.
- [ ] Issues: keep an issue's identity between readings, so its history can be followed.
- [ ] Measure the local model against a stronger one on a hand-read sample before trusting recall. Not done.

## Service
- [x] Deployed at https://inhaler.exe.xyz/ with a nightly backup and phone alerts (22 November).
- [x] Who reads on the VM: OpenRouter, `anthropic/claude-haiku-5.5`, 300 calls a day at most (22 November).
- [ ] Watch what it spends for a week and write the number down. Not measured yet.
- [x] Helpers: `POST /work/claim` and `/work/done` with a key, a lease on each claimed item, `inhale help <address>` (22 November). canada1's key is in `~/.config/inhaler/help-key`. No helper is left running.
- [ ] The inhaler's own loop takes no lease, so two loops on one database would both read an item.
- [ ] A write side on the API with a key, for adding beats without a deploy.
- [ ] Noted, not urgent (Anselm, 22 November): the backup shares esimv1's bucket and credential, which is fine; the ntfy topic is guessable, to be fixed if abused; **the read API is open to anyone, which may be a risk** (it gives links, excerpts and its own sentences; a key or a list of allowed origins would close it).

## Taking over the other aggregators (`devlog/20261122-one-inhaler.md`)
Not yet. Anselm, 22 November: "lets not change matchmaker or other projects yet - the inhaler will have to prove itself first". The first item below is this project's own and can go ahead.
- [ ] A lens per client: the digest as a named, pluggable reading with its own table.
- [ ] Matchmaker's source kinds, probe and 161 sources come here; then matchmaker reads from here.
- [x] The ontology project's active feeds are the `world` beat, collected and read by no model (23 November). It still fetches for itself.
- [ ] ReliefWeb answers 406 to this reader and is left out; BBC and the New York Times are left out as the ontology project left them, for their terms; its three paused feeds are left out.
- [x] Cortes and Salt Spring are beats, with the island projects' source kinds (23 November). The island sites still fetch for themselves.
- [ ] Per item for the island sites: an importance and a category for news, as their pages use; a read of how many items their pages need that are not here.
- [ ] Radio: the stations are named, nothing is read. A transcript of a local news broadcast would be a source.
- [ ] The ontology project fetches each article's page; here an item is what the feed gave. A full-text pass (mark, sweep) before the digest.
- [ ] Import what each already holds before its fetcher is switched off. Decide `saltspring-ontology`.
- [ ] The world's dated future events (esimv1's `future-known.toml`) as a beat, once each row has a source.

## For esimv1
- [x] The Sausalito page reads `/beats/sausalito/issues` and `/facts` (https://sausalito.exe.xyz/, 22 November).
- [ ] A module that puts a beat's located facts on a scenario's timeline.
