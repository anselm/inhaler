#!/usr/bin/env node
// inhale run <beat> [--passes fetch,digest,locate,issues] [--all] [--limit N]   one round of the passes
// inhale loop <beat> [--every 900]                                              rounds for ever
// inhale status <beat>                                                          counts and each source's health
// inhale export <beat> items|facts|issues                                       JSON lines on standard output
// inhale serve [--port 5191]                                                    the read API
// inhale beats                                                                  the beats this copy knows
import * as store from '../lib/store.mjs'
import { beatIds, loadBeat } from '../lib/beats.mjs'
import { fetchPass } from '../lib/passes/fetch.mjs'
import { digestPass } from '../lib/passes/digest.mjs'
import { locatePass } from '../lib/passes/locate.mjs'
import { issuesPass } from '../lib/passes/issues.mjs'
import { serve } from '../lib/server.mjs'

const [cmd, id, what] = process.argv.slice(2)
const flag = (name, d = null) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? d : process.argv[i + 1] ?? true }
const PASSES = { fetch: (b) => fetchPass(b.id, { all: process.argv.includes('--all') }), digest: (b) => digestPass(b, { limit: Number(flag('limit', 50)) }), locate: (b) => locatePass(b), issues: (b) => issuesPass(b) }
async function round(beat, names) { for (const n of names) { const t = Date.now(), r = await PASSES[n](beat); console.log(`${n.padEnd(8)} ${JSON.stringify(r)} in ${((Date.now() - t) / 1000).toFixed(1)} s`) } }

if (cmd === 'beats') for (const b of beatIds()) console.log(b)
else if (cmd === 'serve') serve(Number(flag('port', 5191)))
else if (cmd === 'run' && id) await round(loadBeat(id), String(flag('passes', 'fetch,digest,locate,issues')).split(','))
else if (cmd === 'loop' && id) { const beat = loadBeat(id), every = Number(flag('every', 900)); for (;;) { await round(beat, ['fetch', 'digest', 'locate']).catch((e) => console.error(e.message)); await new Promise((r) => setTimeout(r, every * 1000)) } }
else if (cmd === 'status' && id) { loadBeat(id); console.log(store.counts(id)); for (const s of store.sources(id)) console.log(`${s.fails ? 'FAIL' : s.last_ok ? 'ok  ' : 'new '} ${s.kind.padEnd(12)} ${s.name.padEnd(34)} ${s.last_count ?? '-'} listed${s.last_error ? '  last error: ' + s.last_error : ''}`) }
else if (cmd === 'export' && id && ['items', 'facts', 'issues'].includes(what)) { loadBeat(id); for (const r of store[what](id, { limit: 100000 })) console.log(JSON.stringify(r)) }
else console.log('usage: inhale run|loop|status <beat> | inhale export <beat> items|facts|issues | inhale serve | inhale beats')
