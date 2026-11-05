// Uitleg "Hoe GymCoach werkt" per taal (explain.<taal>.js); explain() geeft de versie in de taal van de gebruiker.
import { getLang } from './i18n.js';
import nl from './explain.nl.js';
import en from './explain.en.js';
import de from './explain.de.js';

const BY_LANG = { nl, en, de };
export const explain = () => BY_LANG[getLang()] || nl;
