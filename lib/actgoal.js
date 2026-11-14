// Weekdoelen voor activiteiten buiten de Gym Monster (wandelen, zwemmen, padel, …).
// Het voorstel van de coach staat naast het doel dat je zelf invult.
// Met metingen uit de laatste vier weken (Apple Health) gaat het voorstel omhoog als je al meer doet dan de richtlijn.
// Zonder meting blijft de vaste richtlijn staan. Kilometers alleen als je eigen tempo bekend is.

export const PRESETS = {
  wandelen: { type: 'wandelen', distance: true, times: 3, minutes: 45 },
  fietsen: { type: 'fietsen', distance: true, times: 2, minutes: 45 },
  hardlopen: { type: 'hardlopen', distance: true, times: 2, minutes: 30 },
  zwemmen: { type: 'zwemmen', distance: true, times: 2, minutes: 30 },
  roeien: { type: 'roeien', distance: true, times: 2, minutes: 30 },
  padel: { type: 'racket', label: 'Padel', distance: false, times: 1, minutes: 60 },
  teamsport: { type: 'teamsport', distance: false, times: 1, minutes: 60 },
  yoga: { type: 'yoga', distance: false, times: 2, minutes: 30 },
  hiit: { type: 'hiit', distance: false, times: 2, minutes: 20 },
  elliptical: { type: 'elliptical', distance: true, times: 2, minutes: 30 },
  vechtsport: { type: 'vechtsport', distance: false, times: 2, minutes: 45 },
  dans: { type: 'dans', distance: false, times: 1, minutes: 45 },
  water: { type: 'water', distance: true, times: 1, minutes: 45 },
  wintersport: { type: 'wintersport', distance: true, times: 1, minutes: 60 },
};

const EASY = ['wandelen', 'fietsen', 'hardlopen'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function day(iso, add = 0) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + add);
  return dt.toISOString().slice(0, 10);
}

function monday(iso) {
  const [y, m, d] = day(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = dt.getUTCDay() || 7;
  return day(iso, 1 - wd);
}

function matches(preset, activity) {
  if (preset.label) {
    const want = norm(preset.label);
    return norm(activity.label) === want || norm(activity.name).includes(want);
  }
  return activity.type === preset.type;
}

function round5(n) {
  return Math.round(n / 5) * 5;
}

// Welk opgeslagen doel bij deze training hoort. Een losse cardio-buiten hoort bij één wandel-, fiets- of loopdoel als dat het enige is.
export function goalFor(session, goals) {
  const list = Array.isArray(goals) ? goals : [];
  const id = idFor(session);
  if (id) return list.find((g) => g.id === id) || null;
  if (session?.outdoor || session?.type === 'buiten') {
    const easy = list.filter((g) => EASY.includes(g.id));
    return easy.length === 1 ? easy[0] : null;
  }
  return null;
}

function idFor(session) {
  if (!session?.outdoor && session?.type !== 'buiten') return '';
  const label = norm(session.activityLabel);
  if (label) {
    const hit = Object.entries(PRESETS).find(([, p]) => p.label && norm(p.label) === label);
    if (hit) return hit[0];
  }
  if (session.activity) {
    const hit = Object.entries(PRESETS).find(([, p]) => !p.label && p.type === session.activity);
    if (hit) return hit[0];
  }
  return '';
}

export function propose(id, activities, today) {
  const preset = PRESETS[id];
  if (!preset) return null;
  const end = day(today);
  const start = day(monday(end), -21);
  const rows = (activities || []).filter((a) => a?.date >= start && a.date <= end && matches(preset, a));
  const withMin = rows.filter((a) => Number(a.minutes) > 0);
  const avgMin = withMin.length ? withMin.reduce((n, a) => n + Number(a.minutes), 0) / withMin.length : 0;
  const perWeek = rows.length / 4;
  const times = Math.min(7, Math.max(preset.times, perWeek >= 0.5 ? Math.round(perWeek) : preset.times));
  const minutes = Math.min(90, Math.max(20, round5(Math.max(preset.minutes, avgMin || preset.minutes))));
  let km = null;
  if (preset.distance) {
    const paced = rows.filter((a) => Number(a.km) > 0 && Number(a.minutes) > 0);
    if (paced.length) {
      const sumKm = paced.reduce((n, a) => n + Number(a.km), 0);
      const sumMin = paced.reduce((n, a) => n + Number(a.minutes), 0);
      km = Math.round(times * minutes * (sumKm / sumMin) * 10) / 10;
    }
  }
  const recent = rows.length ? {
    times: rows.length,
    minutes: Math.round(rows.reduce((n, a) => n + (Number(a.minutes) || 0), 0)),
    km: Math.round(rows.reduce((n, a) => n + (Number(a.km) || 0), 0) * 10) / 10,
  } : null;
  return { id, times, minutes, km, recent };
}

export function proposals(activities, today) {
  return Object.fromEntries(Object.keys(PRESETS).map((id) => [id, propose(id, activities, today)]));
}

export function normalize(raw) {
  const out = [];
  const seen = new Set();
  for (const row of (Array.isArray(raw) ? raw : [])) {
    const id = String(row?.id || '');
    const preset = PRESETS[id];
    if (!preset || seen.has(id)) continue;
    const times = Math.round(Number(row.times));
    const minutes = Math.round(Number(row.minutes));
    if (!(times >= 1 && times <= 14) || !(minutes >= 10 && minutes <= 180)) continue;
    let km = row.km === '' || row.km == null ? null : Math.round(Number(String(row.km).replace(',', '.')) * 10) / 10;
    if (!(km >= 0.1 && km <= 500) || !preset.distance) km = null;
    seen.add(id);
    out.push({ id, times, minutes, ...(km ? { km } : {}) });
    if (out.length >= 8) break;
  }
  return out;
}

// Zet de geplande minuten van een bijpassende activiteit op het doel. Verplaatst geen oefeningen.
export function applyMinutes(plan, goals) {
  if (!plan?.sessions) return false;
  let changed = false;
  for (const s of plan.sessions) {
    const g = goalFor(s, goals);
    if (g && s.estMinutes !== g.minutes) {
      s.estMinutes = g.minutes;
      changed = true;
    }
  }
  return changed;
}
