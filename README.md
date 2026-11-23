# inhaler

A general reader of public news and media, as a service. It collects what is published
about the places it follows (local papers, official notices, weather alerts, public posts,
photographs, wildlife sightings, reference pages) and does the simple analysis on it:
which items concern the place, what each reports, the facts it states with their dates,
and where on a map they belong.

It exists so that programs which need this do not each fetch for themselves. A page that
shows what a town is talking about, a simulation that wants reported events on its
timeline, an island site that wants photographs and sightings, an ontology builder that
wants articles to read: each asks the inhaler and keeps its own, deeper analysis.

It does not present anything beyond a plain status page. It runs at
https://inhaler.exe.xyz/ and follows three places so far: Sausalito in California, and
Cortes Island and Salt Spring Island in British Columbia. It began on 22 November 2026
(for its first hours it was `esimv1-social`, the news layer for one simulation). `devlog/`
says what it rests on and what it gets wrong.

## How it works

A **beat** is what the inhaler follows: a place with a box around it, a sentence saying
what counts as being about it, and a list of sources. `beats/sausalito.json` is one.

Work is done in passes, in the manner of mark and sweep. Collecting only marks: an item
arrives marked as unread and unplaced. Each later pass sweeps the rows that carry its
mark, does one thing, and clears the mark. So a pass can stop anywhere and pick up later,
a pass that cannot run (no model, no map server) leaves its rows waiting, nothing is done
twice, and a new kind of chore is a new mark and a new sweep.

| pass | sweeps | does | uses |
|---|---|---|---|
| fetch | sources that are due | asks each and keeps what it lists, as it came | no model |
| digest | news items not yet read | does it concern the place, one sentence, the facts it states | a language model |
| locate | facts, then items, not yet placed | puts each on the map from the place names in it; an item keeps every place it names | its own name server, no model |
| issues | a place's recent facts, daily | names what the place is dealing with | a language model |

Place names are the service's own. It keeps a copy of GeoNames (geonames.org, CC BY 4.0),
fetched a country at a time in the background for the countries its beats name, and looks
names up there with no outside call. GeoNames has no streets, so a beat's local names are
also asked of OpenStreetMap once, when its servers answer. When more names arrive,
everything that found no place is looked for again. `/names?q=Ganges` asks it directly.

Reading is the costly pass, and other machines may help with it: one with a model and a
key takes unread items, reads them and posts its readings back, which are checked like
the inhaler's own (`inhale help <address>`).

Source kinds so far: RSS and Atom feeds (with an optional pattern, to read a regional
paper for one place), Google News search, an account's posts on X (through the FixTweet
API, which needs no key), US National Weather Service alerts, Mastodon tags, iNaturalist
observations, Flickr tags, Wikimedia Commons and Openverse photographs, and Wikipedia
articles near a point. A kind is one small function in `lib/sources/`. A source marked
`"digest": false` in its beat file (a photograph, a sighting) is kept as it came and read
by no model.

## Run it

Node 22.5 or newer. One dependency (an XML parser). The database is one SQLite file in `data/`.

```
npm install
node bin/inhale.mjs beats                    # the places this copy follows
node bin/inhale.mjs run sausalito            # one round of all four passes
node bin/inhale.mjs status sausalito         # counts, and each source's health
node bin/inhale.mjs export sausalito facts   # JSON lines
node bin/inhale.mjs serve                    # the read API on http://127.0.0.1:5191/beats
node bin/inhale.mjs loop                     # fetch, digest and locate every place, every 15 minutes
```

The model is chosen by `INHALE_TIERS`, a list tried in order: `ollama:<model>` for a model
on the same machine, `openrouter:<model>` or `anthropic:<model>` for one reached with a
key. With nothing set it uses `ollama:gpt-oss:20b`. A paid tier stops for the day at
`INHALE_BUDGET` calls. Every digested item records which model read it.

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
