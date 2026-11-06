// Compact antwoord voor GymCoach Sync: het scherm onderweg. Alleen lezen.
// Teksten komen uit het woordenboek, in de taal van het account.
import * as engine from './engine.js';
import { tr, fmtNum, fmtDate, fmtDay } from './lang.js';

const PACE = { on: 'goal.tile.paceOn', ahead: 'goal.tile.paceAhead', behind: 'goal.tile.paceBehind', wait: 'goal.tile.paceWait' };

const whole = (n) => fmtNum(Math.round(Number(n) || 0), { maximumFractionDigits: 0 });
const kgText = (n) => fmtNum(Number(n) || 0, { maximumFractionDigits: 1 });
const optInt = (n) => {
  if (n == null || n === '') return null;
  const x = Math.round(Number(n));
  return Number.isFinite(x) ? x : null;
};
const optNum = (n, d = 1) => {
  if (n == null || n === '') return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
};
const day10 = (d) => String(d || '').slice(0, 10);
const dayRow = (daily, today) => (daily || []).find((d) => day10(d.date) === today) || {};

function signedInt(n) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return '';
  return (x > 0 ? '+' : '') + whole(x);
}

function setText(s) {
  const reps = whole(s.reps || 0);
  return s.weight > 0 ? `${reps} × ${kgText(s.weight)} kg` : reps;
}

function summaryOf(sets) {
  if (!sets.length) return '';
  const same = sets.every((s) => s.reps === sets[0].reps && s.weight === sets[0].weight);
  return same ? `${whole(sets.length)} × ${setText(sets[0])}` : sets.map(setText).join(' · ');
}

function exerciseBlock(e, index) {
  const sets = Array.isArray(e.sets) ? e.sets : [];
  return {
    title: e.title || '',
    muscle: engine.MUSCLE_NL[e.muscle] || e.muscle || '',
    note: e.note || '',
    summary: summaryOf(sets),
    sets: sets.map((s) => ({ text: setText(s), rest: s.rest > 0 ? Math.round(s.rest) : null })),
    index,
  };
}

function sessionBlock(s, status) {
  const done = status[s.key] || null;
  const outdoor = !!(s.outdoor || s.type === 'buiten');
  const exercises = outdoor ? [] : (s.exercises || []).map(exerciseBlock);
  return {
    key: s.key,
    name: s.name || '',
    minutes: optInt(s.estMinutes),
    outdoor,
    advice: outdoor ? (s.advice || '') : '',
    done: !!done,
    doneDate: done?.date ? fmtDay(done.date) : '',
    onDevice: !!s.pushedAt,
    superset: (s.exercises || []).some((e) => e.group),
    exercises,
  };
}

function foodLine(f) {
  if (f.state === 'notarget') return tr('goal.tile.noTarget');
  if (f.state === 'over') return tr('goal.tile.over', { over: whole(f.over) });
  if (f.state === 'protein') return tr('goal.tile.protein', { g: whole(f.protein), target: whole(f.proteinTarget) });
  if (f.state === 'on') return tr('goal.tile.on', { left: whole(f.left) });
  return tr('goal.tile.none');
}

// Zelfde drempels als de tegel op Overzicht, voor een dag zonder opgeslagen doel.
function classifyFood(intake, protein, target, proteinTarget) {
  if (intake == null) return { state: 'none', left: target, over: 0 };
  if (!(target > 0)) return { state: 'notarget', left: null, over: 0 };
  const over = Math.max(0, intake - target);
  if (intake > target * 1.05) return { state: 'over', left: 0, over };
  if (protein != null && proteinTarget > 0 && protein < proteinTarget * 0.9 && intake >= target * 0.5) {
    return { state: 'protein', left: Math.max(0, target - intake), over: 0 };
  }
  return { state: 'on', left: Math.max(0, target - intake), over: 0 };
}

function foodBlock(goalView, row) {
  const carbs = optInt(row.carbsG);
  const fat = optInt(row.fatG);
  const board = goalView.board?.food;
  if (board) {
    return {
      kcal: board.intake ?? null, target: board.target ?? null,
      protein: board.protein ?? null, proteinTarget: board.proteinTarget ?? null,
      carbs, fat, line: foodLine(board),
    };
  }
  const intake = optInt(row.intakeKcal);
  const protein = optInt(row.proteinG);
  const target = goalView.calc?.ok && goalView.calc.target > 0 ? Math.round(goalView.calc.target) : null;
  const proteinTarget = goalView.calc?.ok && goalView.calc.protein > 0 ? Math.round(goalView.calc.protein) : null;
  if (intake == null && protein == null && target == null && carbs == null && fat == null) return null;
  const state = classifyFood(intake, protein, target, proteinTarget);
  return { kcal: intake, target, protein, proteinTarget, carbs, fat, line: foodLine({ ...state, protein, proteinTarget }) };
}

