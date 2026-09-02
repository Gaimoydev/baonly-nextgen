import { DatabaseSync } from 'node:sqlite';
import v8 from 'node:v8';
const D = 'D:/gaimo/baonly_web/data_e8ktN/';
const de = b => v8.deserialize(Buffer.from(b));
const merged = new DatabaseSync(D + 'sources/_merged.sqlite', { readOnly: true });
const objs = merged.prepare('SELECT id, source, start_at, payload FROM events').all().map(r => ({ r, o: de(r.payload) }));

// 1. sourceRecords dedup
const pairs = [];
for (const { r, o } of objs) for (const sr of (o.sourceRecords||[])) pairs.push({ ev: r.id, key: sr.source + '|' + sr.id, source: sr.source, id: sr.id });
console.log('sourceRecords total items:', pairs.length);
const bykey = new Map();
for (const p of pairs) { if (!bykey.has(p.key)) bykey.set(p.key, []); bykey.get(p.key).push(p.ev); }
console.log('distinct source|id:', bykey.size);
const dupes = [...bykey].filter(([, evs]) => evs.length > 1);
console.log('keys appearing in >1 merged event:', dupes.length);
for (const [k, evs] of dupes) console.log('   DUP', k, '->', evs);
const bySrc = {};
for (const k of bykey.keys()) { const s = k.split('|')[0]; bySrc[s] = (bySrc[s]||0)+1; }
console.log('distinct per source:', bySrc);

// 2. sources[] array distribution (multi-source merge)
const dist = {};
for (const { o } of objs) { const n = (o.sources||[]).length; dist[n] = (dist[n]||0)+1; }
console.log('\nsources[].length distribution:', dist);
const distSR = {};
for (const { o } of objs) { const n = (o.sourceRecords||[]).length; distSR[n] = (distSR[n]||0)+1; }
console.log('sourceRecords[].length distribution:', distSR);

// 3. tickets
let withTickets = 0, totalTickets = 0;
for (const { o } of objs) { const t = o.detail?.tickets||[]; if (t.length) withTickets++; totalTickets += t.length; }
console.log('\nevents with tickets:', withTickets, ' total tickets:', totalTickets);

// 4. changeNotices coverage
let cnEv = 0, cnTotal = 0;
for (const { o } of objs) { const c = o.changeNotices||[]; if (c.length) cnEv++; cnTotal += c.length; }
console.log('events with changeNotices:', cnEv, ' total notices:', cnTotal);

// 5. fieldSources multi-source per field?
let fsMulti = 0, fsTotalFields = 0, maxLen = 0;
const fsLenDist = {};
for (const { o } of objs) for (const [k, v] of Object.entries(o.fieldSources||{})) {
  const n = (v?.sources||[]).length; fsTotalFields++; fsLenDist[n]=(fsLenDist[n]||0)+1; if (n>1) fsMulti++; maxLen = Math.max(maxLen, n);
}
console.log('\nfieldSources rows total:', fsTotalFields, ' with >1 source:', fsMulti, ' maxLen:', maxLen, fsLenDist);
console.log('fieldSources.sources[0] sample:', JSON.stringify(objs[0].o.fieldSources));

// 6. per-source sqlite raw counts + overlap with merged
for (const s of ['bilibili','cpp','dlcomic','baonlytime']) {
  const db = new DatabaseSync(D + `sources/${s}.sqlite`, { readOnly: true });
  const ids = db.prepare('SELECT id, source FROM events').all();
  const inMerged = ids.filter(x => bykey.has(s + '|' + String(x.id).replace(/^[a-z]+-/,'')) );
  console.log(`\n${s}.sqlite rows=${ids.length}  sample ids=${JSON.stringify(ids.slice(0,3).map(x=>x.id))}`);
  db.close();
}
// 7. merged id prefixes
console.log('\nmerged id prefixes:', [...new Set(objs.map(o=>o.r.id.split('-')[0]))]);
console.log('sourceRecord id sample:', [...bykey.keys()].slice(0,6));
