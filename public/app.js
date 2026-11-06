// GymCoach — de app in de browser (één bestand, geen framework).
// Tabbladen: Overzicht, Plan, Statistieken, Analyse, Voortgang, Lichaam en Instellingen.
// Alle gegevens komen van de eigen server via api(); grafieken zijn zelfgemaakte SVG's.
import { bodyMap, MUSCLE_LABELS, figureFor, setDefaultFigure } from './bodymap.js';
import { TERMS_VERSION, termsHtml } from './terms.js';
import { explain } from './explain.js';
import { openEditor } from './editor.js';
import { t, t as tx, tmap, localeOf, has, setLang, resolveLang, applyI18n, LANGS, fmtNum, doseText, getLang } from './i18n.js';
import { askConfirm, askText } from './dialogs.js';
import { langPicker, storedLang, storeLang } from './langpick.js';

// taal vóór het inloggen: de keuze op het inlogscherm, anders die van de browser; na het laden die van de gebruiker (zie load)
setLang(resolveLang(storedLang(), navigator.languages || [navigator.language]));
applyI18n();
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const GOAL = tmap({ spieropbouw: '§app.goal.spieropbouw', combinatie: '§app.goal.combinatie', afvallen: '§app.goal.afvallen', gemengd: '§app.goal.gemengd', circuit: '§app.goal.circuit', buiten: '§app.goal.buiten' });
const DAY_TYPES = tmap({ spieropbouw: '§app.daytypes.spieropbouw', combinatie: '§app.daytypes.combinatie', afvallen: '§app.daytypes.afvallen', circuit: '§app.daytypes.circuit', buiten: '§app.daytypes.buiten' });
// categorieën van activiteiten uit Apple Health (de soort zelf, bijv. "Voetbal" of "Padel", staat in a.label)
const ACT = tmap({ wandelen: ['§app.act.wandelen', '#6c9cff', '🚶'], fietsen: ['§app.act.fietsen', '#e5b84b', '🚴'], hardlopen: ['§app.act.hardlopen', '#ff6b9a', '🏃'], zwemmen: ['§app.act.zwemmen', '#4cc9e5', '🏊'], roeien: ['§app.act.roeien', '#9b8cff', '🚣'],
  racket: ['§app.act.racket', '#d6e04b', '🎾'], teamsport: ['§app.act.teamsport', '#3fd29a', '⚽'], water: ['§app.act.water', '#3f8fe0', '🏄'], wintersport: ['§app.act.wintersport', '#a9dcff', '⛷️'], vechtsport: ['§app.act.vechtsport', '#e0705a', '🥊'], dans: ['§app.act.dans', '#ff8fd0', '💃'],
  kracht: ['§app.act.kracht', '#4cc26a', '🏋️'], hiit: ['§app.act.hiit', '#ff9f43', '⚡'], yoga: ['§app.act.yoga', '#c77dff', '🧘'], elliptical: ['§app.act.elliptical', '#7fd1ae', '🏃'], overig: ['§app.act.overig', '#9a9ca1', '•'] });
const actLabel = (t) => (ACT[t] || ACT.overig)[0], actColor = (t) => (ACT[t] || ACT.overig)[1];
// kalenderweek van het plan, zoals in de programmanaam op het toestel ("GC 2026-W45 Full Body A")
function isoWeekOf(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return { y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) }; }
const planIso = (p) => isoWeekOf(new Date(p?.generatedAt || Date.now()));
const planLabel = (p) => { const { y, w } = planIso(p); return `${y}-W${String(w).padStart(2, '0')}`; };
const progName = (p, s) => `GC ${planLabel(p)} ${s.name}`;
const actName = (a) => (a.label ? (has('actname.' + a.label) ? t('actname.' + a.label) : a.label) : actLabel(a.type));
const actLine = (a) => `${actName(a)}${a.km ? ` ${(Math.round(a.km * 10) / 10).toLocaleString(localeOf())} km` : ''}${a.minutes ? ` · ${a.minutes} min` : ''}`;
const DAY_SHORT = tmap({ spieropbouw: '§app.dayshort.spieropbouw', combinatie: '§app.dayshort.combinatie', afvallen: '§app.dayshort.afvallen', circuit: '§app.dayshort.circuit', buiten: '§app.dayshort.buiten' });

let state = null;

