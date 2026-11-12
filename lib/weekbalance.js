// Verdeelt de oefeningen van een week over de dagen op basis van spierherstel.
// Uit (settings.weekBalance === 'off') slaat generatePlan dit over; buildPlan blijft dan het vaste schema.
import { exerciseMuscles, orderForSetup, sessionMuscles } from './engine.js';
import { historyEvents, recoveryAt, FRESH, SET_COST } from './muscleRecovery.js';

const regionOf = (s) => {
  const k = String(s?.key || '');
  if (k.startsWith('U')) return 'upper';
  if (k.startsWith('L')) return 'lower';
  if (s?.outdoor || s?.type === 'buiten' || s?.type === 'circuit' || k.startsWith('CC') || k.startsWith('OUT')) return 'fixed';
  return 'full';
};

const freeDay = (s) => regionOf(s) !== 'fixed' && !s.locked && Array.isArray(s.exercises);

function primesOf(e) {
  return Object.entries(exerciseMuscles(e)).filter(([, w]) => w >= 1).map(([k]) => k);
}

function stimuliOf(e) {
  const n = (e.sets || []).filter((s) => Number(s.reps) > 0 && Number(s.weight) > 0).length || (e.sets || []).length || 0;
  if (!n) return [];
  return Object.entries(exerciseMuscles(e)).filter(([, w]) => w > 0).map(([muscle, w]) => ({ muscle, stimulus: SET_COST * w * n }));
}

function workSec(list) {
  return (list || []).reduce((n, e) => {
    const sets = e.sets || [];
    return n + 60 + sets.reduce((t, s) => t + (Number(s.reps) || 0) * 4 + (Number(s.rest) || 0), 0);
  }, 0);
}

function retune(sess) {
  let first = true;
  for (const e of sess.exercises || []) {
    if (first && e.type === 'compound' && sess.warmup) { e.rampUp = true; first = false; }
    else delete e.rampUp;
  }
}

function hourOf(n, i) {
  return n <= 1 ? 0 : i * (6 * 24) / (n - 1);
}

function roleOn(session, key) {
  let role = null, idx = null;
  (session.exercises || []).forEach((e, i) => {
    const w = exerciseMuscles(e)[key] || 0;
    if (w >= 1) { if (role !== 'prime') idx = i; role = 'prime'; }
    else if (w > 0 && role !== 'prime' && !role) { role = 'secondary'; idx = i; }
  });
  return { role, idx };
}

// Raster voor het weekoverzicht: herstel aan het begin van elke dag, zonder oefeningen te verplaatsen.
export function refreshGrid(plan, { history, today, now = Date.now() } = {}) {
  const sessions = plan?.sessions || [];
  const events = historyEvents(history, today, now);
  const totals = {};
  for (const s of sessions) for (const e of s.exercises || []) {
    for (const [k, w] of Object.entries(exerciseMuscles(e))) totals[k] = (totals[k] || 0) + w * (e.sets || []).length;
  }
  const keys = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const rows = keys.map((key) => ({ key, cells: [] }));
  sessions.forEach((s, i) => {
    const at = now + hourOf(sessions.length, i) * 3600000;
    rows.forEach((row) => {
      const { role, idx } = roleOn(s, row.key);
      row.cells.push({ pct: recoveryAt(events, row.key, at), ...(role ? { role, i: idx } : {}) });
    });
    for (const e of s.exercises || []) for (const ev of stimuliOf(e)) events.push({ ...ev, at });
  });
  for (const s of sessions) {
    if (!Array.isArray(s.shifts)) continue;
    s.shifts = s.shifts.filter((sh) => (s.exercises || []).some((e) => e.title === sh.title));
    if (!s.shifts.length) delete s.shifts;
  }
  plan.balance = {
    fresh: FRESH,
    days: sessions.map((s) => ({ key: s.key, name: s.name })),
    rows,
  };
  return plan;
}

