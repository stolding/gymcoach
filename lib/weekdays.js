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

// Uur loopt door naar de vorige of volgende dag. Aan de rand van de week blijft het daar.
function shiftWhen(day, slot) {
  const span = DAY_SLOTS.length;
  let total = day * span + slot;
  const max = 7 * span - 1;
  if (total < 0) total = 0;
  if (total > max) total = max;
  return { w: Math.floor(total / span), slot: total % span };
}

// Verplaatst alle trainingen van de dag van `key` met hetzelfde verschil in dag en dagdeel.
// Een uur dat buiten de dag valt schuift door, zodat twee kolommen niet in één kolom samenvallen.
// Botsen ze met een training die blijft staan, dan schuift de verplaatste naar het dichtstbijzijnde vrije uur.
export function moveTrainingDay(sessions, key, toWeekday, toSlot) {
  const list = sessions || [];
  const src = list.find((s) => s.key === key);
  const fromDay = weekdayNum(src?.weekday);
  const toDay = weekdayNum(toWeekday);
  const to = slotNum(toSlot);
  const fromSlot = slotNum(src?.slot) ?? DEFAULT_SLOT;
  if (!src || isWeekActivity(src) || fromDay == null || toDay == null || to == null) return false;
  const dayDelta = toDay - fromDay;
  const slotDelta = to - fromSlot;
  if (!dayDelta && !slotDelta) return false;
  const movers = list.filter((s) => weekdayNum(s.weekday) === fromDay && !isWeekActivity(s));
  const taken = new Set(list
    .filter((s) => weekdayNum(s.weekday) != null && weekdayNum(s.weekday) !== fromDay)
    .map((s) => `${weekdayNum(s.weekday)}:${slotNum(s.slot) ?? DEFAULT_SLOT}`));
  const planned = movers.map((s) => {
    const sl = slotNum(s.slot) ?? DEFAULT_SLOT;
    const at = shiftWhen(fromDay + dayDelta, sl + slotDelta);
    return { s, w: at.w, slot: at.slot, order: sl };
  }).sort((a, b) => a.w - b.w || a.slot - b.slot || a.order - b.order);
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
  for (const s of sessions) {
    if (!isWeekActivity(s)) continue;
    delete s.weekday;
    delete s.slot;
  }
  const types = Array.isArray(plan.dayTypes) && plan.dayTypes.length === sessions.length ? plan.dayTypes : null;
  const rows = sessions.map((s, i) => ({
    s, i, week: isWeekActivity(s), w: weekdayNum(s?.weekday), slot: slotNum(s?.slot) ?? DEFAULT_SLOT,
    type: types ? types[i] : null,
  }));
  const dated = rows.filter((r) => !r.week && r.w != null).sort((a, b) => a.w - b.w || a.slot - b.slot || a.i - b.i);
  const loose = rows.filter((r) => r.week || r.w == null);
  const ordered = [...dated, ...loose];
  plan.sessions = ordered.map((r) => r.s);
  plan.weekdays = ordered.map((r) => (r.week || r.w == null ? null : r.w));
  plan.slots = ordered.map((r) => (r.week || r.w == null ? null : r.slot));
  if (types) plan.dayTypes = ordered.map((r) => r.type);
  return plan;
}

const isOutdoor = (s) => !!(s?.outdoor || s?.type === 'buiten');
// Een activiteit buiten de Gym Monster hoort bij de week, niet bij één dag en uur.
export function isWeekActivity(s) {
  return isOutdoor(s);
}

// Een vastgezette wandeling en de algemene cardio-buiten op dezelfde dag en hetzelfde uur zijn dezelfde training.
export function preferNamedOutdoor(plan) {
  const sessions = plan?.sessions;
  if (!sessions?.length) return false;
  const drop = new Set();
  for (const s of sessions) {
    if (!isOutdoor(s) || !s.activity) continue;
    const slot = slotNum(s.slot) ?? DEFAULT_SLOT;
    const generic = sessions.find((g) => {
      if (g === s || drop.has(g) || !isOutdoor(g) || g.activity) return false;
      const bothWeek = weekdayNum(s.weekday) == null && weekdayNum(g.weekday) == null;
      const sameMoment = weekdayNum(g.weekday) === weekdayNum(s.weekday) && (slotNum(g.slot) ?? DEFAULT_SLOT) === slot;
      return bothWeek || (weekdayNum(s.weekday) != null && sameMoment);
    });
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
  if (isWeekActivity(sess)) {
    delete sess.weekday;
    delete sess.slot;
    return sess;
  }
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
