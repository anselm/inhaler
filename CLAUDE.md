# inhaler

Project-specific orientation only. House policy (devlog, git, UX, writing,
deploy) comes from the harness and is not repeated here.

## What this is

An inhaler: a smart aggregator that reads public news, notices and posts about a place and
digests them in passes into dated, located, sourced facts and a list of issues. No
presentation. First beat: Sausalito, for `esimv1-playable-sausalito`. Named `esimv1-social` for its first
hours. Anselm, 22 November 2026: it is a separate service unrelated to esimv1, it is to take over
the fetching that cortes, saltspring, matchmaker and the ontology projects each do, and they keep
only their own reading of what it fetched (`devlog/20261122-one-inhaler.md`).

## Where things are

- Code: this folder. Repo: `anselm/inhaler` (public).
- Devlog: `devlog/` (dated entries; read the tail first). `todo.md` is the open work.
- `bin/inhale.mjs` the command line; `lib/store.mjs` the only code that touches the database;
  `lib/fetch.mjs` the only code that makes a request for a source; `lib/sources/*.mjs` one file
  per source kind; `lib/passes/*.mjs` one file per pass; `lib/llm.mjs` the model tiers;
  `lib/server.mjs` the read API; `beats/*.json` the beats.
- Data: `data/inhale.db` (SQLite, not in git).

## Project-specific facts

- Models. On the VM the passes read through OpenRouter with `anthropic/claude-haiku-5.5` (Anselm, 2026-11-22: "we will be
  using openrouter and or anthropic api keys"), about three seconds an item, capped at `INHALE_BUDGET=300` calls a day. The
  key is the house's shared OpenRouter key (`harness/private/openrouter.md`), kept in the VM's `/srv/inhaler/env`; calls
  carry `X-Title: inhaler` so the OpenRouter dashboard shows this service's share. Run with no settings, as on canada1,
  it uses the local `ollama:gpt-oss:20b` (about five seconds an item, free). OpenRouter does not enforce enum values in a
  schema, so the digest maps an unknown kind to `other` and never retries for it.
- FixTweet (`api.fxtwitter.com`): `/2/profile/<name>/statuses` gives an account's recent posts;
  search answers 503 "unavailable due to current API limitations" (22 November 2026). A wrong
  account name answers 404.
- When a model cannot be asked, the digest pass stops and leaves items as they are. It must never
  mark them failed for that (the ontology project lost 1,474 documents that way).
- An item is marked gone only after a successful fetch of a source that lists everything it has
  (`lists_all` in the beat file), never after a failed or empty fetch.
- Nothing about pitching, fundraising or private conversations goes in this repository.
- Live since 2026-11-22: https://inhaler.exe.xyz/ (exe.dev VM `inhaler`; units `inhaler-loop`, `inhaler-api` on port
  8000, `inhaler-backup.timer`; code in `/srv/inhaler`, database `/srv/inhaler/data/inhale.db`, settings in
  `/srv/inhaler/env`). `deploy/deploy.sh` by hand on Anselm's say; it never overwrites the VM's database. Its loop
  fetches, digests and locates every fifteen minutes and reads the issues again once a day.
  To read on canada1 against a copy: fetch `inhaler/inhale-latest.db.gz` from the bucket, or run a beat locally.
- Nightly backup to Cloudflare R2, bucket `esimv1`, prefix `inhaler/` (the credential is esimv1's, `~/.config/cf/r2`).
- The other aggregators (matchmaker, ontology-scraper, cortes, saltspring) are not to be changed yet (Anselm, 2026-11-22:
  "lets not change matchmaker or other projects yet - the inhaler will have to prove itself first").
- Helpers (2026-11-22, Anselm: "inhaler collects raw content, marked as dirty, anybody such as canada1 can go and grab some,
  do analysis, and push analysis back"): `POST /work/claim` and `/work/done` need `Authorization: Bearer <secret>` from the
  VM's `INHALE_KEYS` (name:secret pairs). The VM leaves a new item for helpers for `INHALE_HOLD_S` (1800 s) and then reads
  it itself. From canada1: `INHALE_HELP_KEY=$(cat ~/.config/inhaler/help-key) node bin/inhale.mjs help https://inhaler.exe.xyz`
  reads with the local model. It is not left running; canada1 is not to run services durably.
- The root address serves a plain status page (`lib/page.mjs`). The repository is public (Anselm said either is fine).

