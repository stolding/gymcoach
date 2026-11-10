import { MUSCLE_NL } from './engine.js';

// Streefinname (Mifflin-St Jeor) en of een doel in de gevraagde tijd past.
// De som stopt als lengte, geslacht (man of vrouw), geboortejaar of gewicht ontbreekt.

const KCAL_PER_KG = 7700;
const MONTH_DAYS = 30.4375;

export function todayISO(d = new Date()) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function shift(iso, days) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ageYears(birthYear, year = new Date().getFullYear()) {
  const y = Math.round(+birthYear);
  if (!(y >= 1920 && y <= year - 10)) return null;
  return year - y;
}

export function mifflin({ sex, kg, cm, age }) {
  if (sex !== 'm' && sex !== 'v') return null;
  if (!(kg > 0) || !(cm > 0) || !(age >= 10 && age <= 100)) return null;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return Math.round(sex === 'm' ? base + 5 : base - 161);
}

const r1 = (n) => Math.round(n * 10) / 10;
const dayOf = (d) => String(d?.date || d || '').slice(0, 10);

export function latestKg(bodyLog) {
  const rows = [...(bodyLog || [])].filter((b) => b.kg > 0).sort((a, b) => dayOf(a).localeCompare(dayOf(b)));
  return rows.length ? Number(rows[rows.length - 1].kg) : null;
}

export function latestMuscle(bodyLog) {
  const rows = [...(bodyLog || [])].filter((b) => b.muscle > 0).sort((a, b) => dayOf(a).localeCompare(dayOf(b)));
  return rows.length ? Number(rows[rows.length - 1].muscle) : null;
}

function latestPoint(bodyLog, key) {
  const rows = [...(bodyLog || [])].filter((b) => Number(b[key]) > 0).sort((a, b) => dayOf(a).localeCompare(dayOf(b)));
  if (!rows.length) return null;
  const row = rows[rows.length - 1];
  return { value: Number(row[key]), date: dayOf(row) };
}

