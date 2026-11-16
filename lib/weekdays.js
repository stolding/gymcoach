// Weekdag van een training: 0 = maandag … 6 = zondag.
// Dagdeel: dezelfde zes groepen als Terugkijken (lib/insights.js). 0 = 6–9 uur … 5 = 21–24 uur.
// Zonder weekdag ligt de week gelijkmatig over zes dagen, zoals het herstel eerst deed.

export const DAY_SLOTS = [[6, 9], [9, 12], [12, 15], [15, 18], [18, 21], [21, 24]];
export const DEFAULT_SLOT = 4;
export const BLOCK_HOURS = 6;
export const WEEK_BLOCKS = 7 * (24 / BLOCK_HOURS);

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

export function slotNum(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < DAY_SLOTS.length ? n : null;
}

export function slotHour(slot) {
  const n = slotNum(slot);
  return DAY_SLOTS[n == null ? DEFAULT_SLOT : n][0];
}

// Maandag 0:00 van de kalenderweek waarin now valt.
export function weekOrigin(now) {
  const d = new Date(now);
  const monday = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - monday);
  return d.getTime();
}

export function nextWeekday(used) {
  for (let d = 0; d < 7; d++) if (!used.has(d)) return d;
  return null;
}

// Houdt soort, weekdag en dagdeel bij elkaar. Dezelfde dag mag twee keer, op een ander tijdstip.
export function orderTrainingDays(dayTypes, weekdays, slots = null) {
  if (!Array.isArray(dayTypes) || !dayTypes.length) return { dayTypes: null, weekdays: null, slots: null };
  const types = dayTypes.slice(0, 6);
  const raw = Array.isArray(weekdays) ? weekdays.slice(0, types.length).map(weekdayNum) : [];
  const ok = raw.length === types.length && raw.every((w) => w != null);
  const days = ok ? raw : defaultWeekdays(types.length);
  const rawSlots = Array.isArray(slots) ? slots.slice(0, types.length).map(slotNum) : [];
  const rows = types.map((t, i) => ({ t, w: days[i], slot: rawSlots[i] ?? DEFAULT_SLOT })).sort((a, b) => a.w - b.w || a.slot - b.slot);
  return { dayTypes: rows.map((r) => r.t), weekdays: rows.map((r) => r.w), slots: rows.map((r) => r.slot) };
}

// Uren vanaf maandag 0:00. Zonder weekdag de oude gelijke verdeling, zonder uur.
export function sessionAtHours(sessions, i) {
  const day = weekdayNum(sessions?.[i]?.weekday);
  if (day != null) return day * 24 + slotHour(sessions[i]?.slot);
  return sessionOffsetHours(sessions, i);
}

export function sessionInstant(sessions, i, origin) {
  return origin + sessionAtHours(sessions, i) * 3600000;
}

// Uren na de eerste training als er geen weekdag is. Met weekdagen telt sessionAtHours.
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
  if (days.some((d) => d == null)) return sessions;
  const rows = sessions.map((s, i) => ({ s, i, w: days[i], slot: slotNum(s?.slot) ?? DEFAULT_SLOT }));
  rows.sort((a, b) => a.w - b.w || a.slot - b.slot || a.i - b.i);
  if (rows.every((r, i) => r.s === sessions[i])) return sessions;
  sessions.splice(0, sessions.length, ...rows.map((r) => r.s));
  return sessions;
}

