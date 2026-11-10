// GymCoach — lokaal trainingsdashboard voor de Speediance Gym Monster (meerdere gebruikers).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cli from './lib/cli.js';
import * as store from './lib/store.js';
import * as engine from './lib/engine.js';
import { ALL_LANGS, resolveLang } from './public/i18n.js';
import { tr, userLang, parseAccept, err } from './lib/lang.js';
// taal voor uitleg en beelden van Speediance: die van de gebruiker als Speediance hem goed levert, anders Engels
const infoLang = () => (exinfo.INFO_LANGS.includes(userLang()) ? userLang() : 'en');
import * as insights from './lib/insights.js';
import * as signals from './lib/signals.js';
import * as muscleRec from './lib/muscleRecovery.js';
import * as goal from './lib/goal.js';
import * as phone from './lib/phone.js';
import { TERMS_VERSION } from './public/terms.js';
import * as ai from './lib/ai.js';
import * as withings from './lib/withings.js';
import * as speediance from './lib/speediance.js';
import * as auth from './lib/auth.js';
import * as health from './lib/health.js';
import * as mail from './lib/mail.js';
import { workoutPdf, workoutMail } from './lib/summary.js';
import { figureFor } from './public/bodymap.js';
import * as exinfo from './lib/exinfo.js';
import * as ghUpdate from './lib/update.js';
import { createReadStream } from 'node:fs';
import { stat as fsStat } from 'node:fs/promises';
import { homedir } from 'node:os';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8765);
const STARTED = new Date().toISOString();
export const VERSION = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8')).version;
const HOST = process.env.HOST || '0.0.0.0';
// achter een reverse proxy (Plesk/nginx, Cloudflare): echte bezoekers-IP en https uit de headers halen
const TRUST_PROXY = /^(1|true|yes|ja)$/i.test(process.env.TRUST_PROXY || '');
const clientIp = (req) => (TRUST_PROXY && (req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())) || req.socket.remoteAddress;
const isHttps = (req) => TRUST_PROXY && /https/i.test(String(req.headers['x-forwarded-proto'] || ''));
const LEGACY_SPEEDIANCE_CONFIG = process.env.SPEEDIANCE_CONFIG || path.join(homedir(), '.config', 'speediance', 'config.json');

// ---------- helpers ----------

const libraryMem = new Map(); // deviceType -> catalogus
// Het toesteltype van de gebruiker (Gym Monster-model) voor de catalogus.
async function deviceType() {
  try { return Number(JSON.parse(await readFile(path.join(store.speedianceDir(store.currentUser()), 'config.json'), 'utf8')).device_type || 1); } catch { return 1; }
}
// Oefeningencatalogus per toesteltype. Hij wordt opgehaald van het Speediance-account zodra dat gekoppeld is.
// Zonder opgehaalde catalogus: alleen voor de Gym Monster 1 een ingebouwde standaardlijst, anders leeg.
async function getLibrary() {
  if (!hasSpeediance()) return [];
  const dt = await deviceType();
  if (libraryMem.has(dt)) return libraryMem.get(dt);
  const cached = await store.getLibraryCache(dt);
  const lib = cached || (dt === 1 ? JSON.parse(await readFile(path.join(ROOT, 'lib', 'library.snapshot.json'), 'utf8')) : []);
  if (cached) libraryMem.set(dt, lib);
  return lib;
}
// Of de oefeningencatalogus geladen is en hoe oud hij is.
async function libraryStatus() {
  if (!hasSpeediance()) return { source: null, count: 0, deviceType: null };
  const dt = await deviceType();
  const info = store.getLibraryInfo(dt);
  if (info) return { source: 'account', count: info.count, updatedAt: info.updatedAt, deviceType: dt };
  return { source: dt === 1 ? 'standaard' : null, count: dt === 1 ? (await getLibrary()).length : 0, deviceType: dt };
}
// Haalt de oefeningencatalogus van het toestel opnieuw op.
async function refreshLibrary() {
  const lib = await cli.library();
  if (!lib?.length) throw new Error(tr('srv.legeCatalogusOntvangen'));
  const dt = await deviceType();
  await store.saveLibraryCache(lib, dt);
  libraryMem.set(dt, lib);
  return lib.length;
}
const isAdmin = () => store.currentUser()?.role === 'admin';

let changelogCache;
// Wijzigingen uit CHANGELOG.md, eenmaal gelezen.
function readChangelog() {
  if (changelogCache) return changelogCache;
  try { changelogCache = ghUpdate.parseChangelog(readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8')); }
  catch { changelogCache = []; }
  return changelogCache;
}
const requireAdmin = () => { if (!isAdmin()) throw Object.assign(new Error(tr('srv.alleenVoorBeheerders')), { status: 403 }); };

// Alles wat de engine nodig heeft voor de huidige gebruiker: instellingen, catalogus, historie, trainingen, metingen.
async function context() {
  const [settings, sessions, workouts, bodyLog, library] = await Promise.all([
    store.getSettings(), store.getSessions(), store.getWorkouts(), store.getBodyLog(), getLibrary(),
  ]);
  const history = engine.buildHistory(sessions, library);
  return { settings, sessions, workouts, bodyLog, library, history };
}

// Oefeningen die de AI mag voorstellen: uit de catalogus, zonder vermeden oefeningen.
function allowedExercises(library, settings) {
  const ids = new Set(Object.values(engine.PATTERNS).flatMap((p) => p.ids));
  return engine.usableLibrary(library, settings).filter((e) => ids.has(Number(e.id)) && !settings.avoidIds.includes(Number(e.id))).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle }));
}

const mask = (v) => (v ? '••••' + v.slice(-4) : '');
const maskSettings = (s) => ({ ...s, ai: { ...s.ai, apiKey: mask(s.ai.apiKey) }, withings: { ...s.withings, clientSecret: mask(s.withings.clientSecret) },
  smtp: isAdmin() ? { ...s.smtp, pass: mask(s.smtp?.pass) } : { configured: mail.isConfigured(s.smtp) } });

// ---------- trainingssamenvatting (PDF + e-mail) ----------
async function workoutDetailFor(id, ctx) {
  ctx ||= await context();
  const w = ctx.workouts.find((x) => String(x.training_id) === String(id));
  const s = ctx.sessions[String(id)];
  if (!w && !s) throw Object.assign(new Error(tr('srv.trainingNietGevonden')), { status: 404 });
  const wh = await store.getWorkoutHealth();
  const activities = await store.getActivities();
  const d = engine.workoutDetail(w, s, ctx.library, ctx.history, wh[String(id)]);
  d.compare = insights.compare(d, { workouts: ctx.workouts, sessions: ctx.sessions, health: wh, activities });
  d.heart = insights.heart(d, wh[String(id)], ctx.settings);
  // duur, calorieën en hartslag van het rapport: deze gymsessie plus Apple Health-workouts van dezelfde kalenderdag
  const sets = d.exercises.reduce((n, e) => n + e.sets.length, 0);
  const day = insights.dayTotals({
    date: d.date, minutes: d.minutes, calories: d.calories ?? d.healthKcal, hrAvg: d.hrAvg, hrMax: d.hrMax, sets, volume: d.volume,
  }, activities);
  if (day.included) {
    if (day.minutes != null) d.minutes = Math.round(day.minutes);
    if (day.calories != null) d.calories = Math.round(day.calories);
    if (day.hrAvg != null) d.hrAvg = Math.round(day.hrAvg);
    if (day.hrMax != null) d.hrMax = Math.round(day.hrMax);
    d.dayHealth = true;
  }
  // cardio die eindigde binnen 3 uur vóór deze training (Apple Health)
  d.cardioBefore = s ? signals.cardioBefore(signals.sessionStart(s, wh[String(id)]), activities) : null;
  return d;
}
// Apple Health-activiteiten van dezelfde dag, voor de PDF. Het scherm laadt ze apart.
async function withDayActs(d, settings) {
  const acts = await store.getActivitiesOn(String(d.date || '').slice(0, 10));
  d.dayActs = acts.map((a) => ({ ...a, heart: insights.heart({}, { hrSeries: a.hrSeries }, settings) }));
  return d;
}
// Mailt het trainingsrapport (met PDF) naar de gebruiker.
async function mailWorkout(id, ctx) {
  const settings = ctx?.settings || await store.getSettings();
  const d = await withDayActs(await workoutDetailFor(id, ctx), settings);
  const user = store.currentUser();
  const m = workoutMail(d, { userName: user.name, appUrl: settings.smtp.appUrl });
  await mail.send(settings.smtp, {
    to: settings.email, subject: m.subject, text: m.text, html: m.html,
    attachments: [{ filename: `GymCoach ${d.date} ${d.title.replace(/[^\w .-]+/g, '')}.pdf`, contentType: 'application/pdf', content: workoutPdf(d, { userName: user.name, figure: figureFor(settings) }) }],
  });
  return d;
}

