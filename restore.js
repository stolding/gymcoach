// Herstel: zet gegevens uit de oude JSON-bestanden (alsnog) in de database.
// Veilig om vaker te draaien; voegt samen in plaats van te overschrijven waar dat kan.
//
//   node restore.js                     → kijk wat er gevonden wordt (er wordt niets gewijzigd)
//   node restore.js --apply             → echt herstellen (maakt eerst een kopie van de database)
//   node restore.js --from <map>        → oude data-map ergens anders (bijv. ~/gymcoach-oud/data)
//   node restore.js --user <naam>       → koppel losse oude bestanden (zonder users.json) aan deze gebruiker
import { readFile, readdir, copyFile, mkdir, stat, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as store from './lib/store.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const APPLY = args.includes('--apply');
const FROM = path.resolve((opt('--from') || store.DATA_DIR).replace(/^~(?=\/|$)/, process.env.HOME));
const USER = opt('--user');

const log = (...a) => console.log(...a);
// Leest een oud JSON-bestand (ook als het al .imported heet).
async function readJson(dir, base) {
  // zoekt base.json, base.json.imported, base.json.migrated (in die volgorde)
  for (const ext of ['', '.imported', '.migrated']) {
    const f = path.join(dir, base + '.json' + ext);
    try { return { file: f, data: JSON.parse(await readFile(f, 'utf8')) }; } catch {}
  }
  return null;
}

// Vult de database aan met wat er in de oude JSON-bestanden van één gebruiker staat.
async function restoreUserData(target, dir, label) {
  const found = [];
  await store.runAs(target, async () => {
    const s = await readJson(dir, 'settings');
    if (s) {
      found.push('instellingen');
      if (APPLY) {
        const cur = await store.getSettings();
        const own = { ...cur };
        for (const k of Object.keys(store.DEFAULT_SETTINGS)) if (s.data[k] !== undefined) own[k] = s.data[k];
        if (s.data.withings?.segmentNames) own.withings = { ...(own.withings || {}), segmentNames: s.data.withings.segmentNames };
        await store.saveSettings(own);
      }
    }
    const w = await readJson(dir, 'workouts');
    if (w && Array.isArray(w.data)) {
      const cur = await store.getWorkouts();
      const have = new Set(cur.map((x) => String(x.training_id)));
      const add = w.data.filter((x) => !have.has(String(x.training_id)));
      found.push(`${add.length} trainingen (van ${w.data.length})`);
      if (APPLY && add.length) await store.saveWorkouts(add);
    }
    const se = await readJson(dir, 'sessions');
    if (se && se.data && typeof se.data === 'object') {
      const cur = await store.getSessions();
      const add = Object.fromEntries(Object.entries(se.data).filter(([id]) => !cur[id]));
      found.push(`${Object.keys(add).length} trainingsdetails`);
      if (APPLY && Object.keys(add).length) await store.saveSessions(add);
    }
    const b = await readJson(dir, 'bodyweight');
    if (b && Array.isArray(b.data)) {
      const cur = await store.getBodyLog();
      const byDate = new Map(b.data.map((x) => [x.date, x]));
      for (const x of cur) byDate.set(x.date, x); // wat al in de database staat wint
      const merged = [...byDate.values()].filter((x) => x?.date).sort((x, y) => x.date.localeCompare(y.date));
      found.push(`${merged.length - cur.length} lichaamsmetingen erbij`);
      if (APPLY && merged.length !== cur.length) await store.saveBodyLog(merged);
    }
    const p = await readJson(dir, 'plan');
    if (p && p.data) {
      const cur = await store.getPlan();
      found.push(cur ? 'plan (huidig plan blijft)' : 'plan');
      if (APPLY && !cur) await store.savePlan(p.data);
    }
    const wi = await readJson(dir, 'withings');
    if (wi && wi.data && Object.keys(wi.data).length) {
      const cur = await store.getWithings();
      const use = !cur?.refreshToken && !cur?.accessToken;
      found.push(use ? 'Withings-koppeling' : 'Withings-koppeling (huidige blijft)');
      if (APPLY && use) await store.saveWithings({ ...wi.data, fetchVersion: 0 }); // volgende sync haalt alles opnieuw op
    }
    const m = await readJson(dir, 'meta');
    if (m && m.data) {
      const cur = await store.getMeta();
      const seen = new Set();
      const pushes = [...(m.data.pushes || []), ...(cur.pushes || [])].filter((x) => { const k = JSON.stringify(x); if (seen.has(k)) return false; seen.add(k); return true; });
      found.push(`${(m.data.pushes || []).length} eerdere pushes`);
      if (APPLY) await store.saveMeta({ ...cur, pushes, fullHistoryAt: null });
    }
  });
  // Speediance-login (bestanden) meenemen als de doelgebruiker er nog geen heeft
  const srcSd = path.join(dir, 'speediance');
  const dstSd = path.join(store.DATA_DIR, 'users', target.id, 'speediance');
  for (const f of ['config.json', 'token.json']) {
    if (existsSync(path.join(srcSd, f)) && path.resolve(srcSd) !== path.resolve(dstSd) && !existsSync(path.join(dstSd, f))) {
      found.push(`speediance/${f}`);
      if (APPLY) { await mkdir(dstSd, { recursive: true, mode: 0o700 }); await copyFile(path.join(srcSd, f), path.join(dstSd, f)); await chmod(path.join(dstSd, f), 0o600); }
    }
  }
  log(`  ${label} → ${target.username}: ${found.length ? found.join(', ') : 'niets gevonden'}`);
}

log(`Database: ${store.DB_FILE}`);
log(`Oude bestanden zoeken in: ${FROM}`);
if (!existsSync(FROM)) { log('Die map bestaat niet. Gebruik --from <map>.'); process.exit(1); }
log(APPLY ? '\nHERSTELLEN\n' : '\nALLEEN KIJKEN (draai met --apply om echt te herstellen)\n');

if (APPLY) {
  const bk = store.DB_FILE.replace(/\.db$/, `-voor-herstel-${Date.now()}.db`);
  store.backupTo(bk);
  log(`Kopie van de huidige database: ${bk}\n`);
}

// 1. gedeelde instellingen (AI, Withings-app)
const g = await readJson(FROM, 'global');
if (g) {
  const cur = await store.getGlobal();
  const empty = !cur.withings.clientId && cur.ai.provider === 'none';
  log(`Gedeelde instellingen (AI, Withings-app): ${empty ? 'worden hersteld' : 'huidige blijven'}`);
  if (APPLY && empty) await store.saveGlobal({ ...cur, ...g.data, ai: { ...cur.ai, ...(g.data.ai || {}) }, withings: { ...cur.withings, ...(g.data.withings || {}) } });
}

// 2. gebruikers uit users.json koppelen aan bestaande gebruikers (op gebruikersnaam) of opnieuw aanmaken
const current = await store.getUsers();
const oldUsers = (await readJson(FROM, 'users'))?.data;
if (Array.isArray(oldUsers) && oldUsers.length) {
  log(`Oude gebruikers gevonden: ${oldUsers.map((u) => u.username).join(', ')}`);
  const users = [...current];
  for (const ou of oldUsers) {
    let target = users.find((u) => u.username.toLowerCase() === String(ou.username).toLowerCase() || u.id === ou.id);
    if (target) log(`- ${ou.username}: bestaat al → gegevens worden aan dit account toegevoegd (huidig wachtwoord blijft)`);
    else {
      log(`- ${ou.username}: wordt teruggezet met het oude wachtwoord`);
      target = { ...ou };
      users.push(target);
      if (APPLY) await store.saveUsers(users);
    }
    await restoreUserData(target, path.join(FROM, 'users', ou.id), `  gegevens van ${ou.username}`);
  }
}

// 3. losse bestanden van de allereerste versie (zonder gebruikers) in de hoofdmap
const rootHas = (!Array.isArray(oldUsers) || USER) && (await Promise.all(['settings', 'workouts', 'bodyweight', 'plan'].map((b) => readJson(FROM, b)))).some(Boolean);
if (rootHas) {
  const target = USER ? (await store.getUsers()).find((u) => u.username.toLowerCase() === USER.toLowerCase()) : (await store.getUsers()).find((u) => u.role === 'admin');
  if (!target) log(`Losse oude bestanden gevonden, maar geen gebruiker${USER ? ` "${USER}"` : ' (beheerder)'} om ze aan te koppelen.`);
  else await restoreUserData(target, FROM, 'Losse bestanden uit de eerste versie');
}

// 4. oefeningencatalogi
for (const f of await readdir(FROM).catch(() => [])) {
  const mm = /^library(?:-(\d+))?\.json(\.imported|\.migrated)?$/.exec(f);
  if (!mm) continue;
  const dt = Number(mm[1] || 1);
  if (!(await store.getLibraryCache(dt))) {
    log(`Oefeningencatalogus toestel ${dt}: wordt hersteld`);
    if (APPLY) { try { await store.saveLibraryCache(JSON.parse(await readFile(path.join(FROM, f), 'utf8')), dt); } catch {} }
  }
}

if (!Array.isArray(oldUsers) && !rootHas) log('Geen oude gegevens gevonden in deze map. Staat je oude data ergens anders? Gebruik --from <map>.');
log(APPLY ? '\nKlaar. Herstart de app: systemctl --user restart gymcoach' : '\nNiets gewijzigd. Klopt dit? Draai dan: node restore.js --apply');
