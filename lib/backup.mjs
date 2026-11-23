// The database copied to object storage (any S3 interface; Cloudflare R2 here), so the machine it
// runs on can be lost. A consistent copy is taken with SQLite's own `vacuum into`, gzipped, and
// put under <prefix>/inhale-<weekday>.db.gz and <prefix>/inhale-latest.db.gz: a week of days and
// the newest. INHALE_STORE names a file of key=value lines: access_key_id, secret_access_key,
// endpoint, bucket, and optionally prefix (default "inhaler"). The request signing is below.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest(), sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
async function put(c, key, body) {
  const host = new URL(c.endpoint).host, p = `/${c.bucket}/${key}`, now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''), day = now.slice(0, 8), hash = sha(body)
  const canonical = `PUT\n${p}\n\nhost:${host}\nx-amz-content-sha256:${hash}\nx-amz-date:${now}\n\nhost;x-amz-content-sha256;x-amz-date\n${hash}`, scope = `${day}/auto/s3/aws4_request`
  const sig = crypto.createHmac('sha256', hmac(hmac(hmac(hmac('AWS4' + c.secret_access_key, day), 'auto'), 's3'), 'aws4_request')).update(`AWS4-HMAC-SHA256\n${now}\n${scope}\n${sha(canonical)}`).digest('hex')
  const r = await fetch(`https://${host}${p}`, { method: 'PUT', body, headers: { 'x-amz-date': now, 'x-amz-content-sha256': hash, 'Content-Type': 'application/gzip',
    Authorization: `AWS4-HMAC-SHA256 Credential=${c.access_key_id}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}` } })
  if (!r.ok) throw new Error(`${key}: ${r.status} ${(await r.text()).slice(0, 120)}`)
}
export async function backup(dbFile) {
  const file = process.env.INHALE_STORE; if (!file || !fs.existsSync(file)) throw new Error('INHALE_STORE names no credentials file')
  const c = Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
  const tmp = path.join(os.tmpdir(), `inhale-backup-${process.pid}.db`); fs.rmSync(tmp, { force: true })
  const db = new DatabaseSync(dbFile); db.exec(`vacuum into '${tmp}'`); db.close()
  // the name server's tables are left out: they are hundreds of megabytes and are fetched again from GeoNames
  { const t = new DatabaseSync(tmp); t.exec('drop table if exists names; drop table if exists names_loaded; vacuum'); t.close() }
  const gz = zlib.gzipSync(fs.readFileSync(tmp), { level: 6 }); fs.rmSync(tmp, { force: true })
  const prefix = c.prefix || 'inhaler', dayName = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getUTCDay()]
  await put(c, `${prefix}/inhale-${dayName}.db.gz`, gz); await put(c, `${prefix}/inhale-latest.db.gz`, gz)
  return { bytes: gz.length, keys: [`${prefix}/inhale-${dayName}.db.gz`, `${prefix}/inhale-latest.db.gz`] }
}
