// GymCoach — de app in de browser (één bestand, geen framework).
// Tabbladen: Overzicht, Plan, Statistieken, Analyse, Voortgang, Lichaam en Instellingen.
// Alle gegevens komen van de eigen server via api(); grafieken zijn zelfgemaakte SVG's.
import { bodyMap, MUSCLE_LABELS, figureFor, setDefaultFigure } from './bodymap.js';
import { TERMS_VERSION, TERMS_HTML } from './terms.js';
import { EXPLAIN } from './explain.js';
import { openEditor } from './editor.js';
import { t } from './i18n.js';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GOAL = { spieropbouw: 'Spieropbouw', combinatie: 'Combinatie', afvallen: 'Afvallen', gemengd: 'Gemengde week', circuit: 'Cardio-circuit', buiten: 'Cardio buiten' };
const DAY_TYPES = { spieropbouw: 'Kracht (spieropbouw)', combinatie: 'Combinatie (kracht + afvallen)', afvallen: 'Afvallen (kracht, hoge dichtheid)', circuit: 'Cardio-circuit op de Gym Monster', buiten: 'Cardio buiten (wandelen/fietsen)' };
// categorieën van activiteiten uit Apple Health (de soort zelf, bijv. "Voetbal" of "Padel", staat in a.label)
const ACT = { wandelen: ['Wandelen', '#6c9cff', '🚶'], fietsen: ['Fietsen', '#e5b84b', '🚴'], hardlopen: ['Hardlopen', '#ff6b9a', '🏃'], zwemmen: ['Zwemmen', '#4cc9e5', '🏊'], roeien: ['Roeien', '#9b8cff', '🚣'],
  racket: ['Racketsport', '#d6e04b', '🎾'], teamsport: ['Teamsport', '#3fd29a', '⚽'], water: ['Watersport', '#3f8fe0', '🏄'], wintersport: ['Wintersport', '#a9dcff', '⛷️'], vechtsport: ['Vechtsport', '#e0705a', '🥊'], dans: ['Dansen', '#ff8fd0', '💃'],
  kracht: ['Kracht (overig)', '#4cc26a', '🏋️'], hiit: ['HIIT / cardio', '#ff9f43', '⚡'], yoga: ['Yoga / stretch', '#c77dff', '🧘'], elliptical: ['Crosstrainer / trap', '#7fd1ae', '🏃'], overig: ['Overig', '#9a9ca1', '•'] };
const actLabel = (t) => (ACT[t] || ACT.overig)[0], actColor = (t) => (ACT[t] || ACT.overig)[1];
// kalenderweek van het plan, zoals in de programmanaam op het toestel ("GC 2026-W45 Full Body A")
function isoWeekOf(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return { y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) }; }
const planIso = (p) => isoWeekOf(new Date(p?.generatedAt || Date.now()));
const planLabel = (p) => { const { y, w } = planIso(p); return `${y}-W${String(w).padStart(2, '0')}`; };
const progName = (p, s) => `GC ${planLabel(p)} ${s.name}`;
const actName = (a) => a.label || actLabel(a.type);
const actLine = (a) => `${actName(a)}${a.km ? ` ${(Math.round(a.km * 10) / 10).toLocaleString('nl-NL')} km` : ''}${a.minutes ? ` · ${a.minutes} min` : ''}`;
const DAY_SHORT = { spieropbouw: 'kracht', combinatie: 'combinatie', afvallen: 'afvallen', circuit: 'cardio-circuit', buiten: 'cardio buiten' };

let state = null;

// Roept de GymCoach-API aan (JSON); gooit een fout met de melding van de server.
async function api(method, url, data) {
  const r = await fetch(url, { method, headers: data ? { 'content-type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.login) { showAuth('login'); throw new Error('Log opnieuw in'); }
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

let toastTimer;
// Korte melding onderin beeld.
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), err ? 8000 : 3500);
}

// Zet een knop op "bezig" zolang fn loopt.
async function busy(btn, fn) {
  btn.disabled = true;
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
}

// ---------- thema ----------
const THEMES = { dark: ['🌙', 'Donker'], light: ['☀️', 'Licht'], auto: ['🖥️', 'Automatisch (systeem)'] };
// Licht of donker thema toepassen en onthouden.
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  try { localStorage.setItem('gc-theme', t); } catch {}
  const [icon, label] = THEMES[t];
  $('#themeBtn').textContent = icon; $('#themeBtn').title = `Thema: ${label} — klik om te wisselen`;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#0f1012' : '#f4f3ef';
}
let theme = 'dark';
try { theme = localStorage.getItem('gc-theme') || 'dark'; } catch {}
applyTheme(theme);
$('#themeBtn').addEventListener('click', () => {
  const order = ['dark', 'light', 'auto'];
  theme = order[(order.indexOf(theme) + 1) % 3];
  applyTheme(theme); toast(`Thema: ${THEMES[theme][1]}`);
  if (state) { renderHome(); if ($('#tab-progress').classList.contains('active')) renderProgress(); if ($('#tab-body').classList.contains('active')) renderBody(); }
});

// ---------- tabs ----------
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'progress') renderProgress();
  if (b.dataset.tab === 'home') renderHome();
  if (b.dataset.tab === 'stats') loadStats();
  if (b.dataset.tab === 'settings') { loadAccount(); loadHealth(); if (state?.me?.role === 'admin') loadUsers(); }
  if (b.dataset.tab === 'body') renderBody();
}));

// ---------- charts (SVG, geen dependencies) ----------
// series: [{ cls, label, unit, points: [{x: 'YYYY-MM-DD', y}] }]
const fmtDate = (x) => { const d = new Date(String(x).slice(0, 10) + 'T12:00:00'); if (isNaN(d)) return String(x); const t = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
// eenheid voor de y-as: kort en leesbaar
const axisUnit = (u) => ({ '%-punt': '%-pt' }[u] ?? u ?? '');
const fmtTick = (v, dec, unit) => `${v.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${unit ? (/^[%×]/.test(unit) ? '' : ' ') + unit : ''}`;

// Lijngrafiek (SVG) met een of meer reeksen, as-labels en tooltip.
function lineChart(el, series, { yLabel = '', fromZero = false, yUnit, marks = [], onPick, bands = null, zoneColor = null } = {}) {
  const pts = series.flatMap((s) => s.points);
  if (pts.length < 1) { el.innerHTML = '<div class="empty">Nog geen data</div>'; return; }
  // eenheid op de y-as: expliciet, of de gemeenschappelijke eenheid van alle reeksen
  const units = [...new Set(series.map((s) => s.unit || ''))];
  const unit = axisUnit(yUnit ?? (units.length === 1 ? units[0] : ''));
  const xs = [...new Set(pts.map((p) => p.x))].sort();
  // activiteiten krijgen een eigen strook tussen de grafiek en de datums
  const inMarks = xs.length > 1 ? marks.filter((m) => m.x >= xs[0] && m.x <= xs[xs.length - 1]) : [];
  const perDay = {}; for (const m of inMarks) perDay[m.x] = (perDay[m.x] || 0) + 1;
  const stackMax = Math.max(0, ...Object.values(perDay));
  const STRIP = stackMax ? 6 + stackMax * 6 : 0;
  const W = el.clientWidth || 600, H = el.clientHeight || 220, R = 12, T = 10, B = 26 + STRIP;
  let L = 40;
  const ys = pts.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  // met richtwaarden: bereik iets oprekken tot de dichtstbijzijnde grens, zodat je ziet waar je zit
  if (bands?.length) {
    const span = Math.max(hi - lo, Math.abs(hi) * 0.05);
    const edges = bands.flatMap((b) => [b.from, b.to]).filter(Number.isFinite);
    const below = edges.filter((e) => e < lo).sort((a, b) => b - a)[0];
    const above = edges.filter((e) => e > hi).sort((a, b) => a - b)[0];
    if (below != null && lo - below <= span * 1.5) lo = below - span * 0.15;
    if (above != null && above - hi <= span * 1.5) hi = above + span * 0.15;
  }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  if (fromZero) { lo = 0; hi = Math.max(hi, 2); }
  // datums op een echte tijdas (gaten in de metingen blijven zichtbaar); anders gelijk verdeeld
  const isDate = xs.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
  const tOf = (x) => new Date(x + 'T12:00:00').getTime();
  const t0 = isDate ? tOf(xs[0]) : 0, t1 = isDate ? tOf(xs[xs.length - 1]) : 1;
  const X = (x) => L + (xs.length === 1 ? (W - L - R) / 2 : (isDate ? (tOf(x) - t0) / (t1 - t0) : xs.indexOf(x) / (xs.length - 1)) * (W - L - R));
  const Y = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  let g = '';
  const dec = hi - lo < 1 ? 2 : hi - lo < 10 ? 1 : 0;
  L = Math.max(40, Math.max(fmtTick(lo, dec, unit).length, fmtTick(hi, dec, unit).length) * 6.4 + 12);
  // richtwaarden als lichte achtergrondbanden (alleen het deel binnen het zichtbare bereik)
  for (const b of bands || []) {
    const top = Math.min(hi, b.to), bot = Math.max(lo, b.from);
    if (top <= bot) continue;
    g += `<rect class="band ${b.cls}" x="${L}" width="${W - R - L}" y="${Y(top)}" height="${Y(bot) - Y(top)}"/>`;
  }
  for (let i = 0; i <= 4; i++) {
    const v = lo + ((hi - lo) * i) / 4;
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(fmtTick(v, dec, unit))}</text>`;
  }
  const step = Math.ceil(xs.length / 6);
  // over meerdere jaren: maand + jaar tonen (bijv. mrt '24), anders maand-dag
  const multiYear = /^\d{4}-/.test(xs[0]) && String(xs[0]).slice(0, 4) !== String(xs[xs.length - 1]).slice(0, 4);
  const MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const xl = (x) => multiYear ? `${MND[+String(x).slice(5, 7) - 1]} '${String(x).slice(2, 4)}` : String(x).slice(5);
  if (isDate && xs.length > 1) {
    for (let k = 0; k <= 5; k++) {
      const d = new Date(t0 + ((t1 - t0) * k) / 5).toISOString().slice(0, 10);
      g += `<text x="${L + ((W - L - R) * k) / 5}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 5 ? 'end' : 'middle'}">${esc(xl(d))}</text>`;
    }
  } else xs.forEach((x, i) => { if ((i % step === 0 && i <= xs.length - step / 2) || i === xs.length - 1) g += `<text x="${X(x)}" y="${H - 6}" text-anchor="middle">${esc(xl(x))}</text>`; });
  // overlay: trainingsdagen als lichte verticale balkjes (alleen op een tijdas)
  const markDays = isDate && xs.length > 1 ? marks.filter((m) => m.x >= xs[0] && m.x <= xs[xs.length - 1]) : [];
  const dayW = Math.max(2, Math.min(10, (W - L - R) / ((t1 - t0) / 864e5 || 1)));
  // streepjes onderaan op één lijn; alleen bij meerdere activiteiten op dezelfde dag gestapeld
  const stack = {};
  for (const m of markDays) {
    const st = m.color ? ` style="fill:${m.color}"` : '';
    const n = (stack[m.x] = (stack[m.x] ?? -1) + 1);
    // in een eigen strook onder de grafiek: geen kleurvlak over de richtwaarden (goed / let op / niet goed) heen
    g += `<rect class="tmark-tick"${st} x="${X(m.x) - dayW / 2}" y="${H - B + 5 + n * 6}" width="${dayW}" height="5" rx="1"/>`;
  }
  for (const s of series) {
    const st = s.color ? ` style="stroke:${s.color}${s.dash ? ';stroke-dasharray:4 3;stroke-width:1.6;opacity:.9' : ''}"` : '';
    g += `<polyline class="${s.cls || 'la'}"${st} points="${s.points.map((q) => `${X(q.x)},${Y(q.y)}`).join(' ')}"/>`;
    if ((s.cls === 'la' || s.color) && !s.dash && xs.length <= 120) s.points.forEach((q) => { g += `<circle class="pt"${s.color ? ` style="fill:${s.color}"` : ''} cx="${X(q.x)}" cy="${Y(q.y)}" r="${s.color ? 2.4 : 3}"/>`; });
  }
  // hulplijn en markeringen voor de muis: onzichtbaar tot je over de grafiek beweegt
  g += `<line class="guide" visibility="hidden" y1="${T}" y2="${H - B}" x1="0" x2="0"/>` + series.map((s, i) => `<circle class="hl ${s.cls || 'la'}" visibility="hidden"${s.color ? ` style="stroke:${s.color}"` : ''} data-i="${i}" r="5" cx="0" cy="0"/>`).join('');
  el.innerHTML = `<div class="chartbox"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)}">${g}</svg><div class="ctip hidden"></div></div>`;

  // hover/tap: dichtstbijzijnde meetpunt tonen
  const hoverXs = [...new Set([...xs, ...markDays.map((m) => m.x)])];
  const svg = el.querySelector('svg'), tip = el.querySelector('.ctip'), guide = el.querySelector('.guide'), hls = el.querySelectorAll('.hl');
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const mx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
    let best = xs[0], bd = Infinity;
    for (const x of hoverXs) { const d = Math.abs(X(x) - mx); if (d < bd) { bd = d; best = x; } }
    const cx = X(best);
    guide.setAttribute('x1', cx); guide.setAttribute('x2', cx); guide.setAttribute('visibility', 'visible');
    let rows = '', topY = H;
    series.forEach((s, i) => {
      const q = s.points.find((p) => p.x === best);
      const c = hls[i];
      if (!q) { c.setAttribute('visibility', 'hidden'); return; }
      c.setAttribute('cx', cx); c.setAttribute('cy', Y(q.y)); c.setAttribute('visibility', 'visible'); topY = Math.min(topY, Y(q.y));
      rows += `<div class="trow"><span class="dot ${s.cls === 'lb' ? 'b' : 'a'}"${s.color ? ` style="background:${s.color}"` : ''}></span>${esc(s.label || yLabel || 'Waarde')}: <b>${q.y}${s.unit ? ' ' + esc(s.unit) : ''}</b>${q.note ? ` <span class="muted">${esc(q.note)}</span>` : ''}</div>`;
    });
    const tr = markDays.filter((m) => m.x === best);
    if (tr.length) rows += tr.map((m) => `<div class="trow"><span class="dot tm"${m.color ? ` style="background:${m.color}"` : ''}></span>${m.color ? '' : 'Getraind: '}<b>${esc(m.label)}</b></div>`).join('');
    tip.dataset.x = best;
    // gekleurde lijn bovenaan: de band (goed/let op/niet goed) of zone waar de waarde van de eerste reeks in valt
    const q0 = series[0]?.points.find((p) => p.x === best);
    const zc = q0 ? (zoneColor ? zoneColor(q0.y) : BAND_COLORS[bandOf(bands, q0.y)]) : null;
    tip.classList.toggle('zoned', !!zc); if (zc) tip.style.setProperty('--zc', zc); else tip.style.removeProperty('--zc');
    tip.innerHTML = `<div class="tdate">${esc(fmtDate(best))}</div>${rows}${tr.length && onPick ? '<div class="small muted">klik voor details</div>' : ''}`;
    tip.classList.remove('hidden');
    const px = (cx / W) * r.width, py = (topY / H) * r.height;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    // nooit over de trainingsstreepjes en de x-as: de popup blijft boven de onderkant van het grafiekvlak
    const plotBottom = ((H - B) / H) * r.height - 4;
    let left = px - tw / 2, top = py - th - 12;
    if (top < 0) {
      // geen ruimte boven het punt: naast de hulplijn, verticaal rond het punt
      top = py - th / 2;
      left = px + 14 + tw <= r.width ? px + 14 : px - tw - 14;
    }
    top = Math.min(top, plotBottom - th);
    tip.style.left = Math.min(Math.max(left, 0), r.width - tw) + 'px';
    tip.style.top = top + 'px';
  };
  const hide = () => { tip.classList.add('hidden'); guide.setAttribute('visibility', 'hidden'); hls.forEach((c) => c.setAttribute('visibility', 'hidden')); };
  svg.addEventListener('mousemove', show); svg.addEventListener('mouseleave', hide);
  if (onPick && markDays.length) {
    svg.style.cursor = 'pointer';
    svg.addEventListener('click', (ev) => { show(ev); const d = tip.dataset.x; if (d && markDays.some((m) => m.x === d)) onPick(d); });
  }
  svg.addEventListener('touchstart', show, { passive: true }); svg.addEventListener('touchmove', show, { passive: true });
}

// Staafgrafiek (SVG) voor een reeks waarden.
function barChart(el, items, { unit = '' } = {}) {
  if (!items.length) { el.innerHTML = '<div class="empty">Nog geen data</div>'; return; }
  const W = el.clientWidth || 600, H = el.clientHeight || 200, R = 10, T = 10, B = 26;
  const raw = Math.max(...items.map((i) => i.y), 1);
  const L = Math.max(44, fmtTick(raw, 0, unit).length * 6.4 + 12);
  // ronde asstappen (1, 2, 2,5 of 5 × 10^n)
  let ticks, hi;
  if (raw <= 6) { ticks = Math.ceil(raw); hi = ticks; }
  else {
    const mag = 10 ** Math.floor(Math.log10(raw / 4));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => raw / st <= 5);
    ticks = Math.ceil(raw / step); hi = ticks * step;
  }
  const bw = (W - L - R) / items.length;
  let g = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (hi * i) / ticks, y = T + (1 - v / hi) * (H - T - B);
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${esc(fmtTick(Math.round(v), 0, unit))}</text>`;
  }
  items.forEach((it, i) => {
    const h = (it.y / hi) * (H - T - B), x = L + i * bw;
    g += `<rect class="bar" x="${x + bw * 0.15}" y="${H - B - h}" width="${bw * 0.7}" height="${h}" rx="3"><title>${esc(it.x)}: ${esc(fmtTick(it.y, 0, unit))}</title></rect>`;
    if (i % Math.ceil(items.length / 8) === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(it.x.slice(5))}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
}

// ---------- plan ----------
function renderSyncStatus() {
  const m = state.meta || {};
  const s = $('#syncStatus');
  if (state.setup && !state.setup.speediance) { s.textContent = 'Speediance nog niet gekoppeld'; s.title = 'Instellingen → Speediance-account'; s.style.color = ''; return; }
  if (m.lastSyncError) { s.textContent = 'Sync-fout'; s.title = m.lastSyncError; s.style.color = 'var(--warn)'; }
  else if (m.lastSync) { s.textContent = 'Gesynct ' + new Date(m.lastSync).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }); s.style.color = ''; s.title = ''; }
  else s.textContent = 'Nog niet gesynct';
}

const pushMob = () => state?.settings?.pushMobility === 'on';
// Kleur van een advies: omhoog, omlaag of neutraal.
function noteClass(n = '') { return n.startsWith('↑') ? 'up' : n.startsWith('↓') ? 'down' : ''; }

const FOCUS_LABELS = { armen: 'Armen', borst: 'Borst', schouders: 'Schouders', bovenrug: 'Bovenrug', onderrug: 'Onderrug', core: 'Buik / core', billen: 'Billen', benen: 'Benen' };
const FOCUS_WORDS = {
  armen: ['arm', 'biceps', 'triceps'], borst: ['borst', 'pecs', 'chest'], schouders: ['schouder', 'delt'],
  bovenrug: ['bovenrug', 'rug', 'lats', 'trapez'], onderrug: ['onderrug', 'lage rug'], core: ['buik', 'core', 'abs', 'romp'],
  billen: ['bil', 'glute'], benen: ['been', 'benen', 'quad', 'hamstring', 'kuit'],
};
const setsSummary = (e) => `${e.sets.length} × ${e.sets[0]?.reps} · ${e.sets[0]?.weight} kg`;
const MAX_MUSCLE = () => Math.max(1, ...Object.values(state.plan?.muscles || {}));

// Tabblad Plan: weekoverzicht, spierkaart, trainingen en knoppen.
function renderPlan() {
  const plan = state.plan;
  const wrap = $('#sessions');
  if (!plan || state.setup?.needed) {
    $('#planTitle').textContent = 'Weekplan';
    $('#planMeta').innerHTML = state.setup?.needed ? 'Nog geen plan. Doorloop eerst de stappen op <a href="#" onclick="document.querySelector(\'.tab[data-tab=home]\').click();return false">Overzicht</a>: Speediance-account, je voorkeuren, en dan je eerste plan.' : 'Nog geen plan. Klik op “Nieuw voorstel”.';
    $('#planOverview').innerHTML = ''; wrap.innerHTML = ''; return;
  }
  $('#planTitle').textContent = `Week ${planIso(plan).w} · ${planIso(plan).y}`;
  const nDone = plan.sessions.filter((x) => !x.outdoor && doneOf(x)).length, nGym = plan.sessions.filter((x) => !x.outdoor).length;
  $('#planMeta').innerHTML = `${GOAL[plan.goal] || plan.goal} · ${plan.daysPerWeek}× per week · bron: ${esc(plan.source)}` + (plan.deload ? ' · <span class="badge warn">deload-week</span>' : '')
    + (nDone ? ` · <span class="badge ok">${nDone} van ${nGym} gedaan${nDone >= nGym ? ' — week compleet 💪' : ''}</span>` : '');

  renderWeekMap();

  wrap.innerHTML = plan.sessions.map((s) => s.outdoor ? `
    <article class="card session outdoor" data-key="${esc(s.key)}">
      <header><div><h3>${esc(s.name)}</h3><div class="muted small">~${s.estMinutes} min · <span class="badge">${esc(DAY_SHORT.buiten)}</span></div></div>
        <div class="out-ico" aria-hidden="true">🚶‍♂️🚴</div></header>
      <p class="small">${esc(s.advice || '')}</p>
      ${outdoorDone(s)}
      <p class="muted small">Geen programma voor de Gym Monster. Je wandel- of fietsrit komt binnen via Apple Health (Instellingen → Apple Health).</p>
    </article>` : `
    <article class="card session${doneOf(s) ? ' done' : ''}" data-key="${esc(s.key)}">
      <header><div><h3>${esc(s.name)}${s.locked ? ` <span class="badge lock-on" title="${t('ed.locked')}">🔒 ${t('ed.badgeLocked')}</span>` : ''}${s.edited ? ` <span class="badge">${t('ed.badgeEdited')}</span>` : ''}${s.custom ? ` <span class="badge custom">${t('ed.badgeCustom')}</span>` : ''}</h3><div class="muted small">~${s.estMinutes} min · ${s.exercises.length} oefeningen${s.type && s.type !== 'eigen' && plan.goal === 'gemengd' ? ` · <span class="badge">${esc(DAY_SHORT[s.type] || s.type)}</span>` : s.type === 'circuit' ? ' · <span class="badge">cardio-circuit</span>' : ''} ${doneOf(s) ? '' : s.pushedAt ? '· <span class="badge ok">op toestel</span>' : s.changedAfterPush ? '· <span class="badge warn">gewijzigd, opnieuw op toestel zetten</span>' : ''}</div></div>
        <div class="mini-map">${bodyMap(s.muscles || {}, { height: 92, labels: false, title: s.name })}</div></header>
      ${s.warmup && (s.warmup.mobility.length + s.warmup.cable.length) ? `<button class="row-item wc" data-open="warm"><span class="ri-dot warm"></span><span class="ri-name">Warming-up</span><span class="ri-sum">${s.warmup.mobility.length + s.warmup.cable.length} oef. · ~6 min</span><span class="ri-chev" aria-hidden="true">›</span></button>` : ''}
      ${s.exercises.map((e, i) => `
        <button class="row-item${exDone(s, e) ? ' ex-done' : ''}" data-open="ex" data-i="${i}">
          ${exDone(s, e) ? '<span class="ri-check" title="gedaan">✓</span>' : `<span class="ri-dot ${e.focus ? 'focus' : ''}" title="${e.focus ? 'focus deze week' : ''}"></span>`}
          <span class="ri-name">${e.group ? `<span class="badge ss">${e.group}${s.exercises.slice(0, i + 1).filter((x) => x.group === e.group).length}</span> ` : ''}${esc(e.title)}</span>
          <span class="ri-sum">${setsSummary(e)}${/^↑/.test(e.note || '') ? ' <span class="up">↑</span>' : /^↓/.test(e.note || '') ? ' <span class="down">↓</span>' : ''}</span>
          <span class="ri-chev" aria-hidden="true">›</span>
        </button>`).join('')}
      ${s.cooldown?.length ? `<button class="row-item wc" data-open="cool"><span class="ri-dot cool"></span><span class="ri-name">Cooldown</span><span class="ri-sum">${s.cooldown.length} stretches · ~${coolMin(s.cooldown)} min</span><span class="ri-chev" aria-hidden="true">›</span></button>` : ''}
      ${doneBanner(s)}
      <footer>${doneOf(s) ? `
        <button class="btn accent" data-act="view">Bekijk training</button>
        <button class="btn ghost" data-act="edit">${t('ed.edit')}</button>
        <button class="btn ghost" data-act="lock" title="${s.locked ? t('ed.unlockHint') : t('ed.lockHint')}">${s.locked ? t('ed.unlock') : t('ed.lock')}</button>
        ${s.edited ? `<button class="btn ghost" data-act="revert">${t('ed.reset')}</button>` : ''}
        <button class="btn ghost" data-act="push">Opnieuw op toestel</button>` : `
        <button class="btn ghost" data-act="edit">${t('ed.edit')}</button>
        <button class="btn ghost" data-act="lock" title="${s.locked ? t('ed.unlockHint') : t('ed.lockHint')}">${s.locked ? t('ed.unlock') : t('ed.lock')}</button>
        ${s.edited ? `<button class="btn ghost" data-act="revert">${t('ed.reset')}</button>` : ''}
        ${s.custom ? `<button class="btn ghost" data-act="remove">${t('ed.removeFromPlan')}</button>` : ''}
        ${state.settings.ai?.provider && state.settings.ai.provider !== 'none' ? `<button class="btn ghost" data-act="coach" title="Laat de AI-coach naar deze training kijken; jij kiest wat je overneemt">AI-advies</button>` : ''}
        <button class="btn ghost" data-act="dry">Controleer</button>
        <button class="btn accent" data-act="push">Zet op Gym Monster</button>`}
      </footer>
    </article>`).join('');
  highlightSessions();
}

// training uit het plan die deze week al gedaan is
const normName = (x) => String(x || '').toLowerCase().replace(/[（(].*?[)）]/g, '').replace(/[^a-z0-9]+/g, '');
const doneOf = (s) => state.planDone?.[s.key] || null;
const exDone = (s, e) => { const d = doneOf(s); return !!(d && (d.exercises ? d.exercises.includes(normName(e.title)) : true)); };
// Groene balk "Gedaan" bij een training die deze week al is gedaan.
function doneBanner(s) {
  const d = doneOf(s); if (!d) return '';
  const day = new Date(d.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  const facts = [d.minutes ? `${d.minutes} min` : null, d.volume ? `${d.volume.toLocaleString('nl-NL')} kg` : null, d.kcal ? `${d.kcal} kcal` : null].filter(Boolean).join(' · ');
  return `<div class="done-banner"><span class="done-check">✓</span><div><b>Gedaan op ${esc(day)}</b>${facts ? `<div class="small">${esc(facts)}</div>` : ''}</div></div>`;
}

// cardio buiten: laat zien wat er deze week al via Apple Health binnenkwam
function outdoorDone() {
  const acts = (state.activities || []).filter((a) => a.date >= periodStart('week') && ['wandelen', 'fietsen', 'hardlopen', 'wandeltocht'].includes(a.type));
  if (!acts.length) return '<p class="muted small">Deze week nog geen wandel- of fietsactiviteit binnengekomen.</p>';
  const min = acts.reduce((t, a) => t + (a.minutes || 0), 0), km = acts.reduce((t, a) => t + (a.km || 0), 0);
  return `<p class="small"><span class="badge ok">deze week</span> ${acts.length}× · ${min} min${km ? ` · ${(Math.round(km * 10) / 10).toLocaleString('nl-NL')} km` : ''}</p>`;
}

let selMuscle = null;
// Spierkaart en sets per spiergroep van het weekplan (klikbaar per spiergroep).
function renderWeekMap() {
  const plan = state.plan;
  if (!plan) return;
  const top = Object.entries(plan.muscles || {}).sort((a, b) => b[1] - a[1]);
  if (selMuscle && !plan.muscles?.[selMuscle]) selMuscle = null;
  let detail = '';
  if (selMuscle) {
    const rows = [];
    for (const s of plan.sessions) s.exercises.forEach((e, i) => {
      const w = e.muscles?.[selMuscle];
      if (w) rows.push(`<li><button class="linklike" data-jump="${esc(s.key)}|${i}"><b>${esc(s.name)}</b> · ${esc(e.title)}</button> <span class="muted">(${e.sets.length} sets${w < 1 ? ', secundair' : ''})</span></li>`);
    });
    detail = `<div class="msel"><div class="row between"><b>${esc(MUSCLE_LABELS[selMuscle])}: ${Math.round(plan.muscles[selMuscle] * 10) / 10} sets deze week</b><button class="btn small ghost" data-clear>Alles tonen</button></div><ul>${rows.join('')}</ul></div>`;
  }
  $('#planOverview').innerHTML = `<div class="card week-map">
    <div class="wm-fig">${bodyMap(plan.muscles || {}, { height: 340, title: 'Spiergroepen deze week', selected: selMuscle })}
      <div class="muted small" style="text-align:center">Klik op een spiergroep in de lijst of het figuur</div></div>
    <div class="wm-info">
      <div class="eyebrow">Deze week</div>
      ${plan.focus?.length ? `<div class="chips-inline">${plan.focus.map((f) => `<span class="chip on">${esc(FOCUS_LABELS[f] || f)}</span>`).join('')}</div>` : '<div class="muted small">Geen focus gekozen: evenwichtig schema.</div>'}
      ${plan.wish ? `<div class="wish">“${esc(plan.wish)}”</div>` : ''}
      <div class="eyebrow" style="margin-top:.8rem">Sets per spiergroep (incl. secundair)</div>
      <div class="mbars">${top.map(([k, v]) => `<button class="mbar ${selMuscle === k ? 'on' : selMuscle ? 'off' : ''}" data-m="${k}" aria-pressed="${selMuscle === k}"><span>${esc(MUSCLE_LABELS[k] || k)}</span><div class="ht"><div class="hf" style="width:${(v / top[0][1]) * 100}%"></div></div><b>${Math.round(v * 10) / 10}</b></button>`).join('')}</div>
      ${detail}
      <div class="legend"><span class="sq m1"></span>licht <span class="sq m2"></span>gemiddeld <span class="sq m3"></span>veel</div>
    </div></div>`;
  highlightSessions();
}

// gekozen spiergroep ook in de trainingskaarten uitlichten (primair sterk, secundair licht, rest gedimd)
function highlightSessions() {
  const plan = state.plan; if (!plan) return;
  document.querySelectorAll('#sessions .session').forEach((card) => {
    const s = plan.sessions.find((x) => x.key === card.dataset.key); if (!s) return;
    let sets = 0;
    card.querySelectorAll('.row-item').forEach((row) => {
      row.classList.remove('mh-primary', 'mh-secondary', 'mh-dim');
      row.querySelector('.mh-tag')?.remove();
      if (!selMuscle) return;
      const e = row.dataset.open === 'ex' ? s.exercises[+row.dataset.i] : null;
      const w = e?.muscles?.[selMuscle] || 0;
      if (!w) { row.classList.add('mh-dim'); return; }
      sets += e.sets.length * w;
      row.classList.add(w >= 1 ? 'mh-primary' : 'mh-secondary');
      row.querySelector('.ri-name').insertAdjacentHTML('beforeend', ` <span class="mh-tag">${w >= 1 ? 'primair' : 'secundair'}</span>`);
    });
    const mm = card.querySelector('.mini-map');
    if (mm) mm.innerHTML = bodyMap(s.muscles || {}, { height: 92, labels: false, title: s.name, selected: selMuscle });
    card.querySelector('.mh-sum')?.remove();
    card.classList.toggle('mh-none', !!selMuscle && sets === 0);
    if (selMuscle) card.querySelector('header > div').insertAdjacentHTML('beforeend', `<div class="mh-sum small">${sets ? `${Math.round(sets * 10) / 10} sets ${esc((MUSCLE_LABELS[selMuscle] || selMuscle).toLowerCase())}` : `geen ${esc((MUSCLE_LABELS[selMuscle] || selMuscle).toLowerCase())}`}</div>`);
  });
}
$('#planOverview').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-clear]')) { selMuscle = null; renderWeekMap(); return; }
  const j = ev.target.closest('[data-jump]');
  if (j) {
    const [key, i] = j.dataset.jump.split('|');
    const row = document.querySelector(`#sessions .session[data-key="${CSS.escape(key)}"] .row-item[data-open="ex"][data-i="${i}"]`);
    if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.remove('mh-flash'); void row.offsetWidth; row.classList.add('mh-flash'); }
    return;
  }
  const t = ev.target.closest('[data-m]'); if (!t) return;
  const m = t.dataset.m;
  if (!state.plan?.muscles?.[m]) return;
  selMuscle = selMuscle === m ? null : m;
  renderWeekMap();
});