const syncing = new Map(); // userId -> promise
// Speediance heeft geen "alles"-optie: vraag een ruime periode op, met kleinere terugval als de API die weigert.
async function allWorkouts() {
  let last;
  for (const days of [3650, 1825, 730, 365]) {
    try { return await cli.workouts(days); }
    catch (e) { if (e.authFailure) throw e; last = e; console.warn(`workouts --days ${days}: ${e.message}`); }
  }
  throw last;
}

const hasSpeediance = () => existsSync(path.join(store.speedianceDir(store.currentUser()), 'config.json'));

// Haalt nieuwe trainingen op bij Speediance, met details per set, en mailt het rapport van nieuwe trainingen.
async function sync() {
  const uid = store.currentUser().id;
  if (!hasSpeediance()) throw Object.assign(new Error(tr('srv.vulEerstJeSpeediance')), { status: 400 });
  if (syncing.has(uid)) return syncing.get(uid);
  const job = (async () => {
    const meta = await store.getMeta();
    try {
      const settings = await store.getSettings();
      // eerste keer (of op verzoek): de volledige historie; daarna alleen de laatste weken
      let list;
      if (!meta.fullHistoryAt) {
        list = await allWorkouts();
        meta.fullHistoryAt = new Date().toISOString();
        console.log(`volledige trainingshistorie opgehaald: ${list.length} trainingen`);
      } else list = await cli.workouts(Math.max(30, Number(settings.syncDays) || 30));
      const old = await store.getWorkouts();
      const merged = new Map(old.map((w) => [String(w.training_id), w]));
      for (const w of list) merged.set(String(w.training_id), w);
      const all = [...merged.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      await store.saveWorkouts(all);

      const sessions = await store.getSessions();
      let fetched = 0; const newIds = [];
      for (const w of all) {
        const id = String(w.training_id);
        if (sessions[id]) continue;
        try {
          const d = await cli.session(id);
          sessions[id] = { ...d, date: w.date, title: w.title };
          fetched++;
          newIds.push(id);
          // meteen opslaan, zodat de app al gegevens toont tijdens een lange (eerste) sync
          await store.saveSessions({ [id]: sessions[id] });
        } catch (e) { console.warn(`session ${id}: ${e.message}`); }
      }
      Object.assign(meta, { lastSync: new Date().toISOString(), lastSyncError: null, lastSyncFetched: fetched });
      // samenvatting mailen voor nieuwe trainingen van de laatste 2 dagen (niet bij het ophalen van oude historie)
      if (settings.mailSummary === 'on' && settings.email && mail.isConfigured(settings.smtp)) {
        const recent = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
        const mailed = new Set(meta.mailed || []);
        const todo = newIds.filter((id) => !mailed.has(id) && String(all.find((w) => String(w.training_id) === id)?.date || '').slice(0, 10) >= recent);
        if (todo.length) {
          const mctx = await context();
          for (const id of todo.slice(0, 5)) {
            try { await mailWorkout(id, mctx); mailed.add(id); console.log(`samenvatting gemaild: ${id}`); meta.lastMailError = null; }
            catch (e) { console.warn(`mail ${id}: ${e.message}`); meta.lastMailError = e.message; }
          }
          meta.mailed = [...mailed].slice(-300);
        }
      }
      if ((await withings.status()).connected) {
        try { meta.withings = await withings.syncWeight(settings); }
        catch (e) { console.warn('withings:', e.message); await withings.recordError(e.message); }
      }
    } catch (e) {
      Object.assign(meta, { lastSyncError: e.message, lastSyncErrorAt: new Date().toISOString() });
      throw e;
    } finally {
      await store.saveMeta(meta);
      syncing.delete(uid);
    }
    return meta;
  })();
  syncing.set(uid, job);
  return job;
}

// Herberekent de spierkaart van een plan na een wijziging.
function refreshMuscles(plan) {
  const total = {};
  for (const s of plan.sessions) {
    s.muscles = engine.sessionMuscles(s);
    for (const [k, v] of Object.entries(s.muscles)) total[k] = (total[k] || 0) + v;
  }
  plan.muscles = total;
  return plan;
}

// Herstelscore en afvaltempo voor de huidige gebruiker (zie lib/signals.js).
async function userSignals(ctx) {
  const daily = await store.getHealthDaily();
  const view = await goalView(ctx, daily);
  const intake = view.intake && view.calc?.ok ? { kcal: view.intake.kcal, target: view.calc.target, protein: view.intake.protein, proteinTarget: view.calc.protein, days: view.intake.days, below: view.below } : null;
  return { recovery: signals.recovery({ daily, bodyLog: ctx.bodyLog, history: ctx.history }), weightLoss: signals.weightLoss(ctx.bodyLog), ...(intake && { intake }) };
}

// Streefinname en het opgeslagen doel. Lengte uit Withings telt mee als die niet zelf is ingevuld.
async function goalView(ctx, daily = null) {
  const w = await store.getWithings();
  const heightCm = ctx.settings.heightCm || (w.height ? Math.round(w.height * 100) : null);
  return goal.assemble({
    settings: { ...ctx.settings, heightCm },
    bodyLog: ctx.bodyLog, daily: daily || await store.getHealthDaily(), history: ctx.history, today: goal.todayISO(),
  });
}

// Maakt een nieuw weekplan met de regels-engine en bewaart het.
async function generatePlan(prefs) {
  const ctx = await context();
  // eerder een lichtere week als de herstelscore 'rustig aan' zegt en er de laatste 3 weken geen deload was
  const sig = await userSignals(ctx);
  const recentDeload = store.listArchivedWeeks().slice(0, 3).some((w) => store.getArchivedPlan(w.week)?.deload);
  const earlyDeload = sig.recovery?.state === 'easy' && !recentDeload;
  const week = engine.weekNumber(ctx.sessions);
  const prev = await store.getPlan();
  const focus = prefs?.focus ?? prev?.focus ?? [];
  const wish = prefs?.wish ?? prev?.wish ?? '';
  const dayTypes = prefs?.dayTypes ?? prev?.dayTypes ?? null;
  const snapshot = JSON.parse(await readFile(path.join(ROOT, 'lib', 'library.snapshot.json'), 'utf8'));
  // alleen oefeningen met accessoires die je gebruikt (Instellingen → Training)
  const plan = engine.buildPlan({ settings: ctx.settings, library: engine.usableLibrary(ctx.library, ctx.settings), history: ctx.history, week, focus, wish, snapshot, dayTypes, earlyDeload });
  // vastgezette trainingen blijven staan, met progressie op basis van de historie (behalve bij vast gewicht)
  for (const ls of (prev?.sessions || []).filter((x) => x.locked)) {
    const kept = engine.progressSession(ls, ctx.history);
    const i = plan.sessions.findIndex((x) => x.key === ls.key);
    if (i >= 0) plan.sessions[i] = kept; else plan.sessions.push(kept);
  }
  engine.placeStrengthLift(plan, { settings: ctx.settings, library: ctx.library, history: ctx.history });
  refreshMuscles(plan);
  await store.savePlan(plan);
  // advies van de AI-coach hoorde bij het vorige plan
  const meta = await store.getMeta();
  if (meta.coach) { delete meta.coach; await store.saveMeta(meta); }
  return plan;
}

// ---------- routes ----------

async function body(req, limit = 2e6) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error(tr('srv.verzoekTeGroot')), { status: 413 }); chunks.push(c); }
  const t = Buffer.concat(chunks).toString('utf8');
  return t ? JSON.parse(t) : {};
}

