// Signalen uit gecombineerde data (issue: slimmer plannen met gecombineerde signalen).
// - vertraging binnen een set (tijd per herhaling, Gym Monster)
// - afvaltempo naast spiermassa (Withings)
// - cardio vlak voor een krachttraining (Apple Health + Gym Monster)
// - herstelscore uit rusthartslag, HRV, prestatie en vertraging
// Bronnen staan in de uitleg (explain.*.js, sectie "signalen").

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const day10 = (d) => String(d || '').slice(0, 10);
const daysAgo = (n, now = Date.now()) => new Date(now - n * 864e5).toISOString().slice(0, 10);
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- 1. vertraging binnen een set ----------

// Vertraging van een set in %: gemiddelde van de laatste twee herhalingen tegenover de eerste twee.
// Per kant (links/rechts) de reeks met de meeste geldige tijden. Minder dan 4 herhalingen: geen waarde.
// Bewust trage modi (excentrisch, isokinetisch) tellen niet mee, als de set zijn modus meegeeft.
export function setSlowdown(r) {
  const m = Number(r?.mode ?? r?.trainingMode ?? r?.modeType);
  if (m === 2 || m === 3) return null;
  let best = null;
  for (const [k, v] of Object.entries(r?.trainingInfoDetail || {})) {
    if (!/finishedtimes$/i.test(k) || !Array.isArray(v)) continue;
    const t = v.map(Number).filter((x) => x > 0 && x < 30);
    if (!best || t.length > best.length) best = t;
  }
  if (!best || best.length < 4) return null;
  const first = avg(best.slice(0, 2)), last = avg(best.slice(-2));
  if (!first) return null;
  return Math.max(0, Math.round((last / first - 1) * 100));
}

// Grenzen voor de vertraging: tot 25% fris, 25–40% zwaar, vanaf 40% tot het uiterste.
export const SLOW_HEAVY = 25, SLOW_MAX = 40;
export const slowBand = (p) => (p == null ? null : p >= SLOW_MAX ? 'max' : p >= SLOW_HEAVY ? 'heavy' : 'fresh');

// ---------- 2. afvaltempo naast spiermassa ----------

// Helling (eenheid per dag) met kleinste kwadraten.
function slope(points) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.t), ys = points.map((p) => p.v);
  const mx = avg(xs), my = avg(ys);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : null;
}

// Gewichtsverlies per week (% van het lichaamsgewicht) en de verandering van de spiermassa over de laatste 28 dagen.
// Minstens 4 metingen in 21 dagen nodig. warn = sneller dan ~1% per week én dalende spiermassa.
export function weightLoss(bodyLog = [], now = Date.now()) {
  const from = daysAgo(28, now), recent = daysAgo(21, now);
  const pts = (key) => bodyLog.filter((b) => b[key] > 0 && day10(b.date) >= from).map((b) => ({ t: new Date(day10(b.date)).getTime() / 864e5, v: Number(b[key]) }));
  const kg = pts('kg');
  if (kg.filter((p) => p.t * 864e5 >= new Date(recent).getTime()).length < 4) return null;
  const s = slope(kg), mean = avg(kg.map((p) => p.v));
  if (s == null || !mean) return null;
  const pctWeek = r1((-s * 7 / mean) * 100); // positief = afvallen
  const mu = pts('muscle');
  const ms = mu.length >= 4 ? slope(mu) : null;
  const muscleKg28 = ms == null ? null : r1(ms * 28);
  return { pctWeek, kgWeek: r1(-s * 7), muscleKg28, n: kg.length, warn: pctWeek > 1 && muscleKg28 != null && muscleKg28 < -0.2 };
}

// ---------- 3. cardio vlak voor een krachttraining ----------

// Begin van een training (ms): de vroegste tijdstempel van een set, anders het begin uit Apple Health.
export function sessionStart(session, health) {
  let ts = Infinity;
  for (const ex of Array.isArray(session?.detail) ? session.detail : []) {
    for (const r of ex.finishedReps || []) {
      for (const [k, v] of Object.entries(r.trainingInfoDetail || {})) {
        if (!/timestamps$/i.test(k) || !Array.isArray(v)) continue;
        for (const x of v) { const n = Number(x); const t = n > 1e12 ? n : n > 1e9 ? n * 1000 : NaN; if (t < ts) ts = t; }
      }
    }
  }
  if (Number.isFinite(ts)) return ts;
  const h = health?.start ? Date.parse(health.start) : NaN;
  return Number.isFinite(h) ? h : null;
}

// Een activiteit (geen krachttraining) die eindigde binnen 3 uur vóór de training begon.
const CARDIO = new Set(['wandelen', 'fietsen', 'hardlopen', 'zwemmen', 'roeien', 'hiit', 'elliptical', 'teamsport', 'racket', 'dans', 'vechtsport', 'wintersport']);
export function cardioBefore(startMs, activities = []) {
  if (!startMs) return null;
  let hit = null;
  for (const a of activities) {
    if (!CARDIO.has(a.type)) continue;
    // eind: uit de activiteit zelf, anders begin + duur
    const end = a.end ? Date.parse(a.end) : a.start && a.minutes ? Date.parse(a.start) + a.minutes * 60000 : NaN;
    if (!Number.isFinite(end)) continue;
    const gap = (startMs - end) / 60000;
    if (gap >= 0 && gap < 180 && (!hit || gap < hit.gapMin)) hit = { type: a.type, name: a.name, minutes: a.minutes ?? null, km: a.km ?? null, gapMin: Math.round(gap) };
  }
  return hit;
}