function goalBlock(goalView) {
  const comp = goalView.outcome?.composition;
  const goals = goalView.strengths || [];
  if (!comp && !goals.length) return null;
  const lines = [];
  if (comp) lines.push(tr('goal.tile.weight', { weight: signedInt(comp.weightDeltaKg), date: fmtDate(comp.endDate) }));
  if (comp?.muscleDeltaKg > 0) lines.push(tr('goal.tile.muscle', { muscle: kgText(comp.muscleDeltaKg) }));
  for (const g of goals) {
    const name = g.label || g.name || '';
    if (name) lines.push(tr('goal.tile.strength', { name, pct: whole(g.pct), date: fmtDate(g.endDate) }));
  }
  if (!lines.length) return null;
  const paceState = (comp ? goalView.board?.weight?.state : goalView.board?.strength?.state) || 'wait';
  return { lines, pace: tr(PACE[paceState] || 'goal.tile.paceWait'), paceState: PACE[paceState] ? paceState : 'wait' };
}

function signalLine(s) {
  if (s.key === 'restHr') return tr('sig.restHr', { recent: s.recent, base: s.base, d: (s.delta > 0 ? '+' : '') + s.delta });
  if (s.key === 'hrv') return tr('sig.hrv', { recent: s.recent, base: s.base, p: s.pct });
  if (s.key === 'reps') return tr('sig.reps', { recent: s.recent, base: s.base });
  if (s.key === 'slow') return tr('sig.slow', { recent: s.recent, base: s.base });
  return '';
}

function recoveryBlock(r) {
  if (!r) return null;
  const detail = (r.signals || []).map(signalLine).filter(Boolean).join('\n');
  return { state: r.state, label: tr('sig.state.' + r.state), detail, note: tr('sig.' + r.state + 'Text') };
}

