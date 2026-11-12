// Regels-engine: schema, voorschrift per doel, dubbele progressie, deload.
// Teksten (notities, labels) komen uit het woordenboek in de taal van de gebruiker (lib/lang.js).
import { tr, userLang } from './lang.js';
import { setSlowdown, repDecline, sideMean, sideSplit, SLOW_MAX } from './signals.js';
import { localeOf, ALL_LANGS, t as tAny } from '../public/i18n.js';

// Bewegingspatronen met beginnersvriendelijke Gym Monster 1-oefeningen (library-id's).
export const PATTERNS = {
  squat: { label: 'Squat',            type: 'compound',  start: 12, ids: [2242, 2294, 247] },
  hinge: { label: 'Heupscharnier',    type: 'compound',  start: 14, ids: [550, 448, 3446] },
  hpush: { label: 'Borst drukken',    type: 'compound',  start: 10, ids: [242, 2237, 304] },
  hpull: { label: 'Roeien',           type: 'compound',  start: 15, ids: [47, 416278129541121, 413] },
  vpull: { label: 'Lat pulldown',     type: 'compound',  start: 15, ids: [434, 168, 262] },
  vpush: { label: 'Schouder drukken', type: 'compound',  start: 6,  ids: [416075666227201, 560, 509] },
  lunge: { label: 'Lunge / split',    type: 'compound',  start: 8,  ids: [373153407303681, 372730011189249, 3766] },
  glute: { label: 'Bilspieren',       type: 'compound',  start: 18, ids: [2241, 395971079438337] },
  lat:   { label: 'Zijwaarts heffen', type: 'isolation', start: 3,  ids: [93, 465] },
  rear:  { label: 'Achterste schouder', type: 'isolation', start: 5, ids: [2547, 466] },
  curl:  { label: 'Biceps',           type: 'isolation', start: 6,  ids: [199, 335] },
  tri:   { label: 'Triceps',          type: 'isolation', start: 8,  ids: [319, 418246434553857] },
  core:  { label: 'Core',             type: 'isolation', start: 8,  ids: [372785837375489, 391213477920769] },
  calf:  { label: 'Kuiten',           type: 'isolation', start: 18, ids: [471, 438005852536833] },
};

// Schema's per aantal trainingsdagen. Volgorde = prioriteit (wordt ingekort op tijd).
const S = (p, v = 0) => [p, v];
export const TEMPLATES = {
  2: [
    { key: 'A', name: 'Full Body A', slots: [S('squat'), S('hpush'), S('vpull'), S('hinge'), S('lat'), S('core'), S('curl'), S('tri')] },
    { key: 'B', name: 'Full Body B', slots: [S('hinge', 1), S('vpush'), S('hpull'), S('lunge'), S('glute'), S('rear'), S('core', 1), S('calf')] },
  ],
  3: [
    { key: 'A', name: 'Full Body A', slots: [S('squat'), S('hpush'), S('hpull'), S('hinge'), S('lat'), S('core')] },
    { key: 'B', name: 'Full Body B', slots: [S('hinge', 1), S('vpush'), S('vpull'), S('lunge'), S('rear'), S('curl'), S('tri')] },
    { key: 'C', name: 'Full Body C', slots: [S('squat', 1), S('hpush', 1), S('hpull', 1), S('glute'), S('lat'), S('core', 1), S('calf')] },
  ],
  4: [
    { key: 'UA', name: 'Upper A', slots: [S('hpush'), S('vpull'), S('vpush'), S('hpull'), S('lat'), S('curl'), S('tri')] },
    { key: 'LA', name: 'Lower A', slots: [S('squat'), S('hinge'), S('lunge'), S('glute'), S('calf'), S('core')] },
    { key: 'UB', name: 'Upper B', slots: [S('hpush', 1), S('hpull', 1), S('vpull', 1), S('rear'), S('lat'), S('tri', 1), S('curl', 1)] },
    { key: 'LB', name: 'Lower B', slots: [S('squat', 1), S('hinge', 1), S('glute'), S('lunge', 1), S('core', 1), S('calf')] },
  ],
};
TEMPLATES[5] = [...TEMPLATES[4], { ...TEMPLATES[3][0], key: 'F', name: 'Full Body' }];
TEMPLATES[1] = [{ ...TEMPLATES[3][0], key: 'F', name: 'Full Body' }];

// Cardio-circuit op de Gym Monster: grote spiergroepen, licht gewicht, veel herhalingen, korte rust.
const CIRCUIT = { key: 'CC', name: 'Cardio-circuit', slots: [S('squat'), S('hpush'), S('hpull'), S('lunge'), S('vpush'), S('glute'), S('vpull'), S('core')] };
// Soorten trainingsdagen die je per dag kunt kiezen.
export const DAY_TYPES = Object.defineProperties({}, Object.fromEntries(Object.entries({
  spieropbouw: 'Kracht (spieropbouw)',
  combinatie: 'Combinatie (kracht + afvallen)',
  afvallen: 'Afvallen (kracht, hoge dichtheid)',
  circuit: 'Cardio-circuit op de Gym Monster',
  buiten: 'Cardio buiten (wandelen/fietsen)',
}).map(([k]) => [k, { get: () => tr(`app.daytypes.${k}`), enumerable: true }])));

// Warming-up en cooldown per type training.
// cable = kabeloefeningen (de Gym Monster telt herhalingen); mobility/stretch = zonder kabel.
// Zonder kabel dwingt Speediance een timer af: het getal in de set is seconden, ongeveer 30 voor deze korte mobiliteit.
const WARMCOOL = {
  upper: {
    cable: [{ id: 372786986614785, reps: 12, weight: 2 }],
    mobility: [{ id: 2267, dose: '30 s', reps: 30 }, { id: 426421535899649, dose: '30 s per kant', reps: 30 }],
    stretch: [{ id: 372747822301185, dose: '30 s per kant' }, { id: 372763297185793, dose: '30 s per kant' }, { id: 372246883991553, dose: '30 s per kant' }],
  },
  lower: {
    cable: [{ id: 426410785898497, reps: 10, weight: 3 }],
    mobility: [{ id: 3018, dose: '30 s', reps: 30 }, { id: 390887755022337, dose: '30 s per been', reps: 30 }, { id: 2821, dose: '30 s', reps: 30 }],
    stretch: [{ id: 372774875561985, dose: '30 s per kant' }, { id: 372789987639297, dose: '30 s per kant' }, { id: 372776194670593, dose: '30 s per kant' }, { id: 372779229249537, dose: '30 s per kant' }],
  },
  full: {
    cable: [{ id: 372786986614785, reps: 12, weight: 2 }, { id: 426410785898497, reps: 10, weight: 3 }],
    mobility: [{ id: 426421535899649, dose: '30 s per kant', reps: 30 }, { id: 3018, dose: '30 s', reps: 30 }],
    stretch: [{ id: 372747822301185, dose: '30 s per kant' }, { id: 372763297185793, dose: '30 s per kant' }, { id: 372774875561985, dose: '30 s per kant' }, { id: 372789987639297, dose: '30 s per kant' }],
  },
};
const sessionType = (key) => (key.startsWith('U') ? 'upper' : key.startsWith('L') ? 'lower' : 'full');
const on = (v) => v !== 'off' && v !== false;

// Warming-up (mobiliteit en lichte kabelsets) en cooldown (stretches) voor een training.
function warmCool(key, settings, libById) {
  const wc = WARMCOOL[sessionType(key)];
  const lib = (x) => libById.get(x.id);
  const mk = (x) => lib(x) && { id: x.id, title: lib(x).name, dose: x.dose, reps: x.reps ?? 2, weight: x.weight ?? 0 };
  return {
    warmup: on(settings.warmup) ? { cable: wc.cable.map(mk).filter(Boolean), mobility: wc.mobility.map(mk).filter(Boolean) } : null,
    cooldown: on(settings.cooldown) ? wc.stretch.map(mk).filter(Boolean) : null,
  };
}

// Voorschrift per doel.
const RX = {
  spieropbouw: { compound: { sets: 3, lo: 8, hi: 12, rest: 90 }, isolation: { sets: 3, lo: 10, hi: 15, rest: 60 } },
  combinatie:  { compound: { sets: 3, lo: 10, hi: 12, rest: 60 }, isolation: { sets: 3, lo: 12, hi: 15, rest: 45 } },
  afvallen:    { compound: { sets: 3, lo: 12, hi: 15, rest: 45 }, isolation: { sets: 2, lo: 15, hi: 20, rest: 30 } },
};
const RX_CIRCUIT = { compound: { sets: 3, lo: 15, hi: 20, rest: 20 }, isolation: { sets: 3, lo: 15, hi: 20, rest: 20 } };
export const GOALS = Object.keys(RX);

const round05 = (x) => Math.max(0.5, Math.round(x * 2) / 2);
// Normaliseert een oefeningnaam om namen te kunnen vergelijken.
export const norm = (s) => String(s || '').toLowerCase().replace(/[（(].*?[)）]/g, '').replace(/[^a-z0-9]+/g, '');

// ---------- historie ----------

function median(arr) {
  const a = arr.filter((x) => typeof x === 'number' && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.floor(a.length / 2)];
}

// Bouw { [exerciseId|name]: [{date, sets:[{reps,target,weight}]}] } uit opgeslagen sessies.
export function buildHistory(sessions, library) {
  const byName = new Map();
  for (const e of library) {
    const k = norm(e.name);
    if (!byName.has(k)) byName.set(k, e);
  }
  const hist = {};
  for (const s of Object.values(sessions)) {
    if (!Array.isArray(s.detail)) continue; // ook vrije trainingen en lessen met setdata tellen mee
    for (const ex of s.detail) {
      const name = ex.actionLibraryName;
      if (!name || !Array.isArray(ex.finishedReps)) continue;
      const sets = [];
      for (const r of ex.finishedReps) {
        const ws = r.trainingInfoDetail?.weights;
        const reps = Number(r.finishedCount ?? (Array.isArray(ws) ? ws.length : 0));
        const weight = Number(r.weight ?? median(ws || []) ?? ex.maxWeight ?? 0);
        if (reps > 0 && weight > 0) sets.push({ reps, target: Number(r.targetCount ?? 0) || null, weight, vol: setVolume(r, reps, weight), slow: setSlowdown(r) });
      }
      if (!sets.length) continue;
      const lib = byName.get(norm(name));
      const key = lib ? String(lib.id) : `name:${name}`;
      const h = (hist[key] ||= { id: lib?.id ?? null, name: lib?.name ?? name, muscle: lib?.muscle ?? null, log: [] });
      // dezelfde oefening vaker in één training (superset: om en om) → één regel met alle sets
      const same = h.log.find((l) => l.trainingId === s.training_id);
      if (same) same.sets.push(...sets); else h.log.push({ date: s.date, trainingId: s.training_id, sets });
    }
  }
  for (const h of Object.values(hist)) h.log.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return hist;
}

// Echt volume van één set: Speediance geeft per set de 'capacity' (alle handgrepen/kabels samen,
// bij twee handgrepen dus 2× het gewicht per handgreep). Zonder dat veld: herhalingen × gewicht.
export function setVolume(r, reps, weight) {
  const cap = Number(r?.capacity);
  return cap > 0 ? cap : reps * weight;
}

// Volume van een set uit de historie (oudere logs zonder vol: herhalingen × gewicht).
export const volOf = (s) => (s.vol > 0 ? s.vol : s.reps * s.weight);

