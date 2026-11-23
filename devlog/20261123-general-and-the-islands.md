# General wording, the islands' sources, and the passes said plainly

23 November 2026. Claude (Fable 5.2). Anselm asked for two things and clarified a third:

> also fetch the same sources that cortes, saltspring and ssontology were fetching - so
> that at some point those other services can avoid fetching content themselves and
> instead proxy via the inhaler.

> generalize the language; the inhaler home page focuses on sausalito - it is a general
> purpose news and media inhaler as a service, currently focusing on a few specific regions.

> the inhaler presumably does _some_ analysis - such as geolocation. right now the
> ontology monster does its own analysis for topic discovery and categorization - and i
> feel like it will continue to do so - but the raw fetching of content will eventually
> move to the inhaler - the inhaler will consolidate data collection and some simple
> analysis. note we want a multi pass mark and sweep approach where we first ingest and
> then separately do other chores like geolocate - do we have that?

## The islands

`beats/cortes.json` and `beats/saltspring.json` carry what `saltspring/places/*.json` and
`cortes/server/sources/rss.js` name: the local papers' feeds, the regional papers read
through a pattern for the island's name, Google News for the quoted name, Mastodon tags,
Flickr tags, iNaturalist observations in the island's box, Wikimedia Commons and Openverse
photographs, and Wikipedia articles nearby. The Salt Spring ontology's one feed, the Gulf
Islands Driftwood, is in the Salt Spring beat. Six source kinds were added for this
(`lib/sources/ambient.mjs`).

First fetch, on canada1: Cortes 206 items from 11 sources in 13 seconds, Salt Spring 298
from 12 in 33 seconds. Three sources did not answer: Cortes Currents (403; the island
project's notes say it "Cloudflare-blocks some networks"), Salt Spring Exchange (500) and
Openverse for Salt Spring (504). They are asked again later and later, as designed.

What the island sites do that this does not, so they cannot yet read from here alone:
their pages rank an item by an importance and a category that their own code and a model
assign; they place unplaced items by a hand-made list of island places; they read Reddit
(left out here: it refuses data-centre addresses); they play the island's radio (named
here, not read).

## Kept as it came

A photograph or a sighting is not news and no model should be paid to read it. A source
may now say `"digest": false`: its items are kept as fetched, with picture and point, and
are marked so the digest never takes them. An item also carries `image`, `lat`, `lon`,
`place` and `category` when its source gave them, and `/items` returns them and can be
asked by `kind` or `category`.

## Mark and sweep

Yes, and it is now said in so many words in the README. Fetching only marks: an item
arrives as `digest = new`, `locate = new`. The digest sweeps the first mark, the locate
pass the second (for facts, and since today for items too), and the daily issues pass
reads what the others left. A pass that cannot run leaves its marks. Two cases were met
for real: no model, where the digest stops and leaves every item; and today, OpenStreetMap
refusing the gazetteer for Salt Spring, where the locate pass first crashed the round and
now leaves its rows waiting and tries the gazetteer again in an hour.

The new sweep for items is the "simple analysis" every client can use without a model: an
item gets the point its source gave, else a point one of its facts was given, else its
place or title looked up in the gazetteer. On Cortes: 78 by the source's own point, 18 by
a name in the title, 52 with none. A name in a title can be the wrong thing of that name;
how each was placed is kept beside it.

What is still one column per chore: a third chore means a third column. That is honest
for two chores and wants a small table of marks when there are four.

## The wording

The home page is now about the service: what it is, the passes, a table of the places it
follows with their counts, how to ask it. Each place has its own page at `/place/<id>`
with its issues and its sources' health. The README and the package description say the
same.