const routes = {
  'GET /api/state': async () => {
    const ctx = await context();
    const [rawPlan, meta] = await Promise.all([store.getPlan(), store.getMeta()]);
    const plan = engine.localizePlan(rawPlan);
    // eerste keer: stappen voor een nieuwe gebruiker (account, voorkeuren, eerste plan)
    const setup = { terms: Number(ctx.settings.termsVersion) >= TERMS_VERSION, termsAt: ctx.settings.termsAt || null, speediance: hasSpeediance() && !meta.speedianceLoginFailed, prefs: !!ctx.settings.prefsConfirmed || ctx.workouts.length > 0, plan: !!plan && !plan.auto };
    setup.needed = !setup.terms || !setup.speediance || !setup.prefs || !setup.plan;
    if (!setup.speediance) { meta.lastSyncError = null; }
    return {
      version: VERSION,
      setup,
      me: auth.publicUser(store.currentUser()),
      settings: maskSettings(ctx.settings),
      plan, meta,
      planDone: engine.planStatus(plan, ctx.workouts, ctx.sessions),
      weekly: engine.weeklyStats(ctx.workouts),
      recent: ctx.workouts.slice(-15).reverse(),
      activities: (await store.getActivities()).map(({ id, date, start, type, label, name, minutes, km, kcal, hrAvg }) => ({ id, date, start, type, label, name, minutes, km, kcal, hrAvg })),
      trainingDays: await (async () => {
        const wh = await store.getWorkoutHealth();
        return ctx.workouts.map((w) => {
          const id = String(w.training_id), h = wh[id] || {}, ses = ctx.sessions[id];
          return { id, date: String(w.date || '').slice(0, 10), title: w.title || tr('ui.settings.training'), min: w.duration_secs ? Math.round(w.duration_secs / 60) : null,
            kcal: w.calories ?? h.kcal ?? null, vol: Math.round(Number(w.volume) || 0) || null, hr: h.hrAvg ?? null, ex: Array.isArray(ses?.detail) ? ses.detail.length : null };
        }).filter((w) => w.date);
      })(),
      bodyLog: ctx.bodyLog,
      progress: engine.exerciseProgress(ctx.history).slice(0, 30),
      volFactors: engine.volumeFactors(ctx.history), // geplande sets → echt volume (twee handgrepen = 2×)
      patterns: Object.fromEntries(Object.entries(engine.PATTERNS).map(([k, p]) => [k, { label: p.label, type: p.type }])),
      libraryCount: ctx.library.length,
      // accessoires met het aantal oefeningen dat ze nodig heeft, voor Instellingen → Training
      accessories: engine.ACCESSORIES.map((a) => ({ key: a.key, label: a.label, count: ctx.library.filter(a.test).length })),
      library: await libraryStatus(),
      withings: await withings.status(),
      overview: engine.overview({ workouts: ctx.workouts, history: ctx.history, bodyLog: ctx.bodyLog, plan, settings: ctx.settings }),
      muscleRecovery: muscleRec.report(ctx.history, goal.todayISO()),
      week: engine.weekNumber(ctx.sessions),
      signals: await userSignals(ctx),
      // dagwaarden van de Apple Watch voor Lichaam (rusthartslag, HRV, VO2max), het laatste jaar
      healthDaily: (await store.getHealthDaily()).filter((d) => d.date >= new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10) && (d.restHr || d.hrv || d.vo2max))
        .map((d) => ({ date: d.date, restHr: d.restHr ?? undefined, hrv: d.hrv ?? undefined, vo2max: d.vo2max ?? undefined })),
    };
  },
  'GET /api/stats': async (req, url) => {
    const ctx = await context();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : null;
    // met een startdatum: aantal dagen sinds die datum (inclusief vandaag)
    const days = from ? Math.max(1, Math.ceil((Date.now() - new Date(from + 'T00:00:00').getTime()) / 864e5))
      : Math.max(0, Number(url.searchParams.get('days') ?? 84));
    const [activities, daily] = await Promise.all([store.getActivities(), store.getHealthDaily()]);
    const st = engine.stats({ history: ctx.history, workouts: ctx.workouts, sessions: ctx.sessions, activities, daily }, days, from);
    const since = from || (days > 0 ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10) : '0000');
    return { ...st, ...insights.statsExtra({ history: ctx.history, workouts: ctx.workouts, activities, daily, bodyLog: ctx.bodyLog, settings: ctx.settings }, since) };
  },
  'GET /api/analysis': async (req, url) => {
    const ctx = await context();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : null;
    const days = Math.max(0, Number(url.searchParams.get('days') ?? 365));
    const since = from || (days > 0 ? new Date(Date.now() - days * 864e5).toISOString().slice(0, 10) : '0000');
    const [activities, daily, workoutHealth] = await Promise.all([store.getActivities(), store.getHealthDaily(), store.getWorkoutHealth()]);
    return { ...insights.analysis({ history: ctx.history, workouts: ctx.workouts, sessions: ctx.sessions, workoutHealth, activities, daily, bodyLog: ctx.bodyLog }, since),
      cardioBefore: signals.cardioStats({ sessions: ctx.sessions, history: ctx.history, activities, workoutHealth }, since), recoveryScore: signals.recovery({ daily, bodyLog: ctx.bodyLog, history: ctx.history }) };
  },
  'GET /api/workouts': async () => {
    const [workouts, sessions, wh] = await Promise.all([store.getWorkouts(), store.getSessions(), store.getWorkoutHealth()]);
    return {
      workouts: [...workouts].reverse().map((w) => ({
        id: String(w.training_id), date: String(w.date || '').slice(0, 10), title: w.title || tr('ui.settings.training'), kind: w.kind || w.type || '',
        minutes: w.duration_secs ? Math.round(w.duration_secs / 60) : null, calories: w.calories ?? null, volume: Math.round(Number(w.volume) || 0),
        exercises: Array.isArray(sessions[String(w.training_id)]?.detail) ? sessions[String(w.training_id)].detail.length : null,
        hrAvg: wh[String(w.training_id)]?.hrAvg ?? null,
      })),
    };
  },
  'GET /api/workout/pdf': async (req, url) => {
    const settings = await store.getSettings();
    const d = await withDayActs(await workoutDetailFor(url.searchParams.get('id') || ''), settings);
    return { __binary: { type: 'application/pdf', data: workoutPdf(d, { userName: store.currentUser().name, figure: figureFor(settings) }), filename: `GymCoach ${d.date} ${d.title.replace(/[^\w .-]+/g, '')}.pdf` } };
  },
  'POST /api/workout/mail': async (req) => {
    const { id } = await body(req);
    const d = await mailWorkout(String(id || ''));
    return { ok: true, to: (await store.getSettings()).email, title: d.title };
  },
  'POST /api/mail/test': async () => {
    const s = await store.getSettings();
    await mail.send(s.smtp, { to: s.email, subject: 'GymCoach: testmail', text: 'Het versturen van e-mail vanuit GymCoach werkt.', html: '<p>' + tr('srv.hetVersturenVanE') + ' <b>GymCoach</b> ' + tr('srv.werkt') + '</p>' });
    return { ok: true, to: s.email };
  },
  'GET /api/workout': async (req, url) => {
    const id = String(url.searchParams.get('id') || '');
    return workoutDetailFor(id);
  },
  // ---------- Apple Health (Health Auto Export) ----------
  'GET /api/health/status': async () => health.status(),
  'POST /api/health/token': async (req) => {
    const token = await health.createToken();
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
    return { token, url: `${proto}://${host}/api/health/ingest` };
  },
  'DELETE /api/health/token': async () => { await health.revokeToken(); return { ok: true }; },
  'GET /api/activities': async (req, url) => {
    const date = url.searchParams.get('date');
    if (date) return { activities: await store.getActivitiesOn(date) };
    return { activities: await store.getActivities() };
  },
  'DELETE /api/health/activity': async (req, url) => { await store.deleteActivity(url.searchParams.get('id') || ''); return { ok: true }; },
  'POST /api/sync': async (req, url) => {
    if (url.searchParams.get('full') === '1') { const m = await store.getMeta(); delete m.fullHistoryAt; await store.saveMeta(m); }
    const meta = await sync(); return { ok: true, meta };
  },
  'POST /api/plan/generate': async (req) => {
    const b = await body(req);
    const prefs = b && (b.focus || b.wish !== undefined || b.dayTypes) ? { focus: Array.isArray(b.focus) ? b.focus.map(String) : [], wish: String(b.wish || '') } : null;
    if (prefs && Array.isArray(b.dayTypes)) {
      const t = b.dayTypes.map(String).filter((x) => engine.DAY_TYPES[x]).slice(0, 6);
      if (!t.length) throw Object.assign(new Error(tr('srv.kiesMinstensEenTrainingsdag')), { status: 400 });
      prefs.dayTypes = t;
    }
    return { plan: await generatePlan(prefs) };
  },
  'GET /api/focus': async () => ({ focus: Object.fromEntries(Object.entries(engine.FOCUS).map(([k, v]) => [k, v.label])), dayTypes: engine.DAY_TYPES }),
  'PUT /api/plan': async (req) => {
    const plan = await body(req);
    if (!plan?.sessions) throw Object.assign(new Error(tr('srv.ongeldigPlan')), { status: 400 });
    const int = (v, lo, hi, d) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
    for (const s of plan.sessions) {
      if (!Array.isArray(s.exercises)) s.exercises = [];
      s.name = String(s.name || 'Training').slice(0, 40);
      s.locked = !!s.locked;
      for (const e of s.exercises) {
        if (!Array.isArray(e.sets) || !e.sets.length) e.sets = [{ reps: 10, weight: 5, mode: 1, rest: 60 }];
        e.fixed = !!e.fixed;
        for (const set of e.sets) {
          set.reps = int(set.reps, 1, 30, 10);
          set.weight = Math.max(0.5, Math.round(+set.weight * 2) / 2 || 0.5);
          set.rest = int(set.rest, 10, 300, 60);
          set.mode = int(set.mode, 1, 5, 1); // 1 standaard, 2 excentrisch, 3 isokinetisch, 4 constant, 5 spotter
        }
      }
      for (const c of s.warmup?.cable || []) { c.reps = int(c.reps, 1, 30, 10); c.weight = Math.max(0, Math.round(+c.weight * 2) / 2 || 0); }
      for (const m of s.warmup?.mobility || []) {
        m.dose = engine.mobilityDose(m);
        m.reps = int((/(\d+)\s*s\b/i.exec(m.dose) || [])[1], 5, 180, 30);
      }
      for (const c of s.cooldown || []) c.dose = engine.cooldownDose(c);
    }
    refreshMuscles(plan);
    await store.savePlan(plan);
    return { plan };
  },
  'POST /api/plan/push': async (req) => {
    const { sessionKey, dryRun = true } = await body(req);
    const plan = await store.getPlan();
    const session = plan?.sessions.find((s) => s.key === sessionKey);
    if (!session) throw Object.assign(new Error(tr('srv.sessieNietGevonden')), { status: 404 });
    if (session.outdoor || !session.exercises?.length) throw Object.assign(new Error(tr('srv.dezeDagIsCardio')), { status: 400 });
    const pushPlan = engine.toPushPlan(plan, session, await store.getSettings());
    const res = await cli.push(pushPlan, { dryRun });
    console.log(`push${dryRun ? ' (dry-run)' : ''} ${pushPlan.name}: ${typeof res.result === 'string' ? res.result.slice(0, 300) : JSON.stringify(res.result).slice(0, 300)}`);
    if (!dryRun) {
      const meta = await store.getMeta();
      meta.pushes = [{ at: new Date().toISOString(), name: pushPlan.name }, ...(meta.pushes || [])].slice(0, 50);
      session.pushedAt = new Date().toISOString(); delete session.changedAfterPush;
      await Promise.all([store.saveMeta(meta), store.savePlan(plan)]);
    }
    return { ...res, plan: pushPlan };
  },
  // AI-coach voor het hele plan, of met { session } alleen voor die ene training (bijv. een eigen training)
  'POST /api/coach': async (req) => {
    const b = await body(req).catch(() => ({}));
    const ctx = await context();
    const plan = (await store.getPlan()) || (await generatePlan());
    const allowed = allowedExercises(ctx.library, ctx.settings);
    const result = await ai.coach({ settings: ctx.settings, plan, history: ctx.history, bodyLog: ctx.bodyLog, weekly: engine.weeklyStats(ctx.workouts), allowed, activities: await store.getActivities(), onlySession: typeof b?.session === 'string' ? b.session : null, signals: await userSignals(ctx) });
    const meta = await store.getMeta();
    meta.coach = { ...result, at: new Date().toISOString() };
    await store.saveMeta(meta);
    return meta.coach;
  },
  'POST /api/coach/apply': async (req) => {
    const { adjustments } = await body(req);
    const plan = await store.getPlan();
    const library = await getLibrary();
    const libById = new Map(library.map((e) => [Number(e.id), e]));
    const allowed = new Set(allowedExercises(library, await store.getSettings()).map((a) => Number(a.id)));
    const safe = ai.validateAdjustments(adjustments, plan, allowed);
    ai.applyAdjustments(plan, safe, libById);
    refreshMuscles(plan);
    await store.savePlan(plan);
    // het advies is afgehandeld: niet opnieuw als open voorstel tonen
    const meta = await store.getMeta();
    if (meta.coach) { meta.coach = { ...meta.coach, done: 'applied', applied: safe.length, doneAt: new Date().toISOString() }; await store.saveMeta(meta); }
    return { plan, applied: safe.length, coach: meta.coach || null };
  },
  'POST /api/coach/dismiss': async () => {
    const meta = await store.getMeta();
    if (meta.coach) { meta.coach = { ...meta.coach, done: 'dismissed', doneAt: new Date().toISOString() }; await store.saveMeta(meta); }
    return { coach: meta.coach || null };
  },
  'GET /api/about': async () => ({
    version: VERSION, node: process.version, cli: await cli.version().catch(() => null),
    started: STARTED, users: (await store.getUsers()).length, changelog: readChangelog(),
  }),
  'GET /api/update': async (req, url) => {
    if (!isAdmin()) throw err('upd.alleenBeheerder', {}, 403);
    return ghUpdate.status({ fresh: url.searchParams.get('fresh') === '1' });
  },
  'POST /api/update': async () => {
    if (!isAdmin()) throw err('upd.alleenBeheerder', {}, 403);
    return ghUpdate.apply();
  },
  'POST /api/terms/accept': async (req) => {
    const b = await body(req);
    if (Number(b.version) !== TERMS_VERSION) throw Object.assign(new Error(tr('srv.deVoorwaardenZijnIntussen')), { status: 409 });
    const s = await store.getSettings();
    await store.saveSettings({ ...s, termsVersion: TERMS_VERSION, termsAt: new Date().toISOString() });
    return { ok: true, version: TERMS_VERSION };
  },
  'PUT /api/settings': async (req) => {
    const incoming = await body(req);
    delete incoming.termsVersion; delete incoming.termsAt;
    const cur = await store.getSettings();
    const next = { ...cur, ...incoming };
    next.daysPerWeek = Math.min(5, Math.max(2, Math.round(+next.daysPerWeek)));
    next.minutesPerSession = Math.min(120, Math.max(20, Math.round(+next.minutesPerSession)));
    if (!engine.GOALS.includes(next.goal)) next.goal = 'combinatie';
    for (const k of ['warmup', 'cooldown', 'pushMobility']) if (!['on', 'off'].includes(next[k])) next[k] = cur[k];
    next.withings = { segmentNames: cur.withings.segmentNames };
    next.heightCm = next.heightCm === '' || next.heightCm == null ? null : Math.round(+next.heightCm);
    if (!['', 'm', 'v', 'x', 'o'].includes(next.sex)) next.sex = cur.sex || '';
    if (!['', 'man', 'vrouw', 'neutraal'].includes(next.figure)) next.figure = cur.figure || '';
    if (!['', 'm', 'v'].includes(next.bandSex)) next.bandSex = cur.bandSex || '';
    if (next.lang !== '' && !ALL_LANGS.some((l) => l.code === next.lang)) next.lang = cur.lang || '';
    next.noAccessories = Array.isArray(next.noAccessories) ? [...new Set(next.noAccessories.filter((k) => engine.ACCESSORIES.some((a) => a.key === k)))] : cur.noAccessories || [];
    next.birthYear = next.birthYear === '' || next.birthYear == null ? null : Math.round(+next.birthYear);
    if (next.birthYear != null && !(next.birthYear >= 1920 && next.birthYear <= new Date().getFullYear() - 10)) throw Object.assign(new Error(tr('srv.ongeldigGeboortejaar')), { status: 400 });
    next.hrMax = next.hrMax === '' || next.hrMax == null || !(+next.hrMax) ? null : Math.round(+next.hrMax);
    if (next.hrMax != null && !(next.hrMax >= 120 && next.hrMax <= 230)) throw Object.assign(new Error(tr('srv.maximaleHartslagMoetTussen')), { status: 400 });
    if (Object.hasOwn(incoming, 'stepGoal')) next.stepGoal = Math.min(40000, Math.max(1000, Math.round(+incoming.stepGoal || 8000)));
    if (next.heightCm != null && !(next.heightCm >= 100 && next.heightCm <= 250)) throw Object.assign(new Error(tr('srv.lengteMoetTussen100')), { status: 400 });
    next.email = String(next.email || '').trim();
    if (next.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(next.email)) throw Object.assign(new Error(tr('srv.ongeldigEMailadres')), { status: 400 });
    if (!['on', 'off'].includes(next.mailSummary)) next.mailSummary = cur.mailSummary;
    if (!incoming.ai && !incoming.smtp && !incoming.withings) next.prefsConfirmed = true;
    else if (incoming.goal || incoming.daysPerWeek) next.prefsConfirmed = true;
    // eerste keer voorkeuren vastgelegd door een nieuwe gebruiker: een eerder automatisch gemaakt plan vervalt
    if (next.prefsConfirmed && !cur.prefsConfirmed && !(await store.getWorkouts()).length) await store.savePlan(null);
    await store.saveSettings(next);
    // gedeelde instellingen: alleen beheerders
    if (isAdmin() && (incoming.ai || incoming.withings || incoming.smtp || incoming.autoSyncHours != null)) {
      const g = await store.getGlobal();
      const ng = { ...g, ai: { ...g.ai, ...(incoming.ai || {}) }, withings: { ...g.withings, ...(incoming.withings || {}) } };
      delete ng.withings.segmentNames;
      if (!incoming.ai?.apiKey || String(incoming.ai.apiKey).startsWith('••••')) ng.ai.apiKey = g.ai.apiKey;
      // een Claude-sleutel ingevuld terwijl de AI-coach nog uit staat: dan bedoel je Claude
      if (/^sk-ant-/.test(String(incoming.ai?.apiKey || '')) && ng.ai.provider === 'none') ng.ai.provider = 'anthropic';
      if (!['none', 'anthropic', 'openai'].includes(ng.ai.provider)) ng.ai.provider = 'none';
      if (ng.ai.provider === 'anthropic' && !/^claude-/.test(String(ng.ai.model || ''))) ng.ai.model = 'claude-sonnet-5-5';
      if (!incoming.withings?.clientSecret || String(incoming.withings.clientSecret).startsWith('••••')) ng.withings.clientSecret = g.withings.clientSecret;
      if (incoming.smtp) {
        ng.smtp = { ...g.smtp, ...incoming.smtp, port: Math.min(65535, Math.max(1, Math.round(+incoming.smtp.port || g.smtp.port || 587))) };
        if (!['starttls', 'tls', 'none'].includes(ng.smtp.security)) ng.smtp.security = 'starttls';
        if (!['on', 'off'].includes(ng.smtp.verify)) ng.smtp.verify = 'on';
        if (!incoming.smtp.pass || String(incoming.smtp.pass).startsWith('••••')) ng.smtp.pass = g.smtp.pass;
      }
      if (incoming.autoSyncHours != null) ng.autoSyncHours = Math.min(48, Math.max(0, Math.round(+incoming.autoSyncHours)));
      await store.saveGlobal(ng);
      scheduleAutoSync(ng);
    }
    return { settings: maskSettings(await store.getSettings()) };
  },
  'GET /api/goal': async () => goalView(await context()),
  // iPhone, onderweg: overzicht, schema, voortgang, lichaam en doel in één klein antwoord. Alleen lezen.
  'GET /api/phone': async () => {
    const ctx = await context();
    const [rawPlan, daily, activities] = await Promise.all([store.getPlan(), store.getHealthDaily(), store.getActivities()]);
    const gv = await goalView(ctx, daily);
    return phone.view({
      version: VERSION, name: auth.publicUser(store.currentUser())?.name || '', today: goal.todayISO(),
      plan: rawPlan, settings: ctx.settings, workouts: ctx.workouts, sessions: ctx.sessions,
      history: ctx.history, bodyLog: ctx.bodyLog, daily, goalView: gv, activities,
      recovery: signals.recovery({ daily, bodyLog: ctx.bodyLog, history: ctx.history }),
    });
  },
  'PUT /api/goal': async (req) => {
    const incoming = await body(req);
    const ctx = await context();
    const clampSteps = (n) => Math.min(40000, Math.max(1000, Math.round(+n || 8000)));
    if (incoming.stepsOnly) {
      const s = await store.getSettings();
      if (Object.hasOwn(incoming, 'stepGoal')) s.stepGoal = clampSteps(incoming.stepGoal);
      await store.saveSettings(s);
      ctx.settings = s;
      return { ...(await goalView(ctx)), saved: true };
    }
    const applied = goal.applyOutcome({
      settings: ctx.settings, bodyLog: ctx.bodyLog, history: ctx.history, today: goal.todayISO(),
      composition: incoming.composition ?? null,
      strengths: Object.hasOwn(incoming, 'strengths') ? incoming.strengths : (incoming.strength ? [incoming.strength] : incoming.strength),
      accept: !!incoming.accept,
    });
    if (applied.error) {
      const key = applied.error === 'weight' ? 'goal.needWeight' : applied.error === 'muscle' ? 'goal.needMuscle' : applied.error === 'e1rm' ? 'goal.needE1rm' : applied.error === 'dup' ? 'goal.dupMuscle' : applied.error === 'many' ? 'goal.tooMany' : 'goal.badInput';
      throw err(key, { name: applied.name || '' });
    }
    if (!applied.saved) {
      if (Object.hasOwn(incoming, 'stepGoal')) {
        const s = await store.getSettings();
        s.stepGoal = clampSteps(incoming.stepGoal);
        await store.saveSettings(s);
        ctx.settings = s;
      }
      return { ...(await goalView(ctx)), blocked: applied.blocked, saved: false };
    }
    const s = await store.getSettings();
    s.outcome = applied.outcome;
    if (Object.hasOwn(incoming, 'stepGoal')) s.stepGoal = clampSteps(incoming.stepGoal);
    if (incoming.alignPlan != null) s.alignPlan = !!incoming.alignPlan;
    if (s.alignPlan && applied.outcome) {
      const style = goal.trainingStyle(applied.outcome);
      if (style?.goal) s.goal = style.goal;
    }
    await store.saveSettings(s);
    ctx.settings = s;
    return { ...(await goalView(ctx)), saved: true };
  },
  'POST /api/swap': async (req) => {
    const { pattern, variant, id } = await body(req);
    const s = await store.getSettings();
    s.overrides = { ...s.overrides };
    if (id) s.overrides[`${pattern}:${variant}`] = Number(id); else delete s.overrides[`${pattern}:${variant}`];
    await store.saveSettings(s);
    return { plan: await generatePlan() };
  },
  'POST /api/avoid': async (req) => {
    const { id, regenerate = true } = await body(req);
    const s = await store.getSettings();
    s.avoidIds = [...new Set([...(s.avoidIds || []), Number(id)])];
    await store.saveSettings(s);
    // vanuit de editor: alleen onthouden, het plan niet opnieuw maken
    return regenerate === false ? { ok: true } : { plan: await generatePlan() };
  },
  // ---------- eigen trainingen en sjablonen ----------
  'GET /api/templates': async () => {
    const me = store.currentUser().id;
    const names = Object.fromEntries((await store.getUsers()).map((u) => [u.id, u.name]));
    const all = store.listTemplates().map((t) => ({ id: t.id, name: t.name, shared: t.shared, mine: t.ownerId === me, owner: names[t.ownerId] || '?', updatedAt: t.updatedAt,
      count: (t.exercises || []).length, sets: (t.exercises || []).reduce((n, e) => n + (e.sets?.length || 0), 0), estMinutes: t.estMinutes || null, exercises: (t.exercises || []).map((e) => e.title) }));
    return { mine: all.filter((t) => t.mine), shared: all.filter((t) => !t.mine && t.shared) };
  },
  'GET /api/template': async (req, url) => {
    const t = store.getTemplate(url.searchParams.get('id'));
    if (!t) throw Object.assign(new Error(tr('srv.sjabloonNietGevonden')), { status: 404 });
    return { template: t, mine: t.ownerId === store.currentUser().id };
  },
  // sjabloon bewaren: uit een training (editor) of een bestaand sjabloon bijwerken
  'POST /api/templates': async (req) => {
    const { id, name, session, shared } = await body(req);
    if (!session || !Array.isArray(session.exercises)) throw Object.assign(new Error(tr('srv.geenTrainingMeegegeven')), { status: 400 });
    const tid = id || 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const cur = id ? store.getTemplate(id) : null;
    const keep = ['name', 'warmup', 'cooldown', 'exercises', 'estMinutes', 'muscles'];
    const bodyT = Object.fromEntries(keep.filter((k) => session[k] !== undefined).map((k) => [k, session[k]]));
    for (const e of bodyT.exercises) { delete e.note; delete e.basis; delete e.restNote; }
    return { template: store.saveTemplate({ id: tid, name: name || session.name || 'Training', shared: shared ?? cur?.shared ?? false, body: bodyT }) };
  },
  'PUT /api/templates/share': async (req) => {
    const { id, shared } = await body(req);
    const t = store.getTemplate(id);
    if (!t || t.ownerId !== store.currentUser().id) throw Object.assign(new Error(tr('srv.alleenDeMakerKan')), { status: 403 });
    const { id: _i, ownerId, name, shared: _s, updatedAt, ...rest } = t;
    return { template: store.saveTemplate({ id, name, shared: !!shared, body: rest }) };
  },
  'DELETE /api/templates': async (req, url) => {
    if (!store.deleteTemplate(url.searchParams.get('id'))) throw Object.assign(new Error(tr('srv.sjabloonNietGevondenOf')), { status: 404 });
    return { ok: true };
  },
  // nieuwe training in het plan: leeg, kopie van een training uit het plan, of uit een sjabloon
  // Vorige weken: lijst met weken in het archief, en per week gepland tegenover gedaan (per oefening).
  'GET /api/plan/weeks': async () => {
    const cur = await store.getPlan();
    if (cur?.sessions && !store.listArchivedWeeks().some((w) => w.week === engine.planLabel(cur))) store.archivePlan(cur);
    const ctx = await context();
    return { weeks: store.listArchivedWeeks().map((w) => {
      const p = store.getArchivedPlan(w.week);
      const r = engine.planWeekReport(p, ctx.workouts, ctx.sessions);
      return { week: w.week, ...r.summary };
    }) };
  },
  'GET /api/plan/week': async (req, url) => {
    const w = String(url.searchParams.get('w') || '');
    if (!/^\d{4}-W\d{2}$/.test(w)) throw Object.assign(new Error(tr('srv.ongeldigeWeek')), { status: 400 });
    const p = store.getArchivedPlan(w);
    if (!p) throw Object.assign(new Error(tr('srv.geenPlanBewaardVoor')), { status: 404 });
    const ctx = await context();
    return { ...engine.planWeekReport(p, ctx.workouts, ctx.sessions), plan: p };
  },
  // Lichtere variant van een training uit het plan (bij herstelscore 'rustig aan'; de gebruiker kiest).
  'POST /api/plan/lighter': async (req) => {
    const { session } = await body(req);
    const plan = await store.getPlan();
    const i = (plan?.sessions || []).findIndex((s) => s.key === session);
    if (i < 0) throw Object.assign(new Error(tr('srv.sessieNietGevonden')), { status: 404 });
    if (plan.sessions[i].lightened) return { plan };
    plan.sessions[i] = engine.lighterSession(plan.sessions[i]);
    refreshMuscles(plan);
    await store.savePlan(plan);
    return { plan };
  },
  'POST /api/plan/session': async (req) => {
    const { mode = 'empty', from, name, week } = await body(req);
    const plan = await store.getPlan();
    if (!plan) throw Object.assign(new Error(tr('app.maakEerstEenPlan')), { status: 400 });
    const ctx = await context();
    let base;
    let foreign = false;
    if (mode === 'copy') {
      // kopie uit dit plan, of met { week } uit een vorige week in het archief
      const srcPlan = week ? store.getArchivedPlan(String(week)) : plan;
      const src = srcPlan?.sessions.find((x) => x.key === from);
      if (!src || src.outdoor) throw Object.assign(new Error(tr('srv.trainingNietGevonden')), { status: 404 });
      base = JSON.parse(JSON.stringify(src));
      for (const k of ['original', 'pushedAt', 'changedAfterPush', 'edited']) delete base[k];
    } else if (mode === 'template') {
      const tpl = store.getTemplate(from);
      if (!tpl) throw Object.assign(new Error(tr('srv.sjabloonNietGevonden')), { status: 404 });
      foreign = tpl.ownerId !== store.currentUser().id;
      base = { name: tpl.name, warmup: tpl.warmup || null, cooldown: tpl.cooldown || null, exercises: tpl.exercises || [], template: tpl.id };
    } else base = { name: 'Eigen training', warmup: { mobility: [], cable: [] }, cooldown: [], exercises: [] };
    let n = 1; while (plan.sessions.some((x) => x.key === `X${n}`)) n++;
    const sess = engine.adaptSession({ ...base, key: `X${n}`, name: String(name || base.name || 'Eigen training').slice(0, 40), type: 'eigen' }, {
      history: ctx.history, settings: ctx.settings, library: ctx.library, foreign, info: (id) => store.getExerciseInfo(Number(id), 'en')?.info || null,
    });
    Object.assign(sess, { custom: true, locked: true, estMinutes: sess.estMinutes || 45 });
    plan.sessions.push(sess);
    refreshMuscles(plan);
    await store.savePlan(plan);
    return { plan, key: sess.key };
  },
  // eigen training uit het plan halen
  'DELETE /api/plan/session': async (req, url) => {
    const plan = await store.getPlan();
    const i = plan?.sessions.findIndex((x) => x.key === url.searchParams.get('key') && x.custom) ?? -1;
    if (i < 0) throw Object.assign(new Error(tr('srv.alleenEigenTrainingenKun')), { status: 400 });
    plan.sessions.splice(i, 1);
    refreshMuscles(plan);
    await store.savePlan(plan);
    return { plan };
  },
  // catalogus voor de editor: alle oefeningen, met per oefening jouw historie en de vermeden oefeningen
  'GET /api/library': async () => {
    const ctx = await context();
    const hist = {};
    for (const h of Object.values(ctx.history)) {
      if (h.id == null || !h.log.length) continue;
      const l = h.log[h.log.length - 1];
      const w = Math.max(...l.sets.map((x) => x.weight));
      hist[h.id] = { last: String(l.date || '').slice(0, 10), sets: `${l.sets.length} × ${l.sets[0].reps} × ${w} kg`, times: h.log.length, e1rm: Math.round(Math.max(...l.sets.map((x) => engine.epley(x.weight, x.reps))) * 10) / 10 };
    }
    return { items: ctx.library.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, tab: e.tab, acc: engine.accessoriesOf(e) })), history: hist, avoid: ctx.settings.avoidIds || [], noAcc: ctx.settings.noAccessories || [] };
  },
  // uitleg, beelden en video van een oefening (gedeelde cache, zie lib/exinfo.js)
  'GET /api/exercise/info': async (req, url) => {
    const id = Number(url.searchParams.get('id'));
    if (!(id > 0)) throw Object.assign(new Error(tr('srv.ongeldigeOefening')), { status: 400 });
    if (!hasSpeediance()) throw Object.assign(new Error(tr('srv.koppelEerstJeSpeediance')), { status: 400 });
    // uitleg in de taal van de gebruiker als Speediance die heeft (exinfo.INFO_LANGS), anders Engels
    const info = await exinfo.getInfo(id, url.searchParams.get('lang') || infoLang());
    // verloop van het geschatte 1RM uit je eigen historie
    const ctx = await context();
    const h = Object.values(ctx.history).find((x) => Number(x.id) === id);
    const trend = (h?.log || []).slice(-16).map((l) => ({ x: String(l.date).slice(0, 10), y: Math.round(Math.max(...l.sets.map((s) => engine.epley(s.weight, s.reps))) * 10) / 10 }));
    return { info, trend };
  },
  // een oefening uit de catalogus klaarzetten voor de editor (blok: ex, warm of cool)
  'POST /api/exercise/template': async (req) => {
    const { id, block = 'ex' } = await body(req);
    const ctx = await context();
    const lib = ctx.library.find((e) => Number(e.id) === Number(id));
    if (!lib) throw Object.assign(new Error(tr('srv.oefeningNietInDe')), { status: 404 });
    let info = store.getExerciseInfo(Number(id), 'en')?.info || null;
    if (!info && hasSpeediance()) info = await exinfo.getInfo(id, 'en').catch(() => null);
    if (block === 'warm') {
      const cable = lib.tab === 'Training';
      const dose = cable ? '' : (info?.unilateral ? '30 s per kant' : '30 s');
      return { item: { kind: cable ? 'cable' : 'mobility', id: lib.id, title: lib.name, reps: cable ? 12 : 30, weight: cable ? Math.max(1, Math.round((info?.recommendedWeight || 6) * 0.3 * 2) / 2) : 0, dose } };
    }
    if (block === 'cool') return { item: { id: lib.id, title: lib.name, dose: engine.cooldownDose({ id: lib.id, dose: info?.unilateral ? '30 s per kant' : '30 s' }) } };
    return { exercise: engine.exerciseFromLibrary(lib, { settings: ctx.settings, history: ctx.history, info }) };
  },
  // foto's en video's van Speediance via de eigen server (gedeelde cache in data/media)
  'GET /api/media': async (req, url) => ({ __file: await exinfo.mediaFile(url.searchParams.get('u') || '') }),
  'GET /api/alternatives': async (req, url) => {
    const library = engine.usableLibrary(await getLibrary(), await store.getSettings());
    return { items: engine.alternatives(library, url.searchParams.get('muscle')) };
  },
  'POST /api/bodyweight': async (req) => {
    const { date, kg, fat } = await body(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(+kg > 20 && +kg < 400)) throw Object.assign(new Error(tr('srv.ongeldigeInvoer')), { status: 400 });
    if (fat != null && !(+fat > 2 && +fat < 70)) throw Object.assign(new Error(tr('srv.ongeldigVetpercentage')), { status: 400 });
    const log = (await store.getBodyLog()).filter((b) => b.date !== date);
    log.push({ date, kg: Math.round(+kg * 10) / 10, ...(fat != null ? { fat: Math.round(+fat * 10) / 10 } : {}), source: 'handmatig' });
    log.sort((a, b) => a.date.localeCompare(b.date));
    await store.saveBodyLog(log);
    return { bodyLog: log };
  },
  'DELETE /api/bodyweight': async (req, url) => {
    const date = url.searchParams.get('date');
    const log = (await store.getBodyLog()).filter((b) => b.date !== date);
    await store.saveBodyLog(log);
    return { bodyLog: log };
  },
  'GET /api/withings/status': async () => withings.status(),
  'GET /api/withings/connect': async () => ({ __redirect: withings.authorizeUrl(await store.getSettings()) }),
  'GET /api/withings/callback': async (req, url) => {
    try {
      await withings.handleCallback(await store.getSettings(), { code: url.searchParams.get('code'), state: url.searchParams.get('state') });
      const r = await withings.syncWeight(await store.getSettings());
      // dit tabblad is los geopend: GymCoach in het andere tabblad laten verversen en dit tabblad sluiten
      return { __html: `<h2 style="margin:0 0 .5rem">${tr('srv.withingsGekoppeld')}</h2><p>${tr('srv.metingenOpgehaaldJeKunt', { added: r.added })}</p><p><a href="/#body" style="color:#ff7a2e">${tr('srv.ofGaNaarGymcoach')}</a></p>
        <script>try{new BroadcastChannel('gymcoach').postMessage({type:'withings',ok:true,added:${Number(r.added) || 0}})}catch(e){}setTimeout(()=>{window.close()},1500)</script>` };
    } catch (e) {
      const msg = String(e.message).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));
      return { __html: `<h2 style="margin:0 0 .5rem;color:#ff6b6b">${tr('srv.koppelenMislukt')}</h2><p>${msg}</p><p>${tr('srv.sluitDitTabbladEn')}</p>
        <script>try{new BroadcastChannel('gymcoach').postMessage({type:'withings',ok:false,error:${JSON.stringify(String(e.message)).replace(/</g, '\\u003c')}})}catch(e){}</script>` };
    }
  },
  'POST /api/withings/sync': async () => withings.syncWeight(await store.getSettings()),
  'PUT /api/withings/segments': async (req) => {
    const { names } = await body(req);
    const s = await store.getSettings();
    s.withings = { ...s.withings, segmentNames: Object.fromEntries(Object.entries(names || {}).map(([k, v]) => [String(+k), String(v).slice(0, 40)])) };
    await store.saveSettings(s);
    return { segmentNames: s.withings.segmentNames };
  },
  'POST /api/withings/disconnect': async () => { await withings.disconnect(); return { ok: true }; },
  'GET /api/account': async () => {
    // nog geen eigen Speediance-config: altijd leeg tonen (nooit terugvallen op die van een ander)
    if (!existsSync(path.join(store.speedianceDir(store.currentUser()), 'config.json'))) return { email: '', passwordSet: false, region: 'EU', deviceType: 1 };
    const c = await cli.configShow();
    // de CLI toont het wachtwoord niet (of gemaskeerd/onder een andere sleutel): kijk ook in het configbestand
    let file = {};
    try { file = JSON.parse(await readFile(path.join(store.speedianceDir(store.currentUser()), 'config.json'), 'utf8')); } catch {}
    const hasPw = (o) => Object.entries(o || {}).some(([k, v]) => /pass|pwd/i.test(k) && (v === true || (typeof v === 'string' && v.trim() !== '')));
    return { email: c.email || file.email || '', passwordSet: hasPw(c) || hasPw(file), region: c.region || 'Global', deviceType: Number(c.device_type || 1) };
  },
  'PUT /api/account': async (req) => {
    const b = await body(req);
    const before = await cli.configShow();
    if (b.email) await cli.configSet('email', String(b.email).trim());
    if (b.password) await cli.configSet('password', String(b.password));
    if (b.region) {
      if (!['Global', 'EU'].includes(b.region)) throw Object.assign(new Error(tr('srv.regioMoetGlobalOf')), { status: 400 });
      await cli.configSet('region', b.region);
    }
    if (b.deviceType != null) {
      const dt = Math.round(Number(b.deviceType));
      if (!(dt >= 1 && dt <= 20)) throw Object.assign(new Error(tr('srv.ongeldigToesteltype')), { status: 400 });
      await cli.configSet('device_type', dt);
    }
    let login = { ok: true }, library = null;
    try { await cli.login(); } catch (e) { login = { ok: false, error: e.authFailure ? tr('srv.inloggenMisluktControleerE') : e.message }; }
    const changedDevice = Number(before.device_type || 1) !== Number(b.deviceType ?? before.device_type) || (b.region && b.region !== before.region);
    // catalogus ophalen bij een ander toestel of regio, of als er voor dit toestel nog geen opgehaalde catalogus is
    if (login.ok && (changedDevice || !store.getLibraryInfo(await deviceType()))) {
      try { library = await refreshLibrary(); }
      catch (e) { library = `niet ververst: ${e.message}`; }
    }
    const m = await store.getMeta(); m.speedianceLoginFailed = !login.ok; await store.saveMeta(m);
    // eerste koppeling: meteen op de achtergrond de trainingshistorie ophalen
    if (login.ok && !(await store.getWorkouts()).length) sync().catch((e) => console.warn(`eerste sync: ${e.message}`));
    return { login, library };
  },
  'POST /api/account/detect': async () => speediance.detectDevice(),
  'GET /api/programs': async () => ({ programs: await speediance.listPrograms() }),
  'POST /api/programs/delete': async (req) => {
    const { ids } = await body(req);
    if (!Array.isArray(ids) || !ids.length) throw Object.assign(new Error(tr('srv.geenProgrammaSGekozen')), { status: 400 });
    const r = await speediance.deletePrograms(ids.map(String).slice(0, 200));
    console.log(`programma's verwijderd: ${r.done.length}, mislukt: ${r.failed.length}`);
    return r;
  },
  'POST /api/library/refresh': async () => ({ count: await refreshLibrary() }),

  // ---------- eigen account ----------
  'PUT /api/me/password': async (req) => {
    const { current, password } = await body(req);
    const me = store.currentUser();
    await auth.login(me.username, current, 'pw-change:' + me.id).catch(() => { throw Object.assign(new Error(tr('srv.huidigWachtwoordKloptNiet')), { status: 400 }); });
    await auth.setPassword(me.id, password);
    return { ok: true, relogin: true };
  },
  'PUT /api/me': async (req) => {
    const { name } = await body(req);
    if (!name || String(name).length > 40) throw Object.assign(new Error(tr('srv.ongeldigeNaam')), { status: 400 });
    const users = await store.getUsers();
    const u = users.find((x) => x.id === store.currentUser().id);
    u.name = String(name).trim();
    await store.saveUsers(users);
    return { me: auth.publicUser(u) };
  },

  'PUT /api/me/avatar': async (req) => {
    const { dataUrl } = await body(req);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw Object.assign(new Error(tr('srv.alleenJpgPngOf')), { status: 400 });
    const buf = Buffer.from(m[2], 'base64');
    const sig = { 'image/jpeg': [0xff, 0xd8], 'image/png': [0x89, 0x50], 'image/webp': [0x52, 0x49] }[m[1]];
    if (buf.length > 400e3) throw Object.assign(new Error(tr('srv.fotoIsTeGroot')), { status: 400 });
    if (buf[0] !== sig[0] || buf[1] !== sig[1]) throw Object.assign(new Error(tr('srv.geenGeldigeAfbeelding')), { status: 400 });
    const v = store.setAvatar(store.currentUser().id, m[1], buf);
    return { avatar: v };
  },
  'DELETE /api/me/avatar': async () => { store.deleteAvatar(store.currentUser().id); return { avatar: null }; },
  'GET /api/avatar': async (req, url) => {
    const a = store.getAvatar(url.searchParams.get('id') || '');
    if (!a) throw Object.assign(new Error(tr('srv.geenFoto')), { status: 404 });
    return { __binary: { type: a.mime, data: Buffer.from(a.data) } };
  },

  // ---------- gebruikersbeheer (beheerder) ----------
  'GET /api/users': async () => { requireAdmin(); return { users: (await store.getUsers()).map(auth.publicUser) }; },
  'POST /api/users': async (req) => {
    requireAdmin();
    const b = await body(req);
    const u = await auth.createUser({ username: b.username, name: b.name, password: b.password, role: b.role });
    return { user: auth.publicUser(u) };
  },
  'PUT /api/users/password': async (req) => {
    requireAdmin();
    const { id, password } = await body(req);
    await auth.setPassword(String(id), password);
    return { ok: true };
  },
  'PUT /api/users/role': async (req) => {
    requireAdmin();
    const { id, role } = await body(req);
    const users = await store.getUsers();
    const u = users.find((x) => x.id === id);
    if (!u) throw Object.assign(new Error(tr('srv.gebruikerNietGevonden')), { status: 404 });
    if (u.role === 'admin' && role !== 'admin' && users.filter((x) => x.role === 'admin').length === 1) throw Object.assign(new Error(tr('srv.erMoetMinstensEen')), { status: 400 });
    u.role = role === 'admin' ? 'admin' : 'user';
    await store.saveUsers(users);
    return { user: auth.publicUser(u) };
  },
  'DELETE /api/users': async (req, url) => {
    requireAdmin();
    const id = url.searchParams.get('id');
    if (id === store.currentUser().id) throw Object.assign(new Error(tr('srv.jeKuntJezelfNiet')), { status: 400 });
    await auth.deleteUser(id);
    return { ok: true, note: tr('srv.deGebruikerKanNiet') };
  },
};