// Gemiddelde actieve kcal over de dagen mét een waarde. excludeDate slaat een nog open dag over.
export function meanActive(daily, endInclusive, days = 7, excludeDate = null) {
  const end = dayOf(endInclusive);
  const start = shift(end, -(days - 1));
  const vals = [];
  for (const d of daily || []) {
    const day = dayOf(d.date);
    if (day < start || day > end || day === excludeDate) continue;
    if (d.activeKcal == null || !(d.activeKcal >= 0)) continue;
    vals.push(Number(d.activeKcal));
  }
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function compositionFeasibility({ startWeight, startMuscle, weightDeltaKg, musclePct, weeks, experience }) {
  if (!(startWeight > 0)) return { ok: false, reason: 'weight' };
  const wd = Number(weightDeltaKg);
  const wks = Number(weeks);
  const pct = musclePct == null || musclePct === '' ? null : Number(musclePct);
  if (!Number.isFinite(wd) || !Number.isFinite(wks) || !(wks > 0)) return { ok: false, reason: 'input' };
  if (pct != null && (!Number.isFinite(pct) || pct < 0)) return { ok: false, reason: 'input' };
  if (pct > 0 && !(startMuscle > 0)) return { ok: false, reason: 'muscle' };
  const muscleDelta = pct > 0 ? r1(startMuscle * pct / 100) : 0;
  const fatDelta = r1(wd - muscleDelta);
  const fatLoss = Math.max(0, -fatDelta);
  const fatGain = Math.max(0, fatDelta);
  const ceiling = experience === 'gevorderd' ? 0.1 : 0.25;
  const weeksMuscle = muscleDelta > 0 ? (muscleDelta / ceiling) * (MONTH_DAYS / 7) : 0;
  const maxWeek = startWeight * 0.005;
  const weeksFat = (fatLoss + fatGain) > 0 ? (fatLoss + fatGain) / maxWeek : 0;
  const weeksScale = wd !== 0 ? Math.abs(wd) / maxWeek : 0;
  const minWeeks = Math.max(weeksMuscle, weeksFat, weeksScale);
  const ok = wks + 1e-6 >= minWeeks - 0.05;
  const used = ok ? wks : minWeeks;
  const days = Math.max(1, Math.round(used * 7));
  const deficit = fatLoss > 0 ? Math.round(fatLoss * KCAL_PER_KG / days) : 0;
  const surplus = fatLoss === 0 && (muscleDelta > 0 || wd > 0) ? 250 : 0;
  const limiter = muscleDelta > 0 && weeksMuscle >= weeksFat && weeksMuscle >= weeksScale ? 'muscle' : 'rate';
  return {
    ok, reason: ok ? null : 'deadline', limiter,
    weightDeltaKg: wd, musclePct: pct > 0 ? pct : null,
    muscleDeltaKg: muscleDelta, fatDeltaKg: fatDelta, fatLossKg: r1(fatLoss),
    ceilingKgMonth: ceiling, fatPerWeek: r1(maxWeek),
    minWeeks: r1(minWeeks), requestedWeeks: wks, weeks: r1(used), days, deficit, surplus,
    maxMuscleKg: muscleDelta > 0 ? r1(ceiling * (wks * 7 / MONTH_DAYS)) : 0,
  };
}

export function strengthFeasibility({ startE1rm, pct, months, experience }) {
  const p = Number(pct), m = Number(months);
  if (!(startE1rm > 0)) return { ok: false, reason: 'e1rm' };
  if (!Number.isFinite(p) || !Number.isFinite(m) || !(m > 0) || !(p > 0)) return { ok: false, reason: 'input' };
  const perMonth = experience === 'gevorderd' ? 2 : 4;
  const minMonths = p / perMonth;
  const ok = m + 1e-6 >= minMonths - 0.05;
  return {
    ok, reason: ok ? null : 'deadline', pct: p, months: ok ? m : r1(minMonths),
    requestedMonths: m, minMonths: r1(minMonths), perMonth, startE1rm,
    targetE1rm: r1(startE1rm * (1 + p / 100)),
  };
}

export function intakeTarget({ sex, kg, cm, age, activeKcal, deficit = 0, surplus = 0, cutting = false }) {
  const missing = [];
  if (sex !== 'm' && sex !== 'v') missing.push('sex');
  if (!(cm > 0)) missing.push('height');
  if (!(age >= 10)) missing.push('age');
  if (!(kg > 0)) missing.push('weight');
  if (missing.length) return { ok: false, missing };
  const rmr = mifflin({ sex, kg, cm, age });
  const sedentary = Math.round(rmr * 1.2);
  const activeMissing = !(activeKcal > 0);
  const active = activeMissing ? 0 : Math.round(activeKcal);
  const maintenance = sedentary + active;
  let target = maintenance - (deficit || 0) + (surplus || 0);
  const floored = target < rmr;
  if (floored) target = rmr;
  const proteinPerKg = cutting ? 2.0 : 1.6;
  const protein = Math.round(proteinPerKg * kg);
  return {
    ok: true, missing: [],
    lines: [
      { key: 'rmr', kcal: rmr },
      { key: 'sedentary', kcal: sedentary },
      { key: 'active', kcal: active, missing: activeMissing },
      { key: 'maintenance', kcal: maintenance },
      { key: 'adjust', kcal: (surplus || 0) - (deficit || 0) },
      { key: 'target', kcal: Math.round(target), floored },
    ],
    rmr, sedentary, active, activeMissing, maintenance,
    deficit: deficit || 0, surplus: surplus || 0,
    target: Math.round(target), floored, protein, proteinPerKg,
    proteinBand: cutting ? [2.0, 2.2] : [1.6, 2.2],
  };
}

function epley(weight, reps) {
  const kg = Number(weight), r = Number(reps);
  if (!(kg > 0) || !(r > 0)) return 0;
  return r >= 37 ? kg : kg * (1 + r / 30);
}

function latestE1rm(h) {
  const last = h?.log?.[h.log.length - 1];
  if (!last?.sets?.length) return null;
  const best = Math.max(...last.sets.map((s) => epley(s.weight, s.reps)));
  return best > 0 ? r1(best) : null;
}

const muscleLabel = (key) => (key ? (MUSCLE_NL[key] || key) : '');

// Opgeslagen krachtdoelen. Een ouder doel op één oefening krijgt de spiergroep van die oefening.
export function strengthList(outcome, history) {
  const raw = Array.isArray(outcome?.strengths) && outcome.strengths.length
    ? outcome.strengths
    : (outcome?.strength ? [outcome.strength] : []);
  return raw.map((g) => {
    if (g?.muscle) return g;
    const h = history?.[String(g?.exerciseId)];
    return h?.muscle ? { ...g, muscle: h.muscle, label: muscleLabel(h.muscle), legacy: true } : g;
  }).filter(Boolean);
}

function baselineOf(history, muscle) {
  const rows = [];
  for (const [id, h] of Object.entries(history || {})) {
    if (h?.muscle !== muscle) continue;
    const e1 = latestE1rm(h);
    if (e1 > 0) rows.push({ id, name: h.name || '', e1rm: e1 });
  }
  return rows.sort((a, b) => b.e1rm - a.e1rm).slice(0, 12);
}

// Spiergroepen met minstens één lift met gewicht, voor de keuzelijst.
export function muscleOptions(history) {
  const by = new Map();
  for (const [id, h] of Object.entries(history || {})) {
    const e1 = latestE1rm(h);
    if (!h?.muscle || !(e1 > 0)) continue;
    const g = by.get(h.muscle) || { key: h.muscle, label: muscleLabel(h.muscle), lifts: [] };
    g.lifts.push({ id, name: h.name || '', e1rm: e1 });
    by.set(h.muscle, g);
  }
  return [...by.values()].map((g) => {
    g.lifts.sort((a, b) => b.e1rm - a.e1rm);
    return { key: g.key, label: g.label, count: g.lifts.length, best: g.lifts[0] };
  }).sort((a, b) => String(a.label).localeCompare(String(b.label), 'nl'));
}

// Krachtindex: 100 bij de start, daarna het gemiddelde van elke vastgelegde lift t.o.v. zijn eigen start.
export function indexSeries(baseline, history, startDate) {
  const logs = (baseline || []).map((b) => ({ e1rm: Number(b.e1rm), series: e1rmSeries(history?.[b.id]) }));
  if (!logs.length || logs.some((l) => !(l.e1rm > 0))) return [];
  const dates = [...new Set(logs.flatMap((l) => l.series.map((p) => p.x)).filter((d) => !startDate || d >= startDate))].sort();
  if (startDate && !dates.includes(startDate)) dates.unshift(startDate);
  const last = logs.map(() => null);
  const out = [];
  for (const date of dates) {
    logs.forEach((l, i) => {
      const hit = [...l.series].reverse().find((p) => p.x <= date);
      if (hit) last[i] = hit.y;
    });
    const ratios = logs.map((l, i) => (last[i] > 0 ? (last[i] / l.e1rm) * 100 : (date === startDate ? 100 : null))).filter((v) => v > 0);
    if (ratios.length) out.push({ x: date, y: r1(ratios.reduce((s, n) => s + n, 0) / ratios.length) });
  }
  return out;
}

export function e1rmSeries(h) {
  if (!h?.log) return [];
  const out = [];
  for (const l of h.log) {
    const best = Math.max(0, ...l.sets.map((s) => epley(s.weight, s.reps)));
    if (best > 0) out.push({ x: dayOf(l.date), y: r1(best) });
  }
  return out;
}

function cleanComposition(c) {
  const weightDeltaKg = Number(c.weightDeltaKg);
  const weeks = Number(c.weeks);
  const musclePct = c.musclePct == null || c.musclePct === '' ? null : Number(c.musclePct);
  if (!Number.isFinite(weightDeltaKg) || weightDeltaKg < -30 || weightDeltaKg > 30) return { error: 'input' };
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > 320) return { error: 'input' };
  if (musclePct != null && (!Number.isFinite(musclePct) || musclePct < 0 || musclePct > 40)) return { error: 'input' };
  return { weightDeltaKg, weeks, musclePct: musclePct > 0 ? musclePct : null };
}

