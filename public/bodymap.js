// Gestileerd anatomisch figuur (voor- en achteraanzicht) met spiergroepen als vlakken.
// scores: { pecs: 6, quads: 3, ... } → kleurintensiteit per spiergroep.
import { t } from './i18n.js';

// Namen van de spiergroepen in de taal van de gebruiker (sleutels bm.* in het woordenboek). De server (PDF) zet met
// setBodymapTranslator zijn eigen vertaler, die de taal van de gebruiker van het verzoek kent.
let T = t;
export const setBodymapTranslator = (fn) => { T = fn; };
const MUSCLE_KEYS = ['pecs', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps', 'forearms', 'abs', 'lats', 'traps', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves', 'adductors'];
export const MUSCLE_LABELS = new Proxy(Object.fromEntries(MUSCLE_KEYS.map((k) => [k, k])), { get: (o, k) => (typeof k === 'string' && k in o ? T(`bm.${k}`) : undefined) });

// Spiegelt een pad rond x = 100 (alleen absolute M/L/Q/C-commando's met x,y-paren).
function mirror(d) {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)} ${y}`);
}
const both = (key, d) => [[key, d], [key, mirror(d)]];

// Voorkant (viewBox 0 0 200 420) — neutrale basisvorm
const FRONT = [
  ...both('traps', 'M88 58 Q80 64 70 68 L84 72 Q92 66 96 60 Z'),
  ...both('frontDelts', 'M70 70 Q56 72 52 88 Q54 100 62 104 Q70 92 78 80 Z'),
  ...both('sideDelts', 'M52 88 Q46 94 47 108 L54 110 Q54 98 58 92 Z'),
  ...both('pecs', 'M98 76 L80 76 Q70 84 64 104 Q74 116 98 112 Z'),
  ...both('biceps', 'M54 112 Q46 126 47 148 Q52 156 58 152 Q63 132 62 112 Z'),
  ...both('forearms', 'M47 158 Q40 180 41 206 L50 208 Q57 184 58 158 Z'),
  ['abs', 'M88 116 L112 116 Q114 150 112 186 L88 186 Q86 150 88 116 Z'],
  ...both('abs', 'M86 118 Q74 120 70 132 Q72 162 80 182 L86 184 Q84 150 86 118 Z'),
  ...both('adductors', 'M98 200 L90 204 Q88 230 94 258 L99 256 Z'),
  ...both('quads', 'M88 200 Q72 204 68 232 Q68 270 76 300 Q86 306 94 300 Q96 262 90 230 Q88 214 88 200 Z'),
  ...both('calves', 'M76 322 Q70 344 74 372 L86 374 Q90 346 88 322 Z'),
];
const HEAD = 'M100 10 a20 22 0 1 0 0.1 0 Z';
const HANDS = ['M42 206 Q38 222 44 230 Q52 228 52 210 Z'].flatMap((d) => [d, mirror(d)]);
const FRONT_BASE = [
  'M92 50 L108 50 L110 62 L90 62 Z',                 // nek
  'M70 68 Q100 60 130 68 L138 110 Q126 120 120 190 Q100 200 80 190 Q74 120 62 110 Z', // romp
  'M80 188 Q100 200 120 188 L116 206 Q100 214 84 206 Z', // heup
  ...['M74 300 Q72 312 76 322 L88 322 Q92 310 92 300 Z', 'M74 372 L72 392 Q80 398 90 394 L86 374 Z'].flatMap((d) => [d, mirror(d)]), // knie, voet
];

// Achterkant
const BACK = [
  ['traps', 'M100 56 Q86 62 70 68 Q84 78 92 100 L100 122 L108 100 Q116 78 130 68 Q114 62 100 56 Z'],
  ...both('rearDelts', 'M70 70 Q56 72 52 88 Q54 100 62 104 Q68 90 80 80 Z'),
  ...both('sideDelts', 'M52 88 Q46 94 47 108 L54 110 Q54 98 58 92 Z'),
  ...both('triceps', 'M54 112 Q46 126 47 148 Q52 156 58 152 Q63 132 62 112 Z'),
  ...both('forearms', 'M47 158 Q40 180 41 206 L50 208 Q57 184 58 158 Z'),
  ...both('lats', 'M80 82 Q68 96 66 112 Q70 140 84 168 L96 150 L94 104 Z'),
  ['lowerBack', 'M90 150 L110 150 Q114 170 114 188 L86 188 Q86 170 90 150 Z'],
  ...both('glutes', 'M99 192 Q84 190 76 202 Q74 222 86 230 Q96 230 99 224 Z'),
  ...both('hamstrings', 'M76 232 Q70 260 74 298 Q84 304 94 298 Q98 266 96 232 Z'),
  ...both('calves', 'M74 318 Q66 342 72 372 L88 374 Q94 344 90 318 Z'),
];

// Lichaamsvorm per figuur: breedte-factor per hoogte (y), schouders/taille/heupen.
// Armen schuiven mee met de schouderbreedte; het hoofd blijft gelijk.
const FIGURES = {
  neutraal: null,
  man: { w: [[0, 1], [48, 1.08], [64, 1.14], [92, 1.2], [118, 1.12], [150, 1.0], [186, 0.95], [212, 0.97], [300, 1.0], [420, 1.0]] },
  vrouw: {
    w: [[0, 1], [48, 0.88], [64, 0.9], [92, 0.88], [118, 0.86], [150, 0.82], [176, 0.92], [198, 1.12], [226, 1.16], [262, 1.06], [300, 0.98], [420, 0.94]],
    // borst iets ronder
    pecs: 'M98 78 L82 77 Q70 85 66 102 Q70 120 86 121 Q96 121 98 114 Z',
  },
};
export const FIGURE_LABELS = { neutraal: 'Neutraal', man: 'Man', vrouw: 'Vrouw' };
const ARM_KEYS = new Set(['biceps', 'triceps', 'forearms']);
const SHOULDER_Y = 92;

// Breedtefactor op hoogte y (lineair tussen de punten van de tabel).
function widthAt(table, y) {
  for (let i = 1; i < table.length; i++) {
    const [y1, w1] = table[i], [y0, w0] = table[i - 1];
    if (y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
  }
  return table[table.length - 1][1];
}
const r1 = (n) => Math.round(n * 10) / 10;
// Past de vorm van een pad aan een figuur aan; armen schuiven mee met de schouders.
function warp(d, fig, arm = false) {
  if (!fig) return d;
  const shift = (100 - 52) * (1 - widthAt(fig.w, SHOULDER_Y)); // hoeveel de schouder naar binnen/buiten gaat
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, xs, ys) => {
    const x = Number(xs), y = Number(ys);
    const nx = arm ? x + (x < 100 ? shift : -shift) : 100 + (x - 100) * widthAt(fig.w, y);
    return `${r1(nx)} ${y}`;
  });
}

const cache = {};
// vormen voor een figuur: 'man', 'vrouw' of 'neutraal' (ook gebruikt door de PDF op de server)
export function bodyShapes(figure = 'neutraal') {
  const key = FIGURES[figure] !== undefined ? figure : 'neutraal';
  if (cache[key]) return cache[key];
  const fig = FIGURES[key];
  const parts = (list) => list.map(([k, d]) => {
    let src = d;
    if (k === 'pecs' && fig?.pecs) src = /^M98 /.test(d) ? fig.pecs : mirror(fig.pecs);
    return [k, warp(src, fig, ARM_KEYS.has(k))];
  });
  const base = [HEAD, ...FRONT_BASE.map((d) => warp(d, fig)), ...HANDS.map((d) => warp(d, fig, true))];
  return (cache[key] = { FRONT: parts(FRONT), FRONT_BASE: base, BACK: parts(BACK), BACK_BASE: base });
}

// welk figuur hoort bij de instellingen: zelf gekozen, anders volgens geslacht
export function figureFor(settings = {}) {
  if (FIGURES[settings.figure] !== undefined) return settings.figure;
  return settings.sex === 'm' ? 'man' : settings.sex === 'v' ? 'vrouw' : 'neutraal';
}

let defaultFigure = 'neutraal';
// Het figuur dat bodyMap gebruikt als er geen wordt meegegeven.
export const setDefaultFigure = (f) => { defaultFigure = FIGURES[f] !== undefined ? f : 'neutraal'; };

// Kleurniveau 0–3 van een spiergroep ten opzichte van de drukste. Het weekplan gebruikt dit (geplande sets).
export function level(v, max) {
  if (!v) return 0;
  const r = v / max;
  return r > 0.66 ? 3 : r > 0.33 ? 2 : 1;
}

// Zelfde grenzen als vóór 2.14.1 (commit 505e22b): vermoeidheid in punten. Tot 10 is de donkere tint, daarboven het oranje verloop.
export function fatigueLevel(v) {
  if (!(v > 10)) return 0;
  if (v < 25) return 1;
  if (v < 50) return 2;
  return 3;
}
const FATIGUE_FILL = [
  'color-mix(in srgb, var(--ink) 16%, var(--surface))',
  'color-mix(in srgb, var(--accent) 38%, var(--surface))',
  'color-mix(in srgb, var(--accent) 70%, var(--surface))',
  'var(--accent)',
];

// Onder 50% hersteld (meer dan 50% vermoeid): het oude oranje verloop. Vanaf 50% loopt alleen die helft van oranje naar groen.
export function recoveryFill(pct) {
  const n = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
  if (n < 50) return FATIGUE_FILL[fatigueLevel(100 - n)];
  const t = Math.round((n - 50) * 2);
  return `color-mix(in srgb, var(--ok) ${t}%, var(--accent))`;
}

// Spierkaart als SVG (voor- en achteraanzicht). Standaard: geplande sets.
// scale 'recovery': scores zijn herstelpercentages. Alleen sleutels die erin staan worden gekleurd.
export function bodyMap(scores = {}, { height = 220, labels = true, title = 'Getrainde spiergroepen', selected = null, figure = defaultFigure, scale = 'relative', caption = null } = {}) {
  const { FRONT, FRONT_BASE, BACK, BACK_BASE } = bodyShapes(figure);
  const max = Math.max(1, ...Object.values(scores));
  const shape = ([k, d]) => {
    if (scale === 'recovery') {
      const sel = !selected ? '' : (k === selected ? ' sel' : ' dim');
      if (!Object.prototype.hasOwnProperty.call(scores, k)) return `<path d="${d}" class="bm m0${sel}" data-m="${k}"/>`;
      const raw = Number(scores[k]);
      const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : 0)));
      if (pct < 50) return `<path d="${d}" class="bm m${fatigueLevel(100 - pct)}${sel}" data-m="${k}"/>`;
      return `<path d="${d}" class="bm rec${sel}" data-m="${k}" style="fill:${recoveryFill(pct)}"/>`;
    }
    const value = scores[k] || 0;
    const lv = level(value, max);
    const sel = !selected ? '' : (k === selected ? ' sel' : ' dim');
    const text = caption ? caption(k, value) : `${MUSCLE_LABELS[k]}${scores[k] ? `: ${Math.round(scores[k] * 10) / 10} sets` : ''}`;
    return `<path d="${d}" class="bm m${lv}${sel}" data-m="${k}"><title>${text}</title></path>`;
  };
  const base = (arr) => arr.map((d) => `<path d="${d}" class="bm-base"/>`).join('');
  const view = (dx, parts, baseParts, label) => `<g transform="translate(${dx} 0)">${base(baseParts)}${parts.map(shape).join('')}${labels ? `<text x="100" y="416" text-anchor="middle" class="bm-lbl">${label}</text>` : ''}</g>`;
  const trained = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => MUSCLE_LABELS[k]).join(', ');
  return `<svg class="bodymap${selected ? ' has-sel' : ''}" viewBox="0 0 400 ${labels ? 424 : 404}" style="height:${height}px" role="img" aria-label="${title}: ${trained || 'geen'}">
    ${view(0, FRONT, FRONT_BASE, T('sum.voor'))}${view(200, BACK, BACK_BASE, T('sum.achter'))}</svg>`;
}
