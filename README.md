# inhaler

It reads what is published about a place (local news, official notices, weather
alerts, public posts) and digests it into facts: what a source said happened, was decided,
was proposed or was measured, with the date, the place on a map where the source named
one, and a link back to the source.

It does not present anything. It is the layer other programs ask: a page that wants to
show what a town is talking about, a language model looking for questions worth
simulating, a scenario that wants reported events on its timeline.

It began on 22 November 2026 as `esimv1-social`, the news layer for one simulation, and was
renamed the same day when it was plain that it belongs to no one project. It is meant to be
the one reader for several: a simulator, a jobs matcher, an ontology builder, two island
sites. So far it is a first version that has read one place, Sausalito, California. `devlog/` says what it rests on and what it gets wrong.

## How it works

A **beat** is what the inhaler follows: a place with a box around it, a sentence saying
what counts as being about it, and a list of sources. `beats/sausalito.json` is one.

Work is done in passes. Each pass does one thing and records on each row that it has
done it, so a pass can stop anywhere and pick up later, and nothing is read by a model
twice.

| pass | does | uses |
|---|---|---|
| fetch | asks each source that is due and keeps what it lists | no model |
| digest | per item: does it concern the place, one sentence, the facts it states | a language model |
| locate | puts each fact on the map from the place its source named | OpenStreetMap names, no model |
| issues | reads the recent facts together and names what the place is dealing with | a language model |

Source kinds so far: RSS and Atom feeds, Google News search, an account's posts on X
(through the FixTweet API, which needs no key), and US National Weather Service alerts.
A kind is one small file in `lib/sources/`.

## Run it

Node 22.5 or newer. One dependency (an XML parser). The database is one SQLite file in `data/`.

```
npm install
node bin/inhale.mjs run sausalito            # one round of all four passes
node bin/inhale.mjs status sausalito         # counts, and each source's health
node bin/inhale.mjs export sausalito facts   # JSON lines
node bin/inhale.mjs serve                    # the read API on http://127.0.0.1:5191/beats
node bin/inhale.mjs loop sausalito           # fetch, digest and locate every 15 minutes
```

The model is chosen by `INHALE_TIERS`, a list tried in order: `ollama:<model>` for a model
on the same machine, `openrouter:<model>` or `anthropic:<model>` for one reached with a
key. With nothing set it uses `ollama:gpt-oss:20b`. A paid tier stops for the day at
`INHALE_BUDGET` calls. Every digested item records which model read it.

It runs at https://inhaler.exe.xyz/ (try `/beats`), where it reads Sausalito every fifteen
minutes with a small hosted model.

## What it is careful about

- **Manners.** One request at a time per host with a gap between, a time limit, an honest
  user-agent, conditional requests so an unchanged feed costs its publisher almost
  nothing, and a failing source asked again later and later, up to a day.
- **What a fact is.** "This source said this." Nothing here checks that it is true. The
  words a fact quotes must be found in the source's text or they are dropped.
- **Other people's writing.** The full text is kept only to be read by the passes. What
  the read API gives out is the link, a short excerpt and the inhaler's own sentence.
- **People.** The digest names organisations and holders of public office, and is told
  not to name private individuals.
- **Places.** A fact is put at a point only when its source named a place the gazetteer
  knows. A fact about the town in general has no point. Nothing is scattered or guessed.

Free and open source, MIT. The items it reads belong to their publishers.
