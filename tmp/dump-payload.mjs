import { DatabaseSync } from 'node:sqlite';
import v8 from 'node:v8';
const open = f => new DatabaseSync(f, { readOnly: true });
const D = 'D:/gaimo/baonly_web/data_e8ktN/';

const merged = open(D + 'sources/_merged.sqlite');
console.log('=== merged meta ===');
console.log(merged.prepare('SELECT * FROM meta').all());

const rows = merged.prepare('SELECT id, source, start_at, payload FROM events ORDER BY start_at').all();
console.log('\n=== merged rows =', rows.length);
console.log('sources distinct:', [...new Set(rows.map(r => r.source))]);

const de = b => v8.deserialize(Buffer.from(b));
const objs = rows.map(r => ({ row: r, obj: de(r.payload) }));

// key universe
const keyCount = new Map();
for (const { obj } of objs) for (const k of Object.keys(obj)) keyCount.set(k, (keyCount.get(k)||0)+1);
console.log('\n=== top-level keys (count/148) + sample types ===');
for (const [k, c] of [...keyCount].sort((a,b)=>b[1]-a[1])) {
  const sample = objs.map(o=>o.obj[k]).find(v => v !== null && v !== undefined);
  let t = sample === undefined ? 'all-null' : Array.isArray(sample) ? `array[${sample.length}]` : typeof sample;
  let prev = '';
  if (t === 'object') prev = ' keys=' + JSON.stringify(Object.keys(sample).slice(0,20));
  else if (t.startsWith('array')) prev = ' item=' + (typeof sample[0] === 'object' && sample[0] ? JSON.stringify(Object.keys(sample[0])) : JSON.stringify(sample[0]));
  else prev = ' e.g. ' + JSON.stringify(String(sample).slice(0,90));
  console.log(`  ${k.padEnd(24)} ${String(c).padStart(3)}  ${t}${prev}`);
}
