// Vertalen op de server: dezelfde woordenboeken als de browser (public/locales), in de taal van de huidige gebruiker.
import { t as tt, resolveLang, fmtNum as fn, fmtDate as fd, fmtDay as fdy } from '../public/i18n.js';
import { currentLang } from './store.js';

// Taal voor de huidige gebruiker: zijn keuze, anders de taal uit de browser van dit verzoek (Accept-Language).
export const userLang = (accept = []) => resolveLang(currentLang(), accept);
// Vertaalde tekst voor de huidige gebruiker.
export const tr = (key, vars = {}, l = userLang()) => tt(key, vars, l);
export const fmtNum = (n, opts, l = userLang()) => fn(n, opts, l);
export const fmtDate = (d, opts, l = userLang()) => fd(d, opts, l);
export const fmtDay = (d, l = userLang()) => fdy(d, l);
// Een fout met een code uit het woordenboek: de tekst in de taal van de gebruiker, de code erbij voor de browser.
export function err(key, vars = {}, status = 400) {
  return Object.assign(new Error(tr(key, vars)), { status, code: key, vars });
}