// Routes zonder inlog
const publicRoutes = {
  'GET /api/auth/status': async (req) => {
    const users = await store.getUsers();
    const u = await auth.userFromRequest(req);
    return { setupNeeded: users.length === 0, user: auth.publicUser(u), version: VERSION };
  },
  'POST /api/auth/setup': async (req, url, res) => {
    if ((await store.getUsers()).length) throw Object.assign(new Error(tr('srv.erBestaatAlEen')), { status: 409 });
    // nooit een nieuwe beheerder maken terwijl er nog niet-overgezette accounts staan
    if (existsSync(path.join(store.DATA_DIR, 'users.json'))) {
      const imp = await store.importJsonStore().catch((e) => { throw Object.assign(new Error(tr('srv.jeBestaandeAccountsKonden', { message: e.message })), { status: 500 }); });
      if (imp) throw Object.assign(new Error(tr('srv.jeBestaandeAccountsZijn')), { status: 409 });
    }
    const b = await body(req);
    const user = await auth.createUser({ username: b.username, name: b.name, password: b.password, role: 'admin' });
    const moved = await store.migrateLegacy(user, LEGACY_SPEEDIANCE_CONFIG);
    if (moved.length) console.log(`bestaande gegevens overgezet naar ${user.username}: ${moved.join(', ')}`);
    const { token } = await auth.login(b.username, b.password, clientIp(req));
    res.setHeader('set-cookie', auth.cookieFor(token, isHttps(req)));
    return { user: auth.publicUser(user), migrated: moved };
  },
  // Health Auto Export stuurt hierheen; geen sessiecookie maar een persoonlijke sleutel
  'POST /api/health/ingest': async (req, url) => {
    const token = health.tokenFromRequest(req, url);
    const userId = token && store.userIdForHealthToken(health.hashToken(token));
    if (!userId) throw Object.assign(new Error(tr('srv.ongeldigeOfOntbrekendeSleutel')), { status: 401 });
    const user = (await store.getUsers()).find((u) => u.id === userId);
    if (!user) throw Object.assign(new Error(tr('srv.gebruikerBestaatNietMeer')), { status: 401 });
    const payload = await body(req, 50e6);
    const r = await store.runAs(user, () => health.ingest(payload));
    console.log(`apple health ${user.username}: ${r.activities} activiteiten, ${r.skipped} overgeslagen, ${r.days} dagen`);
    return { ok: true, ...r };
  },
  'POST /api/auth/login': async (req, url, res) => {
    const b = await body(req);
    const { token, user } = await auth.login(b.username, b.password, clientIp(req));
    res.setHeader('set-cookie', auth.cookieFor(token, isHttps(req)));
    return { user: auth.publicUser(user) };
  },
  'POST /api/auth/logout': async (req, url, res) => {
    const t = auth.tokenFrom(req);
    if (t) await auth.logout(t);
    res.setHeader('set-cookie', auth.clearCookie());
    return { ok: true };
  },
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8' };

// Stuurt het antwoord van een route: JSON, PDF/bestand, een bestand van schijf (met Range voor video) of een redirect.
async function send(res, out, req = null) {
  if (out?.__redirect) { res.writeHead(302, { location: out.__redirect }); return res.end(); }
  if (out?.__file) {
    const { file, type } = out.__file;
    const size = (await fsStat(file)).size;
    const base = { 'content-type': type || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=2592000' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req?.headers.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : size - Number(m[2]), end = m[1] && m[2] ? Number(m[2]) : size - 1;
      if (start < 0 || start >= size || end < start) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
      end = Math.min(end, size - 1);
      res.writeHead(206, { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...base, 'content-length': size });
    return createReadStream(file).pipe(res);
  }
  if (out?.__binary) {
    const h = { 'content-type': out.__binary.type, 'cache-control': out.__binary.filename ? 'no-store' : 'private, max-age=31536000, immutable', 'content-security-policy': "default-src 'none'" };
    if (out.__binary.filename) h['content-disposition'] = `inline; filename="${out.__binary.filename.replace(/"/g, '')}"`;
    res.writeHead(200, h); return res.end(out.__binary.data);
  }
  if (out?.__html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:2rem;background:#0f1012;color:#ecebe7">${out.__html}`); }
  // een plan altijd in de taal van de gebruiker (opgeslagen standaardteksten vertalen)
  if (out?.plan?.sessions) out = { ...out, plan: engine.localizePlan(out.plan) };
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  return res.end(JSON.stringify(out));
}

const server = http.createServer((req, res) => store.runAnon(parseAccept(req.headers['accept-language']), () => handleRequest(req, res)));
// Afhandeling van één verzoek; de talen van de browser staan in de context (voor meldingen in de juiste taal).
async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://x');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  try {
    const key = `${req.method} ${url.pathname}`;
    if (publicRoutes[key]) return send(res, await publicRoutes[key](req, url, res));
    // wijzigende verzoeken alleen van dezelfde herkomst (CSRF-bescherming)
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      res.writeHead(403, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: tr('srv.verzoekVanAndereHerkomst') }));
    }
    const handler = routes[key];
    if (handler) {
      const user = await auth.userFromRequest(req);
      if (!user) {
        if (url.pathname === '/api/withings/callback') return send(res, { __html: '<p>' + tr('srv.jeBentNietMeer') + ' <a href="/">' + tr('srv.logIn') + '</a> ' + tr('srv.enStartHetKoppelen') + '</p>' });
        res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: tr('srv.nietIngelogd'), login: true }));
      }
      // taal 'automatisch': onthoud wat de app in de browser kiest, voor mails bij automatisch syncen
      return await store.runAs(user, async () => { if (store.currentAccept().length) store.rememberBrowserLang(resolveLang('', store.currentAccept(), 'en')); return send(res, await handler(req, url), req); });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(404); return res.end(); }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.normalize(path.join(ROOT, 'public', rel));
    if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
    let data = await readFile(file).catch(() => null);
    if (!data) { res.writeHead(404); return res.end('Niet gevonden'); }
    if (rel === 'index.html') data = Buffer.from(data.toString('utf8').replaceAll('__VERSION__', VERSION));
    // altijd even bij de server navragen (geen verouderde app na een update)
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'content-length': data.length, 'cache-control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) {
    console.error(`${req.method} ${url.pathname}: ${e.message}`);
    res.writeHead(e.status || 500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message, authFailure: !!e.authFailure, ...(e.code && typeof e.code === 'string' && /^[a-z]+\./.test(e.code) ? { code: e.code, vars: e.vars || {} } : {}) }));
  }
}

