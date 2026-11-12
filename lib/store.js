// Opslag in SQLite (ingebouwde node:sqlite) met gebruikersscheiding.
//   data/gymcoach.db                         → alle gebruikers, instellingen en gegevens
//   data/users/<id>/speediance/{config,token}.json → Speediance-login per gebruiker (bestanden, nodig voor de CLI)
// De actieve gebruiker komt uit een verzoekcontext (AsyncLocalStorage).
import { readFile, mkdir, rename, chmod, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { classify } from './acttypes.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// de experimentele-waarschuwing van node:sqlite niet in de logs
const origEmit = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w?.message || w).includes('SQLite') ? undefined : origEmit.call(process, w, ...a));
const { DatabaseSync } = await import('node:sqlite');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const DATA_DIR = process.env.GYMCOACH_DATA || path.join(ROOT, 'data');
export const DB_FILE = path.join(DATA_DIR, 'gymcoach.db');

// ---------- database ----------
await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS meta_schema (version INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','user')), pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created INTEGER, expires INTEGER
  );
  CREATE TABLE IF NOT EXISTS global_settings (key TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS user_docs (
    user_id TEXT NOT NULL, name TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, name)
  );
  CREATE TABLE IF NOT EXISTS workouts (
    user_id TEXT NOT NULL, training_id TEXT NOT NULL, date TEXT, title TEXT, json TEXT NOT NULL,
    PRIMARY KEY (user_id, training_id)
  );
  CREATE INDEX IF NOT EXISTS workouts_date ON workouts(user_id, date);
  CREATE TABLE IF NOT EXISTS training_sessions (
    user_id TEXT NOT NULL, training_id TEXT NOT NULL, date TEXT, json TEXT NOT NULL,
    PRIMARY KEY (user_id, training_id)
  );
  CREATE TABLE IF NOT EXISTS body_measurements (
    user_id TEXT NOT NULL, date TEXT NOT NULL, kg REAL, fat REAL, source TEXT, json TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS avatars (user_id TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS activities (
    user_id TEXT NOT NULL, id TEXT NOT NULL, date TEXT NOT NULL, start TEXT, type TEXT, name TEXT,
    minutes REAL, km REAL, kcal REAL, hr_avg REAL, hr_max REAL, source TEXT, json TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX IF NOT EXISTS activities_date ON activities(user_id, date);
  CREATE TABLE IF NOT EXISTS health_daily (
    user_id TEXT NOT NULL, date TEXT NOT NULL, steps REAL, active_kcal REAL, walk_km REAL, json TEXT,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS exercise_library (device_type INTEGER PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, json TEXT NOT NULL, shared INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS plan_archive (user_id TEXT NOT NULL, week TEXT NOT NULL, json TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY (user_id, week));
  CREATE TABLE IF NOT EXISTS exercise_info (group_id INTEGER NOT NULL, lang TEXT NOT NULL, json TEXT NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY (group_id, lang));
`);
// kolommen die later zijn toegevoegd
for (const [t, c, type] of [['health_daily', 'rest_hr', 'REAL'], ['health_daily', 'hrv', 'REAL'], ['health_daily', 'vo2max', 'REAL'], ['health_daily', 'intake_kcal', 'REAL'], ['health_daily', 'protein_g', 'REAL'], ['health_daily', 'carbs_g', 'REAL'], ['health_daily', 'fat_g', 'REAL'], ['health_daily', 'fiber_g', 'REAL'], ['health_daily', 'intake_source', 'TEXT']]) {
  if (!db.prepare(`PRAGMA table_info(${t})`).all().some((r) => r.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`);
}
if (!db.prepare('SELECT version FROM meta_schema').get()) db.prepare('INSERT INTO meta_schema(version) VALUES (1)').run();

// Voert fn uit in één databasetransactie.
function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const parse = (t, fb) => { try { return t == null ? structuredClone(fb) : JSON.parse(t); } catch { return structuredClone(fb); } };

// ---------- context ----------
const als = new AsyncLocalStorage();
// Voert fn uit als een bepaalde gebruiker (AsyncLocalStorage): alle get/save gaan dan over die gebruiker.
export const runAs = (user, fn) => als.run({ user, accept: als.getStore()?.accept || [] }, fn);
// Verzoek zonder (of vóór) inloggen: alleen de talen uit de browser (Accept-Language) zijn bekend.
export const runAnon = (accept, fn) => als.run({ user: null, accept }, fn);
// Talen uit de browser van het huidige verzoek (leeg buiten een verzoek, bijv. bij automatisch syncen).
export const currentAccept = () => als.getStore()?.accept || [];
// Taal van de huidige gebruiker (uit zijn instellingen, '' = automatisch); de server vertaalt daarmee zijn teksten.
// Onthoudt de taal van de browser bij instelling 'automatisch', zodat ook mails zonder verzoek in die taal gaan.
export function rememberBrowserLang(l) {
  const st = als.getStore(); if (!st?.user || !l) return;
  const row = docGet.get(uid(st.user), 'settings'); const s = parse(row?.json, null);
  if (!s || s.lang || s.langSeen === l) return;
  docPut.run(uid(st.user), 'settings', JSON.stringify({ ...s, langSeen: l }));
}
export function currentLang() {
  const st = als.getStore();
  if (!st?.user) return '';
  // eigen keuze, anders de taal van de browser die de gebruiker het laatst gebruikte (voor mails bij automatisch syncen)
  if (st.lang === undefined) { try { const s = parse(docGet.get(uid(st.user), 'settings')?.json, {}); st.lang = s.lang || s.langSeen || ''; } catch { st.lang = ''; } }
  return st.lang;
}
// De gebruiker van het lopende verzoek.
export const currentUser = () => als.getStore()?.user || null;
// Id van de huidige gebruiker; gooit een fout als er geen is.
function uid(u = currentUser()) {
  if (!u?.id || !/^[a-z0-9_-]{1,40}$/.test(u.id)) throw Object.assign(new Error('Geen gebruiker in context'), { status: 401 });
  return u.id;
}
// Map met de Speediance-login van de huidige gebruiker (voor de speediance-cli).
export const speedianceDir = (u) => path.join(DATA_DIR, 'users', uid(u), 'speediance');

// ---------- documenten per gebruiker ----------
const docGet = db.prepare('SELECT json FROM user_docs WHERE user_id = ? AND name = ?');
const docPut = db.prepare(`INSERT INTO user_docs(user_id, name, json, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(user_id, name) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`);
const uRead = async (name, fb) => parse(docGet.get(uid(), name)?.json, fb);
const uWrite = async (name, v) => { docPut.run(uid(), name, JSON.stringify(v)); };

// ---------- instellingen ----------
export const DEFAULT_SETTINGS = {
  goal: 'combinatie', daysPerWeek: 3, minutesPerSession: 45, experience: 'beginner', deloadEveryWeeks: 6,
  warmup: 'on', cooldown: 'on', pushMobility: 'on', avoidIds: [], noAccessories: [], lang: '', overrides: {}, notes: '', syncDays: 120,
  segmentNames: {}, email: '', mailSummary: 'off', heightCm: null, sex: '', bandSex: '', figure: '', birthYear: null, birthDate: null, hrMax: null, stepGoal: 8000, prefsConfirmed: false, termsVersion: 0, termsAt: null,
  outcome: null, alignPlan: false,
};
export const DEFAULT_GLOBAL = {
  autoSyncHours: 3,
  ai: { provider: 'none', model: 'claude-sonnet-5-5', baseUrl: 'http://localhost:8080/v1', apiKey: '' },
  withings: { clientId: '', clientSecret: '', redirectUri: '' },
  smtp: { host: '', port: 587, security: 'starttls', verify: 'on', user: '', pass: '', from: '', appUrl: '' },
};
const gGet = db.prepare('SELECT json FROM global_settings WHERE key = ?');
const gPut = db.prepare('INSERT INTO global_settings(key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json');

// Gedeelde instellingen (AI, Withings-app, sync, SMTP).
export async function getGlobal() {
  const g = parse(gGet.get('global')?.json, DEFAULT_GLOBAL);
  return { ...DEFAULT_GLOBAL, ...g, ai: { ...DEFAULT_GLOBAL.ai, ...(g.ai || {}) }, withings: { ...DEFAULT_GLOBAL.withings, ...(g.withings || {}) }, smtp: { ...DEFAULT_GLOBAL.smtp, ...(g.smtp || {}) } };
}
// Bewaart de gedeelde instellingen.
export const saveGlobal = async (g) => { gPut.run('global', JSON.stringify(g)); };

// Instellingen van de huidige gebruiker, aangevuld met de standaardwaarden en de gedeelde instellingen.
export async function getSettings() {
  const [s, g] = await Promise.all([uRead('settings', DEFAULT_SETTINGS), getGlobal()]);
  const own = { ...DEFAULT_SETTINGS, ...s };
  return { ...own, autoSyncHours: g.autoSyncHours, ai: g.ai, smtp: g.smtp, withings: { ...g.withings, segmentNames: own.segmentNames || {} } };
}
// Bewaart de eigen instellingen van de gebruiker (alleen bekende sleutels; gedeelde instellingen via saveGlobal).
export async function saveSettings(s) {
  const own = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (s[k] !== undefined) own[k] = s[k];
  if (s.withings?.segmentNames) own.segmentNames = s.withings.segmentNames;
  await uWrite('settings', own);
}

// Het huidige weekplan.
export const getPlan = () => uRead('plan', null);
// Bewaart het weekplan.
// Elke versie gaat ook naar het archief onder de kalenderweek van het plan, zodat je vorige weken kunt terugkijken
// (per week de laatste versie).
export const savePlan = async (p) => { await uWrite('plan', p); if (p?.sessions) archivePlan(p); };

// Kalenderweek (ISO, "2026-W45") van een datum; zelfde rekenwijze als engine.isoWeek.
function isoWeekOf(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}
// Bewaart een weekplan in het archief (overschrijft dezelfde week).
export function archivePlan(p) {
  const week = isoWeekOf(new Date(p.generatedAt || Date.now()));
  db.prepare('INSERT INTO plan_archive (user_id, week, json, saved_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, week) DO UPDATE SET json = excluded.json, saved_at = excluded.saved_at')
    .run(uid(), week, JSON.stringify(p), new Date().toISOString());
  return week;
}
// Weken in het archief, nieuwste eerst.
export const listArchivedWeeks = () => db.prepare('SELECT week, saved_at FROM plan_archive WHERE user_id = ? ORDER BY week DESC').all(uid()).map((r) => ({ week: r.week, savedAt: r.saved_at }));
// Het bewaarde plan van één week (of null).
export const getArchivedPlan = (week) => parse(db.prepare('SELECT json FROM plan_archive WHERE user_id = ? AND week = ?').get(uid(), week)?.json, null);
// Overige status per gebruiker (sync, AI-advies, …).
export const getMeta = () => uRead('meta', { lastSync: null, lastSyncError: null, pushes: [] });
// Bewaart de status per gebruiker.
export const saveMeta = (m) => uWrite('meta', m);
// Withings-tokens van de gebruiker.
export const getWithings = () => uRead('withings', {});
// Bewaart de Withings-tokens.
export const saveWithings = (w) => uWrite('withings', w);

// ---------- trainingen ----------
const wAll = db.prepare('SELECT json FROM workouts WHERE user_id = ? ORDER BY date, training_id');
const wPut = db.prepare(`INSERT INTO workouts(user_id, training_id, date, title, json) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, training_id) DO UPDATE SET date = excluded.date, title = excluded.title, json = excluded.json`);
// Lijst met trainingen (kop: datum, titel, duur, kcal).
export const getWorkouts = async () => wAll.all(uid()).map((r) => JSON.parse(r.json));
// Bewaart de lijst met trainingen.
export async function saveWorkouts(list) {
  const u = uid();
  tx(() => { for (const w of list) wPut.run(u, String(w.training_id), w.date ?? null, w.title ?? null, JSON.stringify(w)); });
}

const sAll = db.prepare('SELECT training_id, json FROM training_sessions WHERE user_id = ?');
const sPut = db.prepare(`INSERT INTO training_sessions(user_id, training_id, date, json) VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id, training_id) DO UPDATE SET date = excluded.date, json = excluded.json`);
// Details per training (sets en herhalingen), op training-id.
export const getSessions = async () => Object.fromEntries(sAll.all(uid()).map((r) => [r.training_id, JSON.parse(r.json)]));
// Bewaart trainingsdetails.
export async function saveSessions(map) {
  const u = uid();
  tx(() => { for (const [id, s] of Object.entries(map)) sPut.run(u, String(id), s?.date ?? null, JSON.stringify(s)); });
}

// ---------- lichaamsmetingen ----------
const bAll = db.prepare('SELECT json FROM body_measurements WHERE user_id = ? ORDER BY date');
const bDelAll = db.prepare('DELETE FROM body_measurements WHERE user_id = ?');
const bPut = db.prepare('INSERT INTO body_measurements(user_id, date, kg, fat, source, json) VALUES (?, ?, ?, ?, ?, ?)');
// Lichaamsmetingen (Withings en handmatig).
export const getBodyLog = async () => bAll.all(uid()).map((r) => JSON.parse(r.json));
// Bewaart lichaamsmetingen.
export async function saveBodyLog(list) {
  const u = uid();
  tx(() => {
    bDelAll.run(u);
    for (const b of list) bPut.run(u, b.date, b.kg ?? null, b.fat ?? null, b.source ?? null, JSON.stringify(b));
  });
}

// ---------- activiteiten uit Apple Health ----------
const actAll = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY start, date');
const actPut = db.prepare(`INSERT INTO activities(user_id, id, date, start, type, name, minutes, km, kcal, hr_avg, hr_max, source, json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(user_id, id) DO UPDATE SET date=excluded.date, start=excluded.start, type=excluded.type, name=excluded.name, minutes=excluded.minutes,
  km=excluded.km, kcal=excluded.kcal, hr_avg=excluded.hr_avg, hr_max=excluded.hr_max, source=excluded.source, json=excluded.json`);
const actDel = db.prepare('DELETE FROM activities WHERE user_id = ? AND id = ?');
// soort en Nederlandse naam altijd opnieuw uit de naam bepalen, zodat ook oudere gegevens de nieuwste indeling krijgen
export const getActivities = async () => actAll.all(uid()).map((r) => ({ id: r.id, date: r.date, start: r.start, ...classify(r.name), name: r.name, minutes: r.minutes, km: r.km, kcal: r.kcal, hrAvg: r.hr_avg, hrMax: r.hr_max, source: r.source }));
// Bewaart activiteiten uit Apple Health (bestaande op id worden bijgewerkt).
export async function saveActivities(list) {
  const u = uid();
  tx(() => { for (const a of list) actPut.run(u, a.id, a.date, a.start ?? null, a.type ?? null, a.name ?? null, a.minutes ?? null, a.km ?? null, a.kcal ?? null, a.hrAvg ?? null, a.hrMax ?? null, a.source ?? null, JSON.stringify(a)); });
}
const actDay = db.prepare('SELECT json FROM activities WHERE user_id = ? AND date = ? ORDER BY start');
// Activiteiten op één dag.
export const getActivitiesOn = async (date) => actDay.all(uid(), String(date)).map((r) => { const a = parse(r.json, {}); return { ...a, ...classify(a.name) }; });
// Verwijdert een activiteit.
export async function deleteActivity(id) { actDel.run(uid(), String(id)); }
const dayAll = db.prepare('SELECT date, steps, active_kcal, walk_km, rest_hr, hrv, vo2max, intake_kcal, protein_g, carbs_g, fat_g, fiber_g, intake_source FROM health_daily WHERE user_id = ? ORDER BY date');
const dayPut = db.prepare(`INSERT INTO health_daily(user_id, date, steps, active_kcal, walk_km, rest_hr, hrv, vo2max, intake_kcal, protein_g, carbs_g, fat_g, fiber_g, intake_source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(user_id, date) DO UPDATE SET steps=COALESCE(excluded.steps, steps), active_kcal=COALESCE(excluded.active_kcal, active_kcal), walk_km=COALESCE(excluded.walk_km, walk_km), rest_hr=COALESCE(excluded.rest_hr, rest_hr), hrv=COALESCE(excluded.hrv, hrv), vo2max=COALESCE(excluded.vo2max, vo2max), intake_kcal=COALESCE(excluded.intake_kcal, intake_kcal), protein_g=COALESCE(excluded.protein_g, protein_g), carbs_g=COALESCE(excluded.carbs_g, carbs_g), fat_g=COALESCE(excluded.fat_g, fat_g), fiber_g=COALESCE(excluded.fiber_g, fiber_g), intake_source=COALESCE(excluded.intake_source, intake_source)`);
// Dagwaarden uit Apple Health (stappen, energie, afstand, rusthartslag, HRV, VO2max, inname).
export const getHealthDaily = async () => dayAll.all(uid()).map((r) => ({ date: r.date, steps: r.steps, activeKcal: r.active_kcal, walkKm: r.walk_km, restHr: r.rest_hr, hrv: r.hrv, vo2max: r.vo2max, intakeKcal: r.intake_kcal, proteinG: r.protein_g, carbsG: r.carbs_g, fatG: r.fat_g, fiberG: r.fiber_g, intakeSource: r.intake_source }));
// Bewaart dagwaarden (per dag samengevoegd). Een lege waarde laat de oude staan.
export async function saveHealthDaily(map) {
  const u = uid();
  tx(() => { for (const [date, d] of Object.entries(map)) dayPut.run(u, date, d.steps ?? null, d.activeKcal ?? null, d.walkKm ?? null, d.restHr ?? null, d.hrv ?? null, d.vo2max ?? null, d.intakeKcal ?? null, d.proteinG ?? null, d.carbsG ?? null, d.fatG ?? null, d.fiberG ?? null, d.intakeSource ?? null); });
}
// koppelsleutel voor Apple Health: gebruiker zoeken op de hash van de sleutel
const healthDocs = db.prepare("SELECT user_id, json FROM user_docs WHERE name = 'health'");
// De gebruiker bij een Apple Health-koppelsleutel.
export function userIdForHealthToken(hash) {
  for (const r of healthDocs.all()) { try { if (JSON.parse(r.json).tokenHash === hash) return r.user_id; } catch {} }
  return null;
}
// hartslag/calorieën uit Apple Health per Gym Monster-training: { [trainingId]: { hrAvg, hrMax, kcal, … } }
export const getWorkoutHealth = () => uRead('workoutHealth', {});
// Bewaart Apple Health-gegevens bij een Gym Monster-training (start, hartslagverloop, kcal).
export const saveWorkoutHealth = (v) => uWrite('workoutHealth', v);
// Gegevens van de Apple Health-koppeling (hash van de sleutel, laatst ontvangen).
export const getHealthLink = () => uRead('health', {});
// Bewaart de Apple Health-koppeling.
export const saveHealthLink = (v) => uWrite('health', v);

// ---------- gedeeld ----------
const libGet = db.prepare('SELECT json FROM exercise_library WHERE device_type = ?');
const libPut = db.prepare(`INSERT INTO exercise_library(device_type, json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(device_type) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`);
// De opgeslagen oefeningencatalogus van het toestel.
export const getLibraryCache = async (deviceType = 1) => parse(libGet.get(Number(deviceType))?.json, null);
const libInfo = db.prepare('SELECT updated_at, json_array_length(json) AS n FROM exercise_library WHERE device_type = ?');
// Grootte en datum van de opgeslagen catalogus.
export const getLibraryInfo = (deviceType = 1) => { const r = libInfo.get(Number(deviceType)); return r ? { updatedAt: r.updated_at, count: r.n } : null; };
// Bewaart de oefeningencatalogus.
export const saveLibraryCache = async (l, deviceType = 1) => { libPut.run(Number(deviceType), JSON.stringify(l)); };

const usersAll = db.prepare('SELECT u.*, a.updated_at AS avatar_v FROM users u LEFT JOIN avatars a ON a.user_id = u.id ORDER BY u.created_at, u.username');
const userPut = db.prepare(`INSERT INTO users(id, username, name, role, pass_salt, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET username = excluded.username, name = excluded.name, role = excluded.role, pass_salt = excluded.pass_salt, pass_hash = excluded.pass_hash`);
const userDel = db.prepare('DELETE FROM users WHERE id = ?');
// Alle gebruikers.
export const getUsers = async () => usersAll.all().map((r) => ({ id: r.id, username: r.username, name: r.name, role: r.role, pass: { salt: r.pass_salt, hash: r.pass_hash }, createdAt: r.created_at, avatar: r.avatar_v || null }));
// Bewaart de gebruikers.
export async function saveUsers(list) {
  tx(() => {
    const keep = new Set(list.map((u) => u.id));
    for (const r of usersAll.all()) if (!keep.has(r.id)) userDel.run(r.id);
    for (const u of list) userPut.run(u.id, u.username, u.name, u.role, u.pass.salt, u.pass.hash, u.createdAt ?? new Date().toISOString());
  });
}

// profielfoto's
const avGet = db.prepare('SELECT mime, data, updated_at FROM avatars WHERE user_id = ?');
const avPut = db.prepare(`INSERT INTO avatars(user_id, mime, data, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at`);
const avDel = db.prepare('DELETE FROM avatars WHERE user_id = ?');
// Profielfoto van een gebruiker.
export const getAvatar = (userId) => avGet.get(String(userId)) || null;
// Bewaart een profielfoto.
export function setAvatar(userId, mime, buf) { const v = Date.now(); avPut.run(String(userId), mime, buf, v); return v; }
// Verwijdert een profielfoto.
export const deleteAvatar = (userId) => { avDel.run(String(userId)); };

const sessAll = db.prepare('SELECT * FROM auth_sessions');
const sessDelAll = db.prepare('DELETE FROM auth_sessions');
const sessPut = db.prepare('INSERT INTO auth_sessions(token, user_id, created, expires) VALUES (?, ?, ?, ?)');
// Inlogsessies.
export const getAuthSessions = async () => Object.fromEntries(sessAll.all().map((r) => [r.token, { userId: r.user_id, created: r.created, expires: r.expires }]));
// Bewaart inlogsessies.
export async function saveAuthSessions(map) {
  tx(() => {
    sessDelAll.run();
    for (const [t, s] of Object.entries(map)) sessPut.run(t, s.userId, s.created, s.expires);
  });
}

// ---------- import van JSON-bestanden (oudere versies) ----------
async function readJsonFile(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return undefined; } }
const markImported = (file) => rename(file, file + '.imported').catch(() => {});

// Importeert oude JSON-bestanden (van vóór de database) en hernoemt ze naar .imported.
async function importUserFiles(user, dir) {
  const items = [];
  const load = async (f) => { const p = path.join(dir, f); const v = await readJsonFile(p); if (v !== undefined) items.push(p); return v; };
  await runAs(user, async () => {
    const settings = await load('settings.json');
    if (settings) {
      const own = {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) if (settings[k] !== undefined) own[k] = settings[k];
      if (settings.withings?.segmentNames) own.segmentNames = settings.withings.segmentNames;
      await uWrite('settings', own);
      if (settings.ai || settings.withings?.clientId) { // oude enkele-gebruiker-instellingen → gedeeld
        const g = await getGlobal();
        await saveGlobal({ ...g, autoSyncHours: settings.autoSyncHours ?? g.autoSyncHours, ai: { ...g.ai, ...(settings.ai || {}) },
          withings: { clientId: settings.withings?.clientId || g.withings.clientId, clientSecret: settings.withings?.clientSecret || g.withings.clientSecret, redirectUri: settings.withings?.redirectUri || g.withings.redirectUri } });
      }
    }
    const w = await load('workouts.json'); if (w) await saveWorkouts(w);
    const s = await load('sessions.json'); if (s) await saveSessions(s);
    const b = await load('bodyweight.json'); if (b) await saveBodyLog(b);
    for (const [f, n] of [['plan.json', 'plan'], ['meta.json', 'meta'], ['withings.json', 'withings']]) { const v = await load(f); if (v != null) await uWrite(n, v); }
  });
  for (const p of items) await markImported(p);
  return items.map((p) => path.basename(p));
}

// Eenmalige import van de JSON-opslag (multi-user versie zonder database).
export async function importJsonStore() {
  const usersFile = path.join(DATA_DIR, 'users.json');
  if (!existsSync(usersFile) || (await getUsers()).length) return null;
  const users = (await readJsonFile(usersFile)) || [];
  await saveUsers(users);
  const sess = await readJsonFile(path.join(DATA_DIR, 'sessions-auth.json'));
  if (sess) await saveAuthSessions(Object.fromEntries(Object.entries(sess).filter(([, v]) => users.some((u) => u.id === v.userId))));
  const g = await readJsonFile(path.join(DATA_DIR, 'global.json'));
  if (g) await saveGlobal(g);
  for (const f of await readdir(DATA_DIR)) {
    const m = /^library-(\d+)\.json$/.exec(f);
    if (m) { const l = await readJsonFile(path.join(DATA_DIR, f)); if (l) { await saveLibraryCache(l, Number(m[1])); await markImported(path.join(DATA_DIR, f)); } }
  }
  const imported = {};
  for (const u of users) imported[u.username] = await importUserFiles(u, path.join(DATA_DIR, 'users', u.id));
  for (const f of ['users.json', 'sessions-auth.json', 'global.json']) await markImported(path.join(DATA_DIR, f));
  return imported;
}

// Koppelt gegevens van de oudste (enkele-gebruiker) versie aan de eerste beheerder.
export async function migrateLegacy(user, legacySpeedianceConfig) {
  const moved = await importUserFiles(user, DATA_DIR);
  try { const lib = await readJsonFile(path.join(DATA_DIR, 'library.json')); if (lib) { await saveLibraryCache(lib, 1); await markImported(path.join(DATA_DIR, 'library.json')); } } catch {}
  if (legacySpeedianceConfig) {
    try {
      await stat(legacySpeedianceConfig);
      const sd = path.join(DATA_DIR, 'users', user.id, 'speediance');
      await mkdir(sd, { recursive: true, mode: 0o700 });
      if (!existsSync(path.join(sd, 'config.json'))) {
        await copyFile(legacySpeedianceConfig, path.join(sd, 'config.json'));
        await chmod(path.join(sd, 'config.json'), 0o600);
        moved.push('speediance-config');
      }
    } catch {}
  }
  return moved;
}

// Zet de rechten van de datamap op 700/600.
export async function hardenPermissions() {
  try { await chmod(DATA_DIR, 0o700); } catch {}
  for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) await chmod(f, 0o600).catch(() => {});
}

// Consistente back-up van de database (ook terwijl de app draait).
export function backupTo(file) {
  db.exec(`VACUUM INTO '${String(file).replace(/'/g, "''")}'`);
}

// ---------- gedeelde cache met uitleg en beelden per oefening (voor alle gebruikers) ----------
const infoGet = db.prepare('SELECT json, fetched_at FROM exercise_info WHERE group_id = ? AND lang = ?');
const infoPut = db.prepare('INSERT OR REPLACE INTO exercise_info(group_id, lang, json, fetched_at) VALUES (?, ?, ?, ?)');
// Opgeslagen gegevens van een oefening in een taal, of null.
export function getExerciseInfo(id, lang) {
  const r = infoGet.get(Number(id), String(lang));
  return r ? { info: parse(r.json, null), fetchedAt: r.fetched_at } : null;
}
// Bewaart de gegevens van een oefening in een taal.
export function saveExerciseInfo(id, lang, info) {
  infoPut.run(Number(id), String(lang), JSON.stringify(info), new Date().toISOString());
}

// ---------- sjablonen: eigen trainingen, eventueel gedeeld met andere gebruikers op deze server ----------
const tplRow = (r) => r && { ...parse(r.json, {}), id: r.id, ownerId: r.owner_id, name: r.name, shared: !!r.shared, updatedAt: r.updated_at };
const tplAll = db.prepare('SELECT * FROM templates WHERE owner_id = ? OR shared = 1 ORDER BY name COLLATE NOCASE');
const tplOne = db.prepare('SELECT * FROM templates WHERE id = ?');
const tplPut = db.prepare('INSERT OR REPLACE INTO templates(id, owner_id, name, json, shared, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
const tplDel = db.prepare('DELETE FROM templates WHERE id = ? AND owner_id = ?');
// Eigen sjablonen en die anderen gedeeld hebben.
export const listTemplates = () => tplAll.all(uid()).map(tplRow);
// Eén sjabloon (eigen of gedeeld), of null.
export function getTemplate(id) {
  const t = tplRow(tplOne.get(String(id)));
  return t && (t.ownerId === uid() || t.shared) ? t : null;
}
// Bewaart een eigen sjabloon (alleen de maker kan wijzigen).
export function saveTemplate({ id, name, shared = false, body }) {
  const cur = tplOne.get(String(id));
  if (cur && cur.owner_id !== uid()) throw Object.assign(new Error('Alleen de maker kan dit sjabloon wijzigen'), { status: 403 });
  tplPut.run(String(id), uid(), String(name).slice(0, 40), JSON.stringify(body), shared ? 1 : 0, new Date().toISOString());
  return getTemplate(id);
}
// Verwijdert een eigen sjabloon.
export const deleteTemplate = (id) => tplDel.run(String(id), uid()).changes > 0;