// Hoeveel van de geplande herhalingen gehaald zijn (0–1) in een lijst sets met doel.
const doneRatio = (sets) => {
  const t = sets.filter((s) => s.target > 0);
  if (!t.length) return null;
  return t.reduce((a, s) => a + Math.min(s.reps, s.target), 0) / t.reduce((a, s) => a + s.target, 0);
};

// Per training: gehaalde herhalingen (0–1) en gemiddelde vertraging, uit de historie.
function perTraining(history) {
  const by = new Map();
  for (const h of Object.values(history || {})) {
    for (const l of h.log || []) {
      const k = String(l.trainingId ?? l.date);
      const e = by.get(k) || { date: day10(l.date), trainingId: l.trainingId, sets: [] };
      e.sets.push(...l.sets); by.set(k, e);
    }
  }
  return [...by.values()].map((e) => {
    const slows = e.sets.map((s) => s.slow).filter((x) => x != null);
    return { date: e.date, trainingId: e.trainingId, done: doneRatio(e.sets), slow: slows.length ? avg(slows) : null };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// Analyse: hoe vaak cardio vlak voor kracht viel, en de gehaalde herhalingen op die dagen tegenover de andere.
export function cardioStats({ sessions = {}, history = {}, activities = [], workoutHealth = {} }, since = '0000') {
  const trainings = perTraining(history);
  const byId = new Map(trainings.map((x) => [String(x.trainingId), x]));
  const withC = [], without = [];
  for (const s of Object.values(sessions)) {
    if (day10(s.date) < since || !Array.isArray(s.detail)) continue;
    const tr = byId.get(String(s.training_id)); if (!tr || tr.done == null) continue;
    const c = cardioBefore(sessionStart(s, workoutHealth[String(s.training_id)]), activities);
    (c ? withC : without).push(tr.done);
  }
  if (!withC.length) return { count: 0, total: withC.length + without.length };
  return { count: withC.length, total: withC.length + without.length, doneWith: Math.round(avg(withC) * 100), doneWithout: without.length ? Math.round(avg(without) * 100) : null };
}

// ---------- 4. herstelscore ----------

// Gemiddelde van de laatste 7 dagen tegenover de 28 dagen daarvoor. Minstens 3 + 7 meetdagen.
function trend(points, now) {
  const a = daysAgo(7, now), b = daysAgo(35, now);
  const recent = points.filter((p) => p.date > a).map((p) => p.v);
  const base = points.filter((p) => p.date <= a && p.date > b).map((p) => p.v);
  if (recent.length < 3 || base.length < 7) return null;
  return { recent: r1(avg(recent)), base: r1(avg(base)) };
}

// Herstelscore: 'good' | 'watch' | 'easy', of null zonder data. Pas 'watch' als minstens twee signalen
// dezelfde kant op wijzen (één signaal is ruis); 'easy' als ze ook samen duidelijk zijn.
export function recovery({ daily = [], bodyLog = [], history = {} }, now = Date.now()) {
  const signals = [];
  // rusthartslag: Apple Health, anders de weegschaal
  let rest = daily.filter((d) => d.restHr > 30).map((d) => ({ date: day10(d.date), v: Number(d.restHr) }));
  if (rest.length < 10) rest = bodyLog.filter((b) => b.restHr > 30).map((b) => ({ date: day10(b.date), v: Number(b.restHr) }));
  const rh = trend(rest, now);
  if (rh) { const d = r1(rh.recent - rh.base); signals.push({ key: 'restHr', recent: rh.recent, base: rh.base, delta: d, level: d >= 5 ? 2 : d >= 3 ? 1 : 0 }); }
  // HRV: lager dan normaal is minder herstel
  const hv = trend(daily.filter((d) => d.hrv > 0).map((d) => ({ date: day10(d.date), v: Number(d.hrv) })), now);
  if (hv) { const p = Math.round((hv.recent / hv.base - 1) * 100); signals.push({ key: 'hrv', recent: hv.recent, base: hv.base, pct: p, level: p <= -20 ? 2 : p <= -10 ? 1 : 0 }); }
  // prestatie en vertraging: de laatste 3 trainingen tegenover de 8 daarvoor
  const tr = perTraining(history).filter((x) => x.date >= daysAgo(42, now));
  if (tr.length >= 5) {
    const last = tr.slice(-3), before = tr.slice(-11, -3);
    const dl = avg(last.map((x) => x.done).filter((x) => x != null)), db = avg(before.map((x) => x.done).filter((x) => x != null));
    if (dl != null && db != null) { const d = Math.round((dl - db) * 100); signals.push({ key: 'reps', recent: Math.round(dl * 100), base: Math.round(db * 100), delta: d, level: d <= -15 ? 2 : d <= -7 ? 1 : 0 }); }
    const sl = avg(last.map((x) => x.slow).filter((x) => x != null)), sb = med(before.map((x) => x.slow).filter((x) => x != null));
    if (sl != null && sb != null) { const d = Math.round(sl - sb); signals.push({ key: 'slow', recent: Math.round(sl), base: Math.round(sb), delta: d, level: d >= 15 ? 2 : d >= 8 ? 1 : 0 }); }
  }
  if (!signals.length) return null;
  const bad = signals.filter((s) => s.level > 0), points = bad.reduce((t, s) => t + s.level, 0);
  const state = bad.length >= 2 ? (points >= 4 ? 'easy' : 'watch') : 'good';
  return { state, signals, asOf: daysAgo(0, now) };
}
