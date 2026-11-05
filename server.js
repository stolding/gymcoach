// GymCoach — lokaal trainingsdashboard voor de Speediance Gym Monster (meerdere gebruikers).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cli from './lib/cli.js';
import * as store from './lib/store.js';
import * as engine from './lib/engine.js';
import * as insights from './lib/insights.js';
import { TERMS_VERSION } from './public/terms.js';
import * as ai from './lib/ai.js';
import * as withings from './lib/withings.js';
import * as speediance from './lib/speediance.js';
import * as auth from './lib/auth.js';
import * as health from './lib/health.js';
import * as mail from './lib/mail.js';
import { workoutPdf, workoutMail } from './lib/summary.js';
import { figureFor } from './public/bodymap.js';
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
  if (!lib?.length) throw new Error('Lege catalogus ontvangen');
  const dt = await deviceType();
  await store.saveLibraryCache(lib, dt);
  libraryMem.set(dt, lib);
  return lib.length;
}
const isAdmin = () => store.currentUser()?.role === 'admin';
const requireAdmin = () => { if (!isAdmin()) throw Object.assign(new Error('Alleen voor beheerders'), { status: 403 }); };

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
  return library.filter((e) => ids.has(Number(e.id)) && !settings.avoidIds.includes(Number(e.id))).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle }));
}

const mask = (v) => (v ? '••••' + v.slice(-4) : '');
const maskSettings = (s) => ({ ...s, ai: { ...s.ai, apiKey: mask(s.ai.apiKey) }, withings: { ...s.withings, clientSecret: mask(s.withings.clientSecret) },
  smtp: isAdmin() ? { ...s.smtp, pass: mask(s.smtp?.pass) } : { configured: mail.isConfigured(s.smtp) } });

// ---------- trainingssamenvatting (PDF + e-mail) ----------
async function workoutDetailFor(id, ctx) {
  ctx ||= await context();
  const w = ctx.workouts.find((x) => String(x.training_id) === String(id));
  const s = ctx.sessions[String(id)];
  if (!w && !s) throw Object.assign(new Error('Training niet gevonden'), { status: 404 });
  const wh = await store.getWorkoutHealth();
  const d = engine.workoutDetail(w, s, ctx.library, ctx.history, wh[String(id)]);
  d.compare = insights.compare(d, { workouts: ctx.workouts, sessions: ctx.sessions, health: wh });
  d.heart = insights.heart(d, wh[String(id)], ctx.settings);
  return d;
}
// Mailt het trainingsrapport (met PDF) naar de gebruiker.
async function mailWorkout(id, ctx) {
  const settings = ctx?.settings || await store.getSettings();
  const d = await workoutDetailFor(id, ctx);
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
  if (!hasSpeediance()) throw Object.assign(new Error('Vul eerst je Speediance-account in (Instellingen → Speediance-account)'), { status: 400 });
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

// Maakt een nieuw weekplan met de regels-engine en bewaart het.
async function generatePlan(prefs) {
  const ctx = await context();
  const week = engine.weekNumber(ctx.sessions);
  const prev = await store.getPlan();
  const focus = prefs?.focus ?? prev?.focus ?? [];
  const wish = prefs?.wish ?? prev?.wish ?? '';
  const dayTypes = prefs?.dayTypes ?? prev?.dayTypes ?? null;
  const snapshot = JSON.parse(await readFile(path.join(ROOT, 'lib', 'library.snapshot.json'), 'utf8'));
  const plan = engine.buildPlan({ settings: ctx.settings, library: ctx.library, history: ctx.history, week, focus, wish, snapshot, dayTypes });
  await store.savePlan(plan);
  // advies van de AI-coach hoorde bij het vorige plan
  const meta = await store.getMeta();
  if (meta.coach) { delete meta.coach; await store.saveMeta(meta); }
  return plan;
}

// ---------- routes ----------

async function body(req, limit = 2e6) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error('Verzoek te groot'), { status: 413 }); chunks.push(c); }
  const t = Buffer.concat(chunks).toString('utf8');
  return t ? JSON.parse(t) : {};
}

