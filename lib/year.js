// Jaaroverzicht: 52 weken op één A4. Gewicht van de weegschaal, oefeningen en duur van de Gym Monster.
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
function round1(n) {
  return Math.round(n * 10) / 10;
}

export function yearSeries({ workouts = [], history = {}, bodyLog = [], scores = [], now = new Date() } = {}) {
  const weeks = yearWeeks(now);
  const from = weeks[0];
  const to = iso(new Date(now));
  const inRange = (d) => { const s = day10(d); return s >= from && s <= to; };
  const bucket = () => Object.fromEntries(weeks.map((k) => [k, []]));
  const kg = bucket(), ex = Object.fromEntries(weeks.map((k) => [k, 0]));
  const minutes = Object.fromEntries(weeks.map((k) => [k, 0]));
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
  const rows = weeks.map((week) => ({
    week,
    kg: kg[week].length ? round1(avg(kg[week])) : null,
    exercises: ex[week],
    minutes: minutes[week],
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

function chart(pdf, { title, unit, points, x, y, w, h, color, dots = false }) {
  pdf.text(x, y + 11, title, { size: 11, bold: true, maxWidth: w - 70 });
  pdf.text(x + w, y + 11, unit, { size: 8, color: '#6b6e73', align: 'right' });
  const top = y + 18, plotH = h - 34, left = x + 28, pw = w - 28;
  pdf.rect(left, top, pw, plotH, { fill: '#f7f6f3' });
  const drawn = points.map((p) => p.v).filter((v) => v != null);
  if (!drawn.length || drawn.every((v) => v === 0)) {
    pdf.text(left + 8, top + 18, tr('year.empty'), { size: 9, color: '#6b6e73' });
    return;
  }
  const min = Math.min(...drawn), max = Math.max(...drawn);
  const span = max - min;
  const px = (i) => left + (points.length <= 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const py = (v) => span === 0 ? top + plotH / 2 : top + 6 + (1 - (v - min) / span) * (plotH - 12);
  pdf.line(left, py(min), left + pw, py(min), { color: '#e4e2dc', width: 0.4 });
  if (max !== min) pdf.line(left, py(max), left + pw, py(max), { color: '#e4e2dc', width: 0.4 });
  pdf.text(x, py(max) + 3, fmtNum(max, { maximumFractionDigits: max >= 100 ? 0 : 1 }), { size: 7, color: '#6b6e73', maxWidth: 26 });
  if (max !== min) pdf.text(x, py(min) + 3, fmtNum(min, { maximumFractionDigits: min >= 100 ? 0 : 1 }), { size: 7, color: '#6b6e73', maxWidth: 26 });
  let prev = null;
  points.forEach((p, i) => {
    if (p.v == null) return;
    const X = px(i), Y = py(p.v);
    if (prev) pdf.line(prev[0], prev[1], X, Y, { color, width: 1.4 });
    if (dots) pdf.rect(X - 1.5, Y - 1.5, 3, 3, { fill: color });
    prev = [X, Y];
  });
  if (!dots && prev) pdf.rect(prev[0] - 1.6, prev[1] - 1.6, 3.2, 3.2, { fill: color });
  let month = '', lastLabel = -8;
  points.forEach((p, i) => {
    const m = p.week.slice(0, 7);
    if (m === month || i - lastLabel < 4) return;
    month = m;
    lastLabel = i;
    pdf.text(px(i), top + plotH + 11, fmtDate(p.week + 'T12:00:00', { month: 'short' }), { size: 7, color: '#6b6e73', align: i === 0 ? 'left' : 'center' });
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
  const charts = [
    { title: tr('year.weightWeek'), unit: 'kg', color: '#e8590c', dots: true, pick: (r) => r.kg },
    { title: tr('year.exercisesWeek'), unit: '', color: '#3b5bdb', pick: (r) => r.exercises },
    { title: tr('year.minutesWeek'), unit: 'min', color: '#2b8a3e', pick: (r) => r.minutes },
  ];
  charts.forEach((c, i) => {
    chart(pdf, {
      title: c.title, unit: c.unit, color: c.color, dots: c.dots,
      points: rows.map((r) => ({ week: r.week, v: c.pick(r) })),
      x: L, y: 188 + i * 186, w: W, h: 176,
    });
  });

  const bits = [tr('year.note')];
  if (k.muscleFrom != null && k.muscleTo != null) bits.push(`${tr('year.muscle')}: ${fmtNum(k.muscleFrom, { maximumFractionDigits: 1 })} – ${fmtNum(k.muscleTo, { maximumFractionDigits: 1 })} kg`);
  if (k.heavy) bits.push(`${tr('year.heaviest')}: ${fmtNum(k.heavy.weight, { maximumFractionDigits: 1 })} kg × ${fmtNum(k.heavy.reps)} · ${k.heavy.name}`);
  pdf.text(L, 768, bits.join('   ·   '), { size: 8, color: '#6b6e73', maxWidth: W });
  pdf.text(L, 828, 'GymCoach', { size: 7, color: '#b0b3b8' });
  return pdf.toBuffer({ title: tr('year.title') });
}