// ---------- programma's op het toestel ----------
let programs = null;
// Haalt de programma's op het toestel op.
async function loadPrograms(btn) {
  const box = $('#programsBox');
  box.innerHTML = '<span class="muted">Programma’s ophalen bij Speediance…</span>';
  try { programs = (await api('GET', '/api/programs')).programs; renderPrograms(); }
  catch (e) { box.innerHTML = `<span class="down">${esc(e.message)}</span>`; }
}
// Lijst met programma's op het toestel, met opruimen van oude GymCoach-programma's.
function renderPrograms() {
  const box = $('#programsBox');
  if (!programs.length) { box.innerHTML = '<span class="muted">Geen eigen programma’s gevonden op je account.</span>'; return; }
  const cur = state.plan ? `GC ${planLabel(state.plan)} ` : null;
  box.innerHTML = `<div class="row between wrap gap"><span class="muted">${programs.length} programma’s · ${programs.filter((p) => p.gymcoach).length} van GymCoach</span>
    <div class="row gap wrap"><button class="btn small ghost" data-p="old">Selecteer oude GymCoach-programma’s</button><button class="btn small ghost" data-p="none">Niets selecteren</button></div></div>
    <div class="tablewrap"><table class="progtable"><thead><tr><th></th><th>Naam</th><th>Aangemaakt</th><th class="num">Oefeningen</th></tr></thead><tbody>
    ${programs.map((p) => `<tr><td><input type="checkbox" class="pchk" value="${esc(p.id)}" aria-label="Selecteer ${esc(p.name)}"></td>
      <td>${esc(p.name)} ${p.gymcoach ? `<span class="badge ${cur && p.name.startsWith(cur) ? 'ok' : ''}">${cur && p.name.startsWith(cur) ? 'huidige week' : 'GymCoach'}</span>` : ''}</td>
      <td class="muted">${p.created ? esc(new Date(p.created).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })) : '—'}</td>
      <td class="num">${p.exercises ?? '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="row gap end" style="margin-top:.6rem"><button class="btn danger" data-p="del">Verwijder geselecteerde</button></div>`;
}
$('#programsBox').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-p]'); if (!b) return;
  const cur = state.plan ? `GC ${planLabel(state.plan)} ` : '\u0000';
  const boxes = [...document.querySelectorAll('.pchk')];
  if (b.dataset.p === 'old') boxes.forEach((c) => { const p = programs.find((x) => String(x.id) === c.value); c.checked = !!p?.gymcoach && !p.name.startsWith(cur); });
  if (b.dataset.p === 'none') boxes.forEach((c) => { c.checked = false; });
  if (b.dataset.p === 'del') {
    const ids = boxes.filter((c) => c.checked).map((c) => c.value);
    if (!ids.length) { toast('Selecteer eerst één of meer programma’s', true); return; }
    const names = programs.filter((p) => ids.includes(String(p.id))).map((p) => '• ' + p.name);
    if (!confirm(`Deze ${ids.length} programma’s definitief van je Speediance-account verwijderen?\n\n${names.slice(0, 15).join('\n')}${names.length > 15 ? `\n… en nog ${names.length - 15}` : ''}\n\nDit kan niet ongedaan worden gemaakt.`)) return;
    await busy(b, async () => {
      const r = await api('POST', '/api/programs/delete', { ids });
      toast(`${r.done.length} verwijderd${r.failed.length ? `, ${r.failed.length} mislukt: ${r.failed[0].error}` : ''}`, r.failed.length > 0);
      await loadPrograms();
    });
  }
});
$('#programsLoad').addEventListener('click', (ev) => busy(ev.currentTarget, () => loadPrograms()));

let saveTimer;
// Bewaart het plan kort na een wijziging (debounce).
function savePlanSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { state.plan = (await api('PUT', '/api/plan', state.plan)).plan; renderPlan(); toast('Opgeslagen'); } catch (e) { toast(e.message, true); }
  }, 300);
}

$('#sessions').addEventListener('click', async (ev) => {
  const card = ev.target.closest('.session'); if (!card) return;
  const session = state.plan.sessions.find((s) => s.key === card.dataset.key);
  const open = ev.target.closest('[data-open]');
  if (open) {
    if (open.dataset.open === 'ex') openExercise(session, +open.dataset.i);
    else openWarmCool(session, open.dataset.open);
    return;
  }
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === 'view') { const d = doneOf(session); if (d) openWorkouts([d.id]); return; }
  if (act === 'coach') { coachRequest(btn, { session: session.key }); return; }
  if (act === 'remove') {
    if (!confirm(t('ed.removeFromPlanConfirm', { name: session.name }))) return;
    try { state.plan = (await api('DELETE', '/api/plan/session?key=' + encodeURIComponent(session.key))).plan; renderPlan(); } catch (e) { toast(e.message, true); }
    return;
  }
  if (act === 'lock' || act === 'revert') {
    if (act === 'revert' && !confirm(t('ed.resetConfirm'))) return;
    const p = JSON.parse(JSON.stringify(state.plan));
    const i = p.sessions.findIndex((x) => x.key === session.key);
    if (act === 'lock') p.sessions[i].locked = !p.sessions[i].locked;
    else {
      const o = p.sessions[i].original; if (!o) return;
      const was = p.sessions[i];
      p.sessions[i] = { ...o, locked: false };
      if (was.pushedAt || was.changedAfterPush) p.sessions[i].changedAfterPush = true;
    }
    try { state.plan = (await api('PUT', '/api/plan', p)).plan; renderPlan(); toast(act === 'lock' ? (state.plan.sessions[i].locked ? t('ed.lockedToast') : t('ed.unlockedToast')) : t('ed.revertedToast')); } catch (e) { toast(e.message, true); }
    return;
  }
  if (act === 'edit') {
    openEditor(session.key, edCtx());
    return;
  }
  if (act === 'push' && !confirm(`“${progName(state.plan, session)}” als programma op je Gym Monster zetten?`)) return;
  await busy(btn, async () => {
    const r = await api('POST', '/api/plan/push', { sessionKey: session.key, dryRun: act === 'dry' });
    if (act === 'dry') toast(`Controle ok: ${r.plan.exercises.length} oefeningen, ${r.plan.exercises.reduce((n, e) => n + e.sets.length, 0)} sets`);
    else { toast(`Op je Gym Monster gezet: ${r.plan.name}`); await load(); }
  });
});

