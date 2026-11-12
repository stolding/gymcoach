// Bewaart en leest de gezondheidsscore per gebruiker. De berekening zit in healthscore.js.
import * as store from './store.js';
import { NORMS, addDays, scoreOnDate } from './healthscore.js';

const day = (d) => String(d || '').slice(0, 10);
const dayNum = (iso) => {
  const [y, m, d] = day(iso).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

async function heightM() {
  const settings = await store.getSettings();
  if (Number(settings.heightCm) > 0) return Number(settings.heightCm) / 100;
  const w = await store.getWithings();
  return Number(w?.height) > 0.5 ? Number(w.height) : null;
}

// Alle meetdatums opnieuw. Aanroepen na een weging, een Health-sync, of een wijziging van geslacht of geboortedatum.
export async function rebuild() {
  const [settings, bodyLog, daily, h] = await Promise.all([store.getSettings(), store.getBodyLog(), store.getHealthDaily(), heightM()]);
  const dates = [...new Set(bodyLog.map((b) => day(b.date)).filter(Boolean))].sort();
  const rows = dates.map((date) => scoreOnDate({ date, bodyLog, daily, heightM: h, birthDate: settings.birthDate, sex: settings.sex }));
  store.saveHealthScores(rows);
  return rows;
}

// Vult de tabel als die leeg is of nog op een oudere normenversie staat.
export async function ensure() {
  const rows = store.getHealthScores();
  const body = await store.getBodyLog();
  const stale = rows.some((r) => r.normsVersion !== NORMS.version);
  if (stale || (body.length && !rows.length)) return rebuild();
  return rows;
}

function closest(rows, target, except) {
  let best = null;
  let bestAbs = Infinity;
  const goal = dayNum(target);
  for (const r of rows) {
    if (r.date === except || r.total == null) continue;
    const diff = Math.abs(dayNum(r.date) - goal);
    if (diff < bestAbs || (diff === bestAbs && best && r.date < best.date)) { best = r; bestAbs = diff; }
  }
  return best;
}

function pack(row) {
  if (!row) return null;
  const metrics = {};
  for (const [id, m] of Object.entries(row.metrics || {})) metrics[id] = { value: m.value, score: m.score, points: m.points || [], ...(m.bonus ? { bonus: true } : {}) };
  return {
    date: row.date, status: row.status, total: row.total, coverage: row.coverage, age: row.ageUsed,
    sexUsed: row.sexUsed, normsVersion: row.normsVersion, normsApproximated: row.normsApproximated,
    categories: row.categories || {}, metrics,
  };
}

// Laatste score, het verschil met ongeveer 4 weken eerder, en de punten voor de grafiek.
export async function present(days = 180) {
  const rows = await ensure();
  const settings = await store.getSettings();
  if (!settings.birthDate) return { status: 'nobirth', record: null, delta4w: null, trend: null, since: null, history: [] };
  if (!rows.length) return { status: 'empty', record: null, delta4w: null, trend: null, since: null, history: [] };
  const last = rows[rows.length - 1];
  if (last.status === 'under18') return { status: 'under18', record: pack(last), delta4w: null, trend: null, since: null, history: [] };
  const prev = last.total == null ? null : closest(rows, addDays(last.date, -28), last.date);
  const delta = last.total != null && prev?.total != null ? Math.round((last.total - prev.total) * 10) / 10 : null;
  const trend = delta == null ? null : Math.abs(delta) < 0.2 ? 'flat' : delta > 0 ? 'up' : 'down';
  const from = addDays(last.date, -Math.max(1, days) + 1);
  const history = rows.filter((r) => r.date >= from && r.total != null).map((r) => ({ date: r.date, total: r.total, categories: r.categories }));
  return { status: last.status, record: pack(last), delta4w: delta, trend, since: prev?.date || null, history };
}

// Compact blok voor de AI-samenvatting. Geen breekpunten, wel de scores.
export async function forPrompt() {
  const view = await present(28);
  if (!view.record || view.status === 'nobirth' || view.status === 'under18' || view.status === 'empty') return null;
  return { ...view.record, delta4w: view.delta4w, trend: view.trend, since: view.since };
}