export function clearWeekBalance(plan) {
  if (!plan) return plan;
  plan.weekBalance = false;
  delete plan.balance;
  for (const s of plan.sessions || []) delete s.shifts;
  return plan;
}

// Zet oefeningen waarvan de hoofdspier nog niet uitgerust is op een latere dag in dezelfde regio.
export function applyWeekBalance(plan, opts = {}) {
  const sessions = plan?.sessions || [];
  for (const s of sessions) delete s.shifts;
  const events = historyEvents(opts.history, opts.today, opts.now || Date.now());
  const now = opts.now || Date.now();
  const atOf = (i) => now + hourOf(sessions.length, i) * 3600000;
  const add = (e, at) => { for (const ev of stimuliOf(e)) events.push({ ...ev, at }); };

  sessions.forEach((s, i) => {
    if (freeDay(s)) return;
    for (const e of s.exercises || []) add(e, atOf(i));
  });

  const pools = new Map();
  sessions.forEach((s, i) => {
    if (!freeDay(s)) return;
    const r = regionOf(s);
    if (!pools.has(r)) pools.set(r, []);
    pools.get(r).push(i);
  });

  const bag = new Map();
  const caps = {};
  const overhead = {};
  for (const [region, idxs] of pools) {
    if (idxs.length < 2) continue;
    bag.set(region, []);
    for (const i of idxs) {
      caps[i] = sessions[i].exercises.length;
      overhead[i] = Math.max(0, (sessions[i].estMinutes || 0) * 60 - workSec(sessions[i].exercises));
      for (const e of sessions[i].exercises) bag.get(region).push({ e, from: i });
      sessions[i].exercises = [];
      sessions[i].shifts = [];
    }
  }

  for (let i = 0; i < sessions.length; i++) {
    const region = regionOf(sessions[i]);
    const mine = bag.get(region);
    if (!mine) continue;
    const idxs = pools.get(region);
    const at = atOf(i);
    const laterRoom = () => idxs.some((j) => j > i && sessions[j].exercises.length < caps[j]);
    while (sessions[i].exercises.length < caps[i] && mine.length) {
      const placed = sessions[i].exercises;
      let best = 0, bestScore = Infinity;
      for (let b = 0; b < mine.length; b++) {
        const e = mine[b].e;
        const primes = primesOf(e);
        const worst = primes.length ? Math.min(...primes.map((m) => recoveryAt(events, m, at))) : 100;
        let score = Math.abs(mine[b].from - i) * 0.01;
        const freshLeft = mine.some((x) => primesOf(x.e).every((m) => recoveryAt(events, m, at) >= FRESH));
        if (worst < FRESH && freshLeft && laterRoom()) score += 1000;
        if (e.pattern && placed.some((p) => p.pattern === e.pattern)) score += 500;
        if (primes.some((m) => placed.some((p) => primesOf(p).includes(m)))) score += 100;
        if (score < bestScore) { bestScore = score; best = b; }
      }
      const picked = mine.splice(best, 1)[0];
      sessions[i].exercises.push(picked.e);
      if (picked.from !== i) {
        const muscle = primesOf(picked.e)[0] || '';
        const pct = muscle ? recoveryAt(events, muscle, atOf(picked.from)) : 100;
        if (muscle && pct < FRESH) sessions[i].shifts.push({ title: picked.e.title, muscle, from: sessions[picked.from].name, pct });
      }
    }
    for (const e of sessions[i].exercises) add(e, at);
    sessions[i].exercises = orderForSetup(sessions[i].exercises);
    retune(sessions[i]);
    sessions[i].estMinutes = Math.max(1, Math.round((overhead[i] + workSec(sessions[i].exercises)) / 60));
    if (!sessions[i].shifts.length) delete sessions[i].shifts;
    sessionMuscles(sessions[i]);
  }

  plan.weekBalance = true;
  return refreshGrid(plan, opts);
}
