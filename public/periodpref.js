// Laatste periode per gebruiker en per scherm (Terugkijken, samenstelling, segmenten).
// Blijft staan na herladen en na uitloggen: de sleutel hoort bij die gebruiker.

export const PERIOD_SCREENS = {
  stats: { fallback: '84', ok: ['week', 'month', 'year', '28', '84', '182', '365', '0'], legacy: 'gc-stat-range' },
  bodyComp: { fallback: 'all', ok: ['wk', 'mo', 'ytd', '1m', '3m', '6m', '1y', 'all'], legacy: 'gc-body-range' },
  bodySeg: { fallback: 'all', ok: ['wk', 'mo', 'ytd', '1m', '3m', '6m', '1y', 'all'], legacy: 'gc-body-range' },
};

export const periodStorageKey = (userId, screen) => (
  userId && PERIOD_SCREENS[screen] ? `gc-period:${userId}:${screen}` : ''
);

const allowed = (screen, value) => PERIOD_SCREENS[screen]?.ok.includes(value);

/** Eigen keuze, anders de oude gedeelde sleutel (eenmalig overgezet), anders de standaard. */
export function rememberedPeriod(storage, userId, screen) {
  const spec = PERIOD_SCREENS[screen];
  if (!spec) return '';
  const key = periodStorageKey(userId, screen);
  const own = key ? (storage.getItem(key) || '') : '';
  if (allowed(screen, own)) return own;
  const legacy = storage.getItem(spec.legacy) || '';
  if (allowed(screen, legacy)) {
    if (key) storage.setItem(key, legacy);
    return legacy;
  }
  return spec.fallback;
}

export function rememberPeriod(storage, userId, screen, value) {
  const key = periodStorageKey(userId, screen);
  if (!key || !allowed(screen, value)) return false;
  storage.setItem(key, value);
  return true;
}

/** Thema, taal en periodekeuzes blijven; de rest van gc-* gaat bij uitloggen weg. */
export const keepOnLogout = (key) => key === 'gc-theme' || key === 'gc-lang' || key.startsWith('gc-period:');
