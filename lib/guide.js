// Handleiding in de taal van de gebruiker. Dezelfde tekst als in de webapp.
import nl from '../public/explain.nl.js';
import en from '../public/explain.en.js';
import de from '../public/explain.de.js';
import no from '../public/explain.no.js';
import { userLang } from './lang.js';

const BY = { nl, en, de, no };

export function guideSections() {
  return BY[userLang()] || nl;
}
