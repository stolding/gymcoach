// Directe aanroepen naar de (onofficiële) Speediance-API voor wat de CLI niet kan:
// je eigen programma's (custom training templates) opvragen en verwijderen.
// Hergebruikt het token van speediance-cli; bij een verlopen token logt de CLI opnieuw in.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as cli from './cli.js';
import { currentUser, speedianceDir } from './store.js';

const BASES = { Global: 'https://api2.speediance.com/api', EU: 'https://euapi.speediance.com/api' };
const MOBILE_DEVICES = '{"brand":"google","device":"emulator64","deviceType":"sdk_gphone64","os":"","os_version":"31","manufacturer":"Google"}';

// Leest een JSON-bestand, of null als het er niet is.
async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

// Sessiegegevens (token, regio) van de speediance-cli voor de huidige gebruiker.
async function session() {
  const dir = speedianceDir(currentUser());
  const cfg = (await readJson(path.join(dir, 'config.json'))) || {};
  const tokenFile = path.join(dir, 'token.json');
  const tok = await readJson(tokenFile);
  const base = process.env.SPEEDIANCE_API || BASES[cfg.region] || BASES.Global;
  return { base, token: tok?.token || '', userId: tok?.user_id || '', deviceType: Number(cfg.device_type || 1) };
}

// Directe aanroep van de Speediance-API met de CLI-sessie; logt één keer opnieuw in bij een verlopen sessie.
async function call(method, urlPath, retried = false, lang = 'en') {
  const s = await session();
  if (!s.token && !retried) { await cli.login(); return call(method, urlPath, true, lang); }
  const r = await fetch(s.base + urlPath.replace('{dt}', s.deviceType), {
    method,
    headers: {
      'User-Agent': 'Dart/3.9 (dart:io)', 'Content-Type': 'application/json', Timestamp: String(Date.now()),
      Utc_offset: '+0000', Timezone: 'GMT', Versioncode: '40304', 'Accept-Language': lang, App_type: 'SOFTWARE',
      Mobiledevices: MOBILE_DEVICES, Token: s.token, App_user_id: s.userId,
    },
  });
  // grote id's (snowflake) als tekst lezen om afrondingsfouten te voorkomen
  const text = await r.text();
  let j = {};
  try { j = JSON.parse(text.replace(/([:\[,]\s*)(\d{16,})(?=\s*[,}\]])/g, '$1"$2"')); } catch {}
  const unauthorized = r.status === 401 || [401, 10001, 10002].includes(Number(j?.code));
  if (unauthorized && !retried) { await cli.login(); return call(method, urlPath, true, lang); }
  if (!r.ok || (j.code != null && Number(j.code) !== 0)) throw new Error(`Speediance ${method} ${urlPath.split('?')[0]}: ${j.message || j.msg || r.status}`);
  return j.data;
}

const pick = (o, keys) => { for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]; return null; };
const toDate = (v) => {
  if (v == null) return null;
  const n = Number(v);
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v);
  return isNaN(d) ? String(v) : d.toISOString();
};

// Lijst van je eigen programma's op het account.
export async function listPrograms() {
  const data = await call('GET', '/app/v4/customTrainingTemplate/appPage?pageNo=1&pageSize=-1&deviceTypes={dt}');
  const rows = Array.isArray(data) ? data : data?.list || data?.records || data?.rows || [];
  return rows.map((t) => ({
    id: pick(t, ['id', 'templateId']),
    name: String(pick(t, ['name', 'title', 'templateName']) || '(zonder naam)'),
    created: toDate(pick(t, ['createTime', 'createdTime', 'gmtCreate', 'createAt'])),
    exercises: Array.isArray(t.actionLibraryList) ? t.actionLibraryList.length : pick(t, ['actionNum', 'actionCount']),
    gymcoach: /^GC (\d{4}-)?W\d+ /.test(String(pick(t, ['name', 'title', 'templateName']) || '')),
  })).filter((t) => t.id != null);
}

// Verwijdert programma's van het toestel.
export async function deletePrograms(ids) {
  const done = [], failed = [];
  for (const id of ids) {
    try { await call('DELETE', `/app/customTrainingTemplate?ids=${encodeURIComponent(id)}`); done.push(id); }
    catch (e) { failed.push({ id, error: e.message }); }
  }
  return { done, failed };
}

// Probeert uit je accountgegevens af te leiden welk toestel je hebt.
// Geeft alle velden terug die over een toestel lijken te gaan, plus een gok voor device_type.
export async function detectDevice() {
  const found = [];
  const walk = (o, p = '') => {
    if (o == null || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      const key = p ? `${p}.${k}` : k;
      if (/device|equip|machine|model|sn$|serial/i.test(k) && (typeof v !== 'object' || Array.isArray(v))) found.push({ key, value: Array.isArray(v) ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 120) });
      if (typeof v === 'object') walk(v, key);
    }
  };
  let data = null, error = null;
  try { data = await call('GET', '/app/userinfo'); } catch (e) { error = e.message; }
  if (data) walk(data);
  const typeField = found.find((f) => /devicetype$/i.test(f.key) && /^\d+$/.test(f.value));
  return { deviceType: typeField ? Number(typeField.value) : null, fields: found.slice(0, 20), error };
}

// Alle gegevens van één oefening zoals de Speediance-app ze toont (uitleg, beelden, spieren …), in een taal.
export async function exerciseInfo(groupId, lang = 'en') {
  return call('GET', `/app/actionLibraryGroup/${Number(groupId)}?isDisplay=1`, false, lang);
}
