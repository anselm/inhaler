# Chores

Open work, one line each; the thinking is in `devlog/`.

## Sources
- [ ] City pages with no feed: sausalito.gov news, council agendas and staff reports (a `page` kind: fetch, find the dated entries, follow them).
- [ ] Calendars (iCal), YouTube channel feeds (council meetings), podcasts and radio that publish a feed.
- [ ] Mastodon and Bluesky tag feeds; Reddit (it refuses data-centre addresses, by the Salt Spring notes).
- [ ] Follow a headline to its article: Google News gives only a title, so its facts are thin.
- [ ] A probe that turns a name or address into a source definition, and a `candidate` state for sources a person suggested (matchmaker has both).

## Passes
- [ ] The same story from several outlets is digested several times. Group by title likeness before the digest and read one.
- [ ] Dates: a fact's date is the model's reading of "Tuesday"; check it against the item's date and flag the far ones.
- [ ] Locate: street numbers and intersections; a fallback geocoder for names OpenStreetMap lacks; say how many facts found no place.
- [ ] Issues: keep an issue's identity between readings, so its history can be followed.
- [ ] Measure the local model against a stronger one on a hand-read sample before trusting recall. Not done.

## Service
- [x] Deployed at https://inhaler.exe.xyz/ with a nightly backup and phone alerts (22 November).
- [ ] **Who reads on the VM** (Anselm to choose): a small hosted model with its own key and a daily cap, a worker on canada1 that posts results back, or both. Until then the VM only fetches.
- [ ] A write side on the API with a key, for a remote reader and for adding beats.
- [ ] A lease on each claimed row, so two workers can run.
- [ ] Its own bucket and credential for backups; a private ntfy topic.

## Taking over the other aggregators (`devlog/20261122-one-inhaler.md`)
- [ ] A lens per client: the digest as a named, pluggable reading with its own table.
- [ ] Matchmaker's source kinds, probe and 161 sources come here; then matchmaker reads from here.
- [ ] The ontology project's 21 feeds become a beat; it reads from here.
- [ ] Cortes and Salt Spring become beats; their extra source kinds come here.
- [ ] Import what each already holds before its fetcher is switched off. Decide `saltspring-ontology`.
- [ ] The world's dated future events (esimv1's `future-known.toml`) as a beat, once each row has a source.

## For esimv1
- [ ] The Sausalito page reading `/beats/sausalito/issues` and facts for the period on screen.
- [ ] A module that puts a beat's located facts on a scenario's timeline.
