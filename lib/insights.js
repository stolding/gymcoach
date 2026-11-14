// Extra inzichten: vergelijking per training, hartslagzones, balans, krachtindex en de analysepagina.
import { tr, userLang, fmtNum } from './lang.js';
import { localeOf } from '../public/i18n.js';
import { Pdf } from './pdf.js';
import { PATTERNS, REGION, epley, isoWeek, MUSCLE_NL, volOf } from './engine.js';

const round = (v, d = 0) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const day10 = (d) => String(d || '').slice(0, 10);
const mean = (arr) => { const v = arr.filter((x) => Number.isFinite(x) && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const median = (arr) => {
  const a = arr.filter((x) => Number.isFinite(x) && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
// Een sessie telt niet mee als het geschatte 1RM meer dan 15% van de mediaan van die oefening afwijkt.
// Twee sessies blijven allebei staan: daar is nog geen cluster om een uitzondering van te onderscheiden.
const TYPICAL = 0.15;
function keepTypical(rows) {
  if (rows.length < 3) return rows;
  const med = median(rows.map((r) => r.e1));
  if (!(med > 0)) return rows;
  const kept = rows.filter((r) => Math.abs(r.e1 - med) / med <= TYPICAL);
  return kept.length ? kept : rows;
}
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

// Kleur van een procent in het trainingsrapport. 'up' is gunstig (groen), 'down' is ongunstig (rood), 'muted' is neutraal.
// Hoger is beter bij duur, volume, sets en calorieën. lowerBetter draait de richting om (gemiddelde hartslag: lager is beter).
// 0% en alles binnen 2 procentpunt is nagenoeg gelijk en blijft neutraal.
export function comparePctClass(pct, lowerBetter = false) {
  const n = Number(pct);
  if (!Number.isFinite(n) || Math.abs(n) <= 2) return 'muted';
  const higher = n > 0;
  const good = lowerBetter ? !higher : higher;
  return good ? 'up' : 'down';
}

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

// Gymsessie plus de Apple Health-workouts van dezelfde kalenderdag.
// Sets en volume blijven de krachtsets. Duur, calorieën en hartslag tellen mee waar die workout een waarde heeft.
export function dayTotals(gym = {}, activities = []) {
  const day = day10(gym.date);
  const extra = (activities || []).filter((a) => a && day10(a.date) === day);
  const identity = {
    minutes: gym.minutes ?? null, calories: gym.calories ?? null, hrAvg: gym.hrAvg ?? null, hrMax: gym.hrMax ?? null,
    sets: gym.sets ?? null, volume: gym.volume ?? null, included: false,
  };
  const usable = (a) => pos(a.minutes) || pos(a.kcal ?? a.calories) || pos(a.hrAvg) || pos(a.hrMax);
  if (!extra.some(usable)) return identity;
  const add = (base, pick) => {
    const extraSum = extra.reduce((s, a) => s + pos(pick(a)), 0);
    const b = Number(base);
    const baseOk = Number.isFinite(b);
    if (!extraSum) return baseOk ? b : null;
    return (baseOk && b > 0 ? b : 0) + extraSum;
  };
  const hrParts = [];
  if (pos(gym.hrAvg)) hrParts.push({ hr: Number(gym.hrAvg), w: pos(gym.minutes) });
  for (const a of extra) if (pos(a.hrAvg)) hrParts.push({ hr: Number(a.hrAvg), w: pos(a.minutes) });
  let hrAvg = null;
  if (hrParts.length) {
    hrAvg = hrParts.every((p) => p.w > 0)
      ? hrParts.reduce((s, p) => s + p.hr * p.w, 0) / hrParts.reduce((s, p) => s + p.w, 0)
      : hrParts.reduce((s, p) => s + p.hr, 0) / hrParts.length;
  }
  const maxes = [gym.hrMax, ...extra.map((a) => a.hrMax)].map(Number).filter((v) => v > 0);
  return {
    minutes: add(gym.minutes, (a) => a.minutes),
    calories: add(gym.calories, (a) => a.kcal ?? a.calories),
    hrAvg, hrMax: maxes.length ? Math.max(...maxes) : null,
    sets: gym.sets ?? null, volume: gym.volume ?? null, included: true,
  };
}

// Deze training tegenover het gemiddelde van de laatste 4 keer dezelfde training (anders: laatste 4 trainingen).
// Duur, calorieën en hartslag zijn de dag: deze gymsessie plus de Apple Health-workouts van die kalenderdag.
// Dezelfde samenstelling geldt voor de vorige keren, zodat een gymsessie niet tegen een hele dag afgezet wordt.
export function compare(d, { workouts = [], sessions = {}, health = {}, activities = [] } = {}) {
  const dd = day10(d.date);
  const before = workouts.filter((w) => String(w.training_id) !== d.id && (day10(w.date) < dd || (day10(w.date) === dd && Number(w.training_id) < Number(d.id))))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let peers = before.filter((w) => titleKey(w.title) === titleKey(d.title)).slice(-4), basis = 'same';
  if (!peers.length) { peers = before.slice(-4); basis = 'recent'; }
  if (!peers.length) return null;
  const sets = d.exercises.reduce((n, e) => n + e.sets.length, 0);
  const cur = dayTotals({
    date: d.date, minutes: d.minutes, calories: d.calories ?? d.healthKcal, hrAvg: d.hrAvg, hrMax: d.hrMax, sets, volume: d.volume,
  }, activities);
  const peerDay = (w) => {
    const h = health[String(w.training_id)] || {};
    return dayTotals({
      date: w.date,
      minutes: (Number(w.duration_secs) || 0) / 60,
      calories: w.calories ?? h.kcal ?? null,
      hrAvg: h.hrAvg ?? null,
      hrMax: h.hrMax ?? null,
      sets: setCount(sessions[String(w.training_id)]),
      volume: Number(w.volume),
    }, activities);
  };
  const peersDay = peers.map(peerDay);
  const rows = [
    [cur.included ? tr('app.dayDuration') : tr('ed.duration'), 'min', cur.minutes, mean(peersDay.map((p) => Number(p.minutes))), false],
    [tr('ed.volume'), 'kg', d.volume, mean(peers.map((w) => Number(w.volume))), false],
    [tr('ed.sets'), '', sets || null, mean(peers.map((w) => setCount(sessions[String(w.training_id)]))), false],
    [cur.included ? tr('app.dayCalories') : tr('sum.calories'), 'kcal', cur.calories, mean(peersDay.map((p) => Number(p.calories))), false],
    [cur.included ? tr('app.dayAvgHr') : tr('ins.avgHr'), 'bpm', cur.hrAvg, mean(peersDay.map((p) => Number(p.hrAvg))), true],
  ].filter(([, , c, ref]) => c != null && ref != null)
    .map(([label, unit, c, ref, lowerBetter]) => {
      const pct = round(((c - ref) / ref) * 100, 0);
      return {
        label, unit, lowerBetter: !!lowerBetter,
        cur: round(c, 0), ref: round(ref, unit === '' ? 1 : 0), pct,
        tone: comparePctClass(pct, !!lowerBetter),
      };
    });
  if (!rows.length) return null;
  return { basis, n: peers.length, title: basis === 'same' ? peers[peers.length - 1].title : null, rows, day: cur.included };
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
  // krachtindex per spiergroep: geschat 1RM per oefening t.o.v. de eerste gewone sessie in de periode (= 100)
  const perMuscle = {};
  // volume per week
  const weekVol = {};
  for (const h of Object.values(history)) {
    const p = patternOf(h.id);
    const push = p ? PUSH.has(p) : M_PUSH.has(h.muscle), pull = p ? PULL.has(p) : M_PULL.has(h.muscle);
    const region = p ? REGION[p] : M_LOWER.has(h.muscle) ? 'lower' : push || pull ? 'upper' : 'both';
    const typical = [];
    for (const l of h.log) {
      if (!inRange(l.date)) continue;
      const n = l.sets.length;
      if (push) bal.push += n; if (pull) bal.pull += n;
      if (region === 'upper') bal.upper += n; else if (region === 'lower') bal.lower += n;
      const wk = monday(l.date);
      weekVol[wk] = (weekVol[wk] || 0) + l.sets.reduce((t, s) => t + volOf(s), 0);
      const e1 = Math.max(...l.sets.map((s) => epley(s.weight, s.reps)));
      if (!(e1 > 0) || !h.muscle) continue;
      typical.push({ wk, e1 });
    }
    let first = null;
    for (const r of keepTypical(typical)) {
      first ??= r.e1;
      const m = (perMuscle[h.muscle] ||= {});
      (m[r.wk] ||= []).push((r.e1 / first) * 100);
    }
  }
  const strength = Object.entries(perMuscle).map(([k, wk]) => ({
    key: k, label: MUSCLE_NL[k] || k,
    points: Object.keys(wk).sort().map((x) => ({ x, y: round(median(wk[x]) ?? 100, 1) })),
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

// Zelfde kleuren als de knoppen op Terugkijken, in de volgorde van de spiergroepen.
const STRENGTH_COLORS = ['#ff7a2e', '#6c9cff', '#4cc26a', '#e5b84b', '#c77dff', '#ff6b9a', '#4cc9e5', '#9a9ca1'];

function strengthChart(pdf, rows, x, y, w, h) {
  const pts = rows.flatMap((r) => r.points);
  if (!pts.length) { pdf.text(x, y + 16, tr('app.nogGeenData'), { size: 11, color: '#6b6e73' }); return y + 36; }
  const ys = pts.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const xs = [...new Set(pts.map((p) => p.x))].sort();
  const tOf = (d) => new Date(d + 'T12:00:00').getTime();
  const t0 = tOf(xs[0]), t1 = tOf(xs[xs.length - 1]);
  const L = x + 32, R = x + w, T = y, B = y + h;
  const X = (d) => L + (t1 === t0 ? (R - L) / 2 : ((tOf(d) - t0) / (t1 - t0)) * (R - L));
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (B - T);
  pdf.rect(L, T, R - L, B - T, { stroke: '#e2e0da' });
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    const yy = Y(v);
    pdf.line(L, yy, R, yy, { color: '#efede8' });
    pdf.text(L - 6, yy + 3, fmtNum(v, { maximumFractionDigits: 0 }), { size: 8, color: '#6b6e73', align: 'right' });
  }
  if (lo <= 100 && hi >= 100) pdf.line(L, Y(100), R, Y(100), { color: '#c92a2a', width: 0.8 });
  for (const s of rows) {
    const p = [...s.points].sort((a, b) => String(a.x).localeCompare(String(b.x)));
    for (let i = 1; i < p.length; i++) pdf.line(X(p[i - 1].x), Y(p[i - 1].y), X(p[i].x), Y(p[i].y), { color: s.color, width: 1.6 });
    for (const q of p) pdf.rect(X(q.x) - 1.7, Y(q.y) - 1.7, 3.4, 3.4, { fill: s.color });
  }
  const lab = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(localeOf(userLang()), { day: 'numeric', month: 'short' });
  pdf.text(L, B + 14, lab(xs[0]), { size: 8, color: '#6b6e73' });
  if (xs.length > 1) pdf.text(R, B + 14, lab(xs.at(-1)), { size: 8, color: '#6b6e73', align: 'right' });
  return B + 32;
}

function periodLabel(since) {
  if (!since || since === '0000') return tr('pk.all');
  return tr('ui.stats.since', { date: new Date(since + 'T12:00:00').toLocaleDateString(localeOf(userLang()), { day: 'numeric', month: 'short', year: 'numeric' }) });
}
const pdfNum = (v, d = 0) => fmtNum(Number(v) || 0, { maximumFractionDigits: d, minimumFractionDigits: d });

// PDF van de krachtindex. keys beperkt tot de spiergroepen die op het scherm aan staan.
export function strengthPdf({ strength = [], since = '', userName = '', keys = null } = {}) {
  const want = Array.isArray(keys) && keys.length ? new Set(keys) : null;
  const rows = strength.filter((s) => !want || want.has(s.key)).map((s) => ({
    ...s, color: STRENGTH_COLORS[strength.findIndex((x) => x.key === s.key) % STRENGTH_COLORS.length],
  }));
  const pdf = new Pdf();
  const L = 40, R = 555;
  pdf.rect(0, 0, 595, 6, { fill: '#e8590c' });
  pdf.text(L, 36, 'GymCoach', { size: 8.5, bold: true, color: '#e8590c' });
  if (userName) pdf.text(R, 36, userName, { size: 9, color: '#6b6e73', align: 'right' });
  pdf.text(L, 62, tr('ui.stats.krachtontwikkelingPerSpiergroep'), { size: 18, bold: true, maxWidth: R - L });
  pdf.text(L, 82, periodLabel(since), { size: 11, color: '#6b6e73' });
  let y = strengthChart(pdf, rows, L, 104, R - L, 250);
  y += 8;
  for (const s of rows) {
    if (y > 800) { pdf.addPage(); y = 48; }
    pdf.rect(L, y - 8, 8, 8, { fill: s.color });
    const pct = `${s.change > 0 ? '+' : ''}${fmtNum(s.change, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    pdf.text(L + 16, y, s.label, { size: 11, maxWidth: 360 });
    pdf.text(R, y, pct, { size: 11, bold: true, align: 'right', color: s.change > 0 ? '#2b8a3e' : s.change < 0 ? '#c92a2a' : '#6b6e73' });
    y += 18;
  }
  return pdf.toBuffer({ title: tr('ui.stats.krachtontwikkelingPerSpiergroep') });
}

// PDF van de hele tab Terugkijken: cijfers, krachtindex, spiergroepen, oefeningen en patronen.
export function reviewPdf({ stats = {}, extra = {}, analysis = {}, since = '', userName = '' } = {}) {
  const pdf = new Pdf();
  const L = 40, R = 555, W = R - L;
  const TOP = 56, BOTTOM = 786, GAP = 28;
  let y = 48;
  // Een deel begint op de volgende pagina als het anders over de rand heen loopt.
  const section = (h, draw) => {
    const gap = y > 110 ? GAP : 0;
    if (y + gap + h > BOTTOM) { pdf.addPage(); y = TOP; }
    else y += gap;
    draw();
  };
  const heading = (key) => { pdf.text(L, y, tr(key), { size: 13, bold: true, maxWidth: W }); y += 24; };
  const t = stats.totals || {}, x = stats.extra || {};
  pdf.rect(0, 0, 595, 6, { fill: '#e8590c' });
  pdf.text(L, 36, 'GymCoach', { size: 8.5, bold: true, color: '#e8590c' });
  if (userName) pdf.text(R, 36, userName, { size: 9, color: '#6b6e73', align: 'right' });
  pdf.text(L, 60, tr('ui.tabs.statistieken'), { size: 20, bold: true });
  pdf.text(L, 78, periodLabel(since), { size: 11, color: '#6b6e73' });
  y = 108;
  const tiles = [
    [tr('tp.title'), pdfNum(t.workouts)],
    [tr('app.perWeek2'), pdfNum(x.perWeek, 1)],
    [tr('app.trainingstijd'), `${Math.floor((t.minutes || 0) / 60)} h ${ (t.minutes || 0) % 60 } m`],
    [tr('sum.calories'), pdfNum(t.calories)],
    [tr('app.totaalVolume'), `${pdfNum(t.volume)} kg`],
    [tr('ed.sets'), pdfNum(t.sets)],
    [tr('app.weekreeks'), pdfNum(x.streak)],
    [tr('ui.analysis.records'), pdfNum(x.prs)],
    [tr('app.spiergroepen'), pdfNum((stats.muscles || []).filter((m) => m.sets).length)],
  ];
  const tw = (W - 16) / 3, tilePitch = 48;
  const tileRows = Math.ceil(tiles.length / 3);
  section(24 + tileRows * tilePitch, () => {
    heading('ui.review.numbers');
    const y0 = y;
    tiles.forEach((it, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const yy = y0 + row * tilePitch;
      const xx = L + col * (tw + 8);
      pdf.rect(xx, yy, tw, 36, { fill: '#f4f3ef' });
      pdf.text(xx + 8, yy + 14, it[0], { size: 7, bold: true, color: '#6b6e73', maxWidth: tw - 12 });
      pdf.text(xx + 8, yy + 30, it[1], { size: 12, bold: true, maxWidth: tw - 12 });
    });
    y = y0 + tileRows * tilePitch;
  });
  const b = extra.balance || {};
  const hasBal = b.push || b.pull || b.upper || b.lower;
  const cardio = stats.cardio || {};
  const mass = extra.volumeVsMass?.mass || [];
  const facts = [];
  if (cardio.count) facts.push(`${tr('ui.stats.kilometersPerWeek')}: ${pdfNum(cardio.km, 1)} km · ${pdfNum(cardio.minutes)} min`);
  if (cardio.avgSteps) facts.push(`${tr('ui.stats.stappenPerDag')}: ${pdfNum(cardio.avgSteps)}`);
  if (mass.length >= 2) facts.push(`${tr('ui.stats.spiermassaEnTrainingsvolume')}: ${mass[0].y} kg → ${mass.at(-1).y} kg`);
  if (hasBal || facts.length) {
    section((hasBal ? 24 + 20 : 0) + facts.length * 20, () => {
      if (hasBal) {
        heading('app.balans2');
        pdf.text(L, y, `${tr('app.duwen')} ${pdfNum(b.push)} · ${tr('app.trekken')} ${pdfNum(b.pull)} · ${tr('app.boven')} ${pdfNum(b.upper)} · ${tr('app.onder')} ${pdfNum(b.lower)}`, { size: 10, maxWidth: W });
        y += 20;
      }
      for (const f of facts) { pdf.text(L, y, f, { size: 10, maxWidth: W }); y += 20; }
    });
  }
  const rows = (extra.strength || []).map((s, i) => ({ ...s, color: STRENGTH_COLORS[i % STRENGTH_COLORS.length] }));
  if (rows.length) {
    const chartH = 180;
    section(24 + chartH + 40 + rows.length * 18, () => {
      heading('ui.stats.krachtontwikkelingPerSpiergroep');
      y = strengthChart(pdf, rows, L, y, W, chartH);
      y += 8;
      for (const s of rows) {
        pdf.rect(L, y - 8, 8, 8, { fill: s.color });
        const pct = `${s.change > 0 ? '+' : ''}${pdfNum(s.change, 1)}%`;
        pdf.text(L + 14, y, s.label, { size: 10, maxWidth: 360 });
        pdf.text(R, y, pct, { size: 10, bold: true, align: 'right', color: s.change > 0 ? '#2b8a3e' : s.change < 0 ? '#c92a2a' : '#6b6e73' });
        y += 18;
      }
    });
  }
  const muscles = (stats.muscles || []).filter((m) => m.sets).slice(0, 16);
  if (muscles.length) {
    section(24 + muscles.length * 16, () => {
      heading('ui.stats.perSpiergroep');
      for (const m of muscles) {
        pdf.text(L, y, m.label, { size: 9, maxWidth: 220 });
        pdf.text(280, y, `${pdfNum(m.setsPerWeek, 1)} / ${tr('app.wk')}`, { size: 9, color: '#6b6e73' });
        pdf.text(400, y, `${pdfNum(m.volume)} kg`, { size: 9 });
        pdf.text(R, y, m.bestE1rm ? `${pdfNum(m.bestE1rm, 1)} kg` : '', { size: 9, align: 'right' });
        y += 16;
      }
    });
  }
  const exercises = (stats.exercises || []).slice(0, 18);
  if (exercises.length) {
    section(24 + exercises.length * 16, () => {
      heading('ui.stats.perOefening');
      for (const e of exercises) {
        pdf.text(L, y, e.name, { size: 9, maxWidth: 230 });
        pdf.text(280, y, e.muscle || '', { size: 9, color: '#6b6e73', maxWidth: 110 });
        pdf.text(400, y, `${pdfNum(e.volume)} kg`, { size: 9 });
        const pct = Number(e.progressPct) || 0;
        pdf.text(R, y, `${pct > 0 ? '+' : ''}${pdfNum(pct, 1)}%`, { size: 9, align: 'right', color: pct > 0 ? '#2b8a3e' : pct < 0 ? '#c92a2a' : '#6b6e73' });
        y += 16;
      }
    });
  }
  const heat = analysis.heat;
  let busiest = '';
  if (heat?.grid?.length) {
    let best = null;
    heat.grid.forEach((row, r) => row.forEach((c, i) => {
      const v = (c.gym || 0) + (c.act || 0);
      if (!best || v > best.v) best = { v, d: heat.days[r], t: heat.blocks[i] };
    }));
    if (best?.v) busiest = `${tr('ui.analysis.wanneerTrainJe')}: ${best.d} ${best.t}`;
  }
  const rec = analysis.recovery || {};
  const patternLines = [busiest];
  if (rec.recent != null && rec.base != null) patternLines.push(`${tr('ui.analysis.herstel')}: ${pdfNum(rec.recent, 1)} / ${pdfNum(rec.base, 1)}`);
  const kg = analysis.energy?.kg || [];
  if (kg.length >= 2) patternLines.push(`${tr('ui.leg.weight')}: ${kg[0].y} kg → ${kg.at(-1).y} kg`);
  const shown = patternLines.filter(Boolean);
  if (shown.length) {
    section(24 + shown.length * 20, () => {
      heading('ui.review.patterns');
      for (const line of shown) { pdf.text(L, y, line, { size: 10, maxWidth: W }); y += 20; }
    });
  }
  const records = (analysis.records || []).slice(0, 12);
  if (records.length) {
    section(24 + records.length * 16, () => {
      heading('ui.analysis.records');
      for (const r of records) {
        pdf.text(L, y, r.date, { size: 9, color: '#6b6e73' });
        pdf.text(L + 78, y, r.name, { size: 9, maxWidth: 280 });
        pdf.text(R, y, `+${pdfNum(r.pct, 1)}%`, { size: 9, align: 'right', color: '#2b8a3e' });
        y += 16;
      }
    });
  }
  return pdf.toBuffer({ title: tr('ui.tabs.statistieken') });
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
  const heat = { blocks: BLOCKS.map(([a, b]) => `${a}–${b}`).concat([tr('ins.night')]), days: [5, 6, 7, 8, 9, 10, 11].map((d) => new Date(2026, 0, d).toLocaleDateString(localeOf(userLang()), { weekday: 'short' }).replace('.', '')), grid, gymTimed, gymUntimed };

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