function cleanStrength(s) {
  const pct = Number(s.pct), months = Number(s.months);
  const muscle = String(s?.muscle || '').trim();
  if (!muscle) return { error: 'input' };
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) return { error: 'input' };
  if (!Number.isFinite(months) || months < 1 || months > 60) return { error: 'input' };
  return { muscle, pct, months };
}

function sameMuscleGoal(saved, next) {
  if (!saved || saved.muscle !== next.muscle) return false;
  return Number(saved.pct) === next.pct && Number(saved.months) === next.months;
}

function sameComp(saved, next) {
  if (!saved) return false;
  return Number(saved.weightDeltaKg) === next.weightDeltaKg
    && (saved.musclePct || null) === (next.musclePct || null)
    && Number(saved.weeks) === next.weeks;
}

function snapshotComp(plan, today, startWeight, startMuscle) {
  return {
    startDate: today, endDate: shift(today, plan.days),
    startWeight, startMuscle: startMuscle ?? null,
    weightDeltaKg: plan.weightDeltaKg, musclePct: plan.musclePct,
    muscleDeltaKg: plan.muscleDeltaKg, fatLossKg: plan.fatLossKg,
    weeks: plan.weeks, days: plan.days, deficit: plan.deficit, surplus: plan.surplus,
    ceilingKgMonth: plan.ceilingKgMonth,
  };
}