const routes = {
  'GET /api/state': async () => {
    const ctx = await context();
    const [plan, meta] = await Promise.all([store.getPlan(), store.getMeta()]);
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
          return { id, date: String(w.date || '').slice(0, 10), title: w.title || 'Training', min: w.duration_secs ? Math.round(w.duration_secs / 60) : null,
            kcal: w.calories ?? h.kcal ?? null, vol: Math.round(Number(w.volume) || 0) || null, hr: h.hrAvg ?? null, ex: Array.isArray(ses?.detail) ? ses.detail.length : null };
        }).filter((w) => w.date);
      })(),
      bodyLog: ctx.bodyLog,
      progress: engine.exerciseProgress(ctx.history).slice(0, 30),
      patterns: Object.fromEntries(Object.entries(engine.PATTERNS).map(([k, p]) => [k, { label: p.label, type: p.type }])),
      libraryCount: ctx.library.length,
      library: await libraryStatus(),
      withings: await withings.status(),
      overview: engine.overview({ workouts: ctx.workouts, history: ctx.history, bodyLog: ctx.bodyLog, plan, settings: ctx.settings }),
      week: engine.weekNumber(ctx.sessions),
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
    return insights.analysis({ history: ctx.history, workouts: ctx.workouts, sessions: ctx.sessions, workoutHealth, activities, daily, bodyLog: ctx.bodyLog }, since);
  },
  'GET /api/workouts': async () => {
    const [workouts, sessions, wh] = await Promise.all([store.getWorkouts(), store.getSessions(), store.getWorkoutHealth()]);
    return {
      workouts: [...workouts].reverse().map((w) => ({
        id: String(w.training_id), date: String(w.date || '').slice(0, 10), title: w.title || 'Training', kind: w.kind || w.type || '',
        minutes: w.duration_secs ? Math.round(w.duration_secs / 60) : null, calories: w.calories ?? null, volume: Math.round(Number(w.volume) || 0),
        exercises: Array.isArray(sessions[String(w.training_id)]?.detail) ? sessions[String(w.training_id)].detail.length : null,
        hrAvg: wh[String(w.training_id)]?.hrAvg ?? null,
      })),
    };
  },
  'GET /api/workout/pdf': async (req, url) => {
    const d = await workoutDetailFor(url.searchParams.get('id') || '');
    return { __binary: { type: 'application/pdf', data: workoutPdf(d, { userName: store.currentUser().name, figure: figureFor(await store.getSettings()) }), filename: `GymCoach ${d.date} ${d.title.replace(/[^\w .-]+/g, '')}.pdf` } };
  },
  'POST /api/workout/mail': async (req) => {
    const { id } = await body(req);
    const d = await mailWorkout(String(id || ''));
    return { ok: true, to: (await store.getSettings()).email, title: d.title };
  },
  'POST /api/mail/test': async () => {
    const s = await store.getSettings();
    await mail.send(s.smtp, { to: s.email, subject: 'GymCoach: testmail', text: 'Het versturen van e-mail vanuit GymCoach werkt.', html: '<p>Het versturen van e-mail vanuit <b>GymCoach</b> werkt. ✓</p>' });
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
      if (!t.length) throw Object.assign(new Error('Kies minstens één trainingsdag'), { status: 400 });
      prefs.dayTypes = t;
    }
    return { plan: await generatePlan(prefs) };
  },
  'GET /api/focus': async () => ({ focus: Object.fromEntries(Object.entries(engine.FOCUS).map(([k, v]) => [k, v.label])), dayTypes: engine.DAY_TYPES }),
  'PUT /api/plan': async (req) => {
    const plan = await body(req);
    if (!plan?.sessions) throw Object.assign(new Error('Ongeldig plan'), { status: 400 });
    for (const s of plan.sessions) for (const e of s.exercises) for (const set of e.sets) {
      set.reps = Math.min(30, Math.max(1, Math.round(+set.reps)));
      set.weight = Math.max(0.5, Math.round(+set.weight * 2) / 2);
      set.rest = Math.min(300, Math.max(10, Math.round(+set.rest)));
    }
    refreshMuscles(plan);
    await store.savePlan(plan);
    return { plan };
  },
  'POST /api/plan/push': async (req) => {
    const { sessionKey, dryRun = true } = await body(req);
    const plan = await store.getPlan();
    const session = plan?.sessions.find((s) => s.key === sessionKey);
    if (!session) throw Object.assign(new Error('Sessie niet gevonden'), { status: 404 });
    if (session.outdoor || !session.exercises?.length) throw Object.assign(new Error('Deze dag is cardio buiten; daar is geen programma voor de Gym Monster bij'), { status: 400 });
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
  'POST /api/coach': async () => {
    const ctx = await context();
    const plan = (await store.getPlan()) || (await generatePlan());
    const allowed = allowedExercises(ctx.library, ctx.settings);
    const result = await ai.coach({ settings: ctx.settings, plan, history: ctx.history, bodyLog: ctx.bodyLog, weekly: engine.weeklyStats(ctx.workouts), allowed, activities: await store.getActivities() });
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
    started: STARTED, users: (await store.getUsers()).length,
  }),
  'POST /api/terms/accept': async (req) => {
    const b = await body(req);
    if (Number(b.version) !== TERMS_VERSION) throw Object.assign(new Error('De voorwaarden zijn intussen gewijzigd; ververs de pagina'), { status: 409 });
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
    next.birthYear = next.birthYear === '' || next.birthYear == null ? null : Math.round(+next.birthYear);
    if (next.birthYear != null && !(next.birthYear >= 1920 && next.birthYear <= new Date().getFullYear() - 10)) throw Object.assign(new Error('Ongeldig geboortejaar'), { status: 400 });
    next.hrMax = next.hrMax === '' || next.hrMax == null || !(+next.hrMax) ? null : Math.round(+next.hrMax);
    if (next.hrMax != null && !(next.hrMax >= 120 && next.hrMax <= 230)) throw Object.assign(new Error('Maximale hartslag moet tussen 120 en 230 liggen'), { status: 400 });
    next.stepGoal = Math.min(40000, Math.max(1000, Math.round(+next.stepGoal || 8000)));
    if (next.heightCm != null && !(next.heightCm >= 100 && next.heightCm <= 250)) throw Object.assign(new Error('Lengte moet tussen 100 en 250 cm liggen'), { status: 400 });
    next.email = String(next.email || '').trim();
    if (next.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(next.email)) throw Object.assign(new Error('Ongeldig e-mailadres'), { status: 400 });
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
  'POST /api/swap': async (req) => {
    const { pattern, variant, id } = await body(req);
    const s = await store.getSettings();
    s.overrides = { ...s.overrides };
    if (id) s.overrides[`${pattern}:${variant}`] = Number(id); else delete s.overrides[`${pattern}:${variant}`];
    await store.saveSettings(s);
    return { plan: await generatePlan() };
  },
  'POST /api/avoid': async (req) => {
    const { id } = await body(req);
    const s = await store.getSettings();
    s.avoidIds = [...new Set([...(s.avoidIds || []), Number(id)])];
    await store.saveSettings(s);
    return { plan: await generatePlan() };
  },
  'GET /api/alternatives': async (req, url) => {
    const library = await getLibrary();
    return { items: engine.alternatives(library, url.searchParams.get('muscle')) };
  },
  'POST /api/bodyweight': async (req) => {
    const { date, kg, fat } = await body(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(+kg > 20 && +kg < 400)) throw Object.assign(new Error('Ongeldige invoer'), { status: 400 });
    if (fat != null && !(+fat > 2 && +fat < 70)) throw Object.assign(new Error('Ongeldig vetpercentage'), { status: 400 });
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
      return { __html: `<h2 style="margin:0 0 .5rem">Withings gekoppeld ✓</h2><p>${r.added} metingen opgehaald. Je kunt dit tabblad sluiten; GymCoach in het andere tabblad is bijgewerkt.</p><p><a href="/#body" style="color:#ff7a2e">Of ga naar GymCoach</a></p>
        <script>try{new BroadcastChannel('gymcoach').postMessage({type:'withings',ok:true,added:${Number(r.added) || 0}})}catch(e){}setTimeout(()=>{window.close()},1500)</script>` };
    } catch (e) {
      const msg = String(e.message).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));
      return { __html: `<h2 style="margin:0 0 .5rem;color:#ff6b6b">Koppelen mislukt</h2><p>${msg}</p><p>Sluit dit tabblad en probeer het opnieuw in GymCoach.</p>
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
      if (!['Global', 'EU'].includes(b.region)) throw Object.assign(new Error('Regio moet Global of EU zijn'), { status: 400 });
      await cli.configSet('region', b.region);
    }
    if (b.deviceType != null) {
      const dt = Math.round(Number(b.deviceType));
      if (!(dt >= 1 && dt <= 20)) throw Object.assign(new Error('Ongeldig toesteltype'), { status: 400 });
      await cli.configSet('device_type', dt);
    }
    let login = { ok: true }, library = null;
    try { await cli.login(); } catch (e) { login = { ok: false, error: e.authFailure ? 'Inloggen mislukt: controleer e-mail, wachtwoord en regio' : e.message }; }
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
    if (!Array.isArray(ids) || !ids.length) throw Object.assign(new Error('Geen programma’s gekozen'), { status: 400 });
    const r = await speediance.deletePrograms(ids.map(String).slice(0, 200));
    console.log(`programma's verwijderd: ${r.done.length}, mislukt: ${r.failed.length}`);
    return r;
  },
  'POST /api/library/refresh': async () => ({ count: await refreshLibrary() }),

  // ---------- eigen account ----------
  'PUT /api/me/password': async (req) => {
    const { current, password } = await body(req);
    const me = store.currentUser();
    await auth.login(me.username, current, 'pw-change:' + me.id).catch(() => { throw Object.assign(new Error('Huidig wachtwoord klopt niet'), { status: 400 }); });
    await auth.setPassword(me.id, password);
    return { ok: true, relogin: true };
  },
  'PUT /api/me': async (req) => {
    const { name } = await body(req);
    if (!name || String(name).length > 40) throw Object.assign(new Error('Ongeldige naam'), { status: 400 });
    const users = await store.getUsers();
    const u = users.find((x) => x.id === store.currentUser().id);
    u.name = String(name).trim();
    await store.saveUsers(users);
    return { me: auth.publicUser(u) };
  },

  'PUT /api/me/avatar': async (req) => {
    const { dataUrl } = await body(req);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw Object.assign(new Error('Alleen JPG, PNG of WebP'), { status: 400 });
    const buf = Buffer.from(m[2], 'base64');
    const sig = { 'image/jpeg': [0xff, 0xd8], 'image/png': [0x89, 0x50], 'image/webp': [0x52, 0x49] }[m[1]];
    if (buf.length > 400e3) throw Object.assign(new Error('Foto is te groot (max. 400 kB)'), { status: 400 });
    if (buf[0] !== sig[0] || buf[1] !== sig[1]) throw Object.assign(new Error('Geen geldige afbeelding'), { status: 400 });
    const v = store.setAvatar(store.currentUser().id, m[1], buf);
    return { avatar: v };
  },
  'DELETE /api/me/avatar': async () => { store.deleteAvatar(store.currentUser().id); return { avatar: null }; },
  'GET /api/avatar': async (req, url) => {
    const a = store.getAvatar(url.searchParams.get('id') || '');
    if (!a) throw Object.assign(new Error('Geen foto'), { status: 404 });
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
    if (!u) throw Object.assign(new Error('Gebruiker niet gevonden'), { status: 404 });
    if (u.role === 'admin' && role !== 'admin' && users.filter((x) => x.role === 'admin').length === 1) throw Object.assign(new Error('Er moet minstens één beheerder blijven'), { status: 400 });
    u.role = role === 'admin' ? 'admin' : 'user';
    await store.saveUsers(users);
    return { user: auth.publicUser(u) };
  },
  'DELETE /api/users': async (req, url) => {
    requireAdmin();
    const id = url.searchParams.get('id');
    if (id === store.currentUser().id) throw Object.assign(new Error('Je kunt jezelf niet verwijderen'), { status: 400 });
    await auth.deleteUser(id);
    return { ok: true, note: 'De gebruiker kan niet meer inloggen. Zijn gegevens blijven bewaard in de database.' };
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
    if ((await store.getUsers()).length) throw Object.assign(new Error('Er bestaat al een beheerder'), { status: 409 });
    // nooit een nieuwe beheerder maken terwijl er nog niet-overgezette accounts staan
    if (existsSync(path.join(store.DATA_DIR, 'users.json'))) {
      const imp = await store.importJsonStore().catch((e) => { throw Object.assign(new Error(`Je bestaande accounts konden niet worden overgezet (${e.message}). Draai 'node restore.js' op de server.`), { status: 500 }); });
      if (imp) throw Object.assign(new Error('Je bestaande accounts zijn hersteld. Log in met je oude gebruikersnaam en wachtwoord.'), { status: 409 });
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
    if (!userId) throw Object.assign(new Error('Ongeldige of ontbrekende sleutel'), { status: 401 });
    const user = (await store.getUsers()).find((u) => u.id === userId);
    if (!user) throw Object.assign(new Error('Gebruiker bestaat niet meer'), { status: 401 });
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

// Stuurt het antwoord van een route: JSON, PDF/bestand of een redirect.
function send(res, out) {
  if (out?.__redirect) { res.writeHead(302, { location: out.__redirect }); return res.end(); }
  if (out?.__binary) {
    const h = { 'content-type': out.__binary.type, 'cache-control': out.__binary.filename ? 'no-store' : 'private, max-age=31536000, immutable', 'content-security-policy': "default-src 'none'" };
    if (out.__binary.filename) h['content-disposition'] = `inline; filename="${out.__binary.filename.replace(/"/g, '')}"`;
    res.writeHead(200, h); return res.end(out.__binary.data);
  }
  if (out?.__html) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:2rem;background:#0f1012;color:#ecebe7">${out.__html}`); }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  return res.end(JSON.stringify(out));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  try {
    const key = `${req.method} ${url.pathname}`;
    if (publicRoutes[key]) return send(res, await publicRoutes[key](req, url, res));
    // wijzigende verzoeken alleen van dezelfde herkomst (CSRF-bescherming)
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {
      res.writeHead(403, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Verzoek van andere herkomst geweigerd' }));
    }
    const handler = routes[key];
    if (handler) {
      const user = await auth.userFromRequest(req);
      if (!user) {
        if (url.pathname === '/api/withings/callback') return send(res, { __html: '<p>Je bent niet (meer) ingelogd. <a href="/">Log in</a> en start het koppelen opnieuw.</p>' });
        res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: 'Niet ingelogd', login: true }));
      }
      return await store.runAs(user, async () => send(res, await handler(req, url)));
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
    res.end(JSON.stringify({ error: e.message, authFailure: !!e.authFailure }));
  }
});

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