// ---------- detailpopup per oefening ----------
function openExercise(session, i) {
  const e = session.exercises[i];
  const dlg = $('#exDlg');
  const muscles = Object.entries(e.muscles || {}).length ? e.muscles : null;
  const sc = {};
  // spiergroepen van deze oefening (zelfde logica als de server)
  const PM = { squat: { quads: 1, glutes: .5, adductors: .5 }, hinge: { hamstrings: 1, glutes: 1, lowerBack: .5 }, hpush: { pecs: 1, frontDelts: .5, triceps: .5 }, hpull: { lats: 1, traps: .5, rearDelts: .5, biceps: .5 }, vpull: { lats: 1, biceps: .5 }, vpush: { frontDelts: 1, sideDelts: .5, triceps: .5 }, lunge: { quads: 1, glutes: 1, adductors: .5 }, glute: { glutes: 1, hamstrings: .5 }, lat: { sideDelts: 1 }, rear: { rearDelts: 1, traps: .5 }, curl: { biceps: 1, forearms: .5 }, tri: { triceps: 1 }, core: { abs: 1 }, calf: { calves: 1 } };
  Object.assign(sc, muscles || PM[e.pattern] || {});
  const ramp = e.rampUp ? Math.max(0.5, Math.round(e.sets[0]?.weight || 0) / 2) : null;
  dlg.innerHTML = `<form method="dialog" class="exd">
    <div class="exd-head">
      <div><div class="eyebrow">${esc(session.name)} · ${esc(e.patternLabel)}${e.focus ? ' · <span class="accent-text">focus</span>' : ''}</div><h2>${esc(e.title)}</h2>
        <div class="muted small">${esc(e.muscle || '')} · ${e.type === 'compound' ? 'samengestelde oefening' : 'isolatieoefening'} · doel ${e.repRange[0]}–${e.repRange[1]} herhalingen</div></div>
      <button value="close" class="btn ghost small" aria-label="Sluiten">✕</button>
    </div>
    <div class="exd-body">
      <div class="exd-map">${bodyMap(sc, { height: 170, title: 'Spieren in deze oefening' })}<div class="muted small" style="text-align:center">${Object.keys(sc).map((k) => esc(MUSCLE_LABELS[k] || k)).join(' · ')}</div></div>
      <div class="exd-main">
        <div class="note ${noteClass(e.note)}"><b>Advies:</b> ${esc(e.note || '—')}</div>
        ${e.basis ? `<div class="muted small">Vorige keer: ${esc(e.basis)}</div>` : '<div class="muted small">Nog geen historie voor deze oefening.</div>'}
        ${ramp ? `<div class="small">Begint met een opwarmset: 8 × ${ramp} kg</div>` : ''}
        ${e.restNote ? `<div class="muted small">${esc(e.restNote)}</div>` : ''}${e.volumeNote ? `<div class="muted small">${esc(e.volumeNote)}</div>` : ''}
        <div class="rx" style="margin-top:.6rem">
          <label>Sets<input type="number" min="1" max="6" data-f="sets" value="${e.sets.length}"></label>
          <label>Herh.<input type="number" min="1" max="30" data-f="reps" value="${e.sets[0]?.reps}"></label>
          <label>kg<input type="number" min="0.5" step="0.5" data-f="weight" value="${e.sets[0]?.weight}"></label>
          <label>Rust s<input type="number" min="10" step="5" data-f="rest" value="${e.sets[0]?.rest}"></label>
        </div>
        <table class="settable"><thead><tr><th>Set</th><th class="num">Herh.</th><th class="num">kg</th><th class="num">Rust</th></tr></thead><tbody>
          ${ramp ? `<tr class="muted"><td>opwarm</td><td class="num">8</td><td class="num">${ramp}</td><td class="num">45 s</td></tr>` : ''}
          ${e.sets.map((x, n) => `<tr><td>${n + 1}</td><td class="num">${x.reps}</td><td class="num">${x.weight}</td><td class="num">${x.rest} s</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="row gap wrap end">
      <button type="button" class="btn ghost" data-x="avoid">Niet meer voorstellen</button>
      <button type="button" class="btn ghost" data-x="swap">Wissel oefening</button>
      <button value="close" class="btn accent">Klaar</button>
    </div></form>`;
  dlg.querySelectorAll('input[data-f]').forEach((inp) => inp.addEventListener('change', () => {
    const f = inp.dataset.f, v = +inp.value, tmpl = e.sets[0];
    if (f === 'sets') e.sets = Array.from({ length: Math.max(1, Math.min(6, v)) }, () => ({ ...tmpl }));
    else e.sets.forEach((x) => { x[f] = v; });
    e.note = 'Handmatig aangepast';
    savePlanSoon();
    openExercise(session, i);
  }));
  dlg.querySelector('[data-x=swap]').addEventListener('click', () => { dlg.close(); openSwap(e); });
  dlg.querySelector('[data-x=avoid]').addEventListener('click', async () => {
    if (!confirm(`“${e.title}” niet meer voorstellen?`)) return;
    dlg.close();
    try { state.plan = (await api('POST', '/api/avoid', { id: e.id })).plan; renderPlan(); } catch (er) { toast(er.message, true); }
  });
  if (!dlg.open) dlg.showModal();
}

// cooldown-duur: seconden per stretch (× 2 bij "per kant") plus wisseltijd
const coolMin = (list) => Math.max(1, Math.round((list || []).reduce((t, c) => {
  const sec = +(/(\d+)\s*s\b/i.exec(c.dose || '') || [0, 30])[1];
  return t + sec * (/per (kant|been|arm)/i.test(c.dose || '') ? 2 : 1) + 10;
}, 0) / 60));
// Venster met de warming-up of cooldown van een training.
function openWarmCool(session, which) {
  const dlg = $('#exDlg');
  const items = which === 'warm'
    ? [...session.warmup.mobility.map((m) => ({ t: m.title, d: m.dose, dev: pushMob() })), ...session.warmup.cable.map((c) => ({ t: c.title, d: `2 × ${c.reps} @ ${c.weight} kg`, dev: true }))]
    : session.cooldown.map((c) => ({ t: c.title, d: c.dose, dev: pushMob() }));
  dlg.innerHTML = `<form method="dialog" class="exd">
    <div class="exd-head"><div><div class="eyebrow">${esc(session.name)}</div><h2>${which === 'warm' ? 'Warming-up (~6 min)' : `Cooldown (~${coolMin(session.cooldown)} min)`}</h2></div><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
    <table class="settable"><thead><tr><th>Oefening</th><th>Dosering</th><th>Op toestel</th></tr></thead><tbody>
      ${items.map((x) => `<tr><td>${esc(x.t)}</td><td>${esc(x.d)}</td><td>${x.dev ? (/per (kant|been|arm)/i.test(x.d || '') ? 'ja, 2 sets (links + rechts)' : 'ja') : '<span class="muted">alleen dashboard</span>'}</td></tr>`).join('')}
    </tbody></table>
    ${which === 'warm' ? '<p class="muted small">Daarna start de eerste zware oefening met een opwarmset op ~50%.</p>' : '<p class="muted small">Rustig ademen, niet verend stretchen.</p>'}
    <div class="row end"><button value="close" class="btn accent">Klaar</button></div></form>`;
  dlg.showModal();
}

// Venster om een oefening te wisselen voor een andere voor dezelfde spiergroep.
async function openSwap(ex) {
  const dlg = $('#swapDlg');
  $('#swapTitle').textContent = `${ex.patternLabel}: ${ex.title}`;
  const { items } = await api('GET', '/api/alternatives?muscle=' + encodeURIComponent(ex.muscle || ''));
  $('#swapSelect').innerHTML = items.map((i) => `<option value="${i.id}" ${+i.id === +ex.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('');
  dlg.returnValue = '';
  dlg.showModal();
  dlg.onclose = async () => {
    if (dlg.returnValue === 'ok' || dlg.returnValue === 'reset') {
      try {
        const id = dlg.returnValue === 'reset' ? null : $('#swapSelect').value;
        state.plan = (await api('POST', '/api/swap', { pattern: ex.pattern, variant: ex.variant, id })).plan;
        renderPlan(); toast('Plan bijgewerkt');
      } catch (e) { toast(e.message, true); }
    }
  };
}

// ---------- nieuw plan met voorkeuren ----------
function openGenerate() {
  const dlg = $('#genDlg');
  const cur = new Set(state.plan?.focus || []);
  const aiOn = state.settings.ai?.provider && state.settings.ai.provider !== 'none';
  dlg.innerHTML = `<form method="dialog" class="exd" id="genForm">
    <div class="exd-head"><div><div class="eyebrow">Nieuw weekplan</div><h2>Hoe ziet je week eruit?</h2></div><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
    ${(() => { const l = (state.plan?.sessions || []).filter((x) => x.locked); return l.length ? `<div class="note">🔒 Vastgezet en blijft staan: <b>${l.map((x) => esc(x.name)).join(', ')}</b>. Gewichten schuiven mee met je progressie (behalve bij vast gewicht).</div>` : ''; })()}
    <div class="eyebrow" style="margin:0">Trainingsdagen</div>
    <div class="presets row gap wrap">
      <button type="button" class="btn small ghost" data-pre="same">Alles ${esc(DAY_SHORT[state.settings.goal] || 'combinatie')}</button>
      <button type="button" class="btn small ghost" data-pre="2k1c">2× kracht + 1× cardio-circuit</button>
      <button type="button" class="btn small ghost" data-pre="2k1b">2× kracht + 1× buiten</button>
      <button type="button" class="btn small ghost" data-pre="3k1b">3× kracht + 1× buiten</button>
    </div>
    <div id="dayList" class="day-list"></div>
    <div class="row gap"><button type="button" class="btn small ghost" data-x="addday">+ Dag</button><span class="muted small" id="dayNote"></span></div>
    <div class="eyebrow" style="margin:.4rem 0 0">Focus deze week</div>
    <div class="focus-chips">${Object.entries(FOCUS_LABELS).map(([k, l]) => `<label class="chip-check"><input type="checkbox" name="focus" value="${k}" ${cur.has(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <label>Je wens in eigen woorden (optioneel)
      <textarea name="wish" rows="3" placeholder="Bijv. Ik wil komende week meer focussen op armen, borst, schouders en bovenrug">${esc(state.plan?.wish || '')}</textarea>
      <span class="muted small">Herkende spiergroepen worden hierboven automatisch aangevinkt.</span>
    </label>
    ${aiOn ? '<label class="chip-check wide"><input type="checkbox" name="coach" checked><span>Laat de AI-coach het plan daarna nog nalopen</span></label>' : ''}
    <p class="muted small">Focusgebieden krijgen voorrang, een extra set en zo nodig een extra oefening. Andere spiergroepen worden licht onderhouden.</p>
    <div class="row gap end">
      <button type="button" class="btn ghost" data-x="clear">Geen focus</button>
      <button value="ok" class="btn accent">Maak plan</button>
    </div></form>`;
  const f = dlg.querySelector('#genForm');
  // dagen: start met het vorige plan, anders met de instellingen
  let days = (state.plan?.dayTypes?.length ? [...state.plan.dayTypes] : Array.from({ length: +state.settings.daysPerWeek || 3 }, () => state.settings.goal || 'combinatie'));
  const drawDays = () => {
    $('#dayList').innerHTML = days.map((t, i) => `<div class="day-row"><span class="day-n">Dag ${i + 1}</span>
      <select data-d="${i}" aria-label="Soort training dag ${i + 1}">${Object.entries(DAY_TYPES).map(([k, l]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="btn small ghost" data-del="${i}" aria-label="Dag ${i + 1} verwijderen" ${days.length <= 1 ? 'disabled' : ''}>✕</button></div>`).join('');
    const nK = days.filter((t) => !['circuit', 'buiten'].includes(t)).length;
    $('#dayNote').textContent = `${nK}× kracht${days.length - nK ? ` · ${days.length - nK}× cardio` : ''}${nK ? ` → ${nK === 1 ? 'full body' : nK <= 3 ? 'full body A/B' + (nK === 3 ? '/C' : '') : 'upper/lower'}` : ''}`;
  };
  drawDays();
  $('#dayList').addEventListener('change', (ev) => { const sel = ev.target.closest('[data-d]'); if (sel) { days[+sel.dataset.d] = sel.value; drawDays(); } });
  $('#dayList').addEventListener('click', (ev) => { const b = ev.target.closest('[data-del]'); if (b && days.length > 1) { days.splice(+b.dataset.del, 1); drawDays(); } });
  f.querySelector('[data-x=addday]').addEventListener('click', () => { if (days.length < 6) { days.push(days[days.length - 1] || 'combinatie'); drawDays(); } });
  f.querySelector('.presets').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pre]'); if (!b) return;
    const k = ['spieropbouw', 'afvallen'].includes(state.settings.goal) ? state.settings.goal : 'combinatie';
    days = { same: Array.from({ length: +state.settings.daysPerWeek || 3 }, () => state.settings.goal || 'combinatie'), '2k1c': [k, 'circuit', k], '2k1b': [k, 'buiten', k], '3k1b': [k, k, 'buiten', k] }[b.dataset.pre];
    drawDays();
  });
  f.wish.addEventListener('input', () => {
    const t = f.wish.value.toLowerCase();
    for (const [k, words] of Object.entries(FOCUS_WORDS)) if (words.some((w) => t.includes(w))) f.querySelector(`input[value="${k}"]`).checked = true;
  });
  dlg.querySelector('[data-x=clear]').addEventListener('click', () => { f.querySelectorAll('input[name=focus]').forEach((c) => { c.checked = false; }); f.wish.value = ''; });
  dlg.returnValue = '';
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'ok') return;
    const focus = [...f.querySelectorAll('input[name=focus]:checked')].map((c) => c.value);
    const btn = $('#genBtn'); btn.disabled = true;
    try {
      state.plan = (await api('POST', '/api/plan/generate', { focus, wish: f.wish.value.trim(), dayTypes: days })).plan;
      if (state.meta) state.meta.coach = null; renderCoach(null);
      renderPlan(); toast(focus.length ? `Plan gemaakt met focus op ${focus.map((x) => FOCUS_LABELS[x]).join(', ')}` : 'Nieuw evenwichtig plan gemaakt');
      if (f.coach?.checked) $('#coachBtn').click();
    } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  };
  dlg.showModal();
}
$('#genBtn').addEventListener('click', () => {
  if (state.plan?.source?.includes('AI') && !confirm('Huidig plan (met AI-aanpassingen) vervangen door een nieuw voorstel?')) return;
  openGenerate();
});

// Vraag de AI-coach om advies: voor het hele plan, of met { session } voor één training.
function coachRequest(btn, payload = {}) {
  return busy(btn, async () => {
    const p = $('#coachPanel');
    p.classList.remove('hidden'); p.innerHTML = '<span class="muted">Coach denkt na…</span>';
    p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try { const c = await api('POST', '/api/coach', payload); if (state.meta) state.meta.coach = c; renderCoach(c); }
    catch (e) { p.innerHTML = `<span class="muted">${esc(e.message)}</span>`; throw e; }
  });
}
$('#coachBtn').addEventListener('click', (ev) => coachRequest(ev.currentTarget));

// Paneel met het advies van de AI-coach en de voorgestelde aanpassingen.
function renderCoach(c) {
  const p = $('#coachPanel');
  if (!c) { p.classList.add('hidden'); p.innerHTML = ''; return; }
  p.classList.remove('hidden');
  // al afgehandeld: alleen een korte regel, het advies is nog terug te lezen
  if (c.done) {
    const when = new Date(c.doneAt || c.at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    p.innerHTML = `<div class="row between wrap gap"><div class="small"><b>AI-coach</b> · ${c.done === 'applied' ? `advies toegepast (${c.applied} ${c.applied === 1 ? 'aanpassing' : 'aanpassingen'})` : 'advies genegeerd'} op ${esc(when)}</div>
      <button type="button" class="btn ghost small" id="coachShow">Toon advies</button></div><div class="advice hidden" id="coachText" style="margin-top:.6rem">${esc(c.advice)}</div>`;
    p.classList.add('coach-done');
    $('#coachShow').addEventListener('click', (ev) => { const t = $('#coachText'); t.classList.toggle('hidden'); ev.currentTarget.textContent = t.classList.contains('hidden') ? 'Toon advies' : 'Verberg advies'; });
    return;
  }
  p.classList.remove('coach-done');
  // voorstellen voor je eigen (bewerkte, vastgezette of zelf gemaakte) trainingen staan standaard uit: jij kiest
  p.innerHTML = `<h2>AI-coach${c.sessionName ? ` · ${esc(c.sessionName)}` : ''} <span class="muted">(${esc(c.provider)} · ${esc(c.model)})</span></h2>
    <div class="advice">${esc(c.advice)}</div>
    ${c.adjustments?.some((a) => a.own) ? '<p class="muted small" style="margin:.5rem 0 0">Voorstellen voor je eigen trainingen staan uit; vink aan wat je wilt overnemen. De opbouw (volgorde, supersets, modi, rust) blijft staan.</p>' : ''}
    ${c.adjustments?.length ? `<div style="margin-top:.75rem">${c.adjustments.map((a, i) => `
      <label class="adj"><input type="checkbox" data-i="${i}"${a.own ? '' : ' checked'}>
        <span><b>${esc(a.sessionName || a.session)} · ${esc(a.title)}</b>${a.own ? ' <span class="badge custom">eigen opbouw</span>' : ''}: ${[a.swapToId && 'wissel oefening', a.sets && a.sets + ' sets', a.reps && a.reps + ' herh.', a.weight && a.weight + ' kg'].filter(Boolean).join(', ')}<br><span class="muted">${esc(a.reason)}</span></span></label>`).join('')}
      <div class="row gap" style="margin-top:.6rem"><button class="btn accent" id="applyBtn">Geselecteerde toepassen</button><button class="btn ghost" id="dismissBtn">Negeren</button></div></div>` : '<p class="muted">Geen aanpassingen voorgesteld.</p><button class="btn ghost small" id="dismissBtn">Sluiten</button>'}`;
  $('#applyBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    const chosen = [...p.querySelectorAll('input[type=checkbox]:checked')].map((x) => c.adjustments[+x.dataset.i]);
    const r = await api('POST', '/api/coach/apply', { adjustments: chosen });
    state.plan = r.plan; state.meta.coach = r.coach; renderPlan(); renderCoach(r.coach); toast(`${r.applied} aanpassing(en) toegepast`);
  }));
  $('#dismissBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    const r = await api('POST', '/api/coach/dismiss'); state.meta.coach = r.coach; renderCoach(r.coach);
  }));
}


// ---------- overzicht ----------
function spark(values, { w = 120, h = 32, cls = 'sp' } = {}) {
  if (!values || values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), r = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - lo) / r) * (h - 6)}`).join(' ');
  const last = pts.split(' ').pop().split(',');
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6"/></svg>`;
}
// Voortgangsring (SVG), bijv. trainingen deze week.
function ring(done, target) {
  const R = 52, C = 2 * Math.PI * R, f = Math.min(1, target ? done / target : 0);
  return `<svg viewBox="0 0 130 130" class="ring" role="img" aria-label="${done} van ${target}">
    <circle cx="65" cy="65" r="${R}" class="ring-bg"/>
    <circle cx="65" cy="65" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 65 65)"/>
    <text x="65" y="63" text-anchor="middle" class="ring-num">${done}<tspan class="ring-of">/${target}</tspan></text>
    <text x="65" y="84" text-anchor="middle" class="ring-lbl">deze week</text></svg>`;
}
const fmt = (n) => Number(n || 0).toLocaleString('nl-NL');
// Verschil met vorige week als gekleurd percentage.
function delta(cur, prev, unit = '%') {
  if (!prev) return '<span class="muted">geen vergelijking</span>';
  if (!cur) return `<span class="muted">vorige week ${fmt(prev)} kg</span>`;
  const d = Math.round(((cur - prev) / prev) * 100);
  return `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}${unit}</span> <span class="muted">t.o.v. vorige week</span>`;
}

// Tabblad Overzicht: deze week, volgende training, trends, kalender en activiteiten.
function renderHome() {
  const o = state.overview; if (!o) return;
  const now = new Date();
  $('#today').textContent = now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = now.getHours();
  $('#greet').textContent = (h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond') + ', ' + (state.me?.name || '');
  $('#tip').textContent = o.tip;

  const n = o.next;
  document.querySelector('.dash').classList.toggle('setup-mode', !!state.setup?.needed);
  if (state.setup?.needed) { renderSetup(); return; }
  $('#nextCard').classList.remove('setup');
  // cardio buiten: geen programma voor het toestel, wel het advies
  const nOut = n && (state.plan?.sessions || []).find((x) => x.name === n.name && x.outdoor);
  $('#nextCard').innerHTML = nOut ? `
    <div class="eyebrow">Volgende training</div>
    <div class="hero-title">${esc(n.name)}</div>
    <div class="hero-meta"><span>~${n.estMinutes} min</span><span>wandelen of fietsen</span></div>
    <p class="muted" style="margin:.4rem 0 .8rem">${esc(nOut.advice || '')}</p>
    <div class="row gap wrap"><button class="btn ghost" id="heroView">Bekijk in plan</button></div>` : n ? `
    <div class="eyebrow">Volgende training</div>
    <div class="hero-title">${esc(n.name)}</div>
    <div class="hero-meta"><span>~${n.estMinutes} min</span><span>${n.count} oefeningen</span><span>${esc(GOAL[o.goal] || '')}</span>${n.pushedAt ? '<span class="badge ok">op toestel</span>' : ''}</div>
    <ol class="hero-list">${n.exercises.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
    <div class="row gap wrap">
      <button class="btn accent" id="heroPush">${n.pushedAt ? 'Opnieuw op toestel zetten' : 'Zet op Gym Monster'}</button>
      <button class="btn ghost" id="heroView">Bekijk in plan</button>
    </div>` : `<div class="eyebrow">Volgende training</div><div class="hero-title">Nog geen plan</div><button class="btn accent" id="heroGen">Maak een voorstel</button>`;
  $('#heroPush')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!confirm(`“${progName(state.plan, n)}” op je Gym Monster zetten?`)) return;
    const r = await api('POST', '/api/plan/push', { sessionKey: n.key, dryRun: false });
    toast(`Op je Gym Monster gezet: ${r.plan.name}`); await load();
  }));
  $('#heroView')?.addEventListener('click', () => document.querySelector('.tab[data-tab=plan]').click());
  $('#heroGen')?.addEventListener('click', () => $('#genBtn').click());

  $('#weekRing').innerHTML = `<div class="eyebrow">Weekdoel</div>${ring(o.week.done, o.week.target)}`;
  $('#tStreak').innerHTML = `<div class="eyebrow">Streak</div><div class="big">${o.streak}<small> ${o.streak === 1 ? 'week' : 'weken'}</small></div><div class="muted">op rij je weekdoel gehaald</div>`;
  $('#tVolume').innerHTML = `<div class="eyebrow">Volume deze week</div><div class="big">${fmt(o.week.volume)}<small> kg</small></div><div class="small">${delta(o.week.volume, o.week.prevVolume)}</div>`;
  $('#tMinutes').innerHTML = `<div class="eyebrow">Trainingstijd</div><div class="big">${o.week.minutes}<small> min</small></div><div class="muted">${fmt(o.week.calories)} kcal deze week</div>`;
  const b = o.body;
  $('#tBody').innerHTML = `<div class="eyebrow">Lichaamsgewicht</div>` + (b
    ? `<div class="big">${b.kg}<small> kg</small>${b.fat ? `<small> · ${b.fat}% vet</small>` : ''}</div><div class="row between"><div class="small">${b.slope == null ? '<span class="muted">te weinig metingen</span>' : `<span class="${(o.goal === 'spieropbouw' ? b.slope >= 0 : b.slope <= 0) ? 'up' : 'down'}">${b.slope > 0 ? '+' : ''}${b.slope} kg/week</span>`}</div>${spark(b.spark, { w: 90, h: 28, cls: 'sp b' })}</div>`
    : `<div class="muted" style="margin-top:.5rem">Nog geen metingen.</div><button class="btn small ghost" style="margin-top:.5rem" onclick="document.querySelector('.tab[data-tab=body]').click()">Gewicht invoeren</button>`);

  $('#strength').innerHTML = `<div class="eyebrow">Kracht · geschat 1RM, laatste 4 weken</div>` + (o.strength.length
    ? `<div class="str-grid">${o.strength.map((x) => `<div class="str"><div class="str-name">${esc(x.name)}</div><div class="row between"><div><span class="mid">${x.e1rm}</span> <span class="muted">kg</span><div class="small"><span class="${x.deltaPct >= 0 ? 'up' : 'down'}">${x.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(x.deltaPct)}%</span></div></div>${spark(x.spark)}</div></div>`).join('')}</div>`
    : '<div class="empty">Na een paar trainingen zie je hier je krachtontwikkeling.</div>');

  // trainingskalender: laatste 8 weken, nieuwste bovenaan
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const short = (d) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }).replace('.', '');
  let rows = '', trainedDays = 0;
  for (let wk = 0; wk < 8; wk++) {
    const ws = new Date(monday); ws.setDate(monday.getDate() - wk * 7);
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    let cells = '', count = 0;
    for (let d = 0; d < 7; d++) {
      const dt = new Date(ws); dt.setDate(ws.getDate() + d);
      const info = o.days[keyOf(dt)];
      const future = dt > today, isToday = keyOf(dt) === keyOf(today);
      const lvl = !info ? '' : info.min < 25 ? 'l1' : info.min < 45 ? 'l2' : 'l3';
      if (info) { count += Math.max(1, info.titles.length); trainedDays++; }
      const dayActs = (state.activities || []).filter((a) => a.date === keyOf(dt));
      const tip = `${dt.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}${info ? ` — ${info.titles.join(', ') || 'training'}${info.min ? ` (${info.min} min)` : ''}` : future || dayActs.length ? '' : ' — rustdag'}${dayActs.length ? ' — ' + dayActs.map(actLine).join(', ') : ''}`;
      const acts = (state.activities || []).filter((a) => a.date === keyOf(dt));
      const actDots = acts.length ? `<span class="cd-acts">${acts.slice(0, 3).map((a) => `<i style="background:${actColor(a.type)}"></i>`).join('')}</span>` : '';
      cells += `<div class="cd ${lvl} ${future ? 'fut' : ''} ${isToday ? 'today' : ''}${info || acts.length ? ' click" data-date="' + keyOf(dt) + '" tabindex="0" role="button' : ''}" data-day="${keyOf(dt)}" title="${esc(tip)}"><span class="dn">${dt.getDate()}</span>${info?.min ? `<span class="dm">${info.min}′</span>` : ''}${actDots}</div>`;
    }
    const hit = count >= o.week.target;
    rows += `<div class="cw">${wk === 0 ? 'Deze week' : `${short(ws)} – ${short(we)}`}</div>${cells}<div class="cs ${hit ? 'hit' : ''}">${count}/${o.week.target}</div>`;
  }
  $('#heat').innerHTML = `<div class="row between wrap gap"><div class="eyebrow">Trainingskalender · laatste 8 weken</div><div class="muted">${trainedDays} trainingsdagen</div></div>
    <div class="cal">
      <div></div>${['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => `<div class="ch">${d}</div>`).join('')}<div class="ch">doel</div>
      ${rows}
    </div>
    <div class="legend">Gekleurd = getraind (43′ = 43 minuten) · <span class="sq l1"></span>&lt;25 <span class="sq l2"></span>25–45 <span class="sq l3"></span>&gt;45 min · omrand = vandaag · klik op een dag voor de oefeningen</div>`;
  $('#heat').querySelectorAll('.cd[data-date]').forEach((c) => {
    const go = () => openDay(c.dataset.date);
    c.addEventListener('click', go);
    c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
  });

  // plan deze week
  const pl = state.plan;
  if (!pl) $('#weekPlan').innerHTML = '<div class="eyebrow">Plan deze week</div><div class="empty">Nog geen plan.</div>';
  else {
    const all = pl.sessions.flatMap((x) => x.exercises);
    const sets = all.reduce((n, e) => n + e.sets.length, 0);
    const vol = all.reduce((n, e) => n + volFactor(e.id) * e.sets.reduce((m, st) => m + st.reps * st.weight, 0), 0);
    const mins = pl.sessions.reduce((n, x) => n + (x.estMinutes || 0), 0);
    const ups = all.filter((e) => /^↑/.test(e.note || '')).length;
    const top = Object.entries(pl.muscles || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const done = new Set(state.recent.filter((w) => w.date && new Date(w.date) >= (() => { const m = new Date(); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; })()).map((w) => String(w.title || '')));
    $('#weekPlan').innerHTML = `<div class="row between wrap gap"><div class="eyebrow" style="margin:0">Plan deze week · week ${planIso(pl).w}</div>
        <button class="btn small ghost" id="wpOpen">Open plan ›</button></div>
      ${pl.deload ? '<span class="badge warn" style="margin-top:.4rem;display:inline-block">deload-week</span>' : ''}
      <div class="wp">
        <div>${bodyMap(pl.muscles || {}, { height: 190, title: 'Spiergroepen deze week' })}</div>
        <div>
          ${pl.focus?.length ? `<div class="chips-inline" style="margin-bottom:.5rem">${pl.focus.map((f) => `<span class="chip on">${esc(FOCUS_LABELS[f] || f)}</span>`).join('')}</div>` : ''}
          <div class="wp-stats">
            <div class="wp-stat"><div class="eyebrow">Trainingen</div><div class="mid">${pl.sessions.length}<small> × ~${Math.round(mins / pl.sessions.length)} min</small></div></div>
            <div class="wp-stat"><div class="eyebrow">Werksets</div><div class="mid">${sets}<small> · ${all.length} oef.</small></div></div>
            <div class="wp-stat"><div class="eyebrow">Gepland volume</div><div class="mid">${vol >= 10000 ? (vol / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + '<small> t</small>' : fmt(Math.round(vol)) + '<small> kg</small>'}</div></div>
            <div class="wp-stat"><div class="eyebrow">Zwaarder</div><div class="mid ${ups ? 'up' : ''}">${ups}<small> oefeningen ↑</small></div></div>
          </div>
          <div class="wp-top">${top.map(([k, v]) => `<div class="mbar"><span>${esc(MUSCLE_LABELS[k] || k)}</span><div class="ht"><div class="hf" style="width:${(v / top[0][1]) * 100}%"></div></div><b>${Math.round(v * 10) / 10}</b></div>`).join('')}</div>
          <div class="wp-sess">${pl.sessions.map((x) => `<span class="${[...done].some((t) => t.endsWith(x.name)) ? 'done' : ''}">${[...done].some((t) => t.endsWith(x.name)) ? '✓ ' : ''}${esc(x.name)}</span>`).join('')}</div>
        </div>
      </div>`;
    $('#wpOpen').addEventListener('click', () => document.querySelector('.tab[data-tab=plan]').click());
  }

  $('#prs').innerHTML = `<div class="eyebrow">Records · 14 dagen</div>` + (o.prs.length
    ? o.prs.slice(0, 3).map((p) => `<div class="pr"><span class="medal">★</span><div class="pr-body"><div class="str-name">${esc(p.name)}</div><div class="muted">${esc(p.date)} · ${p.top} kg · ~${p.e1rm} kg 1RM</div></div></div>`).join('')
    : '<div class="empty small-empty">Nog geen nieuwe records. Komt vanzelf met de progressie.</div>');
}


// ---------- statistieken ----------
let stats = null, statDays = '84', statMetric = 'volume';
const statSort = { muscleTable: { k: 'volume', d: -1 }, exTable: { k: 'volume', d: -1 } };
const kg = (v) => (v >= 10000 ? `${(v / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} t` : `${fmt(v)} kg`);

// begin van de lopende kalenderperiode (lokale tijd) als JJJJ-MM-DD
function periodStart(kind) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (kind === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // maandag
  else if (kind === 'month') d.setDate(1);
  else if (kind === 'year') { d.setMonth(0); d.setDate(1); }
  else return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
try { const v = localStorage.getItem('gc-stat-range'); if (v) statDays = v; } catch {}
// Haalt de statistieken voor de gekozen periode op.
async function loadStats() {
  const from = periodStart(statDays);
  const q = from ? `from=${from}` : `days=${statDays}`;
  try { stats = await api('GET', '/api/stats?' + q); renderStats(); } catch (e) { toast(e.message, true); }
}
$('#statRange').value = String(statDays);
if (!$('#statRange').value) { statDays = '84'; $('#statRange').value = '84'; }
$('#statRange').addEventListener('change', (ev) => {
  statDays = ev.target.value;
  try { localStorage.setItem('gc-stat-range', statDays); } catch {}
  loadStats();
});
$('#muscleMetric').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  statMetric = b.dataset.m;
  $('#muscleMetric').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  renderMuscleBars();
});