function keepStrength(saved) {
  if (saved?.baseline && saved.startIndex) return saved;
  if (saved?.exerciseId && saved.startE1rm > 0 && saved.targetE1rm > 0) {
    return {
      muscle: saved.muscle, label: saved.label || muscleLabel(saved.muscle),
      pct: saved.pct, months: saved.months, perMonth: saved.perMonth,
      startIndex: 100, targetIndex: r1(saved.targetE1rm / saved.startE1rm * 100),
      baseline: [{ id: String(saved.exerciseId), name: saved.name || '', e1rm: saved.startE1rm }],
      startDate: saved.startDate, endDate: saved.endDate,
    };
  }
  return saved;
}

function freshStrength(plan, today, muscle, baseline) {
  return {
    muscle, label: muscleLabel(muscle),
    pct: plan.pct, months: plan.months, perMonth: plan.perMonth,
    startIndex: 100, targetIndex: r1(100 * (1 + plan.pct / 100)),
    baseline, startDate: today, endDate: shift(today, Math.round(plan.months * MONTH_DAYS)),
  };
}

// Past een ingestuurd doel toe. Bij een te korte datum wordt niets bewaard, tenzij accept waar is.
// strengths null wist de krachtdoelen. Een ongewijzigde spiergroep houdt zijn startdatum.
export function applyOutcome({ settings, bodyLog, history, today, composition, strengths, accept }) {
  const experience = settings.experience === 'gevorderd' ? 'gevorderd' : 'beginner';
  const cur = settings.outcome || {};
  const blocked = {};
  let nextComp = composition === null ? null : (cur.composition || null);
  let nextList = strengths === null ? [] : strengthList(cur, history);

  if (composition) {
    const cleaned = cleanComposition(composition);
    if (cleaned.error) return { error: cleaned.error };
    if (sameComp(cur.composition, cleaned)) nextComp = cur.composition;
    else {
      const plan = compositionFeasibility({ ...cleaned, startWeight: latestKg(bodyLog), startMuscle: latestMuscle(bodyLog), experience });
      if (plan.reason && plan.reason !== 'deadline') return { error: plan.reason };
      if (!plan.ok && !accept) {
        blocked.composition = { ...plan, earliest: shift(today, plan.days) };
      } else {
        nextComp = snapshotComp(plan, today, latestKg(bodyLog), latestMuscle(bodyLog));
      }
    }
  }

  if (Array.isArray(strengths)) {
    if (strengths.length > 6) return { error: 'many' };
    const cleaned = [];
    for (const raw of strengths) {
      const one = cleanStrength(raw);
      if (one.error) return { error: one.error };
      if (cleaned.some((x) => x.muscle === one.muscle)) return { error: 'dup', name: muscleLabel(one.muscle) };
      cleaned.push(one);
    }
    const prev = strengthList(cur, history);
    const built = [];
    const blockedRows = [];
    for (const one of cleaned) {
      const saved = prev.find((g) => sameMuscleGoal(g, one));
      if (saved) { built.push(keepStrength(saved)); continue; }
      const base = baselineOf(history, one.muscle);
      const label = muscleLabel(one.muscle);
      if (!base.length) return { error: 'e1rm', name: label };
      const plan = strengthFeasibility({ startE1rm: 100, ...one, experience });
      if (plan.reason && plan.reason !== 'deadline') return { error: plan.reason, name: label };
      if (!plan.ok && !accept) blockedRows.push({ ...plan, name: label, muscle: one.muscle });
      else built.push(freshStrength(plan, today, one.muscle, base));
    }
    if (blockedRows.length) blocked.strength = blockedRows;
    else nextList = built;
  }

  if (Object.keys(blocked).length) return { saved: false, blocked, outcome: nextComp || nextList.length ? { composition: nextComp, strengths: nextList, strength: null } : null };
  const outcome = nextComp || nextList.length ? { composition: nextComp, strengths: nextList, strength: null } : null;
  return { saved: true, blocked: null, outcome };
}

