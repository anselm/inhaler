# esimv1-social

Project-specific orientation only. House policy (devlog, git, UX, writing,
deploy) comes from the harness and is not repeated here.

## What this is

An inhaler: a smart aggregator that reads public news, notices and posts about a place and
digests them in passes into dated, located, sourced facts and a list of issues. No
presentation. First beat: Sausalito, for `esimv1-playable-sausalito`. Anselm's question,
open: whether this becomes the one inhaler that cortes, saltspring, matchmaker and the
ontology projects talk to (`devlog/20261122-design.md`). Not deployed.

## Where things are

- Code: this folder. Repo: `anselm/esimv1-social` (public).
- Devlog: `devlog/` (dated entries; read the tail first). `todo.md` is the open work.
- `bin/inhale.mjs` the command line; `lib/store.mjs` the only code that touches the database;
  `lib/fetch.mjs` the only code that makes a request for a source; `lib/sources/*.mjs` one file
  per source kind; `lib/passes/*.mjs` one file per pass; `lib/llm.mjs` the model tiers;
  `lib/server.mjs` the read API; `beats/*.json` the beats.
- Data: `data/inhale.db` (SQLite, not in git).

## Project-specific facts

- The default model is local: `ollama:gpt-oss:20b` on canada1, about ten seconds an item. The
  Anthropic key on canada1 had no credit when last checked and the OpenRouter key is shared by
  several projects that have overspent it; do not point this at a paid tier without Anselm's say.
- FixTweet (`api.fxtwitter.com`): `/2/profile/<name>/statuses` gives an account's recent posts;
  search answers 503 "unavailable due to current API limitations" (22 November 2026). A wrong
  account name answers 404.
- When a model cannot be asked, the digest pass stops and leaves items as they are. It must never
  mark them failed for that (the ontology project lost 1,474 documents that way).
- An item is marked gone only after a successful fetch of a source that lists everything it has
  (`lists_all` in the beat file), never after a failed or empty fetch.
- Nothing about pitching, fundraising or private conversations goes in this repository.
