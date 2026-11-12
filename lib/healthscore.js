// Deterministische gezondheidsscore. De normen staan in scoring-norms.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NORMS = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'scoring-norms.json'), 'utf8'));

const day = (d) => String(d || '').slice(0, 10);
const finite = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n) => Math.min(10, Math.max(1, n));
const show = (n) => round1(clamp(n));

export function addDays(iso, n) {
  const [y, m, d] = day(iso).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// Exacte leeftijd in jaren op een datum, met het deel van het jaar erbij.
export function exactAge(birthDate, onDate) {
  const [by, bm, bd] = day(birthDate).split('-').map(Number);
  const [oy, om, od] = day(onDate).split('-').map(Number);
  if (![by, bm, bd, oy, om, od].every((n) => n > 0)) return null;
  const on = Date.UTC(oy, om - 1, od);
  const anniv = Date.UTC(oy, bm - 1, bd);
  const years = oy - by - (on < anniv ? 1 : 0);
  const start = Date.UTC(oy - (on < anniv ? 1 : 0), bm - 1, bd);
  const end = Date.UTC(oy - (on < anniv ? 1 : 0) + 1, bm - 1, bd);
  return years + (on - start) / (end - start);
}

// m of v, anders het gemiddelde van man en vrouw.
export function sexMode(sex) {
  return sex === 'm' || sex === 'v' ? sex : 'approx';
}

// Lineair tussen breekpunten. Buiten het bereik blijft de score van het uiteinde.
export function interpolate(points, value) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (!pts.length || !Number.isFinite(value)) return null;
  if (value <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < pts.length; i++) {
    if (value <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

// Leeftijdscorrectie: lineair tussen de ankers, daarbuiten het uiteinde.
export function ageSample(samples, age) {
  const anchors = NORMS.ageAnchors;
  if (!samples || age == null) return samples ? samples[anchors.indexOf(65)] ?? 0 : 0;
  if (age <= anchors[0]) return samples[0];
  if (age >= anchors[anchors.length - 1]) return samples[samples.length - 1];
  for (let i = 1; i < anchors.length; i++) {
    if (age <= anchors[i]) {
      const t = (age - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
      return samples[i - 1] + t * (samples[i] - samples[i - 1]);
    }
  }
  return samples[samples.length - 1];
}

// Verschuiving van de x-waarden voor deze leeftijd en dit geslacht.
export function correction(id, age, mode) {
  const metric = NORMS.metrics[id];
  if (!metric || metric.type === 'none') return { type: 'none', shift: 0, factor: 1 };
  const agePart = ageSample(metric.age, age);
  if (metric.type === 'additive') {
    const woman = Number(metric.woman) || 0;
    const sexAdd = mode === 'v' ? woman : mode === 'm' ? 0 : woman / 2;
    return { type: 'additive', shift: agePart + sexAdd, factor: 1 };
  }
  const woman = Number(metric.woman) || 1;
  const sexFactor = mode === 'v' ? woman : mode === 'm' ? 1 : (1 + woman) / 2;
  return { type: 'multiplicative', shift: 0, factor: agePart * sexFactor };
}

function shiftedPoints(id, age, mode) {
  const corr = correction(id, age, mode);
  return NORMS.metrics[id].points.map(([x, s]) => [
    corr.type === 'additive' ? x + corr.shift : corr.type === 'multiplicative' ? x * corr.factor : x,
    s,
  ]);
}

// Deel-, categorie- en totaalscore. Afronding pas op het resultaat.
export function scoreValues({ values = {}, age, sex } = {}) {
  const mode = sexMode(sex);
  const approximated = mode === 'approx' || age > 85;
  const raw = {};
  const metrics = {};
  for (const id of Object.keys(NORMS.metrics)) {
    const value = finite(values[id]);
    if (value == null) continue;
    const points = shiftedPoints(id, age, mode);
    const part = interpolate(points, value);
    if (part == null) continue;
    raw[id] = part;
    metrics[id] = { value, points, score: show(part) };
  }
  const bonus = NORMS.bmiBonus;
  if (raw.bmi != null && raw.ffmi != null && raw.fat != null) {
    const ffmiShift = correction('ffmi', age, mode).shift;
    const fatShift = correction('fat', age, mode).shift;
    if (values.ffmi >= bonus.ffmiAt + ffmiShift && values.fat < bonus.fatBelow + fatShift) {
      raw.bmi = Math.min(10, raw.bmi + bonus.add);
      metrics.bmi.score = show(raw.bmi);
      metrics.bmi.bonus = true;
    }
  }
  const categories = {};
  const categoryRaw = {};
  let covered = 0;
  let weightSum = 0;
  for (const cat of NORMS.categories) {
    weightSum += cat.weight;
    const present = cat.metrics.filter((id) => raw[id] != null);
    covered += cat.weight * (present.length / cat.metrics.length);
    if (!present.length) { categories[cat.id] = null; categoryRaw[cat.id] = null; continue; }
    const mean = present.reduce((s, id) => s + raw[id], 0) / present.length;
    categoryRaw[cat.id] = mean;
    categories[cat.id] = show(mean);
  }
  const coverage = weightSum ? covered / weightSum : 0;
  const used = NORMS.categories.filter((c) => categoryRaw[c.id] != null);
  const usedWeight = used.reduce((s, c) => s + c.weight, 0);
  const totalRaw = coverage >= NORMS.coverageMin && usedWeight > 0
    ? used.reduce((s, c) => s + categoryRaw[c.id] * (c.weight / usedWeight), 0)
    : null;
  return {
    normsVersion: NORMS.version,
    normsApproximated: approximated,
    ageUsed: age == null ? null : round1(age),
    sexUsed: mode,
    coverage,
    categories,
    categoryRaw,
    total: totalRaw == null ? null : show(totalRaw),
    totalRaw,
    metrics,
  };
}

// Gemiddelde van de laatste n geldige waarden. Een 0 of een onmogelijke uitslag telt niet mee.
function meanRecent(rows, key, n = 2, min = 0, max = Infinity) {
  const xs = [];
  for (let i = rows.length - 1; i >= 0 && xs.length < n; i--) {
    const v = finite(rows[i][key]);
    if (v != null && v > min && v <= max) xs.push(v);
  }
  if (!xs.length) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

// Invoer op één meetdatum: twee wegingen, zeven dagen hart, laatste VO2max.
export function valuesOnDate({ date, bodyLog = [], daily = [], heightM = null, age = null } = {}) {
  const d = day(date);
  const measures = bodyLog.filter((b) => day(b.date) && day(b.date) <= d).sort((a, b) => day(a.date).localeCompare(day(b.date)));
  const from7 = addDays(d, -6);
  const watch = daily.filter((x) => day(x.date) >= from7 && day(x.date) <= d).sort((a, b) => day(a.date).localeCompare(day(b.date)));
  const vo2From = addDays(d, -30);
  const vo2 = daily.filter((x) => day(x.date) >= vo2From && day(x.date) <= d && finite(x.vo2max) > 0).sort((a, b) => day(a.date).localeCompare(day(b.date))).at(-1);
  const recent = measures.slice(-2);
  const kg = meanRecent(recent, 'kg');
  const fatFree = meanRecent(recent, 'fatFree');
  const bone = meanRecent(recent, 'bone');
  const water = meanRecent(recent, 'water');
  const ecw = meanRecent(recent, 'ecw');
  const metAge = meanRecent(measures, 'metAge', 2, 15, 120);
  const vascAge = meanRecent(measures, 'vascAge', 2, 15, 120);
  const h = finite(heightM);
  return {
    fat: meanRecent(recent, 'fat'),
    visceral: meanRecent(recent, 'visceral'),
    ffmi: h && fatFree ? fatFree / (h * h) : null,
    bmi: h && kg ? kg / (h * h) : null,
    bonePct: bone && kg ? (bone / kg) * 100 : null,
    restHr: meanRecent(watch, 'restHr', 7, 30, 120),
    pwv: meanRecent(measures, 'pwv', 2, 2, 30),
    vascAge,
    vascDelta: vascAge != null && age != null ? vascAge - age : null,
    vo2max: vo2 ? finite(vo2.vo2max) : null,
    hrv: meanRecent(watch, 'hrv', 7, 0, 300),
    nerve: meanRecent(measures, 'nerve'),
    metAge,
    metDelta: metAge != null && age != null ? metAge - age : null,
    ecwTbw: ecw && water ? ecw / water : null,
  };
}

// Eén score voor een meetdatum, of een reden waarom die ontbreekt.
export function scoreOnDate({ date, bodyLog, daily, heightM, birthDate, sex } = {}) {
  const d = day(date);
  if (!birthDate) return { date: d, status: 'nobirth', total: null, coverage: 0, categories: {}, metrics: {}, normsVersion: NORMS.version, normsApproximated: false, ageUsed: null, sexUsed: sexMode(sex) };
  const age = exactAge(birthDate, d);
  if (age == null) return { date: d, status: 'nobirth', total: null, coverage: 0, categories: {}, metrics: {}, normsVersion: NORMS.version, normsApproximated: false, ageUsed: null, sexUsed: sexMode(sex) };
  if (age < 18) return { date: d, status: 'under18', total: null, coverage: 0, categories: {}, metrics: {}, normsVersion: NORMS.version, normsApproximated: age > 85, ageUsed: round1(age), sexUsed: sexMode(sex) };
  const values = valuesOnDate({ date: d, bodyLog, daily, heightM, age });
  const scored = scoreValues({ values, age, sex });
  if (scored.metrics.vascDelta && values.vascAge != null) scored.metrics.vascDelta.measured = round1(values.vascAge);
  if (scored.metrics.metDelta && values.metAge != null) scored.metrics.metDelta.measured = round1(values.metAge);
  const status = scored.total == null ? 'low' : 'ok';
  return { date: d, status, ...scored };
}