export function recentIntake(daily, today, n = 7) {
  const rows = (daily || [])
    .filter((d) => dayOf(d.date) < today && d.intakeKcal != null)
    .sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)))
    .slice(0, n);
  if (!rows.length) return null;
  const kcal = Math.round(rows.reduce((s, d) => s + Number(d.intakeKcal), 0) / rows.length);
  const prot = rows.filter((d) => d.proteinG != null);
  const protein = prot.length ? Math.round(prot.reduce((s, d) => s + Number(d.proteinG), 0) / prot.length) : null;
  const source = rows.find((d) => d.intakeSource)?.intakeSource || null;
  return { kcal, protein, days: rows.length, source };
}

function kgOn(log, date) {
  const rows = log.filter((b) => dayOf(b.date) <= date && b.kg > 0);
  return rows.length ? Number(rows[rows.length - 1].kg) : null;
}

export function buildDays({ outcome, settings, bodyLog, daily, today }) {
  const comp = outcome?.composition;
  if (!comp?.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(comp.startDate)) return [];
  const log = [...(bodyLog || [])].sort((a, b) => dayOf(a).localeCompare(dayOf(b)));
  const byDay = new Map((daily || []).map((d) => [dayOf(d.date), d]));
  const age = ageYears(settings.birthYear, Number(today.slice(0, 4)));
  const rows = [];
  for (let d = comp.startDate; d <= today && rows.length < 900; d = shift(d, 1)) {
    const measured = log.filter((b) => dayOf(b.date) === d);
    const kg = kgOn(log, d);
    const h = byDay.get(d) || {};
    const open = d === today;
    const active = open ? null : meanActive(daily, d, 7, today);
    const calc = intakeTarget({
      sex: settings.sex, kg, cm: settings.heightCm, age, activeKcal: active,
      deficit: comp.deficit || 0, surplus: comp.surplus || 0, cutting: (comp.deficit || 0) > 0,
    });
    const intake = h.intakeKcal ?? null;
    const protein = h.proteinG ?? null;
    rows.push({
      date: d, open,
      kg: measured.find((b) => b.kg > 0)?.kg ?? null,
      muscle: measured.find((b) => b.muscle > 0)?.muscle ?? null,
      intake, protein,
      proteinPerKg: protein != null && kg > 0 ? r1(protein / kg) : null,
      carbs: h.carbsG ?? null, fat: h.fatG ?? null, fiber: h.fiberG ?? null,
      active: h.activeKcal ?? null,
      target: calc.ok && !open ? calc.target : null,
      diff: intake != null && calc.ok && !open ? Math.round(intake - calc.target) : null,
    });
  }
  return rows;
}