// Verplaatst alle trainingen van de dag van `key` met hetzelfde verschil in dag en dagdeel.
// Botsen ze met een training die blijft staan, dan schuift de verplaatste naar het dichtstbijzijnde vrije uur.
export function moveTrainingDay(sessions, key, toWeekday, toSlot) {
  const list = sessions || [];
  const src = list.find((s) => s.key === key);
  const fromDay = weekdayNum(src?.weekday);
  const toDay = weekdayNum(toWeekday);
  const to = slotNum(toSlot);
  const fromSlot = slotNum(src?.slot) ?? DEFAULT_SLOT;
  if (!src || fromDay == null || toDay == null || to == null) return false;
  const dayDelta = toDay - fromDay;
  const slotDelta = to - fromSlot;
  if (!dayDelta && !slotDelta) return false;
  const movers = list.filter((s) => weekdayNum(s.weekday) === fromDay);
  const taken = new Set(list
    .filter((s) => weekdayNum(s.weekday) != null && weekdayNum(s.weekday) !== fromDay)
    .map((s) => `${weekdayNum(s.weekday)}:${slotNum(s.slot) ?? DEFAULT_SLOT}`));
  const planned = movers.map((s) => ({
    s,
    w: fromDay + dayDelta,
    slot: Math.min(DAY_SLOTS.length - 1, Math.max(0, (slotNum(s.slot) ?? DEFAULT_SLOT) + slotDelta)),
    order: slotNum(s.slot) ?? DEFAULT_SLOT,
  })).sort((a, b) => a.slot - b.slot || a.order - b.order);
  const assigned = [];
  for (const p of planned) {
    let sl = p.slot;
    if (taken.has(`${p.w}:${sl}`)) {
      const dir = slotDelta >= 0 ? 1 : -1;
      let found = null;
      for (let step = 1; step < DAY_SLOTS.length && found == null; step++) {
        for (const n of [p.slot + dir * step, p.slot - dir * step]) {
          if (found == null && n >= 0 && n < DAY_SLOTS.length && !taken.has(`${p.w}:${n}`)) found = n;
        }
      }
      if (found == null) return false;
      sl = found;
    }
    taken.add(`${p.w}:${sl}`);
    assigned.push({ s: p.s, w: p.w, slot: sl });
  }
  for (const a of assigned) { a.s.weekday = a.w; a.s.slot = a.slot; }
  return true;
}

export function alignPlanDays(plan) {
  if (!plan?.sessions) return plan;
  const sessions = plan.sessions;
  const days = sessions.map((s) => weekdayNum(s?.weekday));
  if (!(days.length && days.every((d) => d != null))) return plan;
  const rows = sessions.map((s, i) => ({
    s, i, w: days[i], slot: slotNum(s?.slot) ?? DEFAULT_SLOT,
    type: Array.isArray(plan.dayTypes) && plan.dayTypes.length === sessions.length ? plan.dayTypes[i] : null,
  }));
  rows.sort((a, b) => a.w - b.w || a.slot - b.slot || a.i - b.i);
  plan.sessions = rows.map((r) => r.s);
  plan.weekdays = rows.map((r) => r.w);
  plan.slots = rows.map((r) => r.slot);
  if (rows.every((r) => r.type != null)) plan.dayTypes = rows.map((r) => r.type);
  return plan;
}

const isOutdoor = (s) => !!(s?.outdoor || s?.type === 'buiten');

// Een vastgezette wandeling en de algemene cardio-buiten op dezelfde dag en hetzelfde uur zijn dezelfde training.
export function preferNamedOutdoor(plan) {
  const sessions = plan?.sessions;
  if (!sessions?.length) return false;
  const drop = new Set();
  for (const s of sessions) {
    if (!isOutdoor(s) || !s.activity || weekdayNum(s.weekday) == null) continue;
    const slot = slotNum(s.slot) ?? DEFAULT_SLOT;
    const generic = sessions.find((g) => g !== s && !drop.has(g) && isOutdoor(g) && !g.activity
      && weekdayNum(g.weekday) === weekdayNum(s.weekday) && (slotNum(g.slot) ?? DEFAULT_SLOT) === slot);
    if (generic) drop.add(generic);
  }
  if (!drop.size) return false;
  plan.sessions = sessions.filter((s) => !drop.has(s));
  if (Array.isArray(plan.dayTypes)) {
    for (let n = 0; n < drop.size; n++) {
      const i = plan.dayTypes.indexOf('buiten');
      if (i < 0) break;
      plan.dayTypes.splice(i, 1);
      if (Array.isArray(plan.weekdays)) plan.weekdays.splice(i, 1);
      if (Array.isArray(plan.slots)) plan.slots.splice(i, 1);
    }
  }
  plan.daysPerWeek = plan.sessions.length;
  return true;
}

// Een nieuwe training in een week die al weekdagen heeft, krijgt de eerste vrije dag.
export function assignFreeWeekday(plan, sess) {
  if (!sess) return sess;
  if (weekdayNum(sess.weekday) == null && plan?.sessions?.length) {
    const days = plan.sessions.map((s) => weekdayNum(s.weekday));
    if (days.every((d) => d != null)) {
      const free = nextWeekday(new Set(days));
      if (free != null) sess.weekday = free;
    }
  }
  if (slotNum(sess.slot) == null) sess.slot = DEFAULT_SLOT;
  return sess;
}
