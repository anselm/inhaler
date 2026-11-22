# One inhaler: renamed, deployed, and what it is to take over

22 November 2026. Claude (Fable 5.2). Anselm, after seeing the first run:

> since esimv1-social is independent of the rest of esimv1 i would argue we just treat it
> as a separate service named something like inhaler - unrelated to esimv1, and i would
> also argue that it should eat up the jobs that matchmaker, ontology, cortes, saltspring
> do - and we should retire ssontology or it can use this too - but there's no point in
> having many aggregators. matchmaker and ontology do have some specializations -
> matchmaker continues to dissect jobs, and i think ontology can continue to try to
> extract meaning, but it should rely on this inhaler for fuel. that means the error
> reporting i am seeing coming out of matchmaker recently via nfty would end up being
> reported by the inhaler instead. i think this inhaler will continue to grow.

He also said: the data must not live in the repository; a database on an exe.dev VM is
acceptable for now and Mongo Atlas later if needed; he does not want to spend much yet;
nothing matchmaker and the ontology project have already gathered is to be thrown away;
services must not run durably on canada1 ("we basically have to think of this as a
durable appliance that we can rely on"); and "the future does have news".

## Done today

- **Renamed.** The repository is `anselm/inhaler` and the folder `~/projects/2027/inhaler`.
- **Deployed.** https://inhaler.exe.xyz/ (exe.dev VM `inhaler`). Three units:
  `inhaler-loop` asks every due source of every beat each fifteen minutes;
  `inhaler-api` is the read API, public and read-only; `inhaler-backup.timer` runs nightly.
  `deploy/deploy.sh` puts the code there and never overwrites the VM's database. Today's
  database from canada1 was copied up once, so the first run's facts and issues are there.
- **Backed up.** The database is copied whole to the Cloudflare R2 bucket each night
  (`inhaler/inhale-<weekday>.db.gz` and `inhale-latest.db.gz`): a week of days. Run once by
  hand on the VM: 122 KB. It shares the `esimv1` bucket for now because the credential
  Anselm made is for that bucket only.
- **Alerts.** A source that fails three times running, a pass that can ask no model, a
  round that throws and a backup that fails each send one push over ntfy, and not again
  for six hours. The address is in the VM's `/srv/inhaler/env`, not in the repository.
- **Data is not in the repository** and never was: `data/` is ignored by git.

## Not done: who reads on the VM

The VM has no model. The digest ran on canada1's local model, which costs nothing and is
not a durable appliance. On the VM the loop is set to fetch only (`INHALE_PASSES=fetch`),
so collecting is durable from today and nothing is lost; items wait undigested. Three
ways to read them, for Anselm to choose:

1. A small hosted model on the VM. By the ontology project's own measurements a document
   costs about a fifth of a cent on the cheapest tier that held up. At this beat's rate
   (161 items for a first fetch, tens a day after) that is cents a day, capped by
   `INHALE_BUDGET`. It needs a key with credit that is this service's own, so its spending
   is not hidden inside another project's, which is what went wrong before.
2. canada1 reads when it is up: a worker there asks the VM for unread items, reads them
   with the local model and posts the results back. Free. It needs a write side on the
   API with a key, which is not built.
3. Both: the local worker first, the hosted model for what has waited more than a day.

## Storage

SQLite in one file on the VM, backed up nightly, is enough for now: the whole first run
is 122 KB compressed. It stops being enough when two machines must write at once or when
the file outgrows a small VM's disk. Moving then is contained, because every query is in
`lib/store.mjs`. Mongo Atlas is one candidate; so is Postgres. I would not choose until
matchmaker's data is being brought in, since its size decides it. I did not look at how
much matchmaker and the ontology project hold or whether they are backed up, beyond a
note in the harness's memory that matchmaker's VM has a nightly Mongo backup run from
canada1.

## Taking over the others' fetching

Nothing in the other four projects was touched; they belong to their rooms. The order I
would do it in, each step leaving every service working:

1. **A lens per client.** Today the digest is one pass with one reading (facts about a
   place). Make it a named lens with its own table, so a second reading can be added
   without disturbing the first.
2. **Matchmaker's source kinds come here**: `ats`, `workday`, `usajobs`, `neogov`,
   `jsonld`, `page` and the rest, as files in `lib/sources/`, and its 161 configured
   sources as a beat. Its probe and its candidate sources come too. This is the largest
   single piece of work and is mostly moving tested code.
3. **Matchmaker reads from here.** Its own aggregator is switched off and its analysis
   takes raw items from this service's API. From that day the alerts about failing sources
   come from the inhaler.
4. **The ontology project the same**: its 21 feeds become a beat; its extraction keeps
   running on items it takes from here.
5. **Cortes and Salt Spring**: each place file becomes a beat; the island pages read
   items from here. Their extra sources (iNaturalist, Wikipedia, Flickr, Mastodon) become
   source kinds.
6. **What they already hold is imported, not dropped**: each project's raw items are
   loaded into this store with their original ids and dates, marked as imported, before
   its fetcher is switched off. `saltspring-ontology` is retired or pointed here; that is
   Anselm's call.

Each of steps 3 to 6 changes another room's project and wants that room, or his word.

## The future has news

Anselm: "the future does have news. esimv1 i think has a list of known news events about
the future. should that move to the inhaler?"

Partly. The inhaler already holds news of the future without being asked: 106 of the
first run's 128 facts carry a date, and some of those dates are ahead (a contract going
to a school board early in 2027, ferry changes for Thanksgiving week). A scheduled thing
a source has announced is a fact with a later date, and a page showing a period ahead can
ask for it the same way as for a period past.

esimv1's two lists are different in kind. `future-known.toml` is 24 dated events of the
world (eclipses, treaty deadlines, elections), written from memory and not yet checked:
that is a beat's worth of sourced, dated facts and belongs here, once each row has a
source to be fetched from. `future-speculative.toml` is 17 things that might happen, with
a chance per year and an effect on the model: that is a modelling input, not news, and
stays with the engine.

## Known wrongs added today

- The read API is public. It gives links, excerpts and the inhaler's own sentences, not
  full texts, but it does give them to anyone.
- The backup shares another project's bucket and credential.
- The ntfy topic is the house's shared one, which anyone who guesses its name can read.
