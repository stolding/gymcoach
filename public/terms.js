// Voorwaarden en gezondheid. Bij een inhoudelijke wijziging TERMS_VERSION verhogen: iedereen accepteert dan opnieuw.
// De tekst staat per taal in terms.<taal>.js (zelfde versie voor alle talen); bij verschil geldt de Nederlandse tekst.
import { getLang } from './i18n.js';
import nl from './terms.nl.js';
import en from './terms.en.js';
import de from './terms.de.js';
import no from './terms.no.js';

export const TERMS_VERSION = 1;
const BY_LANG = { nl, en, de, no };
export const termsHtml = () => BY_LANG[getLang()] || nl;