// Tabblad Statistieken.
function renderStats() {
  const t = stats.totals;
  const tile = (label, val, sub = '') => `<div class="card tile"><div class="eyebrow">${label}</div><div class="big">${val}</div><div class="muted small">${sub}</div></div>`;
  const x = stats.extra || {};
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-NL');
  const KIND_NL = { program: 'programma', course: 'les', free: 'vrij', custom: 'eigen', overig: 'overig' };
  const kindTxt = Object.entries(x.kinds || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v} ${KIND_NL[k] || k}`).join(' · ');
  const vol = t.volume || x.summaryVolume || 0;
  $('#statTotals').innerHTML =
    // activiteit
    tile('Trainingen', t.workouts, kindTxt || `${t.programSessions} met setdata`) +
    tile('Per week', n1(x.perWeek || 0), x.firstDate ? `sinds ${esc(fmtDate(x.firstDate))}` : '') +
    tile('Trainingstijd', `${Math.floor(t.minutes / 60)}<small>u</small> ${t.minutes % 60}<small>m</small>`, `gem. ${x.avgMinutes || 0} min per training`) +
    tile('Calorieën', fmt(t.calories), `gem. ${fmt(x.avgKcal || 0)} kcal per training`) +
    tile('Weekreeks', `${x.streak || 0}<small> wk</small>`, `langste: ${x.longestStreak || 0} weken`) +
    tile('Favoriete dag', x.favDay ? esc(x.favDay.day.charAt(0).toUpperCase() + x.favDay.day.slice(1)) : '—', x.favDay ? `${x.favDay.n}× · ${x.activeDays} actieve dagen` : '') +
    // kracht en volume
    tile('Totaal volume', kg(vol), t.volume ? `gem. ${kg(t.avgVolume)} per training` : vol ? 'volgens Speediance' : '') +
    tile('Sets', fmt(t.sets), t.sets ? `${n1(x.setsPerWorkout)} per training · ${fmt(t.reps)} herh.` : `${fmt(t.reps)} herhalingen`) +
    tile('Herhalingen per set', t.sets ? n1(x.repsPerSet) : '—', t.reps ? `gem. ${n1(x.avgLoad)} kg per herhaling` : '') +
    tile('Zwaarste set', t.heaviest ? `${t.heaviest.weight}<small> kg</small>` : '—', t.heaviest ? `${esc(t.heaviest.name)} · ${t.heaviest.reps}×` : '') +
    tile('Records', fmt(x.prs || 0), x.bestProgress ? `beste groei: ${esc(x.bestProgress.name)} ${x.bestProgress.pct > 0 ? '+' : ''}${n1(x.bestProgress.pct)}%` : 'nieuw geschat 1RM') +
    tile('Spiergroepen', stats.muscles.filter((m) => m.sets).length, `${stats.exercises.length} oefeningen`);
  renderCardio();
  renderStatsExtra();
  $('#statNote').innerHTML = x.missingDetails ? `<div class="note">Van ${x.missingDetails} training${x.missingDetails === 1 ? '' : 'en'} in deze periode zijn de details (sets en gewichten) nog niet opgehaald. Bij een lange eerste sync gebeurt dat op de achtergrond; ververs de pagina straks. Lessen en vrije trainingen hebben vaak geen setdata.</div>` : '';
  renderMuscleBars();

  // weekmatrix
  const wk = stats.weekKeys;
  $('#weekMatrix').innerHTML = stats.muscles.length ? `<thead><tr><th>Spiergroep</th>${wk.map((w) => `<th class="num">wk ${+w.slice(-2)}</th>`).join('')}</tr></thead><tbody>${stats.muscles.map((m) => `<tr><td>${esc(m.label)}</td>${wk.map((w) => {
    const v = m.weekly[w] || 0, c = v === 0 ? 'z' : v < 6 ? 'lo' : v <= 12 ? 'ok' : 'hi';
    return `<td class="num mx ${c}">${v || '·'}</td>`;
  }).join('')}</tr>`).join('')}</tbody>` : '<tbody><tr><td class="empty">Nog geen data</td></tr></tbody>';

  renderSortable('muscleTable', stats.muscles, [
    ['label', 'Spiergroep'], ['sessions', 'Trainingen', 'n'], ['exercises', 'Oefeningen', 'n'], ['sets', 'Sets', 'n'], ['setsPerWeek', 'Sets/week', 'n'],
    ['reps', 'Herh.', 'n'], ['volume', 'Volume', 'kg'], ['maxWeight', 'Zwaarste', 'w'], ['bestE1rm', 'Best 1RM', 'w'], ['lastDate', 'Laatst'],
  ]);
  renderSortable('exTable', stats.exercises, [
    ['name', 'Oefening'], ['muscle', 'Spiergroep'], ['sessions', 'Keer', 'n'], ['sets', 'Sets', 'n'], ['reps', 'Herh.', 'n'],
    ['volume', 'Volume', 'kg'], ['maxWeight', 'Zwaarste', 'w'], ['bestE1rm', 'Best 1RM', 'w'], ['progressPct', 'Progressie', 'pct'], ['lastDate', 'Laatst'],
  ]);
}

// Balken met sets per spiergroep (klik voor details).
function renderMuscleBars() {
  const list = [...stats.muscles].filter((m) => m[statMetric] > 0).sort((a, b) => b[statMetric] - a[statMetric]);
  const max = Math.max(1, ...list.map((m) => m[statMetric]));
  const total = list.reduce((a, m) => a + m[statMetric], 0) || 1;
  $('#muscleBars').innerHTML = list.length ? list.map((m) => `
    <div class="hbar"><div class="hl">${esc(m.label)}</div>
      <div class="ht"><div class="hf" style="width:${(m[statMetric] / max) * 100}%"></div></div>
      <div class="hv">${statMetric === 'volume' ? kg(m.volume) : fmt(m[statMetric])}<span class="muted"> · ${Math.round((m[statMetric] / total) * 100)}%</span></div></div>`).join('')
    : '<div class="empty">Nog geen trainingen met setdata in deze periode</div>';
}

// Sorteerbare tabel.
function renderSortable(id, rows, cols) {
  const st = statSort[id];
  const sorted = [...rows].sort((a, b) => {
    const x = a[st.k], y = b[st.k];
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * st.d;
  });
  const cell = (r, [k, , t]) => {
    const v = r[k];
    if (t === 'kg') return `<td class="num">${kg(v)}</td>`;
    if (t === 'w') return `<td class="num">${v || '—'}${v ? ' kg' : ''}</td>`;
    if (t === 'pct') return `<td class="num ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : ''}${v}%</td>`;
    if (t === 'n') return `<td class="num">${fmt(v)}</td>`;
    return `<td>${esc(v ?? '—')}</td>`;
  };
  $('#' + id).innerHTML = `<thead><tr>${cols.map(([k, l, t]) => `<th data-k="${k}" class="${t ? 'num' : ''} ${st.k === k ? 'sorted' : ''}">${l}${st.k === k ? (st.d < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('')}</tr></thead>
    <tbody>${sorted.length ? sorted.map((r) => `<tr>${cols.map((c) => cell(r, c)).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">Nog geen data</td></tr>`}</tbody>`;
  $('#' + id).querySelector('thead').onclick = (ev) => {
    const k = ev.target.closest('th')?.dataset.k; if (!k) return;
    st.d = st.k === k ? -st.d : -1; st.k = k;
    renderSortable(id, rows, cols);
  };
}

// ---------- voortgang ----------
function renderProgress() {
  barChart($('#chartSessions'), state.weekly.map((w) => ({ x: w.week, y: w.sessions })), { unit: '×' });
  barChart($('#chartVolume'), state.weekly.map((w) => ({ x: w.week, y: Math.round(w.volume) })), { unit: 'kg' });
  const sel = $('#exSelect');
  if (!sel.options.length || sel.dataset.n !== String(state.progress.length)) {
    sel.innerHTML = state.progress.length ? state.progress.map((p, i) => `<option value="${i}">${esc(p.name)} (${p.points.length}×)</option>`).join('') : '<option>Nog geen oefeningen</option>';
    sel.dataset.n = state.progress.length;
  }
  drawExercise();
  loadWorkouts();
}

// ---------- cardio en activiteit (Apple Health) ----------
function renderCardio() {
  const c = stats.cardio, box = $('#cardioCard');
  if (!c || (!c.count && !c.avgSteps)) {
    box.classList.toggle('hidden', !!(state.activities || []).length);
    box.innerHTML = '<h2>Cardio en activiteit</h2><div class="empty">Geen activiteiten uit Apple Health in deze periode.</div>';
    return;
  }
  box.classList.remove('hidden');
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-NL');
  const t = (l, v, sub = '') => `<div class="ctile static"><div class="eyebrow">${l}</div><div class="mid">${v}</div><div class="small muted">${sub}</div></div>`;
  box.innerHTML = `<div class="row between wrap gap"><h2>Cardio en activiteit</h2><span class="muted small">uit Apple Health · Gym Monster-trainingen niet dubbel geteld</span></div>
    <div class="ctiles">
      ${t('Activiteiten', c.count, `${Math.floor(c.minutes / 60)} u ${c.minutes % 60} m in totaal`)}
      ${t('Actief per week', `${c.minutesPerWeek}<small> min</small>`, 'richtlijn: 150 min matig intensief')}
      ${t('Afstand', `${n1(c.km)}<small> km</small>`, 'wandelen, fietsen, lopen …')}
      ${t('Calorieën', fmt(c.kcal), 'actieve energie')}
      ${c.avgSteps != null ? t('Stappen per dag', fmt(c.avgSteps), `gemiddeld over ${c.stepDays} dagen`) : ''}
    </div>
    <div class="tablewrap" style="margin-top:.8rem"><table><thead><tr><th>Soort</th><th class="num">Keer</th><th class="num">Tijd</th><th class="num">Afstand</th><th class="num">Langste</th><th class="num">kcal</th><th class="num">Gem. hartslag</th></tr></thead><tbody>
      ${c.types.map((x) => `<tr><td><span class="segdot" style="background:${actColor(x.type)}"></span>${esc(actLabel(x.type))}</td><td class="num">${x.count}</td><td class="num">${Math.floor(x.minutes / 60)}u ${x.minutes % 60}m</td><td class="num">${x.km ? n1(x.km) + ' km' : '—'}</td><td class="num">${x.longestKm ? n1(x.longestKm) + ' km' : '—'}</td><td class="num">${x.kcal ? fmt(x.kcal) : '—'}</td><td class="num">${x.hrAvg ? x.hrAvg + ' bpm' : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ---------- Apple Health koppelen (instellingen) ----------
async function loadHealth(newLink) {
  const box = $('#healthCard');
  let st;
  try { st = await api('GET', '/api/health/status'); } catch (e) { box.innerHTML = `<h2>Apple Health</h2><div class="empty">${esc(e.message)}</div>`; return; }
  const when = (x) => x ? new Date(x).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  box.innerHTML = `<h2>Apple Health <span class="muted small">via de app GymCoach Sync (of Health Auto Export)</span></h2>
    <p class="muted small" style="margin-top:-.3rem">Wandelen, fietsen en andere activiteiten van je iPhone en Apple Watch. Gym Monster-trainingen die Speediance ook naar Health schrijft, worden niet dubbel geteld.</p>
    <div class="row between wrap gap"><div>${st.linked ? `<span class="badge ok">gekoppeld</span> <span class="muted small">sleutel …${esc(st.tokenHint || '')} · laatste zending: ${esc(when(st.lastPush))}${st.lastCounts ? ` (${st.lastCounts.activities} activiteiten, ${st.lastCounts.days} dagen)` : ''} · ${st.activities} activiteiten opgeslagen</span>` : '<span class="muted small">Nog niet gekoppeld.</span>'}</div>
      <div class="row gap">${st.linked ? '<button class="btn small ghost" id="hNew">Nieuwe sleutel</button><button class="btn small ghost" id="hOff">Ontkoppelen</button>' : '<button class="btn small accent" id="hNew">Koppelsleutel maken</button>'}</div></div>
    ${newLink ? `<div class="note" style="border-left-color:var(--ok)"><b>Bewaar dit nu:</b> de sleutel wordt maar één keer getoond.
      <div class="kv"><span>URL</span><code id="hUrl">${esc(newLink.url)}</code><button class="btn small ghost" data-copy="hUrl">Kopieer</button></div>
      <div class="kv"><span>Header</span><code id="hHdr">Authorization: Bearer ${esc(newLink.token)}</code><button class="btn small ghost" data-copy="hTok">Kopieer sleutel</button><code id="hTok" class="hidden">Bearer ${esc(newLink.token)}</code></div></div>` : ''}
    <details class="howto"><summary>Zo stel je de GymCoach Sync-app in</summary><ol class="small">
      <li>Installeer <b>GymCoach Sync</b> via TestFlight en open de app.</li>
      <li>Vul het adres in waarop je GymCoach opent (bijv. <code>http://192.168.1.50:8765</code>) en de koppelsleutel hierboven.</li>
      <li>Tik op <b>Test verbinding</b>, sta de toegang tot Gezondheid toe en tik één keer op <b>Volledige historie versturen</b>.</li>
      <li>Daarna gaan nieuwe workouts vanzelf, ook op de achtergrond.</li>
    </ol></details>
    <details class="howto"><summary>Of: Health Auto Export instellen</summary><ol class="small">
      <li>Installeer <b>Health Auto Export – JSON+CSV</b> op je iPhone (voor automatisch versturen is het betaalde abonnement nodig) en geef toegang tot Gezondheid.</li>
      <li>Ga naar <b>Automations → nieuwe automatisering → REST API</b>.</li>
      <li><b>URL</b>: de URL hierboven. Voeg bij <b>Headers</b> toe: sleutel <code>Authorization</code>, waarde <code>Bearer …</code> (je sleutel).</li>
      <li><b>Data type</b>: Workouts. Maak eventueel een tweede automatisering voor Health Metrics met <i>Step Count</i>, <i>Active Energy</i> en <i>Walking + Running Distance</i>.</li>
      <li><b>Export format</b>: JSON · <b>Date range</b>: laatste 7 dagen · <b>Aggregation</b> (bij metrics): per dag · zet route- en hartslagdetails uit, dat scheelt veel data.</li>
      <li>Kies een interval (bijv. elk uur) en tik op <b>Manual export</b> om het meteen te testen. Hierboven zie je dan "laatste zending".</li>
      <li>Je oude historie: doe één keer een handmatige export met een lange periode.</li>
    </ol><p class="muted small">Je iPhone moet de server kunnen bereiken: thuis via wifi, onderweg via je VPS of bijvoorbeeld Tailscale. iOS stuurt alleen als de telefoon ontgrendeld is geweest.</p></details>`;
  $('#hNew').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (st.linked && !confirm('Een nieuwe sleutel maken? De oude werkt dan niet meer; pas hem ook aan in Health Auto Export.')) return;
    loadHealth(await api('POST', '/api/health/token'));
  }));
  $('#hOff')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!confirm('Apple Health ontkoppelen? Opgeslagen activiteiten blijven bewaard.')) return;
    await api('DELETE', '/api/health/token'); loadHealth();
  }));
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const txt = $('#' + b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(txt); toast('Gekopieerd'); } catch { toast(txt); }
  }));
}

// ---------- trainingen: lijst en details ----------
let woList = null, woShown = 25;
// Haalt de trainingslijst op.
async function loadWorkouts() {
  try { woList = (await api('GET', '/api/workouts')).workouts; } catch (e) { $('#recent').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  renderWorkouts();
}
// Lijst met trainingen en activiteiten.
function renderWorkouts() {
  const q = ($('#woSearch').value || '').trim().toLowerCase();
  const list = (woList || []).filter((w) => !q || w.title.toLowerCase().includes(q) || w.date.includes(q) || fmtDate(w.date).toLowerCase().includes(q));
  if (!list.length) { $('#recent').innerHTML = `<div class="empty">${woList?.length ? 'Geen trainingen gevonden' : 'Nog geen trainingen gesynct'}</div>`; return; }
  const nf = (v) => Math.round(v).toLocaleString('nl-NL');
  $('#recent').innerHTML = `<div class="tablewrap"><table class="wotable"><thead><tr><th>Datum</th><th>Training</th><th class="num">Oef.</th><th class="num">Min</th><th class="num">kcal</th><th class="num">♥ gem.</th><th class="num">Volume</th><th></th></tr></thead><tbody>
    ${list.slice(0, woShown).map((w) => `<tr class="click" data-id="${esc(w.id)}" tabindex="0"><td>${esc(fmtDate(w.date))}</td><td>${esc(w.title)}${w.kind && w.kind !== 'program' ? ` <span class="muted small">${esc(w.kind)}</span>` : ''}</td><td class="num">${w.exercises ?? '—'}</td><td class="num">${w.minutes ?? '—'}</td><td class="num">${w.calories ?? '—'}</td><td class="num">${w.hrAvg ?? '—'}</td><td class="num">${w.volume ? nf(w.volume) + ' kg' : '—'}</td><td class="num muted">›</td></tr>`).join('')}
    </tbody></table></div>
    ${list.length > woShown ? `<div class="row center" style="margin-top:.6rem"><button class="btn ghost small" id="woMore">Meer tonen (${list.length - woShown} over)</button></div>` : `<p class="muted small" style="margin:.5rem 0 0">${list.length} trainingen</p>`}`;
  $('#woMore')?.addEventListener('click', () => { woShown += 50; renderWorkouts(); });
}
$('#woSearch').addEventListener('input', () => { woShown = 25; renderWorkouts(); });
$('#recent').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr) openWorkouts([tr.dataset.id]); });
$('#recent').addEventListener('keydown', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openWorkouts([tr.dataset.id]); } });

const nl1 = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-NL');
// Korte samenvatting van gedane sets, bijv. "3 × 10 @ 20 kg".
function doneSetsSummary(sets) {
  if (!sets?.length) return '—';
  const same = sets.every((x) => x.reps === sets[0].reps && x.weight === sets[0].weight);
  return same ? `${sets.length} × ${sets[0].reps} @ ${nl1(sets[0].weight)} kg` : sets.map((x) => `${x.reps}×${nl1(x.weight)}`).join(', ') + ' kg';
}
// Kerncijfers van een training (duur, oefeningen, volume, kcal, hartslag).
function woTiles(d) {
  const tiles = [['Duur', d.minutes != null ? `${d.minutes} min` : '—'], ['Oefeningen', d.exercises.length || '—'], ['Volume', d.volume ? `${d.volume.toLocaleString('nl-NL')} kg` : '—'], ['kcal', d.calories ?? '—']];
  if (d.calories == null && d.healthKcal != null) tiles[3] = ['kcal', d.healthKcal];
  if (d.hrAvg || d.hrMax) tiles.push(hrTile(d.hrAvg, d.hrMax));
  if (d.completion != null) tiles.push(['Voltooid', `${d.completion}%`]);
  return `<div class="wo-tiles">${tiles.map(([l, v, zc]) => `<div class="zoned"${zoneStyle(zc)}><div class="eyebrow">${l}</div><div class="mid">${esc(String(v))}</div></div>`).join('')}</div>`;
}
// Trainingsrapport in de app: oefeningen, vergelijking, hartslag, tijd en spierkaart.
function workoutHtml(d) {
  const exs = d.exercises.map((e, i) => {
    const delta = e.prev ? (e.prev.topDelta > 0 ? `<span class="up">+${nl1(e.prev.topDelta)} kg</span>` : e.prev.topDelta < 0 ? `<span class="down">${nl1(e.prev.topDelta)} kg</span>` : '<span class="muted">gelijk</span>') : '<span class="muted">eerste keer</span>';
    if (!e.top) {
      // zonder gewicht (warming-up, mobiliteit, stretches): één compacte regel
      const reps = e.sets.reduce((t, x) => t + (x.reps || 0), 0);
      return `<div class="wo-ex light"><div class="row between wrap gap"><div><b>${i + 1}. ${esc(e.name)}</b>${e.muscle ? ` <span class="muted small">${esc(e.muscle)}</span>` : ''}</div><div class="small muted">zonder gewicht${e.sets.length ? ` · ${e.sets.length} ${e.sets.length === 1 ? 'set' : 'sets'}${reps ? ` · ${reps} herh./s` : ''}` : ''}</div></div></div>`;
    }
    return `<div class="wo-ex">
      <div class="row between wrap gap"><div><b>${i + 1}. ${esc(e.name)}</b>${e.muscle ? ` <span class="muted small">${esc(e.muscle)}</span>` : ''}</div><div class="small">zwaarste set ${nl1(e.top)} kg · ${delta}</div></div>
      <table class="wo-sets"><thead><tr><th>Set</th><th class="num">Herhalingen</th><th class="num">Doel</th><th class="num">Gewicht</th></tr></thead><tbody>
        ${e.sets.map((x, j) => `<tr><td>${j + 1}</td><td class="num ${x.target && x.reps < x.target ? 'down' : x.target && x.reps >= x.target ? 'up' : ''}">${x.reps}</td><td class="num muted">${x.target ?? '—'}</td><td class="num">${nl1(x.weight)} kg${x.min != null && x.max !== x.min ? ` <span class="muted small">(${nl1(x.min)}–${nl1(x.max)})</span>` : ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="small muted">Volume ${e.volume.toLocaleString('nl-NL')} kg · geschat 1RM ${nl1(e.e1rm)} kg${e.prev ? ` · vorige keer (${esc(fmtDate(e.prev.date))}): ${esc(doneSetsSummary(e.prev.sets))}` : ''}</div>
    </div>`;
  }).join('');
  return `${d.hrSource ? `<p class="muted small" style="margin:0">Hartslag (gemiddeld / maximaal) uit ${esc(d.hrSource)}.</p>` : ''}
    ${Object.keys(d.muscles || {}).length ? `<div class="wo-map"><div>${bodyMap(d.muscles, { height: 170, title: 'Getrainde spiergroepen' })}</div><div class="mbars">${Object.entries(d.muscles).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v], i, arr) => `<div class="mbar static"><span>${esc(MUSCLE_LABELS[k] || k)}</span><div class="ht"><div class="hf" style="width:${(v / arr[0][1]) * 100}%"></div></div><b>${String(v).replace('.', ',')}</b></div>`).join('')}</div></div>` : ''}
    ${insightsHtml(d)}
    ${d.hasDetail ? exs : '<div class="empty">Geen details voor deze training (bijvoorbeeld een les of vrije training). Probeer eventueel een sync.</div>'}`;
}
// alles van één dag: Gym Monster-trainingen én activiteiten uit Apple Health
async function openDay(date) {
  const ids = idsOnDate(date);
  let acts = [];
  try { acts = (await api('GET', '/api/activities?date=' + encodeURIComponent(date))).activities; } catch {}
  if (ids.length || acts.length) openWorkouts(ids, acts, date);
}
// Een activiteit uit Apple Health (soort, duur, afstand, tempo, hartslag).
function activityHtml(a, first) {
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-NL');
  const start = a.start ? new Date(a.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : null;
  const mmss = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
  // tempo zoals gebruikelijk per sport: fietsen in km/u, zwemmen per 100 m, lopen per km; balsporten zonder tempo
  const pace = !(a.km && a.minutes) ? null : a.type === 'fietsen' ? `${n1(a.km / (a.minutes / 60))} km/u`
    : a.type === 'zwemmen' ? `${mmss(a.minutes / (a.km * 10))} /100 m`
    : ['wandelen', 'hardlopen', 'roeien'].includes(a.type) ? `${mmss(a.minutes / a.km)} /km` : null;
  const tiles = [['Duur', a.minutes != null ? `${a.minutes} min` : '—']];
  if (a.km) tiles.push(['Afstand', a.type === 'zwemmen' && a.km < 10 ? `${Math.round(a.km * 1000).toLocaleString('nl-NL')} m` : `${n1(a.km)} km`]);
  if (pace) tiles.push([a.type === 'fietsen' ? 'Snelheid' : 'Tempo', pace]);
  tiles.push(['kcal', a.kcal ?? '—']);
  if (a.hrAvg || a.hrMax) tiles.push(hrTile(a.hrAvg, a.hrMax));
  return `<div class="wo-sticky"><div class="exd-head"><div><div class="eyebrow">${esc(new Date(a.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${start ? ` · ${start}` : ''}</div>
      <h2><span class="segdot" style="background:${actColor(a.type)}"></span>${esc(actName(a))}</h2>${actName(a) !== actLabel(a.type) ? `<div class="muted small">${esc(actLabel(a.type))}</div>` : ''}</div>${first ? '<button value="close" class="btn ghost small" aria-label="Sluiten">✕</button>' : ''}</div>
    <div class="wo-tiles">${tiles.map(([l, v, zc]) => `<div class="zoned"${zoneStyle(zc)}><div class="eyebrow">${l}</div><div class="mid">${esc(String(v))}</div></div>`).join('')}</div></div>
    ${Array.isArray(a.hrSeries) && a.hrSeries.length >= 3 ? (() => { const ref = hrRefClient(); return heartHtml({ source: 'Apple Health', series: a.hrSeries, ref, zones: zonesFor(a.hrSeries, ref) }); })() : ''}
    <p class="muted small" style="margin:0">Uit Apple Health${a.name && a.name !== actName(a) && !/^other/i.test(a.name) ? ` · ${esc(a.name)}` : ''}${a.source ? ` · bron: ${esc(a.source)}` : ''}</p>`;
}
// Venster met de trainingen en activiteiten van een dag.
async function openWorkouts(ids, acts = [], date = null) {
  const dlg = $('#woDlg');
  dlg.innerHTML = '<div class="exd"><div class="empty">Laden…</div></div>';
  if (!dlg.open) dlg.showModal();
  try {
    const all = await Promise.all(ids.map((id) => api('GET', '/api/workout?id=' + encodeURIComponent(id))));
    const actHtml = acts.map((a, i) => activityHtml(a, !all.length && i === 0)).join('<hr class="wo-sep">');
    dlg.innerHTML = `<form method="dialog" class="exd">${actHtml && !all.length ? actHtml : ''}${all.map((d, i) => `
      <div class="wo-sticky"><div class="exd-head"><div><div class="eyebrow">${esc(new Date(d.date + 'T12:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div><h2>${esc(d.title)}</h2></div><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
      ${woTiles(d)}
      <div class="row gap"><a class="btn small ghost" href="/api/workout/pdf?id=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">PDF</a><button type="button" class="btn small ghost" data-mail="${esc(d.id)}">Mail naar mij</button></div></div>
      ${workoutHtml(d)}`).join('<hr class="wo-sep">')}${actHtml && all.length ? '<hr class="wo-sep">' + actHtml : ''}</form>`;
    dlg.querySelectorAll('[data-mail]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      if (!state.settings.email) { toast('Vul eerst je e-mailadres in bij Instellingen → E-mail', true); return; }
      try { const r = await api('POST', '/api/workout/mail', { id: b.dataset.mail }); toast(`Samenvatting gemaild naar ${r.to}`); } catch (er) { toast(er.message, true); }
    })));
  } catch (e) { dlg.innerHTML = `<form method="dialog" class="exd"><div class="exd-head"><h2>Training</h2><button value="close" class="btn ghost small">✕</button></div><div class="empty">${esc(e.message)}</div></form>`; }
}
const idsOnDate = (date) => (state.trainingDays || []).filter((w) => w.date === date).map((w) => w.id);
// Grafiek van de gekozen oefening in Voortgang (geschat 1RM en topgewicht).
function drawExercise() {
  const p = state.progress[+$('#exSelect').value];
  if (!p) { lineChart($('#chartExercise'), []); return; }
  lineChart($('#chartExercise'), [
    { cls: 'la', label: 'Geschat 1RM', unit: 'kg', points: p.points.map((q) => ({ x: String(q.date).slice(0, 10), y: q.e1rm })) },
    { cls: 'lb', label: 'Zwaarste set', unit: 'kg', points: p.points.map((q) => ({ x: String(q.date).slice(0, 10), y: q.topWeight })) },
  ], { yLabel: 'kg' });
}
$('#exSelect').addEventListener('change', drawExercise);


// ---------- lichaamssamenstelling ----------
const COMP = [
  ['kg', 'Gewicht', 'kg', 'down'], ['fat', 'Vetpercentage', '%', 'down'], ['fatMass', 'Vetmassa', 'kg', 'down'],
  ['muscle', 'Spiermassa', 'kg', 'up'], ['fatFree', 'Vetvrije massa', 'kg', 'up'], ['bone', 'Botmassa', 'kg', 'up'],
  ['water', 'Lichaamswater', 'kg', null], ['ecw', 'Extracellulair water', 'kg', null], ['icw', 'Intracellulair water', 'kg', null],
  ['visceral', 'Visceraal vet', '', 'down'], ['bmr', 'Rustverbranding (BMR)', 'kcal', 'up'], ['metAge', 'Metabole leeftijd', 'jr', 'down'],
  ['bmi', 'BMI', '', null], ['ffmi', 'FFMI', '', 'up'], ['musclePct', 'Spiermassa %', '%', 'up'],
  ['restHr', 'Hartslag in rust', 'bpm', 'down'], ['pwv', 'Polsgolfsnelheid', 'm/s', 'down'], ['vascAge', 'Vasculaire leeftijd', 'jr', 'down'],
  ['nerve', 'Zenuwgezondheid', 'µS', 'up'],
];

// Kleur van de lijn boven een tegel: dezelfde kleuren als de achtergrondbanden in de grafieken.
// Gepland gewicht → echt volume: bij twee handgrepen telt Speediance beide kanten (factor uit je eigen trainingen).
function volFactor(id) { const vf = state.volFactors || {}; return (vf.byId || {})[id] || vf.def || 1; }

const BAND_COLORS = { ok: '#4cc26a', warn: '#e5b84b', bad: '#ff6b6b' };
// In welke band (ok/warn/bad) valt waarde v?
const bandOf = (bands, v) => (bands && v != null ? bands.find((b) => v >= b.from && v < b.to)?.cls || null : null);
// style-attribuut voor de gekleurde lijn boven een tegel (leeg als er geen zone is)
const zoneStyle = (color) => (color ? ` style="--zc:${color}"` : '');
// Kleur van de hartslagzone (Z1–Z5) waar bpm in valt, als de maximale hartslag bekend is.
function hrZoneColor(bpm) {
  const ref = hrRefClient(); if (!ref || !(bpm > 0)) return null;
  const f = bpm / ref.max, i = [0.5, 0.6, 0.7, 0.8, 0.9].filter((x) => f >= x).length - 1;
  return i >= 0 ? ZONE_COLORS[i] : null;
}
// Hartslag-tegel: gemiddelde/maximum, gekleurd naar de zone van het gemiddelde.
const hrTile = (avg, max) => ['Hartslag gem/max', `${avg ?? '—'}${max ? `/${max}` : ''}`, hrZoneColor(avg)];

// Richtwaarden per meting (subtiele achtergrond in de grafiek). ok = groen, warn = geel, bad = rood.
// Bronnen: BMI WHO; vet% Gallagher e.a. (2000, naar leeftijd en geslacht); overige zijn grove richtwaarden.
function healthBands(metric) {
  const s = state.settings, age = s.birthYear ? new Date().getFullYear() - s.birthYear : null, h = heightM();
  // richtwaarden per man/vrouw; bij een ander geslacht de zelfgekozen tabel
  const sex = ['m', 'v'].includes(s.sex) ? s.sex : s.bandSex;
  const B = (...r) => r.map(([from, to, cls]) => ({ from, to, cls }));
  const ageBands = (a) => a ? B([-Infinity, a + 0.5, 'ok'], [a + 0.5, a + 5.5, 'warn'], [a + 5.5, Infinity, 'bad']) : null;
  switch (metric) {
    case 'bmi': return { bands: B([-Infinity, 18.5, 'warn'], [18.5, 25, 'ok'], [25, 30, 'warn'], [30, Infinity, 'bad']), note: 'BMI 18,5–25 gezond (WHO)' };
    case 'kg': return h ? { bands: B([-Infinity, 18.5 * h * h, 'warn'], [18.5 * h * h, 25 * h * h, 'ok'], [25 * h * h, 30 * h * h, 'warn'], [30 * h * h, Infinity, 'bad']), note: `gezond gewicht bij ${Math.round(h * 100)} cm: ${Math.round(18.5 * h * h)}–${Math.round(25 * h * h)} kg (BMI 18,5–25)` } : null;
    case 'fat': {
      if (!sex || !age) return { bands: null, note: 'vul geslacht (of de tabel voor richtwaarden) en geboortejaar in bij Instellingen' };
      const t = sex === 'm' ? (age < 40 ? [8, 20, 25] : age < 60 ? [11, 22, 28] : [13, 25, 30]) : (age < 40 ? [21, 33, 39] : age < 60 ? [23, 34, 40] : [24, 36, 42]);
      return { bands: B([-Infinity, t[0], 'warn'], [t[0], t[1], 'ok'], [t[1], t[2], 'warn'], [t[2], Infinity, 'bad']), note: `gezond voor jouw leeftijd: ${t[0]}–${t[1]}% (Gallagher)` };
    }
    case 'visceral': return { bands: B([-Infinity, 12.5, 'ok'], [12.5, 14.5, 'warn'], [14.5, Infinity, 'bad']), note: 'richtwaarde: onder 13 gezond' };
    case 'ffmi': return sex ? { bands: sex === 'm' ? B([-Infinity, 17, 'warn'], [17, Infinity, 'ok']) : B([-Infinity, 14, 'warn'], [14, Infinity, 'ok']), note: `richtwaarde: vanaf ${sex === 'm' ? 17 : 14} goed` } : { bands: null, note: 'vul geslacht (of de tabel voor richtwaarden) in bij Instellingen' };
    case 'restHr': return { bands: B([-Infinity, 75, 'ok'], [75, 90, 'warn'], [90, Infinity, 'bad']), note: 'richtwaarde: onder 75 goed' };
    case 'pwv': return { bands: B([-Infinity, 8, 'ok'], [8, 10, 'warn'], [10, Infinity, 'bad']), note: 'richtwaarde: onder 8 m/s goed, boven 10 verhoogd' };
    case 'nerve': return { bands: B([-Infinity, 40, 'bad'], [40, 60, 'warn'], [60, Infinity, 'ok']), note: 'richtwaarde: vanaf 60 µS normaal' };
    case 'metAge': case 'vascAge': return age ? { bands: ageBands(age), note: `groen = gelijk aan of jonger dan je leeftijd (${age})` } : { bands: null, note: 'vul je geboortejaar in voor richtwaarden' };
    default: return null;
  }
}
// lengte in meters: eigen instelling gaat voor, anders uit Withings
const heightM = () => (state.settings.heightCm ? state.settings.heightCm / 100 : state.withings?.height || null);
// BMI per meting berekenen (gewicht / lengte²)
function withBmi(log) {
  const h = heightM();
  return log.map((b) => {
    const o = { ...b };
    if (h && b.kg) o.bmi = Math.round((b.kg / (h * h)) * 10) / 10;
    if (h && b.fatFree) o.ffmi = Math.round((b.fatFree / (h * h)) * 10) / 10;
    if (b.muscle && b.kg) o.musclePct = Math.round((b.muscle / b.kg) * 1000) / 10;
    return o;
  });
}
let compMetric = 'fat';
let compTrend = true;
let compTrain = true;
try { compTrain = localStorage.getItem('gc-comp-train') !== 'off'; } catch {}
// tijdsperiode voor de grafieken op de lichaamspagina (gerekend vanaf de laatste meting)
// kalenderperiodes (vanaf maandag / de 1e / 1 januari) en terugkijkperiodes (t/m de laatste meting)
const BODY_RANGES = [['wk', 'Deze week', 'week'], ['mo', 'Deze maand', 'month'], ['ytd', 'Dit jaar', 'year'],
  ['1m', 'Laatste maand', 30], ['3m', 'Laatste 3 maanden', 91], ['6m', 'Laatste 6 maanden', 182], ['1y', 'Laatste jaar', 365], ['all', 'Alles', null]];
let bodyRange = 'all';
try { bodyRange = localStorage.getItem('gc-body-range') || 'all'; } catch {}
const rangeStart = (lastDate) => {
  const r = BODY_RANGES.find(([k]) => k === bodyRange);
  if (typeof r?.[2] === 'string') return periodStart(r[2]); // kalenderperiode, niet t.o.v. de laatste meting
  return r?.[2] && lastDate ? daysBefore(lastDate, r[2]) : '';
};
const rangeChips = (id) => `<select id="${id}" class="period-sel" aria-label="Periode" title="Kalenderperiodes tellen vanaf maandag, de 1e of 1 januari; de andere tot en met je laatste meting">
  <optgroup label="Kalender">${BODY_RANGES.filter((r) => typeof r[2] === 'string').map(([k, l]) => `<option value="${k}" ${k === bodyRange ? 'selected' : ''}>${l}</option>`).join('')}</optgroup>
  <optgroup label="Terugkijken">${BODY_RANGES.filter((r) => typeof r[2] !== 'string').map(([k, l]) => `<option value="${k}" ${k === bodyRange ? 'selected' : ''}>${l}</option>`).join('')}</optgroup></select>`;
// Koppelt de periodekeuze van een kaart in Lichaam (en onthoudt de keuze).
function bindRange(card, id) {
  card.querySelector('#' + id).addEventListener('change', (ev) => {
    bodyRange = ev.target.value; try { localStorage.setItem('gc-body-range', bodyRange); } catch {}
    renderComposition();
  });
}
try { compTrend = localStorage.getItem('gc-comp-trend') !== 'off'; } catch {}

// trendlijn: gemiddelde van de metingen in de 14 dagen tot en met elk meetpunt
function smoothTrend(points, days = 14) {
  let start = 0, sum = 0;
  return points.map((p, i) => {
    sum += p.y;
    const from = daysBefore(p.x, days - 1);
    while (points[start].x < from) sum -= points[start++].y;
    return { x: p.x, y: Math.round((sum / (i - start + 1)) * 100) / 100 };
  });
}
const SEG_GUESS = ['Linkerarm', 'Rechterarm', 'Romp', 'Linkerbeen', 'Rechterbeen'];
const SEG_DEFAULT = { 2: 'Linkerarm', 3: 'Rechterarm', 10: 'Linkerbeen', 11: 'Rechterbeen', 12: 'Romp' };
const SEG_COLORS = ['#ff7a2e', '#6c9cff', '#4cc26a', '#e5b84b', '#c77dff', '#ff6b9a'];
const daysBefore = (date, n) => new Date(new Date(date + 'T12:00:00').getTime() - n * 864e5).toISOString().slice(0, 10);

// Laatste meting met een waarde voor key, vóór een datum.
function lastWith(log, key, beforeDate) {
  for (let i = log.length - 1; i >= 0; i--) if (log[i][key] != null && (!beforeDate || log[i].date <= beforeDate)) return log[i];
  return null;
}
// trend (eenheid per week) over de 4 weken tot en met de laatste meting
function trendOf(log, key) {
  const last = lastWith(log, key); if (!last) return null;
  const from = daysBefore(last.date, 28);
  const pts = log.filter((b) => b[key] != null && b.date >= from && b.date <= last.date);
  if (pts.length < 2) return null;
  const t0 = new Date(pts[0].date).getTime();
  const xs = pts.map((b) => (new Date(b.date).getTime() - t0) / (7 * 864e5)), ys = pts.map((b) => b[key]);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (!den) return null;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den;
  return { slope, pct: (slope / my) * 100, from: pts[0].date, to: last.date };
}

// Lichaamssamenstelling: gewicht, vet, spiermassa met richtwaarden.
function renderComposition() {
  const log = withBmi(state.bodyLog);
  const avail = COMP.filter(([k]) => log.some((b) => b[k] != null));
  const card = $('#compCard');
  if (!avail.length) { card.innerHTML = '<h2>Lichaamssamenstelling</h2><div class="empty">Nog geen metingen. Koppel je Withings-weegschaal bij Instellingen of voeg een meting toe.</div>'; $('#segCard').classList.add('hidden'); return; }
  if (!avail.some(([k]) => k === compMetric)) compMetric = avail[0][0];
  const tiles = avail.map(([k, label, unit, good]) => {
    const cur = lastWith(log, k);
    const old = lastWith(log, k, daysBefore(cur.date, 30)) || log.find((b) => b[k] != null);
    const d = old && old !== cur ? Math.round((cur[k] - old[k]) * 10) / 10 : null;
    const cls = d == null || d === 0 || !good ? 'muted' : (d > 0) === (good === 'up') ? 'up' : 'down';
    const zc = BAND_COLORS[bandOf(healthBands(k)?.bands, cur[k])];
    return `<button class="ctile zoned ${k === compMetric ? 'on' : ''}" data-k="${k}"${zoneStyle(zc)}>
      <div class="eyebrow">${label}</div><div class="mid">${cur[k]}<small> ${unit}</small></div>
      <div class="small ${cls}">${d == null ? '—' : `${d > 0 ? '+' : ''}${d} ${unit}`} <span class="muted">${old && old !== cur ? `sinds ${esc(old.date.slice(5))}` : ''}</span></div></button>`;
  }).join('');
  const [, mLabel, mUnit, mGood] = COMP.find(([k]) => k === compMetric);
  const tr = trendOf(log, compMetric);
  let trendTxt = '';
  if (tr) {
    const goodDir = compMetric === 'kg' ? (state.settings.goal === 'spieropbouw' ? 'up' : 'down') : mGood;
    const cls = !goodDir || Math.abs(tr.slope) < 0.005 ? '' : (tr.slope > 0) === (goodDir === 'up') ? 'up' : 'down';
    trendTxt = `Trend 4 weken t/m ${esc(tr.to.slice(5))}: <b class="${cls}">${tr.slope >= 0 ? '+' : ''}${tr.slope.toFixed(2)} ${compMetric === 'fat' ? '%-punt/week' : mUnit ? esc(mUnit) + '/week' : 'per week'}</b>`;
    if (compMetric === 'kg') trendTxt += ` (${tr.pct.toFixed(2)}%)${state.settings.goal !== 'spieropbouw' ? ' <span class="muted">· richtwaarde bij afvallen: ca. 0,25–0,75% per week</span>' : ''}`;
  }
  card.innerHTML = `<div class="row between wrap gap"><h2>Lichaamssamenstelling</h2><span class="muted">laatste meting: ${esc(lastWith(log, 'kg')?.date || '')}</span></div>
    <div class="ctiles">${tiles}</div>
    <div class="row between wrap gap" style="margin-top:1rem"><div class="eyebrow" style="margin:0">${mLabel} over tijd${mUnit ? ` (${mUnit})` : ''}</div><div class="row gap wrap"><span class="small">${trendTxt}</span>${rangeChips('compRange')}<button class="chip ${compTrain ? 'on' : ''}" id="trainToggle" aria-pressed="${compTrain}" title="Toon de dagen waarop je getraind hebt (Gym Monster en Apple Health)"><span class="dot tm"></span> Activiteiten</button><button class="chip ${compTrend ? 'on' : ''}" id="trendToggle" aria-pressed="${compTrend}" title="Gemiddelde over 14 dagen"><span class="dot b"></span> Trendlijn</button></div></div>
    <div id="chartComp" class="chart tall"></div>`;
  const pts = log.filter((b) => b[compMetric] != null).map((b) => ({ x: b.date, y: b[compMetric] }));
  const series = [{ cls: 'la', label: mLabel, unit: mUnit, points: pts }];
  if (compTrend && pts.length > 2) series.push({ cls: 'lb', label: 'Trend (14 d)', unit: mUnit, points: smoothTrend(pts) });
  const from = rangeStart(pts[pts.length - 1]?.x);
  if (from) series.forEach((sr) => { sr.points = sr.points.filter((q) => q.x >= from); });
  const marks = compTrain ? [
    ...(state.trainingDays || []).map((w) => ({ x: w.date, label: w.title + (w.min ? ` (${w.min} min)` : '') })),
    ...(state.activities || []).map((a) => ({ x: a.date, label: actLine(a), color: actColor(a.type) })),
  ] : [];
  if (compTrain && marks.length) {
    const from2 = series[0].points[0]?.x || '';
    const types = [...new Set((state.activities || []).filter((x) => x.date >= from2).map((x) => x.type))];
    const hasGm = (state.trainingDays || []).some((w) => w.date >= from2);
    if (hasGm || types.length) $('#chartComp').insertAdjacentHTML('afterend', `<div class="band-note small muted">Streepjes onder de grafiek: ${hasGm ? '<span class="sw" style="background:var(--ok);opacity:.8"></span>Gym Monster ' : ''}${types.map((t) => `<span class="sw" style="background:${actColor(t)};opacity:.8"></span>${esc(actLabel(t).toLowerCase())}`).join(' ')}</div>`);
  }
  const hb = healthBands(compMetric);
  if (hb?.note) $('#chartComp').insertAdjacentHTML('afterend', `<div class="band-note small muted">${hb.bands ? '<span class="sw ok"></span>goed <span class="sw warn"></span>let op <span class="sw bad"></span>niet goed · ' : ''}${esc(hb.note)}</div>`);
  if (!series[0].points.length) $('#chartComp').innerHTML = '<div class="empty">Geen metingen in deze periode. Kies een langere periode.</div>';
  else lineChart($('#chartComp'), series, { bands: hb?.bands, marks, onPick: (d) => openDay(d) });
  $('#trainToggle').addEventListener('click', () => { compTrain = !compTrain; try { localStorage.setItem('gc-comp-train', compTrain ? 'on' : 'off'); } catch {} renderComposition(); });
  bindRange(card, 'compRange');
  $('#trendToggle').addEventListener('click', () => { compTrend = !compTrend; try { localStorage.setItem('gc-comp-trend', compTrend ? 'on' : 'off'); } catch {} renderComposition(); });
  card.querySelectorAll('.ctile').forEach((t) => t.addEventListener('click', () => { compMetric = t.dataset.k; renderComposition(); }));
  renderSegments();
}

let segMetric = 'muscle', segMode = 'delta';
let segTrend = true;
let balHidden = new Set();
try { balHidden = new Set(JSON.parse(localStorage.getItem('gc-bal-hidden') || '[]')); } catch {}
try { segTrend = localStorage.getItem('gc-seg-trend') !== 'off'; } catch {}
let segHidden = new Set();
try { segHidden = new Set(JSON.parse(localStorage.getItem('gc-seg-hidden') || '[]').map(Number)); } catch {}
const saveSegHidden = () => { try { localStorage.setItem('gc-seg-hidden', JSON.stringify([...segHidden])); } catch {} };
const SEG_METRICS = { muscle: ['Spiermassa', 'kg', 'up'], fatMass: ['Vetmassa', 'kg', 'down'], fatFree: ['Vetvrije massa', 'kg', 'up'], pct: ['Vet %', '%', 'down'] };
const segVal = (s, m) => m === 'pct' ? (s?.fatMass != null && s?.fatFree != null ? Math.round((s.fatMass / (s.fatMass + s.fatFree)) * 1000) / 10 : null) : s?.[m] ?? null;

// Segmenten per arm, been en romp, met links/rechts-balans.
function renderSegments() {
  const log = state.bodyLog.filter((b) => b.segments && Object.keys(b.segments).length);
  const card = $('#segCard');
  const w = state.withings || {};
  if (!log.length) {
    if (w.connected && w.extended === false) {
      card.classList.remove('hidden');
      card.innerHTML = `<h2>Per segment</h2><p class="muted">Withings geeft voor jouw API-app geen segment-, visceraal-vet- of BMR-waarden terug. Waarschijnlijk vallen die onder een betaald Withings API-pakket. De totaalwaarden hierboven werken wel.</p>`;
    } else card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  const saved = state.settings.withings?.segmentNames || {};
  const nameOf = (p) => saved[p] || SEG_DEFAULT[p] || `Positie ${p}`;
  const last = log[log.length - 1];
  const old = [...log].reverse().find((b) => b.date <= daysBefore(last.date, 30)) || log[0];
  const positions = [...new Set(log.flatMap((b) => Object.keys(b.segments).map(Number)))].sort((a, b) => a - b);
  const fmtD = (a, b, good) => {
    if (a == null || b == null || old === last) return '';
    const d = Math.round((a - b) * 10) / 10; if (!d) return '';
    return ` <span class="${(d > 0) === (good === 'up') ? 'up' : 'down'} small">${d > 0 ? '+' : ''}${d}</span>`;
  };
  const guessed = positions.some((p) => !saved[p]);
  // links/rechts-balans: (R − L) t.o.v. het gemiddelde in %; bij vet% het verschil in %-punt
  const posOf = (n) => positions.find((p) => nameOf(p) === n);
  const pairs = [['Armen', 'Linkerarm', 'Rechterarm', '#ff7a2e'], ['Benen', 'Linkerbeen', 'Rechterbeen', '#4cc26a']]
    .map(([label, l, r, color]) => ({ label, l: posOf(l), r: posOf(r), color })).filter((x) => x.l != null && x.r != null);
  const balUnit = segMetric === 'pct' ? '%-punt' : '%';
  const balOf = (b, pr, m = segMetric) => {
    const L = segVal(b.segments?.[pr.l], m), R = segVal(b.segments?.[pr.r], m);
    if (L == null || R == null || !(L + R)) return null;
    return Math.round((m === 'pct' ? R - L : ((R - L) / ((L + R) / 2)) * 100) * 10) / 10;
  };
  const balTxt = (v) => v == null ? '—' : Math.abs(v) < 1 ? 'in balans' : `${v > 0 ? 'rechts' : 'links'} ${String(Math.abs(v)).replace('.', ',')} ${balUnit} meer`;
  const balCls = (v) => v == null ? 'muted' : Math.abs(v) < 3 ? 'up' : Math.abs(v) < 8 ? 'balwarn' : 'down';
  // 6e punt op de weegschaal: visceraal vet (een index, geen segment) — klik toont de grafiek bovenaan
  const vLast = lastWith(state.bodyLog, 'visceral');
  const vOld = vLast && (lastWith(state.bodyLog, 'visceral', daysBefore(vLast.date, 30)) || null);
  const vD = vLast && vOld && vOld !== vLast ? Math.round((vLast.visceral - vOld.visceral) * 10) / 10 : null;
  const viscRow = vLast ? `<tr class="click" id="viscRow" title="Toon visceraal vet in de grafiek hierboven"><td><span class="segdot" style="background:#ff6b9a"></span>Visceraal vet <span class="muted small">(buikholte, index)</span></td>
    <td class="num muted">—</td><td class="num">${Number(vLast.visceral).toFixed(1)} index${vD ? ` <span class="${vD < 0 ? 'up' : 'down'} small">${vD > 0 ? '+' : ''}${vD}</span>` : ''}</td><td colspan="2" class="muted small">meting ${esc(vLast.date)} · richtwaarde: onder 13 · index zonder eenheid</td></tr>` : '';
  const balTiles = pairs.length ? `<div class="bal-tiles">${pairs.map((pr) => {
    const v = balOf(last, pr), o = old !== last ? balOf(old, pr) : null;
    const L = segVal(last.segments[pr.l], segMetric), R = segVal(last.segments[pr.r], segMetric);
    const d = v != null && o != null ? Math.round((Math.abs(v) - Math.abs(o)) * 10) / 10 : null;
    return `<div class="bal-tile"><div class="eyebrow">Balans ${pr.label.toLowerCase()} · ${esc(SEG_METRICS[segMetric][0].toLowerCase())}</div>
      <div class="mid ${balCls(v)}">${esc(balTxt(v))}</div>
      <div class="small muted">L ${L ?? '—'} · R ${R ?? '—'} ${esc(SEG_METRICS[segMetric][1])}${d ? ` · <span class="${d < 0 ? 'up' : 'down'}">${d < 0 ? 'meer' : 'minder'} in balans</span> dan ${esc(old.date.slice(5))}` : ''}</div></div>`;
  }).join('')}</div>` : '';
  const [mLabel, mUnit] = SEG_METRICS[segMetric];
  const segFrom = rangeStart(last.date);
  const chartLog = segFrom ? log.filter((b) => b.date >= segFrom) : log;
  card.innerHTML = `<div class="row between wrap gap"><h2>Per segment</h2><span class="muted">${esc(last.date)}${old !== last ? ` · verschil t.o.v. ${esc(old.date)}` : ''}</span></div>
    ${guessed ? '<p class="small muted" style="margin-top:-.3rem">Namen met (?) zijn een inschatting. Vergelijk één keer met de Withings-app en kies zo nodig de juiste naam.</p>' : ''}
    <div class="tablewrap"><table><thead><tr><th>Segment</th><th class="num">Spiermassa</th><th class="num">Vetmassa</th><th class="num">Vetvrije massa</th><th class="num">Vet %</th></tr></thead><tbody>
    ${positions.map((p, i) => {
      const s = last.segments[p] || {}, o = old.segments?.[p] || {};
      const pct = segVal(s, 'pct');
      const cur = saved[p] || '';
      return `<tr><td><span class="segdot" style="background:${SEG_COLORS[i % SEG_COLORS.length]}"></span><select class="segname" data-p="${p}" aria-label="Naam voor positie ${p}"><option value="">${esc(SEG_DEFAULT[p] ? SEG_DEFAULT[p] + ' (?)' : 'Positie ' + p)}</option>${SEG_GUESS.map((g) => `<option ${cur === g ? 'selected' : ''}>${g}</option>`).join('')}</select></td>
        <td class="num">${s.muscle ?? '—'}${s.muscle != null ? ' kg' : ''}${fmtD(s.muscle, o.muscle, 'up')}</td>
        <td class="num">${s.fatMass ?? '—'}${s.fatMass != null ? ' kg' : ''}${fmtD(s.fatMass, o.fatMass, 'down')}</td>
        <td class="num">${s.fatFree ?? '—'}${s.fatFree != null ? ' kg' : ''}${fmtD(s.fatFree, o.fatFree, 'up')}</td>
        <td class="num">${pct ?? '—'}${pct != null ? '%' : ''}</td></tr>`;
    }).join('')}${viscRow}</tbody></table></div>
    ${balTiles}
    <div class="row between wrap gap" style="margin-top:1rem">
      <div class="eyebrow" style="margin:0">${mLabel} ${segMode === 'bal' ? `— verschil links/rechts (${balUnit}, 0 = in balans)` : `per segment — ${segMode === 'delta' ? `verandering sinds ${esc(chartLog[0]?.date || '—')} (${segMetric === 'pct' ? '%-punt' : mUnit})` : `absoluut (${mUnit})`}`}</div>
      <div class="row gap wrap">
        <div class="chips small" id="segSwitch">${Object.entries(SEG_METRICS).map(([k, [l]]) => `<button data-m="${k}" class="${k === segMetric ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${rangeChips('segRange')}
        <button class="chip ${segTrend ? 'on' : ''}" id="segTrendToggle" aria-pressed="${segTrend}" title="Gemiddelde over 14 dagen, per segment"><span class="dot b"></span> Trendlijn</button>
        <div class="chips small" id="segMode"><button data-v="delta" class="${segMode === 'delta' ? 'on' : ''}">Verandering</button><button data-v="abs" class="${segMode === 'abs' ? 'on' : ''}">Absoluut</button>${pairs.length ? `<button data-v="bal" class="${segMode === 'bal' ? 'on' : ''}">Balans L/R</button>` : ''}</div>
      </div>
    </div>
    <div id="chartSeg" class="chart tall"></div>
    ${segMode === 'bal' ? `<div class="seg-toggles bal-toggles">${pairs.map((pr) => `<button class="seg-tg ${balHidden.has(pr.label) ? 'off' : ''}" data-b="${esc(pr.label)}" aria-pressed="${!balHidden.has(pr.label)}"><span class="segdot" style="background:${pr.color}"></span>${esc(pr.label)}</button>`).join('')}</div>` : ''}
    <div class="seg-toggles${segMode === 'bal' ? ' hidden' : ''}">${positions.map((p, i) => `<button class="seg-tg ${segHidden.has(p) ? 'off' : ''}" data-p="${p}" aria-pressed="${!segHidden.has(p)}"><span class="segdot" style="background:${SEG_COLORS[i % SEG_COLORS.length]}"></span>${esc(nameOf(p))}</button>`).join('')}
      <button class="seg-tg all" data-p="all">${segHidden.size ? 'Alles tonen' : 'Alles verbergen'}</button></div>`;
  bindRange(card, 'segRange');
  const visible = positions.map((p, i) => [p, i]).filter(([p]) => !segHidden.has(p));
  if (segMode === 'bal' && !pairs.length) segMode = 'delta';
  if (!chartLog.length) $('#chartSeg').innerHTML = '<div class="empty">Geen metingen in deze periode. Kies een langere periode.</div>';
  else if (segMode === 'bal') {
    const shown = pairs.filter((pr) => !balHidden.has(pr.label));
    if (!shown.length) $('#chartSeg').innerHTML = '<div class="empty">Zet armen of benen aan.</div>';
    else lineChart($('#chartSeg'), shown.flatMap((pr) => {
      // grootte van het verschil (altijd positief); welke kant zwaarder is staat in de tooltip
      const all = log.map((b) => { const v = balOf(b, pr); return v == null ? null : { x: b.date, y: Math.abs(v), note: v > 0 ? 'rechts meer' : v < 0 ? 'links meer' : 'gelijk' }; }).filter(Boolean);
      const inRange = (q) => !segFrom || q.x >= segFrom;
      const out = [{ color: pr.color, label: `${pr.label}`, unit: balUnit, points: all.filter(inRange) }];
      if (segTrend && all.length > 2) out.push({ color: pr.color, dash: true, label: `${pr.label} trend`, unit: balUnit, points: smoothTrend(all).filter(inRange) });
      return out;
    }), { fromZero: true, bands: [{ from: 0, to: 3, cls: 'ok' }, { from: 3, to: 8, cls: 'warn' }, { from: 8, to: Infinity, cls: 'bad' }] });
  } else if (!visible.length) { $('#chartSeg').innerHTML = '<div class="empty">Zet minstens één segment aan.</div>'; }
  else lineChart($('#chartSeg'), visible.flatMap(([p, i]) => {
    // trend over de volledige historie berekenen, daarna pas de periode tonen
    const all = log.map((b) => ({ x: b.date, y: segVal(b.segments[p], segMetric) })).filter((q) => q.y != null);
    const inRange = (q) => !segFrom || q.x >= segFrom;
    const pts = all.filter(inRange);
    const base = pts[0]?.y ?? 0;
    const rel = (arr) => segMode === 'delta' ? arr.map((q) => ({ x: q.x, y: Math.round((q.y - base) * 100) / 100 })) : arr;
    const color = SEG_COLORS[i % SEG_COLORS.length], unit = segMode === 'delta' && segMetric === 'pct' ? '%-punt' : mUnit;
    const out = [{ color, label: nameOf(p) + (segMode === 'delta' ? ' (Δ)' : ''), unit, points: rel(pts).map((q) => ({ x: q.x, y: Math.round(q.y * 10) / 10 })) }];
    if (segTrend && all.length > 2) out.push({ color, dash: true, label: nameOf(p) + ' trend', unit, points: rel(smoothTrend(all).filter(inRange)) });
    return out;
  }));
  card.querySelector('.bal-toggles')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg-tg'); if (!b) return;
    if (balHidden.has(b.dataset.b)) balHidden.delete(b.dataset.b); else balHidden.add(b.dataset.b);
    try { localStorage.setItem('gc-bal-hidden', JSON.stringify([...balHidden])); } catch {}
    renderSegments();
  });
  card.querySelector('#segTrendToggle').addEventListener('click', () => { segTrend = !segTrend; try { localStorage.setItem('gc-seg-trend', segTrend ? 'on' : 'off'); } catch {} renderSegments(); });
  card.querySelector('#viscRow')?.addEventListener('click', () => { compMetric = 'visceral'; renderComposition(); $('#compCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    card.querySelector('#segSwitch').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; segMetric = b.dataset.m; renderSegments(); });
  card.querySelector('.seg-toggles').addEventListener('click', (ev) => {
    const b = ev.target.closest('.seg-tg'); if (!b) return;
    if (b.dataset.p === 'all') { if (segHidden.size) segHidden.clear(); else positions.forEach((p) => segHidden.add(p)); }
    else { const p = +b.dataset.p; if (segHidden.has(p)) segHidden.delete(p); else segHidden.add(p); }
    saveSegHidden(); renderSegments();
  });
  card.querySelector('#segMode').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; segMode = b.dataset.v; renderSegments(); });
  card.querySelectorAll('.segname').forEach((sel) => sel.addEventListener('change', async () => {
    const n = { ...(state.settings.withings?.segmentNames || {}) };
    if (sel.value) n[sel.dataset.p] = sel.value; else delete n[sel.dataset.p];
    try { const r = await api('PUT', '/api/withings/segments', { names: n }); state.settings.withings.segmentNames = r.segmentNames; toast('Segmentnaam opgeslagen'); renderSegments(); }
    catch (e) { toast(e.message, true); }
  }));
}

// ---------- lichaam ----------
function renderWithings() {
  const w = state.withings || {};
  $('#withingsCard').innerHTML = `<div class="row between wrap gap">
    <div><div class="eyebrow">Withings-weegschaal</div>
      <div>${w.connected ? `<span class="badge ok">gekoppeld</span> <span class="muted">laatst opgehaald: ${w.lastSync ? new Date(w.lastSync).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : 'nog niet'}</span>` : '<span class="muted">Niet gekoppeld — koppelen doe je bij Instellingen → Withings.</span>'}
      ${w.lastError ? `<div class="down small">${esc(w.lastError)}</div>` : ''}</div></div>
    <div class="row gap wrap">
      ${w.connected ? '<button class="btn" id="wSync">Nu ophalen</button>' : ''}
      <button class="btn accent" id="bwAdd">Meting toevoegen</button>
    </div></div>`;
  $('#wSync')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => { const r = await api('POST', '/api/withings/sync'); toast(`${r.added} dag(en) bijgewerkt`); await load(); renderBody(); }));
  $('#bwAdd').addEventListener('click', openAddMeasurement);
}

// Venster voor een handmatige meting.
function openAddMeasurement() {
  const dlg = $('#bwDlg');
  const last = lastWith(state.bodyLog, 'kg');
  dlg.innerHTML = `<form method="dialog" class="exd" id="bwForm">
    <div class="exd-head"><div><div class="eyebrow">Handmatig</div><h2>Meting toevoegen</h2></div><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
    <div class="row gap wrap">
      <label style="flex:1 1 150px">Datum <input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
      <label style="flex:1 1 120px">Gewicht (kg) <input type="number" name="kg" step="0.1" min="20" max="400" required placeholder="${last ? last.kg : ''}"></label>
      <label style="flex:1 1 120px">Vet % (optioneel) <input type="number" name="fat" step="0.1" min="2" max="70"></label>
    </div>
    <p class="muted small" style="margin:0">Een handmatige meting op dezelfde dag als een Withings-meting vervangt die.</p>
    <div class="row gap end"><button value="close" class="btn ghost" formnovalidate>Annuleren</button><button value="ok" class="btn accent">Opslaan</button></div></form>`;
  const f = dlg.querySelector('#bwForm');
  dlg.returnValue = '';
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'ok') return;
    try {
      state.bodyLog = (await api('POST', '/api/bodyweight', { date: f.date.value, kg: +f.kg.value, fat: f.fat.value ? +f.fat.value : null })).bodyLog;
      toast('Meting opgeslagen'); renderBody();
    } catch (e) { toast(e.message, true); }
  };
  dlg.showModal();
}

// Tabblad Lichaam.
function renderBody() {
  renderWithings();
  renderComposition();
  const log = state.bodyLog;
  $('#bwCount').textContent = `(${log.length})`;
  $('#bwList').innerHTML = log.length ? `<div class="tablewrap"><table><thead><tr><th>Datum</th><th class="num">kg</th><th class="num">vet %</th><th class="num">spier</th><th>Bron</th><th></th></tr></thead><tbody>${log.slice().reverse().map((b) => `<tr><td>${esc(b.date)}</td><td class="num">${b.kg ?? '—'}</td><td class="num">${b.fat ?? '—'}</td><td class="num">${b.muscle ?? '—'}</td><td class="muted">${b.source === 'withings' ? 'Withings' : 'handmatig'}</td><td style="text-align:right"><button class="btn small ghost" data-del="${esc(b.date)}">Verwijder</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nog geen metingen</div>';
}
$('#bwList').addEventListener('click', async (ev) => {
  const d = ev.target.dataset.del;
  if (!d || !confirm(`Meting van ${d} verwijderen?`)) return;
  state.bodyLog = (await api('DELETE', '/api/bodyweight?date=' + encodeURIComponent(d))).bodyLog; renderBody();
});

// Withings koppelen/ontkoppelen (Instellingen)
function renderWithingsSettings() {
  const w = state.withings || {}, cfg = state.settings.withings || {};
  const box = $('#wsStatus'); if (!box) return;
  const configured = cfg.clientId && cfg.redirectUri;
  box.innerHTML = `<div class="row between wrap gap"><div>${w.connected ? `<span class="badge ok">gekoppeld</span> <span class="muted small">sinds ${w.connectedAt ? new Date(w.connectedAt).toLocaleDateString('nl-NL') : '—'}</span>` : `<span class="muted small">${configured ? 'Niet gekoppeld. Klik op Koppel Withings en log in met je eigen Withings-account.' : state.me?.role === 'admin' ? 'Vul eerst hieronder de Withings-app in (Callback-URL, Client ID, Client secret) en klik op Opslaan.' : 'De beheerder heeft de Withings-koppeling nog niet ingesteld.'}</span>`}</div>
    <div class="row gap">${w.connected ? '<button type="button" class="btn ghost small" id="wOff">Ontkoppelen</button>' : configured ? '<a class="btn accent small" href="/api/withings/connect" target="_blank" id="wConnect">Koppel Withings</a>' : ''}</div></div>`;
  $('#wOff')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!confirm('Withings ontkoppelen? Opgehaalde metingen blijven bewaard.')) return;
    await api('POST', '/api/withings/disconnect'); await load(); renderWithingsSettings();
  }));
}

// ---------- instellingen ----------
function fillSettings() {
  const f = $('#settingsForm'), s = state.settings;
  setDefaultFigure(figureFor(s || {}));
  for (const el of f.elements) {
    if (!el.name) continue;
    const [grp, key] = el.name.includes('.') ? el.name.split('.') : [null, el.name];
    const v = grp ? s[grp]?.[key] : s[key];
    if (el.name === 'ai.apiKey' || el.name === 'withings.clientSecret' || el.name === 'smtp.pass') { el.value = ''; el.placeholder = v ? `ingesteld (${v}) — leeg = ongewijzigd` : 'nog niet ingesteld'; continue; }
    el.value = v ?? '';
  }
  if (!f['withings.redirectUri'].value) f['withings.redirectUri'].value = cbDefault();
  const mc = s.smtp && (s.smtp.configured ?? !!(s.smtp.host && s.smtp.from));
  $('#mailNote').textContent = mc ? '' : 'Let op: de beheerder heeft de mailserver nog niet ingesteld; er wordt nog niets verstuurd.';
  const toggleBand = () => $('#bandSexWrap').classList.toggle('hidden', ['m', 'v'].includes(f.sex.value));
  toggleBand(); f.sex.onchange = toggleBand;
  syncOutputs();
  const lb = state.library || {};
  const MODEL = { 1: 'Gym Monster 1', 2: 'Gym Monster 2' };
  $('#libInfo').textContent = !lb.source ? (lb.deviceType ? 'Nog geen oefeningencatalogus voor dit toestel. Klik op "Oefeningencatalogus verversen".' : 'De oefeningencatalogus wordt opgehaald zodra je je Speediance-account koppelt.')
    : lb.source === 'account' ? `${lb.count} oefeningen voor ${MODEL[lb.deviceType] || 'toestel ' + lb.deviceType}, opgehaald van je Speediance-account${lb.updatedAt ? ` op ${new Date(lb.updatedAt.replace(' ', 'T') + 'Z').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.`
    : `${lb.count} oefeningen uit de ingebouwde standaardlijst (Gym Monster 1). Klik op "Oefeningencatalogus verversen" voor de lijst van je eigen account.`;
}
// Toont de waarden van de schuifjes (dagen, minuten) in Instellingen.
function syncOutputs() {
  const f = $('#settingsForm');
  $('#daysOut').textContent = f.daysPerWeek.value + '×';
  $('#minOut').textContent = f.minutesPerSession.value + ' min';
  document.querySelector('.ai-local').classList.toggle('hidden', f['ai.provider'].value !== 'openai');
  const ai = state.settings?.ai || {};
  if ($('#aiStatus')) $('#aiStatus').innerHTML = ai.provider === 'anthropic' && ai.apiKey ? `<span class="badge ok">actief</span> <span class="small">Claude API · model ${esc(ai.model || 'claude-sonnet-5-5')} · sleutel ${esc(ai.apiKey)}</span>`
    : ai.provider === 'openai' ? `<span class="badge ok">actief</span> <span class="small">lokaal model via ${esc(ai.baseUrl || '')}</span>`
    : `<span class="badge warn">uit</span> <span class="small muted">${ai.apiKey ? 'Er is wel een sleutel opgeslagen: kies hieronder "Claude API" en sla op.' : 'Kies een provider en vul de sleutel in.'}</span>`;
}
$('#settingsForm').addEventListener('input', syncOutputs);
$('#settingsForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget, out = { ai: {}, withings: {}, smtp: {} };
  for (const el of f.elements) {
    if (!el.name) continue;
    if (el.name.includes('.')) {
      const [grp, key] = el.name.split('.');
      if ((el.name === 'ai.apiKey' || el.name === 'withings.clientSecret' || el.name === 'smtp.pass') && !el.value) continue;
      out[grp][key] = el.value.trim();
    }
    else out[el.name] = ['heightCm', 'birthYear', 'hrMax'].includes(el.name) ? (el.value === '' ? null : +el.value) : el.type === 'number' || el.type === 'range' ? +el.value : el.value;
  }
  try {
    const before = state.settings;
    state.settings = (await api('PUT', '/api/settings', out)).settings;
    fillSettings();
    const cs = (x) => (['m', 'v'].includes(x.sex) ? x.sex : ['m', 'v'].includes(x.bandSex) ? x.bandSex : '');
    const changed = ['goal', 'daysPerWeek', 'minutesPerSession', 'experience', 'warmup', 'cooldown', 'pushMobility'].some((k) => before[k] !== state.settings[k]) || cs(before) !== cs(state.settings);
    if (figureFor(before) !== figureFor(state.settings)) { renderPlan(); if ($('#tab-home').classList.contains('active')) renderHome(); }
    if (state.setup?.needed) { await load(); toast('Opgeslagen'); }
    else if (changed) { state.plan = (await api('POST', '/api/plan/generate')).plan; if (state.meta) state.meta.coach = null; renderCoach(null); renderPlan(); toast('Opgeslagen — nieuw plan gemaakt'); }
    else toast('Opgeslagen');
  } catch (e) { toast(e.message, true); }
});
$('#mailTest').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  try { const r = await api('POST', '/api/mail/test'); toast(`Testmail verstuurd naar ${r.to}`); } catch (e) { toast(e.message, true); }
}));
const cbDefault = () => location.origin + '/api/withings/callback';
$('#cbFill').addEventListener('click', () => { $('#settingsForm')['withings.redirectUri'].value = cbDefault(); toast('Adres ingevuld — vergeet niet op Opslaan te klikken'); });
$('#cbCopy').addEventListener('click', async () => {
  const el = $('#settingsForm')['withings.redirectUri'];
  if (!el.value) el.value = cbDefault();
  try { await navigator.clipboard.writeText(el.value); toast('Gekopieerd: ' + el.value); }
  catch { el.select(); document.execCommand('copy'); toast('Gekopieerd: ' + el.value); }
});
$('#fullSyncBtn').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  toast('Volledige historie ophalen… dit kan even duren');
  try { const r = await api('POST', '/api/sync?full=1'); toast(`Klaar: ${r.meta.lastSyncFetched ?? 0} nieuwe trainingen met details`); }
  catch (e) { toast(e.message, true); }
  finally { await load(); }
}));
$('#libBtn').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  const r = await api('POST', '/api/library/refresh'); state.libraryCount = r.count; fillSettings(); toast(`Catalogus ververst: ${r.count} oefeningen`);
}));