// Welk trainingsdoel bij dit resultaat past. Gewicht en kracht blijven los; samen kiezen ze het schema.
export function trainingStyle(outcome) {
  const comp = outcome?.composition || null;
  const list = strengthList(outcome);
  if (!comp && !list.length) return null;
  let goal = 'spieropbouw';
  if (comp) {
    const muscle = Number(comp.musclePct) > 0 || Number(comp.muscleDeltaKg) > 0;
    const loss = Number(comp.weightDeltaKg) < 0 || Number(comp.fatLossKg) > 0;
    goal = loss && muscle ? 'combinatie' : loss ? 'afvallen' : 'spieropbouw';
  }
  return { goal, muscles: list.map((g) => g.muscle).filter(Boolean) };
}

function spanDays(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 864e5);
}

function paceState(expected, actual, up, tol) {
  if (!(actual > 0) || expected == null) return 'wait';
  if (Math.abs(actual - expected) <= tol) return 'on';
  const ahead = up ? actual - expected : expected - actual;
  return ahead > 0 ? 'ahead' : 'behind';
}

function paceLine(start, end, from, to, today, actual, tol) {
  if (!start || !end || !(from > 0)) return { state: 'wait' };
  const span = Math.max(1, spanDays(start, end));
  const elapsed = Math.max(0, Math.min(span, spanDays(start, today)));
  const expected = from + ((to || from) - from) * (elapsed / span);
  return { state: paceState(expected, actual, (to || from) >= from, tol), expected: r1(expected), actual: actual > 0 ? r1(actual) : null };
}

function posNum(n) {
  const x = Number(n);
  return x > 0 ? r1(x) : null;
}

// Waar je in de periode van dit doel zit. Zelfde dagen als paceLine, geen tweede tempoformule.
function periodOf(start, end, today) {
  const empty = { startDate: start || null, endDate: end || null, elapsed: null, span: null, pct: null, week: null, weeks: null };
  if (!start || !end) return empty;
  const span = spanDays(start, end);
  if (!(span >= 0)) return empty;
  const full = Math.max(1, span);
  const elapsed = Math.max(0, Math.min(full, spanDays(start, today)));
  if (!Number.isFinite(elapsed)) return empty;
  const weeks = Math.max(1, Math.round(full / 7));
  const week = Math.min(weeks, Math.floor(elapsed / 7) + 1);
  return { startDate: start, endDate: end, elapsed, span: full, pct: r1((elapsed / full) * 100), week, weeks };
}

function trackRow({ kind, name, unit, start, now, target, pace, startDate, endDate, today }) {
  return {
    kind, name: name || '', unit: unit || '',
    start: posNum(start), now: posNum(now), target: posNum(target),
    state: pace?.state || 'wait', expected: pace?.expected ?? null, actual: pace?.actual ?? null,
    ...periodOf(startDate, endDate, today),
  };
}

function logPoints(bodyLog, key) {
  return [...(bodyLog || [])]
    .filter((b) => Number(b[key]) > 0)
    .map((b) => ({ x: dayOf(b), y: Number(b[key]) }));
}

// Metingen binnen de periode. Het startpunt komt erbij als die dag nog geen meting heeft.
function actualSeries(measured, startDate, endDate, start, today) {
  const by = new Map();
  for (const p of measured || []) {
    const x = dayOf(p.x);
    const y = Number(p.y);
    if (!x || x < startDate || x > endDate || (today && x > today) || !(y > 0)) continue;
    by.set(x, r1(y));
  }
  if (startDate && start > 0 && !by.has(startDate)) by.set(startDate, r1(start));
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }));
}

