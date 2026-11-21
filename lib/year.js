// Jaaroverzicht: 52 weken op één A4. Staven per week. Trainingen gestapeld per soort, Gym Monster en de rest.
import { Pdf } from './pdf.js';
import { tr, fmtNum, fmtDate } from './lang.js';

const iso = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const day10 = (d) => String(d || '').slice(0, 10);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function mondayOf(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function mondayKey(dateStr) {
  const d = mondayOf(day10(dateStr) + 'T12:00:00');
  return d ? iso(d) : null;
}

// 52 maandagen, de lopende week als laatste.
export function yearWeeks(now = new Date()) {
  const end = mondayOf(now);
  const keys = [];
  for (let i = 51; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i * 7);
    keys.push(iso(d));
  }
  return keys;
}

function avg(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function monthKey(dateStr) {
  const s = day10(dateStr);
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : null;
}

// Alle maanden van de eerste meting of training tot nu. Minuten zijn gym plus overige sport. Gewicht is het maandgemiddelde.
function bagPush(map, key, value) {
  const bag = map.get(key) || [];
  bag.push(value);
  map.set(key, bag);
}

export function yearsSpan({ workouts = [], activities = [], bodyLog = [], history = {}, now = new Date() } = {}) {
  const minutes = new Map();
  const sessions = new Map();
  const volume = new Map();
  const kg = new Map();
  const muscle = new Map();
  const fat = new Map();
  const touch = (date) => {
    const k = monthKey(date);
    if (!k) return null;
    if (!minutes.has(k)) minutes.set(k, 0);
    if (!sessions.has(k)) sessions.set(k, 0);
    if (!volume.has(k)) volume.set(k, 0);
    return k;
  };
  for (const w of workouts) {
    const k = touch(w.date);
    if (!k) continue;
    minutes.set(k, minutes.get(k) + Math.round(num(w.duration_secs) / 60));
    sessions.set(k, sessions.get(k) + 1);
  }
  for (const a of activities) {
    const k = touch(a.date);
    if (!k) continue;
    minutes.set(k, minutes.get(k) + Math.round(num(a.minutes)));
    sessions.set(k, sessions.get(k) + 1);
  }
  for (const h of Object.values(history || {})) {
    for (const l of h.log || []) {
      const k = touch(l.date);
      if (!k) continue;
      let v = 0;
      for (const s of l.sets || []) {
        const reps = num(s.reps), weight = num(s.weight);
        if (reps <= 0 && weight <= 0) continue;
        v += num(s.vol) > 0 ? num(s.vol) : reps * weight;
      }
      volume.set(k, volume.get(k) + v);
    }
  }
  for (const b of bodyLog) {
    const k = monthKey(b.date);
    if (!k) continue;
    if (num(b.kg) > 0) { touch(b.date); bagPush(kg, k, num(b.kg)); }
    if (num(b.muscle) > 0) { touch(b.date); bagPush(muscle, k, num(b.muscle)); }
    if (num(b.fat) > 0) { touch(b.date); bagPush(fat, k, num(b.fat)); }
  }
  const known = [...minutes.keys()].sort();
  if (!known.length) return { months: [] };
  const end = [monthKey(iso(now)), known.at(-1)].filter(Boolean).sort().at(-1);
  const months = [];
  let [y, m] = known[0].split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const weights = kg.get(key) || [];
    const muscles = muscle.get(key) || [];
    const fats = fat.get(key) || [];
    months.push({
      key,
      minutes: minutes.get(key) || 0,
      sessions: sessions.get(key) || 0,
      volume: Math.round(volume.get(key) || 0),
      kg: weights.length ? round1(avg(weights)) : null,
      muscle: muscles.length ? round1(avg(muscles)) : null,
      fat: fats.length ? round1(avg(fats)) : null,
    });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return { months };
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

function addCount(bag, key, type, n = 1) {
  if (!bag[key]) return;
  bag[key][type] = (bag[key][type] || 0) + n;
}

export function yearSeries({ workouts = [], history = {}, activities = [], bodyLog = [], scores = [], now = new Date() } = {}) {
  const weeks = yearWeeks(now);
  const from = weeks[0];
  const to = iso(new Date(now));
  const inRange = (d) => { const s = day10(d); return s >= from && s <= to; };
  const bucket = () => Object.fromEntries(weeks.map((k) => [k, []]));
  const kg = bucket();
  const ex = Object.fromEntries(weeks.map((k) => [k, 0]));
  const minutes = Object.fromEntries(weeks.map((k) => [k, 0]));
  const trainings = Object.fromEntries(weeks.map((k) => [k, {}]));
  let sessions = 0, minSum = 0, sets = 0, volume = 0, exercises = 0;
  let heavy = null;
  for (const w of workouts) {
    if (!inRange(w.date)) continue;
    const k = mondayKey(w.date);
    if (!k || !(k in minutes)) continue;
    sessions++;
    const m = Math.round(num(w.duration_secs) / 60);
    minutes[k] += m;
    minSum += m;
    addCount(trainings, k, 'gym');
  }
  for (const a of activities) {
    if (!inRange(a.date)) continue;
    const k = mondayKey(a.date);
    if (!k || !(k in minutes)) continue;
    sessions++;
    const m = Math.round(num(a.minutes));
    minutes[k] += m;
    minSum += m;
    addCount(trainings, k, String(a.type || 'overig') || 'overig');
  }
  for (const h of Object.values(history || {})) {
    for (const l of h.log || []) {
      if (!inRange(l.date)) continue;
      const k = mondayKey(l.date);
      if (!k || !(k in ex)) continue;
      ex[k]++;
      exercises++;
      for (const s of l.sets || []) {
        const reps = num(s.reps), weight = num(s.weight);
        if (reps <= 0 && weight <= 0) continue;
        sets++;
        volume += num(s.vol) > 0 ? num(s.vol) : reps * weight;
        if (weight > 0 && (!heavy || weight > heavy.weight)) heavy = { weight, reps, name: h.name || '', date: day10(l.date) };
      }
    }
  }
  const weighed = [];
  const muscle = [];
  for (const b of bodyLog) {
    if (!inRange(b.date)) continue;
    const k = mondayKey(b.date);
    if (k && k in kg && num(b.kg) > 0) { kg[k].push(num(b.kg)); weighed.push({ date: day10(b.date), kg: num(b.kg) }); }
    if (num(b.muscle) > 0) muscle.push({ date: day10(b.date), kg: num(b.muscle) });
  }
  weighed.sort((a, b) => a.date.localeCompare(b.date));
  muscle.sort((a, b) => a.date.localeCompare(b.date));
  const scored = scores.filter((s) => s && s.total != null && inRange(s.date)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const first = scored[0], last = scored.at(-1);
  const scoreBag = Object.fromEntries(weeks.map((k) => [k, []]));
  for (const s of scored) {
    const k = mondayKey(s.date);
    if (k && scoreBag[k]) scoreBag[k].push(Number(s.total));
  }
  let held = null;
  const scoreWeek = {};
  for (const week of weeks) {
    if (scoreBag[week].length) held = round1(avg(scoreBag[week]));
    scoreWeek[week] = held;
  }
  const rows = weeks.map((week) => ({
    week,
    kg: kg[week].length ? round1(avg(kg[week])) : null,
    score: scoreWeek[week],
    exercises: ex[week],
    minutes: minutes[week],
    trainings: trainings[week],
  }));
  return {
    from, to, weeks: rows,
    kpi: {
      sessions, minutes: minSum, exercises, sets, volume: Math.round(volume),
      weeksTrained: rows.filter((r) => r.minutes > 0 || r.exercises > 0).length,
      weeks: rows.length,
      score: last ? round1(Number(last.total)) : null,
      scoreDelta: first && last && first !== last ? round1(Number(last.total) - Number(first.total)) : null,
      weight: weighed.length ? round1(weighed.at(-1).kg) : null,
      weightDelta: weighed.length >= 2 ? round1(weighed.at(-1).kg - weighed[0].kg) : null,
      muscleFrom: muscle.length ? round1(muscle[0].kg) : null,
      muscleTo: muscle.length >= 2 ? round1(muscle.at(-1).kg) : null,
      heavy,
    },
  };
}

function signed(n, digits = 1) {
  const v = fmtNum(n, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n > 0 ? `+${v}` : v;
}

const STACK_COLORS = ['#e8590c', '#2b8a3e', '#3b5bdb', '#f08c00', '#7048e8', '#0c8599', '#c2255c', '#5c5f66'];

function typeLabel(id) {
  if (id === 'gym') return tr('year.gym');
  const key = `app.act.${id}`;
  const label = tr(key);
  return label === key ? id : label;
}

function stackOf(rows) {
  const tot = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.trainings || {})) if (v > 0) tot[k] = (tot[k] || 0) + v;
  const keys = Object.keys(tot).sort((a, b) => (a === 'gym' ? -1 : b === 'gym' ? 1 : tot[b] - tot[a]));
  const keep = keys.slice(0, 6);
  const rest = keys.slice(6);
  const legend = keep.map((id, i) => ({ id, color: STACK_COLORS[i % STACK_COLORS.length], label: typeLabel(id) }));
  if (rest.length) legend.push({ id: 'overig', color: STACK_COLORS[6], label: typeLabel('overig') });
  return { legend, parts(row) {
    const src = row.trainings || {};
    const out = legend.filter((l) => l.id !== 'overig').map((l) => ({ ...l, v: src[l.id] || 0 }));
    if (rest.length) out.push({ id: 'overig', color: STACK_COLORS[6], v: rest.reduce((n, id) => n + (src[id] || 0), 0) });
    return out;
  } };
}

function bars(pdf, { title, unit, points, x, y, w, h, color, zero = true, legend = null }) {
  pdf.text(x, y + 11, title, { size: 11, bold: true, maxWidth: legend ? 150 : w - 40 });
  pdf.text(x + w, y + 11, unit, { size: 8, color: '#6b6e73', align: 'right' });
  let legendX = x + 158;
  if (legend) for (const item of legend) {
    if (legendX > x + w - 36) break;
    pdf.rect(legendX, y + 4, 7, 7, { fill: item.color });
    const tw = pdf.text(legendX + 9, y + 11, item.label, { size: 7, color: '#6b6e73', maxWidth: 70 });
    legendX += 9 + tw + 8;
  }
  const top = y + 18, plotH = h - 34, left = x + 28, pw = w - 28;
  pdf.rect(left, top, pw, plotH, { fill: '#f7f6f3' });
  const totals = points.map((p) => (p.parts ? p.parts.reduce((n, part) => n + part.v, 0) : p.v)).filter((v) => v != null && v > 0);
  if (!totals.length) {
    pdf.text(left + 8, top + 18, tr('year.empty'), { size: 9, color: '#6b6e73' });
    return;
  }
  const max = Math.max(...totals);
  const min = zero ? 0 : Math.min(...totals);
  const span = max - min || 1;
  const gap = 1.1;
  const bw = Math.max(1, (pw - gap * (points.length - 1)) / points.length);
  const floorY = top + plotH - 3;
  pdf.text(x, top + 8, fmtNum(max, { maximumFractionDigits: max >= 100 ? 0 : 1 }), { size: 7, color: '#6b6e73', maxWidth: 26 });
  if (!zero && max !== min) pdf.text(x, floorY, fmtNum(min, { maximumFractionDigits: min >= 100 ? 0 : 1 }), { size: 7, color: '#6b6e73', maxWidth: 26 });
  points.forEach((p, i) => {
    const x0 = left + i * (bw + gap);
    if (p.parts) {
      let yCursor = floorY;
      for (const part of p.parts) {
        if (!(part.v > 0)) continue;
        const bh = (part.v / span) * (plotH - 8);
        if (bh < 0.35) continue;
        yCursor -= bh;
        pdf.rect(x0, yCursor, bw, bh, { fill: part.color });
      }
      return;
    }
    if (p.v == null || p.v <= 0) return;
    const bh = max === min ? (plotH - 8) * 0.55 : Math.max(0.8, ((p.v - min) / span) * (plotH - 8));
    pdf.rect(x0, floorY - bh, bw, bh, { fill: color });
  });
  let month = '', lastLabel = -8;
  points.forEach((p, i) => {
    const m = p.week.slice(0, 7);
    if (m === month || i - lastLabel < 4) return;
    month = m;
    lastLabel = i;
    const x0 = left + i * (bw + gap);
    pdf.text(x0, top + plotH + 11, fmtDate(p.week + 'T12:00:00', { month: 'short' }), { size: 7, color: '#6b6e73', align: i === 0 ? 'left' : 'center' });
  });
}

export function yearPdf(data, { userName = '' } = {}) {
  const pdf = new Pdf();
  const L = 36, R = 559, W = R - L;
  const k = data.kpi || {};
  pdf.rect(0, 0, 595, 6, { fill: '#e8590c' });
  pdf.text(L, 28, 'GymCoach', { size: 8.5, bold: true, color: '#e8590c' });
  if (userName) pdf.text(R, 28, userName, { size: 9, color: '#6b6e73', align: 'right', maxWidth: 220 });
  pdf.text(L, 50, tr('year.title'), { size: 20, bold: true });
  const span = `${fmtDate(data.from + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' })} – ${fmtDate(data.to + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  pdf.text(L, 68, span, { size: 10, color: '#6b6e73', maxWidth: W });

  const tiles = [
    [tr('year.score'), k.score == null ? '—' : fmtNum(k.score, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), k.scoreDelta == null ? '' : signed(k.scoreDelta), true],
    [tr('year.weight'), k.weight == null ? '—' : `${fmtNum(k.weight, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`, k.weightDelta == null ? '' : `${signed(k.weightDelta)} kg`, false],
    [tr('year.sessions'), fmtNum(k.sessions), '', false],
    [tr('year.hours'), `${fmtNum(Math.round((k.minutes || 0) / 6) / 10, { maximumFractionDigits: 1 })} ${tr('year.hourUnit')}`, '', false],
    [tr('year.exercises'), fmtNum(k.exercises), '', false],
    [tr('year.volume'), `${fmtNum(k.volume)} kg`, '', false],
    [tr('year.sets'), fmtNum(k.sets), '', false],
    [tr('year.weeks'), `${fmtNum(k.weeksTrained)}/${fmtNum(k.weeks)}`, '', false],
  ];
  const tw = (W - 18) / 4, y0 = 84;
  tiles.forEach((it, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = L + col * (tw + 6), y = y0 + row * 48;
    pdf.rect(x, y, tw, 42, { fill: '#f4f3ef' });
    pdf.text(x + 8, y + 12, it[0], { size: 7, bold: true, color: '#6b6e73', maxWidth: tw - (it[2] ? 52 : 14) });
    if (it[2]) pdf.text(x + tw - 8, y + 12, it[2], { size: 8, bold: true, align: 'right', color: !it[3] ? '#6b6e73' : it[2].startsWith('+') ? '#2b8a3e' : '#c92a2a' });
    pdf.text(x + 8, y + 30, it[1], { size: 13, bold: true, maxWidth: tw - 14 });
  });

  const rows = data.weeks || [];
  const stack = stackOf(rows);
  const charts = [
    { title: tr('year.scoreWeek'), unit: '', color: '#7048e8', zero: false, points: rows.map((r) => ({ week: r.week, v: r.score })) },
    { title: tr('year.weightWeek'), unit: 'kg', color: '#e8590c', zero: false, points: rows.map((r) => ({ week: r.week, v: r.kg })) },
    { title: tr('year.exercisesWeek'), unit: '', color: '#3b5bdb', zero: true, points: rows.map((r) => ({ week: r.week, v: r.exercises })) },
    { title: tr('year.minutesWeek'), unit: 'min', color: '#2b8a3e', zero: true, points: rows.map((r) => ({ week: r.week, v: r.minutes })) },
    { title: tr('year.sessionsWeek'), unit: '', color: '#e8590c', zero: true, legend: stack.legend, points: rows.map((r) => ({ week: r.week, parts: stack.parts(r) })) },
  ];
  charts.forEach((c, i) => {
    bars(pdf, { ...c, x: L, y: 184 + i * 118, w: W, h: 112 });
  });

  const bits = [tr('year.note')];
  if (k.muscleFrom != null && k.muscleTo != null) bits.push(`${tr('year.muscle')}: ${fmtNum(k.muscleFrom, { maximumFractionDigits: 1 })} – ${fmtNum(k.muscleTo, { maximumFractionDigits: 1 })} kg`);
  if (k.heavy) bits.push(`${tr('year.heaviest')}: ${fmtNum(k.heavy.weight, { maximumFractionDigits: 1 })} kg × ${fmtNum(k.heavy.reps)} · ${k.heavy.name}`);
  pdf.text(L, 808, bits.join('   ·   '), { size: 7.5, color: '#6b6e73', maxWidth: W });
  pdf.text(L, 828, 'GymCoach', { size: 7, color: '#b0b3b8' });
  return pdf.toBuffer({ title: tr('year.title') });
}
