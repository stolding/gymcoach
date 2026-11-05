// Extra inzichten: vergelijking per training, hartslagzones, balans, krachtindex en de analysepagina.
import { tr } from './lang.js';
import { PATTERNS, REGION, epley, isoWeek, MUSCLE_NL, volOf } from './engine.js';

const round = (v, d = 0) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const day10 = (d) => String(d || '').slice(0, 10);
const mean = (arr) => { const v = arr.filter((x) => Number.isFinite(x) && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
// maandag van de week als 'YYYY-MM-DD' (lokale tijd)
export function monday(d) {
  const x = new Date(day10(d) + 'T12:00:00');
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ---------- per training ----------

// "GC W45 Full Body A" en "GC W46 Full Body A" zijn dezelfde training
export const titleKey = (t) => String(t || '').replace(/\b\d{4}-W\d+\b/gi, '').replace(/\bW(?:eek)?\s?\d+\b/gi, '').replace(/\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const setCount = (session) => (Array.isArray(session?.detail) ? session.detail.reduce((n, ex) => n + (ex.finishedReps || []).filter((r) => Number(r.finishedCount) > 0).length, 0) : null);

// Deze training tegenover het gemiddelde van de laatste 4 keer dezelfde training (anders: laatste 4 trainingen)
export function compare(d, { workouts = [], sessions = {}, health = {} }) {
  const dd = day10(d.date);
  const before = workouts.filter((w) => String(w.training_id) !== d.id && (day10(w.date) < dd || (day10(w.date) === dd && Number(w.training_id) < Number(d.id))))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let peers = before.filter((w) => titleKey(w.title) === titleKey(d.title)).slice(-4), basis = 'same';
  if (!peers.length) { peers = before.slice(-4); basis = 'recent'; }
  if (!peers.length) return null;
  const sets = d.exercises.reduce((n, e) => n + e.sets.length, 0);
  const rows = [
    [tr('ed.duration'), 'min', d.minutes, mean(peers.map((w) => (Number(w.duration_secs) || 0) / 60))],
    [tr('ed.volume'), 'kg', d.volume, mean(peers.map((w) => Number(w.volume)))],
    [tr('ed.sets'), '', sets || null, mean(peers.map((w) => setCount(sessions[String(w.training_id)])))],
    [tr('sum.calories'), 'kcal', d.calories ?? d.healthKcal, mean(peers.map((w) => Number(w.calories ?? health[String(w.training_id)]?.kcal)))],
    [tr('ins.avgHr'), 'bpm', d.hrAvg, mean(peers.map((w) => Number(health[String(w.training_id)]?.hrAvg)))],
  ].filter(([, , cur, ref]) => cur != null && ref != null)
    .map(([label, unit, cur, ref]) => ({ label, unit, cur: round(cur, unit === '' ? 0 : 0), ref: round(ref, unit === '' ? 1 : 0), pct: round(((cur - ref) / ref) * 100, 0) }));
  if (!rows.length) return null;
  return { basis, n: peers.length, title: basis === 'same' ? peers[peers.length - 1].title : null, rows };
}

// maximale hartslag: zelf ingesteld, of geschat uit het geboortejaar
// (vrouwen: Gulati 206 − 0,88 × leeftijd; anders Tanaka 208 − 0,7 × leeftijd)
export function hrMaxRef(settings = {}) {
  if (Number(settings.hrMax) > 100) return { max: Number(settings.hrMax), how: tr('ins.hrSet') };
  if (Number(settings.birthYear) > 1900) {
    const age = new Date().getFullYear() - Number(settings.birthYear);
    const sex = ['m', 'v'].includes(settings.sex) ? settings.sex : settings.bandSex;
    if (sex === 'v') return { max: Math.round(206 - 0.88 * age), how: tr('ins.hrGulati', { age }) };
    return { max: Math.round(208 - 0.7 * age), how: tr('ins.hrTanaka', { age }) };
  }
  return null;
}
export const ZONES = [
  { z: 1, label: 'Herstel', from: 0.5, to: 0.6 },
  { z: 2, label: 'Basis', from: 0.6, to: 0.7 },
  { z: 3, label: 'Aeroob', from: 0.7, to: 0.8 },
  { z: 4, label: 'Drempel', from: 0.8, to: 0.9 },
  { z: 5, label: 'Maximaal', from: 0.9, to: 1.01 },
];
for (const z of ZONES) Object.defineProperty(z, 'label', { get: () => tr(`ins.zone${z.z}`), enumerable: true });
// hartslagverloop: reeks [seconden vanaf start, gem, max] uit Apple Health, of per set uit de Gym Monster
export function heart(d, health, settings) {
  const ref = hrMaxRef(settings);
  const series = Array.isArray(health?.hrSeries) ? health.hrSeries.filter((p) => Array.isArray(p) && p[1] > 30) : [];
  if (series.length >= 3) {
    const gaps = series.slice(1).map((p, i) => p[0] - series[i][0]).filter((x) => x > 0).sort((a, b) => a - b);
    const typ = gaps[Math.floor(gaps.length / 2)] || 60;
    const zones = ref ? ZONES.map((z) => ({ ...z, bpmFrom: Math.round(z.from * ref.max), bpmTo: Math.round(Math.min(1, z.to) * ref.max), min: 0 })) : null;
    let below = 0;
    if (zones) series.forEach((p, i) => {
      const dt = Math.min(typ * 2, (series[i + 1]?.[0] ?? p[0] + typ) - p[0]) / 60;
      const f = p[1] / ref.max;
      const z = zones.find((x) => f >= x.from && f < x.to);
      if (z) z.min += dt; else if (f < 0.5) below += dt; else zones[4].min += dt;
    });
    zones?.forEach((z) => { z.min = round(z.min, 1); });
    // beide tonen als ze er zijn: verloop over de tijd (Watch) én maximale hartslag per set (Gym Monster)
    return { source: 'Apple Health', series, ref, zones, belowMin: round(below, 1), perSet: d.setHr?.length >= 2 ? d.setHr : null };
  }
  if (d.setHr?.length >= 2) return { source: 'Gym Monster', perSet: d.setHr, ref, zones: ref ? ZONES.map((z) => ({ ...z, bpmFrom: Math.round(z.from * ref.max), bpmTo: Math.round(Math.min(1, z.to) * ref.max) })) : null };
  return null;
}

// ---------- statistieken ----------

const PUSH = new Set(['hpush', 'vpush', 'tri']), PULL = new Set(['hpull', 'vpull', 'rear', 'curl']);
const M_PUSH = new Set(['Pecs', 'Front Delts', 'Side Delts', 'Triceps']), M_PULL = new Set(['Lats', 'Rear Delts', 'Traps', 'Biceps', 'Forearms']);
const M_LOWER = new Set(['Quads', 'Glutes', 'Hamstrings', 'Calves', 'Adductors', 'Back Extensors']);
const patternOf = (id) => Object.keys(PATTERNS).find((k) => PATTERNS[k].ids.map(Number).includes(Number(id))) || null;

// Extra statistieken: balans, krachtindex per spiergroep, spiermassa tegen volume, cardio en stappen.
export function statsExtra({ history, workouts = [], activities = [], daily = [], bodyLog = [], settings = {} }, since) {
  const inRange = (d) => day10(d) >= since;
  const today = day10(new Date().toISOString());

  // balans duwen/trekken en boven/onder (werksets)
  const bal = { push: 0, pull: 0, upper: 0, lower: 0 };
  // krachtindex per spiergroep: geschat 1RM per oefening t.o.v. de eerste keer in de periode (= 100)
  const perMuscle = {};
  // volume per week
  const weekVol = {};
  for (const h of Object.values(history)) {
    const p = patternOf(h.id);
    const push = p ? PUSH.has(p) : M_PUSH.has(h.muscle), pull = p ? PULL.has(p) : M_PULL.has(h.muscle);
    const region = p ? REGION[p] : M_LOWER.has(h.muscle) ? 'lower' : push || pull ? 'upper' : 'both';
    let first = null;
    for (const l of h.log) {
      if (!inRange(l.date)) continue;
      const n = l.sets.length;
      if (push) bal.push += n; if (pull) bal.pull += n;
      if (region === 'upper') bal.upper += n; else if (region === 'lower') bal.lower += n;
      const wk = monday(l.date);
      weekVol[wk] = (weekVol[wk] || 0) + l.sets.reduce((t, s) => t + volOf(s), 0);
      const e1 = Math.max(...l.sets.map((s) => epley(s.weight, s.reps)));
      if (!(e1 > 0) || !h.muscle) continue;
      first ??= e1;
      const m = (perMuscle[h.muscle] ||= {});
      (m[wk] ||= []).push((e1 / first) * 100);
    }
  }
  const strength = Object.entries(perMuscle).map(([k, wk]) => ({
    key: k, label: MUSCLE_NL[k] || k,
    points: Object.keys(wk).sort().map((x) => ({ x, y: round(mean(wk[x]) ?? 100, 1) })),
  })).filter((s) => s.points.length >= 2).sort((a, b) => b.points.length - a.points.length);
  for (const s of strength) s.change = round(s.points[s.points.length - 1].y - 100, 1);

  // weken in de periode (voor gelijke assen)
  const weeks = [];
  const startW = monday(since === '0000' ? (Object.keys(weekVol).sort()[0] || today) : since);
  for (let d = new Date(startW + 'T12:00:00'); monday(d.toISOString()) <= monday(today); d.setDate(d.getDate() + 7)) weeks.push(monday(d.toISOString()));
  const wkList = weeks.length > 260 ? weeks.slice(-260) : weeks;

  // spiermassa (Withings) per week tegen trainingsvolume
  const massByWk = {};
  for (const b of bodyLog) if (inRange(b.date) && Number(b.muscle) > 0) (massByWk[monday(b.date)] ||= []).push(Number(b.muscle));
  const volumeVsMass = {
    volume: wkList.map((x) => ({ x, y: Math.round(weekVol[x] || 0) })),
    mass: wkList.filter((x) => massByWk[x]).map((x) => ({ x, y: round(mean(massByWk[x]), 1) })),
  };

  // cardio: km per week per soort en stappen per dag
  const kmWk = {};
  for (const a of activities) {
    if (!inRange(a.date) || !(a.km > 0)) continue;
    const t = ['wandelen', 'fietsen', 'hardlopen'].includes(a.type) ? a.type : 'overig';
    const w = (kmWk[monday(a.date)] ||= { wandelen: 0, fietsen: 0, hardlopen: 0, overig: 0 });
    w[t] += a.km;
  }
  const cardioWeeks = wkList.map((x) => ({ x, ...Object.fromEntries(Object.entries(kmWk[x] || { wandelen: 0, fietsen: 0, hardlopen: 0, overig: 0 }).map(([k, v]) => [k, round(v, 1)])) }));
  const stepGoal = Number(settings.stepGoal) > 0 ? Number(settings.stepGoal) : 8000;
  const steps = daily.filter((d) => inRange(d.date) && d.steps != null).map((d) => ({ x: d.date, y: Math.round(d.steps) }));
  const stepHit = steps.filter((s) => s.y >= stepGoal).length;

  return {
    balance: bal, strength, volumeVsMass,
    cardioWeeks: cardioWeeks.some((w) => w.wandelen || w.fietsen || w.hardlopen || w.overig) ? cardioWeeks : [],
    steps: steps.slice(-400), stepGoal, stepHit,
  };
}

// ---------- analyse ----------

const BLOCKS = [[6, 9], [9, 12], [12, 15], [15, 18], [18, 21], [21, 24]];
// uur van de dag, alleen als het tijdstip echt bekend is
function hourOf(v) {
  const s = String(v || '');
  if (!/\d{2}:\d{2}/.test(s)) return null;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) || /T/.test(s) ? s : s.replace(' ', 'T'));
  return isNaN(d) ? null : d.getHours() + d.getMinutes() / 60;
}

// starttijd van een Gym Monster-training: uit Apple Health, of de eerste tijdstempel in de setdata
export function sessionStart(session, wh) {
  if (wh?.start) return wh.start;
  let min = Infinity;
  const ts = (v) => { const n = Number(v); return n > 1e12 ? n : n > 1e9 ? n * 1000 : NaN; };
  for (const k of ['startTimestamp', 'startTime', 'beginTime']) { const t = ts(session?.info?.[k]); if (t < min) min = t; }
  for (const ex of Array.isArray(session?.detail) ? session.detail : []) for (const r of ex.finishedReps || []) {
    for (const [k, v] of Object.entries(r.trainingInfoDetail || {})) if (/timestamps$/i.test(k) && Array.isArray(v)) for (const x of v) { const t = ts(x); if (t < min) min = t; }
  }
  return Number.isFinite(min) ? new Date(min).toISOString() : null;
}

// Gegevens voor Analyse: wanneer je traint, records, energie tegen gewicht en herstel.
export function analysis({ history, workouts = [], sessions = {}, workoutHealth = {}, activities = [], daily = [], bodyLog = [] }, since) {
  const inRange = (d) => day10(d) >= since;
  const today = day10(new Date().toISOString());

  // 6. wanneer train je: weekdag × dagdeel
  const grid = Array.from({ length: 7 }, () => BLOCKS.map(() => ({ gym: 0, act: 0 })).concat([{ gym: 0, act: 0 }]));
  let gymTimed = 0, gymUntimed = 0;
  const put = (v, key) => {
    const h = hourOf(v); if (h == null) return false;
    const d = new Date(String(v).includes('T') || /[zZ]$/.test(v) ? v : String(v).replace(' ', 'T'));
    const wd = (d.getDay() + 6) % 7;
    const bi = BLOCKS.findIndex(([a, b]) => h >= a && h < b);
    grid[wd][bi < 0 ? BLOCKS.length : bi][key]++;
    return true;
  };
  for (const w of workouts) if (inRange(w.date)) {
    const st = sessionStart(sessions[String(w.training_id)], workoutHealth[String(w.training_id)]) || w.date;
    if (put(st, 'gym')) gymTimed++; else gymUntimed++;
  }
  for (const a of activities) if (inRange(a.date)) put(a.start, 'act');
  const heat = { blocks: BLOCKS.map(([a, b]) => `${a}–${b}`).concat(['nacht']), days: ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], grid, gymTimed, gymUntimed };

  // 7. records-tijdlijn: elke keer dat een oefening een hoger geschat 1RM haalde dan ooit ervoor
  const records = [];
  for (const h of Object.values(history)) {
    let best = 0;
    for (const l of h.log) {
      const e1 = Math.max(...l.sets.map((x) => epley(x.weight, x.reps)));
      if (best > 0 && e1 > best * 1.001 && inRange(l.date)) {
        const top = l.sets.reduce((m, x) => (x.weight > m.weight || (x.weight === m.weight && x.reps > m.reps) ? x : m), l.sets[0]);
        records.push({ date: day10(l.date), name: h.name, muscle: MUSCLE_NL[h.muscle] || h.muscle || null, e1rm: round(e1, 1), prev: round(best, 1), pct: round(((e1 - best) / best) * 100, 1), set: `${top.reps} × ${top.weight} kg` });
      }
      best = Math.max(best, e1);
    }
  }
  records.sort((a, b) => b.date.localeCompare(a.date) || b.pct - a.pct);

  // weken in de periode
  const firstData = [workouts[0]?.date, bodyLog[0]?.date, daily[0]?.date, activities[0]?.date].filter(Boolean).map(day10).sort()[0] || today;
  const startW = monday(since === '0000' ? firstData : since > firstData ? since : firstData);
  const weeks = [];
  for (let d = new Date(startW + 'T12:00:00'); monday(d.toISOString()) <= monday(today); d.setDate(d.getDate() + 7)) weeks.push(monday(d.toISOString()));
  const wks = weeks.slice(-260);

  // 9. actieve energie per week tegen gewicht
  const kcalWk = {}, kcalSrc = {};
  for (const d of daily) if (inRange(d.date) && d.activeKcal > 0) { kcalWk[monday(d.date)] = (kcalWk[monday(d.date)] || 0) + d.activeKcal; kcalSrc[monday(d.date)] = 'health'; }
  for (const w of workouts) if (inRange(w.date) && !kcalSrc[monday(w.date)] && Number(w.calories) > 0) kcalWk[monday(w.date)] = (kcalWk[monday(w.date)] || 0) + Number(w.calories);
  for (const a of activities) if (inRange(a.date) && !kcalSrc[monday(a.date)] && a.kcal > 0) kcalWk[monday(a.date)] = (kcalWk[monday(a.date)] || 0) + a.kcal;
  const kgWk = {};
  for (const b of bodyLog) if (inRange(b.date) && Number(b.kg) > 0) (kgWk[monday(b.date)] ||= []).push(Number(b.kg));
  const energy = {
    kcal: wks.map((x) => ({ x, y: Math.round(kcalWk[x] || 0) })),
    kg: wks.filter((x) => kgWk[x]).map((x) => ({ x, y: round(mean(kgWk[x]), 1) })),
    fromHealth: Object.keys(kcalSrc).length > 0,
  };

  // 10. herstel: hartslag in rust tegen trainingsbelasting (minuten per week)
  const loadWk = {};
  for (const w of workouts) if (inRange(w.date)) loadWk[monday(w.date)] = (loadWk[monday(w.date)] || 0) + (Number(w.duration_secs) || 0) / 60;
  for (const a of activities) if (inRange(a.date)) loadWk[monday(a.date)] = (loadWk[monday(a.date)] || 0) + (a.minutes || 0);
  const restPts = [];
  const appleRest = daily.filter((d) => d.restHr > 30);
  if (appleRest.length) for (const d of appleRest) { if (inRange(d.date)) restPts.push({ date: d.date, v: d.restHr }); }
  else for (const b of bodyLog) if (inRange(b.date) && b.restHr > 30) restPts.push({ date: day10(b.date), v: b.restHr });
  const restWk = {};
  for (const p of restPts) (restWk[monday(p.date)] ||= []).push(p.v);
  // laatste 7 dagen tegen de 4 weken daarvoor
  const dAgo = (n) => day10(new Date(Date.now() - n * 864e5).toISOString());
  const recent = mean(restPts.filter((p) => p.date > dAgo(7)).map((p) => p.v));
  const base = mean(restPts.filter((p) => p.date <= dAgo(7) && p.date > dAgo(35)).map((p) => p.v));
  const recovery = {
    load: wks.map((x) => ({ x, y: Math.round(loadWk[x] || 0) })),
    rest: wks.filter((x) => restWk[x]).map((x) => ({ x, y: round(mean(restWk[x]), 1) })),
    source: appleRest.length ? 'Apple Health' : restPts.length ? 'Withings' : null,
    recent: round(recent, 1), base: round(base, 1),
    signal: recent && base ? (recent - base >= 5 ? 'hoog' : recent - base >= 3 ? 'let op' : 'normaal') : null,
  };

  return { heat, records: records.slice(0, 300), recordCount: records.length, energy, recovery };
}