// Rechte streeflijn: dezelfde uiteinden als de lijn op Doel. Geen tussenpunten.
function chartOf(row, measured, today) {
  if (!(row.start > 0) || !(row.target > 0) || !row.startDate || !row.endDate || row.endDate < row.startDate) return row;
  return {
    ...row,
    line: [{ x: row.startDate, y: row.start }, { x: row.endDate, y: row.target }],
    points: actualSeries(measured, row.startDate, row.endDate, row.start, today),
  };
}

// Alleen doelen die de gebruiker bewaard heeft. Start en doel blijven leeg als ze er niet zijn.
export function tracks({ outcome, bodyLog, history, today }) {
  const comp = outcome?.composition;
  const rows = [];
  if (comp?.startDate && comp.startWeight > 0) {
    const start = Number(comp.startWeight);
    const target = Number.isFinite(Number(comp.weightDeltaKg)) ? r1(start + Number(comp.weightDeltaKg)) : null;
    const now = latestKg(bodyLog);
    rows.push(chartOf(trackRow({
      kind: 'weight', unit: 'kg', start, now, target,
      pace: paceLine(comp.startDate, comp.endDate, start, target, today, now, 0.4),
      startDate: comp.startDate, endDate: comp.endDate, today,
    }), logPoints(bodyLog, 'kg'), today));
  }
  if (comp?.startDate && comp.musclePct > 0 && comp.startMuscle > 0 && comp.muscleDeltaKg > 0) {
    const start = Number(comp.startMuscle);
    const target = r1(start + Number(comp.muscleDeltaKg));
    const now = latestMuscle(bodyLog);
    rows.push(chartOf(trackRow({
      kind: 'muscle', unit: 'kg', start, now, target,
      pace: paceLine(comp.startDate, comp.endDate, start, target, today, now, 0.4),
      startDate: comp.startDate, endDate: comp.endDate, today,
    }), logPoints(bodyLog, 'muscle'), today));
  }
  for (const g of strengthList(outcome, history)) {
    const from = g.startIndex || g.startE1rm;
    const to = g.targetIndex || g.targetE1rm;
    const series = g.baseline?.length ? indexSeries(g.baseline, history, g.startDate) : (g.exerciseId ? e1rmSeries(history?.[String(g.exerciseId)]) : []);
    // Het laatste punt kan een lichtere dag zijn. De stand is het beste 1RM tot dan toe.
    const peak = series.reduce((m, p) => (p.y > m ? p.y : m), 0);
    const last = peak > 0 ? peak : (series.length ? series[series.length - 1].y : null);
    rows.push(chartOf(trackRow({
      kind: 'strength', name: g.label || g.name || '', unit: g.startIndex ? '' : (from > 0 ? 'kg' : ''),
      start: from, now: last, target: to,
      pace: paceLine(g.startDate, g.endDate, from, to, today, last, Math.max(1, Number(from) * 0.02)),
      startDate: g.startDate, endDate: g.endDate, today,
    }), series, today));
  }
  return rows;
}

function foodToday({ intake, protein, target, proteinTarget }) {
  const base = {
    intake: intake == null ? null : Math.round(intake),
    protein: protein == null ? null : Math.round(protein),
    target: target > 0 ? Math.round(target) : null,
    proteinTarget: proteinTarget > 0 ? Math.round(proteinTarget) : null,
  };
  if (base.intake == null) return { ...base, state: 'none', left: base.target, over: 0 };
  if (!(base.target > 0)) return { ...base, state: 'notarget', left: null, over: 0 };
  const overKcal = base.intake == null ? 0 : Math.max(0, base.intake - base.target);
  const over = base.intake != null && base.intake > base.target * 1.05;
  const short = base.protein != null && base.proteinTarget > 0 && base.protein < base.proteinTarget * 0.9 && (base.intake == null || base.intake >= base.target * 0.5);
  return {
    ...base, over: overKcal, left: Math.max(0, base.target - (base.intake || 0)),
    state: over ? 'over' : short ? 'protein' : 'on',
  };
}

