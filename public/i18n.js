// Meertaligheid: één woordenboek per taal (public/locales/<taal>.js), gedeeld door browser en server.
// t('sleutel', { n: 3 }) geeft de tekst in de gekozen taal; ontbreekt hij, dan Engels, dan Nederlands, dan de sleutel.
import nl from './locales/nl.js';
import en from './locales/en.js';
import de from './locales/de.js';

export const DICTS = { nl, en, de };
// Talen die gebruikers kunnen kiezen. Een nieuwe taal komt hier pas bij als zijn woordenboek compleet is.
export const LANGS = [{ code: 'nl', name: 'Nederlands', locale: 'nl-NL' }, { code: 'en', name: 'English', locale: 'en-GB' }, { code: 'de', name: 'Deutsch', locale: 'de-DE' }];
// Alle talen met een woordenboek, ook die nog niet te kiezen zijn (voor het controlescript en tests).
export const ALL_LANGS = [{ code: 'nl', name: 'Nederlands', locale: 'nl-NL' }, { code: 'en', name: 'English', locale: 'en-GB' }, { code: 'de', name: 'Deutsch', locale: 'de-DE' }];
const LOCALE = Object.fromEntries(ALL_LANGS.map((l) => [l.code, l.locale]));
const FALLBACK = ['en', 'nl'];

let lang = 'nl';
// Kies de taal van de browserkant (onbekende of nog niet te kiezen talen: Nederlands).
export const setLang = (l) => { lang = LANGS.some((x) => x.code === l) ? l : 'nl'; if (typeof document !== 'undefined') document.documentElement.lang = lang; };
export const getLang = () => lang;
// De locale voor Intl (datums, getallen) bij een taal.
export const localeOf = (l = lang) => LOCALE[l] || 'nl-NL';

// Welke taal een gebruiker krijgt: zijn eigen keuze, anders de taal van de browser als die er is, anders de terugval.
export function resolveLang(pref, browser = [], fallback = 'en') {
  const ok = (c) => LANGS.some((x) => x.code === c);
  if (ok(pref)) return pref;
  for (const b of browser) { const c = String(b || '').slice(0, 2).toLowerCase(); if (ok(c)) return c; }
  return ok(fallback) ? fallback : 'nl';
}

// De ruwe waarde bij een sleutel: eerst de gevraagde taal, dan Engels, dan Nederlands.
function raw(key, l) {
  for (const c of [l, ...FALLBACK]) { const v = DICTS[c]?.[key]; if (v != null) return { v, c }; }
  return null;
}

// Vertaalde tekst bij een sleutel, met {naam}-plaatshouders ingevuld. Meervoud: een object { one, other, … }
// gekozen met vars.n. Met een derde argument een andere taal dan de gekozen (de server, per gebruiker).
export function t(key, vars = {}, l = lang) {
  const hit = raw(key, l);
  if (!hit) return key;
  let s = hit.v;
  if (typeof s === 'object') {
    const form = new Intl.PluralRules(localeOf(hit.c)).select(Number(vars.n ?? 0));
    s = s[form] ?? s.other ?? '';
  }
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}
// Een vaste lijst met labels die bij het lezen vertaalt: waarden '§sleutel' worden t('sleutel'), ook in geneste lijsten.
export function tmap(obj) {
  return new Proxy(obj, { get(o, k) { const v = Reflect.get(o, k); return typeof v === 'string' && v[0] === '§' ? t(v.slice(1)) : v && typeof v === 'object' ? tmap(v) : v; } });
}
// Bestaat er een tekst voor deze sleutel (in welke taal dan ook)?
export const has = (key) => raw(key, lang) != null;

// ---------- opmaak met Intl, in de taal van de gebruiker ----------
// Getal, bijv. fmtNum(1234.5) → "1.234,5" (nl) of "1,234.5" (en).
export const fmtNum = (n, opts = { maximumFractionDigits: 1 }, l = lang) => Number(n ?? 0).toLocaleString(localeOf(l), opts);
// Datum (Date of "2026-11-05"), standaard "5 nov. 2026"; opts zoals bij toLocaleDateString.
export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }, l = lang) {
  const x = d instanceof Date ? d : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00' : d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString(localeOf(l), opts);
}
// Korte dag, bijv. "wo 4 nov".
export const fmtDay = (d, l = lang) => fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }, l);
// Duur in minuten, bijv. fmtDuration(95) → "1 u 35 min" (de woorden komen uit het woordenboek).
export function fmtDuration(min, l = lang) {
  const m = Math.round(Number(min) || 0), h = Math.floor(m / 60), r = m % 60;
  return h ? t('fmt.hoursMinutes', { h, m: r }, l) : t('fmt.minutes', { m }, l);
}

// ---------- vaste HTML ----------
// Vult elementen met data-i18n (tekst), data-i18n-html (opmaak), data-i18n-placeholder, -title, -aria-label en -label.
// data-i18n-vars='{"v":"1.0"}' geeft waarden voor de {plaatshouders}.
export function applyI18n(root = typeof document !== 'undefined' ? document : null) {
  if (!root) return;
  const vars = (el) => { try { return el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : {}; } catch { return {}; } };
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n, vars(el));
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const [attr, ds] of [['placeholder', 'i18nPlaceholder'], ['title', 'i18nTitle'], ['aria-label', 'i18nAriaLabel'], ['label', 'i18nLabel']]) {
    for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.dataset[ds]));
  }
}

// Dosering zoals opgeslagen in het plan ("10 herh.", "30 s per kant") in de gekozen taal tonen.
export const doseText = (d, l = lang) => String(d ?? '')
  .replace(/(\d+)\s*herh\./, (_, n) => t('dose.reps', { n }, l))
  .replace(/per (kant|been|arm)\b/, (_, w) => t('dose.per' + w, {}, l));