function volumeNote(cur, prev) {
  if (!prev) return tr('app.geenVergelijking');
  if (!cur) return tr('app.vorigeWeekKg', { a: whole(prev) });
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d >= 0 ? '▲' : '▼'} ${whole(Math.abs(d))}% ${tr('app.tOVVorige')}`;
}

function weekPlanBlock(plan, history, settings) {
  const list = plan?.sessions || [];
  const all = list.flatMap((s) => s.exercises || []);
  const vf = engine.volumeFactors(history || {});
  let sets = 0, vol = 0, heavier = 0;
  for (const e of all) {
    const st = e.sets || [];
    sets += st.length;
    const f = (e.id != null && vf.byId[e.id]) || vf.def || 1;
    for (const s of st) vol += f * (Number(s.reps) || 0) * (Number(s.weight) || 0);
    if (/^↑/.test(e.note || '')) heavier++;
  }
  const mins = list.reduce((n, s) => n + (Number(s.estMinutes) || 0), 0);
  const entries = Object.entries(plan?.muscles || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = entries[0]?.[1] || 1;
  const g = settings?.goal || plan?.goal || '';
  return {
    week: optInt(plan?.week) || 0,
    goal: ['spieropbouw', 'combinatie', 'afvallen', 'gemengd', 'circuit', 'buiten'].includes(g) ? tr('app.goal.' + g) : '',
    focus: (plan?.focus || []).map((f) => tr('focus.' + f)),
    sessions: list.length,
    avgMinutes: list.length ? Math.round(mins / list.length) : 0,
    sets, exercises: all.length, volume: Math.round(vol), heavier,
    muscles: entries.map(([k, v]) => ({ name: tr('bm.' + k), value: Math.round(Number(v) * 10) / 10, share: Math.round((v / max) * 1000) / 1000 })),
  };
}

function lastPoint(bodyLog, key) {
  const rows = [...(bodyLog || [])].filter((b) => Number(b[key]) > 0).sort((a, b) => day10(a.date).localeCompare(day10(b.date)));
  if (!rows.length) return null;
  const row = rows[rows.length - 1];
  return { value: optNum(row[key]), date: day10(row.date) };
}

function bodyBlock(bodyLog, overview, now) {
  const kg = now?.kg > 0 ? { value: optNum(now.kg), date: now.kgDate || '' } : lastPoint(bodyLog, 'kg');
  const muscle = now?.muscle > 0 ? { value: optNum(now.muscle), date: now.muscleDate || '' } : lastPoint(bodyLog, 'muscle');
  const fat = lastPoint(bodyLog, 'fat');
  if (!kg && !muscle && !fat) return null;
  const spark = (overview.body?.spark || []).map(Number).filter((x) => x > 0);
  return {
    kg: kg?.value ?? null, date: kg?.date ? fmtDay(kg.date) : '',
    muscle: muscle?.value ?? null, muscleDate: muscle?.date ? fmtDay(muscle.date) : '',
    fat: fat?.value ?? null,
    slope: overview.body?.slope != null ? overview.body.slope : null,
    slopeNote: overview.body?.slope == null ? tr('app.teWeinigMetingen') : tr('app.kgWeek', { a: overview.body.slope > 0 ? '+' : '', slope: kgText(overview.body.slope) }),
    spark,
  };
}

const COMP_PHONE = [
  ['kg', 'kg', 'down'], ['fat', '%', 'down'], ['fatMass', 'kg', 'down'],
  ['muscle', 'kg', 'up'], ['fatFree', 'kg', 'up'], ['musclePct', '%', 'up'], ['restHr', 'bpm', 'down'],
];
const MARK_KIND = [
  ['gym', 'app.gymMonster', '#4cc26a'], ['hiit', 'app.act.hiit', '#ff9f43'], ['wandelen', 'app.act.wandelen', '#6c9cff'],
  ['fietsen', 'app.act.fietsen', '#e5b84b'], ['overig', 'app.act.overig', '#9a9ca1'], ['hardlopen', 'app.act.hardlopen', '#ff6b9a'],
  ['kracht', 'app.act.kracht', '#4cc26a'], ['yoga', 'app.act.yoga', '#c77dff'], ['zwemmen', 'app.act.zwemmen', '#4cc9e5'],
  ['water', 'app.act.water', '#3f8fe0'], ['racket', 'app.act.racket', '#d6e04b'], ['wintersport', 'app.act.wintersport', '#a9dcff'],
  ['roeien', 'app.act.roeien', '#9b8cff'], ['teamsport', 'app.act.teamsport', '#3fd29a'], ['vechtsport', 'app.act.vechtsport', '#e0705a'],
  ['dans', 'app.act.dans', '#ff8fd0'], ['elliptical', 'app.act.elliptical', '#7fd1ae'],
];

function daysBefore(date, n) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - n);
  return t.toISOString().slice(0, 10);
}

function compositionLog(bodyLog) {
  return [...(bodyLog || [])].map((b) => {
    const o = { ...b, date: day10(b.date) };
    if (Number(b.muscle) > 0 && Number(b.kg) > 0) o.musclePct = Math.round((b.muscle / b.kg) * 1000) / 10;
    return o;
  }).filter((b) => b.date).sort((a, b) => a.date.localeCompare(b.date));
}

function lastOnOrBefore(log, key, until) {
  let hit = null;
  for (const b of log) {
    if (!(Number(b[key]) > 0)) continue;
    if (until && b.date > until) break;
    hit = b;
  }
  return hit;
}

function compBands(key, settings) {
  const year = Number(settings?.birthYear);
  const age = year > 1900 ? new Date().getFullYear() - year : null;
  const sex = ['m', 'v'].includes(settings?.sex) ? settings.sex : (['m', 'v'].includes(settings?.bandSex) ? settings.bandSex : '');
  const h = Number(settings?.heightCm) > 0 ? Number(settings.heightCm) / 100 : null;
  const band = (from, to, cls) => ({ from, to, cls });
  if (key === 'restHr') return { bands: [band(0, 75, 'ok'), band(75, 90, 'warn'), band(90, 400, 'bad')], note: tr('app.richtwaardeOnder75Goed') };
  if (key === 'kg' && h) {
    const a = 18.5 * h * h, b = 25 * h * h, c = 30 * h * h;
    return { bands: [band(0, a, 'warn'), band(a, b, 'ok'), band(b, c, 'warn'), band(c, 400, 'bad')], note: tr('app.gezondGewichtBijCm', { a: Math.round(h * 100), b: Math.round(a), c: Math.round(b) }) };
  }
  if (key === 'fat' && sex && age) {
    const t = sex === 'm'
      ? (age < 40 ? [8, 20, 25] : age < 60 ? [11, 22, 28] : [13, 25, 30])
      : (age < 40 ? [21, 33, 39] : age < 60 ? [23, 34, 40] : [24, 36, 42]);
    return { bands: [band(0, t[0], 'warn'), band(t[0], t[1], 'ok'), band(t[1], t[2], 'warn'), band(t[2], 100, 'bad')], note: tr('app.gezondVoorJouwLeeftijd', { a: t[0], b: t[1] }) };
  }
  return { bands: [], note: '' };
}

function zoneOf(bands, value) {
  const hit = (bands || []).find((b) => value >= b.from && value < b.to);
  return hit ? hit.cls : '';
}

function compositionBlock(bodyLog, settings) {
  const log = compositionLog(bodyLog);
  const metrics = [];
  for (const [key, unit, good] of COMP_PHONE) {
    const cur = lastOnOrBefore(log, key);
    if (!cur) continue;
    let old = lastOnOrBefore(log, key, daysBefore(cur.date, 30));
    if (!old) old = log.find((b) => Number(b[key]) > 0);
    const same = !old || old.date === cur.date;
    const delta = same ? null : Math.round((Number(cur[key]) - Number(old[key])) * 10) / 10;
    const guide = compBands(key, settings);
    metrics.push({
      key, label: tr('app.comp.' + key), unit,
      value: optNum(cur[key]) ?? 0,
      delta, since: same ? '' : old.date.slice(5),
      better: delta == null || delta === 0 ? null : (delta > 0) === (good === 'up'),
      zone: zoneOf(guide.bands, Number(cur[key])),
      note: guide.note,
      bands: guide.bands,
      points: log.filter((b) => Number(b[key]) > 0).map((b) => ({ d: b.date, y: optNum(b[key]) ?? 0 })),
    });
  }
  const last = lastOnOrBefore(log, 'kg');
  return { measured: last ? tr('app.laatsteMeting', { a: last.date }) : '', metrics };
}

function activityMarks(workouts, activities) {
  const seen = new Set();
  const marks = [];
  const add = (date, kind) => {
    const d = day10(date);
    if (!d || seen.has(`${d}:${kind}`)) return;
    seen.add(`${d}:${kind}`);
    marks.push({ d, kind });
  };
  for (const w of workouts || []) add(w.date, 'gym');
  for (const a of activities || []) add(a.date, a.type || 'overig');
  const used = new Set(marks.map((m) => m.kind));
  const legend = MARK_KIND.filter(([kind]) => used.has(kind)).map(([kind, key, color]) => ({ kind, label: tr(key), color }));
  return { marks, legend };
}

// Eén payload voor alle tabbladen. `goalView` is de uitkomst van goal.assemble.
export function view({ version, name, today, plan, settings = {}, workouts = [], sessions = {}, history = {}, bodyLog = [], daily = [], goalView = {}, recovery, activities = [] }) {
  const localized = engine.localizePlan(plan);
  const status = engine.planStatus(localized, workouts, sessions);
  const ov = engine.overview({ workouts, history, bodyLog, plan: localized, settings });
  const row = dayRow(daily, today);
  const list = localized?.sessions || [];
  const next = list.find((s) => !status[s.key]);
  const recent = [...(workouts || [])].filter((w) => w.date)
    .sort((a, b) => day10(a.date).localeCompare(day10(b.date))).slice(-8).reverse()
    .map((w) => ({
      date: fmtDay(day10(w.date)),
      title: w.title || tr('ui.settings.training'),
      minutes: w.duration_secs ? Math.round(w.duration_secs / 60) : null,
    }));
  return {
    version: String(version || ''),
    name: name || '',
    today: fmtDay(today),
    iso: today,
    fetchedAt: new Date().toISOString(),
    week: {
      done: optInt(ov.week.done) || 0,
      target: optInt(ov.week.target) || 0,
      minutes: optInt(ov.week.minutes) || 0,
      streak: optInt(ov.streak) || 0,
      kcal: optInt(ov.week.calories) || 0,
      volume: optInt(ov.week.volume) || 0,
      volumeNote: volumeNote(ov.week.volume, ov.week.prevVolume),
    },
    weekPlan: weekPlanBlock(localized, history, settings),
    tip: ov.tip || '',
    deload: !!(localized && localized.deload),
    recovery: recoveryBlock(recovery),
    steps: { today: optInt(row.steps), goal: optInt(goalView.stepGoal) || 8000 },
    food: foodBlock(goalView, row),
    sessions: list.map((s) => sessionBlock(s, status)),
    nextKey: next ? next.key : null,
    goal: goalBlock(goalView),
    body: bodyBlock(bodyLog, ov, goalView.now),
    composition: { ...compositionBlock(bodyLog, settings), ...activityMarks(workouts, activities) },
    recent,
    progress: (ov.strength || []).map((p) => ({
      name: p.name, e1rm: optNum(p.e1rm) || 0, delta: optNum(p.deltaPct) || 0,
      spark: (p.spark || []).map(Number).filter((x) => Number.isFinite(x)),
    })),
    records: (ov.prs || []).slice(0, 5).map((p) => ({ name: p.name, date: fmtDay(p.date), e1rm: optNum(p.e1rm) || 0 })),
  };
}