// ---------- Speediance-account ----------
async function loadAccount() {
  try {
    const a = await api('GET', '/api/account');
    const f = $('#accountForm');
    f.email.value = a.email; f.password.value = '';
    f.password.placeholder = a.passwordSet ? 'ingesteld — leeg laten = ongewijzigd' : 'nog niet ingesteld';
    f.region.value = a.region;
    if (a.deviceType === 1 || a.deviceType === 2) { f.deviceType.value = String(a.deviceType); $('#dtOther').classList.add('hidden'); }
    else { f.deviceType.value = 'other'; f.deviceTypeNum.value = a.deviceType; $('#dtOther').classList.remove('hidden'); }
  } catch (e) { $('#accountInfo').innerHTML = `<span class="down">${esc(e.message)}</span>`; }
}
$('#accountForm').deviceType.addEventListener('change', (ev) => $('#dtOther').classList.toggle('hidden', ev.target.value !== 'other'));
$('#accountForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget, btn = f.querySelector('button.accent');
  const deviceType = f.deviceType.value === 'other' ? +f.deviceTypeNum.value : +f.deviceType.value;
  const payload = { email: f.email.value.trim(), region: f.region.value, deviceType };
  if (f.password.value) payload.password = f.password.value;
  $('#accountInfo').innerHTML = '<span class="muted">Opslaan en inloggen bij Speediance…</span>';
  await busy(btn, async () => {
    const r = await api('PUT', '/api/account', payload);
    f.password.value = '';
    $('#accountInfo').innerHTML = r.login.ok
      ? `<span class="up">✓ Ingelogd bij Speediance.</span>${r.library ? ` <span class="muted">Catalogus: ${esc(String(r.library))}${typeof r.library === 'number' ? ' oefeningen' : ''}.</span>` : ''}`
      : `<span class="down">${esc(r.login.error)}</span>`;
    if (r.login.ok) { await load(); loadAccount(); }
  });
});
$('#detectBtn').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  const r = await api('POST', '/api/account/detect');
  const box = $('#accountInfo');
  if (r.deviceType) {
    const f = $('#accountForm');
    if (r.deviceType === 1 || r.deviceType === 2) { f.deviceType.value = String(r.deviceType); $('#dtOther').classList.add('hidden'); }
    else { f.deviceType.value = 'other'; f.deviceTypeNum.value = r.deviceType; $('#dtOther').classList.remove('hidden'); }
    box.innerHTML = `<span class="up">Gevonden in je account: toesteltype ${r.deviceType}.</span> <span class="muted">Klik op “Opslaan en testen” om het te gebruiken.</span>`;
  } else {
    box.innerHTML = `<span class="muted">Je account vermeldt geen toesteltype${r.error ? ` (${esc(r.error)})` : ''}. Kies je model hierboven zelf.</span>`
      + (r.fields?.length ? `<details style="margin-top:.4rem"><summary class="muted">Gevonden toestelvelden</summary><pre class="small">${esc(r.fields.map((x) => `${x.key}: ${x.value}`).join('\n'))}</pre></details>` : '');
  }
}));


