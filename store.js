// Trajno cuvanje podataka (profili, obavestenje, partije).
// Ako na serveru postoji promenljiva DATABASE_URL, sve se cuva u Postgres bazi (npr. besplatna Neon baza),
// pa podaci prezive gasenje i restart servera. Bez nje se cuva u lokalne fajlove u folderu data/.
const fs = require('fs');
const path = require('path');

const DB_URL = (process.env.DATABASE_URL || '').trim();
// ssl podesavamo sami, pa iz adrese izbaci sslmode/channel_binding
function cleanUrl(u) {
  try { const x = new URL(u); x.searchParams.delete('sslmode'); x.searchParams.delete('channel_binding'); return x.toString(); } catch (_) { return u; }
}
let pool = null;
if (DB_URL) {
  const { Pool } = require('pg');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL) || /sslmode=disable/.test(DB_URL);
  pool = new Pool({
    connectionString: cleanUrl(DB_URL),
    ssl: local ? false : { rejectUnauthorized: true },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
  pool.on('error', (e) => console.error('baza: greska veze', e.message));
}
const useDb = () => !!pool;

let ready = null;
function init() {
  if (!pool) return Promise.resolve();
  if (!ready) ready = retry(() => pool.query('CREATE TABLE IF NOT EXISTS ot_store (key text PRIMARY KEY, value jsonb, updated timestamptz DEFAULT now())'))
    .then(() => console.log('Baza podataka povezana: podaci se čuvaju trajno.'));
  return ready;
}

// besplatna baza moze da "spava" pa se budi par sekundi: probaj ponovo
async function retry(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= tries) throw e;
      console.error(`baza: pokusaj ${i} nije uspeo (${e.message}), ponovo...`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

// ucitaj vrednost: iz baze ako postoji, inace iz fajla; undefined ako je nema
async function load(key, file) {
  if (pool) {
    await init();
    const r = await retry(() => pool.query('SELECT value FROM ot_store WHERE key = $1', [key]));
    if (r.rows.length) return r.rows[0].value;
    return undefined;
  }
  return loadFile(file);
}
function loadFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return undefined; }
}

// upis: jedan po jedan za isti kljuc, poslednja vrednost pobedjuje
const pending = new Map(); // key -> { json, file }
const running = new Map(); // key -> Promise
function save(key, file, value) {
  pending.set(key, { json: JSON.stringify(value === undefined ? null : value), file });
  if (!running.has(key)) running.set(key, flushKey(key).finally(() => running.delete(key)));
  return running.get(key);
}
async function flushKey(key) {
  while (pending.has(key)) {
    const { json, file } = pending.get(key); pending.delete(key);
    try {
      if (pool) {
        await init();
        await retry(() => pool.query(
          'INSERT INTO ot_store (key, value, updated) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated = now()',
          [key, json]), 3);
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file + '.tmp', json);
        fs.renameSync(file + '.tmp', file);
      }
    } catch (e) { console.error(`cuvanje "${key}" nije uspelo`, e.message); }
  }
}
// sacekaj da se svi upisi zavrse (pre gasenja servera)
async function flushAll() { while (running.size) await Promise.all([...running.values()]); }
async function close() { await flushAll(); if (pool) await pool.end().catch(() => {}); }

module.exports = { useDb, init, load, loadFile, save, flushAll, close };