// Per oefening de verhouding echt volume ÷ (herhalingen × gewicht), geleerd uit je eigen trainingen
// (2 bij twee handgrepen, 1 bij één). def = de mediaan over alles, voor oefeningen zonder historie.
export function volumeFactors(history) {
  const byId = {}, all = [];
  for (const h of Object.values(history)) {
    const rs = h.log.flatMap((l) => l.sets).filter((s) => s.vol > 0 && s.reps * s.weight > 0).map((s) => s.vol / (s.reps * s.weight));
    if (!rs.length) continue;
    const f = Math.max(1, Math.round(median(rs)));
    if (h.id != null) byId[h.id] = f;
    all.push(f);
  }
  return { byId, def: all.length ? Math.max(1, Math.round(median(all))) : 1 };
}

// Geschat 1RM volgens Epley: gewicht × (1 + herhalingen / 30).
export const epley = (w, r) => w * (1 + r / 30);

// Details van één training: oefeningen met sets, en per oefening de vorige keer ter vergelijking.
// hartslag uit de Speediance-sessie zelf (als er een hartslagband/horloge gekoppeld was)
function sessionHeart(session) {
  const out = {};
  const walk = (o, depth = 0) => {
    if (!o || typeof o !== 'object' || depth > 2) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && v > 30 && v < 230) {
        if (/heart|hr|bpm/i.test(k) && /avg|average|mean/i.test(k)) out.avg ??= Math.round(v);
        else if (/heart|hr|bpm/i.test(k) && /max|peak/i.test(k)) out.max ??= Math.round(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, depth + 1);
    }
  };
  walk(session?.info); walk(session && { ...session, detail: undefined, info: undefined });
  return out;
}