// ---------- inloggen & gebruikers ----------
let authMode = 'login';
// Inlogscherm, of het scherm om het eerste account te maken.
function showAuth(mode) {
  authMode = mode;
  const setup = mode === 'setup';
  $('#authScreen').classList.remove('hidden');
  $('#authTitle').textContent = setup ? 'Welkom bij GymCoach' : 'Inloggen';
  $('#authIntro').textContent = setup ? 'Maak het eerste account aan. Dit wordt de beheerder. Bestaande gegevens van deze installatie worden aan dit account gekoppeld.' : '';
  $('#authNameRow').classList.toggle('hidden', !setup);
  $('#authPw2Row').classList.toggle('hidden', !setup);
  $('#authSubmit').textContent = setup ? 'Account aanmaken' : 'Inloggen';
  $('#authForm').password.autocomplete = setup ? 'new-password' : 'current-password';
  $('#authErr').textContent = '';
  setTimeout(() => (setup ? $('#authForm').name : $('#authForm').username).focus(), 50);
}
$('#authForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget, btn = $('#authSubmit');
  $('#authErr').textContent = '';
  if (authMode === 'setup' && f.password.value !== f.password2.value) { $('#authErr').textContent = 'De wachtwoorden zijn niet gelijk'; return; }
  btn.disabled = true;
  try {
    const r = await fetch(authMode === 'setup' ? '/api/auth/setup' : '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: f.username.value.trim(), password: f.password.value, name: f.name.value.trim() }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && authMode === 'setup') { showAuth('login'); $('#authErr').textContent = j.error || 'Er bestaat al een account. Log in.'; return; }
    if (!r.ok) throw new Error(j.error || 'Inloggen mislukt');
    f.password.value = ''; f.password2.value = '';
    $('#authScreen').classList.add('hidden');
    if (j.migrated?.length) toast('Je bestaande gegevens zijn aan je account gekoppeld');
    await load();
  } catch (e) { $('#authErr').textContent = e.message; } finally { btn.disabled = false; }
});

const avatarUrl = (u) => `/api/avatar?id=${encodeURIComponent(u.id)}&v=${u.avatar}`;
const avatarHtml = (u) => u.avatar ? `<img src="${avatarUrl(u)}" alt="">` : esc((u.name || u.username).trim().charAt(0).toUpperCase());

// foto bijsnijden tot een vierkant van 256 px (JPEG) vóór het uploaden
function squareImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kan deze afbeelding niet lezen')); };
    img.src = url;
  });
}

// Naam, foto en menu van de ingelogde gebruiker.
function renderMe() {
  const me = state?.me; if (!me) return;
  $('#userName').textContent = me.name;
  $('#avatar').innerHTML = avatarHtml(me);
  document.body.classList.toggle('is-admin', me.role === 'admin');
}

$('#userBtn').addEventListener('click', () => {
  const me = state?.me; if (!me) return;
  const dlg = $('#userDlg');
  dlg.innerHTML = `<form method="dialog" class="exd" id="meForm">
    <div class="exd-head"><div><div class="eyebrow">${me.role === 'admin' ? 'Beheerder' : 'Gebruiker'} · ${esc(me.username)}</div><h2>${esc(me.name)}</h2></div><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
    <div class="me-photo"><span class="avatar xl" id="meAvatar">${avatarHtml(me)}</span>
      <div class="col"><span class="muted small">Profielfoto — zo zie je altijd wie er is ingelogd.</span>
      <div class="row gap"><label class="btn small">Foto kiezen<input type="file" accept="image/*" id="meFile" hidden></label>${me.avatar ? '<button type="button" class="btn small ghost" data-x="nophoto">Verwijderen</button>' : ''}</div></div></div>
    <label>Naam <input name="name" value="${esc(me.name)}" maxlength="40"></label>
    <div class="row end"><button type="button" class="btn small" data-x="name">Naam opslaan</button></div>
    <div class="eyebrow">Wachtwoord wijzigen</div>
    <label>Huidig wachtwoord <input name="current" type="password" autocomplete="current-password"></label>
    <label>Nieuw wachtwoord (min. 8 tekens) <input name="pw" type="password" autocomplete="new-password" minlength="8"></label>
    <div class="row end"><button type="button" class="btn small" data-x="pw">Wachtwoord wijzigen</button></div>
    <div class="row between" style="border-top:1px solid var(--line);padding-top:.8rem"><span class="muted small">Ingelogd op dit apparaat</span><button type="button" class="btn danger" data-x="logout">Uitloggen</button></div>
  </form>`;
  const f = dlg.querySelector('#meForm');
  const setPhoto = (v) => { state.me = { ...state.me, avatar: v }; renderMe(); $('#userBtn').click(); };
  f.querySelector('#meFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    try { const dataUrl = await squareImage(file); const r = await api('PUT', '/api/me/avatar', { dataUrl }); dlg.close(); setPhoto(r.avatar); toast('Foto opgeslagen'); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=nophoto]')?.addEventListener('click', async () => {
    try { await api('DELETE', '/api/me/avatar'); dlg.close(); setPhoto(null); toast('Foto verwijderd'); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=name]').addEventListener('click', async () => {
    try { state.me = (await api('PUT', '/api/me', { name: f.name.value.trim() })).me; renderMe(); renderHome(); toast('Naam opgeslagen'); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=pw]').addEventListener('click', async () => {
    try { await api('PUT', '/api/me/password', { current: f.current.value, password: f.pw.value }); dlg.close(); toast('Wachtwoord gewijzigd — log opnieuw in'); showAuth('login'); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=logout]').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    // volledig opnieuw laden: geen gegevens van deze gebruiker in formulieren of geheugen laten staan
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('gc-') && k !== 'gc-theme') localStorage.removeItem(k); } catch {}
    location.replace('/');
  });
  dlg.showModal();
});

