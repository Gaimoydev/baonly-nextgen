import { DatabaseSync } from 'node:sqlite';
import v8 from 'node:v8';
const D = 'D:/gaimo/baonly_web/data_e8ktN/';
const merged = new DatabaseSync(D + 'sources/_merged.sqlite', { readOnly: true });
const de = b => v8.deserialize(Buffer.from(b));
const objs = merged.prepare('SELECT id, source, start_at, payload FROM events').all().map(r => ({ r, o: de(r.payload) }));

function keyUniverse(label, getArr, isObj=false) {
  const kc = new Map(); let n = 0; let sample = null;
  for (const { o } of objs) {
    const v = getArr(o);
    if (!v) continue;
    const items = isObj ? [v] : (Array.isArray(v) ? v : [v]);
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      n++;
      if (!sample) sample = it;
      for (const [k, val] of Object.entries(it)) {
        if (!kc.has(k)) kc.set(k, { c: 0, types: new Set(), ex: undefined });
        const e = kc.get(k); e.c++;
        e.types.add(val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val);
        if (e.ex === undefined && val !== null && val !== '' ) e.ex = val;
      }
    }
  }
  console.log(`\n##### ${label}  items=${n}`);
  for (const [k, e] of [...kc].sort((a,b)=>b[1].c-a[1].c)) {
    let ex = e.ex;
    if (Array.isArray(ex)) ex = `array[${ex.length}] ` + (typeof ex[0]==='object'&&ex[0] ? JSON.stringify(Object.keys(ex[0])) : JSON.stringify(ex[0]));
    else if (ex && typeof ex === 'object') ex = 'obj keys=' + JSON.stringify(Object.keys(ex));
    else ex = JSON.stringify(String(ex).slice(0,110));
    console.log(`  ${k.padEnd(20)} ${String(e.c).padStart(4)}  [${[...e.types].join('|')}]  ${ex}`);
  }
}

keyUniverse('detail', o => o.detail, true);
keyUniverse('detail.tickets[]', o => o.detail?.tickets);
keyUniverse('detail.baseInfo[]', o => o.detail?.baseInfo);
keyUniverse('detail.guests[]', o => o.detail?.guests);
keyUniverse('detail.venue', o => o.detail?.venue, true);
keyUniverse('fieldSources', o => o.fieldSources, true);
keyUniverse('sourceRecords[]', o => o.sourceRecords);
keyUniverse('changeNotices[]', o => o.changeNotices);