// Alle details van één training voor het rapport: oefeningen, sets, vergelijking met de vorige keer, tijd, hartslag, spierkaart.
export function workoutDetail(workout, session, library, history, health = null) {
  const byName = new Map();
  for (const e of library) { const k = norm(e.name); if (!byName.has(k)) byName.set(k, e); }
  const date = String(workout?.date || session?.date || '');
  const exercises = [];
  const muscles = {};
  for (const ex of Array.isArray(session?.detail) ? session.detail : []) {
    const name = ex.actionLibraryName || ex.name || 'Oefening';
    const sets = (Array.isArray(ex.finishedReps) ? ex.finishedReps : []).map((r) => {
      const ws = (r.trainingInfoDetail?.weights || []).map(Number).filter((x) => x > 0);
      const reps = Number(r.finishedCount ?? ws.length ?? 0);
      const weight = Math.round(Number(r.weight ?? median(ws) ?? ex.maxWeight ?? 0) * 10) / 10;
      const vol = setVolume(r, reps, weight);
      // tijd onder spanning: som van de tijden per herhaling (links/rechts: de langste kant)
      let tut = 0;
      for (const [k, v] of Object.entries(r.trainingInfoDetail || {})) {
        if (/finishedtimes$/i.test(k) && Array.isArray(v)) tut = Math.max(tut, v.reduce((t, x) => t + (Number(x) > 0 && Number(x) < 30 ? Number(x) : 0), 0));
      }
      const hr = Number(r.maxHeartRate);
      // starttijd van de set (ms), voor de hartslaglijn op een echte tijdas
      let ts = Infinity;
      for (const [k, v] of Object.entries(r.trainingInfoDetail || {})) if (/timestamps$/i.test(k) && Array.isArray(v)) for (const x of v) { const n = Number(x); const t = n > 1e12 ? n : n > 1e9 ? n * 1000 : NaN; if (t < ts) ts = t; }
      const watts = sideMean(r.trainingInfoDetail, /watts$/i);
      const amp = sideMean(r.trainingInfoDetail, /amplitudes$/i);
      const wattSides = sideSplit(r.trainingInfoDetail, /watts$/i);
      const ampSides = sideSplit(r.trainingInfoDetail, /amplitudes$/i);
      const sideFade = (s) => repDecline((s || []).filter((x) => x > 0));
      return { reps, target: Number(r.targetCount ?? 0) || null, weight, vol, min: ws.length ? Math.min(...ws) : null, max: ws.length ? Math.max(...ws) : null,
        tut: tut ? Math.round(tut * 10) / 10 : null, slow: setSlowdown(r), rest: Number(r.breakTime) > 0 ? Number(r.breakTime) : null, hr: hr > 30 && hr < 230 ? Math.round(hr) : null, ts: Number.isFinite(ts) ? ts : null,
        watts: watts.length >= 4 ? watts : null, amp: amp.length >= 4 ? amp : null, wattFade: repDecline(watts), ampFade: repDecline(amp),
        wattsL: wattSides.left, wattsR: wattSides.right, ampL: ampSides.left, ampR: ampSides.right,
        wattFadeL: sideFade(wattSides.left), wattFadeR: sideFade(wattSides.right), ampFadeL: sideFade(ampSides.left), ampFadeR: sideFade(ampSides.right) };
    }).filter((x) => x.reps > 0 || x.weight > 0);
    const lib = byName.get(norm(name));
    const key = lib ? String(lib.id) : `name:${name}`;
    const prevLog = (history[key]?.log || []).filter((l) => String(l.date) < date).slice(-1)[0] || null;
    const vol = sets.reduce((v, x) => v + x.vol, 0);
    const top = sets.reduce((m, x) => Math.max(m, x.weight), 0);
    const best = sets.reduce((m, x) => Math.max(m, epley(x.weight, x.reps)), 0);
    let prev = null;
    if (prevLog) {
      const pTop = prevLog.sets.reduce((m, x) => Math.max(m, x.weight), 0);
      const pBest = prevLog.sets.reduce((m, x) => Math.max(m, epley(x.weight, x.reps)), 0);
      prev = { date: prevLog.date, sets: prevLog.sets, top: pTop, e1rmDelta: Math.round((best - pBest) * 10) / 10, topDelta: Math.round((top - pTop) * 10) / 10 };
    }
    // spiergroepen voor het anatomische figuur: primair uit de catalogus, secundair via het bewegingspatroon
    if (sets.length && lib) {
      const pattern = Object.keys(PATTERNS).find((k) => PATTERNS[k].ids.map(Number).includes(Number(lib.id)));
      const em = exerciseMuscles({ pattern, muscle: lib.muscle });
      for (const [k, wgt] of Object.entries(em)) muscles[k] = (muscles[k] || 0) + wgt * sets.length;
    }
    const tutSec = sets.reduce((t, x) => t + (x.tut || 0), 0);
    const slows = sets.map((x) => x.slow).filter((x) => x != null);
    const scoreNum = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
    const scores = { force: scoreNum(ex.forceControlScore), balance: scoreNum(ex.bilateralBalanceScore), rom: scoreNum(ex.amplitudeStableScore), done: scoreNum(ex.completionScore), total: scoreNum(ex.score) };
    exercises.push({ name: lib?.name || name, muscle: lib?.muscle ? (MUSCLE_NL[lib.muscle] || lib.muscle) : null, sets, volume: Math.round(vol), top, e1rm: Math.round(best * 10) / 10, prev, tutSec: tutSec ? Math.round(tutSec) : null, slow: slows.length ? Math.max(...slows) : null, scores: Object.values(scores).some((v) => v != null) ? scores : null });
  }
  return {
    id: String(workout?.training_id ?? session?.training_id ?? ''), date, title: workout?.title || session?.title || tr('ui.settings.training'),
    kind: workout?.kind || session?.kind || null, minutes: workout?.duration_secs ? Math.round(workout.duration_secs / 60) : null,
    calories: workout?.calories ?? null, // totaal = som van de oefeningen (zelfde rekenwijze); alleen zonder details het totaal van Speediance
    volume: exercises.length ? exercises.reduce((v, e) => v + e.volume, 0) : Math.round(Number(workout?.volume) || 0),
    completion: session?.info?.completionRate ?? null, exercises, hasDetail: exercises.length > 0,
    muscles: Object.fromEntries(Object.entries(muscles).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    time: (() => {
      const all = exercises.flatMap((e) => e.sets);
      const timed = all.filter((x) => x.tut);
      if (!timed.length) return null;
      const tut = Math.round(timed.reduce((t, x) => t + x.tut, 0));
      const reps = timed.reduce((t, x) => t + x.reps, 0);
      const rest = all.reduce((t, x) => t + (x.rest || 0), 0);
      const duration = Number(workout?.duration_secs) || null;
      return { tut, reps, perRep: reps ? Math.round((tut / reps) * 10) / 10 : null, rest: rest || null, duration, coverage: Math.round((timed.length / all.length) * 100) };
    })(),
    setHr: (() => { const l = exercises.flatMap((e) => e.sets.map((x, i) => (x.hr ? { ex: e.name, set: i + 1, hr: x.hr, ts: x.ts } : null))).filter(Boolean); const t0 = Math.min(...l.map((p) => p.ts ?? Infinity)); return l.map((p) => ({ ex: p.ex, set: p.set, hr: p.hr, t: Number.isFinite(t0) && p.ts ? Math.round((p.ts - t0) / 1000) : null })); })(),
    ...(() => {
      const sh = sessionHeart(session);
      const hrAvg = sh.avg ?? health?.hrAvg ?? null, hrMax = sh.max ?? health?.hrMax ?? null;
      return { hrAvg, hrMax, hrSource: sh.avg || sh.max ? 'Gym Monster' : hrAvg || hrMax ? 'Apple Health' : null, healthKcal: health?.kcal ?? null };
    })(),
  };
}

// Verloop van één oefening: per training het beste geschatte 1RM, topgewicht en volume.
export function exerciseProgress(hist) {
  return Object.values(hist).map((h) => ({
    id: h.id, name: h.name, muscle: h.muscle,
    points: h.log.map((l) => {
      const best = l.sets.reduce((m, s) => Math.max(m, epley(s.weight, s.reps)), 0);
      const top = l.sets.reduce((m, s) => Math.max(m, s.weight), 0);
      return { date: l.date, topWeight: top, e1rm: Math.round(best * 10) / 10, volume: l.sets.reduce((v, s) => v + volOf(s), 0) };
    }),
  })).sort((a, b) => b.points.length - a.points.length);
}

// ---------- progressie ----------

function mode(arr) {
  const c = new Map();
  for (const x of arr) c.set(x, (c.get(x) || 0) + 1);
  let best = null, n = 0;
  for (const [k, v] of c) if (v > n || (v === n && k > best)) { best = k; n = v; }
  return best;
}

// Dubbele progressie: het voorschrift voor de volgende keer uit de laatste keer(en).
export function progress(log, rx, pattern) {
  const inc = pattern.type === 'compound' ? 2 : 1;
  if (!log || !log.length) {
    return { weight: pattern.start, reps: rx.lo, note: tr('eng.startgewichtPasAanZodat'), basis: null };
  }
  const last = log[log.length - 1];
  const w = mode(last.sets.map((s) => s.weight));
  const work = last.sets.filter((s) => s.weight === w);
  const minReps = Math.min(...work.map((s) => s.reps));
  const basis = `${last.date?.slice(0, 10) ?? '?'}: ${work.map((s) => s.reps).join('/')} × ${w} kg`;

  if (work.every((s) => s.reps >= rx.hi)) {
    // de laatste herhalingen werden veel trager (vanaf 40%): eerst nog een keer hetzelfde gewicht, de keer daarna toch omhoog
    const lastSlow = work[work.length - 1]?.slow;
    const prevL = log.length > 1 ? log[log.length - 2] : null;
    const prevHeld = prevL && mode(prevL.sets.map((s) => s.weight)) === w && prevL.sets.filter((s) => s.weight === w).every((s) => s.reps >= rx.hi);
    if (lastSlow != null && lastSlow >= SLOW_MAX && !prevHeld) return { weight: w, reps: rx.hi, note: tr('eng.slowHold', { pct: lastSlow }), basis };
    return { weight: round05(w + inc), reps: rx.lo, note: tr('eng.kgAlleSetsOp', { inc, hi: rx.hi }), basis };
  }
  if (minReps >= rx.lo) {
    return { weight: w, reps: Math.min(rx.hi, minReps + 1), note: tr('eng.zelfdeGewicht1Herhaling'), basis };
  }
  const prev = log.length > 1 ? log[log.length - 2] : null;
  const prevFail = prev && prev.sets.some((s) => s.weight >= w && s.reps < rx.lo);
  if (prevFail) return { weight: round05(w * 0.9), reps: rx.lo, note: tr('eng.10TweeKeerOnder'), basis };
  return { weight: w, reps: rx.lo, note: tr('eng.zelfdeGewichtNogEen'), basis };
}

// ---------- persoonlijke afstemming ----------

// Met welke tabel GymCoach rekent: man/vrouw zoals ingesteld; anders de zelf gekozen tabel (bandSex), of geen.
export const calcSex = (settings = {}) => (['m', 'v'].includes(settings.sex) ? settings.sex : ['m', 'v'].includes(settings.bandSex) ? settings.bandSex : '');

const round5 = (n) => Math.round(n / 5) * 5;
// Rust tussen sets: basis per doel; bij vrouwen 20% korter (sneller herstel tussen sets),
// daarna bijgesteld op je eigen herstel: zakken je herhalingen in latere sets, dan langer.
export function restFor(base, { sex = '', log = null, type = 'compound' } = {}) {
  let rest = base, why = [];
  if (sex === 'v') { rest = base * 0.8; why.push(tr('eng.20KorterVrouwenHerstellen')); }
  const recent = (log || []).slice(-3).map((l) => {
    const w = Math.max(...l.sets.map((x) => x.weight));
    const work = l.sets.filter((x) => x.weight >= w * 0.95);
    if (work.length < 2) return null;
    const first = work[0].reps, last = work[work.length - 1].reps;
    return { drop: first > 0 ? (first - last) / first : 0, hit: work.every((x) => !x.target || x.reps >= x.target) };
  }).filter(Boolean);
  if (recent.length >= 2) {
    const drop = recent.reduce((t, r) => t + r.drop, 0) / recent.length;
    if (drop >= 0.2) { rest *= 1.25; why.push(tr('eng.langerJeHerhalingenZakken', { a: Math.round(drop * 100) })); }
    else if (recent.length >= 3 && recent.every((r) => r.drop <= 0 && r.hit)) { rest *= 0.9; why.push(tr('eng.ietsKorterJeHaalt')); }
  }
  const min = type === 'compound' ? 30 : 20;
  rest = Math.min(180, Math.max(min, round5(rest)));
  return { rest, why: why.length && rest !== base ? tr('eng.rustSBasisS', { rest, base, a: why.join('; ') }) : null };
}

// ---------- plan ----------

// Hoofdspier per patroon in de Speediance-catalogus (voor terugval bij een ander Gym Monster-model).
const PATTERN_LIB_MUSCLE = { squat: 'Quads', hinge: 'Glutes', hpush: 'Pecs', hpull: 'Lats', vpull: 'Lats', vpush: 'Front Delts', lunge: 'Quads', glute: 'Glutes', lat: 'Side Delts', rear: 'Rear Delts', curl: 'Biceps', tri: 'Triceps', core: 'Abs', calf: 'Calves' };
const PATTERN_HINT = { squat: /squat/i, hinge: /deadlift|pull ?through|good morning/i, hpush: /press|fly/i, hpull: /row/i, vpull: /pulldown|pull-down/i, vpush: /shoulder press|overhead/i, lunge: /lunge|split/i, glute: /hip thrust|kickback|bridge/i, lat: /lateral raise/i, rear: /face pull|reverse fly|rear/i, curl: /curl/i, tri: /pushdown|extension/i, core: /crunch|woodchop|pallof/i, calf: /calf/i };
let snapshotById = null;

// Accessoires van de Gym Monster. Wie er een niet wil (of niet heeft) gebruiken, krijgt geen oefeningen
// meer voorgesteld die hem nodig hebben — net als de instelling in de Speediance-app. De catalogus zegt niet
// welk accessoire een oefening gebruikt, dus GymCoach leidt het af uit de naam en het soort.
export const ACCESSORIES = [
  { key: 'barbell', label: 'Stang (barbell)', test: (e) => /barbell|\bbar\b/i.test(e.name) },
  { key: 'bench', label: 'Bank', test: (e) => /bench|incline|decline|\bbox\b/i.test(e.name) || (e.tab === 'Training' && /seated/i.test(e.name)) },
  { key: 'handles', label: 'Handgrepen', test: (e) => /handle/i.test(e.name) },
  { key: 'rope', label: 'Touw (tricep rope)', test: (e) => /\brope\b/i.test(e.name) },
  { key: 'belt', label: 'Heupgordel', test: (e) => /\bbelt/i.test(e.name) },
  { key: 'rowski', label: 'Roei- en skihandvat', test: (e) => e.tab === 'Row & Ski' },
  { key: 'mat', label: 'Mat (pilates)', test: (e) => e.tab === 'Pilates-Mat' || /\bmat\b/i.test(e.name) },
];
for (const a of ACCESSORIES) Object.defineProperty(a, 'label', { get: () => tr(`acc.${a.key}`), enumerable: true });

// Welke accessoires een oefening nodig heeft (sleutels uit ACCESSORIES).
export const accessoriesOf = (e) => ACCESSORIES.filter((a) => a.test(e)).map((a) => a.key);

// De catalogus zonder oefeningen die een accessoire nodig hebben dat je niet gebruikt.
export function usableLibrary(library, settings) {
  const no = new Set(settings?.noAccessories || []);
  if (!no.size) return library;
  return library.filter((e) => !accessoriesOf(e).some((k) => no.has(k)));
}

// Kiest een oefening voor een bewegingspatroon uit de catalogus van het toestel (met terugval op naam of spiergroep).
export function pickExercise(patternKey, variant, settings, libById, snapshot = []) {
  const avoid = new Set((settings.avoidIds || []).map(Number));
  const ov = settings.overrides?.[`${patternKey}:${variant}`];
  if (ov && libById.has(Number(ov))) return libById.get(Number(ov));
  // 1. vaste Gym Monster 1-keuze op id
  const ids = PATTERNS[patternKey].ids.filter((id) => libById.has(id) && !avoid.has(id));
  if (ids.length) return libById.get(ids[variant % ids.length]);
  // 2. zelfde oefening op naam (ander model, andere id's)
  snapshotById ||= new Map(snapshot.map((e) => [Number(e.id), e]));
  const byName = new Map([...libById.values()].map((e) => [String(e.name).toLowerCase(), e]));
  const named = PATTERNS[patternKey].ids.map((id) => byName.get(String(snapshotById.get(id)?.name || '').toLowerCase())).filter((e) => e && !avoid.has(Number(e.id)));
  if (named.length > variant) return named[variant];
  // 3. een kabeloefening voor dezelfde spier met een passende naam
  const taken = new Set(named.map((e) => Number(e.id)));
  const cands = [...libById.values()].filter((e) => e.tab === 'Training' && e.muscle === PATTERN_LIB_MUSCLE[patternKey] && !avoid.has(Number(e.id)) && !taken.has(Number(e.id)));
  if (!cands.length && named.length) return named[0];
  const hinted = cands.filter((e) => PATTERN_HINT[patternKey].test(e.name));
  const pool = hinted.length ? hinted : cands;
  return pool.length ? pool[variant % pool.length] : null;
}

const estSeconds = (sets) => 60 + sets.reduce((t, s) => t + s.reps * 4 + s.rest, 0);

// Aantal trainingsweken sinds de eerste training (voor het deloadritme).
export function weekNumber(sessions) {
  const dates = Object.values(sessions).map((s) => s.date).filter(Boolean).sort();
  if (!dates.length) return 1;
  const first = new Date(dates[0]);
  return Math.max(1, Math.floor((Date.now() - first.getTime()) / (7 * 864e5)) + 1);
}

// ---------- focus & spierkaart ----------

// Focusgebieden (zoals in het plan-venster) → bewegingspatronen.
export const FOCUS = {
  armen: { label: 'Armen', patterns: ['curl', 'tri'] },
  borst: { label: 'Borst', patterns: ['hpush'] },
  schouders: { label: 'Schouders', patterns: ['vpush', 'lat', 'rear'] },
  bovenrug: { label: 'Bovenrug', patterns: ['hpull', 'vpull', 'rear'] },
  onderrug: { label: 'Onderrug', patterns: ['hinge'] },
  core: { label: 'Buik / core', patterns: ['core'] },
  billen: { label: 'Billen', patterns: ['glute', 'hinge'] },
  benen: { label: 'Benen', patterns: ['squat', 'lunge', 'hinge', 'calf'] },
};
// Labels in de taal van de gebruiker: bij het lezen vertaald (de lijsten hierboven houden de Nederlandse tekst als terugval).
const labelGetters = (obj, prefix) => { for (const k of Object.keys(obj)) Object.defineProperty(obj[k], 'label', { get: () => tr(`${prefix}.${k}`), enumerable: true }); };
labelGetters(PATTERNS, 'pat');
labelGetters(FOCUS, 'focus');
export const REGION = { hpush: 'upper', hpull: 'upper', vpull: 'upper', vpush: 'upper', lat: 'upper', rear: 'upper', curl: 'upper', tri: 'upper', squat: 'lower', hinge: 'lower', lunge: 'lower', glute: 'lower', calf: 'lower', core: 'both' };

// Spierkaart: primair (1) en secundair (0,5) per patroon.
const PATTERN_MUSCLES = {
  squat: { quads: 1, glutes: 0.5, adductors: 0.5 },
  hinge: { hamstrings: 1, glutes: 1, lowerBack: 0.5 },
  hpush: { pecs: 1, frontDelts: 0.5, triceps: 0.5 },
  hpull: { lats: 1, traps: 0.5, rearDelts: 0.5, biceps: 0.5 },
  vpull: { lats: 1, biceps: 0.5 },
  vpush: { frontDelts: 1, sideDelts: 0.5, triceps: 0.5 },
  lunge: { quads: 1, glutes: 1, adductors: 0.5 },
  glute: { glutes: 1, hamstrings: 0.5 },
  lat: { sideDelts: 1 },
  rear: { rearDelts: 1, traps: 0.5 },
  curl: { biceps: 1, forearms: 0.5 },
  tri: { triceps: 1 },
  core: { abs: 1 },
  calf: { calves: 1 },
};
export const LIB_MUSCLE = { Pecs: 'pecs', Lats: 'lats', 'Rear Delts': 'rearDelts', 'Side Delts': 'sideDelts', 'Front Delts': 'frontDelts', Traps: 'traps', Triceps: 'triceps', Biceps: 'biceps', Forearms: 'forearms', Abs: 'abs', Glutes: 'glutes', Quads: 'quads', Hamstrings: 'hamstrings', Calves: 'calves', Adductors: 'adductors', 'Back Extensors': 'lowerBack' };

// Spiergroepen van een oefening: hoofdspier 1, meewerkende spieren 0,5.
export function exerciseMuscles(e) {
  const m = { ...(PATTERN_MUSCLES[e.pattern] || {}) };
  for (const k of e.aux || []) if (!m[k]) m[k] = 0.5; // meewerkende spieren uit de Speediance-gegevens
  const prim = LIB_MUSCLE[e.muscle];
  if (prim) m[prim] = 1;
  return m;
}

// Sets per spiergroep in een training.
export function sessionMuscles(session) {
  const out = {};
  for (const e of session.exercises) {
    e.muscles = exerciseMuscles(e);
    for (const [k, w] of Object.entries(e.muscles)) out[k] = (out[k] || 0) + w * e.sets.length;
  }
  return out;
}

// Kabels op de bodemplaat van de Gym Monster, niet aan de armen. De catalogus zegt het niet, dus het volgt uit de naam en het patroon.
export function usesBasePlate(e) {
  const name = String(e?.title || e?.name || '');
  if (/main\s*frame/i.test(name)) return true;
  if (/overhead squat/i.test(name)) return false;
  if (/\b(bench|pulldown|pull-down|shoulder press|chest press|chest fly|face pull|lateral raise|pushdown|push-down|woodchop|pallof)\b/i.test(name)) return false;
  if (/deadlift|romanian|good morning|hip thrust|pull[- ]?through|\bsquat\b|\blunge\b|split squat|bulgarian|calf raise|bent-over|bent over/i.test(name)) return true;
  if (e?.pattern === 'squat' || e?.pattern === 'hinge' || e?.pattern === 'lunge' || e?.pattern === 'calf') return true;
  if (e?.pattern === 'glute' && !/incline/i.test(name)) return true;
  return false;
}

function mainMuscle(e) {
  const named = LIB_MUSCLE[e?.muscle];
  if (named) return named;
  const rows = Object.entries(PATTERN_MUSCLES[e?.pattern] || {}).filter(([, w]) => w >= 1);
  rows.sort((a, b) => b[1] - a[1]);
  return rows[0]?.[0] || '';
}

// Zelfde kabelopstelling bij elkaar. Dezelfde spiergroep niet achter elkaar: dan liever een extra ombouw.
// Een zware oefening blijft vooraan zolang dat geen extra ombouw kost.
export function orderForSetup(exercises) {
  const left = (exercises || []).map((e, i) => ({
    e, i,
    base: typeof e._base === 'boolean' ? e._base : usesBasePlate(e),
    muscles: Array.isArray(e._muscles) ? e._muscles : (mainMuscle(e) ? [mainMuscle(e)] : []),
    compound: e.type === 'compound',
  }));
  const shares = (a, b) => a.muscles.some((m) => b.muscles.includes(m));
  const out = [];
  while (left.length) {
    const prev = out[out.length - 1];
    const compoundsLeft = left.some((c) => c.compound);
    let best = left[0], bestScore = Infinity;
    for (const c of left) {
      let score = c.i * 0.01;
      if (prev && shares(prev, c)) score += 1000;
      else if (prev && c.base !== prev.base) score += 15;
      if (!c.compound && compoundsLeft) score += 8;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    out.push(best);
    left.splice(left.indexOf(best), 1);
  }
  return out.map((x) => x.e);
}

// Zelfde sortering voor een training die al bestaat. Een superset blijft één blok.
export function orderSessionExercises(exercises) {
  const blocks = [];
  const list = exercises || [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.group) {
      const grp = [e];
      while (list[i + 1]?.group === e.group) grp.push(list[++i]);
      blocks.push(grp);
    } else blocks.push([e]);
  }
  const reps = blocks.map((b) => ({
    type: b.some((e) => e.type === 'compound') ? 'compound' : 'isolation',
    _base: b.every((e) => usesBasePlate(e)),
    _muscles: [...new Set(b.map(mainMuscle).filter(Boolean))],
    _block: b,
  }));
  return orderForSetup(reps).flatMap((r) => r._block);
}

// Zet focusoefeningen vooraan en voegt ontbrekende focuspatronen toe die bij het type training passen.
function orderSlots(slots, focusPatterns, sessionKey, ti) {
  if (!focusPatterns.size) return slots;
  const type = sessionKey.startsWith('U') ? 'upper' : sessionKey.startsWith('L') ? 'lower' : 'full';
  const have = new Set(slots.map(([p]) => p));
  const extra = [...focusPatterns].filter((p) => !have.has(p) && (type === 'full' || REGION[p] === type || REGION[p] === 'both')).map((p) => [p, ti % 2]);
  const all = [...slots, ...extra];
  const isF = ([p]) => focusPatterns.has(p);
  const comp = ([p]) => PATTERNS[p].type === 'compound';
  return [...all.filter((s) => isF(s) && comp(s)), ...all.filter((s) => isF(s) && !comp(s)), ...all.filter((s) => !isF(s) && comp(s)), ...all.filter((s) => !isF(s) && !comp(s))];
}

// Focus én krachtdoelen vooraan, zonder voor elk doel een extra oefening op elke dag te zetten.
function orderTrainingSlots(slots, focusPatterns, goalPatterns, sessionKey, ti) {
  const ordered = orderSlots(slots, focusPatterns, sessionKey, ti);
  const rank = ([p]) => {
    const marked = goalPatterns.has(p) || focusPatterns.has(p);
    const comp = PATTERNS[p]?.type === 'compound';
    if (marked && comp) return 0;
    if (marked) return 1;
    if (comp) return 2;
    return 3;
  };
  return ordered.map((s, i) => [s, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([s]) => s);
}

// Maakt het weekplan met de regels: schema, voorschrift per doel, progressie, rust, deload, focus en tijdbudget.
export function buildPlan({ settings, library, history, week, focus = [], wish = '', snapshot = [], dayTypes = null, earlyDeload = false }) {
  const focusKeys = focus.filter((f) => FOCUS[f]);
  const focusPatterns = new Set(focusKeys.flatMap((f) => FOCUS[f].patterns));
  const libById = new Map(library.map((e) => [Number(e.id), e]));
  // per dag een soort training; zonder keuze: alle dagen het doel uit de instellingen
  const types = (Array.isArray(dayTypes) && dayTypes.length ? dayTypes : Array.from({ length: Math.min(5, Math.max(2, Number(settings.daysPerWeek) || 3)) }, () => settings.goal))
    .slice(0, 6).map((t) => (DAY_TYPES[t] ? t : settings.goal in RX ? settings.goal : 'combinatie'));
  const strengthTypes = types.filter((t) => RX[t]);
  const days = types.length;
  const nStrength = Math.min(5, strengthTypes.length);
  // deload volgens het vaste ritme, of eerder als de herstelscore daar om vraagt (zie signals.recovery)
  const fixedDeload = settings.deloadEveryWeeks > 0 && week > 1 && week % settings.deloadEveryWeeks === 0;
  const deload = fixedDeload || !!earlyDeload;
  const overhead = (on(settings.warmup) ? 6 : 0) + (on(settings.cooldown) ? 4 : 0); // minuten warming-up + cooldown
  const budget = Math.max(15, (Number(settings.minutesPerSession) || 45) - overhead) * 60;

  const strengthTpls = nStrength ? TEMPLATES[nStrength] : [];
  let si = 0, ci = 0, oi = 0;
  const plans = types.map((t) => {
    if (RX[t]) return { kind: 'kracht', tpl: strengthTpls[si], rxGoal: RX[t], goal: t, ti: si++ };
    if (t === 'circuit') { ci++; return { kind: 'circuit', tpl: { ...CIRCUIT, key: ci > 1 ? `CC${ci}` : 'CC', name: ci > 1 ? tr('eng.circuitN', { n: ci }) : tr('eng.circuit') }, rxGoal: RX_CIRCUIT, goal: t, ti: ci }; }
    oi++; return { kind: 'buiten', key: oi > 1 ? `OUT${oi}` : 'OUT', name: oi > 1 ? tr('eng.outdoorN', { n: oi }) : tr('eng.outdoor') };
  });

  const sessions = plans.map(({ kind, tpl, rxGoal, goal, ti, key, name }) => {
    if (kind === 'buiten') {
      // niet voor het toestel: een richtlijn, gevolgd via Apple Health
      return { key, name, outdoor: true, type: 'buiten', exercises: [], muscles: {}, estMinutes: Number(settings.minutesPerSession) || 45,
        advice: tr('eng.wandelenOfFietsenIn') };
    }
    const circuit = kind === 'circuit';
    const exercises = [];
    let used = 0;
    const goalPatterns = new Set();
    if (settings.alignPlan) for (const m of goalMuscleKeys(settings.outcome, history, library)) for (const p of patternsForMuscle(m)) goalPatterns.add(p);
    for (const [pk, variant] of (circuit ? tpl.slots : orderTrainingSlots(tpl.slots, focusPatterns, goalPatterns, tpl.key, ti))) {
      if (exercises.some((e) => e.pattern === pk && e.variant === variant)) continue;
      const pattern = PATTERNS[pk];
      const lib = pickExercise(pk, variant, settings, libById, snapshot);
      if (!lib) continue;
      const rx = { ...rxGoal[pattern.type] };
      if (settings.experience !== 'beginner' && pattern.type === 'compound') rx.sets += 1;
      const log = history[String(lib.id)]?.log;
      if (!log || log.length < 2) rx.sets = Math.min(rx.sets, 2); // inloop: eerst techniek
      let p = progress(log, rx, pattern);
      if (circuit) { rx.sets = 3; p = { ...p, weight: round05(p.weight * 0.6), reps: rx.lo, note: tr('eng.circuitLichtEnVlot') }; }
      const isFocus = !circuit && focusPatterns.has(pk);
      let sets = rx.sets;
      if (deload) { sets = Math.max(2, sets - 1); p = { ...p, weight: round05(p.weight * 0.9), note: tr('eng.deloadWeekLichterHerstel') }; }
      const rs = circuit ? { rest: rx.rest, why: null } : restFor(rx.rest, { sex: calcSex(settings), log, type: pattern.type });
      const setList = Array.from({ length: sets }, () => ({ reps: p.reps, weight: p.weight, mode: 1, rest: rs.rest }));
      const t = estSeconds(setList);
      if (exercises.length >= 3 && used + t > budget) continue;
      used += t;
      exercises.push({
        pattern: pk, variant, patternLabel: pattern.label, type: pattern.type,
        id: lib.id, title: lib.name, muscle: lib.muscle,
        repRange: [rx.lo, rx.hi], sets: setList, note: p.note, basis: p.basis, focus: isFocus, restNote: rs.why,
      });
    }
    // tweede ronde: extra set voor focus-oefeningen zolang het binnen de tijd past.
    // Vrouwen verdragen per sessie meestal meer volume: dan mag het tot 5 sets, en krijgen
    // ook de basisoefeningen (geen deload, niet in de inloop) een extra set als de tijd het toelaat.
    const female = calcSex(settings) === 'v' && !deload && !circuit;
    for (const e of exercises) {
      const cap = female ? 5 : 4;
      if (!e.focus || e.sets.length >= cap) continue;
      const extra = e.sets[0].reps * 4 + e.sets[0].rest;
      if (used + extra > budget) continue;
      e.sets.push({ ...e.sets[0] }); used += extra;
    }
    if (female) for (const e of exercises) {
      if (e.focus || e.type !== 'compound' || e.sets.length < 3 || e.sets.length >= 4) continue;
      const extra = e.sets[0].reps * 4 + e.sets[0].rest;
      if (used + extra > budget) continue;
      e.sets.push({ ...e.sets[0] }); used += extra; e.volumeNote = tr('eng.extraSetWomen');
    }
    const ordered = orderForSetup(exercises);
    exercises.splice(0, exercises.length, ...ordered);
    const firstCompound = exercises.find((e) => e.type === 'compound');
    if (firstCompound && on(settings.warmup) && !circuit) firstCompound.rampUp = true;
    const sess = { key: tpl.key, name: tpl.name, type: goal, exercises, ...warmCool(circuit ? 'F' : tpl.key, settings, libById), estMinutes: Math.round(used / 60) + overhead };
    sess.muscles = sessionMuscles(sess);
    return sess;
  });

  const muscles = {};
  for (const s of sessions) for (const [k, v] of Object.entries(s.muscles)) muscles[k] = (muscles[k] || 0) + v;
  const distinct = [...new Set(types)];
  return { week, deload, deloadReason: deload ? (fixedDeload ? 'rhythm' : 'recovery') : undefined, goal: distinct.length === 1 ? distinct[0] : 'gemengd', dayTypes: types, daysPerWeek: days, generatedAt: new Date().toISOString(), source: 'regels', focus: focusKeys, wish: String(wish || '').slice(0, 500), muscles, sessions };
}

// Zwaardere sets voor het krachtdoel. Beginners blijven iets hoger in de herhalingen.
const RX_STRENGTH = {
  compound: { sets: 4, lo: 4, hi: 6, rest: 150 },
  isolation: { sets: 3, lo: 6, hi: 8, rest: 120 },
};

function patternKeyOf(lib) {
  const id = Number(lib?.id);
  for (const [k, p] of Object.entries(PATTERNS)) if (p.ids.includes(id)) return k;
  const fits = Object.keys(PATTERN_LIB_MUSCLE).filter((p) => PATTERN_LIB_MUSCLE[p] === lib?.muscle);
  return fits.find((p) => PATTERN_HINT[p].test(String(lib?.name || ''))) || fits[0] || null;
}

function strengthExercise(lib, pk, settings, history, deload) {
  const pattern = PATTERNS[pk] || { type: 'isolation', start: 8, label: lib.muscle || '' };
  const rx = { ...(RX_STRENGTH[pattern.type] || RX_STRENGTH.isolation) };
  if (settings.experience === 'beginner' && pattern.type === 'compound') { rx.sets = 3; rx.lo = 5; rx.hi = 8; rx.rest = 120; }
  const log = history?.[String(lib.id)]?.log;
  let p = progress(log, rx, pattern);
  let sets = rx.sets;
  if (!log || log.length < 2) sets = Math.min(sets, 2); // inloop: eerst techniek
  if (deload) { sets = Math.max(2, sets - 1); p = { ...p, weight: round05(p.weight * 0.9) }; }
  const rs = restFor(rx.rest, { sex: calcSex(settings), log, type: pattern.type });
  return {
    pattern: pk, variant: 0, patternLabel: pattern.label, type: pattern.type,
    id: lib.id, title: lib.name, muscle: lib.muscle, repRange: [rx.lo, rx.hi],
    sets: Array.from({ length: sets }, () => ({ reps: p.reps, weight: p.weight, mode: 1, rest: rs.rest })),
    note: tr('eng.krachtdoel'), basis: p.basis, focus: false, strength: true, restNote: rs.why,
  };
}

const setSeconds = (list) => (list || []).reduce((t, e) => t + estSeconds(e.sets || []), 0);

function retuneRamp(sess) {
  let first = true;
  for (const e of sess.exercises || []) {
    if (first && e.type === 'compound' && sess.warmup) { e.rampUp = true; first = false; }
    else delete e.rampUp;
  }
}

function goalStrengths(outcome) {
  if (Array.isArray(outcome?.strengths) && outcome.strengths.length) return outcome.strengths;
  return outcome?.strength ? [outcome.strength] : [];
}

// Spiergroepen van de krachtdoelen. Een ouder doel op één oefening telt als de spiergroep van die oefening.
function goalMuscleKeys(outcome, history, library) {
  const keys = [];
  for (const g of goalStrengths(outcome)) {
    let muscle = g?.muscle;
    if (!muscle && g?.exerciseId) {
      muscle = history?.[String(g.exerciseId)]?.muscle
        || (library || []).find((e) => Number(e.id) === Number(g.exerciseId))?.muscle;
    }
    if (muscle && !keys.includes(muscle)) keys.push(muscle);
  }
  return keys;
}

// Patronen die deze spiergroep als hoofdbeweging trainen (bij gelijk gewicht de samengestelde).
function patternsForMuscle(muscle) {
  const key = LIB_MUSCLE[muscle];
  if (!key) return [];
  const rows = Object.entries(PATTERN_MUSCLES)
    .map(([p, w]) => ({ p, w: w[key] || 0 }))
    .filter((r) => r.w > 0)
    .sort((a, b) => b.w - a.w || ((PATTERNS[a.p].type === 'compound' ? 0 : 1) - (PATTERNS[b.p].type === 'compound' ? 0 : 1)));
  if (!rows.length) return [];
  return rows.filter((r) => r.w === rows[0].w).map((r) => r.p);
}

const sessionRegion = (s) => (String(s?.key || '').startsWith('U') ? 'upper' : String(s?.key || '').startsWith('L') ? 'lower' : 'full');
const patternFitsSession = (s, pk) => {
  const region = REGION[pk] || 'both';
  const reg = sessionRegion(s);
  return reg === 'full' || region === 'both' || reg === region;
};
const trainableSession = (s) => s && !s.outdoor && s.type !== 'buiten' && s.type !== 'circuit' && Array.isArray(s.exercises);

// Zwaardere sets op de oefening die het plan al koos. De oefening zelf blijft.
function prescribeStrength(exercise, settings, history, deload, library) {
  const lib = (library || []).find((e) => Number(e.id) === Number(exercise.id)) || { id: exercise.id, name: exercise.title, muscle: exercise.muscle };
  const before = estSeconds(exercise.sets || []);
  const built = strengthExercise(lib, exercise.pattern || patternKeyOf(lib), settings, history, deload);
  exercise.type = built.type;
  exercise.repRange = built.repRange;
  exercise.sets = built.sets;
  exercise.note = built.note;
  exercise.basis = built.basis;
  exercise.restNote = built.restNote;
  exercise.strength = true;
  return estSeconds(exercise.sets) - before;
}

// Stemt het weekplan af op de spiergroepdoelen, samen met het schema dat er al ligt.
// Per spiergroep krijgen hooguit twee trainingen zwaardere sets, op het patroon dat die groep het best traint.
// Eén oefening kan meerdere doelen tegelijk dienen. Ontbreekt de groep helemaal, dan komt er één passende oefening bij.
// Vastgezette trainingen blijven zoals ze zijn. Cardio blijft cardio.
export function placeStrengthLift(plan, { settings, library, history } = {}) {
  if (!plan?.sessions || !settings?.alignPlan) return plan;
  const muscles = goalMuscleKeys(settings.outcome, history, library);
  if (!muscles.length) return plan;
  const patterns = new Map(muscles.map((m) => [m, patternsForMuscle(m)]));
  const covers = (e, m) => {
    const ps = patterns.get(m) || [];
    if (!ps.length) return false;
    if (e?.pattern && ps.includes(e.pattern)) return true;
    return !e?.pattern && e?.muscle === m;
  };
  const heavy = Object.fromEntries(muscles.map((m) => [m, 0]));

  for (const sess of plan.sessions) {
    if (!trainableSession(sess) || sess.locked) continue;
    const open = new Set(muscles.filter((m) => heavy[m] < 2 && sess.exercises.some((e) => covers(e, m))));
    const usedEx = new Set();
    while (open.size) {
      let best = null, bestHit = [];
      for (const e of sess.exercises) {
        if (usedEx.has(e)) continue;
        const hit = [...open].filter((m) => covers(e, m));
        if (!hit.length) continue;
        const better = !best || hit.length > bestHit.length || (hit.length === bestHit.length && e.type === 'compound' && best.type !== 'compound');
        if (better) { best = e; bestHit = hit; }
      }
      if (!best) break;
      const delta = prescribeStrength(best, settings, history, plan.deload, library);
      sess.estMinutes = Math.max(1, Math.round((sess.estMinutes || 0) + delta / 60));
      usedEx.add(best);
      for (const m of bestHit) { heavy[m]++; open.delete(m); }
    }
    const rank = (e) => (e.strength ? 0 : 2) + (e.type === 'compound' ? 0 : 1);
    sess.exercises = sess.exercises.map((e, i) => [e, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([e]) => e);
    retuneRamp(sess);
  }

  let missing = muscles.filter((m) => (patterns.get(m) || []).length && !plan.sessions.some((s) => trainableSession(s) && s.exercises.some((e) => covers(e, m))));
  const addedOn = new Set();
  const libById = new Map((library || []).map((e) => [Number(e.id), e]));
  while (missing.length) {
    const editable = plan.sessions.filter((s) => trainableSession(s) && !s.locked);
    let choice = null;
    for (const pk of new Set(missing.flatMap((m) => patterns.get(m) || []))) {
      const hit = missing.filter((m) => (patterns.get(m) || []).includes(pk));
      const day = editable.find((s) => patternFitsSession(s, pk) && !addedOn.has(s) && s.exercises.length < 8)
        || editable.find((s) => patternFitsSession(s, pk) && s.exercises.length < 8);
      if (!day || !hit.length) continue;
      if (!choice || hit.length > choice.hit.length) choice = { pk, hit, day };
    }
    if (!choice) break;
    const lib = pickExercise(choice.pk, 0, settings, libById, []);
    if (!lib) { missing = missing.filter((m) => !choice.hit.includes(m)); continue; }
    const built = strengthExercise(lib, choice.pk, settings, history, plan.deload);
    const list = [built, ...(choice.day.exercises || [])];
    if (list.length > 8) {
      const at = list.findLastIndex((e) => !e.strength && !e.focus);
      list.splice(at >= 0 ? at : list.length - 1, 1);
    }
    const before = setSeconds(choice.day.exercises);
    choice.day.exercises = list;
    retuneRamp(choice.day);
    choice.day.estMinutes = Math.max(1, Math.round((choice.day.estMinutes || 0) + (setSeconds(list) - before) / 60));
    addedOn.add(choice.day);
    missing = missing.filter((m) => !choice.hit.includes(m));
  }
  return plan;
}

// tijdsduur uit de dosering ("30 s", "30 s per kant"); de Gym Monster toont dit getal als seconden
const secondsOf = (x) => { const m = /(\d+)\s*s\b/i.exec(x.dose || ''); return m ? Number(m[1]) : 30; };
const sides = (x) => (/per (kant|been|arm)/i.test(x.dose || '') ? ['links', 'rechts'] : ['beide']);
// Mobiliteit zonder kabel kan de Gym Monster niet als herhalingen tellen. Een oude dosering
// ("10 herh.", "5 per kant") wordt 30 seconden; "per kant/been/arm" blijft per kant.
export function mobilityDose(item) {
  const dose = String(item?.dose || '');
  if (/\d+\s*s\b/i.test(dose)) return dose;
  const side = dose.match(/per (kant|been|arm)/i);
  return side ? `30 s per ${side[1].toLowerCase()}` : '30 s';
}
// Stretches die je links én rechts doet. Chest Stretch stond als één houding van 30 s,
// terwijl je die per kant doet. De gekozen seconden blijven staan.
const PER_SIDE_STRETCH = new Set([372747822301185]);
export function cooldownDose(item) {
  const dose = String(item?.dose || '');
  if (/per (kant|been|arm)/i.test(dose) || !PER_SIDE_STRETCH.has(Number(item?.id))) return dose || '30 s';
  const m = /(\d+)\s*s\b/i.exec(dose);
  return `${m ? m[1] : 30} s per kant`;
}
// Zet een plansessie om naar een programma voor de Gym Monster (met warming-up en cooldown).
export function toPushPlan(plan, session, settings = {}) {
  const set = (reps, weight, rest, mode = 1) => ({ reps, weight, mode: [1, 2, 3, 4, 5].includes(+mode) ? +mode : 1, rest });
  const out = [];
  const pushMob = settings.pushMobility === 'on';
  if (session.warmup) {
    if (pushMob) for (const m of session.warmup.mobility || []) {
      const dose = mobilityDose(m);
      out.push({ id: Number(m.id), title: m.title, sets: sides({ dose }).map(() => set(secondsOf({ dose }), 0, 10)) });
    }
    for (const c of session.warmup.cable) out.push({ id: Number(c.id), title: c.title, sets: [set(c.reps, c.weight, 30), set(c.reps, c.weight, 45)] });
  }
  const exs = session.exercises || [];
  for (let i = 0; i < exs.length; i++) {
    const e = exs[i];
    // superset: opeenvolgende oefeningen met dezelfde groep, om en om per ronde
    if (e.group && exs[i + 1]?.group === e.group) {
      const grp = [];
      while (exs[i]?.group === e.group) grp.push(exs[i++]);
      i--;
      for (const g of grp) if (g.rampUp && g.sets.length) out.push({ id: Number(g.id), title: g.title, sets: [set(8, round05(g.sets[0].weight * 0.5), 30)] });
      const rounds = Math.max(...grp.map((g) => g.sets.length));
      for (let r = 0; r < rounds; r++) {
        const inRound = grp.filter((g) => g.sets[r]);
        inRound.forEach((g, j) => {
          const x = g.sets[r];
          // binnen de ronde vrijwel geen rust (5 s om te wisselen), na de laatste oefening de ingestelde rust
          out.push({ id: Number(g.id), title: g.title, sets: [set(x.reps, x.weight, j === inRound.length - 1 ? x.rest : 5, x.mode)] });
        });
      }
      continue;
    }
    const sets = e.sets.map((s) => set(s.reps, s.weight, s.rest, s.mode));
    if (e.rampUp && sets.length) sets.unshift(set(8, round05(sets[0].weight * 0.5), 45)); // opwarmset ~50%
    out.push({ id: Number(e.id), title: e.title, sets });
  }
  // per kant / per been: twee sets (links en rechts), anders één
  if (session.cooldown && pushMob) for (const c of session.cooldown) {
    const dose = cooldownDose(c);
    out.push({ id: Number(c.id), title: c.title, sets: sides({ dose }).map(() => set(secondsOf({ dose }), 0, 5)) });
  }
  return { name: `GC ${planLabel(plan)} ${session.name}`, exercises: out };
}

// Vastgezette (bewerkte of eigen) training bij een nieuw voorstel: progressie per oefening uit de historie,
// behalve bij "vast gewicht". De opbouw van de sets (piramide, modi, rust) blijft; het gewicht schuift mee.
export function progressSession(session, history) {
  const s = JSON.parse(JSON.stringify(session));
  delete s.pushedAt; delete s.changedAfterPush;
  for (const e of s.exercises || []) {
    if (e.fixed || !e.sets?.length) continue;
    const log = history[String(e.id)]?.log;
    if (!log?.length) continue;
    const pattern = PATTERNS[e.pattern] || { type: e.type || 'compound', start: e.sets[0].weight };
    const rx = { lo: e.repRange?.[0] ?? 8, hi: e.repRange?.[1] ?? 12 };
    const p = progress(log, rx, pattern);
    const base = Math.max(...e.sets.map((x) => x.weight));
    const delta = round05(p.weight) - base;
    const sameReps = e.sets.every((x) => x.reps === e.sets[0].reps);
    e.sets = e.sets.map((x) => ({ ...x, weight: round05(x.weight + delta), reps: sameReps ? p.reps : x.reps }));
    e.note = p.note; e.basis = p.basis;
  }
  return s;
}

// Spiergroep (zoals in de Speediance-catalogus, bijv. "Triceps") → sleutel van het figuur.
const muscleKeyOf = (name) => LIB_MUSCLE[name] || null;
// Een oefening uit de catalogus klaarzetten voor een training (editor): patroon, type, voorschrift volgens
// het doel, gewicht uit de historie of een startgewicht, rust en spieren (ook meewerkende uit de uitleg).
export function exerciseFromLibrary(lib, { settings = {}, history = {}, info = null } = {}) {
  const name = String(lib.name || '');
  const fits = Object.keys(PATTERN_LIB_MUSCLE).filter((p) => PATTERN_LIB_MUSCLE[p] === lib.muscle);
  const pk = fits.find((p) => PATTERN_HINT[p].test(name)) || fits[0] || null;
  const type = info ? (info.compound ? 'compound' : 'isolation') : PATTERNS[pk]?.type || 'isolation';
  const goalRx = RX[settings.goal] || RX.combinatie;
  const rx = { ...goalRx[type] };
  if (settings.experience !== 'beginner' && type === 'compound') rx.sets += 1;
  const log = history[String(lib.id)]?.log;
  if (!log || log.length < 2) rx.sets = Math.min(rx.sets, 2);
  const start = info?.recommendedWeight ? round05(info.recommendedWeight) : PATTERNS[pk]?.start || 5;
  const p = progress(log, rx, { type, start });
  const rs = restFor(rx.rest, { sex: calcSex(settings), log, type });
  const muscles = { ...(PATTERN_MUSCLES[pk] || {}) };
  const aux = (info?.aux || []).map(muscleKeyOf).filter(Boolean);
  for (const k of aux) if (!muscles[k]) muscles[k] = 0.5;
  const prim = muscleKeyOf(lib.muscle); if (prim) muscles[prim] = 1;
  return {
    pattern: pk, variant: 0, patternLabel: PATTERNS[pk]?.label || lib.muscle || '', type,
    id: lib.id, title: name, muscle: lib.muscle, repRange: [rx.lo, rx.hi],
    sets: Array.from({ length: rx.sets }, () => ({ reps: p.reps, weight: p.weight, mode: 1, rest: rs.rest })),
    note: p.note, basis: p.basis, focus: false, restNote: rs.why, muscles, aux, added: true, unilateral: !!info?.unilateral,
  };
}

// Een training (sjabloon, kopie) geschikt maken voor deze gebruiker: met historie progressie zoals bij een
// vastgezette training; zonder historie het startgewicht voor deze gebruiker (bij sjablonen van anderen).
// De opbouw van de sets (aantal, herhalingen, rust, modi, piramide) blijft gelijk.
export function adaptSession(session, { history = {}, settings = {}, library = [], foreign = false, info = () => null } = {}) {
  const s = progressSession(session, history);
  const libById = new Map(library.map((e) => [Number(e.id), e]));
  for (const e of s.exercises || []) {
    if (history[String(e.id)]?.log?.length || !foreign || !e.sets?.length) continue;
    const lib = libById.get(Number(e.id)) || { id: e.id, name: e.title, muscle: e.muscle };
    const fresh = exerciseFromLibrary(lib, { settings, history, info: info(e.id) });
    const base = Math.max(...e.sets.map((x) => x.weight)), start = fresh.sets[0].weight;
    e.sets = e.sets.map((x) => ({ ...x, weight: round05(start * (x.weight / (base || 1))) }));
    e.note = fresh.note; e.basis = null;
  }
  return s;
}

// Andere oefeningen voor dezelfde spiergroep (voor Wissel oefening).
export function alternatives(library, muscle) {
  return library.filter((e) => e.tab === 'Training' && e.muscle === muscle).map((e) => ({ id: e.id, name: e.name }));
}

// ---------- statistieken ----------

export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}

// Trainingen, minuten en kcal per week.
export function weeklyStats(workouts) {
  const m = new Map();
  for (const w of workouts) {
    if (!w.date) continue;
    const k = isoWeek(new Date(w.date));
    const o = m.get(k) || { week: k, sessions: 0, minutes: 0, calories: 0, volume: 0 };
    o.sessions += 1;
    o.minutes += Math.round((Number(w.duration_secs) || 0) / 60);
    o.calories += Number(w.calories) || 0;
    o.volume += Number(w.volume) || 0;
    m.set(k, o);
  }
  return [...m.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-16);
}

// ---------- overzicht ----------

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// Gegevens voor Overzicht: deze week, volgende training, trends en tip.
export function overview({ workouts, history, bodyLog, plan, settings }) {
  const now = new Date();
  const target = Math.min(5, Math.max(2, Number(settings.daysPerWeek) || 3));
  const curWeek = isoWeek(now);
  const weeks = weeklyStats(workouts);
  const byWeek = new Map(weeks.map((w) => [w.week, w]));
  const thisW = byWeek.get(curWeek) || { sessions: 0, minutes: 0, volume: 0, calories: 0 };
  const prevKey = isoWeek(new Date(now.getTime() - 7 * 864e5));
  const prevW = byWeek.get(prevKey) || { volume: 0, sessions: 0 };

  // streak: weken op rij waarin het weekdoel gehaald is
  let streak = 0;
  for (let i = thisW.sessions >= target ? 0 : 1; i < 104; i++) {
    const w = byWeek.get(isoWeek(new Date(now.getTime() - i * 7 * 864e5)));
    if (w && w.sessions >= target) streak++; else break;
  }

  // kalender laatste 12 weken (84 dagen)
  const days = {};
  for (const w of workouts) {
    if (!w.date) continue;
    const k = dayKey(w.date);
    const d = (days[k] ||= { min: 0, titles: [] });
    d.min += Math.round((Number(w.duration_secs) || 0) / 60);
    if (w.title) d.titles.push(String(w.title));
  }

  // kracht: geschat 1RM laatste vs ~4 weken eerder
  const cutoff = new Date(now.getTime() - 28 * 864e5).toISOString().slice(0, 10);
  const prog = exerciseProgress(history).filter((p) => p.points.length >= 2);
  const strength = prog.slice(0, 4).map((p) => {
    const last = p.points[p.points.length - 1];
    const base = p.points.filter((q) => String(q.date) < cutoff).pop() || p.points[0];
    return { name: p.name, e1rm: last.e1rm, top: last.topWeight, deltaPct: base.e1rm ? Math.round(((last.e1rm - base.e1rm) / base.e1rm) * 1000) / 10 : 0, spark: p.points.slice(-10).map((q) => q.e1rm) };
  });

  // persoonlijke records laatste 14 dagen
  const prSince = new Date(now.getTime() - 14 * 864e5).toISOString().slice(0, 10);
  const prs = [];
  for (const p of exerciseProgress(history)) {
    let best = 0;
    for (const q of p.points) {
      if (q.e1rm > best && best > 0 && String(q.date) >= prSince) prs.push({ name: p.name, date: String(q.date).slice(0, 10), e1rm: q.e1rm, top: q.topWeight });
      best = Math.max(best, q.e1rm);
    }
  }
  prs.sort((a, b) => b.date.localeCompare(a.date));

  // lichaamsgewicht-trend (kg/week, laatste 28 dagen)
  let body = null;
  if (bodyLog.length) {
    const lastDate = bodyLog[bodyLog.length - 1].date;
    const from = new Date(new Date(lastDate + 'T12:00:00').getTime() - 28 * 864e5).toISOString().slice(0, 10);
    const recent = bodyLog.filter((b) => b.kg != null && b.date >= from);
    let slope = null;
    if (recent.length >= 2) {
      const t0 = new Date(recent[0].date).getTime();
      const xs = recent.map((b) => (new Date(b.date).getTime() - t0) / (7 * 864e5)), ys = recent.map((b) => b.kg);
      const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
      const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      slope = den ? Math.round((xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den) * 100) / 100 : null;
    }
    body = { kg: bodyLog[bodyLog.length - 1].kg, fat: bodyLog[bodyLog.length - 1].fat ?? null, source: bodyLog[bodyLog.length - 1].source || null, date: bodyLog[bodyLog.length - 1].date, slope, spark: bodyLog.slice(-12).map((b) => b.kg) };
  }

  // volgende training: eerste sessie uit het plan die deze week nog niet gedaan is
  let next = null;
  if (plan?.sessions?.length) {
    const st = planStatus(plan, workouts);
    const s = plan.sessions.find((x) => !st[x.key]) || plan.sessions[0];
    next = { key: s.key, name: s.name, estMinutes: s.estMinutes, count: s.exercises.length, pushedAt: s.pushedAt || null, exercises: s.exercises.slice(0, 6).map((e) => e.title) };
  }

  // tip van de regels-engine
  const dow = (now.getDay() + 6) % 7; // 0 = maandag
  const left = Math.max(0, target - thisW.sessions);
  let tip;
  if (left === 0) tip = tr('eng.tip.done');
  else if (left > 7 - dow) tip = tr('eng.tip.tight', { left, days: 7 - dow });
  else tip = tr('eng.tip.left', { n: left });
  if (plan?.deload) tip = tr('eng.tip.deload');
  if (prs.length) tip = tr('eng.tip.record', { name: prs[0].name }) + tip;

  return {
    week: { done: thisW.sessions, target, minutes: thisW.minutes, volume: Math.round(thisW.volume), calories: thisW.calories, prevVolume: Math.round(prevW.volume) },
    streak, days, strength, prs: prs.slice(0, 5), body, next, tip, goal: settings.goal,
  };
}

// ---------- statistieken ----------

// Spiergroepen (namen uit de catalogus van Speediance) → naam in de taal van de gebruiker (sleutels mus.* in het woordenboek).
export const MUSCLE_NL = new Proxy({
  Pecs: 'Borst', Lats: 'Rug (lats)', 'Rear Delts': 'Achterste schouder', 'Side Delts': 'Zijkant schouder',
  'Front Delts': 'Voorkant schouder', Traps: 'Trapezius', Triceps: 'Triceps', Biceps: 'Biceps', Forearms: 'Onderarmen',
  Abs: 'Buik / core', Glutes: 'Bilspieren', Quads: 'Quadriceps', Hamstrings: 'Hamstrings', Calves: 'Kuiten',
  Adductors: 'Adductoren', 'Back Extensors': 'Onderrug', 'Full Body': 'Full body',
}, { get: (o, k) => (typeof k === 'string' && k in o ? tr(`eng.mus.${k}`) : undefined) });

// Statistieken over een periode: per spiergroep en per oefening, records en kalender.
export function stats({ history, workouts, sessions = {}, activities = [], daily = [] }, days = 84, from = null) {
  const now = Date.now();
  const since = from || (days > 0 ? new Date(now - days * 864e5).toISOString().slice(0, 10) : '0000');
  const inRange = (d) => String(d || '').slice(0, 10) >= since;

  // 8 weken voor de weekmatrix (maandag-gebaseerd, ISO-week)
  const weekKeys = [];
  for (let i = 7; i >= 0; i--) weekKeys.push(isoWeek(new Date(now - i * 7 * 864e5)));

  const muscles = new Map();
  const exercises = [];
  const sessionIds = new Set();
  let sets = 0, reps = 0, volume = 0, heaviest = null;

  for (const h of Object.values(history)) {
    const muscleKey = h.muscle || 'Overig';
    const m = muscles.get(muscleKey) || { muscle: muscleKey, label: MUSCLE_NL[muscleKey] || muscleKey, sessions: new Set(), exercises: new Set(), sets: 0, reps: 0, volume: 0, maxWeight: 0, bestE1rm: 0, lastDate: null, weekly: Object.fromEntries(weekKeys.map((k) => [k, 0])) };
    const ex = { id: h.id, name: h.name, muscle: m.label, sessions: 0, sets: 0, reps: 0, volume: 0, maxWeight: 0, bestE1rm: 0, firstE1rm: null, lastE1rm: null, lastDate: null };

    for (const l of h.log) {
      const wk = l.date ? isoWeek(new Date(l.date)) : null;
      if (wk && wk in m.weekly) m.weekly[wk] += l.sets.length;
      if (!inRange(l.date)) continue;
      const e1 = Math.max(...l.sets.map((s) => epley(s.weight, s.reps)));
      ex.sessions++; m.sessions.add(l.trainingId); m.exercises.add(h.name); sessionIds.add(l.trainingId);
      ex.firstE1rm ??= e1; ex.lastE1rm = e1;
      const d10 = String(l.date).slice(0, 10);
      ex.lastDate = d10;
      if (d10 > String(m.lastDate || '')) m.lastDate = d10;
      for (const s of l.sets) {
        const v = volOf(s);
        ex.sets++; ex.reps += s.reps; ex.volume += v; ex.maxWeight = Math.max(ex.maxWeight, s.weight);
        m.sets++; m.reps += s.reps; m.volume += v; m.maxWeight = Math.max(m.maxWeight, s.weight);
        sets++; reps += s.reps; volume += v;
        if (!heaviest || s.weight > heaviest.weight) heaviest = { weight: s.weight, reps: s.reps, name: h.name, date: String(l.date).slice(0, 10) };
      }
      ex.bestE1rm = Math.max(ex.bestE1rm, e1); m.bestE1rm = Math.max(m.bestE1rm, e1);
    }
    muscles.set(muscleKey, m);
    if (ex.sessions) exercises.push({ ...ex, bestE1rm: Math.round(ex.bestE1rm * 10) / 10, volume: Math.round(ex.volume), progressPct: ex.firstE1rm ? Math.round(((ex.lastE1rm - ex.firstE1rm) / ex.firstE1rm) * 1000) / 10 : 0 });
  }

  const wInRange = workouts.filter((w) => inRange(w.date));
  // delen door het aantal weken sinds je eerste training in de periode (niet de hele periode)
  const firstDate = Object.values(history).flatMap((h) => h.log.map((l) => String(l.date).slice(0, 10))).filter(inRange).sort()[0];
  const sinceFirst = firstDate ? (now - new Date(firstDate).getTime()) / (7 * 864e5) : 1;
  const weeksInRange = Math.max(1, days > 0 ? Math.min(days / 7, sinceFirst) : sinceFirst);
  const muscleList = [...muscles.values()]
    .map((m) => ({ ...m, sessions: m.sessions.size, exercises: m.exercises.size, volume: Math.round(m.volume), bestE1rm: Math.round(m.bestE1rm * 10) / 10, setsPerWeek: Math.round((m.sets / weeksInRange) * 10) / 10 }))
    .filter((m) => m.sets > 0 || Object.values(m.weekly).some((x) => x > 0))
    .sort((a, b) => b.volume - a.volume);

  // extra kengetallen uit de trainingssamenvattingen (werken ook zonder setdata)
  const dates = wInRange.map((w) => String(w.date).slice(0, 10)).filter(Boolean).sort();
  const firstW = dates[0] || null;
  const spanWeeks = firstW ? Math.max(1, Math.min(days > 0 ? days / 7 : Infinity, (now - new Date(firstW + 'T12:00:00').getTime()) / (7 * 864e5))) : 1;
  const mins = wInRange.map((w) => Math.round((Number(w.duration_secs) || 0) / 60)).filter((x) => x > 0);
  // dagnamen zondag t/m zaterdag in de taal van de gebruiker (4 januari 2026 is een zondag)
  const DAYS_NL = [4, 5, 6, 7, 8, 9, 10].map((d) => new Date(2026, 0, d).toLocaleDateString(localeOf(userLang()), { weekday: 'long' }));
  const dayCount = new Array(7).fill(0);
  for (const d of dates) dayCount[new Date(d + 'T12:00:00').getDay()]++;
  const favIdx = dayCount.indexOf(Math.max(...dayCount));
  // weekreeksen: aaneengesloten weken met minstens één training
  const allWeeks = new Set(workouts.map((w) => w.date && isoWeek(new Date(w.date))).filter(Boolean));
  const wkBack = (i) => isoWeek(new Date(now - i * 7 * 864e5));
  let curStreak = 0; for (let i = allWeeks.has(wkBack(0)) ? 0 : 1; allWeeks.has(wkBack(i)); i++) curStreak++;
  let longest = 0, run = 0, prev = null;
  for (const d of [...new Set(workouts.map((w) => String(w.date || '').slice(0, 10)).filter(Boolean))].sort()) {
    const mon = new Date(d + 'T12:00:00'); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const k = mon.getTime();
    if (prev === k) continue;
    run = prev != null && Math.round((k - prev) / (7 * 864e5)) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run); prev = k;
  }
  const kinds = {};
  for (const w of wInRange) { const k = w.kind || w.type || 'overig'; kinds[k] = (kinds[k] || 0) + 1; }
  const longestW = wInRange.reduce((m, w) => (Number(w.duration_secs) || 0) > (Number(m?.duration_secs) || 0) ? w : m, null);
  // persoonlijke records in de periode: een sessie waarin het geschatte 1RM van een oefening hoger was dan ooit ervoor
  let prs = 0;
  for (const h of Object.values(history)) {
    let best = 0;
    for (const l of h.log) {
      const e1 = Math.max(...l.sets.map((x) => epley(x.weight, x.reps)));
      if (best > 0 && e1 > best && inRange(l.date)) prs++;
      best = Math.max(best, e1);
    }
  }
  const bestProg = exercises.filter((e) => e.sessions >= 2).sort((a, b) => b.progressPct - a.progressPct)[0] || null;
  const missingDetails = wInRange.filter((w) => !sessions[String(w.training_id)]).length;

  // cardio en activiteit uit Apple Health
  const aIn = activities.filter((a) => inRange(a.date));
  const byType = {};
  for (const a of aIn) {
    const t = byType[a.type] ||= { type: a.type, count: 0, minutes: 0, km: 0, kcal: 0, hrSum: 0, hrN: 0, longestKm: 0 };
    t.count++; t.minutes += a.minutes || 0; t.km += a.km || 0; t.kcal += a.kcal || 0; t.longestKm = Math.max(t.longestKm, a.km || 0);
    if (a.hrAvg) { t.hrSum += a.hrAvg; t.hrN++; }
  }
  const dIn = daily.filter((d) => inRange(d.date) && d.steps != null);
  const aFirst = aIn.map((a) => a.date).sort()[0];
  const aWeeks = aFirst ? Math.max(1, Math.min(days > 0 ? days / 7 : Infinity, (now - new Date(aFirst + 'T12:00:00').getTime()) / (7 * 864e5))) : 1;
  const cardio = {
    types: Object.values(byType).map((t) => ({ type: t.type, count: t.count, minutes: Math.round(t.minutes), km: Math.round(t.km * 10) / 10, kcal: Math.round(t.kcal), hrAvg: t.hrN ? Math.round(t.hrSum / t.hrN) : null, longestKm: Math.round(t.longestKm * 10) / 10 })).sort((a, b) => b.minutes - a.minutes),
    count: aIn.length,
    minutes: Math.round(aIn.reduce((x, a) => x + (a.minutes || 0), 0)),
    km: Math.round(aIn.reduce((x, a) => x + (a.km || 0), 0) * 10) / 10,
    kcal: Math.round(aIn.reduce((x, a) => x + (a.kcal || 0), 0)),
    minutesPerWeek: Math.round(aIn.reduce((x, a) => x + (a.minutes || 0), 0) / aWeeks),
    avgSteps: dIn.length ? Math.round(dIn.reduce((x, d) => x + d.steps, 0) / dIn.length) : null,
    stepDays: dIn.length,
  };

  return {
    days, from, cardio,
    extra: {
      perWeek: Math.round((wInRange.length / spanWeeks) * 10) / 10,
      avgMinutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
      avgKcal: wInRange.length ? Math.round(wInRange.reduce((t, w) => t + (Number(w.calories) || 0), 0) / wInRange.length) : 0,
      summaryVolume: Math.round(wInRange.reduce((t, w) => t + (Number(w.volume) || 0), 0)),
      activeDays: new Set(dates).size,
      favDay: dates.length ? { day: DAYS_NL[favIdx], n: dayCount[favIdx] } : null,
      streak: curStreak, longestStreak: longest,
      firstDate: firstW,
      longest: longestW ? { minutes: Math.round((Number(longestW.duration_secs) || 0) / 60), title: longestW.title, date: String(longestW.date).slice(0, 10) } : null,
      kinds,
      prs,
      bestProgress: bestProg ? { name: bestProg.name, pct: bestProg.progressPct } : null,
      setsPerWorkout: sessionIds.size ? Math.round((sets / sessionIds.size) * 10) / 10 : 0,
      repsPerSet: sets ? Math.round((reps / sets) * 10) / 10 : 0,
      avgLoad: reps ? Math.round((volume / reps) * 10) / 10 : 0,
      missingDetails,
    },
    totals: {
      workouts: wInRange.length,
      programSessions: sessionIds.size,
      minutes: Math.round(wInRange.reduce((t, w) => t + (Number(w.duration_secs) || 0), 0) / 60),
      calories: wInRange.reduce((t, w) => t + (Number(w.calories) || 0), 0),
      sets, reps, volume: Math.round(volume),
      avgVolume: sessionIds.size ? Math.round(volume / sessionIds.size) : 0,
      heaviest,
    },
    weekKeys,
    muscles: muscleList,
    exercises: exercises.sort((a, b) => b.volume - a.volume),
  };
}

// Welke trainingen uit het plan zijn deze week al gedaan? Koppelt Gym Monster-trainingen van deze ISO-week
// aan een plansessie op naam ("GC W107 Full Body A" → "Full Body A") en geeft per sessie wat er gedaan is.
export function planStatus(plan, workouts, sessions = {}, week = null) {
  const out = {};
  if (!plan?.sessions?.length) return out;
  const cur = week || isoWeek(new Date());
  const thisWeek = workouts.filter((w) => w.date && isoWeek(new Date(String(w.date).slice(0, 10) + 'T12:00:00')) === cur)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const used = new Set();
  for (const s of plan.sessions) {
    const name = String(s.name || '').toLowerCase();
    const exact = `gc ${planLabel(plan)} ${name}`.toLowerCase();
    const w = thisWeek.find((x) => !used.has(String(x.training_id)) && String(x.title || '').toLowerCase() === exact)
      || thisWeek.find((x) => !used.has(String(x.training_id)) && String(x.title || '').toLowerCase().endsWith(name));
    if (!w) continue;
    used.add(String(w.training_id));
    const det = sessions[String(w.training_id)]?.detail;
    const doneEx = Array.isArray(det) ? det.filter((e) => (e.finishedReps || []).some((r) => Number(r.finishedCount) > 0)).map((e) => norm(e.actionLibraryName)) : null;
    out[s.key] = {
      id: String(w.training_id), date: String(w.date).slice(0, 10), title: w.title,
      minutes: w.duration_secs ? Math.round(w.duration_secs / 60) : null, volume: Math.round(Number(w.volume) || 0), kcal: w.calories ?? null,
      exercises: doneEx,
    };
  }
  return out;
}

// Terugkijken op een week: per training gepland tegenover gedaan, per oefening per set.
// status per oefening: ok (alles gehaald), less (minder sets, herhalingen of gewicht), more (meer), missed (niet gedaan);
// extra = oefeningen die je deed maar niet in het plan stonden.
export function planWeekReport(plan, workouts, sessions = {}) {
  const week = planLabel(plan);
  const status = planStatus(plan, workouts, sessions, week);
  const setsOf = (entries) => entries.flatMap((ex) => (ex.finishedReps || []).map((r) => {
    const ws = (r.trainingInfoDetail?.weights || []).map(Number).filter((x) => x > 0);
    return { reps: Number(r.finishedCount ?? 0), weight: Math.round(Number(r.weight ?? median(ws) ?? ex.maxWeight ?? 0) * 10) / 10 };
  })).filter((x) => x.reps > 0);
  const out = { week, generatedAt: plan.generatedAt || null, sessions: [] };
  let plannedSets = 0, doneSets = 0;
  for (const sess of plan.sessions || []) {
    if (sess.type === 'buiten') continue; // cardio buiten: geen sets om te vergelijken
    const done = status[sess.key] || null;
    const det = done ? (sessions[done.id]?.detail || []) : [];
    const used = new Set();
    const exercises = (sess.exercises || []).map((e) => {
      const k = norm(e.title);
      // elk onderdeel van de training telt maar voor één oefening in het plan (dezelfde oefening twee keer in het plan)
      const entries = det.filter((d, i) => { const hit = !used.has(i) && norm(d.actionLibraryName) === k; if (hit) used.add(i); return hit; });
      const planned = (e.sets || []).map((x) => ({ reps: x.reps, weight: x.weight }));
      const did = setsOf(entries);
      plannedSets += planned.length; doneSets += Math.min(did.length, planned.length);
      let st = 'missed';
      if (did.length) {
        const less = did.length < planned.length || planned.some((p, i) => did[i] && (did[i].reps < p.reps || did[i].weight < p.weight - 0.05));
        const more = did.length > planned.length || planned.some((p, i) => did[i] && (did[i].reps > p.reps || did[i].weight > p.weight + 0.05));
        st = less ? 'less' : more ? 'more' : 'ok';
      }
      return { id: e.id, title: e.title, group: e.group || null, planned, done: did, status: done ? st : null };
    });
    const extra = det.filter((d, i) => !used.has(i)).map((d) => ({ title: d.actionLibraryName, done: setsOf([d]) })).filter((x) => x.done.length);
    out.sessions.push({ key: sess.key, name: sess.name, custom: !!sess.custom, locked: !!sess.locked, done, exercises, extra });
  }
  const real = out.sessions;
  out.summary = { planned: real.length, done: real.filter((x) => x.done).length, plannedSets, doneSets,
    volume: real.reduce((t, x) => t + (x.done?.volume || 0), 0), minutes: real.reduce((t, x) => t + (x.done?.minutes || 0), 0) };
  return out;
}

// kalenderweek van een plan (ISO, bijv. "2026-W45"): de week waarin het plan is gemaakt
export const planLabel = (plan) => isoWeek(new Date(plan?.generatedAt || Date.now()));

// Een opgeslagen plan in de taal van de gebruiker tonen: vaste teksten die het plan zelf
// bewaart (patroonnamen, 'Cardio buiten', 'Circuit') worden vertaald, maar alleen als ze nog
// gelijk zijn aan de standaardtekst in een van de talen (eigen namen blijven staan).
const isDefault = (val, key, vars) => ALL_LANGS.some(({ code }) => tAny(key, vars, code) === val);
const FIXED_NOTES = ['eng.lighterNote', 'eng.startgewichtPasAanZodat', 'eng.zelfdeGewicht1Herhaling', 'eng.zelfdeGewichtNogEen', 'eng.10TweeKeerOnder', 'eng.circuitLichtEnVlot', 'eng.deloadWeekLichterHerstel'];
export function localizePlan(plan) {
  if (!plan || !Array.isArray(plan.sessions)) return plan;
  const sessions = plan.sessions.map((s) => {
    const out = { ...s };
    const m = /^(OUT|CC)(\d*)$/.exec(s.key || '');
    if (m) {
      const n = Number(m[2]) || 1, key = m[1] === 'OUT' ? (n > 1 ? 'eng.outdoorN' : 'eng.outdoor') : (n > 1 ? 'eng.circuitN' : 'eng.circuit');
      if (isDefault(s.name, key, { n })) out.name = tr(key, { n });
    }
    if (s.outdoor && isDefault(s.advice, 'eng.wandelenOfFietsenIn')) out.advice = tr('eng.wandelenOfFietsenIn');
    if (out.warmup?.mobility?.length) {
      out.warmup = { ...out.warmup, mobility: out.warmup.mobility.map((m) => {
        const dose = mobilityDose(m);
        return { ...m, dose, reps: secondsOf({ dose }) };
      }) };
    }
    if (Array.isArray(out.cooldown) && out.cooldown.length) out.cooldown = out.cooldown.map((c) => ({ ...c, dose: cooldownDose(c) }));
    if (Array.isArray(s.exercises)) out.exercises = s.exercises.map((e) => {
      const x = { ...e };
      if (PATTERNS[e.pattern] && e.patternLabel && isDefault(e.patternLabel, `pat.${e.pattern}`)) x.patternLabel = PATTERNS[e.pattern].label;
      const nk = e.note && FIXED_NOTES.find((k) => isDefault(e.note, k));
      if (nk) x.note = tr(nk);
      return x;
    });
    return out;
  });
  return { ...plan, sessions };
}

// Een lichtere variant van één training (herstelscore 'rustig aan'): 10% lichter en een set minder (minimaal 2),
// behalve bij vast gewicht. De gebruiker kiest hier zelf voor; de training blijft verder gelijk.
export function lighterSession(sess) {
  const exercises = (sess.exercises || []).map((e) => {
    if (!Array.isArray(e.sets) || !e.sets.length) return e;
    const sets = (e.sets.length > 2 ? e.sets.slice(0, -1) : e.sets).map((x) => (e.fixed || !(x.weight > 0) ? { ...x } : { ...x, weight: round05(x.weight * 0.9) }));
    return { ...e, sets, note: tr('eng.lighterNote') };
  });
  const est = Math.round(((Number(sess.estMinutes) || 0) * exercises.reduce((t, e) => t + (e.sets?.length || 0), 0)) / Math.max(1, (sess.exercises || []).reduce((t, e) => t + (e.sets?.length || 0), 0)));
  return { ...sess, exercises, lightened: true, estMinutes: est || sess.estMinutes };
}
