// Herstel per spiergroep uit afgeronde sets. Niet het weekplan en niet de herstelscore uit rusthartslag/HRV.
// Eén curve voor alle spieren: vermoeidheid halveert elke 24 uur. Een blok van 6 uur is een kwart daarvan.
import { exerciseMuscles, LIB_MUSCLE, PATTERNS, volOf } from './engine.js';
import { SLOW_HEAVY, SLOW_MAX } from './signals.js';
import { tr } from './lang.js';
import { sessionInstant, weekOrigin } from './weekdays.js';

const HALF_LIFE_H = 24;
export const SET_COST = 12; // procentpunten die een gewone werkset de hoofdspier kost, vóór de tijd
export const FRESH = 90; // vanaf dit percentage telt een spier als uitgerust
const DAYS = 28;
const KEYS = new Set(Object.values(LIB_MUSCLE));

const PATTERN_BY_ID = new Map();
for (const [pk, p] of Object.entries(PATTERNS)) {
  for (const id of p.ids || []) PATTERN_BY_ID.set(Number(id), pk);
}

function median(arr) {
  const a = arr.filter((x) => x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.floor(a.length / 2)];
}

function dayOf(today, now) {
  const s = String(today || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const local = new Date(now - new Date(now).getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// Tijdstip van een afgeronde training. Alleen een datum: middag UTC. Nooit later dan nu, en geen toekomstige dag.
function stamp(date, today, now) {
  const s = String(date || '');
  const day = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today) return null;
  let t = s.length > 10 ? Date.parse(s) : NaN;
  if (!Number.isFinite(t)) t = Date.parse(day + 'T12:00:00Z');
  if (!Number.isFinite(t)) return null;
  return Math.min(t, now);
}

// Zelfde spieren als de spierkaart: hoofdspier 1, meewerkend 0,5. Patroon via het oefening-id, anders de catalogusnaam.
function musclesOf(entry) {
  const pattern = entry?.id != null ? PATTERN_BY_ID.get(Number(entry.id)) : undefined;
  const raw = entry?.muscle;
  const direct = KEYS.has(raw) ? raw : undefined;
  const weights = exerciseMuscles({ pattern, muscle: direct ? undefined : raw });
  if (direct) weights[direct] = Math.max(Number(weights[direct]) || 0, 1);
  return weights;
}

// Dicht bij spierfalen telt zwaarder. De vertraging in de set is de proxy voor RIR; een gemist doel ook.
function effortOf(set) {
  let e = 1;
  const slow = set?.slow;
  if (slow != null && slow !== '' && Number.isFinite(Number(slow))) {
    const p = Number(slow);
    if (p >= SLOW_MAX) e = 1.25;
    else if (p >= SLOW_HEAVY) e = 1;
    else e = 0.75;
  }
  const target = Number(set?.target);
  const reps = Number(set?.reps);
  if (target > 0 && reps > 0 && reps < target) e = Math.max(e, 1.15);
  return e;
}

// Volume telt mee tegen de gebruikelijke set van díe oefening, begrensd zodat een beenpers geen tien curls wordt.
function volScale(set, med) {
  const v = volOf(set);
  if (!(v > 0) || !(med > 0)) return 1;
  return Math.min(1.4, Math.max(0.6, v / med));
}

function collect(history, today, now) {
  const events = [];
  for (const h of Object.values(history || {})) {
    if (!h || !Array.isArray(h.log)) continue;
    const weights = Object.entries(musclesOf(h)).filter(([k, w]) => w > 0 && KEYS.has(k));
    if (!weights.length) continue;
    const vols = [];
    for (const l of h.log) for (const s of l.sets || []) {
      const v = volOf(s);
      if (v > 0) vols.push(v);
    }
    const med = median(vols);
    for (const l of h.log) {
      const at = stamp(l.date, today, now);
      if (at == null) continue;
      for (const s of l.sets || []) {
        if (!(Number(s.reps) > 0) || !(Number(s.weight) > 0)) continue;
        const load = effortOf(s) * volScale(s, med);
        if (!(load > 0)) continue;
        for (const [k, w] of weights) events.push({ muscle: k, at, stimulus: SET_COST * w * load });
      }
    }
  }
  return events;
}

// Afgeronde sets als prikkels. Het weekplan telt ze op bij geplande dagen.
export function historyEvents(history, today, now = Date.now()) {
  return collect(history, dayOf(today, now), now);
}

function utcNoon(at) {
  const d = new Date(at);
  return d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

function localDay(at) {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Een logboek met alleen een datum staat op 13:00. Dat is het blok ná het geplande dagdeel.
// Zet die sets op het tijdstip van de training, zodat de stip en de vermoeidheid in hetzelfde blok vallen.
export function withSessionTimes(events, sessions, now = Date.now()) {
  const list = sessions || [];
  if (!list.length || !events?.length) return events || [];
  const origin = weekOrigin(now);
  const anchors = [];
  list.forEach((s, i) => {
    const at = sessionInstant(list, i, origin);
    if (!(at <= now)) return;
    const muscles = {};
    for (const e of s.exercises || []) {
      for (const [k, w] of Object.entries(exerciseMuscles(e))) {
        if (w > 0) muscles[k] = Math.max(muscles[k] || 0, w);
      }
    }
    if (Object.keys(muscles).length) anchors.push({ at, muscles });
  });
  if (!anchors.length) return events;
  return events.map((e) => {
    if (!utcNoon(e.at)) return e;
    const day = localDay(e.at);
    let best = null;
    for (const a of anchors) {
      if (localDay(a.at) !== day) continue;
      const w = a.muscles[e.muscle] || 0;
      if (!(w > 0)) continue;
      if (!best || w > best.w || (w === best.w && a.at < best.at)) best = { at: a.at, w };
    }
    return best ? { ...e, at: best.at } : e;
  });
}

export function recoveryAt(events, key, at, digits = 0) {
  return pctAt(events, key, at, digits);
}

// Halvering over de echte verstreken tijd. Zes uur haalt een kwart van de dag eraf, niet de hele dag.
function decayFatigue(f, dt) {
  if (!(f > 0) || !(dt > 0)) return Math.max(0, f || 0);
  const day = HALF_LIFE_H * 3600000;
  const left = f * (0.5 ** (dt / day));
  return left < 1e-9 ? 0 : left;
}

function fatigueAt(events, key, at) {
  const mine = [];
  for (const e of events) {
    if (e.muscle === key && e.at <= at) mine.push(e);
  }
  if (!mine.length) return 0;
  mine.sort((a, b) => a.at - b.at);
  let f = 0;
  let t = mine[0].at;
  for (const e of mine) {
    if (e.at > t) f = decayFatigue(f, e.at - t);
    t = e.at;
    f += e.stimulus;
  }
  if (at > t) f = decayFatigue(f, at - t);
  return f;
}

function pctAt(events, key, at, digits = 0) {
  const left = 100 - fatigueAt(events, key, at);
  if (!Number.isFinite(left)) return 100;
  // Uitgerust blijft 100. Onder 0 is de vermoeidheid hoger dan 100 punten; dat getal blijft zichtbaar.
  const capped = Math.min(100, left);
  const scale = 10 ** Math.max(0, digits);
  return Math.round(capped * scale) / scale;
}

function daysBack(today, n) {
  const start = Date.parse(today + 'T12:00:00Z');
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function atDay(day, today, now) {
  if (day === today) return now;
  const t = Date.parse(day + 'T23:59:59.999Z');
  return Number.isFinite(t) ? t : now;
}

// Actuele stand en het verloop (herstelpercentage, 100 = uitgerust) over de laatste weken.
export function report(history, today, now = Date.now(), sessions = null) {
  const day = dayOf(today, now);
  const events = withSessionTimes(collect(history, day, now), sessions, now);
  const note = tr('rec.note');
  const legend = tr('rec.legend');
  if (!events.length) return { note, legend, empty: tr('rec.empty'), fresh: FRESH, setCost: SET_COST, muscles: [], series: [], scores: [] };
  const muscles = [...new Set(events.map((e) => e.muscle))].map((key) => ({
    key,
    name: tr('bm.' + key),
    pct: pctAt(events, key, now),
  })).sort((a, b) => a.pct - b.pct || String(a.name).localeCompare(String(b.name), 'nl'));
  const days = daysBack(day, DAYS);
  const series = muscles.map((m) => ({
    key: m.key,
    points: days.map((d) => ({ d, y: pctAt(events, m.key, atDay(d, day, now)) })),
  }));
  // Vermoeidheidspunten (100 − herstel), ook 0 als de spier helemaal hersteld is. Zo kan het figuur 100% groen kleuren.
  // Een spier zonder afgeronde sets staat er niet bij en krijgt geen verzonnen percentage.
  const scores = muscles.map((m) => ({ key: m.key, value: 100 - m.pct }));
  return { note, legend, empty: null, fresh: FRESH, setCost: SET_COST, muscles, series, scores };
}