// Gebruikersbeheer (alleen beheerder).
async function loadUsers() {
  const box = $('#usersCard');
  try {
    const { users } = await api('GET', '/api/users');
    box.innerHTML = `<h2>Gebruikers <span class="badge">beheerder</span></h2>
      <p class="muted small" style="margin-top:-.4rem">Iedere gebruiker heeft een eigen plan, historie, Speediance-account en Withings-koppeling.</p>
      <div class="tablewrap"><table class="utable"><thead><tr><th>Naam</th><th>Gebruikersnaam</th><th>Rol</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr data-id="${esc(u.id)}"><td><span class="avatar sm">${avatarHtml(u)}</span> ${esc(u.name)}${u.id === state.me.id ? ' <span class="muted small">(jij)</span>' : ''}</td><td>${esc(u.username)}</td>
        <td><select data-x="role" aria-label="Rol van ${esc(u.name)}"><option value="user" ${u.role === 'user' ? 'selected' : ''}>Gebruiker</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Beheerder</option></select></td>
        <td style="text-align:right;white-space:nowrap"><button class="btn small ghost" data-x="pw">Nieuw wachtwoord</button>${u.id === state.me.id ? '' : ' <button class="btn small ghost" data-x="del">Verwijder</button>'}</td></tr>`).join('')}
      </tbody></table></div>
      <form id="newUser" class="row gap wrap" style="margin-top:1rem;align-items:flex-end">
        <label style="flex:1 1 140px">Naam <input name="name" required maxlength="40"></label>
        <label style="flex:1 1 140px">Gebruikersnaam <input name="username" required pattern="[a-zA-Z0-9._\\-]{2,30}" autocomplete="off"></label>
        <label style="flex:1 1 140px">Tijdelijk wachtwoord <input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <label style="flex:0 1 130px">Rol <select name="role"><option value="user">Gebruiker</option><option value="admin">Beheerder</option></select></label>
        <button class="btn accent">Toevoegen</button>
      </form>`;
    box.querySelector('#newUser').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.currentTarget;
      try { await api('POST', '/api/users', { name: f.name.value.trim(), username: f.username.value.trim(), password: f.password.value, role: f.role.value }); toast(`${f.name.value} toegevoegd`); loadUsers(); }
      catch (e) { toast(e.message, true); }
    });
    box.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id, name = tr.cells[0].textContent.replace(' (jij)', '');
      tr.querySelector('[data-x=role]').addEventListener('change', async (ev) => {
        try { await api('PUT', '/api/users/role', { id, role: ev.target.value }); toast('Rol bijgewerkt'); } catch (e) { toast(e.message, true); loadUsers(); }
      });
      tr.querySelector('[data-x=pw]').addEventListener('click', async () => {
        const pw = prompt(`Nieuw wachtwoord voor ${name} (min. 8 tekens):`);
        if (!pw) return;
        try { await api('PUT', '/api/users/password', { id, password: pw }); toast('Wachtwoord ingesteld; bestaande sessies zijn uitgelogd'); } catch (e) { toast(e.message, true); }
      });
      tr.querySelector('[data-x=del]')?.addEventListener('click', async () => {
        if (!confirm(`${name} verwijderen? Deze gebruiker kan daarna niet meer inloggen. Zijn gegevens blijven op de server bewaard.`)) return;
        try { const r = await api('DELETE', '/api/users?id=' + encodeURIComponent(id)); toast(r.note); loadUsers(); } catch (e) { toast(e.message, true); }
      });
    });
  } catch (e) { box.innerHTML = `<span class="down">${esc(e.message)}</span>`; }
}

// Start de app: ingelogd? Dan laden, anders het inlogscherm.
async function boot() {
  const st = await fetch('/api/auth/status').then((r) => r.json()).catch(() => ({}));
  if (st.setupNeeded) return showAuth('setup');
  if (!st.user) return showAuth('login');
  await load();
  if (location.hash === '#body') { document.querySelector('.tab[data-tab=body]').click(); history.replaceState(null, '', '/'); }
}

// ---------- sync / laden ----------
$('#syncBtn').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  $('#syncStatus').textContent = 'Bezig…';
  try { const r = await api('POST', '/api/sync'); toast(`Sync klaar (${r.meta.lastSyncFetched ?? 0} nieuwe sessies)`); }
  finally { await load(); }
}));

// Laadt de toestand van de gebruiker en tekent de app opnieuw.
async function load() {
  state = await api('GET', '/api/state');
  setDefaultFigure(figureFor(state.settings || {}));
  renderMe();
  renderSyncStatus(); renderPlan(); fillSettings(); renderWithingsSettings();
  if ($('#tab-plan')?.classList.contains('active')) loadTemplates();
  if ($('#tab-home').classList.contains('active')) renderHome();
  if ($('#tab-stats').classList.contains('active')) loadStats();
  renderCoach(state.meta?.coach || null);
  if ($('#tab-progress').classList.contains('active')) renderProgress();
  if ($('#tab-body').classList.contains('active')) renderBody();
  // een nieuwe gebruiker kiest eerst zijn voorkeuren; pas daarna een plan
  if (!state.plan && !state.setup?.needed) { state.plan = (await api('POST', '/api/plan/generate')).plan; renderPlan(); }
}
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!state) return; if ($('#tab-progress').classList.contains('active')) renderProgress(); if ($('#tab-body').classList.contains('active')) renderBody(); }, 150); });
boot().catch((e) => toast(e.message, true));

// ---------- extra grafieken ----------
const ZONE_COLORS = ['#7aa2c9', '#5bb98b', '#e0c050', '#f08c3a', '#e05555'];
const PALETTE = ['#ff7a2e', '#6c9cff', '#4cc26a', '#e5b84b', '#c77dff', '#ff6b9a', '#4cc9e5', '#9a9ca1'];
const n1nl = (v) => (Math.round(v * 10) / 10).toLocaleString('nl-NL');

// maximale hartslag (zelfde regel als de server) voor zones bij activiteiten
function hrRefClient() {
  const s = state.settings || {};
  if (+s.hrMax > 100) return { max: +s.hrMax, how: 'ingesteld' };
  if (+s.birthYear > 1900) {
    const age = new Date().getFullYear() - s.birthYear, sex = ['m', 'v'].includes(s.sex) ? s.sex : s.bandSex;
    if (sex === 'v') return { max: Math.round(206 - 0.88 * age), how: `geschat: 206 − 0,88 × ${age} jaar (Gulati, voor vrouwen)` };
    return { max: Math.round(208 - 0.7 * age), how: `geschat: 208 − 0,7 × ${age} jaar (Tanaka)` };
  }
  return null;
}
// Tijd per hartslagzone uit een hartslagreeks.
function zonesFor(series, ref) {
  if (!ref) return null;
  const Z = [[1, 'Herstel', 0.5, 0.6], [2, 'Basis', 0.6, 0.7], [3, 'Aeroob', 0.7, 0.8], [4, 'Drempel', 0.8, 0.9], [5, 'Maximaal', 0.9, 1.01]]
    .map(([z, label, from, to]) => ({ z, label, from, to, bpmFrom: Math.round(from * ref.max), bpmTo: Math.round(Math.min(1, to) * ref.max), min: 0 }));
  const gaps = series.slice(1).map((p, i) => p[0] - series[i][0]).sort((a, b) => a - b), typ = gaps[Math.floor(gaps.length / 2)] || 60;
  series.forEach((p, i) => { const dt = Math.min(typ * 2, (series[i + 1]?.[0] ?? p[0] + typ) - p[0]) / 60; const f = p[1] / ref.max; const z = Z.find((x) => f >= x.from && f < x.to) || (f >= 1 ? Z[4] : null); if (z) z.min += dt; });
  Z.forEach((z) => { z.min = Math.round(z.min * 10) / 10; });
  return Z;
}

// Kleur van de hartslagzone waar bpm in valt (uit de zones van het rapport), of null.
function zoneColorIn(zones, bpm) {
  const i = (zones || []).findIndex((z) => bpm >= z.bpmFrom && bpm < (z.z === 5 ? Infinity : z.bpmTo));
  return i >= 0 ? ZONE_COLORS[i] : null;
}
// hartslagverloop: lijn over de tijd met de zones als achtergrond; of per set (Gym Monster)
function hrChartSvg(h, { W = 640, H = 170 } = {}) {
  const L = 38, R = 10, T = 8, B = 22;
  const zones = h.zones || [];
  const zAttr = (bpm) => { const c = zoneColorIn(zones, bpm); return c ? ` data-zc="${c}"` : ''; };
  if (h.series) {
    const s = h.series, t1 = Math.max(60, s[s.length - 1][0]);
    const vals = s.flatMap((p) => [p[1], p[2] ?? p[1]]);
    let lo = Math.min(...vals) - 8, hi = Math.max(...vals) + 6;
    if (h.ref) { lo = Math.min(lo, h.ref.max * 0.5); hi = Math.max(hi, Math.min(h.ref.max, hi + 4)); }
    const X = (t) => L + (t / t1) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let g = '';
    zones.forEach((z, i) => { const top = Math.min(hi, z.bpmTo), bot = Math.max(lo, z.bpmFrom); if (top > bot) g += `<rect x="${L}" width="${W - L - R}" y="${Y(top)}" height="${Y(bot) - Y(top)}" fill="${ZONE_COLORS[i]}" opacity=".13"/><text x="${W - R - 4}" y="${Y(top) + 11}" text-anchor="end" style="fill:${ZONE_COLORS[i]};font-size:10px">Z${z.z}</text>`; });
    for (let i = 0; i <= 3; i++) { const v = lo + ((hi - lo) * i) / 3; g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 5}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
    const step = t1 > 3600 ? 900 : t1 > 1800 ? 600 : 300;
    for (let t = 0; t <= t1; t += step) g += `<text x="${X(t)}" y="${H - 5}" text-anchor="middle">${Math.round(t / 60)}′</text>`;
    if (s.some((p) => p[2] != null)) g += `<polyline points="${s.map((p) => `${X(p[0])},${Y(p[2] ?? p[1])}`).join(' ')}" fill="none" stroke="var(--warn)" stroke-width="1" opacity=".45"/>`;
    g += `<polyline points="${s.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="var(--a)" stroke-width="2"/>`;
    // onzichtbare kolommen per meetpunt voor de popup
    s.forEach((p, i) => {
      const x0 = i ? (X(s[i - 1][0]) + X(p[0])) / 2 : L, x1 = i < s.length - 1 ? (X(p[0]) + X(s[i + 1][0])) / 2 : W - R;
      const zi = zones.findIndex((z) => p[1] >= z.bpmFrom && p[1] < (z.z === 5 ? Infinity : z.bpmTo));
      const tipTxt = `${Math.floor(p[0] / 60)}′${String(Math.round(p[0] % 60)).padStart(2, '0')}″\nGemiddeld: ${Math.round(p[1])} bpm${p[2] != null ? `\nMaximaal: ${Math.round(p[2])} bpm` : ''}${zi >= 0 ? `\nZone ${zones[zi].z} · ${zones[zi].label}` : ''}`;
      g += `<rect x="${x0}" y="${T}" width="${Math.max(0.5, x1 - x0)}" height="${H - T - B}" fill="transparent" data-tip="${esc(tipTxt)}"${zAttr(p[1])}/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="hrsvg" role="img" aria-label="Hartslagverloop tijdens de training">${g}</svg>`;
  }
  // per set (Gym Monster): staafjes, met een stippellijn waar een nieuwe oefening begint
  const ps = h.perSet, hi = Math.max(...ps.map((p) => p.hr)) + 8, lo = Math.min(...ps.map((p) => p.hr), h.ref ? h.ref.max * 0.5 : 999) - 8;
  const bw = (W - L - R) / ps.length, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = '';
  zones.forEach((z, i) => { const top = Math.min(hi, z.bpmTo), bot = Math.max(lo, z.bpmFrom); if (top > bot) g += `<rect x="${L}" width="${W - L - R}" y="${Y(top)}" height="${Y(bot) - Y(top)}" fill="${ZONE_COLORS[i]}" opacity=".13"/>`; });
  for (let i = 0; i <= 3; i++) { const v = lo + ((hi - lo) * i) / 3; g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 5}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  ps.forEach((p, i) => {
    if (i && p.ex !== ps[i - 1].ex) g += `<line x1="${L + i * bw}" x2="${L + i * bw}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="2 3" opacity=".5"/>`;
    const zi = zones.findIndex((z) => p.hr >= z.bpmFrom && p.hr < (z.z === 5 ? Infinity : z.bpmTo));
    g += `<rect x="${L + i * bw + bw * 0.2}" y="${Y(p.hr)}" width="${bw * 0.6}" height="${H - B - Y(p.hr)}" rx="2" fill="var(--a)" opacity=".85" data-tip="${esc(`${p.ex}\nSet ${p.set}: ${p.hr} bpm${zi >= 0 ? `\nZone ${zones[zi].z} · ${zones[zi].label}` : ''}`)}"${zAttr(p.hr)}/>`;
  });
  g += `<text x="${L}" y="${H - 5}">set 1</text><text x="${W - R}" y="${H - 5}" text-anchor="end">set ${ps.length}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="hrsvg" role="img" aria-label="Maximale hartslag per set">${g}</svg>`;
}
// Balk met de tijd per hartslagzone.
function zoneBars(zones) {
  const tot = zones.reduce((t, z) => t + (z.min || 0), 0);
  if (!tot) return '';
  return `<div class="zbar">${zones.map((z, i) => (z.min ? `<span style="flex:${z.min};background:${ZONE_COLORS[i]}" title="Z${z.z} ${z.label}: ${n1nl(z.min)} min"></span>` : '')).join('')}</div>
    <div class="zleg">${zones.map((z, i) => `<span><i style="background:${ZONE_COLORS[i]}"></i>Z${z.z} ${z.label} <b>${Math.round(z.min)}′</b> <span class="muted">${z.bpmFrom}–${z.bpmTo}</span></span>`).join('')}</div>`;
}
// Hartslagdeel van het rapport: verloop over de training en per set.
function heartHtml(h) {
  if (!h) return '';
  let out = '';
  if (h.series) out += `<div class="ins-block"><div class="eyebrow">Hartslag tijdens de training</div>${hrChartSvg({ ...h, perSet: null })}${h.zones ? zoneBars(h.zones) : ''}<div class="muted small">Hartslag uit ${esc(h.source)}, ook tijdens de rust tussen sets${h.ref ? ` · max. ${h.ref.max} bpm (${esc(h.ref.how)})` : ' · vul je geboortejaar in voor zones'}</div></div>`;
  if (h.perSet) out += `<div class="ins-block"><div class="eyebrow">Hartslag per set</div>${hrChartSvg({ ...h, series: null })}<div class="muted small">Maximale hartslag per set (Gym Monster)${h.ref ? ` · zones t.o.v. ${h.ref.max} bpm` : ''}. Ga over een staaf voor de oefening.</div></div>`;
  return out;
}
// Vergelijking met de laatste 4 keer in het rapport.
function compareHtml(c) {
  if (!c) return '';
  const fmtV = (r, v) => `${Math.round(v).toLocaleString('nl-NL')}${r.unit ? ' ' + r.unit : ''}`;
  return `<div class="ins-block"><div class="eyebrow">Vergeleken met ${c.basis === 'same' ? `de laatste ${c.n} keer deze training` : `je laatste ${c.n} trainingen`}</div>
    <table class="cmp"><tbody>${c.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num"><b>${fmtV(r, r.cur)}</b></td><td class="num muted">gem. ${fmtV(r, r.ref)}</td><td class="num ${r.label === 'Gem. hartslag' ? 'muted' : r.pct > 2 ? 'up' : r.pct < -2 ? 'down' : 'muted'}">${r.pct > 0 ? '+' : ''}${r.pct}%</td></tr>`).join('')}</tbody></table></div>`;
}
// Tijd onder spanning en rust in het rapport.
function timeHtml(t) {
  if (!t) return '';
  const dur = t.duration || 0, rest = Math.min(t.rest || 0, Math.max(0, dur - t.tut)), other = Math.max(0, dur - t.tut - rest);
  const m = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  return `<div class="ins-block"><div class="eyebrow">Tijd onder spanning</div>
    <div class="big-num">${m(t.tut)} <span class="muted small">min${dur ? ` · ${Math.round((t.tut / dur) * 100)}% van de training` : ''}</span></div>
    ${dur ? `<div class="zbar"><span style="flex:${t.tut};background:var(--a)" title="onder spanning"></span>${rest ? `<span style="flex:${rest};background:var(--b);opacity:.7" title="rust tussen sets"></span>` : ''}${other ? `<span style="flex:${other};background:var(--line)" title="overig"></span>` : ''}</div>
    <div class="zleg"><span><i style="background:var(--a)"></i>Onder spanning <b>${m(t.tut)}</b></span>${rest ? `<span><i style="background:var(--b)"></i>Rust tussen sets <b>${m(rest)}</b></span>` : ''}${other ? `<span><i style="background:var(--line)"></i>Wisselen, instellen <b>${m(other)}</b></span>` : ''}</div>` : ''}
    <div class="muted small">Gem. ${n1nl(t.perRep)} s per herhaling${t.coverage < 100 ? ` · gemeten bij ${t.coverage}% van de sets` : ''}. 3–6 s per herhaling is goed voor spieropbouw.</div></div>`;
}
// Alle extra blokken van het rapport samen.
function insightsHtml(d) {
  const parts = [compareHtml(d.compare), timeHtml(d.time)].filter(Boolean);
  return `${parts.length ? `<div class="ins-grid">${parts.join('')}</div>` : ''}${heartHtml(d.heart)}`;
}

// staafjes (eventueel gestapeld) met optioneel een lijn op een tweede as en een doellijn
function comboChart(el, { x, stacks = [], barUnit = '', line = null, goal = null, colorOf = null, label = '', xLabel = null }) {
  if (!x.length || (!stacks.some((s) => s.values.some((v) => v > 0)) && !line?.points.length)) { el.innerHTML = '<div class="empty">Nog geen data</div>'; return; }
  const W = el.clientWidth || 600, H = el.clientHeight || 200, T = 10, B = 24;
  const tot = x.map((_, i) => stacks.reduce((t, s) => t + (s.values[i] || 0), 0));
  const raw = Math.max(1, ...tot, goal?.value || 0);
  const mag = 10 ** Math.floor(Math.log10(raw / 4)), st = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => raw / v <= 5) || raw;
  const ticks = Math.ceil(raw / st), hi = ticks * st;
  const L = Math.max(40, fmtTick(hi, 0, barUnit).length * 6.4 + 10);
  let lp = null;
  if (line?.points.length) { const v = line.points.map((p) => p.y); let a = Math.min(...v), b = Math.max(...v); if (a === b) { a -= 1; b += 1; } const pad = (b - a) * 0.15; lp = { lo: a - pad, hi: b + pad }; }
  const R = lp ? Math.max(40, fmtTick(lp.hi, 1, line.unit).length * 6.4 + 10) : 10;
  const bw = (W - L - R) / x.length, Y = (v) => T + (1 - v / hi) * (H - T - B);
  let g = '';
  for (let i = 0; i <= ticks; i++) { const v = i * st; g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(fmtTick(v, 0, barUnit))}</text>`; }
  if (lp) for (let i = 0; i <= 3; i++) { const v = lp.lo + ((lp.hi - lp.lo) * i) / 3, y = T + (1 - i / 3) * (H - T - B); g += `<text x="${W - R + 6}" y="${y + 4}" style="fill:${line.color}">${esc(fmtTick(v, lp.hi - lp.lo < 10 ? 1 : 0, line.unit))}</text>`; }
  x.forEach((xx, i) => {
    let base = 0; const tip = [`${fmtDate(xx)}`];
    stacks.forEach((s) => {
      const v = s.values[i] || 0; if (!v) return;
      const c = colorOf ? colorOf(v, i) : s.color;
      g += `<rect x="${L + i * bw + bw * 0.15}" y="${Y(base + v)}" width="${Math.max(1, bw * 0.7)}" height="${Y(base) - Y(base + v)}" fill="${c}" opacity=".85"${stacks.length === 1 ? ' rx="2"' : ''}/>`;
      base += v; tip.push(`${s.label}: ${fmtTick(v, v % 1 ? 1 : 0, barUnit)}`);
    });
    const lpt = line?.points.find((p) => p.x === xx); if (lpt) tip.push(`${line.label}: ${fmtTick(lpt.y, 1, line.unit)}`);
    g += `<rect x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" fill="transparent"><title>${esc(tip.join('\n'))}</title></rect>`;
  });
  const lblEvery = Math.ceil(x.length / 7);
  x.forEach((xx, i) => { if (i % lblEvery === 0) g += `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(xLabel ? xLabel(xx) : xx.slice(8, 10) + '-' + xx.slice(5, 7))}</text>`; });
  if (goal) g += `<line x1="${L}" x2="${W - R}" y1="${Y(goal.value)}" y2="${Y(goal.value)}" stroke="var(--ok)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - R - 4}" y="${Y(goal.value) - 5}" text-anchor="end" style="fill:var(--ok);paint-order:stroke;stroke:var(--surface);stroke-width:4px;font-weight:600">${esc(goal.label)}</text>`;
  if (lp) {
    const Yl = (v) => T + (1 - (v - lp.lo) / (lp.hi - lp.lo)) * (H - T - B);
    const pts = line.points.filter((p) => x.includes(p.x)).map((p) => `${L + x.indexOf(p.x) * bw + bw / 2},${Yl(p.y)}`);
    g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${line.color}" stroke-width="2.2"/>` + pts.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="2.6" fill="${line.color}"/>`).join('');
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${g}</svg>`;
}
const legendHtml = (items) => `<div class="legend">${items.map(([c, t, line]) => `<span class="lg"><i style="background:${c}${line ? ';height:3px;border-radius:2px' : ''}"></i>${esc(t)}</span>`).join('')}</div>`;

// ---------- statistieken: balans, kracht, spiermassa, cardio ----------
let strengthOn = null;
// Extra statistieken: krachtindex, balans, spiermassa tegen volume, cardio en stappen.
function renderStatsExtra() {
  const s = stats;
  // balans
  const b = s.balance || {};
  const balRow = (l1, v1, l2, v2, ideal) => {
    const t = v1 + v2; if (!t) return '';
    const p = Math.round((v1 / t) * 100), ratio = v2 ? v1 / v2 : null;
    return `<div class="bal"><div class="row between small"><span><b>${l1}</b> ${fmt(v1)} sets</span><span>${ratio ? `verhouding <b>1 : ${n1nl(v2 / v1)}</b>` : ''}</span><span>${fmt(v2)} sets <b>${l2}</b></span></div>
      <div class="balbar"><span style="width:${p}%"></span><i style="left:${ideal}%"></i></div></div>`;
  };
  const bp = b.push + b.pull ? b.pull / Math.max(1, b.push) : null, bu = b.upper + b.lower ? b.upper / Math.max(1, b.lower) : null;
  const tips = [];
  if (bp != null && b.push && bp > 1.6) tips.push('Je doet veel meer trekken dan duwen. Een extra borst- of schouderoefening brengt het in balans.');
  if (bp != null && bp < 0.8) tips.push('Je duwt meer dan je trekt. Meer roeien of pulldowns beschermt je schouders.');
  if (bu != null && bu > 2.2) tips.push('Je benen krijgen relatief weinig. Een squat- of lunge-variant extra helpt.');
  if (bu != null && bu < 0.6) tips.push('Je bovenlichaam krijgt relatief weinig sets.');
  $('#balanceCard').innerHTML = `<h2>Balans</h2><p class="muted" style="margin-top:-.4rem">Werksets in de gekozen periode. Het streepje is de richtlijn: duwen en trekken ongeveer gelijk (trekken mag iets meer), boven en onder ook ongeveer gelijk.</p>
    ${balRow('Duwen', b.push || 0, 'trekken', b.pull || 0, 45) || '<div class="empty">Nog geen data</div>'}${balRow('Boven', b.upper || 0, 'onder', b.lower || 0, 50)}
    ${tips.length ? `<div class="note small">${tips.map(esc).join('<br>')}</div>` : (b.push || b.upper ? '<p class="small up" style="margin:.4rem 0 0">Mooi in balans.</p>' : '')}`;

  // krachtindex per spiergroep
  const ser = s.strength || [];
  if (!strengthOn || !ser.some((x) => strengthOn.has(x.key))) strengthOn = new Set(ser.slice(0, 4).map((x) => x.key));
  const col = (k) => PALETTE[ser.findIndex((x) => x.key === k) % PALETTE.length];
  $('#strengthChips').innerHTML = ser.map((x) => `<button data-k="${esc(x.key)}" class="${strengthOn.has(x.key) ? 'on' : ''}"><i style="background:${col(x.key)}"></i>${esc(x.label)} <span class="${x.change > 0 ? 'up' : x.change < 0 ? 'down' : 'muted'}">${x.change > 0 ? '+' : ''}${n1nl(x.change)}%</span></button>`).join('');
  lineChart($('#chartStrength'), ser.filter((x) => strengthOn.has(x.key)).map((x) => ({ label: x.label, unit: '', color: col(x.key), points: x.points })), { yLabel: 'Krachtindex', yUnit: '' });
  $('#strengthChips').onclick = (ev) => { const bt = ev.target.closest('button'); if (!bt) return; strengthOn.has(bt.dataset.k) ? strengthOn.delete(bt.dataset.k) : strengthOn.add(bt.dataset.k); renderStatsExtra(); };

  // spiermassa tegen volume
  const vm = s.volumeVsMass || { volume: [], mass: [] };
  comboChart($('#chartVolMass'), { x: vm.volume.map((p) => p.x), stacks: [{ label: 'Volume', color: 'var(--a)', values: vm.volume.map((p) => p.y) }], barUnit: 'kg', line: vm.mass.length ? { label: 'Spiermassa', unit: 'kg', color: 'var(--b)', points: vm.mass } : null, label: 'Trainingsvolume en spiermassa per week' });
  $('#volMassNote').innerHTML = vm.mass.length >= 2
    ? (() => { const d = vm.mass[vm.mass.length - 1].y - vm.mass[0].y; return `Spiermassa ${d >= 0 ? '+' : ''}${n1nl(d)} kg in deze periode, bij gemiddeld ${kg(Math.round(vm.volume.reduce((t, p) => t + p.y, 0) / Math.max(1, vm.volume.filter((p) => p.y).length)))} per trainingsweek.`; })()
    : 'Spiermassa komt van de Withings-weegschaal; daarvoor zijn minstens twee metingen in deze periode nodig.';

  // cardio
  const cw = s.cardioWeeks || [];
  const types = [['wandelen', 'Wandelen'], ['fietsen', 'Fietsen'], ['hardlopen', 'Hardlopen'], ['overig', 'Overig']].filter(([k]) => cw.some((w) => w[k] > 0));
  $('#cardioKmCard').classList.toggle('hidden', !cw.length && !(s.steps || []).length);
  comboChart($('#chartKm'), { x: cw.map((w) => w.x), stacks: types.map(([k, l]) => ({ label: l, color: actColor(k), values: cw.map((w) => w[k]) })), barUnit: 'km', label: 'Kilometers per week' });
  $('#kmLegend').innerHTML = legendHtml(types.map(([k, l]) => [actColor(k), l]));
  const st = (s.steps || []).slice(-120);
  comboChart($('#chartSteps'), { x: st.map((p) => p.x), stacks: [{ label: 'Stappen', color: 'var(--b)', values: st.map((p) => p.y) }], goal: { value: s.stepGoal, label: `doel ${fmt(s.stepGoal)}` }, colorOf: (v) => (v >= s.stepGoal ? 'var(--ok)' : 'var(--b)'), label: 'Stappen per dag' });
  $('#stepsNote').textContent = st.length ? `Doel gehaald op ${s.stepHit} van ${s.steps.length} dagen (${Math.round((s.stepHit / s.steps.length) * 100)}%). Het doel stel je in bij Instellingen.${s.steps.length > st.length ? ' De grafiek toont de laatste 120 dagen.' : ''}` : 'Nog geen stappen uit Apple Health.';
}

// ---------- analyse ----------
let analysisData = null, anRange = '365';
try { const v = localStorage.getItem('gc-an-range'); if (v) anRange = v; } catch {}
$('#anRange').value = anRange; if (!$('#anRange').value) { anRange = '365'; $('#anRange').value = '365'; }
$('#anRange').addEventListener('change', (ev) => { anRange = ev.target.value; try { localStorage.setItem('gc-an-range', anRange); } catch {} loadAnalysis(); });
$('#heatActs').addEventListener('change', () => analysisData && renderAnalysis());
// Haalt de gegevens voor Analyse op.
async function loadAnalysis() {
  const from = periodStart(anRange);
  try { analysisData = await api('GET', '/api/analysis?' + (from ? `from=${from}` : `days=${anRange}`)); renderAnalysis(); } catch (e) { toast(e.message, true); }
}
// Tabblad Analyse: kalender, wanneer je traint, records, energie en herstel.
function renderAnalysis() {
  const a = analysisData;
  // 6. heatmap weekdag × dagdeel
  const withActs = $('#heatActs').checked;
  const val = (c) => c.gym + (withActs ? c.act : 0);
  const max = Math.max(1, ...a.heat.grid.flat().map(val));
  const cols = a.heat.blocks.map((b, i) => (a.heat.grid.some((r) => val(r[i]) > 0) || i < a.heat.blocks.length - 1 ? i : null)).filter((i) => i != null);
  $('#heatmap').innerHTML = `<div class="heat" style="grid-template-columns:2.2rem repeat(${cols.length},1fr)"><span></span>${cols.map((i) => `<span class="hh">${a.heat.blocks[i]}</span>`).join('')}
    ${a.heat.days.map((d, r) => `<span class="hd">${d}</span>${cols.map((i) => { const c = a.heat.grid[r][i], v = val(c); return `<span class="hc" style="--o:${v ? 0.18 + 0.82 * (v / max) : 0}" title="${d} ${a.heat.blocks[i]}: ${c.gym} Gym Monster${withActs ? `, ${c.act} wandel/fiets` : ''}">${v || ''}</span>`; }).join('')}`).join('')}</div>`;
  const tot = a.heat.grid.flat().reduce((t, c) => t + val(c), 0);
  const best = (() => { let b = null; a.heat.grid.forEach((row, r) => row.forEach((c, i) => { if (!b || val(c) > b.v) b = { v: val(c), d: a.heat.days[r], t: a.heat.blocks[i] }; })); return b; })();
  $('#heatNote').innerHTML = tot ? `Meestal op <b>${best.d} ${best.t}</b> uur.${a.heat.gymUntimed ? ` ${a.heat.gymUntimed} training${a.heat.gymUntimed === 1 ? '' : 'en'} zonder bekend tijdstip niet meegeteld.` : ''}` : 'Nog geen trainingen met een tijdstip in deze periode.';

  // 10. herstel
  const rc = a.recovery;
  comboChart($('#chartRecovery'), { x: rc.load.map((p) => p.x), stacks: [{ label: 'Training', color: 'var(--a)', values: rc.load.map((p) => p.y) }], barUnit: 'min', line: rc.rest.length ? { label: 'Rusthartslag', unit: 'bpm', color: 'var(--warn)', points: rc.rest } : null, label: 'Trainingsbelasting en hartslag in rust' });
  const sig = { normaal: ['up', 'Je rusthartslag is normaal: je herstelt goed.'], 'let op': ['', 'Je rusthartslag is iets hoger dan normaal. Slaap en rust goed; een lichtere training kan geen kwaad.'], hoog: ['down', 'Je rusthartslag is duidelijk hoger dan normaal. Mogelijk ben je nog niet hersteld, of word je ziek: neem een rustdag of train licht.'] };
  $('#recoveryNote').innerHTML = rc.source
    ? `<p class="small" style="margin:.4rem 0 0">Rusthartslag laatste 7 dagen <b>${n1nl(rc.recent ?? 0)}</b> bpm, de 4 weken daarvoor <b>${n1nl(rc.base ?? 0)}</b>.${rc.signal ? ` <span class="${sig[rc.signal][0]}">${sig[rc.signal][1]}</span>` : ''}</p><p class="muted small" style="margin:.2rem 0 0">Bron: ${esc(rc.source)}. Een stijging van 5 bpm of meer is een bekend teken van onvoldoende herstel.</p>`
    : '<p class="muted small">Nog geen hartslag in rust. Die komt uit Apple Health (GymCoach Sync) of de Withings-weegschaal.</p>';

  // 9. calorieën en gewicht
  const en = a.energy;
  comboChart($('#chartEnergy'), { x: en.kcal.map((p) => p.x), stacks: [{ label: 'Actieve energie', color: 'var(--a)', values: en.kcal.map((p) => p.y) }], barUnit: 'kcal', line: en.kg.length ? { label: 'Gewicht', unit: 'kg', color: 'var(--b)', points: en.kg } : null, label: 'Actieve energie per week en gewicht' });
  const kc = en.kcal.filter((p) => p.y > 0);
  $('#energyNote').textContent = `${kc.length ? `Gemiddeld ${fmt(Math.round(kc.reduce((t, p) => t + p.y, 0) / kc.length))} kcal actieve energie per week` : 'Nog geen calorieën'}${en.kg.length >= 2 ? `; gewicht ${en.kg[en.kg.length - 1].y - en.kg[0].y >= 0 ? '+' : ''}${n1nl(en.kg[en.kg.length - 1].y - en.kg[0].y)} kg` : ''}. ${en.fromHealth ? 'Bron: Apple Health (alles wat je verbrandt bovenop je rustverbruik).' : 'Bron: calorieën van je trainingen en activiteiten.'}`;

  // 7. records
  const byMonth = {};
  for (const r of a.records) byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + 1;
  const months = Object.keys(byMonth).sort();
  const allM = [];
  if (months.length) for (let d = new Date(months[0] + '-01T12:00:00'); d <= new Date(); d.setMonth(d.getMonth() + 1)) allM.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  comboChart($('#chartRecords'), { x: allM, stacks: [{ label: 'Records', color: 'var(--ok)', values: allM.map((m) => byMonth[m.slice(0, 7)] || 0) }], label: 'Records per maand', xLabel: (m) => `${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][+m.slice(5, 7) - 1]}${m.slice(5, 7) === '01' || allM.length <= 7 ? '' : ''}` });
  const MND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  let lastM = '';
  $('#recordList').innerHTML = a.records.length ? a.records.slice(0, 60).map((r) => {
    const m = r.date.slice(0, 7), head = m !== lastM ? `<div class="rec-m">${MND[+m.slice(5) - 1]} ${m.slice(0, 4)}</div>` : ''; lastM = m;
    return `${head}<div class="rec"><span class="rec-d">${+r.date.slice(8)}</span><div><b>${esc(r.name)}</b><div class="muted small">${esc(r.set)} · geschat 1RM ${n1nl(r.e1rm)} kg${r.muscle ? ` · ${esc(r.muscle)}` : ''}</div></div><span class="up">+${n1nl(r.pct)}%</span></div>`;
  }).join('') + (a.recordCount > 60 ? `<p class="muted small">en nog ${a.recordCount - 60} eerdere records</p>` : '') : '<div class="empty">Nog geen records in deze periode</div>';
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'analysis') loadAnalysis(); }));

// ---------- instellingen: onderdelen ----------
let setPane = 'account';
try { setPane = localStorage.getItem('gc-set-pane') || 'account'; } catch {}
// Toont één onderdeel van Instellingen (en onthoudt het).
function showSetPane(key, remember = true) {
  const btn = $(`#setNav button[data-pane="${key}"]`);
  if (!btn || getComputedStyle(btn).display === 'none') key = 'account';
  else if (remember) { setPane = key; try { localStorage.setItem('gc-set-pane', key); } catch {} }
  document.querySelectorAll('#setNav button').forEach((b) => b.classList.toggle('on', b.dataset.pane === key));
  document.querySelectorAll('#tab-settings .set-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === key));
}
$('#setNav').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { showSetPane(b.dataset.pane); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } });
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'settings') showSetPane(setPane, false); }));
showSetPane(setPane, false);
$('#settingsForm')['ai.provider'].addEventListener('change', (ev) => {
  const f = $('#settingsForm'), v = ev.target.value;
  document.querySelector('.ai-local').classList.toggle('hidden', v !== 'openai');
  if (v === 'anthropic' && !/^claude-/.test(f['ai.model'].value)) f['ai.model'].value = 'claude-sonnet-5-5';
  if (v === 'openai' && /^claude-/.test(f['ai.model'].value)) f['ai.model'].value = '';
});

// ---------- volledige trainingskalender (analyse) ----------
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let calView = 'month', calCursor = null;
try { calView = localStorage.getItem('gc-cal-view') || 'month'; } catch {}
// Trainingen en activiteiten per dag, voor de kalenders.
function calData() {
  const days = {};
  for (const w of state.trainingDays || []) (days[w.date] ||= { gym: [], acts: [] }).gym.push(w);
  for (const a of state.activities || []) (days[a.date] ||= { gym: [], acts: [] }).acts.push(a);
  return days;
}
// Grote kalender (maand of jaar) met de volledige historie.
function renderBigCal() {
  const el = $('#bigCal'); if (!el) return;
  const days = calData();
  const all = Object.keys(days).sort();
  const today = new Date(); today.setHours(12, 0, 0, 0);
  if (!calCursor) calCursor = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const first = all[0] ? new Date(all[0] + 'T12:00:00') : today;
  const minM = new Date(first.getFullYear(), first.getMonth(), 1, 12);
  const maxM = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  if (calCursor < minM) calCursor = new Date(minM); if (calCursor > maxM) calCursor = new Date(maxM);
  const target = state.settings?.daysPerWeek || 3;
  const gymMin = (d) => (d?.gym || []).reduce((t, w) => t + (w.min || 0), 0);
  const lvl = (d) => { if (!d?.gym.length) return ''; const m = gymMin(d); return m && m < 25 ? 'l1' : m && m < 45 ? 'l2' : 'l3'; };
  const dots = (d) => (d?.acts.length ? `<span class="bc-acts">${d.acts.slice(0, 4).map((a) => `<i style="background:${actColor(a.type)}" title="${esc(actLine(a))}"></i>`).join('')}</span>` : '');
  const totalGym = (state.trainingDays || []).length, gymDays = Object.values(days).filter((d) => d.gym.length).length;

  let body = '';
  if (calView === 'month') {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    const start = new Date(y, m, 1, 12); start.setDate(1 - ((start.getDay() + 6) % 7));
    const end = new Date(y, m + 1, 0, 12); end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)));
    let rows = '', mGym = 0, mMin = 0, mActs = 0;
    for (let ws = new Date(start); ws <= end; ws.setDate(ws.getDate() + 7)) {
      let cells = '', wkCount = 0;
      for (let i = 0; i < 7; i++) {
        const dt = new Date(ws); dt.setDate(ws.getDate() + i);
        const k = ymd(dt), d = days[k], inM = dt.getMonth() === m, fut = dt > today;
        if (d) { wkCount += d.gym.length; if (inM) { mGym += d.gym.length; mMin += gymMin(d); mActs += d.acts.length; } }
        const titles = (d?.gym || []).map((w) => w.title.replace(/^GC\s+W\d+\s+/i, '')).join(' + ');
        const tip = `${dt.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${d?.gym.length ? ' — ' + d.gym.map((w) => `${w.title}${w.min ? ` (${w.min} min)` : ''}`).join(', ') : ''}${d?.acts.length ? ' — ' + d.acts.map(actLine).join(', ') : ''}`;
        cells += `<div class="bc-d ${lvl(d)}${inM ? '' : ' out'}${fut ? ' fut' : ''}${k === ymd(today) ? ' today' : ''}${d ? ' click' : ''}" data-day="${k}" ${d ? `data-date="${k}" tabindex="0" role="button"` : ''}>
          <span class="bc-n">${dt.getDate()}</span>${d?.gym.length ? `<span class="bc-t">${esc(titles)}</span><span class="bc-m">${gymMin(d) ? gymMin(d) + '′' : ''}</span>` : ''}${dots(d)}</div>`;
      }
      const thisWeek = ws <= today;
      rows += `${cells}<div class="bc-w ${wkCount >= target ? 'hit' : ''}">${thisWeek ? `${wkCount}/${target}` : ''}</div>`;
    }
    body = `<div class="bc-grid">${['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => `<div class="bc-h">${d}</div>`).join('')}<div class="bc-h">week</div>${rows}</div>
      <div class="bc-sum">${MAANDEN[m]} ${y}: <b>${mGym}</b> ${mGym === 1 ? 'training' : 'trainingen'}${mMin ? ` · <b>${Math.floor(mMin / 60)}u ${mMin % 60}m</b>` : ''}${mActs ? ` · <b>${mActs}</b> wandel-/fietsactiviteiten` : ''}</div>`;
  } else {
    const y = calCursor.getFullYear();
    let months = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(y, m, 1, 12), off = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
      let cells = '<span></span>'.repeat(off), cnt = 0;
      for (let dd = 1; dd <= n; dd++) {
        const dt = new Date(y, m, dd, 12), k = ymd(dt), d = days[k];
        if (d?.gym.length) cnt += d.gym.length;
        cells += `<span class="ym-d ${lvl(d)}${d?.acts.length && !d.gym.length ? ' act' : ''}${k === ymd(today) ? ' today' : ''}${dt > today ? ' fut' : ''}" data-day="${k}" ${d ? `data-date="${k}"` : ''} title="${esc(dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' }) + (d?.gym.length ? ' — ' + d.gym.map((w) => w.title).join(', ') : '') + (d?.acts.length ? ' — ' + d.acts.map(actLine).join(', ') : ''))}">${dd}</span>`;
      }
      months += `<div class="ym"><button type="button" class="ym-h" data-m="${m}">${MAANDEN[m]} <span class="muted">${cnt || ''}</span></button><div class="ym-g">${['m', 'd', 'w', 'd', 'v', 'z', 'z'].map((x) => `<span class="ym-l">${x}</span>`).join('')}${cells}</div></div>`;
    }
    const yGym = (state.trainingDays || []).filter((w) => w.date.startsWith(String(y))).length;
    body = `<div class="ym-wrap">${months}</div><div class="bc-sum">${y}: <b>${yGym}</b> trainingen · klik op een maand voor de details</div>`;
  }
  const title = calView === 'month' ? `${MAANDEN[calCursor.getMonth()]} ${calCursor.getFullYear()}` : String(calCursor.getFullYear());
  const prevOk = calView === 'month' ? calCursor > minM : calCursor.getFullYear() > minM.getFullYear();
  const nextOk = calView === 'month' ? calCursor < maxM : calCursor.getFullYear() < maxM.getFullYear();
  el.innerHTML = `<div class="row between wrap gap">
      <div><h2 style="margin:0">Trainingskalender</h2><div class="muted small">${totalGym} trainingen op ${gymDays} dagen sinds ${esc(fmtDate(minM.toISOString().slice(0, 10)).replace(/^\w+ \d+ /, ''))}</div></div>
      <div class="row gap bc-nav">
        <div class="chips small"><button data-v="month" class="${calView === 'month' ? 'on' : ''}">Maand</button><button data-v="year" class="${calView === 'year' ? 'on' : ''}">Jaar</button></div>
        <button class="btn small ghost" data-step="-1" ${prevOk ? '' : 'disabled'} aria-label="Vorige">‹</button>
        <span class="bc-title">${title}</span>
        <button class="btn small ghost" data-step="1" ${nextOk ? '' : 'disabled'} aria-label="Volgende">›</button>
        <button class="btn small ghost" data-step="0">Vandaag</button>
      </div></div>
    ${body}
    <div class="legend small">Gekleurd = Gym Monster <span class="sq l1"></span>&lt;25 <span class="sq l2"></span>25–45 <span class="sq l3"></span>&gt;45 min · ${calView === 'month' ? `stipjes = wandelen, fietsen enz. · week: trainingen t.o.v. je doel van ${target}` : 'blauw streepje = alleen wandelen, fietsen enz.'} · klik op een dag voor de details</div>`;
  el.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { calView = b.dataset.v; try { localStorage.setItem('gc-cal-view', calView); } catch {} renderBigCal(); }));
  el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const st = +b.dataset.step;
    if (!st) calCursor = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    else if (calView === 'month') calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + st, 1, 12);
    else calCursor = new Date(calCursor.getFullYear() + st, calCursor.getMonth(), 1, 12);
    renderBigCal();
  }));
  el.querySelectorAll('.ym-h').forEach((b) => b.addEventListener('click', () => { calCursor = new Date(calCursor.getFullYear(), +b.dataset.m, 1, 12); calView = 'month'; renderBigCal(); }));
  el.querySelectorAll('[data-date]').forEach((c) => {
    const go = () => openDay(c.dataset.date);
    c.addEventListener('click', go);
    c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
  });
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'analysis') renderBigCal(); }));

