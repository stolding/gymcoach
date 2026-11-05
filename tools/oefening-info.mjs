// Toont wat de Speediance-API over één oefening teruggeeft (voor de trainingseditor: uitleg, beelden, talen).
// Gebruik (in de gymcoach-map):  node tools/oefening-info.mjs <gebruikersnaam> [oefening-id] [taal ...]
// Voorbeeld:                     node tools/oefening-info.mjs andre 116 en nl de
import * as store from '../lib/store.js';
import { exerciseInfo } from '../lib/speediance.js';

const [username, id = '116', ...langs] = process.argv.slice(2);
if (!username) { console.error('Gebruik: node tools/oefening-info.mjs <gebruikersnaam> [oefening-id] [taal ...]'); process.exit(1); }
const user = (await store.getUsers()).find((u) => u.username.toLowerCase() === username.toLowerCase());
if (!user) { console.error(`Gebruiker ${username} niet gevonden`); process.exit(1); }

// lange teksten en lijsten inkorten, zodat de uitvoer leesbaar blijft
const short = (v, d = 0) => {
  if (typeof v === 'string') return v.length > 160 ? v.slice(0, 160) + '…' : v;
  if (Array.isArray(v)) return v.length ? [short(v[0], d + 1), ...(v.length > 1 ? [`… ${v.length} items`] : [])] : [];
  if (v && typeof v === 'object') return d > 3 ? '{…}' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, short(x, d + 1)]));
  return v;
};
await store.runAs(user, async () => {
  for (const lang of langs.length ? langs : ['en', 'nl']) {
    try {
      const d = await exerciseInfo(id, lang);
      console.log(`\n===== oefening ${id} · taal ${lang} =====`);
      console.log(JSON.stringify(short(d), null, 1));
    } catch (e) { console.log(`\n===== taal ${lang}: ${e.message}`); }
  }
});
