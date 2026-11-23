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