// ---------- popup bij een dag in de kalenders ----------
const dayTipEl = document.createElement('div');
dayTipEl.className = 'daytip hidden'; dayTipEl.setAttribute('role', 'tooltip');
document.body.appendChild(dayTipEl);
// Inhoud van de popup bij een dag in de kalender.
function dayTipHtml(date) {
  const gym = (state.trainingDays || []).filter((w) => w.date === date);
  const acts = (state.activities || []).filter((a) => a.date === date);
  const d = new Date(date + 'T12:00:00'), today = new Date(); today.setHours(23, 59, 59);
  const head = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const gymHtml = gym.map((w) => `<div class="dt-row"><span class="dt-dot" style="background:var(--accent)"></span><div><b>${esc(w.title)}</b>
    <div class="dt-meta">${[w.min ? `${w.min} min` : null, w.ex ? `${w.ex} oefeningen` : null, w.vol ? `${w.vol.toLocaleString('nl-NL')} kg` : null, w.kcal ? `${w.kcal} kcal` : null, w.hr ? `♥ ${w.hr} bpm` : null].filter(Boolean).join(' · ')}</div></div></div>`).join('');
  const actHtml = acts.map((a) => `<div class="dt-row"><span class="dt-dot" style="background:${actColor(a.type)}"></span><div><b>${esc(actName(a))}</b>
    <div class="dt-meta">${[a.km ? `${n1nl(a.km)} km` : null, a.minutes ? `${a.minutes} min` : null, a.kcal ? `${Math.round(a.kcal)} kcal` : null, a.hrAvg ? `♥ ${a.hrAvg} bpm` : null].filter(Boolean).join(' · ')}</div></div></div>`).join('');
  const empty = d > today ? 'Nog niet geweest' : 'Rustdag';
  return `<div class="dt-head">${esc(head.charAt(0).toUpperCase() + head.slice(1))}</div>${gymHtml + actHtml || `<div class="dt-meta">${empty}</div>`}${gym.length || acts.length ? '<div class="dt-foot">klik voor details</div>' : ''}`;
}
// Plaatst de popup naast de dag, binnen het scherm.
function placeDayTip(target) {
  const r = target.getBoundingClientRect(), w = dayTipEl.offsetWidth, h = dayTipEl.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
  if (y < 8) y = r.bottom + 8;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  dayTipEl.style.left = x + 'px'; dayTipEl.style.top = y + 'px';
}
let dayTipFor = null;
document.addEventListener('mouseover', (ev) => {
  const c = ev.target.closest('#heat .cd[data-day], #bigCal .bc-d[data-day], #bigCal .ym-d[data-day]');
  if (!c) { if (dayTipFor) { dayTipEl.classList.add('hidden'); dayTipFor = null; } return; }
  const date = c.dataset.day;
  if (!date) return;
  if (c.title) { c.dataset.t = c.title; c.removeAttribute('title'); }
  if (dayTipFor === c) return;
  dayTipFor = c;
  dayTipEl.innerHTML = dayTipHtml(date);
  dayTipEl.classList.remove('hidden');
  placeDayTip(c);
});
window.addEventListener('scroll', () => { if (dayTipFor) { dayTipEl.classList.add('hidden'); dayTipFor = null; } }, { passive: true });

// menubalk onder de kop houden
function setTopH() { document.documentElement.style.setProperty('--topH', ($('.top')?.offsetHeight || 58) + 'px'); }
setTopH(); window.addEventListener('resize', setTopH);

// Withings koppelen gebeurt in een eigen tabblad; dat tabblad meldt het resultaat hier terug
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('#wConnect'); if (!a) return;
  const w = window.open('/api/withings/connect', 'gymcoach-withings');
  if (w) { ev.preventDefault(); toast('Log in bij Withings in het nieuwe tabblad'); }
});
try {
  new BroadcastChannel('gymcoach').addEventListener('message', async (ev) => {
    if (ev.data?.type !== 'withings') return;
    if (ev.data.ok) { toast(`Withings gekoppeld: ${ev.data.added} metingen opgehaald`); await load(); }
    else toast(`Withings koppelen mislukt: ${ev.data.error || ''}`, true);
  });
} catch {}

// ---------- eerste keer: welkom en stappen ----------
function goSettings(pane) { document.querySelector('.tab[data-tab=settings]').click(); showSetPane(pane); window.scrollTo(0, 0); }
// Wizard voor nieuwe gebruikers: voorwaarden, account, voorkeuren, eerste plan.
function renderSetup() {
  const st = state.setup;
  const step = (n, done, title, text, btn) => `<li class="su-step ${done ? 'done' : ''}"><span class="su-n">${done ? '✓' : n}</span><div><b>${title}</b><div class="muted small">${text}</div></div>${btn || ''}</li>`;
  $('#tip').textContent = '';
  $('#nextCard').classList.add('setup');
  const onlyTerms = !st.terms && st.speediance && st.prefs && st.plan;
  const lock = !st.terms ? ' disabled title="Accepteer eerst de voorwaarden"' : '';
  if (onlyTerms) {
    $('#nextCard').innerHTML = `<div class="eyebrow">Voordat je verdergaat</div><div class="hero-title">Voorwaarden en gezondheid</div>
      <ol class="su-list">${step('!', false, 'Lees en accepteer de voorwaarden', 'GymCoach is een hulpmiddel; jij blijft zelf verantwoordelijk voor je training en gezondheid. Lees even hoe dat zit.', '<button class="btn accent small" id="suTerms">Lezen en akkoord</button>')}</ol>`;
    $('#suTerms').addEventListener('click', openTerms);
    return;
  }
  $('#nextCard').innerHTML = `<div class="eyebrow">Welkom bij GymCoach</div>
    <div class="hero-title">In vier stappen aan de slag</div>
    <ol class="su-list">
      ${step(1, st.terms, 'Lees de voorwaarden en het gezondheidsadvies', 'GymCoach is een hulpmiddel, geen arts of trainer. Je traint op eigen verantwoordelijkheid en overlegt met je huisarts voordat je begint.', st.terms ? '' : '<button class="btn accent small" id="suTerms">Lezen en akkoord</button>')}
      ${step(2, st.speediance, 'Koppel je Speediance-account en toestel', st.speediance && state.library?.count ? `Gekoppeld. Oefeningencatalogus van jouw toestel: ${state.library.count} oefeningen${state.library.source === 'standaard' ? ' (standaardlijst)' : ''}.` : 'Met je eigen e-mailadres en wachtwoord van de Speediance-app, en welk toestel je hebt. GymCoach haalt dan de oefeningen van jouw toestel op, en straks je trainingen.', st.speediance ? '' : `<button class="btn accent small" data-go="account"${lock}>Instellen</button>`)}
      ${step(3, st.prefs, 'Kies je doel en trainingsdagen', 'Spieropbouw, afvallen of een combinatie; hoeveel keer per week en hoe lang. Vul ook je geboortejaar in voor de hartslagzones.', `<button class="btn ${st.prefs ? 'ghost' : 'accent'} small" data-go="training"${lock}>${st.prefs ? 'Aanpassen' : 'Instellen'}</button>`)}
      ${step(4, st.plan, 'Maak je eerste weekplan', st.terms && st.speediance && st.prefs ? 'GymCoach maakt een plan op basis van jouw voorkeuren. Daarna zet je het met één klik op de Gym Monster.' : 'Kan zodra de stappen hierboven klaar zijn.', `<button class="btn accent small" id="suPlan" ${st.terms && st.speediance && st.prefs ? '' : 'disabled'}>Maak mijn plan</button>`)}
    </ol>
    <div class="muted small">Optioneel: koppel je <a href="#" data-go="withings">Withings-weegschaal</a> of <a href="#" data-go="health">Apple Health</a> voor gewicht, wandelen en fietsen.</div>`;
  $('#suTerms')?.addEventListener('click', openTerms);
  $('#nextCard').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (ev) => { ev.preventDefault(); if (!b.disabled) goSettings(b.dataset.go); }));
  $('#suPlan')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try { state.plan = (await api('POST', '/api/plan/generate')).plan; toast('Je eerste plan staat klaar'); await load(); document.querySelector('.tab[data-tab=plan]').click(); }
    catch (e) { toast(e.message, true); }
  }));
}

// ---------- voorwaarden en gezondheid ----------
function openTerms() {
  let dlg = $('#termsDlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'termsDlg'; dlg.className = 'terms-dlg'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog" class="terms">
      <div class="exd-head"><h2>Voorwaarden en gezondheid</h2><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
      <div class="terms-body">${TERMS_HTML}</div>
      <label class="inline-check"><input type="checkbox" id="tc1"> Ik heb dit gelezen en gebruik GymCoach op eigen verantwoordelijkheid.</label>
      <label class="inline-check"><input type="checkbox" id="tc2"> Ik overleg met mijn huisarts als een van de gezondheidspunten op mij van toepassing is.</label>
      <div class="row gap"><button type="button" class="btn accent" id="tcOk" disabled>Akkoord</button><button value="close" class="btn ghost">Later</button></div>
    </form>`;
  const ok = dlg.querySelector('#tcOk'), c1 = dlg.querySelector('#tc1'), c2 = dlg.querySelector('#tc2');
  const upd = () => { ok.disabled = !(c1.checked && c2.checked); };
  c1.addEventListener('change', upd); c2.addEventListener('change', upd);
  ok.addEventListener('click', () => busy(ok, async () => {
    try { await api('POST', '/api/terms/accept', { version: TERMS_VERSION }); dlg.close(); toast('Bedankt, je kunt verder'); await load(); }
    catch (e) { toast(e.message, true); }
  }));
  dlg.showModal();
}
// Onderdeel Voorwaarden in Instellingen.
function renderTermsPane() {
  const el = $('#termsPane'); if (!el) return;
  const st = state?.setup || {};
  el.innerHTML = `<h2>Voorwaarden en gezondheid</h2>
    <p class="muted small" style="margin-top:-.4rem">${st.terms && st.termsAt ? `Geaccepteerd op ${new Date(st.termsAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'Nog niet geaccepteerd.'}</p>
    <div class="terms-body">${TERMS_HTML}</div>
    ${st.terms ? '' : '<button type="button" class="btn accent" id="tpAccept">Lezen en akkoord</button>'}`;
  $('#tpAccept')?.addEventListener('click', openTerms);
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'settings') renderTermsPane(); }));
$('#setNav').addEventListener('click', (ev) => { if (ev.target.closest('[data-pane=terms]')) renderTermsPane(); });

// ---------- uitleg: hoe GymCoach werkt ----------
function openExplain(section = 'kort') {
  let dlg = $('#explainDlg');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'explainDlg'; dlg.className = 'terms-dlg explain-dlg'; document.body.appendChild(dlg);
    dlg.innerHTML = `<form method="dialog" class="terms">
      <div class="exd-head"><h2>Hoe GymCoach werkt</h2><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
      <div class="explain">
        <nav class="explain-nav">${EXPLAIN.map((x) => `<button type="button" data-sec="${x.id}">${esc(x.title)}</button>`).join('')}</nav>
        <div class="terms-body explain-body">${EXPLAIN.map((x) => `<section id="ex-${x.id}"><h3>${esc(x.title)}</h3>${x.html}</section>`).join('')}</div>
      </div></form>`;
    const body = dlg.querySelector('.explain-body'), nav = dlg.querySelector('.explain-nav');
    // gekozen onderdeel blijft gemarkeerd, ook als het te kort is om bovenaan te komen (zoals de laatste onderdelen)
    let pinned = null;
    const mark = (id) => {
      nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.sec === id));
      const on = nav.querySelector('.on');
      if (on && nav.scrollWidth > nav.clientWidth && (on.offsetLeft < nav.scrollLeft || on.offsetLeft + on.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = on.offsetLeft - 8;
    };
    const top = (id) => dlg.querySelector('#ex-' + id).offsetTop - body.offsetTop;
    dlg._goto = (id, smooth) => { pinned = id; mark(id); body.scrollTo({ top: top(id), behavior: smooth ? 'smooth' : 'auto' }); };
    nav.addEventListener('click', (ev) => { const b = ev.target.closest('[data-sec]'); if (b) dlg._goto(b.dataset.sec, true); });
    // zelf scrollen (wiel, vinger, toetsen) heft de keuze op
    for (const t of ['wheel', 'touchmove', 'keydown', 'mousedown']) body.addEventListener(t, () => { pinned = null; }, { passive: true });
    body.addEventListener('scroll', () => {
      if (pinned) return;
      let cur = EXPLAIN[0].id;
      for (const x of EXPLAIN) if (top(x.id) <= body.scrollTop + 40) cur = x.id;
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) cur = EXPLAIN[EXPLAIN.length - 1].id; // helemaal onderaan
      mark(cur);
    });
  }
  dlg.showModal();
  dlg._goto(EXPLAIN.some((x) => x.id === section) ? section : EXPLAIN[0].id, false);
}
document.addEventListener('click', (ev) => { const a = ev.target.closest('[data-explain]'); if (a) { ev.preventDefault(); openExplain(a.dataset.explain); } });

// ---------- over GymCoach ----------
async function renderAboutPane() {
  const el = $('#aboutPane'); if (!el) return;
  let a = { version: state?.version };
  el.innerHTML = aboutHtml(a);
  try { a = await api('GET', '/api/about'); el.innerHTML = aboutHtml(a); } catch {}
  el.querySelector('[data-go=terms]')?.addEventListener('click', (ev) => { ev.preventDefault(); showSetPane('terms'); renderTermsPane(); });
}
// Inhoud van Over GymCoach.
function aboutHtml(a) {
  const row = (k, v) => (v ? `<tr><td class="muted">${k}</td><td>${esc(String(v))}</td></tr>` : '');
  return `<div class="about">
    <img src="logo.svg" alt="GymCoach-logo" class="about-logo" width="88" height="88">
    <div>
      <h2 style="margin:0">GymCoach</h2>
      <div class="about-ver">Versie ${esc(a.version || '—')}</div>
      <p>Persoonlijk trainingsdashboard voor de Speediance Gym Monster. GymCoach maakt een weekplan met automatische progressie, zet het met één klik op je toestel en laat zien hoe je vooruitgaat: per training, per spiergroep, en samen met je metingen van Withings en je activiteiten uit Apple Health.</p>
      <p><button type="button" class="btn ghost small" data-explain="kort">Hoe GymCoach werkt</button> <button type="button" class="btn ghost small" data-explain="meten">Hoe we meten</button></p>
      <p class="muted small">© 2026 A. Stoelwinder Holding B.V. GymCoach is open source onder de MIT-licentie: je mag het vrij gebruiken, aanpassen en delen. Niet verbonden aan Speediance, Withings of Apple. <a href="#" data-go="terms">Voorwaarden en gezondheid</a></p>
      <table class="about-tbl"><tbody>
        ${row('GymCoach', a.version)}${row('Node.js', a.node)}${row('speediance-cli', a.cli)}${row('Gebruikers', a.users)}${row('Server gestart', a.started && new Date(a.started).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }))}
      </tbody></table>
    </div></div>`;
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'settings' && setPane === 'about') renderAboutPane(); }));
$('#setNav').addEventListener('click', (ev) => { if (ev.target.closest('[data-pane=about]')) renderAboutPane(); });


// ---------- popup voor grafieken die als SVG-tekst worden gemaakt (hartslag) ----------
// Elementen met data-tip (regels gescheiden door \n; de eerste regel vet) en optioneel data-zc (kleur van de zone).
(() => {
  const tip = document.createElement('div'); tip.className = 'ctip gtip hidden'; document.body.appendChild(tip);
  let cur = null;
  const show = (el, x, y) => {
    if (el !== cur) {
      cur = el;
      // in een venster (dialog, bovenste laag) moet de popup in dat venster staan om zichtbaar te zijn
      const host = el.closest('dialog[open]') || document.body;
      if (tip.parentNode !== host) host.appendChild(tip);
      const [first, ...rest] = el.dataset.tip.split('\n');
      tip.innerHTML = `<div class="tdate">${esc(first)}</div>${rest.map((l) => `<div class="trow">${esc(l)}</div>`).join('')}`;
      const zc = el.dataset.zc; tip.classList.toggle('zoned', !!zc); if (zc) tip.style.setProperty('--zc', zc); else tip.style.removeProperty('--zc');
      tip.classList.remove('hidden');
    }
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(Math.max(x - tw / 2, 4), innerWidth - tw - 4) + 'px';
    tip.style.top = (y - th - 14 < 4 ? y + 18 : y - th - 14) + 'px';
  };
  const hide = () => { cur = null; tip.classList.add('hidden'); };
  document.addEventListener('mousemove', (ev) => { const el = ev.target.closest?.('[data-tip]'); if (el) show(el, ev.clientX, ev.clientY); else if (cur) hide(); });
  document.addEventListener('touchstart', (ev) => { const el = ev.target.closest?.('[data-tip]'); if (el) { const t = ev.touches[0]; cur = null; show(el, t.clientX, t.clientY); } else hide(); }, { passive: true });
  document.addEventListener('scroll', hide, true);
})();


// ---------- eigen trainingen en sjablonen (Mijn trainingen / gedeeld) ----------
// Context voor de editor (zie editor.js).
const edCtx = (extra = {}) => ({ state, api, esc, toast, weekLabel: (p) => `week ${planIso(p).w} · ${planIso(p).y}`, onSaved: (plan) => { state.plan = plan; renderPlan(); }, onTemplates: loadTemplates, ...extra });
let tplTab = 'mine', tplData = { mine: [], shared: [] };
// Haalt de sjablonen op en tekent het paneel Trainingen.
async function loadTemplates() {
  try { tplData = await api('GET', '/api/templates'); } catch { tplData = { mine: [], shared: [] }; }
  renderTemplates();
}
// Paneel met eigen en gedeelde sjablonen onder het plan.
function renderTemplates() {
  const box = $('#tplCard'); if (!box) return;
  const list = tplTab === 'mine' ? tplData.mine : tplData.shared;
  const item = (x) => `<div class="tpl-item" data-id="${esc(x.id)}">
    <div class="row between wrap gap"><b>${esc(x.name)}</b><span class="muted small">${x.mine ? (x.shared ? `<span class="badge custom">${t('tp.sharedBadge')}</span>` : '') : esc(t('nt.by', { name: x.owner }))}</span></div>
    <div class="muted small">${esc(t('tp.sum', { n: x.count, sets: x.sets, min: x.estMinutes ? ` · ~${x.estMinutes} min` : '' }))}</div>
    <div class="muted small tpl-ex">${x.exercises.slice(0, 6).map(esc).join(' · ')}${x.exercises.length > 6 ? ' …' : ''}</div>
    <div class="row gap wrap">
      <button class="btn accent small" data-tpl="use">${t('tp.inPlan')}</button>
      ${x.mine ? `<button class="btn ghost small" data-tpl="edit">${t('tp.edit')}</button>
        <button class="btn ghost small" data-tpl="share">${x.shared ? t('tp.unshare') : t('tp.share')}</button>
        <button class="btn ghost small danger-text" data-tpl="del">${t('tp.delete')}</button>` : `<button class="btn ghost small" data-tpl="copy">${t('tp.copyMine')}</button>`}
    </div></div>`;
  box.innerHTML = `<div class="row between wrap gap"><h2 style="margin:0">${t('tp.title')}</h2>
      <div class="row gap"><button class="chip ${tplTab === 'mine' ? 'on' : ''}" data-tpltab="mine">${t('tp.mine', { n: tplData.mine.length })}</button><button class="chip ${tplTab === 'shared' ? 'on' : ''}" data-tpltab="shared">${t('tp.shared', { n: tplData.shared.length })}</button></div></div>
    ${list.length ? `<div class="tpl-grid">${list.map(item).join('')}</div>` : `<p class="muted small">${tplTab === 'mine' ? t('tp.emptyMine') : t('tp.emptyShared')}</p>`}
    ${tplTab === 'shared' && list.length ? `<p class="muted small">${t('tp.weightsNote')}</p>` : ''}`;
}
$('#tplCard').addEventListener('click', async (ev) => {
  const tb = ev.target.closest('[data-tpltab]'); if (tb) { tplTab = tb.dataset.tpltab; renderTemplates(); return; }
  const b = ev.target.closest('[data-tpl]'); if (!b) return;
  const id = b.closest('.tpl-item').dataset.id, act = b.dataset.tpl;
  const x = [...tplData.mine, ...tplData.shared].find((y) => y.id === id); if (!x) return;
  try {
    if (act === 'use') {
      const r = await api('POST', '/api/plan/session', { mode: 'template', from: id });
      state.plan = r.plan; renderPlan(); toast(t('tp.added', { name: x.name }));
    } else if (act === 'edit') {
      const r = await api('GET', '/api/template?id=' + encodeURIComponent(id));
      openEditor(null, edCtx({ template: { session: { ...r.template, key: '__tpl' }, onSave: async (draft) => { await api('POST', '/api/templates', { id, name: draft.name, session: draft }); await loadTemplates(); } } }));
    } else if (act === 'share') {
      await api('PUT', '/api/templates/share', { id, shared: !x.shared }); toast(x.shared ? t('tp.sharedOff') : t('tp.sharedOn')); await loadTemplates();
    } else if (act === 'del') {
      if (!confirm(t('tp.deleteConfirm', { name: x.name }))) return;
      await api('DELETE', '/api/templates?id=' + encodeURIComponent(id)); await loadTemplates();
    } else if (act === 'copy') {
      const r = await api('GET', '/api/template?id=' + encodeURIComponent(id));
      await api('POST', '/api/templates', { name: r.template.name, session: r.template }); tplTab = 'mine'; await loadTemplates();
    }
  } catch (e) { toast(e.message, true); }
});
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'plan') loadTemplates(); }));

// Venster "Nieuwe training": leeg, kopie van een training uit het plan, of uit een sjabloon.
$('#newSessBtn').addEventListener('click', async () => {
  if (!state.plan) { toast('Maak eerst een plan', true); return; }
  await loadTemplates();
  let dlg = $('#newSessDlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'newSessDlg'; dlg.className = 'wide-dlg'; document.body.appendChild(dlg); }
  const copies = state.plan.sessions.filter((x) => !x.outdoor);
  const opt = (v, label, sub = '') => `<label class="ns-opt"><input type="radio" name="ns" value="${esc(v)}"> <span><b>${esc(label)}</b>${sub ? `<br><span class="muted small">${esc(sub)}</span>` : ''}</span></label>`;
  dlg.innerHTML = `<form method="dialog" class="exd">
    <div class="exd-head"><div><div class="eyebrow">${t('nt.title')}</div><h2>${t('nt.title')}</h2></div><button value="close" class="btn ghost small" aria-label="Sluiten">✕</button></div>
    <label>${t('nt.name')} <input name="name" maxlength="40" placeholder="${esc(t('nt.namePh'))}"></label>
    <div class="eyebrow" style="margin:0">${t('nt.start')}</div>
    <div class="ns-list">
      ${opt('empty:', t('nt.empty'), t('nt.emptySub'))}
      ${copies.length ? `<div class="muted small">${t('nt.copy')}</div>${copies.map((x) => opt('copy:' + x.key, x.name, `${x.exercises.length} oefeningen`)).join('')}` : ''}
      <div class="muted small">${t('nt.mine')}</div>${tplData.mine.length ? tplData.mine.map((x) => opt('template:' + x.id, x.name, t('tp.sum', { n: x.count, sets: x.sets, min: '' }))).join('') : `<div class="muted small">${t('nt.noTpl')}</div>`}
      ${tplData.shared.length ? `<div class="muted small">${t('nt.shared')}</div>${tplData.shared.map((x) => opt('template:' + x.id, x.name, t('nt.by', { name: x.owner }))).join('')}` : ''}
    </div>
    <div class="row gap end"><button value="close" class="btn ghost">Annuleren</button><button type="button" class="btn accent" id="nsMake">${t('nt.make')}</button></div>
  </form>`;
  dlg.querySelector('input[value="empty:"]').checked = true;
  dlg.querySelector('#nsMake').addEventListener('click', () => busy(dlg.querySelector('#nsMake'), async () => {
    const [mode, from] = dlg.querySelector('input[name=ns]:checked').value.split(/:(.*)/s);
    try {
      const r = await api('POST', '/api/plan/session', { mode, from, name: dlg.querySelector('input[name=name]').value.trim() || undefined });
      state.plan = r.plan; renderPlan(); dlg.close();
      openEditor(r.key, edCtx());
    } catch (e) { toast(e.message, true); }
  }));
  dlg.showModal();
});
