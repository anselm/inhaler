# Places, subjects and the world's feeds: four questions

23 November 2026. Claude (Fable 5.2). Anselm asked four things; the answers as given, so
they are on disk.

**1. Our own place-name lookup.** The lookup is already ours: a name is matched against
a table in the store. What is not ours is how the table is filled, once per beat, by one
question to an OpenStreetMap server (Overpass), and those servers refused Salt Spring and
Cortes on the day they were added. The remedy is a base gazetteer loaded once from a file:
GeoNames publishes one for the world (about twelve million names; Creative Commons
Attribution; a download of a few hundred megabytes, recalled and not checked today). It
has towns, neighbourhoods, hills, bays, parks. It does not have streets or buildings, so
OpenStreetMap's local names stay as a second layer, fetched when its servers answer. With
the base in place a new beat can be placed at once and offline. About half a day's work.
Not built.

**2. How a place is found in a text.** Two ways, neither segmenting the document. For a
news item, the model that reads it returns each fact with the place "as the text names
it", so a post about three places gives three facts with three places, and each is looked
up on its own. For an item no model reads (a photograph, a Mastodon post), only its title
and its source's own place field are searched for gazetteer names; its body is not. And
an item carries one point, the first that was found, however many places it names. That
last is a real limit: an item should carry all its places.

**3. Taking on some of the ontology project's work.** Some, up to a line. The digest
already returns who acted (organisations and offices) and a few topic words. It would
cost nothing more to keep those as mentions: the names as written, with a type. That is
what a text says. What the ontology project does past that is decide what exists: that
two names are one body, what kind of thing it is, how things relate, and what new kinds
the news implies. Its own notes call identity "the deepest flaw" of its first attempt. I
would keep that work there and have the inhaler hand it mentions as well as raw items, so
it starts further along.

**4. Where the ontology project reads, and whether to add it.** Its list is 21 feeds of
world news, science and institutions: 15 active, 3 paused, 3 under review for their terms.
They are added today as a beat called `world`, a subject and not a place, collected and
read by no model, so they cost nothing but storage. Fourteen answer. ReliefWeb refuses
this reader (406) and is left out; the two under review for terms are left out as that
project left them. Three of the feeds are in an older format (RSS 1.0) and one is long
enough to trip the parser's guard; the feed reader was fixed for both. First fetch: 290
items in two seconds.

## Later the same day: the name server and several places per item, built

Anselm: "add our own place name server using geonames - i would incrementally attempt to
fetch this and then use it when ready - in that way the live container can leverage it
when loaded", and "allow multiple places per post".

**The name server.** `lib/names.mjs`. GeoNames publishes a file per country; the loop
fetches one missing country each round, for the countries the beats name, reads it as a
stream and writes it in small batches so its own rounds are not held up. On canada1 the
United States (2,241,461 names) and Canada loaded in 32 seconds together; the database
grew to 362 MB. The licence was read today on GeoNames' own readme: Creative Commons
Attribution 4.0. `/names?q=Ganges` asks it directly.

The locate pass no longer waits for anything. It takes the names inside the beat's box
from the name server, lays OpenStreetMap's local names over them when those have arrived,
and works. When the count of names for a beat changes, every fact that found no place and
every item is looked at again. Salt Spring, which OpenStreetMap had refused for a day,
went from no names to 377 and from no items placed by name to 23 of 140.

**Several places per item.** A table of an item's places: the points of its facts, and,
for an item no model read, every known name found in its title and text. `/items` returns
them as `places`. The item's own point stays its source's, else the first found. On Cortes
55 of 206 items name a place and 13 name more than one.

Wrong in ways seen in the first output: a thing and its park come back as two places
("Smelt Bay" and "Smelt Bay Provincial Park"); a plain word that is also a place's name
matches; GeoNames has no streets, so Sausalito's street-level facts still rest on
OpenStreetMap having answered once.

## A wrong statement on a public page, and what it showed

Anselm asked what the inhaler says is going on in Sausalito. Reading its issues back, one
said "Sausalito voters approved Measure X". The measure was defeated: three facts in the
store said so. Two facts said approved. Both came from articles written before the vote
("Voters decide who will rule the waterfront"), where the small local model guessed an
outcome; one had no supporting words and one had words that did not support it. The
issues reading, by the same small model, took the wrong pair. That summary had been on
https://sausalito.exe.xyz/ for most of a day.

Changed: the issues reading takes only facts whose supporting words were found in the
source, and is told that facts can disagree, to go by the later and the more numerous,
to say when sources differ, and not to name private people. Read again with the hosted
model (one call past the day's cap of 300, which the islands' first reading had used
up), the issue now says the sources differ and that later coverage points to defeat.

Not fixed: the two wrong facts are still in the store. Words being found in the source
does not mean they support the claim. Nothing notices that two facts contradict each
other. And the first reading of a place by the small local model is not to be trusted
for outcomes; this is the measurement that was listed as not done.

The same reading surfaced a report of a former official's arrest. It is news and the
inhaler keeps it. The Sausalito page now leaves such reports out of its panel.

## 24 November: headlines

Anselm, of the Sausalito page's news marks: "it is ok to have longer headlines, definitely don't cut mid
sentence ... the inhaler should summarize for us yes. feels like it is a good job for it as part of a
simple analytics role." Each fact now carries a `headline` of four to nine words beside its claim. The
digest asks for it with the claim, so new facts cost nothing more; a fifth pass, `headlines`, writes one
for every fact that has none, 12 claims to a call, and runs in the loop. (25 to a call came back empty from the hosted model: its reasoning used the whole output limit, which is now 8,000 tokens.) The model sees only the claim, so
a headline can lose a qualifier but cannot bring in something from elsewhere; nothing checks that it
kept the claim's meaning. First local run (gpt-oss:20b): 41 of 100 kept, the rest answered too long or
not at all and wait for the next round.