// Kort overzicht voor de tegel: tempo van het doel, inname van vandaag, en een lijntje van de laatste dagen.
export function homeBoard({ outcome, bodyLog, history, today, calc, days, goalTracks }) {
  const comp = outcome?.composition;
  const list = goalTracks || tracks({ outcome, bodyLog, history, today });
  const goals = list.filter((t) => t.kind === 'strength');
  if (!comp && !goals.length) return null;
  const weightRow = list.find((t) => t.kind === 'weight');
  const weight = comp ? (weightRow ? { state: weightRow.state, expected: weightRow.expected, actual: weightRow.actual } : { state: 'wait' }) : null;
  const strength = goals.length ? (goals.find((p) => p.state === 'behind') || goals[0]) : null;
  const row = (days || []).find((d) => d.date === today) || {};
  const food = foodToday({
    intake: row.intake, protein: row.protein,
    target: calc?.ok ? calc.target : null, proteinTarget: calc?.ok ? calc.protein : null,
  });
  const spark = (days || []).filter((d) => !d.open && (d.intake != null || d.target != null)).slice(-14)
    .map((d) => ({ date: d.date, intake: d.intake, target: d.target }));
  const weightSpark = comp ? [...(bodyLog || [])]
    .filter((b) => b.kg > 0 && dayOf(b) >= comp.startDate && dayOf(b) <= today)
    .sort((a, b) => dayOf(a).localeCompare(dayOf(b)))
    .map((b) => Number(b.kg)) : [];
  return { weight, strength, food, spark, weightSpark };
}

export function exerciseOptions(history) {
  return Object.entries(history || {})
    .filter(([, h]) => h?.log?.length && latestE1rm(h))
    .map(([key, h]) => ({ id: key, name: h.name, e1rm: latestE1rm(h), date: dayOf(h.log[h.log.length - 1]?.date) }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'nl'))
    .slice(0, 80);
}

// Alles wat het tabblad Doel tekent, uit de opgeslagen gegevens.
export function assemble({ settings, bodyLog, daily, history, today }) {
  const listed = strengthList(settings.outcome, history);
  const outcome = settings.outcome?.composition || listed.length ? settings.outcome : null;
  const comp = outcome?.composition;
  const age = ageYears(settings.birthYear, Number(String(today).slice(0, 4)));
  const kg = latestKg(bodyLog);
  const weightNow = latestPoint(bodyLog, 'kg');
  const muscleNow = latestPoint(bodyLog, 'muscle');
  const active = meanActive(daily, shift(today, -1), 7, today);
  const deficit = comp?.deficit || 0;
  const surplus = comp ? (comp.surplus || 0) : (listed.length ? 250 : 0);
  const calc = intakeTarget({
    sex: settings.sex, kg, cm: settings.heightCm, age, activeKcal: active,
    deficit, surplus, cutting: deficit > 0,
  });
  const intake = recentIntake(daily, today);
  const below = !!(intake && calc.ok && intake.days >= 3 && intake.kcal < calc.target * 0.9);
  const days = buildDays({ outcome, settings, bodyLog, daily, today });
  const strengths = listed.map((g) => ({
    ...g,
    series: g.baseline?.length ? indexSeries(g.baseline, history, g.startDate) : (g.exerciseId ? e1rmSeries(history?.[String(g.exerciseId)]) : []),
  }));
  const goalTracks = tracks({ outcome, bodyLog, history, today });
  return {
    outcome, calc, intake, below, today,
    alignPlan: !!settings.alignPlan,
    style: trainingStyle(outcome),
    board: homeBoard({ outcome, bodyLog, history, today, calc, days, goalTracks }),
    tracks: goalTracks,
    days,
    now: {
      kg: weightNow?.value ?? null, kgDate: weightNow?.date || null,
      muscle: muscleNow?.value ?? null, muscleDate: muscleNow?.date || null,
    },
    muscles: muscleOptions(history),
    strengths,
    stepGoal: Math.min(40000, Math.max(1000, Math.round(+settings.stepGoal || 8000))),
  };
}