// Synct alle gebruikers met een Speediance-account na elkaar.
async function syncAll() {
  for (const u of await store.getUsers()) {
    // gebruikers zonder Speediance-account overslaan (geen foutmelding bij hen)
    if (!(await store.runAs(u, async () => hasSpeediance()))) continue;
    await store.runAs(u, () => sync()).then(() => console.log(`sync ${u.username}: ok`)).catch((e) => console.warn(`sync ${u.username}: ${e.message}`));
  }
}

let timer = null;
// Plant de automatische sync volgens de gedeelde instellingen.
function scheduleAutoSync(g) {
  clearInterval(timer);
  const h = Number(g.autoSyncHours);
  if (h > 0) timer = setInterval(() => syncAll(), h * 3600e3);
}

// eenmalig: oude JSON-opslag overzetten naar de database (vóór er verzoeken binnenkomen)
try { const imp = await store.importJsonStore(); if (imp) console.log('JSON-bestanden geïmporteerd in de database:', JSON.stringify(imp)); } catch (e) { console.error('import mislukt:', e.message); }

server.listen(PORT, HOST, async () => {
  await store.hardenPermissions();
  console.log(`GymCoach draait op http://${HOST}:${PORT}`);
  const users = await store.getUsers();
  if (!users.length) console.log('Nog geen gebruikers: open de pagina om de eerste beheerder aan te maken.');
  scheduleAutoSync(await store.getGlobal());
  syncAll();
});
