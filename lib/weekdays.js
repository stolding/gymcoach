// Weekdag van een training: 0 = maandag … 6 = zondag.
// Zonder keuze ligt de week gelijkmatig over zes dagen, zoals het herstel eerst deed.

export function weekdayNum(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}

// Zelfde verdeling als het oude herstel: de eerste en de laatste training zitten zes dagen uit elkaar.
export function defaultWeekdays(n) {
  const count = Math.min(6, Math.max(1, Math.round(Number(n)) || 1));
  const used = new Set();
  const out = [];
  for (let i = 0; i < count; i++) {
    let d = count === 1 ? 0 : Math.round(i * 6 / (count - 1));
    if (d > 6) d = 6;
    while (used.has(d)) d = (d + 1) % 7;
    used.add(d);
    out.push(d);
  }
  return out.sort((a, b) => a - b);
}

export function nextWeekday(used) {
  for (let d = 0; d < 7; d++) if (!used.has(d)) return d;
  return null;
}

// Houdt soort en weekdag bij elkaar en zet de week op kalendervolgorde.
export function orderTrainingDays(dayTypes, weekdays) {
  if (!Array.isArray(dayTypes) || !dayTypes.length) return { dayTypes: null, weekdays: null };
  const types = dayTypes.slice(0, 6);
  const raw = Array.isArray(weekdays) ? weekdays.slice(0, types.length).map(weekdayNum) : [];
  const ok = raw.length === types.length && raw.every((w) => w != null) && new Set(raw).size === raw.length;
  const days = ok ? raw : defaultWeekdays(types.length);
  const rows = types.map((t, i) => ({ t, w: days[i] })).sort((a, b) => a.w - b.w);
  return { dayTypes: rows.map((r) => r.t), weekdays: rows.map((r) => r.w) };
}

// Uren na de eerste training van deze week. Ontbreekt een weekdag, dan de oude gelijke verdeling.
export function sessionOffsetHours(sessions, i) {
  const list = sessions || [];
  const days = list.map((s) => weekdayNum(s?.weekday));
  if (list.length && days.every((d) => d != null) && new Set(days).size === days.length) {
    let gap = days[i] - days[0];
    if (gap < 0) gap += 7;
    return gap * 24;
  }
  const n = list.length;
  return n <= 1 ? 0 : i * (6 * 24) / (n - 1);
}

export function sortSessionsByWeekday(sessions) {
  if (!sessions?.length) return sessions;
  const days = sessions.map((s) => weekdayNum(s?.weekday));
  if (days.some((d) => d == null) || new Set(days).size !== days.length) return sessions;
  const rows = sessions.map((s, i) => ({ s, i, w: days[i] }));
  rows.sort((a, b) => a.w - b.w || a.i - b.i);
  if (rows.every((r, i) => r.s === sessions[i])) return sessions;
  sessions.splice(0, sessions.length, ...rows.map((r) => r.s));
  return sessions;
}

export function alignPlanDays(plan) {
  if (!plan?.sessions) return plan;
  sortSessionsByWeekday(plan.sessions);
  const days = plan.sessions.map((s) => weekdayNum(s.weekday));
  if (days.length && days.every((d) => d != null) && new Set(days).size === days.length) plan.weekdays = days;
  return plan;
}

// Een nieuwe training in een week die al weekdagen heeft, krijgt de eerste vrije dag.
export function assignFreeWeekday(plan, sess) {
  if (!plan?.sessions || weekdayNum(sess?.weekday) != null) return sess;
  const days = plan.sessions.map((s) => weekdayNum(s.weekday));
  if (!days.length || days.some((d) => d == null)) return sess;
  const free = nextWeekday(new Set(days));
  if (free != null) sess.weekday = free;
  return sess;
}