// Roept de GymCoach-API aan (JSON); gooit een fout met de melding van de server.
async function api(method, url, data) {
  const headers = data ? { 'content-type': 'application/json' } : {};
  if (storedLang()) headers['accept-language'] = storedLang(); // gekozen taal ook voor meldingen en mails van de server
  const r = await fetch(url, { method, headers, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.login) { showAuth('login'); throw new Error(t('app.logOpnieuwIn')); }
  // fout met een code uit het woordenboek: in de taal van de browserkant tonen
  if (!r.ok) throw new Error(j.code && has(j.code) ? t(j.code, j.vars || {}) : j.error || t('app.http', { status: r.status }));
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
const THEMES = tmap({ dark: ['🌙', '§app.themes.dark'], light: ['☀️', '§app.themes.light'], auto: ['🖥️', '§app.themes.auto'] });
// Licht of donker thema toepassen en onthouden.
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  try { localStorage.setItem('gc-theme', t); } catch {}
  const [icon, label] = THEMES[t];
  $('#themeBtn').textContent = icon; $('#themeBtn').title = tx('app.themaKlikOmTe', { label });
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#0f1012' : '#f4f3ef';
}
let theme = 'dark';
try { theme = localStorage.getItem('gc-theme') || 'dark'; } catch {}
applyTheme(theme);
// Thema kiezen (knop in de menubalk of het gebruikersvenster); grafieken opnieuw tekenen in de nieuwe kleuren.
function setTheme(next) {
  theme = next;
  applyTheme(theme); toast(t('app.thema', { a: THEMES[theme][1] }));
  if (state) { renderHome(); if ($('#tab-progress').classList.contains('active')) renderProgress(); if ($('#tab-body').classList.contains('active')) renderBody(); }
}
$('#themeBtn').addEventListener('click', () => { const order = ['dark', 'light', 'auto']; setTheme(order[(order.indexOf(theme) + 1) % 3]); });

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
const fmtDate = (x) => { const d = new Date(String(x).slice(0, 10) + 'T12:00:00'); if (isNaN(d)) return String(x); const t = d.toLocaleDateString(localeOf(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
// eenheid voor de y-as: kort en leesbaar
const axisUnit = (u) => ({ '%-punt': '%-pt' }[u] ?? u ?? '');
const fmtTick = (v, dec, unit) => `${v.toLocaleString(localeOf(), { minimumFractionDigits: dec, maximumFractionDigits: dec })}${unit ? (/^[%×]/.test(unit) ? '' : ' ') + unit : ''}`;

// Lijngrafiek (SVG) met een of meer reeksen, as-labels en tooltip.
function lineChart(el, series, { yLabel = '', fromZero = false, yUnit, marks = [], onPick, bands = null, zoneColor = null } = {}) {
  const pts = series.flatMap((s) => s.points);
  if (pts.length < 1) { el.innerHTML = '<div class="empty">' + t('app.nogGeenData') + '</div>'; return; }
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
    if (tr.length) rows += tr.map((m) => `<div class="trow"><span class="dot tm"${m.color ? ` style="background:${m.color}"` : ''}></span>${m.color ? '' : t('app.getraind')}<b>${esc(m.label)}</b></div>`).join('');
    tip.dataset.x = best;
    // gekleurde lijn bovenaan: de band (goed/let op/niet goed) of zone waar de waarde van de eerste reeks in valt
    const q0 = series[0]?.points.find((p) => p.x === best);
    const zc = q0 ? (zoneColor ? zoneColor(q0.y) : BAND_COLORS[bandOf(bands, q0.y)]) : null;
    tip.classList.toggle('zoned', !!zc); if (zc) tip.style.setProperty('--zc', zc); else tip.style.removeProperty('--zc');
    tip.innerHTML = `<div class="tdate">${esc(fmtDate(best))}</div>${rows}${tr.length && onPick ? '<div class="small muted">' + t('app.klikVoorDetails') + '</div>' : ''}`;
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
  if (!items.length) { el.innerHTML = '<div class="empty">' + t('app.nogGeenData') + '</div>'; return; }
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
  if (state.setup && !state.setup.speediance) { s.textContent = t('app.speedianceNogNietGekoppeld'); s.title = t('app.instellingenSpeedianceAccount'); s.style.color = ''; return; }
  if (m.lastSyncError) { s.textContent = t('app.syncFout'); s.title = m.lastSyncError; s.style.color = 'var(--warn)'; }
  else if (m.lastSync) { s.textContent = t('app.gesynct') + new Date(m.lastSync).toLocaleString(localeOf(), { dateStyle: 'short', timeStyle: 'short' }); s.style.color = ''; s.title = ''; }
  else s.textContent = t('app.nogNietGesynct');
}

const pushMob = () => state?.settings?.pushMobility === 'on';
// Kleur van een advies: omhoog, omlaag of neutraal.
function noteClass(n = '') { return n.startsWith('↑') ? 'up' : n.startsWith('↓') ? 'down' : ''; }

const FOCUS_LABELS = tmap({ armen: '§app.focuslabels.armen', borst: '§app.focuslabels.borst', schouders: '§app.focuslabels.schouders', bovenrug: '§app.focuslabels.bovenrug', onderrug: '§app.focuslabels.onderrug', core: '§app.focuslabels.core', billen: '§app.focuslabels.billen', benen: '§app.focuslabels.benen' });
const FOCUS_WORDS = {
  armen: ['arm', 'biceps', 'triceps'], borst: ['borst', 'pecs', 'chest'], schouders: ['schouder', 'delt'],
  bovenrug: ['bovenrug', 'rug', 'lats', 'trapez'], onderrug: ['onderrug', 'lage rug'], core: ['buik', 'core', 'abs', 'romp'],
  billen: ['bil', 'glute'], benen: ['been', 'benen', 'quad', 'hamstring', 'kuit'],
};
const setsSummary = (e) => `${e.sets.length} × ${e.sets[0]?.reps} · ${e.sets[0]?.weight} kg`;
const MAX_MUSCLE = () => Math.max(1, ...Object.values(state.plan?.muscles || {}));

// ---------- vorige weken ----------
// Het tabblad Plan kan terugbladeren naar bewaarde weekplannen: per training gepland tegenover gedaan, per oefening.
const nlNum = (n) => Number(n || 0).toLocaleString(localeOf(), { maximumFractionDigits: 1 });
let pastWeek = null;       // null = deze week, anders "2026-W44"
let weekList = null;       // [{ week, planned, done, … }] uit het archief, nieuwste eerst
let pastData = null;       // het rapport van de bekeken week

// Haalt de lijst met bewaarde weken op (één keer per bezoek aan Plan).
async function loadWeekList() {
  try { weekList = (await api('GET', '/api/plan/weeks')).weeks; } catch { weekList = []; }
  updateWeekNav();
}
// Zet de pijltjes aan of uit: terug als er een oudere week is, vooruit als je niet in deze week zit.
function updateWeekNav() {
  const cur = state.plan ? planLabel(state.plan) : null;
  const at = pastWeek || cur;
  const older = (weekList || []).filter((w) => w.week < at && w.week !== cur);
  $('#wkPrev').disabled = !older.length;
  $('#wkNext').disabled = !pastWeek;
}
// Naar een andere week; null = terug naar deze week.
async function gotoWeek(week) {
  const cur = state.plan ? planLabel(state.plan) : null;
  pastWeek = week && week !== cur ? week : null;
  document.querySelectorAll('#tab-plan .cur-only').forEach((el) => el.classList.toggle('hidden', !!pastWeek));
  $('#pastWeek').classList.toggle('hidden', !pastWeek);
  if (pastWeek) { $('#coachPanel').classList.add('hidden'); $('#pastWeek').innerHTML = '<div class="card muted">' + t('pk.loading') + '</div>'; try { pastData = await api('GET', '/api/plan/week?w=' + pastWeek); } catch (e) { pastData = null; toast(e.message, true); } }
  else { pastData = null; renderCoach(state.meta?.coach || null); }
  renderPlan();
}
$('#wkPrev').addEventListener('click', () => {
  const cur = state.plan ? planLabel(state.plan) : null, at = pastWeek || cur;
  const prev = (weekList || []).find((w) => w.week < at && w.week !== cur);
  if (prev) gotoWeek(prev.week);
});
$('#wkNext').addEventListener('click', () => {
  const cur = state.plan ? planLabel(state.plan) : null;
  const next = [...(weekList || [])].reverse().find((w) => w.week > pastWeek && w.week !== cur);
  gotoWeek(next ? next.week : null);
});

// Sets kort opschrijven: "3 × 10 × 20 kg" als ze gelijk zijn, anders "10×20 · 8×22 kg".
function setsShort(sets) {
  if (!sets?.length) return '—';
  const same = sets.every((x) => x.reps === sets[0].reps && x.weight === sets[0].weight);
  const kg = (w) => nlNum(w);
  return same ? `${sets.length} × ${sets[0].reps} × ${kg(sets[0].weight)} kg` : sets.map((x) => `${x.reps}×${kg(x.weight)}`).join(' · ') + ' kg';
}
const PW_STATUS = tmap({ ok: ['ok', '✓', '§app.pwstatus.ok'], less: ['less', '↓', '§app.pwstatus.less'], more: ['more', '↑', '§app.pwstatus.more'], missed: ['missed', '–', '§app.pwstatus.missed'] });

// Toont een vorige week: samenvatting en per training de oefeningen, gepland tegenover gedaan.
function renderPastWeek() {
  const [y, w] = pastWeek.split('-W');
  $('#planTitle').textContent = t('app.week2', { a: +w, y });
  updateWeekNav();
  const d = pastData;
  if (!d) { $('#planMeta').textContent = ''; $('#pastWeek').innerHTML = '<div class="card muted">' + t('app.geenPlanBewaardVoor') + '</div>'; return; }
  const sm = d.summary;
  $('#planMeta').innerHTML = `${t('app.terugkijken')} <span class="badge">${t('app.alleenBekijken')}</span> · <a href="#" id="pwBack">${t('app.naarDezeWeek')}</a>`;
  const card = (s) => {
    const dn = s.done;
    const when = dn ? new Date(dn.date + 'T12:00:00').toLocaleDateString(localeOf(), { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const rows = s.exercises.map((e) => {
      const [cls, ico, tip] = dn ? PW_STATUS[e.status] : ['none', '', t('app.nietGedaan')];
      return `<tr class="pw-${cls}"><td>${e.group ? `<span class="badge ss">${esc(e.group)}</span> ` : ''}${esc(e.title)}</td><td class="pw-n">${setsShort(e.planned)}</td><td class="pw-n">${dn ? setsShort(e.done) : ''}</td><td class="pw-st" title="${tip}" data-tip="${tip}">${ico}</td></tr>`;
    }).join('') + s.extra.map((e) => `<tr class="pw-extra"><td>${esc(e.title)} <span class="muted small">${t('app.nietGepland')}</span></td><td class="pw-n">—</td><td class="pw-n">${setsShort(e.done)}</td><td class="pw-st" data-tip="${t('app.extraGedaan')}">+</td></tr>`).join('');
    return `<article class="card pw-card ${dn ? 'pw-done' : 'pw-skip'}" data-key="${esc(s.key)}">
      <header class="row between wrap gap"><div><h3 style="margin:0">${esc(s.name)}${s.custom ? ` <span class="badge custom">${t('ed.badgeCustom')}</span>` : ''}</h3>
        <div class="small ${dn ? '' : 'muted'}">${dn ? `<span class="badge ok">${t('app.gedaan', { a: esc(when) })}</span> ${dn.minutes ? t('app.min6', { minutes: dn.minutes }) : ''}${dn.volume ? `${nlNum(dn.volume)} kg` : ''}` : '<span class="badge warn">' + t('app.nietGedaan') + '</span>'}</div></div>
        <div class="row gap wrap">${dn ? '<button type="button" class="btn ghost small" data-pw="view">' + t('app.rapport') + '</button>' : ''}
          <button type="button" class="btn ghost small" data-pw="copy">${t('app.kopieerNaarDezeWeek')}</button>
          <button type="button" class="btn ghost small" data-pw="tpl">${t('ed.asTemplate')}</button></div></header>
      ${s.exercises.length || s.extra.length ? `<table class="pw-tbl"><thead><tr><td>${t('app.oefening')}</td><td class="pw-n">${t('app.gepland')}</td><td class="pw-n">${t('app.gedaan2')}</td><td></td></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted small">' + t('app.geenOefeningen') + '</p>'}
    </article>`;
  };
  $('#pastWeek').innerHTML = `<div class="card pw-sum">
      <div class="pw-tiles">
        <div><span class="eyebrow">${t('tp.title')}</span><b>${t('app.van', { done: sm.done, planned: sm.planned })}</b></div>
        <div><span class="eyebrow">${t('app.setsGehaald')}</span><b>${t('app.van2', { doneSets: sm.doneSets, plannedSets: sm.plannedSets })}</b></div>
        <div><span class="eyebrow">${t('ed.volume')}</span><b>${nlNum(sm.volume)} kg</b></div>
        <div><span class="eyebrow">${t('app.tijd')}</span><b>${sm.minutes} min</b></div>
      </div>
      <div class="muted small pw-legend"><span class="pw-ok">${t('app.gehaald')}</span><span class="pw-less">${t('app.minderDanGepland')}</span><span class="pw-more">${t('app.meer')}</span><span class="pw-missed">${t('app.nietGedaan2')}</span></div>
    </div>
    <div class="pw-grid">${d.sessions.map(card).join('')}</div>`;
  $('#pwBack')?.addEventListener('click', (ev) => { ev.preventDefault(); gotoWeek(null); });
  $('#pastWeek').querySelectorAll('.pw-card').forEach((c) => {
    const s = d.sessions.find((x) => x.key === c.dataset.key);
    const src = d.plan?.sessions.find((x) => x.key === s.key);
    c.querySelector('[data-pw=view]')?.addEventListener('click', () => openWorkouts([s.done.id]));
    c.querySelector('[data-pw=copy]').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
      try {
        const r = await api('POST', '/api/plan/session', { mode: 'copy', week: pastWeek, from: s.key, name: s.name });
        state.plan = r.plan; toast(t('app.staatNuOokIn', { name: s.name })); gotoWeek(null);
      } catch (e) { toast(e.message, true); }
    }));
    c.querySelector('[data-pw=tpl]').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
      const name = await askText(t('ed.tplName'), s.name); if (!name || !src) return;
      try { await api('POST', '/api/templates', { name, session: src }); toast(t('ed.tplSaved', { name })); loadTemplates(); } catch (e) { toast(e.message, true); }
    }));
  });
}

// Tabblad Plan: weekoverzicht, spierkaart, trainingen en knoppen.
function renderPlan() {
  const plan = state.plan;
  const wrap = $('#sessions');
  if (!plan || state.setup?.needed) {
    $('#planTitle').textContent = t('ui.plan.weekplan');
    $('#planMeta').innerHTML = state.setup?.needed ? '' + t('app.nogGeenPlanDoorloop') + ' <a href="#" onclick="document.querySelector(\'.tab[data-tab=home]\').click();return false">' + t('ui.tabs.overzicht') + '</a>' + t('app.speedianceAccountJeVoorkeuren') + '' : t('app.nogGeenPlanKlik');
    $('#planOverview').innerHTML = ''; wrap.innerHTML = ''; return;
  }
  if (pastWeek) return renderPastWeek();
  $('#planTitle').textContent = t('app.week3', { w: planIso(plan).w, y: planIso(plan).y });
  updateWeekNav();
  const nDone = plan.sessions.filter((x) => !x.outdoor && doneOf(x)).length, nGym = plan.sessions.filter((x) => !x.outdoor).length;
  $('#planMeta').innerHTML = t('app.perWeekBron', { a: GOAL[plan.goal] || plan.goal, daysPerWeek: plan.daysPerWeek, b: esc(String(plan.source || '').replace('regels', t('app.src.rules'))) }) + (plan.deload ? ' · <span class="badge warn"' + (plan.deloadReason === 'recovery' ? ` title="${t('sig.deloadEarly')}"` : '') + '>' + t('app.deloadWeek') + (plan.deloadReason === 'recovery' ? ' · ' + t('sig.deloadEarlyShort') : '') + '</span>' : '')
    + (nDone ? ` · <span class="badge ok">${t('app.vanGedaan', { nDone, nGym, a: nDone >= nGym ? t('app.weekCompleet') : '' })}</span>` : '');

  renderWeekMap();

  wrap.innerHTML = plan.sessions.map((s) => s.outdoor ? `
    <article class="card session outdoor" data-key="${esc(s.key)}">
      <header><div><h3>${esc(s.name)}</h3><div class="muted small">${t('app.min', { estMinutes: s.estMinutes })} <span class="badge">${esc(DAY_SHORT.buiten)}</span></div></div>
        <div class="out-ico" aria-hidden="true">🚶‍♂️🚴</div></header>
      <p class="small">${esc(s.advice || '')}</p>
      ${outdoorDone(s)}
      <p class="muted small">${t('app.geenProgrammaVoorDe')}</p>
    </article>` : `
    <article class="card session${doneOf(s) ? ' done' : ''}" data-key="${esc(s.key)}">
      <header><div><h3>${esc(s.name)}${s.locked ? ` <span class="badge lock-on" title="${t('ed.locked')}">🔒 ${t('ed.badgeLocked')}</span>` : ''}${s.edited ? ` <span class="badge">${t('ed.badgeEdited')}</span>` : ''}${s.custom ? ` <span class="badge custom">${t('ed.badgeCustom')}</span>` : ''}${s.lightened ? ` <span class="badge" title="${t('sig.lightenedHint')}">${t('sig.lightened')}</span>` : ''}</h3><div class="muted small">${t('app.minOefeningen', { estMinutes: s.estMinutes, n: s.exercises.length, a: s.type && s.type !== 'eigen' && plan.goal === 'gemengd' ? ` · <span class="badge">${esc(DAY_SHORT[s.type] || s.type)}</span>` : s.type === 'circuit' ? ' · <span class="badge">' + t('app.cardioCircuit') + '</span>' : '', b: doneOf(s) ? '' : s.pushedAt ? '· <span class="badge ok">' + t('app.opToestel') + '</span>' : s.changedAfterPush ? '· <span class="badge warn">' + t('app.gewijzigdOpnieuwOpToestel') + '</span>' : '' })}</div></div>
        <div class="mini-map">${bodyMap(s.muscles || {}, { height: 92, labels: false, title: s.name })}</div></header>
      ${s.warmup && (s.warmup.mobility.length + s.warmup.cable.length) ? `<button class="row-item wc" data-open="warm"><span class="ri-dot warm"></span><span class="ri-name">${t('ed.warmup')}</span><span class="ri-sum">${t('app.oef6Min', { a: s.warmup.mobility.length + s.warmup.cable.length })}</span><span class="ri-chev" aria-hidden="true">›</span></button>` : ''}
      ${s.exercises.map((e, i) => `
        <button class="row-item${exDone(s, e) ? ' ex-done' : ''}" data-open="ex" data-i="${i}">
          ${exDone(s, e) ? '<span class="ri-check" title="' + t('app.gedaan3') + '">✓</span>' : `<span class="ri-dot ${e.focus ? 'focus' : ''}" title="${e.focus ? t('app.focusDezeWeek') : ''}"></span>`}
          <span class="ri-name">${e.group ? `<span class="badge ss">${e.group}${s.exercises.slice(0, i + 1).filter((x) => x.group === e.group).length}</span> ` : ''}${esc(e.title)}</span>
          <span class="ri-sum">${setsSummary(e)}${/^↑/.test(e.note || '') ? ' <span class="up">↑</span>' : /^↓/.test(e.note || '') ? ' <span class="down">↓</span>' : ''}</span>
          <span class="ri-chev" aria-hidden="true">›</span>
        </button>`).join('')}
      ${s.cooldown?.length ? `<button class="row-item wc" data-open="cool"><span class="ri-dot cool"></span><span class="ri-name">${t('ed.cooldown')}</span><span class="ri-sum">${t('app.stretchesMin', { n: s.cooldown.length, a: coolMin(s.cooldown) })}</span><span class="ri-chev" aria-hidden="true">›</span></button>` : ''}
      ${doneBanner(s)}
      <footer>${doneOf(s) ? `
        <button class="btn accent" data-act="view">${t('app.bekijkTraining')}</button>
        <button class="btn ghost" data-act="edit">${t('ed.edit')}</button>
        <button class="btn ghost" data-act="lock" title="${s.locked ? t('ed.unlockHint') : t('ed.lockHint')}">${s.locked ? t('ed.unlock') : t('ed.lock')}</button>
        ${s.edited ? `<button class="btn ghost" data-act="revert">${t('ed.reset')}</button>` : ''}
        <button class="btn ghost" data-act="push">${t('app.opnieuwOpToestel')}</button>` : `
        <button class="btn ghost" data-act="edit">${t('ed.edit')}</button>
        <button class="btn ghost" data-act="lock" title="${s.locked ? t('ed.unlockHint') : t('ed.lockHint')}">${s.locked ? t('ed.unlock') : t('ed.lock')}</button>
        ${s.edited ? `<button class="btn ghost" data-act="revert">${t('ed.reset')}</button>` : ''}
        ${s.custom ? `<button class="btn ghost" data-act="remove">${t('ed.removeFromPlan')}</button>` : ''}
        ${state.settings.ai?.provider && state.settings.ai.provider !== 'none' ? `<button class="btn ghost" data-act="coach" title="${t('app.laatDeAiCoach')}">${t('app.aiAdvies')}</button>` : ''}
        <button class="btn ghost" data-act="dry">${t('app.controleer')}</button>
        <button class="btn accent" data-act="push">${t('app.zetOpGymMonster')}</button>`}
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
  const day = new Date(d.date + 'T12:00:00').toLocaleDateString(localeOf(), { weekday: 'short', day: 'numeric', month: 'short' });
  const facts = [d.minutes ? `${d.minutes} min` : null, d.volume ? `${d.volume.toLocaleString(localeOf())} kg` : null, d.kcal ? `${d.kcal} kcal` : null].filter(Boolean).join(' · ');
  return `<div class="done-banner"><span class="done-check">✓</span><div><b>${t('app.gedaanOp', { a: esc(day) })}</b>${facts ? `<div class="small">${esc(facts)}</div>` : ''}</div></div>`;
}

// cardio buiten: laat zien wat er deze week al via Apple Health binnenkwam
function outdoorDone() {
  const acts = (state.activities || []).filter((a) => a.date >= periodStart('week') && ['wandelen', 'fietsen', 'hardlopen', 'wandeltocht'].includes(a.type));
  if (!acts.length) return '<p class="muted small">' + t('app.dezeWeekNogGeen') + '</p>';
  const min = acts.reduce((t, a) => t + (a.minutes || 0), 0), km = acts.reduce((t, a) => t + (a.km || 0), 0);
  return `<p class="small"><span class="badge ok">${t('app.dezeWeek')}</span> ${t('app.min2', { n: acts.length, min, a: km ? t('app.km', { a: (Math.round(km * 10) / 10).toLocaleString(localeOf()) }) : '' })}</p>`;
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
      if (w) rows.push(`<li><button class="linklike" data-jump="${esc(s.key)}|${i}"><b>${esc(s.name)}</b> · ${esc(e.title)}</button> <span class="muted">${t('app.sets', { n: e.sets.length, a: w < 1 ? t('app.secundair') : '' })}</span></li>`);
    });
    detail = `<div class="msel"><div class="row between"><b>${t('app.setsDezeWeek', { a: esc(MUSCLE_LABELS[selMuscle]), b: Math.round(plan.muscles[selMuscle] * 10) / 10 })}</b><button class="btn small ghost" data-clear>${t('app.allesTonen')}</button></div><ul>${rows.join('')}</ul></div>`;
  }
  $('#planOverview').innerHTML = `<div class="card week-map">
    <div class="wm-fig">${bodyMap(plan.muscles || {}, { height: 340, title: t('app.spiergroepenDezeWeek'), selected: selMuscle })}
      <div class="muted small" style="text-align:center">${t('app.klikOpEenSpiergroep')}</div></div>
    <div class="wm-info">
      <div class="eyebrow">${t('ui.stats.dezeWeek')}</div>
      ${plan.focus?.length ? `<div class="chips-inline">${plan.focus.map((f) => `<span class="chip on">${esc(FOCUS_LABELS[f] || f)}</span>`).join('')}</div>` : '<div class="muted small">' + t('app.geenFocusGekozenEvenwichtig') + '</div>'}
      ${plan.wish ? `<div class="wish">“${esc(plan.wish)}”</div>` : ''}
      <div class="eyebrow" style="margin-top:.8rem">${t('app.setsPerSpiergroepIncl')}</div>
      <div class="mbars">${top.map(([k, v]) => `<button class="mbar ${selMuscle === k ? 'on' : selMuscle ? 'off' : ''}" data-m="${k}" aria-pressed="${selMuscle === k}"><span>${esc(MUSCLE_LABELS[k] || k)}</span><div class="ht"><div class="hf" style="width:${(v / top[0][1]) * 100}%"></div></div><b>${Math.round(v * 10) / 10}</b></button>`).join('')}</div>
      ${detail}
      <div class="legend"><span class="sq m1"></span>${t('app.licht')} <span class="sq m2"></span>${t('app.gemiddeld')} <span class="sq m3"></span>${t('app.veel')}</div>
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
    if (selMuscle) card.querySelector('header > div').insertAdjacentHTML('beforeend', `<div class="mh-sum small">${sets ? t('app.mhSets', { n: fmtNum(sets), m: esc(lc(MUSCLE_LABELS[selMuscle] || selMuscle)) }) : t('app.mhNone', { m: esc(lc(MUSCLE_LABELS[selMuscle] || selMuscle)) })}</div>`);
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
  box.innerHTML = '<span class="muted">' + t('app.programmaSOphalenBij') + '</span>';
  try { programs = (await api('GET', '/api/programs')).programs; renderPrograms(); }
  catch (e) { box.innerHTML = `<span class="down">${esc(e.message)}</span>`; }
}
// Lijst met programma's op het toestel, met opruimen van oude GymCoach-programma's.
function renderPrograms() {
  const box = $('#programsBox');
  if (!programs.length) { box.innerHTML = '<span class="muted">' + t('app.geenEigenProgrammaS') + '</span>'; return; }
  const cur = state.plan ? `GC ${planLabel(state.plan)} ` : null;
  box.innerHTML = `<div class="row between wrap gap"><span class="muted">${t('app.programmaSVanGymcoach', { n: programs.length, a: programs.filter((p) => p.gymcoach).length })}</span>
    <div class="row gap wrap"><button class="btn small ghost" data-p="old">${t('app.selecteerOudeGymcoachProgramma')}</button><button class="btn small ghost" data-p="none">${t('app.nietsSelecteren')}</button></div></div>
    <div class="tablewrap"><table class="progtable"><thead><tr><th></th><th>${t('nt.name')}</th><th>${t('app.aangemaakt')}</th><th class="num">${t('ed.exercises')}</th></tr></thead><tbody>
    ${programs.map((p) => `<tr><td><input type="checkbox" class="pchk" value="${esc(p.id)}" aria-label="${t('app.selectItem', { name: esc(p.name) })}"></td>
      <td>${esc(p.name)} ${p.gymcoach ? `<span class="badge ${cur && p.name.startsWith(cur) ? 'ok' : ''}">${cur && p.name.startsWith(cur) ? t('app.huidigeWeek') : 'GymCoach'}</span>` : ''}</td>
      <td class="muted">${p.created ? esc(new Date(p.created).toLocaleString(localeOf(), { dateStyle: 'short', timeStyle: 'short' })) : '—'}</td>
      <td class="num">${p.exercises ?? '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="row gap end" style="margin-top:.6rem"><button class="btn danger" data-p="del">${t('app.verwijderGeselecteerde')}</button></div>`;
}
$('#programsBox').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-p]'); if (!b) return;
  const cur = state.plan ? `GC ${planLabel(state.plan)} ` : '\u0000';
  const boxes = [...document.querySelectorAll('.pchk')];
  if (b.dataset.p === 'old') boxes.forEach((c) => { const p = programs.find((x) => String(x.id) === c.value); c.checked = !!p?.gymcoach && !p.name.startsWith(cur); });
  if (b.dataset.p === 'none') boxes.forEach((c) => { c.checked = false; });
  if (b.dataset.p === 'del') {
    const ids = boxes.filter((c) => c.checked).map((c) => c.value);
    if (!ids.length) { toast(t('app.selecteerEerstEenOf'), true); return; }
    const names = programs.filter((p) => ids.includes(String(p.id))).map((p) => '• ' + p.name);
    if (!await askConfirm(t('app.dezeProgrammaSDefinitief', { n: ids.length, a: names.slice(0, 15).join('\n'), b: names.length > 15 ? t('app.enNog', { a: names.length - 15 }) : '' }), { danger: true, okText: t('tp.delete') })) return;
    await busy(b, async () => {
      const r = await api('POST', '/api/programs/delete', { ids });
      toast(t('app.verwijderd', { n: r.done.length, a: r.failed.length ? t('app.mislukt', { n: r.failed.length, error: r.failed[0].error }) : '' }), r.failed.length > 0);
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
    try { state.plan = (await api('PUT', '/api/plan', state.plan)).plan; renderPlan(); toast(t('app.opgeslagen')); } catch (e) { toast(e.message, true); }
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
    if (!await askConfirm(t('ed.removeFromPlanConfirm', { name: session.name }))) return;
    try { state.plan = (await api('DELETE', '/api/plan/session?key=' + encodeURIComponent(session.key))).plan; renderPlan(); } catch (e) { toast(e.message, true); }
    return;
  }
  if (act === 'lock' || act === 'revert') {
    if (act === 'revert' && !await askConfirm(t('ed.resetConfirm'))) return;
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
  if (act === 'push' && !await askConfirm(t('app.alsProgrammaOpJe', { a: progName(state.plan, session) }), { okText: t('app.zetOpToestel') })) return;
  await busy(btn, async () => {
    const r = await api('POST', '/api/plan/push', { sessionKey: session.key, dryRun: act === 'dry' });
    if (act === 'dry') toast(t('app.controleOkOefeningenSets', { n: r.plan.exercises.length, a: r.plan.exercises.reduce((n, e) => n + e.sets.length, 0) }));
    else { toast(t('app.opJeGymMonster', { name: r.plan.name })); await load(); }
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
      <div><div class="eyebrow">${esc(session.name)} · ${esc(e.patternLabel)}${e.focus ? ' · <span class="accent-text">' + t('app.focus') + '</span>' : ''}</div><h2>${esc(e.title)}</h2>
        <div class="muted small">${t('app.doelHerhalingen', { a: esc(e.muscle || ''), b: e.type === 'compound' ? t('app.samengesteldeOefening') : 'isolatieoefening', c: e.repRange[0], d: e.repRange[1] })}</div></div>
      <button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button>
    </div>
    <div class="exd-body">
      <div class="exd-map">${bodyMap(sc, { height: 170, title: t('app.spierenInDezeOefening') })}<div class="muted small" style="text-align:center">${Object.keys(sc).map((k) => esc(MUSCLE_LABELS[k] || k)).join(' · ')}</div></div>
      <div class="exd-main">
        <div class="note ${noteClass(e.note)}"><b>${t('ed.advice')}</b> ${esc(e.note || '—')}</div>
        ${e.basis ? `<div class="muted small">${t('app.vorigeKeer', { a: esc(e.basis) })}</div>` : '<div class="muted small">' + t('ed.noHistory') + '</div>'}
        ${ramp ? `<div class="small">${t('app.begintMetEenOpwarmset', { ramp })}</div>` : ''}
        ${e.restNote ? `<div class="muted small">${esc(e.restNote)}</div>` : ''}${e.volumeNote ? `<div class="muted small">${esc(e.volumeNote)}</div>` : ''}
        <div class="rx" style="margin-top:.6rem">
          <label>${t('ed.sets')}<input type="number" min="1" max="6" data-f="sets" value="${e.sets.length}"></label>
          <label>${t('ed.reps')}<input type="number" min="1" max="30" data-f="reps" value="${e.sets[0]?.reps}"></label>
          <label>kg<input type="number" min="0.5" step="0.5" data-f="weight" value="${e.sets[0]?.weight}"></label>
          <label>${t('app.rustS')}<input type="number" min="10" step="5" data-f="rest" value="${e.sets[0]?.rest}"></label>
        </div>
        <table class="settable"><thead><tr><th>${t('ed.set')}</th><th class="num">${t('ed.reps')}</th><th class="num">kg</th><th class="num">${t('app.rust')}</th></tr></thead><tbody>
          ${ramp ? `<tr class="muted"><td>${t('ed.warmSet')}</td><td class="num">8</td><td class="num">${ramp}</td><td class="num">45 s</td></tr>` : ''}
          ${e.sets.map((x, n) => `<tr><td>${n + 1}</td><td class="num">${x.reps}</td><td class="num">${x.weight}</td><td class="num">${x.rest} s</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="row gap wrap end">
      <button type="button" class="btn ghost" data-x="avoid">${t('pk.avoid')}</button>
      <button type="button" class="btn ghost" data-x="swap">${t('app.wisselOefening')}</button>
      <button value="close" class="btn accent">${t('app.klaar')}</button>
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
    if (!await askConfirm(t('app.nietMeerVoorstellen', { title: e.title }))) return;
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
    ? [...session.warmup.mobility.map((m) => ({ t: m.title, d: doseText(m.dose), dev: pushMob() })), ...session.warmup.cable.map((c) => ({ t: c.title, d: `2 × ${c.reps} @ ${c.weight} kg`, dev: true }))]
    : session.cooldown.map((c) => ({ t: c.title, d: doseText(c.dose), dev: pushMob() }));
  dlg.innerHTML = `<form method="dialog" class="exd">
    <div class="exd-head"><div><div class="eyebrow">${esc(session.name)}</div><h2>${which === 'warm' ? t('app.warmingUp6Min') : t('app.cooldownMin', { a: coolMin(session.cooldown) })}</h2></div><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
    <table class="settable"><thead><tr><th>${t('app.oefening')}</th><th>${t('app.dosering')}</th><th>${t('app.opToestel2')}</th></tr></thead><tbody>
      ${items.map((x) => `<tr><td>${esc(x.t)}</td><td>${esc(x.d)}</td><td>${x.dev ? (/per (kant|been|arm)/i.test(x.d || '') ? t('app.ja2SetsLinks') : 'ja') : '<span class="muted">' + t('app.alleenDashboard') + '</span>'}</td></tr>`).join('')}
    </tbody></table>
    ${which === 'warm' ? '<p class="muted small">' + t('app.daarnaStartDeEerste') + '</p>' : '<p class="muted small">' + t('app.rustigAdemenNietVerend') + '</p>'}
    <div class="row end"><button value="close" class="btn accent">${t('app.klaar')}</button></div></form>`;
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
        renderPlan(); toast(t('app.planBijgewerkt'));
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
    <div class="exd-head"><div><div class="eyebrow">${t('app.nieuwWeekplan')}</div><h2>${t('app.hoeZietJeWeek')}</h2></div><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
    ${(() => { const l = (state.plan?.sessions || []).filter((x) => x.locked); return l.length ? `<div class="note">${t('app.vastgezetEnBlijftStaan')} <b>${l.map((x) => esc(x.name)).join(', ')}</b>${t('app.gewichtenSchuivenMeeMet')}</div>` : ''; })()}
    <div class="eyebrow" style="margin:0">${t('app.trainingsdagen')}</div>
    <div class="presets row gap wrap">
      <button type="button" class="btn small ghost" data-pre="same">${t('app.alles', { a: esc(DAY_SHORT[state.settings.goal] || 'combinatie') })}</button>
      <button type="button" class="btn small ghost" data-pre="2k1c">${t('app.2Kracht1Cardio')}</button>
      <button type="button" class="btn small ghost" data-pre="2k1b">${t('app.2Kracht1Buiten')}</button>
      <button type="button" class="btn small ghost" data-pre="3k1b">${t('app.3Kracht1Buiten')}</button>
    </div>
    <div id="dayList" class="day-list"></div>
    <div class="row gap"><button type="button" class="btn small ghost" data-x="addday">${t('app.dag')}</button><span class="muted small" id="dayNote"></span></div>
    <div class="eyebrow" style="margin:.4rem 0 0">${t('app.focusDezeWeek')}</div>
    <div class="focus-chips">${Object.entries(FOCUS_LABELS).map(([k, l]) => `<label class="chip-check"><input type="checkbox" name="focus" value="${k}" ${cur.has(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <label>${t('app.jeWensInEigen')}
      <textarea name="wish" rows="3" placeholder="${t('app.bijvIkWilKomende')}">${esc(state.plan?.wish || '')}</textarea>
      <span class="muted small">${t('app.herkendeSpiergroepenWordenHierboven')}</span>
    </label>
    ${aiOn ? '<label class="chip-check wide"><input type="checkbox" name="coach" checked><span>' + t('app.laatDeAiCoach2') + '</span></label>' : ''}
    <p class="muted small">${t('app.focusgebiedenKrijgenVoorrangEen')}</p>
    <div class="row gap end">
      <button type="button" class="btn ghost" data-x="clear">${t('app.geenFocus')}</button>
      <button value="ok" class="btn accent">${t('app.maakPlan')}</button>
    </div></form>`;
  const f = dlg.querySelector('#genForm');
  // dagen: start met het vorige plan, anders met de instellingen
  let days = (state.plan?.dayTypes?.length ? [...state.plan.dayTypes] : Array.from({ length: +state.settings.daysPerWeek || 3 }, () => state.settings.goal || 'combinatie'));
  const drawDays = () => {
    $('#dayList').innerHTML = days.map((t, i) => `<div class="day-row"><span class="day-n">${tx('app.dag2', { a: i + 1 })}</span>
      <select data-d="${i}" aria-label="${tx('app.dayTypeOf', { n: i + 1 })}">${Object.entries(DAY_TYPES).map(([k, l]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button type="button" class="btn small ghost" data-del="${i}" aria-label="${tx('app.dayRemove', { n: i + 1 })}" ${days.length <= 1 ? 'disabled' : ''}>✕</button></div>`).join('');
    const nK = days.filter((t) => !['circuit', 'buiten'].includes(t)).length;
    $('#dayNote').textContent = t('app.kracht', { nK, a: days.length - nK ? t('app.cardio', { a: days.length - nK }) : '', b: nK ? ` → ${nK === 1 ? 'full body' : nK <= 3 ? 'full body A/B' + (nK === 3 ? '/C' : '') : 'upper/lower'}` : '' });
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
      renderPlan(); toast(focus.length ? t('app.planGemaaktMetFocus', { a: focus.map((x) => FOCUS_LABELS[x]).join(', ') }) : t('app.nieuwEvenwichtigPlanGemaakt'));
      if (f.coach?.checked) $('#coachBtn').click();
    } catch (e) { toast(e.message, true); } finally { btn.disabled = false; }
  };
  dlg.showModal();
}
$('#genBtn').addEventListener('click', async () => {
  if (state.plan?.source?.includes('AI') && !await askConfirm(t('app.huidigPlanMetAi'))) return;
  openGenerate();
});

// Vraag de AI-coach om advies: voor het hele plan, of met { session } voor één training.
function coachRequest(btn, payload = {}) {
  return busy(btn, async () => {
    const p = $('#coachPanel');
    p.classList.remove('hidden'); p.innerHTML = '<span class="muted">' + t('app.coachDenktNa') + '</span>';
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
    const when = new Date(c.doneAt || c.at).toLocaleString(localeOf(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    p.innerHTML = `<div class="row between wrap gap"><div class="small"><b>${t('ui.settings.aiCoach')}</b> ${t('app.op', { a: c.done === 'applied' ? t('app.adviesToegepast', { n: c.applied }) : t('app.adviesGenegeerd'), b: esc(when) })}</div>
      <button type="button" class="btn ghost small" id="coachShow">${t('app.toonAdvies')}</button></div><div class="advice hidden" id="coachText" style="margin-top:.6rem">${esc(c.advice)}</div>`;
    p.classList.add('coach-done');
    $('#coachShow').addEventListener('click', (ev) => { const t = $('#coachText'); t.classList.toggle('hidden'); ev.currentTarget.textContent = t.classList.contains('hidden') ? tx('app.toonAdvies') : tx('app.verbergAdvies'); });
    return;
  }
  p.classList.remove('coach-done');
  // voorstellen voor je eigen (bewerkte, vastgezette of zelf gemaakte) trainingen staan standaard uit: jij kiest
  p.innerHTML = `<h2>${t('app.aiCoach', { a: c.sessionName ? ` · ${esc(c.sessionName)}` : '' })} <span class="muted">(${esc(c.provider)} · ${esc(c.model)})</span></h2>
    <div class="advice">${esc(c.advice)}</div>
    ${c.adjustments?.some((a) => a.own) ? '<p class="muted small" style="margin:.5rem 0 0">' + t('app.voorstellenVoorJeEigen') + '</p>' : ''}
    ${c.adjustments?.length ? `<div style="margin-top:.75rem">${c.adjustments.map((a, i) => `
      <label class="adj"><input type="checkbox" data-i="${i}"${a.own ? '' : ' checked'}>
        <span><b>${esc(a.sessionName || a.session)} · ${esc(a.title)}</b>${a.own ? ' <span class="badge custom">' + t('app.eigenOpbouw') + '</span>' : ''}: ${[a.swapToId && t('app.adj.swap'), a.sets && t('app.setsN', { n: a.sets }), a.reps && t('app.adj.reps', { n: a.reps }), a.weight && a.weight + ' kg'].filter(Boolean).join(', ')}<br><span class="muted">${esc(a.reason)}</span></span></label>`).join('')}
      <div class="row gap" style="margin-top:.6rem"><button class="btn accent" id="applyBtn">${t('app.geselecteerdeToepassen')}</button><button class="btn ghost" id="dismissBtn">${t('app.negeren')}</button></div></div>` : '<p class="muted">' + t('app.geenAanpassingenVoorgesteld') + '</p><button class="btn ghost small" id="dismissBtn">' + t('pk.close') + '</button>'}`;
  $('#applyBtn')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    const chosen = [...p.querySelectorAll('input[type=checkbox]:checked')].map((x) => c.adjustments[+x.dataset.i]);
    const r = await api('POST', '/api/coach/apply', { adjustments: chosen });
    state.plan = r.plan; state.meta.coach = r.coach; renderPlan(); renderCoach(r.coach); toast(t('app.aanpassingEnToegepast', { applied: r.applied }));
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
  return `<svg viewBox="0 0 130 130" class="ring" role="img" aria-label="${t('app.ringLabel', { done, target })}">
    <circle cx="65" cy="65" r="${R}" class="ring-bg"/>
    <circle cx="65" cy="65" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 65 65)"/>
    <text x="65" y="63" text-anchor="middle" class="ring-num">${done}<tspan class="ring-of">/${target}</tspan></text>
    <text x="65" y="84" text-anchor="middle" class="ring-lbl">${t('app.dezeWeek')}</text></svg>`;
}
const fmt = (n) => Number(n || 0).toLocaleString(localeOf());
// Verschil met vorige week als gekleurd percentage.
function delta(cur, prev, unit = '%') {
  if (!prev) return '<span class="muted">' + t('app.geenVergelijking') + '</span>';
  if (!cur) return `<span class="muted">${t('app.vorigeWeekKg', { a: fmt(prev) })}</span>`;
  const d = Math.round(((cur - prev) / prev) * 100);
  return `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}${unit}</span> <span class="muted">${t('app.tOVVorige')}</span>`;
}

// Tabblad Overzicht: deze week, volgende training, trends, kalender en activiteiten.
// Herstelscore en afvaltempo op het overzicht (lib/signals.js). Uitleg en bronnen: 'Hoe GymCoach werkt' → signalen.
const SIG_STATE = tmap({ good: '§sig.state.good', watch: '§sig.state.watch', easy: '§sig.state.easy' });
function sigLine(s) {
  const lvl = s.level >= 2 ? 'down' : s.level === 1 ? 'balwarn' : 'up';
  const txt = s.key === 'restHr' ? t('sig.restHr', { recent: fmtNum(s.recent), base: fmtNum(s.base), d: (s.delta > 0 ? '+' : '') + fmtNum(s.delta) })
    : s.key === 'hrv' ? t('sig.hrv', { recent: fmtNum(s.recent), base: fmtNum(s.base), p: (s.pct > 0 ? '+' : '') + s.pct })
    : s.key === 'reps' ? t('sig.reps', { recent: s.recent, base: s.base })
    : t('sig.slow', { recent: s.recent, base: s.base });
  return `<li><span class="sig-dot ${lvl}"></span>${esc(txt)}</li>`;
}
function renderSignals() {
  const box = $('#sigBar'), sg = state.signals || {};
  const r = sg.recovery, w = sg.weightLoss;
  if (state.setup?.needed || (!r && !w?.warn)) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  // de eerstvolgende krachttraining (geen cardio buiten) die deze week nog niet gedaan is
  const ses = state.plan?.sessions || [];
  const nk = state.overview?.next && ses.find((x) => x.key === state.overview.next.key);
  const next = nk && !nk.outdoor ? nk : ses.find((x) => !x.outdoor && !doneOf(x));
  const canLighten = r?.state === 'easy' && next && !next.outdoor && !next.lightened;
  box.innerHTML = `${r ? `<div class="card sig-card sig-${r.state}">
      <div class="row between wrap gap"><div><div class="eyebrow">${t('sig.title')}</div><div class="mid">${esc(SIG_STATE[r.state])}</div></div>
      ${canLighten ? `<button class="btn small" id="sigLighter">${t('sig.lighter', { name: esc(next.name) })}</button>` : next?.lightened ? `<span class="badge">${t('sig.lightened')}</span>` : ''}</div>
      <ul class="sig-list small">${r.signals.map(sigLine).join('')}</ul>
      <div class="small muted">${t('sig.' + r.state + 'Text')} <a href="#" data-explain="signalen">${t('sig.why')}</a></div></div>` : ''}
    ${w?.warn ? `<div class="card sig-card sig-watch"><div class="eyebrow">${t('sig.lossTitle')}</div>
      <div class="small">${t('sig.lossText', { pct: fmtNum(w.pctWeek), kg: fmtNum(w.kgWeek), muscle: fmtNum(w.muscleKg28) })} <a href="#" data-explain="signalen">${t('sig.why')}</a></div></div>` : ''}`;
  $('#sigLighter')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    state.plan = (await api('POST', '/api/plan/lighter', { session: next.key })).plan;
    toast(t('sig.lightenedToast', { name: next.name })); renderSignals(); renderPlan();
  }));
}
function renderHome() {
  const o = state.overview; if (!o) return;
  const now = new Date();
  $('#today').textContent = now.toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long' });
  const h = now.getHours();
  $('#greet').textContent = (h < 12 ? t('app.goedemorgen') : h < 18 ? t('app.goedemiddag') : t('app.goedenavond')) + ', ' + (state.me?.name || '');
  $('#tip').textContent = o.tip;
  renderSignals();

  const n = o.next;
  document.querySelector('.dash').classList.toggle('setup-mode', !!state.setup?.needed);
  if (state.setup?.needed) { renderSetup(); return; }
  $('#nextCard').classList.remove('setup');
  // cardio buiten: geen programma voor het toestel, wel het advies
  const nOut = n && (state.plan?.sessions || []).find((x) => x.name === n.name && x.outdoor);
  $('#nextCard').innerHTML = nOut ? `
    <div class="eyebrow">${t('app.volgendeTraining')}</div>
    <div class="hero-title">${esc(n.name)}</div>
    <div class="hero-meta"><span>${t('app.min3', { estMinutes: n.estMinutes })}</span><span>${t('app.wandelenOfFietsen')}</span></div>
    <p class="muted" style="margin:.4rem 0 .8rem">${esc(nOut.advice || '')}</p>
    <div class="row gap wrap"><button class="btn ghost" id="heroView">${t('app.bekijkInPlan')}</button></div>` : n ? `
    <div class="eyebrow">${t('app.volgendeTraining')}</div>
    <div class="hero-title">${esc(n.name)}</div>
    <div class="hero-meta"><span>${t('app.min3', { estMinutes: n.estMinutes })}</span><span>${t('app.oefeningen', { count: n.count })}</span><span>${esc(GOAL[o.goal] || '')}</span>${n.pushedAt ? '<span class="badge ok">' + t('app.opToestel') + '</span>' : ''}</div>
    <ol class="hero-list">${n.exercises.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
    <div class="row gap wrap">
      <button class="btn accent" id="heroPush">${n.pushedAt ? t('app.opnieuwOpToestelZetten') : t('app.zetOpGymMonster')}</button>
      <button class="btn ghost" id="heroView">${t('app.bekijkInPlan')}</button>
    </div>` : `<div class="eyebrow">${t('app.volgendeTraining')}</div><div class="hero-title">${t('app.nogGeenPlan')}</div><button class="btn accent" id="heroGen">${t('app.maakEenVoorstel')}</button>`;
  $('#heroPush')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!await askConfirm(t('app.opJeGymMonster2', { a: progName(state.plan, n) }), { okText: t('app.zetOpToestel') })) return;
    const r = await api('POST', '/api/plan/push', { sessionKey: n.key, dryRun: false });
    toast(t('app.opJeGymMonster', { name: r.plan.name })); await load();
  }));
  $('#heroView')?.addEventListener('click', () => document.querySelector('.tab[data-tab=plan]').click());
  $('#heroGen')?.addEventListener('click', () => $('#genBtn').click());

  $('#weekRing').innerHTML = `<div class="eyebrow">${t('app.weekdoel')}</div>${ring(o.week.done, o.week.target)}`;
  $('#tStreak').innerHTML = `<div class="eyebrow">${t('app.streak')}</div><div class="big">${o.streak}<small> ${o.streak === 1 ? t('app.week') : t('app.weken')}</small></div><div class="muted">${t('app.opRijJeWeekdoel')}</div>`;
  $('#tVolume').innerHTML = `<div class="eyebrow">${t('app.volumeDezeWeek')}</div><div class="big">${fmt(o.week.volume)}<small> kg</small></div><div class="small">${delta(o.week.volume, o.week.prevVolume)}</div>`;
  $('#tMinutes').innerHTML = `<div class="eyebrow">${t('app.trainingstijd')}</div><div class="big">${o.week.minutes}<small> min</small></div><div class="muted">${t('app.kcalDezeWeek', { a: fmt(o.week.calories) })}</div>`;
  const b = o.body;
  $('#tBody').innerHTML = `<div class="eyebrow">${t('ui.body.lichaamsgewicht')}</div>` + (b
    ? `<div class="big">${b.kg}<small> kg</small>${b.fat ? `<small> ${t('app.vet', { fat: b.fat })}</small>` : ''}</div><div class="row between"><div class="small">${b.slope == null ? '<span class="muted">' + t('app.teWeinigMetingen') + '</span>' : `<span class="${(o.goal === 'spieropbouw' ? b.slope >= 0 : b.slope <= 0) ? 'up' : 'down'}">${t('app.kgWeek', { a: b.slope > 0 ? '+' : '', slope: b.slope })}</span>`}</div>${spark(b.spark, { w: 90, h: 28, cls: 'sp b' })}</div>`
    : `<div class="muted" style="margin-top:.5rem">${t('app.nogGeenMetingen')}</div><button class="btn small ghost" style="margin-top:.5rem" onclick="document.querySelector('.tab[data-tab=body]').click()">${t('app.gewichtInvoeren')}</button>`);

  $('#strength').innerHTML = `<div class="eyebrow">${t('app.krachtGeschat1rmLaatste')}</div>` + (o.strength.length
    ? `<div class="str-grid">${o.strength.map((x) => `<div class="str"><div class="str-name">${esc(x.name)}</div><div class="row between"><div><span class="mid">${x.e1rm}</span> <span class="muted">kg</span><div class="small"><span class="${x.deltaPct >= 0 ? 'up' : 'down'}">${x.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(x.deltaPct)}%</span></div></div>${spark(x.spark)}</div></div>`).join('')}</div>`
    : '<div class="empty">' + t('app.naEenPaarTrainingen') + '</div>');

  // trainingskalender: laatste 8 weken, nieuwste bovenaan
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const short = (d) => d.toLocaleDateString(localeOf(), { day: 'numeric', month: 'short' }).replace('.', '');
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
      const tip = `${dt.toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long' })}${info ? ` — ${info.titles.join(', ') || t('app.training')}${info.min ? ` (${info.min} min)` : ''}` : future || dayActs.length ? '' : ' — ' + t('app.rustdag')}${dayActs.length ? ' — ' + dayActs.map(actLine).join(', ') : ''}`;
      const acts = (state.activities || []).filter((a) => a.date === keyOf(dt));
      const actDots = acts.length ? `<span class="cd-acts">${acts.slice(0, 3).map((a) => `<i style="background:${actColor(a.type)}"></i>`).join('')}</span>` : '';
      cells += `<div class="cd ${lvl} ${future ? 'fut' : ''} ${isToday ? 'today' : ''}${info || acts.length ? ' click" data-date="' + keyOf(dt) + '" tabindex="0" role="button' : ''}" data-day="${keyOf(dt)}" title="${esc(tip)}"><span class="dn">${dt.getDate()}</span>${info?.min ? `<span class="dm">${info.min}′</span>` : ''}${actDots}</div>`;
    }
    const hit = count >= o.week.target;
    rows += `<div class="cw">${wk === 0 ? t('ui.stats.dezeWeek') : `${short(ws)} – ${short(we)}`}</div>${cells}<div class="cs ${hit ? 'hit' : ''}">${count}/${o.week.target}</div>`;
  }
  $('#heat').innerHTML = `<div class="row between wrap gap"><div class="eyebrow">${t('app.trainingskalenderLaatste8Weken')}</div><div class="muted">${t('app.trainingsdagen2', { trainedDays })}</div></div>
    <div class="cal">
      <div></div>${weekdaysShort().map((d) => `<div class="ch">${d}</div>`).join('')}<div class="ch">${t('app.doel')}</div>
      ${rows}
    </div>
    <div class="legend">${t('app.gekleurdGetraind4343')} <span class="sq l1"></span>&lt;25 <span class="sq l2"></span>25–45 <span class="sq l3"></span>${t('app.gt45MinOmrand')}</div>`;
  $('#heat').querySelectorAll('.cd[data-date]').forEach((c) => {
    const go = () => openDay(c.dataset.date);
    c.addEventListener('click', go);
    c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
  });

  // plan deze week
  const pl = state.plan;
  if (!pl) $('#weekPlan').innerHTML = '<div class="eyebrow">' + t('app.planDezeWeek') + '</div><div class="empty">' + t('app.nogGeenPlan2') + '</div>';
  else {
    const all = pl.sessions.flatMap((x) => x.exercises);
    const sets = all.reduce((n, e) => n + e.sets.length, 0);
    const vol = all.reduce((n, e) => n + volFactor(e.id) * e.sets.reduce((m, st) => m + st.reps * st.weight, 0), 0);
    const mins = pl.sessions.reduce((n, x) => n + (x.estMinutes || 0), 0);
    const ups = all.filter((e) => /^↑/.test(e.note || '')).length;
    const top = Object.entries(pl.muscles || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const done = new Set(state.recent.filter((w) => w.date && new Date(w.date) >= (() => { const m = new Date(); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; })()).map((w) => String(w.title || '')));
    $('#weekPlan').innerHTML = `<div class="row between wrap gap"><div class="eyebrow" style="margin:0">${t('app.planDezeWeekWeek', { w: planIso(pl).w })}</div>
        <button class="btn small ghost" id="wpOpen">${t('app.openPlan')}</button></div>
      ${pl.deload ? '<span class="badge warn" style="margin-top:.4rem;display:inline-block">' + t('app.deloadWeek') + '</span>' : ''}
      <div class="wp">
        <div>${bodyMap(pl.muscles || {}, { height: 190, title: t('app.spiergroepenDezeWeek') })}</div>
        <div>
          ${pl.focus?.length ? `<div class="chips-inline" style="margin-bottom:.5rem">${pl.focus.map((f) => `<span class="chip on">${esc(FOCUS_LABELS[f] || f)}</span>`).join('')}</div>` : ''}
          <div class="wp-stats">
            <div class="wp-stat"><div class="eyebrow">${t('tp.title')}</div><div class="mid">${pl.sessions.length}<small> ${t('app.min4', { a: Math.round(mins / pl.sessions.length) })}</small></div></div>
            <div class="wp-stat"><div class="eyebrow">${t('app.werksets')}</div><div class="mid">${sets}<small> ${t('app.oef', { n: all.length })}</small></div></div>
            <div class="wp-stat"><div class="eyebrow">${t('app.geplandVolume')}</div><div class="mid">${vol >= 10000 ? (vol / 1000).toLocaleString(localeOf(), { maximumFractionDigits: 1 }) + '<small> t</small>' : fmt(Math.round(vol)) + '<small> kg</small>'}</div></div>
            <div class="wp-stat"><div class="eyebrow">${t('app.zwaarder')}</div><div class="mid ${ups ? 'up' : ''}">${ups}<small> ${t('app.oefeningen2')}</small></div></div>
          </div>
          <div class="wp-top">${top.map(([k, v]) => `<div class="mbar"><span>${esc(MUSCLE_LABELS[k] || k)}</span><div class="ht"><div class="hf" style="width:${(v / top[0][1]) * 100}%"></div></div><b>${Math.round(v * 10) / 10}</b></div>`).join('')}</div>
          <div class="wp-sess">${pl.sessions.map((x) => `<span class="${[...done].some((t) => t.endsWith(x.name)) ? 'done' : ''}">${[...done].some((t) => t.endsWith(x.name)) ? '✓ ' : ''}${esc(x.name)}</span>`).join('')}</div>
        </div>
      </div>`;
    $('#wpOpen').addEventListener('click', () => document.querySelector('.tab[data-tab=plan]').click());
  }

  $('#prs').innerHTML = `<div class="eyebrow">${t('app.records14Dagen')}</div>` + (o.prs.length
    ? o.prs.slice(0, 3).map((p) => `<div class="pr"><span class="medal">★</span><div class="pr-body"><div class="str-name">${esc(p.name)}</div><div class="muted">${t('app.kgKg1rm', { a: esc(p.date), top: p.top, e1rm: p.e1rm })}</div></div></div>`).join('')
    : '<div class="empty small-empty">' + t('app.nogGeenNieuweRecords') + '</div>');
}


// ---------- statistieken ----------
let stats = null, statDays = '84', statMetric = 'volume';
const statSort = { muscleTable: { k: 'volume', d: -1 }, exTable: { k: 'volume', d: -1 } };
const kg = (v) => (v >= 10000 ? `${(v / 1000).toLocaleString(localeOf(), { maximumFractionDigits: 1 })} t` : `${fmt(v)} kg`);

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
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString(localeOf());
  const KIND_NL = tmap({ program: '§app.kind.program', course: '§app.kind.course', free: '§app.kind.free', custom: '§app.kind.custom', overig: '§app.kind.overig' });
  const kindTxt = Object.entries(x.kinds || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v} ${KIND_NL[k] || k}`).join(' · ');
  const vol = t.volume || x.summaryVolume || 0;
  $('#statTotals').innerHTML =
    // activiteit
    tile(tx('tp.title'), t.workouts, kindTxt || tx('app.metSetdata', { programSessions: t.programSessions })) +
    tile(tx('app.perWeek2'), n1(x.perWeek || 0), x.firstDate ? tx('app.sinds', { a: esc(fmtDate(x.firstDate)) }) : '') +
    tile(tx('app.trainingstijd'), `${Math.floor(t.minutes / 60)}<small>${tx('app.hUnit')}</small> ${t.minutes % 60}<small>m</small>`, tx('app.gemMinPerTraining', { a: x.avgMinutes || 0 })) +
    tile(tx('sum.calories'), fmt(t.calories), tx('app.gemKcalPerTraining', { a: fmt(x.avgKcal || 0) })) +
    tile(tx('app.weekreeks'), `${x.streak || 0}<small> ${tx('app.wk')}</small>`, tx('app.langsteWeken', { a: x.longestStreak || 0 })) +
    tile(tx('app.favorieteDag'), x.favDay ? esc(x.favDay.day.charAt(0).toUpperCase() + x.favDay.day.slice(1)) : '—', x.favDay ? tx('app.actieveDagen', { n: x.favDay.n, activeDays: x.activeDays }) : '') +
    // kracht en volume
    tile(tx('app.totaalVolume'), kg(vol), t.volume ? tx('app.gemPerTraining', { a: kg(t.avgVolume) }) : vol ? tx('app.volgensSpeediance') : '') +
    tile(tx('ed.sets'), fmt(t.sets), t.sets ? tx('app.perTrainingHerh', { a: n1(x.setsPerWorkout), b: fmt(t.reps) }) : `${fmt(t.reps)} herhalingen`) +
    tile(tx('app.herhalingenPerSet'), t.sets ? n1(x.repsPerSet) : '—', t.reps ? tx('app.gemKgPerHerhaling', { a: n1(x.avgLoad) }) : '') +
    tile(tx('ui.leg.heaviest'), t.heaviest ? `${t.heaviest.weight}<small> kg</small>` : '—', t.heaviest ? `${esc(t.heaviest.name)} · ${t.heaviest.reps}×` : '') +
    tile(tx('ui.analysis.records'), fmt(x.prs || 0), x.bestProgress ? tx('app.besteGroei', { a: esc(x.bestProgress.name), b: x.bestProgress.pct > 0 ? '+' : '', c: n1(x.bestProgress.pct) }) : tx('app.nieuwGeschat1rm')) +
    tile(tx('app.spiergroepen'), stats.muscles.filter((m) => m.sets).length, tx('app.oefeningen', { count: stats.exercises.length }));
  renderCardio();
  renderStatsExtra();
  $('#statNote').innerHTML = x.missingDetails ? `<div class="note">${tx('app.vanTrainingInDeze', { n: x.missingDetails })}</div>` : '';
  renderMuscleBars();

  // weekmatrix
  const wk = stats.weekKeys;
  $('#weekMatrix').innerHTML = stats.muscles.length ? `<thead><tr><th>${tx('pk.muscle')}</th>${wk.map((w) => `<th class="num">${tx('app.wk2', { a: +w.slice(-2) })}</th>`).join('')}</tr></thead><tbody>${stats.muscles.map((m) => `<tr><td>${esc(m.label)}</td>${wk.map((w) => {
    const v = m.weekly[w] || 0, c = v === 0 ? 'z' : v < 6 ? 'lo' : v <= 12 ? 'ok' : 'hi';
    return `<td class="num mx ${c}">${v || '·'}</td>`;
  }).join('')}</tr>`).join('')}</tbody>` : '<tbody><tr><td class="empty">' + tx('app.nogGeenData') + '</td></tr></tbody>';

  renderSortable('muscleTable', stats.muscles, [
    ['label', tx('pk.muscle')], ['sessions', tx('tp.title'), 'n'], ['exercises', tx('ed.exercises'), 'n'], ['sets', tx('ed.sets'), 'n'], ['setsPerWeek', tx('app.col.setsWeek'), 'n'],
    ['reps', tx('ed.reps'), 'n'], ['volume', tx('ed.volume'), 'kg'], ['maxWeight', tx('sum.col.heaviest'), 'w'], ['bestE1rm', tx('app.col.best1rm'), 'w'], ['lastDate', tx('app.col.last')],
  ]);
  renderSortable('exTable', stats.exercises, [
    ['name', tx('app.oefening')], ['muscle', tx('pk.muscle')], ['sessions', tx('app.keer'), 'n'], ['sets', tx('ed.sets'), 'n'], ['reps', tx('ed.reps'), 'n'],
    ['volume', tx('ed.volume'), 'kg'], ['maxWeight', tx('sum.col.heaviest'), 'w'], ['bestE1rm', tx('app.col.best1rm'), 'w'], ['progressPct', tx('app.col.progress'), 'pct'], ['lastDate', tx('app.col.last')],
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
    : '<div class="empty">' + t('app.nogGeenTrainingenMet') + '</div>';
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
    <tbody>${sorted.length ? sorted.map((r) => `<tr>${cols.map((c) => cell(r, c)).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">${t('app.nogGeenData')}</td></tr>`}</tbody>`;
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
    sel.innerHTML = state.progress.length ? state.progress.map((p, i) => `<option value="${i}">${esc(p.name)} (${p.points.length}×)</option>`).join('') : '<option>' + t('app.nogGeenOefeningen') + '</option>';
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
    box.innerHTML = '<h2>' + tx('app.cardioEnActiviteit') + '</h2><div class="empty">' + tx('app.geenActiviteitenUitApple') + '</div>';
    return;
  }
  box.classList.remove('hidden');
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString(localeOf());
  const ct = (l, v, sub = '') => `<div class="ctile static"><div class="eyebrow">${l}</div><div class="mid">${v}</div><div class="small muted">${sub}</div></div>`;
  box.innerHTML = `<div class="row between wrap gap"><h2>${tx('app.cardioEnActiviteit')}</h2><span class="muted small">${tx('app.uitAppleHealthGym')}</span></div>
    <div class="ctiles">
      ${ct(tx('app.c.acts'), c.count, tx('app.c.actsSub', { h: Math.floor(c.minutes / 60), m: c.minutes % 60 }))}
      ${ct(tx('app.c.activeWeek'), `${c.minutesPerWeek}<small> min</small>`, tx('app.c.activeWeekSub'))}
      ${ct(tx('app.afstand'), `${n1(c.km)}<small> km</small>`, tx('app.c.distSub'))}
      ${ct(tx('sum.calories'), fmt(c.kcal), tx('app.c.kcalSub'))}
      ${c.avgSteps != null ? ct(tx('app.c.steps'), fmt(c.avgSteps), tx('app.c.stepsSub', { n: c.stepDays })) : ''}
    </div>
    <div class="tablewrap" style="margin-top:.8rem"><table><thead><tr><th>${tx('app.soort')}</th><th class="num">${tx('app.keer')}</th><th class="num">${tx('app.tijd')}</th><th class="num">${tx('app.afstand')}</th><th class="num">${tx('app.langste')}</th><th class="num">kcal</th><th class="num">${tx('app.gemHartslag')}</th></tr></thead><tbody>
      ${c.types.map((x) => `<tr><td><span class="segdot" style="background:${actColor(x.type)}"></span>${esc(actLabel(x.type))}</td><td class="num">${x.count}</td><td class="num">${Math.floor(x.minutes / 60)}${tx('app.hUnit')} ${x.minutes % 60}m</td><td class="num">${x.km ? n1(x.km) + ' km' : '—'}</td><td class="num">${x.longestKm ? n1(x.longestKm) + ' km' : '—'}</td><td class="num">${x.kcal ? fmt(x.kcal) : '—'}</td><td class="num">${x.hrAvg ? x.hrAvg + ' bpm' : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ---------- Apple Health koppelen (instellingen) ----------
async function loadHealth(newLink) {
  const box = $('#healthCard');
  let st;
  try { st = await api('GET', '/api/health/status'); } catch (e) { box.innerHTML = `<h2>${t('ui.settings.appleHealth')}</h2><div class="empty">${esc(e.message)}</div>`; return; }
  const when = (x) => x ? new Date(x).toLocaleString(localeOf(), { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  box.innerHTML = `<h2>${t('ui.settings.appleHealth')} <span class="muted small">${t('app.viaDeAppGymcoach')}</span></h2>
    <p class="muted small" style="margin-top:-.3rem">${t('app.wandelenFietsenEnAndere')}</p>
    <div class="row between wrap gap"><div>${st.linked ? `<span class="badge ok">${t('app.gekoppeld')}</span> <span class="muted small">${t('app.sleutelLaatsteZendingActiviteiten', { a: esc(st.tokenHint || ''), b: esc(when(st.lastPush)), c: st.lastCounts ? t('app.activiteitenDagen', { activities: st.lastCounts.activities, days: st.lastCounts.days }) : '', activities: st.activities })}</span>` : '<span class="muted small">' + t('app.nogNietGekoppeld') + '</span>'}</div>
      <div class="row gap">${st.linked ? '<button class="btn small ghost" id="hNew">' + t('app.nieuweSleutel') + '</button><button class="btn small ghost" id="hOff">' + t('app.ontkoppelen') + '</button>' : '<button class="btn small accent" id="hNew">' + t('app.koppelsleutelMaken') + '</button>'}</div></div>
    ${newLink ? `<div class="note" style="border-left-color:var(--ok)"><b>${t('app.bewaarDitNu')}</b> ${t('app.deSleutelWordtMaar')}
      <div class="kv"><span>${t('app.url')}</span><code id="hUrl">${esc(newLink.url)}</code><button class="btn small ghost" data-copy="hUrl">${t('ui.setWithings.kopieer')}</button></div>
      <div class="kv"><span>${t('app.header')}</span><code id="hHdr">${t('app.authorizationBearer', { a: esc(newLink.token) })}</code><button class="btn small ghost" data-copy="hTok">${t('app.kopieerSleutel')}</button><code id="hTok" class="hidden">${t('app.bearer', { a: esc(newLink.token) })}</code></div></div>` : ''}
    <details class="howto"><summary>${t('app.zoStelJeDe')}</summary><ol class="small">
      <li>${t('app.installeer')} <b>${t('app.gymcoachSync')}</b> ${t('app.viaTestflightEnOpen')}</li>
      <li>${t('app.vulHetAdresIn')} <code>${t('app.http1921681')}</code>${t('app.enDeKoppelsleutelHierboven')}</li>
      <li>${t('app.tikOp')} <b>${t('app.testVerbinding')}</b>${t('app.staDeToegangTot')} <b>${t('app.volledigeHistorieVersturen')}</b>.</li>
      <li>${t('app.daarnaGaanNieuweWorkouts')}</li>
    </ol></details>
    <details class="howto"><summary>${t('app.ofHealthAutoExport')}</summary><ol class="small">
      <li>${t('app.installeer')} <b>${t('app.healthAutoExportJson')}</b> ${t('app.opJeIphoneVoor')}</li>
      <li>${t('app.gaNaar')} <b>${t('app.automationsNieuweAutomatiseringRest')}</b>.</li>
      <li><b>${t('app.url')}</b>${t('app.deUrlHierbovenVoeg')} <b>${t('app.headers')}</b> ${t('app.toeSleutel')} <code>${t('app.authorization')}</code>${t('app.waarde')} <code>${t('app.bearer2')}</code> ${t('app.jeSleutel')}</li>
      <li><b>${t('app.dataType')}</b>${t('app.workoutsMaakEventueelEen')} <i>${t('app.stepCount')}</i>, <i>${t('app.activeEnergy')}</i>, <i>${t('app.walkingRunningDistance')}</i>, <i>Resting Heart Rate</i>, <i>Heart Rate Variability</i> ${t('app.en')} <i>VO2 Max</i>.</li>
      <li><b>${t('app.exportFormat')}</b>${t('app.json')} <b>${t('app.dateRange')}</b>${t('app.laatste7Dagen')} <b>${t('app.aggregation')}</b> ${t('app.bijMetricsPerDag')}</li>
      <li>${t('app.kiesEenIntervalBijv')} <b>${t('app.manualExport')}</b> ${t('app.omHetMeteenTe')}</li>
      <li>${t('app.jeOudeHistorieDoe')}</li>
    </ol><p class="muted small">${t('app.jeIphoneMoetDe')}</p></details>`;
  $('#hNew').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (st.linked && !await askConfirm(t('app.eenNieuweSleutelMaken'))) return;
    loadHealth(await api('POST', '/api/health/token'));
  }));
  $('#hOff')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!await askConfirm(t('app.appleHealthOntkoppelenOpgeslagen'))) return;
    await api('DELETE', '/api/health/token'); loadHealth();
  }));
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const txt = $('#' + b.dataset.copy).textContent;
    try { await navigator.clipboard.writeText(txt); toast(t('app.gekopieerd')); } catch { toast(txt); }
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
  if (!list.length) { $('#recent').innerHTML = `<div class="empty">${woList?.length ? t('app.geenTrainingenGevonden') : t('app.nogGeenTrainingenGesynct')}</div>`; return; }
  const nf = (v) => Math.round(v).toLocaleString(localeOf());
  $('#recent').innerHTML = `<div class="tablewrap"><table class="wotable"><thead><tr><th>${t('app.datum')}</th><th>${t('ui.settings.training')}</th><th class="num">${t('app.oef2')}</th><th class="num">Min</th><th class="num">kcal</th><th class="num">${t('app.gem')}</th><th class="num">${t('ed.volume')}</th><th></th></tr></thead><tbody>
    ${list.slice(0, woShown).map((w) => `<tr class="click" data-id="${esc(w.id)}" tabindex="0"><td>${esc(fmtDate(w.date))}</td><td>${esc(w.title)}${w.kind && w.kind !== 'program' ? ` <span class="muted small">${esc(w.kind)}</span>` : ''}</td><td class="num">${w.exercises ?? '—'}</td><td class="num">${w.minutes ?? '—'}</td><td class="num">${w.calories ?? '—'}</td><td class="num">${w.hrAvg ?? '—'}</td><td class="num">${w.volume ? nf(w.volume) + ' kg' : '—'}</td><td class="num muted">›</td></tr>`).join('')}
    </tbody></table></div>
    ${list.length > woShown ? `<div class="row center" style="margin-top:.6rem"><button class="btn ghost small" id="woMore">${t('app.meerTonenOver', { a: list.length - woShown })}</button></div>` : `<p class="muted small" style="margin:.5rem 0 0">${t('app.trainingen', { n: list.length })}</p>`}`;
  $('#woMore')?.addEventListener('click', () => { woShown += 50; renderWorkouts(); });
}
$('#woSearch').addEventListener('input', () => { woShown = 25; renderWorkouts(); });
$('#recent').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr) openWorkouts([tr.dataset.id]); });
$('#recent').addEventListener('keydown', (ev) => { const tr = ev.target.closest('tr[data-id]'); if (tr && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openWorkouts([tr.dataset.id]); } });

const nl1 = (v) => (Math.round(v * 10) / 10).toLocaleString(localeOf());
// Korte samenvatting van gedane sets, bijv. "3 × 10 @ 20 kg".
function doneSetsSummary(sets) {
  if (!sets?.length) return '—';
  const same = sets.every((x) => x.reps === sets[0].reps && x.weight === sets[0].weight);
  return same ? `${sets.length} × ${sets[0].reps} @ ${nl1(sets[0].weight)} kg` : sets.map((x) => `${x.reps}×${nl1(x.weight)}`).join(', ') + ' kg';
}
// Kerncijfers van een training (duur, oefeningen, volume, kcal, hartslag).
function woTiles(d) {
  const tiles = [[t('app.c.duur'), d.minutes != null ? `${d.minutes} min` : '—'], [t('app.oefeningenTile'), d.exercises.length || '—'], [t('app.volumeTile'), d.volume ? `${d.volume.toLocaleString(localeOf())} kg` : '—'], ['kcal', d.calories ?? '—']];
  if (d.calories == null && d.healthKcal != null) tiles[3] = ['kcal', d.healthKcal];
  if (d.hrAvg || d.hrMax) tiles.push(hrTile(d.hrAvg, d.hrMax));
  if (d.completion != null) tiles.push(['Voltooid', `${d.completion}%`]);
  return `<div class="wo-tiles">${tiles.map(([l, v, zc]) => `<div class="zoned"${zoneStyle(zc)}><div class="eyebrow">${l}</div><div class="mid">${esc(String(v))}</div></div>`).join('')}</div>`;
}
// Trainingsrapport in de app: oefeningen, vergelijking, hartslag, tijd en spierkaart.
function workoutHtml(d) {
  const exs = d.exercises.map((e, i) => {
    const delta = e.prev ? (e.prev.topDelta > 0 ? `<span class="up">${t('app.kg', { a: nl1(e.prev.topDelta) })}</span>` : e.prev.topDelta < 0 ? `<span class="down">${nl1(e.prev.topDelta)} kg</span>` : '<span class="muted">' + t('app.gelijk') + '</span>') : '<span class="muted">' + t('app.eersteKeer') + '</span>';
    if (!e.top) {
      // zonder gewicht (warming-up, mobiliteit, stretches): één compacte regel
      const reps = e.sets.reduce((t, x) => t + (x.reps || 0), 0);
      return `<div class="wo-ex light"><div class="row between wrap gap"><div><b>${i + 1}. ${esc(e.name)}</b>${e.muscle ? ` <span class="muted small">${esc(e.muscle)}</span>` : ''}</div><div class="small muted">${t('app.zonderGewicht', { a: e.sets.length ? ` · ${t('app.setsN', { n: e.sets.length })}${reps ? ` · ${t('app.repsTotal', { reps })}` : ''}` : '' })}</div></div></div>`;
    }
    // vertraging binnen de set (laatste herhalingen tegenover de eerste): tot 25% fris, 25–40% zwaar, vanaf 40% tot het uiterste
    const hasSlow = e.sets.some((x) => x.slow != null);
    const slowCell = (p) => (p == null ? '<td class="num muted">—</td>' : `<td class="num ${p >= 40 ? 'down' : p >= 25 ? 'balwarn' : 'up'}">${p}%</td>`);
    return `<div class="wo-ex">
      <div class="row between wrap gap"><div><b>${i + 1}. ${esc(e.name)}</b>${e.muscle ? ` <span class="muted small">${esc(e.muscle)}</span>` : ''}</div><div class="small">${t('app.zwaarsteSetKg', { a: nl1(e.top), delta })}</div></div>
      <table class="wo-sets"><thead><tr><th>${t('ed.set')}</th><th class="num">${t('ui.stats.herhalingen')}</th><th class="num">${t('ui.setTraining.doel')}</th><th class="num">${t('app.gewicht')}</th>${hasSlow ? `<th class="num" title="${t('sig.slowHint')}">${t('sig.slowCol')}</th>` : ''}</tr></thead><tbody>
        ${e.sets.map((x, j) => `<tr><td>${j + 1}</td><td class="num ${x.target && x.reps < x.target ? 'down' : x.target && x.reps >= x.target ? 'up' : ''}">${x.reps}</td><td class="num muted">${x.target ?? '—'}</td><td class="num">${nl1(x.weight)} kg${x.min != null && x.max !== x.min ? ` <span class="muted small">(${nl1(x.min)}–${nl1(x.max)})</span>` : ''}</td>${hasSlow ? slowCell(x.slow) : ''}</tr>`).join('')}
      </tbody></table>
      <div class="small muted">${t('app.volumeKgGeschat1rm', { a: e.volume.toLocaleString(localeOf()), b: nl1(e.e1rm), c: e.prev ? t('app.vorigeKeer2', { a: esc(fmtDate(e.prev.date)), b: esc(doneSetsSummary(e.prev.sets)) }) : '' })}</div>
    </div>`;
  }).join('');
  return `${d.hrSource ? `<p class="muted small" style="margin:0">${t('app.hartslagGemiddeldMaximaalUit', { a: esc(d.hrSource) })}</p>` : ''}
    ${d.cardioBefore ? `<div class="sig-note small">${t('sig.cardioBefore', { what: actLabel(d.cardioBefore.type), gap: d.cardioBefore.gapMin })} <a href="#" data-explain="signalen">${t('sig.why')}</a></div>` : ''}
    ${Object.keys(d.muscles || {}).length ? `<div class="wo-map"><div>${bodyMap(d.muscles, { height: 170, title: t('app.getraindeSpiergroepen') })}</div><div class="mbars">${Object.entries(d.muscles).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v], i, arr) => `<div class="mbar static"><span>${esc(MUSCLE_LABELS[k] || k)}</span><div class="ht"><div class="hf" style="width:${(v / arr[0][1]) * 100}%"></div></div><b>${fmtNum(v)}</b></div>`).join('')}</div></div>` : ''}
    ${insightsHtml(d)}
    ${d.hasDetail ? exs : '<div class="empty">' + t('app.geenDetailsVoorDeze') + '</div>'}`;
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
  const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString(localeOf());
  const start = a.start ? new Date(a.start).toLocaleTimeString(localeOf(), { hour: '2-digit', minute: '2-digit' }) : null;
  const mmss = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
  // tempo zoals gebruikelijk per sport: fietsen in km/u, zwemmen per 100 m, lopen per km; balsporten zonder tempo
  const pace = !(a.km && a.minutes) ? null : a.type === 'fietsen' ? `${n1(a.km / (a.minutes / 60))} km/u`
    : a.type === 'zwemmen' ? `${mmss(a.minutes / (a.km * 10))} /100 m`
    : ['wandelen', 'hardlopen', 'roeien'].includes(a.type) ? `${mmss(a.minutes / a.km)} /km` : null;
  const tiles = [[t('app.c.duur'), a.minutes != null ? `${a.minutes} min` : '—']];
  if (a.km) tiles.push([t('app.afstand'), a.type === 'zwemmen' && a.km < 10 ? `${Math.round(a.km * 1000).toLocaleString(localeOf())} m` : `${n1(a.km)} km`]);
  if (pace) tiles.push([a.type === 'fietsen' ? t('app.c.speed') : t('app.c.pace'), pace]);
  tiles.push(['kcal', a.kcal ?? '—']);
  if (a.hrAvg || a.hrMax) tiles.push(hrTile(a.hrAvg, a.hrMax));
  return `<div class="wo-sticky"><div class="exd-head"><div><div class="eyebrow">${esc(new Date(a.date + 'T12:00:00').toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}${start ? ` · ${start}` : ''}</div>
      <h2><span class="segdot" style="background:${actColor(a.type)}"></span>${esc(actName(a))}</h2>${actName(a) !== actLabel(a.type) ? `<div class="muted small">${esc(actLabel(a.type))}</div>` : ''}</div>${first ? '<button value="close" class="btn ghost small" aria-label="' + t('pk.close') + '">✕</button>' : ''}</div>
    <div class="wo-tiles">${tiles.map(([l, v, zc]) => `<div class="zoned"${zoneStyle(zc)}><div class="eyebrow">${l}</div><div class="mid">${esc(String(v))}</div></div>`).join('')}</div></div>
    ${Array.isArray(a.hrSeries) && a.hrSeries.length >= 3 ? (() => { const ref = hrRefClient(); return heartHtml({ source: 'Apple Health', series: a.hrSeries, ref, zones: zonesFor(a.hrSeries, ref) }); })() : ''}
    <p class="muted small" style="margin:0">${t('app.uitAppleHealth', { a: a.name && a.name !== actName(a) && !/^other/i.test(a.name) ? ` · ${esc(a.name)}` : '', b: a.source ? t('app.bron2', { a: esc(a.source) }) : '' })}</p>`;
}
// Venster met de trainingen en activiteiten van een dag.
async function openWorkouts(ids, acts = [], date = null) {
  const dlg = $('#woDlg');
  dlg.innerHTML = '<div class="exd"><div class="empty">' + t('app.laden') + '</div></div>';
  if (!dlg.open) dlg.showModal();
  try {
    const all = await Promise.all(ids.map((id) => api('GET', '/api/workout?id=' + encodeURIComponent(id))));
    const actHtml = acts.map((a, i) => activityHtml(a, !all.length && i === 0)).join('<hr class="wo-sep">');
    dlg.innerHTML = `<form method="dialog" class="exd">${actHtml && !all.length ? actHtml : ''}${all.map((d, i) => `
      <div class="wo-sticky"><div class="exd-head"><div><div class="eyebrow">${esc(new Date(d.date + 'T12:00:00').toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div><h2>${esc(d.title)}</h2></div><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
      ${woTiles(d)}
      <div class="row gap"><a class="btn small ghost" href="/api/workout/pdf?id=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">PDF</a><button type="button" class="btn small ghost" data-mail="${esc(d.id)}">${t('app.mailNaarMij')}</button></div></div>
      ${workoutHtml(d)}`).join('<hr class="wo-sep">')}${actHtml && all.length ? '<hr class="wo-sep">' + actHtml : ''}</form>`;
    dlg.querySelectorAll('[data-mail]').forEach((b) => b.addEventListener('click', () => busy(b, async () => {
      if (!state.settings.email) { toast(t('app.vulEerstJeE'), true); return; }
      try { const r = await api('POST', '/api/workout/mail', { id: b.dataset.mail }); toast(t('app.samenvattingGemaildNaar', { to: r.to })); } catch (er) { toast(er.message, true); }
    })));
  } catch (e) { dlg.innerHTML = `<form method="dialog" class="exd"><div class="exd-head"><h2>${t('ui.settings.training')}</h2><button value="close" class="btn ghost small">✕</button></div><div class="empty">${esc(e.message)}</div></form>`; }
}
const idsOnDate = (date) => (state.trainingDays || []).filter((w) => w.date === date).map((w) => w.id);
// Grafiek van de gekozen oefening in Voortgang (geschat 1RM en topgewicht).
function drawExercise() {
  const p = state.progress[+$('#exSelect').value];
  if (!p) { lineChart($('#chartExercise'), []); return; }
  lineChart($('#chartExercise'), [
    { cls: 'la', label: t('app.geschat1rm'), unit: 'kg', points: p.points.map((q) => ({ x: String(q.date).slice(0, 10), y: q.e1rm })) },
    { cls: 'lb', label: t('app.zwaarsteSet'), unit: 'kg', points: p.points.map((q) => ({ x: String(q.date).slice(0, 10), y: q.topWeight })) },
  ], { yLabel: 'kg' });
}
$('#exSelect').addEventListener('change', drawExercise);


// ---------- lichaamssamenstelling ----------
const COMP = tmap([
  ['kg', '§app.comp.kg', 'kg', 'down'], ['fat', '§app.comp.fat', '%', 'down'], ['fatMass', '§app.comp.fatMass', 'kg', 'down'],
  ['muscle', '§app.comp.muscle', 'kg', 'up'], ['fatFree', '§app.comp.fatFree', 'kg', 'up'], ['bone', '§app.comp.bone', 'kg', 'up'],
  ['water', '§app.comp.water', 'kg', null], ['ecw', '§app.comp.ecw', 'kg', null], ['icw', '§app.comp.icw', 'kg', null],
  ['visceral', '§app.comp.visceral', '', 'down'], ['bmr', '§app.comp.bmr', 'kcal', 'up'], ['metAge', '§app.comp.metAge', 'jr', 'down'],
  ['bmi', '§app.comp.bmi', '', null], ['ffmi', '§app.comp.ffmi', '', 'up'], ['musclePct', '§app.comp.musclePct', '%', 'up'],
  ['restHr', '§app.comp.restHr', 'bpm', 'down'], ['pwv', '§app.comp.pwv', 'm/s', 'down'], ['vascAge', '§app.comp.vascAge', 'jr', 'down'],
  ['nerve', '§app.comp.nerve', 'µS', 'up'],
  ['hrv', '§app.comp.hrv', 'ms', 'up'], ['vo2max', '§app.comp.vo2max', 'ml/kg/min', 'up'],
]);

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
const hrTile = (avg, max) => [t('app.hrAvgMax'), `${avg ?? '—'}${max ? `/${max}` : ''}`, hrZoneColor(avg)];

// Richtwaarden per meting (subtiele achtergrond in de grafiek). ok = groen, warn = geel, bad = rood.
// Bronnen: BMI WHO; vet% Gallagher e.a. (2000, naar leeftijd en geslacht); overige zijn grove richtwaarden.
function healthBands(metric) {
  const s = state.settings, age = s.birthYear ? new Date().getFullYear() - s.birthYear : null, h = heightM();
  // richtwaarden per man/vrouw; bij een ander geslacht de zelfgekozen tabel
  const sex = ['m', 'v'].includes(s.sex) ? s.sex : s.bandSex;
  const B = (...r) => r.map(([from, to, cls]) => ({ from, to, cls }));
  const ageBands = (a) => a ? B([-Infinity, a + 0.5, 'ok'], [a + 0.5, a + 5.5, 'warn'], [a + 5.5, Infinity, 'bad']) : null;
  switch (metric) {
    case 'bmi': return { bands: B([-Infinity, 18.5, 'warn'], [18.5, 25, 'ok'], [25, 30, 'warn'], [30, Infinity, 'bad']), note: t('app.bmi18525') };
    case 'kg': return h ? { bands: B([-Infinity, 18.5 * h * h, 'warn'], [18.5 * h * h, 25 * h * h, 'ok'], [25 * h * h, 30 * h * h, 'warn'], [30 * h * h, Infinity, 'bad']), note: t('app.gezondGewichtBijCm', { a: Math.round(h * 100), b: Math.round(18.5 * h * h), c: Math.round(25 * h * h) }) } : null;
    case 'fat': {
      if (!sex || !age) return { bands: null, note: tx('app.vulGeslachtOfDe') };
      const t = sex === 'm' ? (age < 40 ? [8, 20, 25] : age < 60 ? [11, 22, 28] : [13, 25, 30]) : (age < 40 ? [21, 33, 39] : age < 60 ? [23, 34, 40] : [24, 36, 42]);
      return { bands: B([-Infinity, t[0], 'warn'], [t[0], t[1], 'ok'], [t[1], t[2], 'warn'], [t[2], Infinity, 'bad']), note: tx('app.gezondVoorJouwLeeftijd', { a: t[0], b: t[1] }) };
    }
    case 'visceral': return { bands: B([-Infinity, 12.5, 'ok'], [12.5, 14.5, 'warn'], [14.5, Infinity, 'bad']), note: t('app.richtwaardeOnder13Gezond') };
    case 'ffmi': return sex ? { bands: sex === 'm' ? B([-Infinity, 17, 'warn'], [17, Infinity, 'ok']) : B([-Infinity, 14, 'warn'], [14, Infinity, 'ok']), note: t('app.richtwaardeVanafGoed', { a: sex === 'm' ? 17 : 14 }) } : { bands: null, note: t('app.vulGeslachtOfDe2') };
    case 'restHr': return { bands: B([-Infinity, 75, 'ok'], [75, 90, 'warn'], [90, Infinity, 'bad']), note: t('app.richtwaardeOnder75Goed') };
    case 'pwv': return { bands: B([-Infinity, 8, 'ok'], [8, 10, 'warn'], [10, Infinity, 'bad']), note: t('app.richtwaardeOnder8M') };
    case 'hrv': return { bands: null, note: t('sig.hrvNote') };
    case 'vo2max': return { bands: null, note: t('sig.vo2Note') };
    case 'nerve': return { bands: B([-Infinity, 40, 'bad'], [40, 60, 'warn'], [60, Infinity, 'ok']), note: t('app.richtwaardeVanaf60S') };
    case 'metAge': case 'vascAge': return age ? { bands: ageBands(age), note: t('app.groenGelijkAanOf', { age }) } : { bands: null, note: t('app.vulJeGeboortejaarIn') };
    default: return null;
  }
}
// lengte in meters: eigen instelling gaat voor, anders uit Withings
const heightM = () => (state.settings.heightCm ? state.settings.heightCm / 100 : state.withings?.height || null);
// BMI per meting berekenen (gewicht / lengte²)
// HRV en VO2max van de Apple Watch (dagwaarden) bij de metingen van de weegschaal voegen, voor de tegels en grafiek.
function withWatch(log) {
  const extra = (state.healthDaily || []).filter((d) => d.hrv || d.vo2max);
  if (!extra.length) return log;
  const out = log.map((b) => ({ ...b }));
  const byDay = new Map(out.map((b) => [String(b.date).slice(0, 10), b]));
  for (const d of extra) {
    const b = byDay.get(d.date);
    if (b) { if (d.hrv) b.hrv = Math.round(d.hrv); if (d.vo2max) b.vo2max = Math.round(d.vo2max * 10) / 10; }
    else { const n = { date: d.date, ...(d.hrv && { hrv: Math.round(d.hrv) }), ...(d.vo2max && { vo2max: Math.round(d.vo2max * 10) / 10 }) }; out.push(n); byDay.set(d.date, n); }
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
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
const BODY_RANGES = tmap([['wk', '§app.bodyranges.wk', 'week'], ['mo', '§app.bodyranges.mo', 'month'], ['ytd', '§app.bodyranges.ytd', 'year'],
  ['1m', '§app.bodyranges.1m', 30], ['3m', '§app.bodyranges.3m', 91], ['6m', '§app.bodyranges.6m', 182], ['1y', '§app.bodyranges.1y', 365], ['all', '§app.bodyranges.all', null]]);
let bodyRange = 'all';
try { bodyRange = localStorage.getItem('gc-body-range') || 'all'; } catch {}
const rangeStart = (lastDate) => {
  const r = BODY_RANGES.find(([k]) => k === bodyRange);
  if (typeof r?.[2] === 'string') return periodStart(r[2]); // kalenderperiode, niet t.o.v. de laatste meting
  return r?.[2] && lastDate ? daysBefore(lastDate, r[2]) : '';
};
const rangeChips = (id) => `<select id="${id}" class="period-sel" aria-label="${t('ui.stats.periode')}" title="${t('app.kalenderperiodesTellenVanafMaandag')}">
  <optgroup label="${t('ui.stats.kalender')}">${BODY_RANGES.filter((r) => typeof r[2] === 'string').map(([k, l]) => `<option value="${k}" ${k === bodyRange ? 'selected' : ''}>${l}</option>`).join('')}</optgroup>
  <optgroup label="${t('ui.stats.terugkijken')}">${BODY_RANGES.filter((r) => typeof r[2] !== 'string').map(([k, l]) => `<option value="${k}" ${k === bodyRange ? 'selected' : ''}>${l}</option>`).join('')}</optgroup></select>`;
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
// Namen van segmenten worden in het Nederlands bewaard (instelling); voor het tonen vertaald.
// Labels midden in een zin: klein, behalve in het Duits (zelfstandige naamwoorden met hoofdletter).
const lc = (x) => (getLang() === 'de' ? String(x) : String(x).toLowerCase());
const segName = (n) => (has('app.seg.' + n) ? t('app.seg.' + n) : n);
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
  const log = withBmi(withWatch(state.bodyLog));
  const avail = COMP.filter(([k]) => log.some((b) => b[k] != null));
  const card = $('#compCard');
  if (!avail.length) { card.innerHTML = '<h2>' + t('app.lichaamssamenstelling') + '</h2><div class="empty">' + t('app.nogGeenMetingenKoppel') + '</div>'; $('#segCard').classList.add('hidden'); return; }
  if (!avail.some(([k]) => k === compMetric)) compMetric = avail[0][0];
  const tiles = avail.map(([k, label, unit, good]) => {
    const cur = lastWith(log, k);
    const old = lastWith(log, k, daysBefore(cur.date, 30)) || log.find((b) => b[k] != null);
    const d = old && old !== cur ? Math.round((cur[k] - old[k]) * 10) / 10 : null;
    const cls = d == null || d === 0 || !good ? 'muted' : (d > 0) === (good === 'up') ? 'up' : 'down';
    const zc = BAND_COLORS[bandOf(healthBands(k)?.bands, cur[k])];
    return `<button class="ctile zoned ${k === compMetric ? 'on' : ''}" data-k="${k}"${zoneStyle(zc)}>
      <div class="eyebrow">${label}</div><div class="mid">${cur[k]}<small> ${unit}</small></div>
      <div class="small ${cls}">${d == null ? '—' : `${d > 0 ? '+' : ''}${d} ${unit}`} <span class="muted">${old && old !== cur ? t('app.sinds', { a: esc(old.date.slice(5)) }) : ''}</span></div></button>`;
  }).join('');
  const [, mLabel, mUnit, mGood] = COMP.find(([k]) => k === compMetric);
  const tr = trendOf(log, compMetric);
  let trendTxt = '';
  if (tr) {
    const goodDir = compMetric === 'kg' ? (state.settings.goal === 'spieropbouw' ? 'up' : 'down') : mGood;
    const cls = !goodDir || Math.abs(tr.slope) < 0.005 ? '' : (tr.slope > 0) === (goodDir === 'up') ? 'up' : 'down';
    trendTxt = `${t('app.trend4WekenT', { a: esc(tr.to.slice(5)) })} <b class="${cls}">${tr.slope >= 0 ? '+' : ''}${tr.slope.toFixed(2)} ${compMetric === 'fat' ? t('app.puntWeek') : mUnit ? esc(mUnit) + t('app.week4') : t('app.perWeek')}</b>`;
    if (compMetric === 'kg') trendTxt += ` (${tr.pct.toFixed(2)}%)${state.settings.goal !== 'spieropbouw' ? ' <span class="muted">' + t('app.richtwaardeBijAfvallenCa') + '</span>' : ''}`;
  }
  card.innerHTML = `<div class="row between wrap gap"><h2>${t('app.lichaamssamenstelling')}</h2><span class="muted">${t('app.laatsteMeting', { a: esc(lastWith(log, 'kg')?.date || '') })}</span></div>
    <div class="ctiles">${tiles}</div>
    <div class="row between wrap gap" style="margin-top:1rem"><div class="eyebrow" style="margin:0">${t('app.overTijd', { mLabel, a: mUnit ? ` (${mUnit})` : '' })}</div><div class="row gap wrap"><span class="small">${trendTxt}</span>${rangeChips('compRange')}<button class="chip ${compTrain ? 'on' : ''}" id="trainToggle" aria-pressed="${compTrain}" title="${t('app.toonDeDagenWaarop')}"><span class="dot tm"></span> ${t('app.activiteiten')}</button><button class="chip ${compTrend ? 'on' : ''}" id="trendToggle" aria-pressed="${compTrend}" title="${t('app.gemiddeldeOver14Dagen')}"><span class="dot b"></span> ${t('app.trendlijn')}</button></div></div>
    <div id="chartComp" class="chart tall"></div>`;
  const pts = log.filter((b) => b[compMetric] != null).map((b) => ({ x: b.date, y: b[compMetric] }));
  const series = [{ cls: 'la', label: mLabel, unit: mUnit, points: pts }];
  if (compTrend && pts.length > 2) series.push({ cls: 'lb', label: t('app.trend14D'), unit: mUnit, points: smoothTrend(pts) });
  const from = rangeStart(pts[pts.length - 1]?.x);
  if (from) series.forEach((sr) => { sr.points = sr.points.filter((q) => q.x >= from); });
  const marks = compTrain ? [
    ...(state.trainingDays || []).map((w) => ({ x: w.date, label: w.title + (w.min ? t('app.min5', { min: w.min }) : '') })),
    ...(state.activities || []).map((a) => ({ x: a.date, label: actLine(a), color: actColor(a.type) })),
  ] : [];
  if (compTrain && marks.length) {
    const from2 = series[0].points[0]?.x || '';
    const types = [...new Set((state.activities || []).filter((x) => x.date >= from2).map((x) => x.type))];
    const hasGm = (state.trainingDays || []).some((w) => w.date >= from2);
    if (hasGm || types.length) $('#chartComp').insertAdjacentHTML('afterend', `<div class="band-note small muted">${t('app.streepjesOnderDeGrafiek', { a: hasGm ? '<span class="sw" style="background:var(--ok);opacity:.8"></span>' + t('app.gymMonster') + ' ' : '', b: types.map((t) => `<span class="sw" style="background:${actColor(t)};opacity:.8"></span>${esc(lc(actLabel(t)))}`).join(' ') })}</div>`);
  }
  const hb = healthBands(compMetric);
  if (hb?.note) $('#chartComp').insertAdjacentHTML('afterend', `<div class="band-note small muted">${hb.bands ? '<span class="sw ok"></span>' + t('app.goed') + ' <span class="sw warn"></span>' + t('app.letOp') + ' <span class="sw bad"></span>' + t('app.nietGoed') + ' ' : ''}${esc(hb.note)}</div>`);
  if (!series[0].points.length) $('#chartComp').innerHTML = '<div class="empty">' + t('app.geenMetingenInDeze') + '</div>';
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
const SEG_METRICS = tmap({ muscle: ['§app.segmetrics.muscle', 'kg', 'up'], fatMass: ['§app.segmetrics.fatMass', 'kg', 'down'], fatFree: ['§app.segmetrics.fatFree', 'kg', 'up'], pct: ['§app.segmetrics.pct', '%', 'down'] });
const segVal = (s, m) => m === 'pct' ? (s?.fatMass != null && s?.fatFree != null ? Math.round((s.fatMass / (s.fatMass + s.fatFree)) * 1000) / 10 : null) : s?.[m] ?? null;

// Segmenten per arm, been en romp, met links/rechts-balans.
function renderSegments() {
  const log = state.bodyLog.filter((b) => b.segments && Object.keys(b.segments).length);
  const card = $('#segCard');
  const w = state.withings || {};
  if (!log.length) {
    if (w.connected && w.extended === false) {
      card.classList.remove('hidden');
      card.innerHTML = `<h2>${t('app.perSegment')}</h2><p class="muted">${t('app.withingsGeeftVoorJouw')}</p>`;
    } else card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  const saved = state.settings.withings?.segmentNames || {};
  const nameOf = (p) => saved[p] || SEG_DEFAULT[p] || `Positie ${p}`;
  const showName = (p) => (saved[p] || SEG_DEFAULT[p] ? segName(saved[p] || SEG_DEFAULT[p]) : t('app.segPosition', { p }));
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
  const pairs = [[t('app.seg.armen'), 'Linkerarm', 'Rechterarm', '#ff7a2e'], [t('app.seg.benen'), 'Linkerbeen', 'Rechterbeen', '#4cc26a']]
    .map(([label, l, r, color]) => ({ label, l: posOf(l), r: posOf(r), color })).filter((x) => x.l != null && x.r != null);
  const balUnit = segMetric === 'pct' ? t('app.seg.pctPt') : '%';
  const balOf = (b, pr, m = segMetric) => {
    const L = segVal(b.segments?.[pr.l], m), R = segVal(b.segments?.[pr.r], m);
    if (L == null || R == null || !(L + R)) return null;
    return Math.round((m === 'pct' ? R - L : ((R - L) / ((L + R) / 2)) * 100) * 10) / 10;
  };
  const balTxt = (v) => v == null ? '—' : Math.abs(v) < 1 ? t('app.seg.balanced') : t(v > 0 ? 'app.seg.moreRight' : 'app.seg.moreLeft', { v: fmtNum(Math.abs(v)), u: balUnit });
  const balCls = (v) => v == null ? 'muted' : Math.abs(v) < 3 ? 'up' : Math.abs(v) < 8 ? 'balwarn' : 'down';
  // 6e punt op de weegschaal: visceraal vet (een index, geen segment) — klik toont de grafiek bovenaan
  const vLast = lastWith(state.bodyLog, 'visceral');
  const vOld = vLast && (lastWith(state.bodyLog, 'visceral', daysBefore(vLast.date, 30)) || null);
  const vD = vLast && vOld && vOld !== vLast ? Math.round((vLast.visceral - vOld.visceral) * 10) / 10 : null;
  const viscRow = vLast ? `<tr class="click" id="viscRow" title="${t('app.toonVisceraalVetIn')}"><td><span class="segdot" style="background:#ff6b9a"></span>${t('app.visceraalVet')} <span class="muted small">${t('app.buikholteIndex')}</span></td>
    <td class="num muted">—</td><td class="num">${t('app.index', { a: Number(vLast.visceral).toFixed(1), b: vD ? ` <span class="${vD < 0 ? 'up' : 'down'} small">${vD > 0 ? '+' : ''}${vD}</span>` : '' })}</td><td colspan="2" class="muted small">${t('app.metingRichtwaardeOnder13', { a: esc(vLast.date) })}</td></tr>` : '';
  const balTiles = pairs.length ? `<div class="bal-tiles">${pairs.map((pr) => {
    const v = balOf(last, pr), o = old !== last ? balOf(old, pr) : null;
    const L = segVal(last.segments[pr.l], segMetric), R = segVal(last.segments[pr.r], segMetric);
    const d = v != null && o != null ? Math.round((Math.abs(v) - Math.abs(o)) * 10) / 10 : null;
    return `<div class="bal-tile"><div class="eyebrow">${t('app.balans', { a: lc(pr.label), b: esc(lc(SEG_METRICS[segMetric][0])) })}</div>
      <div class="mid ${balCls(v)}">${esc(balTxt(v))}</div>
      <div class="small muted">L ${L ?? '—'} · R ${R ?? '—'} ${esc(SEG_METRICS[segMetric][1])}${d ? ` · <span class="${d < 0 ? 'up' : 'down'}">${t(d < 0 ? 'app.inBalansMeer' : 'app.inBalansMinder')}</span> ${t('app.dan', { a: esc(old.date.slice(5)) })}` : ''}</div></div>`;
  }).join('')}</div>` : '';
  const [mLabel, mUnit] = SEG_METRICS[segMetric];
  const segFrom = rangeStart(last.date);
  const chartLog = segFrom ? log.filter((b) => b.date >= segFrom) : log;
  card.innerHTML = `<div class="row between wrap gap"><h2>${t('app.perSegment')}</h2><span class="muted">${esc(last.date)}${old !== last ? t('app.verschilTOV', { a: esc(old.date) }) : ''}</span></div>
    ${guessed ? '<p class="small muted" style="margin-top:-.3rem">' + t('app.namenMetZijnEen') + '</p>' : ''}
    <div class="tablewrap"><table><thead><tr><th>${t('app.segment')}</th><th class="num">${t('app.spiermassa')}</th><th class="num">${t('app.vetmassa')}</th><th class="num">${t('app.vetvrijeMassa')}</th><th class="num">${t('app.vet2')}</th></tr></thead><tbody>
    ${positions.map((p, i) => {
      const s = last.segments[p] || {}, o = old.segments?.[p] || {};
      const pct = segVal(s, 'pct');
      const cur = saved[p] || '';
      return `<tr><td><span class="segdot" style="background:${SEG_COLORS[i % SEG_COLORS.length]}"></span><select class="segname" data-p="${p}" aria-label="${t('app.segNameFor', { p })}"><option value="">${esc(SEG_DEFAULT[p] ? segName(SEG_DEFAULT[p]) + ' (?)' : t('app.segPosition', { p }))}</option>${SEG_GUESS.map((g) => `<option value="${g}" ${cur === g ? 'selected' : ''}>${segName(g)}</option>`).join('')}</select></td>
        <td class="num">${s.muscle ?? '—'}${s.muscle != null ? ' kg' : ''}${fmtD(s.muscle, o.muscle, 'up')}</td>
        <td class="num">${s.fatMass ?? '—'}${s.fatMass != null ? ' kg' : ''}${fmtD(s.fatMass, o.fatMass, 'down')}</td>
        <td class="num">${s.fatFree ?? '—'}${s.fatFree != null ? ' kg' : ''}${fmtD(s.fatFree, o.fatFree, 'up')}</td>
        <td class="num">${pct ?? '—'}${pct != null ? '%' : ''}</td></tr>`;
    }).join('')}${viscRow}</tbody></table></div>
    ${balTiles}
    <div class="row between wrap gap" style="margin-top:1rem">
      <div class="eyebrow" style="margin:0">${mLabel} ${segMode === 'bal' ? t('app.verschilLinksRechts0', { balUnit }) : t('app.perSegment2', { a: segMode === 'delta' ? t('app.veranderingSinds', { a: esc(chartLog[0]?.date || '—'), b: segMetric === 'pct' ? '%-punt' : mUnit }) : t('app.absoluut2', { mUnit }) })}</div>
      <div class="row gap wrap">
        <div class="chips small" id="segSwitch">${Object.entries(SEG_METRICS).map(([k, [l]]) => `<button data-m="${k}" class="${k === segMetric ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${rangeChips('segRange')}
        <button class="chip ${segTrend ? 'on' : ''}" id="segTrendToggle" aria-pressed="${segTrend}" title="${t('app.gemiddeldeOver14Dagen2')}"><span class="dot b"></span> ${t('app.trendlijn')}</button>
        <div class="chips small" id="segMode"><button data-v="delta" class="${segMode === 'delta' ? 'on' : ''}">${t('app.verandering')}</button><button data-v="abs" class="${segMode === 'abs' ? 'on' : ''}">${t('app.absoluut')}</button>${pairs.length ? `<button data-v="bal" class="${segMode === 'bal' ? 'on' : ''}">${t('app.balansLR')}</button>` : ''}</div>
      </div>
    </div>
    <div id="chartSeg" class="chart tall"></div>
    ${segMode === 'bal' ? `<div class="seg-toggles bal-toggles">${pairs.map((pr) => `<button class="seg-tg ${balHidden.has(pr.label) ? 'off' : ''}" data-b="${esc(pr.label)}" aria-pressed="${!balHidden.has(pr.label)}"><span class="segdot" style="background:${pr.color}"></span>${esc(pr.label)}</button>`).join('')}</div>` : ''}
    <div class="seg-toggles${segMode === 'bal' ? ' hidden' : ''}">${positions.map((p, i) => `<button class="seg-tg ${segHidden.has(p) ? 'off' : ''}" data-p="${p}" aria-pressed="${!segHidden.has(p)}"><span class="segdot" style="background:${SEG_COLORS[i % SEG_COLORS.length]}"></span>${esc(showName(p))}</button>`).join('')}
      <button class="seg-tg all" data-p="all">${segHidden.size ? t('app.allesTonen') : t('app.allesVerbergen')}</button></div>`;
  bindRange(card, 'segRange');
  const visible = positions.map((p, i) => [p, i]).filter(([p]) => !segHidden.has(p));
  if (segMode === 'bal' && !pairs.length) segMode = 'delta';
  if (!chartLog.length) $('#chartSeg').innerHTML = '<div class="empty">' + t('app.geenMetingenInDeze') + '</div>';
  else if (segMode === 'bal') {
    const shown = pairs.filter((pr) => !balHidden.has(pr.label));
    if (!shown.length) $('#chartSeg').innerHTML = '<div class="empty">' + t('app.zetArmenOfBenen') + '</div>';
    else lineChart($('#chartSeg'), shown.flatMap((pr) => {
      // grootte van het verschil (altijd positief); welke kant zwaarder is staat in de tooltip
      const all = log.map((b) => { const v = balOf(b, pr); return v == null ? null : { x: b.date, y: Math.abs(v), note: v > 0 ? t('app.rechtsMeer') : v < 0 ? t('app.linksMeer') : t('app.gelijk') }; }).filter(Boolean);
      const inRange = (q) => !segFrom || q.x >= segFrom;
      const out = [{ color: pr.color, label: `${pr.label}`, unit: balUnit, points: all.filter(inRange) }];
      if (segTrend && all.length > 2) out.push({ color: pr.color, dash: true, label: t('app.trend', { label: pr.label }), unit: balUnit, points: smoothTrend(all).filter(inRange) });
      return out;
    }), { fromZero: true, bands: [{ from: 0, to: 3, cls: 'ok' }, { from: 3, to: 8, cls: 'warn' }, { from: 8, to: Infinity, cls: 'bad' }] });
  } else if (!visible.length) { $('#chartSeg').innerHTML = '<div class="empty">' + t('app.zetMinstensEenSegment') + '</div>'; }
  else lineChart($('#chartSeg'), visible.flatMap(([p, i]) => {
    // trend over de volledige historie berekenen, daarna pas de periode tonen
    const all = log.map((b) => ({ x: b.date, y: segVal(b.segments[p], segMetric) })).filter((q) => q.y != null);
    const inRange = (q) => !segFrom || q.x >= segFrom;
    const pts = all.filter(inRange);
    const base = pts[0]?.y ?? 0;
    const rel = (arr) => segMode === 'delta' ? arr.map((q) => ({ x: q.x, y: Math.round((q.y - base) * 100) / 100 })) : arr;
    const color = SEG_COLORS[i % SEG_COLORS.length], unit = segMode === 'delta' && segMetric === 'pct' ? '%-punt' : mUnit;
    const out = [{ color, label: showName(p) + (segMode === 'delta' ? ' (Δ)' : ''), unit, points: rel(pts).map((q) => ({ x: q.x, y: Math.round(q.y * 10) / 10 })) }];
    if (segTrend && all.length > 2) out.push({ color, dash: true, label: showName(p) + t('app.trend2'), unit, points: rel(smoothTrend(all).filter(inRange)) });
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
    try { const r = await api('PUT', '/api/withings/segments', { names: n }); state.settings.withings.segmentNames = r.segmentNames; toast(t('app.segmentnaamOpgeslagen')); renderSegments(); }
    catch (e) { toast(e.message, true); }
  }));
}

// ---------- lichaam ----------
function renderWithings() {
  const w = state.withings || {};
  $('#withingsCard').innerHTML = `<div class="row between wrap gap">
    <div><div class="eyebrow">${t('app.withingsWeegschaal')}</div>
      <div>${w.connected ? `<span class="badge ok">${t('app.gekoppeld')}</span> <span class="muted">${t('app.laatstOpgehaald', { a: w.lastSync ? new Date(w.lastSync).toLocaleString(localeOf(), { dateStyle: 'short', timeStyle: 'short' }) : t('app.nogNiet') })}</span>` : '<span class="muted">' + t('app.nietGekoppeldKoppelenDoe') + '</span>'}
      ${w.lastError ? `<div class="down small">${esc(w.lastError)}</div>` : ''}</div></div>
    <div class="row gap wrap">
      ${w.connected ? '<button class="btn" id="wSync">' + t('app.nuOphalen') + '</button>' : ''}
      <button class="btn accent" id="bwAdd">${t('app.metingToevoegen')}</button>
    </div></div>`;
  $('#wSync')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => { const r = await api('POST', '/api/withings/sync'); toast(t('app.dagEnBijgewerkt', { added: r.added })); await load(); renderBody(); }));
  $('#bwAdd').addEventListener('click', openAddMeasurement);
}

// Venster voor een handmatige meting.
function openAddMeasurement() {
  const dlg = $('#bwDlg');
  const last = lastWith(state.bodyLog, 'kg');
  dlg.innerHTML = `<form method="dialog" class="exd" id="bwForm">
    <div class="exd-head"><div><div class="eyebrow">${t('app.handmatig')}</div><h2>${t('app.metingToevoegen')}</h2></div><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
    <div class="row gap wrap">
      <label style="flex:1 1 150px">${t('app.datum')} <input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
      <label style="flex:1 1 120px">${t('app.gewichtKg')} <input type="number" name="kg" step="0.1" min="20" max="400" required placeholder="${last ? last.kg : ''}"></label>
      <label style="flex:1 1 120px">${t('app.vetOptioneel')} <input type="number" name="fat" step="0.1" min="2" max="70"></label>
    </div>
    <p class="muted small" style="margin:0">${t('app.eenHandmatigeMetingOp')}</p>
    <div class="row gap end"><button value="close" class="btn ghost" formnovalidate>${t('ed.cancel')}</button><button value="ok" class="btn accent">${t('ed.save')}</button></div></form>`;
  const f = dlg.querySelector('#bwForm');
  dlg.returnValue = '';
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'ok') return;
    try {
      state.bodyLog = (await api('POST', '/api/bodyweight', { date: f.date.value, kg: +f.kg.value, fat: f.fat.value ? +f.fat.value : null })).bodyLog;
      toast(t('app.metingOpgeslagen')); renderBody();
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
  $('#bwList').innerHTML = log.length ? `<div class="tablewrap"><table><thead><tr><th>${t('app.datum')}</th><th class="num">kg</th><th class="num">${t('app.vet3')}</th><th class="num">${t('app.spier')}</th><th>${t('app.bron')}</th><th></th></tr></thead><tbody>${log.slice().reverse().map((b) => `<tr><td>${esc(b.date)}</td><td class="num">${b.kg ?? '—'}</td><td class="num">${b.fat ?? '—'}</td><td class="num">${b.muscle ?? '—'}</td><td class="muted">${b.source === 'withings' ? t('ui.settings.withings') : 'handmatig'}</td><td style="text-align:right"><button class="btn small ghost" data-del="${esc(b.date)}">${t('app.verwijder')}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">' + t('app.nogGeenMetingen2') + '</div>';
}
$('#bwList').addEventListener('click', async (ev) => {
  const d = ev.target.dataset.del;
  if (!d || !await askConfirm(t('app.metingVanVerwijderen', { d }), { danger: true, okText: t('tp.delete') })) return;
  state.bodyLog = (await api('DELETE', '/api/bodyweight?date=' + encodeURIComponent(d))).bodyLog; renderBody();
});

// Withings koppelen/ontkoppelen (Instellingen)
function renderWithingsSettings() {
  const w = state.withings || {}, cfg = state.settings.withings || {};
  const box = $('#wsStatus'); if (!box) return;
  const configured = cfg.clientId && cfg.redirectUri;
  box.innerHTML = `<div class="row between wrap gap"><div>${w.connected ? `<span class="badge ok">${t('app.gekoppeld')}</span> <span class="muted small">${t('app.sinds', { a: w.connectedAt ? new Date(w.connectedAt).toLocaleDateString(localeOf()) : '—' })}</span>` : `<span class="muted small">${configured ? t('app.nietGekoppeldKlikOp') : state.me?.role === 'admin' ? t('app.vulEerstHieronderDe') : t('app.deBeheerderHeeftDe')}</span>`}</div>
    <div class="row gap">${w.connected ? '<button type="button" class="btn ghost small" id="wOff">' + t('app.ontkoppelen') + '</button>' : configured ? '<a class="btn accent small" href="/api/withings/connect" target="_blank" id="wConnect">' + t('app.koppelWithings') + '</a>' : ''}</div></div>`;
  $('#wOff')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    if (!await askConfirm(t('app.withingsOntkoppelenOpgehaaldeMetingen'))) return;
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
    if (el.name === 'ai.apiKey' || el.name === 'withings.clientSecret' || el.name === 'smtp.pass') { el.value = ''; el.placeholder = v ? t('app.ingesteldLeegOngewijzigd', { v }) : t('app.nogNietIngesteld'); continue; }
    el.value = v ?? '';
  }
  if (!f['withings.redirectUri'].value) f['withings.redirectUri'].value = cbDefault();
  // accessoires die je niet gebruikt: vinkjes zonder name, zodat de algemene formulierlus ze overslaat
  const no = new Set(s.noAccessories || []);
  $('#accBox').innerHTML = (state.accessories || []).map((a) => `<label class="chip-check"><input type="checkbox" data-acc="${esc(a.key)}"${no.has(a.key) ? ' checked' : ''}><span>${esc(a.label)}<i class="acc-n" title="${t('app.oefeningenMetDitAccessoire')}">${a.count}</i></span></label>`).join('');
  const mc = s.smtp && (s.smtp.configured ?? !!(s.smtp.host && s.smtp.from));
  $('#mailNote').textContent = mc ? '' : t('app.letOpDeBeheerder');
  // taalkeuze: pas zichtbaar als er meer dan één taal te kiezen is
  $('#langWrap').classList.toggle('hidden', LANGS.length < 2);
  f.lang.innerHTML = `<option value="">${esc(t('lang.auto'))}</option>` + LANGS.map((l) => `<option value="${l.code}">${esc(l.name)}</option>`).join('');
  f.lang.value = s.lang || '';
  const toggleBand = () => $('#bandSexWrap').classList.toggle('hidden', ['m', 'v'].includes(f.sex.value));
  toggleBand(); f.sex.onchange = toggleBand;
  syncOutputs();
  const lb = state.library || {};
  const MODEL = { 1: 'Gym Monster 1', 2: 'Gym Monster 2' };
  $('#libInfo').textContent = !lb.source ? (lb.deviceType ? t('app.nogGeenOefeningencatalogusVoor') : t('app.deOefeningencatalogusWordtOpgehaald'))
    : lb.source === 'account' ? t('app.oefeningenVoorOpgehaaldVan', { count: lb.count, a: MODEL[lb.deviceType] || 'toestel ' + lb.deviceType, b: lb.updatedAt ? ` op ${new Date(lb.updatedAt.replace(' ', 'T') + 'Z').toLocaleDateString(localeOf(), { day: 'numeric', month: 'long', year: 'numeric' })}` : '' })
    : t('app.oefeningenUitDeIngebouwde', { count: lb.count });
}
// Toont de waarden van de schuifjes (dagen, minuten) in Instellingen.
function syncOutputs() {
  const f = $('#settingsForm');
  $('#daysOut').textContent = f.daysPerWeek.value + '×';
  $('#minOut').textContent = f.minutesPerSession.value + ' min';
  document.querySelector('.ai-local').classList.toggle('hidden', f['ai.provider'].value !== 'openai');
  const ai = state.settings?.ai || {};
  if ($('#aiStatus')) $('#aiStatus').innerHTML = ai.provider === 'anthropic' && ai.apiKey ? `<span class="badge ok">${t('app.actief')}</span> <span class="small">${t('app.claudeApiModelSleutel', { a: esc(ai.model || 'claude-sonnet-5-5'), b: esc(ai.apiKey) })}</span>`
    : ai.provider === 'openai' ? `<span class="badge ok">${t('app.actief')}</span> <span class="small">${t('app.lokaalModelVia', { a: esc(ai.baseUrl || '') })}</span>`
    : `<span class="badge warn">${t('app.uit')}</span> <span class="small muted">${ai.apiKey ? t('app.erIsWelEen') : t('app.kiesEenProviderEn')}</span>`;
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
  if ($('#accBox').children.length) out.noAccessories = [...f.querySelectorAll('[data-acc]:checked')].map((x) => x.dataset.acc);
  try {
    const before = state.settings;
    state.settings = (await api('PUT', '/api/settings', out)).settings;
    fillSettings();
    const cs = (x) => (['m', 'v'].includes(x.sex) ? x.sex : ['m', 'v'].includes(x.bandSex) ? x.bandSex : '');
    const changed = ['goal', 'daysPerWeek', 'minutesPerSession', 'experience', 'warmup', 'cooldown', 'pushMobility'].some((k) => before[k] !== state.settings[k]) || cs(before) !== cs(state.settings)
      || [...(before.noAccessories || [])].sort().join() !== [...(state.settings.noAccessories || [])].sort().join();
    if ((before.lang || '') !== (state.settings.lang || '')) { storeLang(state.settings.lang || ''); location.reload(); return; } // andere taal: alles opnieuw opbouwen
    if (figureFor(before) !== figureFor(state.settings)) { renderPlan(); if ($('#tab-home').classList.contains('active')) renderHome(); }
    if (state.setup?.needed) { await load(); toast(t('app.opgeslagen')); }
    else if (changed) { state.plan = (await api('POST', '/api/plan/generate')).plan; if (state.meta) state.meta.coach = null; renderCoach(null); renderPlan(); toast(t('app.opgeslagenNieuwPlanGemaakt')); }
    else toast(t('app.opgeslagen'));
  } catch (e) { toast(e.message, true); }
});
$('#mailTest').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  try { const r = await api('POST', '/api/mail/test'); toast(t('app.testmailVerstuurdNaar', { to: r.to })); } catch (e) { toast(e.message, true); }
}));
const cbDefault = () => location.origin + '/api/withings/callback';
$('#cbFill').addEventListener('click', () => { $('#settingsForm')['withings.redirectUri'].value = cbDefault(); toast(t('app.adresIngevuldVergeetNiet')); });
$('#cbCopy').addEventListener('click', async () => {
  const el = $('#settingsForm')['withings.redirectUri'];
  if (!el.value) el.value = cbDefault();
  try { await navigator.clipboard.writeText(el.value); toast(t('app.gekopieerd2') + el.value); }
  catch { el.select(); document.execCommand('copy'); toast(t('app.gekopieerd2') + el.value); }
});
$('#fullSyncBtn').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  toast(t('app.volledigeHistorieOphalenDit'));
  try { const r = await api('POST', '/api/sync?full=1'); toast(t('app.klaarNieuweTrainingenMet', { a: r.meta.lastSyncFetched ?? 0 })); }
  catch (e) { toast(e.message, true); }
  finally { await load(); }
}));
$('#libBtn').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
  const r = await api('POST', '/api/library/refresh'); state.libraryCount = r.count; fillSettings(); toast(t('app.catalogusVerverstOefeningen', { count: r.count }));
}));


// ---------- Speediance-account ----------
async function loadAccount() {
  try {
    const a = await api('GET', '/api/account');
    const f = $('#accountForm');
    f.email.value = a.email; f.password.value = '';
    f.password.placeholder = a.passwordSet ? t('app.ingesteldLeegLatenOngewijzigd') : t('app.nogNietIngesteld');
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
  $('#accountInfo').innerHTML = '<span class="muted">' + t('app.opslaanEnInloggenBij') + '</span>';
  await busy(btn, async () => {
    const r = await api('PUT', '/api/account', payload);
    f.password.value = '';
    $('#accountInfo').innerHTML = r.login.ok
      ? `<span class="up">${t('app.ingelogdBijSpeediance')}</span>${r.library ? ` <span class="muted">${t('app.catalogus', { a: esc(String(r.library)), b: typeof r.library === 'number' ? ' ' + t('app.adj.exercisesWord') : '' })}</span>` : ''}`
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
    box.innerHTML = `<span class="up">${t('app.gevondenInJeAccount', { deviceType: r.deviceType })}</span> <span class="muted">${t('app.klikOpOpslaanEn')}</span>`;
  } else {
    box.innerHTML = `<span class="muted">${t('app.jeAccountVermeldtGeen', { a: r.error ? ` (${esc(r.error)})` : '' })}</span>`
      + (r.fields?.length ? `<details style="margin-top:.4rem"><summary class="muted">${t('app.gevondenToestelvelden')}</summary><pre class="small">${esc(r.fields.map((x) => `${x.key}: ${x.value}`).join('\n'))}</pre></details>` : '');
  }
}));


// ---------- inloggen & gebruikers ----------
let authMode = 'login';
// Inlogscherm, of het scherm om het eerste account te maken.
function showAuth(mode) {
  authMode = mode;
  const setup = mode === 'setup';
  $('#authScreen').classList.remove('hidden');
  $('#authTitle').textContent = setup ? t('app.welkomBijGymcoach') : t('ui.auth.inloggen');
  $('#authIntro').textContent = setup ? t('app.maakHetEersteAccount') : '';
  $('#authNameRow').classList.toggle('hidden', !setup);
  $('#authPw2Row').classList.toggle('hidden', !setup);
  $('#authSubmit').textContent = setup ? t('app.accountAanmaken') : t('ui.auth.inloggen');
  $('#authForm').password.autocomplete = setup ? 'new-password' : 'current-password';
  $('#authErr').textContent = '';
  langPicker($('#authLang'), { value: getLang(), onPick: (c) => { storeLang(c); setLang(c); applyI18n(); showAuth(mode); } });
  setTimeout(() => (setup ? $('#authForm').name : $('#authForm').username).focus(), 50);
}
$('#authForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget, btn = $('#authSubmit');
  $('#authErr').textContent = '';
  if (authMode === 'setup' && f.password.value !== f.password2.value) { $('#authErr').textContent = t('app.deWachtwoordenZijnNiet'); return; }
  btn.disabled = true;
  try {
    const r = await fetch(authMode === 'setup' ? '/api/auth/setup' : '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: f.username.value.trim(), password: f.password.value, name: f.name.value.trim() }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409 && authMode === 'setup') { showAuth('login'); $('#authErr').textContent = j.error || t('app.erBestaatAlEen'); return; }
    if (!r.ok) throw new Error(j.error || t('app.inloggenMislukt'));
    f.password.value = ''; f.password2.value = '';
    $('#authScreen').classList.add('hidden');
    if (j.migrated?.length) toast(t('app.jeBestaandeGegevensZijn'));
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('app.kanDezeAfbeeldingNiet'))); };
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

// Taal van de gebruiker wijzigen (menubalk, gebruikersvenster): bewaren en de app opnieuw opbouwen.
async function pickLang(c) {
  storeLang(c);
  try { await api('PUT', '/api/settings', { lang: c }); } catch (e) { toast(e.message, true); return; }
  location.reload();
}

$('#userBtn').addEventListener('click', () => {
  const me = state?.me; if (!me) return;
  const dlg = $('#userDlg');
  dlg.innerHTML = `<form method="dialog" class="exd" id="meForm">
    <div class="exd-head"><div><div class="eyebrow">${me.role === 'admin' ? t('app.beheerder') : t('app.gebruiker')} · ${esc(me.username)}</div><h2>${esc(me.name)}</h2></div><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
    <div class="me-photo"><span class="avatar xl" id="meAvatar">${avatarHtml(me)}</span>
      <div class="col"><span class="muted small">${t('app.profielfotoZoZieJe')}</span>
      <div class="row gap"><label class="btn small">${t('app.fotoKiezen')}<input type="file" accept="image/*" id="meFile" hidden></label>${me.avatar ? '<button type="button" class="btn small ghost" data-x="nophoto">' + t('tp.delete') + '</button>' : ''}</div></div></div>
    <label>${t('nt.name')} <input name="name" value="${esc(me.name)}" maxlength="40"></label>
    <div class="row end"><button type="button" class="btn small" data-x="name">${t('app.naamOpslaan')}</button></div>
    <div class="eyebrow">${t('app.wachtwoordWijzigen')}</div>
    <label>${t('app.huidigWachtwoord')} <input name="current" type="password" autocomplete="current-password"></label>
    <label>${t('app.nieuwWachtwoordMin8')} <input name="pw" type="password" autocomplete="new-password" minlength="8"></label>
    <div class="row end"><button type="button" class="btn small" data-x="pw">${t('app.wachtwoordWijzigen')}</button></div>
    <div class="eyebrow">${t('app.me.prefs')}</div>
    <div class="me-pref"><span>${t('lang.label')}</span><div id="meLang"></div></div>
    <div class="me-pref"><span>${t('app.me.theme')}</span><div class="seg" role="group" aria-label="${t('app.me.theme')}">${Object.keys(THEMES).map((k) => `<button type="button" class="${k === theme ? 'on' : ''}" data-theme="${k}" aria-pressed="${k === theme}">${THEMES[k][0]} ${esc(THEMES[k][1])}</button>`).join('')}</div></div>
    <div class="row end"><button type="button" class="btn small ghost" data-x="settings">${t('app.me.allSettings')}</button></div>
    <div class="row between" style="border-top:1px solid var(--line);padding-top:.8rem"><span class="muted small">${t('app.ingelogdOpDitApparaat')}</span><button type="button" class="btn danger" data-x="logout">${t('app.uitloggen')}</button></div>
  </form>`;
  const f = dlg.querySelector('#meForm');
  langPicker(f.querySelector('#meLang'), { auto: true, value: state.settings?.lang || '', onPick: pickLang });
  f.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => {
    setTheme(b.dataset.theme);
    f.querySelectorAll('[data-theme]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  }));
  f.querySelector('[data-x=settings]').addEventListener('click', () => { dlg.close(); document.querySelector('[data-tab=settings]')?.click(); });
  const setPhoto = (v) => { state.me = { ...state.me, avatar: v }; renderMe(); $('#userBtn').click(); };
  f.querySelector('#meFile').addEventListener('change', async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    try { const dataUrl = await squareImage(file); const r = await api('PUT', '/api/me/avatar', { dataUrl }); dlg.close(); setPhoto(r.avatar); toast(t('app.fotoOpgeslagen')); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=nophoto]')?.addEventListener('click', async () => {
    try { await api('DELETE', '/api/me/avatar'); dlg.close(); setPhoto(null); toast(t('app.fotoVerwijderd')); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=name]').addEventListener('click', async () => {
    try { state.me = (await api('PUT', '/api/me', { name: f.name.value.trim() })).me; renderMe(); renderHome(); toast(t('app.naamOpgeslagen')); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=pw]').addEventListener('click', async () => {
    try { await api('PUT', '/api/me/password', { current: f.current.value, password: f.pw.value }); dlg.close(); toast(t('app.wachtwoordGewijzigdLogOpnieuw')); showAuth('login'); } catch (e) { toast(e.message, true); }
  });
  f.querySelector('[data-x=logout]').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    // volledig opnieuw laden: geen gegevens van deze gebruiker in formulieren of geheugen laten staan
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('gc-') && k !== 'gc-theme' && k !== 'gc-lang') localStorage.removeItem(k); } catch {}
    location.replace('/');
  });
  dlg.showModal();
});

// Gebruikersbeheer (alleen beheerder).
async function loadUsers() {
  const box = $('#usersCard');
  try {
    const { users } = await api('GET', '/api/users');
    box.innerHTML = `<h2>${t('ui.settings.gebruikers')} <span class="badge">${t('ui.setWithings.beheerder')}</span></h2>
      <p class="muted small" style="margin-top:-.4rem">${t('app.iedereGebruikerHeeftEen')}</p>
      <div class="tablewrap"><table class="utable"><thead><tr><th>${t('nt.name')}</th><th>${t('ui.auth.gebruikersnaam')}</th><th>${t('app.rol')}</th><th></th></tr></thead><tbody>
      ${users.map((u) => `<tr data-id="${esc(u.id)}"><td><span class="avatar sm">${avatarHtml(u)}</span> ${esc(u.name)}${u.id === state.me.id ? ' <span class="muted small">' + t('app.jij') + '</span>' : ''}</td><td>${esc(u.username)}</td>
        <td><select data-x="role" aria-label="${t('app.roleOf', { name: esc(u.name) })}"><option value="user" ${u.role === 'user' ? 'selected' : ''}>${t('app.gebruiker')}</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>${t('app.beheerder')}</option></select></td>
        <td style="text-align:right;white-space:nowrap"><button class="btn small ghost" data-x="pw">${t('app.nieuwWachtwoord')}</button>${u.id === state.me.id ? '' : ' <button class="btn small ghost" data-x="del">' + t('app.verwijder') + '</button>'}</td></tr>`).join('')}
      </tbody></table></div>
      <form id="newUser" class="row gap wrap" style="margin-top:1rem;align-items:flex-end">
        <label style="flex:1 1 140px">${t('nt.name')} <input name="name" required maxlength="40"></label>
        <label style="flex:1 1 140px">${t('ui.auth.gebruikersnaam')} <input name="username" required pattern="[a-zA-Z0-9._\\-]{2,30}" autocomplete="off"></label>
        <label style="flex:1 1 140px">${t('app.tijdelijkWachtwoord')} <input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <label style="flex:0 1 130px">${t('app.rol')} <select name="role"><option value="user">${t('app.gebruiker')}</option><option value="admin">${t('app.beheerder')}</option></select></label>
        <button class="btn accent">${t('pk.add')}</button>
      </form>`;
    box.querySelector('#newUser').addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.currentTarget;
      try { await api('POST', '/api/users', { name: f.name.value.trim(), username: f.username.value.trim(), password: f.password.value, role: f.role.value }); toast(t('app.toegevoegd', { value: f.name.value })); loadUsers(); }
      catch (e) { toast(e.message, true); }
    });
    box.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id, name = tr.cells[0].textContent.replace(' (jij)', '');
      tr.querySelector('[data-x=role]').addEventListener('change', async (ev) => {
        try { await api('PUT', '/api/users/role', { id, role: ev.target.value }); toast(t('app.rolBijgewerkt')); } catch (e) { toast(e.message, true); loadUsers(); }
      });
      tr.querySelector('[data-x=pw]').addEventListener('click', async () => {
        const pw = await askText(t('app.nieuwWachtwoordVoorMin', { name }), '', { type: 'password', minLength: 8, okText: t('app.instellen') });
        if (!pw) return;
        try { await api('PUT', '/api/users/password', { id, password: pw }); toast(t('app.wachtwoordIngesteldBestaandeSessies')); } catch (e) { toast(e.message, true); }
      });
      tr.querySelector('[data-x=del]')?.addEventListener('click', async () => {
        if (!await askConfirm(t('app.verwijderenDezeGebruikerKan', { name }), { danger: true, okText: t('tp.delete') })) return;
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
  $('#syncStatus').textContent = t('app.bezig');
  try { const r = await api('POST', '/api/sync'); toast(t('app.syncKlaarNieuweSessies', { a: r.meta.lastSyncFetched ?? 0 })); }
  finally { await load(); }
}));

// Laadt de toestand van de gebruiker en tekent de app opnieuw.
async function load() {
  state = await api('GET', '/api/state');
  // taal: eigen keuze, anders die van de browser; daarna alle vaste teksten in de pagina vullen
  setLang(resolveLang(state.settings?.lang || storedLang(), navigator.languages || [navigator.language]));
  applyI18n();
  // vlaggetjes in de menubalk: zelfde keuze als Instellingen → Training → Taal
  langPicker($('#topLang'), { auto: true, value: state.settings?.lang || '', onPick: pickLang });
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
const n1nl = (v) => (Math.round(v * 10) / 10).toLocaleString(localeOf());

// maximale hartslag (zelfde regel als de server) voor zones bij activiteiten
function hrRefClient() {
  const s = state.settings || {};
  if (+s.hrMax > 100) return { max: +s.hrMax, how: t('app.ingesteld') };
  if (+s.birthYear > 1900) {
    const age = new Date().getFullYear() - s.birthYear, sex = ['m', 'v'].includes(s.sex) ? s.sex : s.bandSex;
    if (sex === 'v') return { max: Math.round(206 - 0.88 * age), how: t('app.geschat206088', { age }) };
    return { max: Math.round(208 - 0.7 * age), how: t('app.geschat20807', { age }) };
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
    return `<svg viewBox="0 0 ${W} ${H}" class="hrsvg" role="img" aria-label="${t('app.hartslagverloopTijdensDeTraining')}">${g}</svg>`;
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
  g += `<text x="${L}" y="${H - 5}">${t('app.set1')}</text><text x="${W - R}" y="${H - 5}" text-anchor="end">${t('app.set', { n: ps.length })}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="hrsvg" role="img" aria-label="${t('app.maximaleHartslagPerSet')}">${g}</svg>`;
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
  if (h.series) out += `<div class="ins-block"><div class="eyebrow">${t('app.hartslagTijdensDeTraining')}</div>${hrChartSvg({ ...h, perSet: null })}${h.zones ? zoneBars(h.zones) : ''}<div class="muted small">${t('app.hartslagUitOokTijdens', { a: esc(h.source), b: h.ref ? t('app.maxBpm', { max: h.ref.max, a: esc(h.ref.how) }) : t('app.vulJeGeboortejaarIn2') })}</div></div>`;
  if (h.perSet) out += `<div class="ins-block"><div class="eyebrow">${t('app.hartslagPerSet')}</div>${hrChartSvg({ ...h, series: null })}<div class="muted small">${t('app.maximaleHartslagPerSet2', { a: h.ref ? t('app.zonesTOV', { max: h.ref.max }) : '' })}</div></div>`;
  return out;
}
// Vergelijking met de laatste 4 keer in het rapport.
function compareHtml(c) {
  if (!c) return '';
  const fmtV = (r, v) => `${Math.round(v).toLocaleString(localeOf())}${r.unit ? ' ' + r.unit : ''}`;
  return `<div class="ins-block"><div class="eyebrow">${t('app.vergelekenMet', { a: c.basis === 'same' ? t('app.deLaatsteKeerDeze', { n: c.n }) : t('app.jeLaatsteTrainingen', { n: c.n }) })}</div>
    <table class="cmp"><tbody>${c.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num"><b>${fmtV(r, r.cur)}</b></td><td class="num muted">${t('app.gem2', { a: fmtV(r, r.ref) })}</td><td class="num ${r.label === 'Gem. hartslag' ? 'muted' : r.pct > 2 ? 'up' : r.pct < -2 ? 'down' : 'muted'}">${r.pct > 0 ? '+' : ''}${r.pct}%</td></tr>`).join('')}</tbody></table></div>`;
}
// Tijd onder spanning en rust in het rapport.
function timeHtml(t) {
  if (!t) return '';
  const dur = t.duration || 0, rest = Math.min(t.rest || 0, Math.max(0, dur - t.tut)), other = Math.max(0, dur - t.tut - rest);
  const m = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  return `<div class="ins-block"><div class="eyebrow">${tx('app.tijdOnderSpanning')}</div>
    <div class="big-num">${m(t.tut)} <span class="muted small">min${dur ? tx('app.vanDeTraining', { a: Math.round((t.tut / dur) * 100) }) : ''}</span></div>
    ${dur ? `<div class="zbar"><span style="flex:${t.tut};background:var(--a)" title="${tx('app.onderSpanning')}"></span>${rest ? `<span style="flex:${rest};background:var(--b);opacity:.7" title="${tx('app.rustTussenSets')}"></span>` : ''}${other ? `<span style="flex:${other};background:var(--line)" title="${tx('app.overig')}"></span>` : ''}</div>
    <div class="zleg"><span><i style="background:var(--a)"></i>${tx('app.onderSpanning2')} <b>${m(t.tut)}</b></span>${rest ? `<span><i style="background:var(--b)"></i>${tx('app.rustTussenSets2')} <b>${m(rest)}</b></span>` : ''}${other ? `<span><i style="background:var(--line)"></i>${tx('app.wisselenInstellen')} <b>${m(other)}</b></span>` : ''}</div>` : ''}
    <div class="muted small">${tx('app.gemSPerHerhaling', { a: n1nl(t.perRep), b: t.coverage < 100 ? tx('app.gemetenBijVanDe', { coverage: t.coverage }) : '' })}</div></div>`;
}
// Alle extra blokken van het rapport samen.
function insightsHtml(d) {
  const parts = [compareHtml(d.compare), timeHtml(d.time)].filter(Boolean);
  return `${parts.length ? `<div class="ins-grid">${parts.join('')}</div>` : ''}${heartHtml(d.heart)}`;
}

// staafjes (eventueel gestapeld) met optioneel een lijn op een tweede as en een doellijn
function comboChart(el, { x, stacks = [], barUnit = '', line = null, goal = null, colorOf = null, label = '', xLabel = null }) {
  if (!x.length || (!stacks.some((s) => s.values.some((v) => v > 0)) && !line?.points.length)) { el.innerHTML = '<div class="empty">' + t('app.nogGeenData') + '</div>'; return; }
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
    return `<div class="bal"><div class="row between small"><span><b>${l1}</b> ${tx('app.sets2', { a: fmt(v1) })}</span><span>${ratio ? `${tx('app.verhouding')} <b>1 : ${n1nl(v2 / v1)}</b>` : ''}</span><span>${tx('app.sets2', { a: fmt(v2) })} <b>${l2}</b></span></div>
      <div class="balbar"><span style="width:${p}%"></span><i style="left:${ideal}%"></i></div></div>`;
  };
  const bp = b.push + b.pull ? b.pull / Math.max(1, b.push) : null, bu = b.upper + b.lower ? b.upper / Math.max(1, b.lower) : null;
  const tips = [];
  if (bp != null && b.push && bp > 1.6) tips.push(t('app.jeDoetVeelMeer'));
  if (bp != null && bp < 0.8) tips.push(t('app.jeDuwtMeerDan'));
  if (bu != null && bu > 2.2) tips.push(t('app.jeBenenKrijgenRelatief'));
  if (bu != null && bu < 0.6) tips.push(t('app.jeBovenlichaamKrijgtRelatief'));
  $('#balanceCard').innerHTML = `<h2>${t('app.balans2')}</h2><p class="muted" style="margin-top:-.4rem">${t('app.werksetsInDeGekozen')}</p>
    ${balRow(t('app.duwen'), b.push || 0, t('app.trekken'), b.pull || 0, 45) || '<div class="empty">' + t('app.nogGeenData') + '</div>'}${balRow(t('app.boven'), b.upper || 0, t('app.onder'), b.lower || 0, 50)}
    ${tips.length ? `<div class="note small">${tips.map(esc).join('<br>')}</div>` : (b.push || b.upper ? '<p class="small up" style="margin:.4rem 0 0">' + t('app.mooiInBalans') + '</p>' : '')}`;

  // krachtindex per spiergroep
  const ser = s.strength || [];
  if (!strengthOn || !ser.some((x) => strengthOn.has(x.key))) strengthOn = new Set(ser.slice(0, 4).map((x) => x.key));
  const col = (k) => PALETTE[ser.findIndex((x) => x.key === k) % PALETTE.length];
  $('#strengthChips').innerHTML = ser.map((x) => `<button data-k="${esc(x.key)}" class="${strengthOn.has(x.key) ? 'on' : ''}"><i style="background:${col(x.key)}"></i>${esc(x.label)} <span class="${x.change > 0 ? 'up' : x.change < 0 ? 'down' : 'muted'}">${x.change > 0 ? '+' : ''}${n1nl(x.change)}%</span></button>`).join('');
  lineChart($('#chartStrength'), ser.filter((x) => strengthOn.has(x.key)).map((x) => ({ label: x.label, unit: '', color: col(x.key), points: x.points })), { yLabel: 'Krachtindex', yUnit: '' });
  $('#strengthChips').onclick = (ev) => { const bt = ev.target.closest('button'); if (!bt) return; strengthOn.has(bt.dataset.k) ? strengthOn.delete(bt.dataset.k) : strengthOn.add(bt.dataset.k); renderStatsExtra(); };

  // spiermassa tegen volume
  const vm = s.volumeVsMass || { volume: [], mass: [] };
  comboChart($('#chartVolMass'), { x: vm.volume.map((p) => p.x), stacks: [{ label: t('ed.volume'), color: 'var(--a)', values: vm.volume.map((p) => p.y) }], barUnit: 'kg', line: vm.mass.length ? { label: t('app.spiermassa'), unit: 'kg', color: 'var(--b)', points: vm.mass } : null, label: t('app.trainingsvolumeEnSpiermassaPer') });
  $('#volMassNote').innerHTML = vm.mass.length >= 2
    ? (() => { const d = vm.mass[vm.mass.length - 1].y - vm.mass[0].y; return tx('app.massVsVolume', { d: `${d >= 0 ? '+' : ''}${n1nl(d)}`, vol: kg(Math.round(vm.volume.reduce((s2, p) => s2 + p.y, 0) / Math.max(1, vm.volume.filter((p) => p.y).length))) }); })()
    : t('app.spiermassaKomtVanDe');

  // cardio
  const cw = s.cardioWeeks || [];
  const types = ['wandelen', 'fietsen', 'hardlopen', 'overig'].map((k) => [k, actLabel(k)]).filter(([k]) => cw.some((w) => w[k] > 0));
  $('#cardioKmCard').classList.toggle('hidden', !cw.length && !(s.steps || []).length);
  comboChart($('#chartKm'), { x: cw.map((w) => w.x), stacks: types.map(([k, l]) => ({ label: l, color: actColor(k), values: cw.map((w) => w[k]) })), barUnit: 'km', label: t('ui.stats.kilometersPerWeek') });
  $('#kmLegend').innerHTML = legendHtml(types.map(([k, l]) => [actColor(k), l]));
  const st = (s.steps || []).slice(-120);
  comboChart($('#chartSteps'), { x: st.map((p) => p.x), stacks: [{ label: t('app.stappen'), color: 'var(--b)', values: st.map((p) => p.y) }], goal: { value: s.stepGoal, label: t('app.doel2', { a: fmt(s.stepGoal) }) }, colorOf: (v) => (v >= s.stepGoal ? 'var(--ok)' : 'var(--b)'), label: t('ui.stats.stappenPerDag') });
  $('#stepsNote').textContent = st.length ? t('app.doelGehaaldOpVan', { stepHit: s.stepHit, n: s.steps.length, a: Math.round((s.stepHit / s.steps.length) * 100), b: s.steps.length > st.length ? t('app.deGrafiekToontDe') : '' }) : t('app.nogGeenStappenUit');
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
    ${a.heat.days.map((d, r) => `<span class="hd">${d}</span>${cols.map((i) => { const c = a.heat.grid[r][i], v = val(c); return `<span class="hc" style="--o:${v ? 0.18 + 0.82 * (v / max) : 0}" title="${d} ${a.heat.blocks[i]}: ${c.gym} Gym Monster${withActs ? `, ${t('app.heatActs', { n: c.act })}` : ''}">${v || ''}</span>`; }).join('')}`).join('')}</div>`;
  const tot = a.heat.grid.flat().reduce((t, c) => t + val(c), 0);
  const best = (() => { let b = null; a.heat.grid.forEach((row, r) => row.forEach((c, i) => { if (!b || val(c) > b.v) b = { v: val(c), d: a.heat.days[r], t: a.heat.blocks[i] }; })); return b; })();
  $('#heatNote').innerHTML = tot ? `${t('app.meestalOp')} <b>${best.d} ${best.t}</b> ${t('app.uur', { a: a.heat.gymUntimed ? t('app.trainingZonderBekendTijdstip', { n: a.heat.gymUntimed }) : '' })}` : t('app.nogGeenTrainingenMet2');

  // 10. herstel
  const rc = a.recovery;
  comboChart($('#chartRecovery'), { x: rc.load.map((p) => p.x), stacks: [{ label: t('ui.settings.training'), color: 'var(--a)', values: rc.load.map((p) => p.y) }], barUnit: 'min', line: rc.rest.length ? { label: t('app.rusthartslag'), unit: 'bpm', color: 'var(--warn)', points: rc.rest } : null, label: t('app.trainingsbelastingEnHartslagIn') });
  const sig = tmap({ normaal: ['up', '§app.sig.normaal'], 'let op': ['', '§app.sig.let_op'], hoog: ['down', '§app.sig.hoog'] });
  $('#recoveryNote').innerHTML = rc.source
    ? `<p class="small" style="margin:.4rem 0 0">${t('app.rusthartslagLaatste7Dagen')} <b>${n1nl(rc.recent ?? 0)}</b> ${t('app.bpmDe4Weken')} <b>${n1nl(rc.base ?? 0)}</b>.${rc.signal ? ` <span class="${sig[rc.signal][0]}">${sig[rc.signal][1]}</span>` : ''}</p><p class="muted small" style="margin:.2rem 0 0">${t('app.bronEenStijgingVan', { a: esc(rc.source) })}</p>`
    : '<p class="muted small">' + t('app.nogGeenHartslagIn') + '</p>';
  // herstelscore (alle signalen samen) en cardio vlak voor krachttraining in deze periode
  const rs = a.recoveryScore, cb = a.cardioBefore;
  $('#recoveryNote').insertAdjacentHTML('beforeend', (rs ? `<p class="small" style="margin:.5rem 0 0"><b>${t('sig.title')}: ${esc(SIG_STATE[rs.state])}</b></p><ul class="sig-list small">${rs.signals.map(sigLine).join('')}</ul>` : '')
    + (cb?.count ? `<p class="small" style="margin:.3rem 0 0">${t('sig.cardioStats', { n: cb.count, total: cb.total })}${cb.doneWithout != null ? ' ' + t('sig.cardioDone', { a: cb.doneWith, b: cb.doneWithout }) : ''} <a href="#" data-explain="signalen">${t('sig.why')}</a></p>` : ''));

  // 9. calorieën en gewicht
  const en = a.energy;
  comboChart($('#chartEnergy'), { x: en.kcal.map((p) => p.x), stacks: [{ label: t('app.actieveEnergie'), color: 'var(--a)', values: en.kcal.map((p) => p.y) }], barUnit: 'kcal', line: en.kg.length ? { label: t('app.gewicht'), unit: 'kg', color: 'var(--b)', points: en.kg } : null, label: t('app.actieveEnergiePerWeek') });
  const kc = en.kcal.filter((p) => p.y > 0);
  $('#energyNote').textContent = `${kc.length ? t('app.energyAvg', { kcal: fmt(Math.round(kc.reduce((s2, p) => s2 + p.y, 0) / kc.length)) }) : t('app.energyNone')}${en.kg.length >= 2 ? t('app.energyWeight', { d: `${en.kg[en.kg.length - 1].y - en.kg[0].y >= 0 ? '+' : ''}${n1nl(en.kg[en.kg.length - 1].y - en.kg[0].y)}` }) : ''}. ${en.fromHealth ? t('app.energySrcHealth') : t('app.energySrcGym')}`;

  // 7. records
  const byMonth = {};
  for (const r of a.records) byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + 1;
  const months = Object.keys(byMonth).sort();
  const allM = [];
  if (months.length) for (let d = new Date(months[0] + '-01T12:00:00'); d <= new Date(); d.setMonth(d.getMonth() + 1)) allM.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  comboChart($('#chartRecords'), { x: allM, stacks: [{ label: t('ui.analysis.records'), color: 'var(--ok)', values: allM.map((m) => byMonth[m.slice(0, 7)] || 0) }], label: t('app.recordsPerMaand'), xLabel: (m) => `${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][+m.slice(5, 7) - 1]}${m.slice(5, 7) === '01' || allM.length <= 7 ? '' : ''}` });
  const MND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  let lastM = '';
  $('#recordList').innerHTML = a.records.length ? a.records.slice(0, 60).map((r) => {
    const m = r.date.slice(0, 7), head = m !== lastM ? `<div class="rec-m">${MND[+m.slice(5) - 1]} ${m.slice(0, 4)}</div>` : ''; lastM = m;
    return `${head}<div class="rec"><span class="rec-d">${+r.date.slice(8)}</span><div><b>${esc(r.name)}</b><div class="muted small">${t('app.geschat1rmKg', { a: esc(r.set), b: n1nl(r.e1rm), c: r.muscle ? ` · ${esc(r.muscle)}` : '' })}</div></div><span class="up">+${n1nl(r.pct)}%</span></div>`;
  }).join('') + (a.recordCount > 60 ? `<p class="muted small">${t('app.enNogEerdereRecords', { a: a.recordCount - 60 })}</p>` : '') : '<div class="empty">' + t('app.nogGeenRecordsIn') + '</div>';
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
// korte dagnamen maandag t/m zondag in de taal van de gebruiker (ma di wo … / Mon Tue …)
const weekdaysShort = () => [5, 6, 7, 8, 9, 10, 11].map((d) => new Date(2026, 0, d).toLocaleDateString(localeOf(), { weekday: 'short' }).replace('.', ''));
// maandnamen in de taal van de gebruiker (Intl): MAANDEN[0] = januari / January …
const MAANDEN = new Proxy([], { get: (o, k) => (/^\d+$/.test(String(k)) ? new Date(2026, Number(k), 1).toLocaleDateString(localeOf(), { month: 'long' }) : Reflect.get(o, k)) });
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
        const tip = `${dt.toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${d?.gym.length ? ' — ' + d.gym.map((w) => `${w.title}${w.min ? ` (${w.min} min)` : ''}`).join(', ') : ''}${d?.acts.length ? ' — ' + d.acts.map(actLine).join(', ') : ''}`;
        cells += `<div class="bc-d ${lvl(d)}${inM ? '' : ' out'}${fut ? ' fut' : ''}${k === ymd(today) ? ' today' : ''}${d ? ' click' : ''}" data-day="${k}" ${d ? `data-date="${k}" tabindex="0" role="button"` : ''}>
          <span class="bc-n">${dt.getDate()}</span>${d?.gym.length ? `<span class="bc-t">${esc(titles)}</span><span class="bc-m">${gymMin(d) ? gymMin(d) + '′' : ''}</span>` : ''}${dots(d)}</div>`;
      }
      const thisWeek = ws <= today;
      rows += `${cells}<div class="bc-w ${wkCount >= target ? 'hit' : ''}">${thisWeek ? `${wkCount}/${target}` : ''}</div>`;
    }
    body = `<div class="bc-grid">${weekdaysShort().map((d) => `<div class="bc-h">${d}</div>`).join('')}<div class="bc-h">${t('app.week')}</div>${rows}</div>
      <div class="bc-sum">${MAANDEN[m]} ${y}: <b>${mGym}</b> ${mGym === 1 ? t('app.training') : t('app.trainingen2')}${mMin ? ` · <b>${Math.floor(mMin / 60)}${t('app.hUnit')} ${mMin % 60}m</b>` : ''}${mActs ? ` · <b>${mActs}</b> ${t('app.wandelFietsactiviteiten')}` : ''}</div>`;
  } else {
    const y = calCursor.getFullYear();
    let months = '';
    for (let m = 0; m < 12; m++) {
      const first = new Date(y, m, 1, 12), off = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
      let cells = '<span></span>'.repeat(off), cnt = 0;
      for (let dd = 1; dd <= n; dd++) {
        const dt = new Date(y, m, dd, 12), k = ymd(dt), d = days[k];
        if (d?.gym.length) cnt += d.gym.length;
        cells += `<span class="ym-d ${lvl(d)}${d?.acts.length && !d.gym.length ? ' act' : ''}${k === ymd(today) ? ' today' : ''}${dt > today ? ' fut' : ''}" data-day="${k}" ${d ? `data-date="${k}"` : ''} title="${esc(dt.toLocaleDateString(localeOf(), { day: 'numeric', month: 'long' }) + (d?.gym.length ? ' — ' + d.gym.map((w) => w.title).join(', ') : '') + (d?.acts.length ? ' — ' + d.acts.map(actLine).join(', ') : ''))}">${dd}</span>`;
      }
      months += `<div class="ym"><button type="button" class="ym-h" data-m="${m}">${MAANDEN[m]} <span class="muted">${cnt || ''}</span></button><div class="ym-g">${[5, 6, 7, 8, 9, 10, 11].map((d) => new Date(2026, 0, d).toLocaleDateString(localeOf(), { weekday: 'narrow' }).toLowerCase()).map((x) => `<span class="ym-l">${x}</span>`).join('')}${cells}</div></div>`;
    }
    const yGym = (state.trainingDays || []).filter((w) => w.date.startsWith(String(y))).length;
    body = `<div class="ym-wrap">${months}</div><div class="bc-sum">${y}: <b>${yGym}</b> ${t('app.trainingenKlikOpEen')}</div>`;
  }
  const title = calView === 'month' ? `${MAANDEN[calCursor.getMonth()]} ${calCursor.getFullYear()}` : String(calCursor.getFullYear());
  const prevOk = calView === 'month' ? calCursor > minM : calCursor.getFullYear() > minM.getFullYear();
  const nextOk = calView === 'month' ? calCursor < maxM : calCursor.getFullYear() < maxM.getFullYear();
  el.innerHTML = `<div class="row between wrap gap">
      <div><h2 style="margin:0">${t('app.trainingskalender')}</h2><div class="muted small">${t('app.trainingenOpDagenSinds', { totalGym, gymDays, a: esc(fmtDate(minM.toISOString().slice(0, 10)).replace(/^\w+ \d+ /, '')) })}</div></div>
      <div class="row gap bc-nav">
        <div class="chips small"><button data-v="month" class="${calView === 'month' ? 'on' : ''}">${t('app.maand')}</button><button data-v="year" class="${calView === 'year' ? 'on' : ''}">${t('app.jaar')}</button></div>
        <button class="btn small ghost" data-step="-1" ${prevOk ? '' : 'disabled'} aria-label="${t('app.vorige')}">‹</button>
        <span class="bc-title">${title}</span>
        <button class="btn small ghost" data-step="1" ${nextOk ? '' : 'disabled'} aria-label="${t('app.volgende')}">›</button>
        <button class="btn small ghost" data-step="0">${t('app.vandaag')}</button>
      </div></div>
    ${body}
    <div class="legend small">${t('app.gekleurdGymMonster')} <span class="sq l1"></span>&lt;25 <span class="sq l2"></span>25–45 <span class="sq l3"></span>${t('app.gt45MinKlik', { a: calView === 'month' ? t('app.stipjesWandelenFietsenEnz', { target }) : t('app.blauwStreepjeAlleenWandelen') })}</div>`;
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
  const head = d.toLocaleDateString(localeOf(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const gymHtml = gym.map((w) => `<div class="dt-row"><span class="dt-dot" style="background:var(--accent)"></span><div><b>${esc(w.title)}</b>
    <div class="dt-meta">${[w.min ? `${w.min} min` : null, w.ex ? t('app.oefeningen', { count: w.ex }) : null, w.vol ? `${w.vol.toLocaleString(localeOf())} kg` : null, w.kcal ? `${w.kcal} kcal` : null, w.hr ? `♥ ${w.hr} bpm` : null].filter(Boolean).join(' · ')}</div></div></div>`).join('');
  const actHtml = acts.map((a) => `<div class="dt-row"><span class="dt-dot" style="background:${actColor(a.type)}"></span><div><b>${esc(actName(a))}</b>
    <div class="dt-meta">${[a.km ? `${n1nl(a.km)} km` : null, a.minutes ? `${a.minutes} min` : null, a.kcal ? `${Math.round(a.kcal)} kcal` : null, a.hrAvg ? `♥ ${a.hrAvg} bpm` : null].filter(Boolean).join(' · ')}</div></div></div>`).join('');
  const empty = d > today ? t('app.notYet') : t('app.restDay');
  return `<div class="dt-head">${esc(head.charAt(0).toUpperCase() + head.slice(1))}</div>${gymHtml + actHtml || `<div class="dt-meta">${empty}</div>`}${gym.length || acts.length ? '<div class="dt-foot">' + t('app.klikVoorDetails') + '</div>' : ''}`;
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
  if (w) { ev.preventDefault(); toast(t('app.logInBijWithings')); }
});
try {
  new BroadcastChannel('gymcoach').addEventListener('message', async (ev) => {
    if (ev.data?.type !== 'withings') return;
    if (ev.data.ok) { toast(t('app.withingsGekoppeldMetingenOpgehaald', { added: ev.data.added })); await load(); }
    else toast(t('app.withingsKoppelenMislukt', { a: ev.data.error || '' }), true);
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
  const lock = !st.terms ? ` disabled title="${t('app.acceptTermsFirst')}"` : '';
  if (onlyTerms) {
    $('#nextCard').innerHTML = `<div class="eyebrow">${t('app.voordatJeVerdergaat')}</div><div class="hero-title">${t('app.voorwaardenEnGezondheid')}</div>
      <ol class="su-list">${step('!', false, t('app.leesEnAccepteerDe'), t('app.gymcoachIsEenHulpmiddel'), '<button class="btn accent small" id="suTerms">' + t('app.lezenEnAkkoord') + '</button>')}</ol>`;
    $('#suTerms').addEventListener('click', openTerms);
    return;
  }
  $('#nextCard').innerHTML = `<div class="eyebrow">${t('app.welkomBijGymcoach')}</div>
    <div class="hero-title">${t('app.inVierStappenAan')}</div>
    <ol class="su-list">
      ${step(1, st.terms, t('app.leesDeVoorwaardenEn'), t('app.gymcoachIsEenHulpmiddel2'), st.terms ? '' : '<button class="btn accent small" id="suTerms">' + t('app.lezenEnAkkoord') + '</button>')}
      ${step(2, st.speediance, t('app.koppelJeSpeedianceAccount'), st.speediance && state.library?.count ? t('app.gekoppeldOefeningencatalogusVanJouw', { count: state.library.count, a: state.library.source === 'standaard' ? t('app.standaardlijst') : '' }) : t('app.metJeEigenE'), st.speediance ? '' : `<button class="btn accent small" data-go="account"${lock}>${t('app.instellen')}</button>`)}
      ${step(3, st.prefs, t('app.kiesJeDoelEn'), t('app.spieropbouwAfvallenOfEen'), `<button class="btn ${st.prefs ? 'ghost' : 'accent'} small" data-go="training"${lock}>${st.prefs ? t('app.aanpassen') : t('app.instellen')}</button>`)}
      ${step(4, st.plan, t('app.maakJeEersteWeekplan'), st.terms && st.speediance && st.prefs ? t('app.gymcoachMaaktEenPlan') : t('app.kanZodraDeStappen'), `<button class="btn accent small" id="suPlan" ${st.terms && st.speediance && st.prefs ? '' : 'disabled'}>${t('app.maakMijnPlan')}</button>`)}
    </ol>
    <div class="muted small">${t('app.optioneelKoppelJe')} <a href="#" data-go="withings">${t('app.withingsWeegschaal')}</a> ${t('app.of')} <a href="#" data-go="health">${t('ui.settings.appleHealth')}</a> ${t('app.voorGewichtWandelenEn')}</div>`;
  $('#suTerms')?.addEventListener('click', openTerms);
  $('#nextCard').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (ev) => { ev.preventDefault(); if (!b.disabled) goSettings(b.dataset.go); }));
  $('#suPlan')?.addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try { state.plan = (await api('POST', '/api/plan/generate')).plan; toast(t('app.jeEerstePlanStaat')); await load(); document.querySelector('.tab[data-tab=plan]').click(); }
    catch (e) { toast(e.message, true); }
  }));
}

// ---------- voorwaarden en gezondheid ----------
function openTerms() {
  let dlg = $('#termsDlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'termsDlg'; dlg.className = 'terms-dlg'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog" class="terms">
      <div class="exd-head"><h2>${t('app.voorwaardenEnGezondheid')}</h2><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
      <div class="terms-body">${termsHtml()}</div>
      <label class="inline-check"><input type="checkbox" id="tc1"> ${t('app.ikHebDitGelezen')}</label>
      <label class="inline-check"><input type="checkbox" id="tc2"> ${t('app.ikOverlegMetMijn')}</label>
      <div class="row gap"><button type="button" class="btn accent" id="tcOk" disabled>${t('app.akkoord')}</button><button value="close" class="btn ghost">${t('app.later')}</button></div>
    </form>`;
  const ok = dlg.querySelector('#tcOk'), c1 = dlg.querySelector('#tc1'), c2 = dlg.querySelector('#tc2');
  const upd = () => { ok.disabled = !(c1.checked && c2.checked); };
  c1.addEventListener('change', upd); c2.addEventListener('change', upd);
  ok.addEventListener('click', () => busy(ok, async () => {
    try { await api('POST', '/api/terms/accept', { version: TERMS_VERSION }); dlg.close(); toast(t('app.bedanktJeKuntVerder')); await load(); }
    catch (e) { toast(e.message, true); }
  }));
  dlg.showModal();
}
// Onderdeel Voorwaarden in Instellingen.
function renderTermsPane() {
  const el = $('#termsPane'); if (!el) return;
  const st = state?.setup || {};
  el.innerHTML = `<h2>${t('app.voorwaardenEnGezondheid')}</h2>
    <p class="muted small" style="margin-top:-.4rem">${st.terms && st.termsAt ? t('app.geaccepteerdOp', { a: new Date(st.termsAt).toLocaleDateString(localeOf(), { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('app.nogNietGeaccepteerd')}</p>
    <div class="terms-body">${termsHtml()}</div>
    ${st.terms ? '' : '<button type="button" class="btn accent" id="tpAccept">' + t('app.lezenEnAkkoord') + '</button>'}`;
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
      <div class="exd-head"><h2>${t('app.hoeGymcoachWerkt')}</h2><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
      <div class="explain">
        <nav class="explain-nav">${explain().map((x) => `<button type="button" data-sec="${x.id}">${esc(x.title)}</button>`).join('')}</nav>
        <div class="terms-body explain-body">${explain().map((x) => `<section id="ex-${x.id}"><h3>${esc(x.title)}</h3>${x.html}</section>`).join('')}</div>
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
      let cur = explain()[0].id;
      for (const x of explain()) if (top(x.id) <= body.scrollTop + 40) cur = x.id;
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) cur = explain()[explain().length - 1].id; // helemaal onderaan
      mark(cur);
    });
  }
  dlg.showModal();
  dlg._goto(explain().some((x) => x.id === section) ? section : explain()[0].id, false);
}
document.addEventListener('click', (ev) => { const a = ev.target.closest('[data-explain]'); if (a) { ev.preventDefault(); openExplain(a.dataset.explain); } });

// ---------- over GymCoach ----------
async function renderAboutPane() {
  const el = $('#aboutPane'); if (!el) return;
  let a = { version: state?.version };
  el.innerHTML = aboutHtml(a);
  try { a = await api('GET', '/api/about'); el.innerHTML = aboutHtml(a); } catch {}
  el.querySelector('[data-go=terms]')?.addEventListener('click', (ev) => { ev.preventDefault(); showSetPane('terms'); renderTermsPane(); });
  el.querySelector('#updBtn')?.addEventListener('click', () => {
    const btn = el.querySelector('#updBtn');
    busy(btn, async () => {
      const msg = el.querySelector('#updMsg');
      msg.textContent = t('upd.bezig');
      const s = await api('GET', '/api/update');
      if (!s.git) { msg.textContent = t('upd.geenGit'); return; }
      if (!s.behind) { msg.textContent = t('upd.bij', { v: s.version, sha: s.local }); return; }
      const ok = await askConfirm(t('upd.beschikbaar', { v: s.remoteVersion || s.remote, sha: s.remote }), { okText: t('upd.nu') });
      if (!ok) { msg.textContent = ''; return; }
      const r = await api('POST', '/api/update');
      const done = r.restarting ? t('upd.herstart') : t('upd.handmatig', { v: r.version || s.remoteVersion || '' });
      msg.textContent = done;
      toast(done);
    });
  });
}
// Inhoud van Over GymCoach.
function aboutHtml(a) {
  const row = (k, v) => (v ? `<tr><td class="muted">${k}</td><td>${esc(String(v))}</td></tr>` : '');
  return `<div class="about">
    <img src="logo.svg" alt="${t('app.gymcoachLogo')}" class="about-logo" width="88" height="88">
    <div>
      <h2 style="margin:0">GymCoach</h2>
      <div class="about-ver">${t('app.versie', { a: esc(a.version || '—') })}</div>
      ${state?.me?.role === 'admin' ? `<p class="about-upd"><button type="button" class="btn small" id="updBtn">${t('upd.check')}</button></p><p id="updMsg" class="muted small"></p>` : ''}
      <p>${t('app.persoonlijkTrainingsdashboardVoorDe')}</p>
      <p><button type="button" class="btn ghost small" data-explain="kort">${t('app.hoeGymcoachWerkt')}</button> <button type="button" class="btn ghost small" data-explain="meten">${t('app.hoeWeMeten')}</button></p>
      <p class="muted small">${t('app.2026AStoelwinderHolding')} <a href="#" data-go="terms">${t('app.voorwaardenEnGezondheid')}</a></p>
      <table class="about-tbl"><tbody>
        ${row('GymCoach', a.version)}${row(t('app.nodeJs'), a.node)}${row('speediance-cli', a.cli)}${row(t('ui.settings.gebruikers'), a.users)}${row(t('app.serverGestart'), a.started && new Date(a.started).toLocaleString(localeOf(), { dateStyle: 'medium', timeStyle: 'short' }))}
      </tbody></table>
    </div></div>${changelogHtml(a.changelog, a.version)}`;
}
// Eenvoudige opmaak uit het wijzigingenbestand: `code` en *cursief*, na het escapen.
function mdLite(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
// Lijst met versies. De versie die nu draait staat open, anders de nieuwste.
function changelogHtml(list, version) {
  if (!list?.length) return '';
  const hasCurrent = list.some((r) => r.version === version);
  const blocks = list.map((r, i) => `<details${(r.version === version || (!hasCurrent && i === 0)) ? ' open' : ''}>
      <summary>${esc(r.version)}<span class="muted">${esc(r.date)}</span></summary>
      ${r.lead ? `<p class="cl-lead">${mdLite(r.lead)}</p>` : ''}
      ${r.items?.length ? `<ul>${r.items.map((it) => `<li>${mdLite(it)}</li>`).join('')}</ul>` : ''}
    </details>`).join('');
  return `<section class="changelog"><h3>${t('about.history')}</h3>${getLang() === 'nl' ? '' : `<p class="muted small">${t('about.historyNl')}</p>`}${blocks}</section>`;
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
const edCtx = (extra = {}) => ({ state, api, esc, toast, weekLabel: (p) => t('app.weekLbl', { w: planIso(p).w, y: planIso(p).y }), onSaved: (plan) => { state.plan = plan; renderPlan(); }, onTemplates: loadTemplates, ...extra });
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
    <div class="muted small">${esc(t('tp.sum', { n: x.count, sets: x.sets, min: x.estMinutes ? t('app.min7', { estMinutes: x.estMinutes }) : '' }))}</div>
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
      if (!await askConfirm(t('tp.deleteConfirm', { name: x.name }), { danger: true, okText: t('tp.delete') })) return;
      await api('DELETE', '/api/templates?id=' + encodeURIComponent(id)); await loadTemplates();
    } else if (act === 'copy') {
      const r = await api('GET', '/api/template?id=' + encodeURIComponent(id));
      await api('POST', '/api/templates', { name: r.template.name, session: r.template }); tplTab = 'mine'; await loadTemplates();
    }
  } catch (e) { toast(e.message, true); }
});
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'plan') { loadTemplates(); loadWeekList(); } }));

// Venster "Nieuwe training": leeg, kopie van een training uit het plan, of uit een sjabloon.
$('#newSessBtn').addEventListener('click', async () => {
  if (!state.plan) { toast(t('app.maakEerstEenPlan'), true); return; }
  await loadTemplates();
  let dlg = $('#newSessDlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'newSessDlg'; dlg.className = 'wide-dlg'; document.body.appendChild(dlg); }
  const copies = state.plan.sessions.filter((x) => !x.outdoor);
  const opt = (v, label, sub = '') => `<label class="ns-opt"><input type="radio" name="ns" value="${esc(v)}"> <span><b>${esc(label)}</b>${sub ? `<br><span class="muted small">${esc(sub)}</span>` : ''}</span></label>`;
  dlg.innerHTML = `<form method="dialog" class="exd">
    <div class="exd-head"><div><div class="eyebrow">${t('nt.title')}</div><h2>${t('nt.title')}</h2></div><button value="close" class="btn ghost small" aria-label="${t('pk.close')}">✕</button></div>
    <label>${t('nt.name')} <input name="name" maxlength="40" placeholder="${esc(t('nt.namePh'))}"></label>
    <div class="eyebrow" style="margin:0">${t('nt.start')}</div>
    <div class="ns-list">
      ${opt('empty:', t('nt.empty'), t('nt.emptySub'))}
      ${copies.length ? `<div class="muted small">${t('nt.copy')}</div>${copies.map((x) => opt('copy:' + x.key, x.name, t('app.oefeningen', { count: x.exercises.length }))).join('')}` : ''}
      <div class="muted small">${t('nt.mine')}</div>${tplData.mine.length ? tplData.mine.map((x) => opt('template:' + x.id, x.name, t('tp.sum', { n: x.count, sets: x.sets, min: '' }))).join('') : `<div class="muted small">${t('nt.noTpl')}</div>`}
      ${tplData.shared.length ? `<div class="muted small">${t('nt.shared')}</div>${tplData.shared.map((x) => opt('template:' + x.id, x.name, t('nt.by', { name: x.owner }))).join('')}` : ''}
    </div>
    <div class="row gap end"><button value="close" class="btn ghost">${t('ed.cancel')}</button><button type="button" class="btn accent" id="nsMake">${t('nt.make')}</button></div>
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
