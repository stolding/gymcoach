// Apple Health via de iPhone-app "Health Auto Export" (REST API-automatisering, JSON).
// De app stuurt { data: { workouts: [...], metrics: [...] } } naar /api/health/ingest
// met een persoonlijke sleutel in de header (Authorization: Bearer … of X-GymCoach-Key: …).
import { createHash, randomBytes } from 'node:crypto';
import * as store from './store.js';
import { classify } from './acttypes.js';

// SHA-256 van een koppelsleutel; alleen de hash wordt bewaard.
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

// Maakt een nieuwe koppelsleutel voor Apple Health (de oude vervalt).
export async function createToken() {
  const token = 'gch_' + randomBytes(24).toString('base64url');
  const cur = await store.getHealthLink();
  await store.saveHealthLink({ ...cur, tokenHash: hashToken(token), tokenHint: token.slice(-4), createdAt: new Date().toISOString() });
  return token;
}
// Trekt de koppelsleutel in.
export async function revokeToken() {
  const cur = await store.getHealthLink();
  delete cur.tokenHash; delete cur.tokenHint;
  await store.saveHealthLink(cur);
}
// Leest de koppelsleutel uit de Authorization-header of de query.
export function tokenFromRequest(req, url) {
  const h = req.headers.authorization || '';
  if (/^Bearer\s+/i.test(h)) return h.replace(/^Bearer\s+/i, '').trim();
  return String(req.headers['x-gymcoach-key'] || url.searchParams.get('key') || '').trim();
}

// "2026-11-04 08:12:00 +0100" → Date
function parseDate(s) {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\s*([+-]\d{2}):?(\d{2})?/.exec(String(s));
  const d = m ? new Date(`${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}${m[3]}:${m[4] || '00'}`) : new Date(s);
  return isNaN(d) ? null : d;
}
// datum in de tijdzone van de telefoon (zoals de gebruiker hem ziet)
const localDay = (s) => (/^\d{4}-\d{2}-\d{2}/.exec(String(s || '')) || [null])[0];

const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null);
const qty = (o) => (o == null ? null : typeof o === 'object' ? num(o.qty ?? o.avg ?? o.value) : num(o));

// Actieve energie in kcal uit een workout (kJ wordt omgerekend).
function kcalOf(o) {
  const q = qty(o); if (q == null) return null;
  return /kj/i.test(o?.units || '') ? q / 4.184 : q;
}
// Afstand in km uit een workout (meters en mijlen worden omgerekend).
function kmOf(o) {
  const q = qty(o); if (q == null) return null;
  const u = String(o?.units || 'km').toLowerCase();
  return u === 'mi' ? q * 1.609344 : u === 'm' ? q / 1000 : u === 'yd' ? q * 0.0009144 : q;
}

// naam van Apple Health (Engels of Nederlands) → eigen soort (zie acttypes.js)
export const typeOf = (name) => classify(name).type;

// Workout van Health Auto Export (v1 en v2) → activiteit
export function parseWorkout(w) {
  const startD = parseDate(w.start), endD = parseDate(w.end);
  if (!startD) return null;
  const name = String(w.name || w.workoutActivityType || 'Activiteit');
  const durSec = num(w.duration) ?? (endD ? (endD - startD) / 1000 : null);
  const source = String(w.source || w.sourceName || w.metadata?.source || w.metadata?.HKSourceName || '');
  const hrAvg = qty(w.heartRate?.avg) ?? qty(w.avgHeartRate);
  const hrMax = qty(w.heartRate?.max) ?? qty(w.maxHeartRate);
  // hartslagverloop (Health Auto Export en GymCoach Sync: heartRateData [{date, Avg, Max}]) → [sec vanaf start, gem, max]
  const hrSeries = (Array.isArray(w.heartRateData) ? w.heartRateData : []).map((p) => {
    const t = parseDate(p.date); const avg = num(p.Avg ?? p.avg ?? p.qty); const max = num(p.Max ?? p.max);
    return t && avg ? [Math.round((t - startD) / 1000), Math.round(avg), max != null ? Math.round(max) : null] : null;
  }).filter((p) => p && p[0] >= -60).sort((a, b) => a[0] - b[0]);
  return {
    id: String(w.id || hashToken(`${name}|${w.start}`).slice(0, 24)),
    date: localDay(w.start) || startD.toISOString().slice(0, 10),
    start: startD.toISOString(), end: endD ? endD.toISOString() : null,
    type: typeOf(name), label: classify(name).label, name,
    minutes: durSec != null ? Math.round(durSec / 60) : null,
    km: (() => { const k = kmOf(w.distance); return k != null ? Math.round(k * 100) / 100 : null; })(),
    kcal: (() => { const k = kcalOf(w.activeEnergyBurned ?? w.activeEnergy ?? w.totalEnergy); return k != null ? Math.round(k) : null; })(),
    hrAvg: hrAvg != null ? Math.round(hrAvg) : null, hrMax: hrMax != null ? Math.round(hrMax) : null,
    source,
    hrSeries: hrSeries.length >= 3 ? hrSeries : undefined,
    raw: JSON.stringify(w).includes('Speediance') || /speediance/i.test(source) ? 'speediance' : undefined,
  };
}

