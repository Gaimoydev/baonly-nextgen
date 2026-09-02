import { DatabaseSync } from 'node:sqlite';
const files = {
  main: 'D:/gaimo/baonly_web/data_e8ktN/baonly.sqlite',
  merged: 'D:/gaimo/baonly_web/data_e8ktN/sources/_merged.sqlite',
  bilibili: 'D:/gaimo/baonly_web/data_e8ktN/sources/bilibili.sqlite',
  cpp: 'D:/gaimo/baonly_web/data_e8ktN/sources/cpp.sqlite',
  dlcomic: 'D:/gaimo/baonly_web/data_e8ktN/sources/dlcomic.sqlite',
  baonlytime: 'D:/gaimo/baonly_web/data_e8ktN/sources/baonlytime.sqlite',
};
for (const [label, f] of Object.entries(files)) {
  console.log('\n============ ' + label + ' :: ' + f);
  let db;
  try { db = new DatabaseSync(f, { readOnly: true }); }
  catch (e) { console.log('OPEN FAIL', e.message); continue; }
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
  for (const t of tables) {
    let cnt = '?';
    try { cnt = db.prepare(`SELECT COUNT(*) c FROM "${t.name}"`).get().c; } catch (e) { cnt = 'ERR:' + e.message; }
    console.log(`\n-- ${t.name}  [rows=${cnt}]`);
    console.log(t.sql);
  }
  db.close();
}