// Dagwaarden: stappen, actieve energie, wandel-/loopafstand (per dag opgeteld binnen één zending) en hartslag in rust
const METRICS = {
  step_count: ['steps', (d) => qty(d)],
  active_energy: ['activeKcal', (d, units) => (/kj/i.test(units) ? qty(d) / 4.184 : qty(d))],
  resting_heart_rate: ['restHr', (d) => qty(d), 'last'],
  // HRV (SDNN, ms) en VO2max-schatting (ml/kg/min) van de Apple Watch: de laatste waarde van de dag
  heart_rate_variability: ['hrv', (d) => qty(d), 'last'],
  vo2_max: ['vo2max', (d) => qty(d), 'last'],
  heart_rate_variability_sdnn: ['hrv', (d) => qty(d), 'last'],
  walking_running_distance: ['walkKm', (d, units) => { const q = qty(d); return q == null ? null : /mi/i.test(units) ? q * 1.609344 : /^m$/i.test(units) ? q / 1000 : q; }],
  // inname: de telefoon stuurt één bron (anders telt hetzelfde eten dubbel)
  dietary_energy: ['intakeKcal', (d, units) => (/kj/i.test(units) ? qty(d) / 4.184 : qty(d))],
  dietary_energy_consumed: ['intakeKcal', (d, units) => (/kj/i.test(units) ? qty(d) / 4.184 : qty(d))],
  dietary_protein: ['proteinG', (d) => qty(d)],
  dietary_carbohydrates: ['carbsG', (d) => qty(d)],
  dietary_fat: ['fatG', (d) => qty(d)],
  dietary_fat_total: ['fatG', (d) => qty(d)],
  dietary_fiber: ['fiberG', (d) => qty(d)],
};
// Zet dagwaarden (stappen, energie, afstand, rusthartslag, HRV, VO2max) om naar één rij per dag.
export function parseMetrics(metrics = []) {
  const out = {};
  for (const m of metrics) {
    const def = METRICS[m.name]; if (!def || !Array.isArray(m.data)) continue;
    const [field, conv, how] = def;
    for (const d of m.data) {
      const day = localDay(d.date); const v = conv(d, m.units || ''); if (!day || v == null) continue;
      (out[day] ||= {})[field] = how === 'last' ? Math.round(v * 10) / 10 : Math.round(((out[day][field] || 0) + v) * 100) / 100;
      if (m.source && (field === 'intakeKcal' || field === 'proteinG')) out[day].intakeSource = String(m.source).slice(0, 80);
    }
  }
  return out;
}

// Welke Gym Monster-training hoort bij een Apple Health-workout op dezelfde dag?
// Met tijdstip: de dichtstbijzijnde; anders de training met de meest gelijke duur.
function matchGym(list, a) {
  if (!list?.length) return null;
  if (list.length === 1) return list[0];
  const t = new Date(a.start).getTime();
  const withTime = list.filter((g) => /T|\d{2}:\d{2}/.test(String(g.date)));
  if (withTime.length) return withTime.sort((x, y) => Math.abs(new Date(x.date) - t) - Math.abs(new Date(y.date) - t))[0];
  return [...list].sort((x, y) => Math.abs((x.duration_secs || 0) / 60 - (a.minutes || 0)) - Math.abs((y.duration_secs || 0) / 60 - (a.minutes || 0)))[0];
}

// Verwerkt een zending voor de huidige gebruiker. Krachttrainingen die van Speediance komen
// of op een dag met een Gym Monster-training vallen, worden overgeslagen (die staan er al).
export async function ingest(payload) {
  const data = payload?.data || payload || {};
  const workouts = Array.isArray(data.workouts) ? data.workouts : [];
  const gmList = await store.getWorkouts();
  const gmByDay = new Map();
  for (const g of gmList) { const d = String(g.date || '').slice(0, 10); if (d) (gmByDay.get(d) || gmByDay.set(d, []).get(d)).push(g); }
  const extra = await store.getWorkoutHealth();
  const keep = [], skipped = [];
  let linked = 0;
  for (const w of workouts) {
    const a = parseWorkout(w);
    if (!a) { skipped.push('ongeldig'); continue; }
    if (a.raw === 'speediance' || (a.type === 'kracht' && gmByDay.has(a.date))) {
      // niet dubbel tellen, maar hartslag en calorieën wel aan de Gym Monster-training koppelen
      const g = matchGym(gmByDay.get(a.date), a);
      if (g && (a.hrAvg || a.hrMax || a.kcal)) {
        extra[String(g.training_id)] = { hrAvg: a.hrAvg, hrMax: a.hrMax, kcal: a.kcal, minutes: a.minutes, start: a.start, source: a.source, healthId: a.id, hrSeries: a.hrSeries };
        linked++;
      }
      skipped.push(`${a.date} ${a.name} (Gym Monster)`);
      continue;
    }
    delete a.raw;
    keep.push(a);
  }
  if (keep.length) await store.saveActivities(keep);
  if (linked) await store.saveWorkoutHealth(extra);
  const daily = parseMetrics(Array.isArray(data.metrics) ? data.metrics : []);
  if (Object.keys(daily).length) await store.saveHealthDaily(daily);
  const link = await store.getHealthLink();
  await store.saveHealthLink({ ...link, lastPush: new Date().toISOString(), lastCounts: { activities: keep.length, skipped: skipped.length, linked, days: Object.keys(daily).length } });
  return { activities: keep.length, skipped: skipped.length, linked, days: Object.keys(daily).length };
}

// Status van de Apple Health-koppeling voor Instellingen.
export async function status() {
  const link = await store.getHealthLink();
  const acts = await store.getActivities();
  return { linked: !!link.tokenHash, tokenHint: link.tokenHint || null, createdAt: link.createdAt || null, lastPush: link.lastPush || null, lastCounts: link.lastCounts || null, activities: acts.length };
}
