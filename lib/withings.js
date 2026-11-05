// Withings-koppeling: OAuth2 + gewicht/vetpercentage ophalen.
import { randomBytes } from 'node:crypto';
import * as store from './store.js';

const AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2';
const API = process.env.WITHINGS_API || 'https://wbsapi.withings.net';
const TOKEN_URL = `${API}/v2/oauth2`;
const MEASURE_URL = `${API}/measure`;

const pendingStates = new Map(); // state -> { userId, at }

// De Withings-inlogpagina om de koppeling te starten.
export function authorizeUrl(settings) {
  const w = settings.withings || {};
  if (!w.clientId || !w.redirectUri) throw Object.assign(new Error('Vul eerst Client ID, Client secret en Callback-URL in bij Instellingen → Withings'), { status: 400 });
  const state = randomBytes(16).toString('hex');
  for (const [k, v] of pendingStates) if (Date.now() - v.at > 15 * 60e3) pendingStates.delete(k);
  pendingStates.set(state, { userId: store.currentUser()?.id, at: Date.now() });
  const q = new URLSearchParams({ response_type: 'code', client_id: w.clientId, scope: 'user.metrics', redirect_uri: w.redirectUri, state });
  return `${AUTH_URL}?${q}`;
}

// Vraagt of vernieuwt een Withings-token.
async function tokenRequest(params) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'requesttoken', ...params }) });
  const j = await r.json();
  if (j.status !== 0 || !j.body?.access_token) throw new Error(`Withings token-fout (status ${j.status}): ${j.error || 'onbekend'}`);
  const b = j.body;
  const tok = { accessToken: b.access_token, refreshToken: b.refresh_token, expiresAt: Date.now() + (b.expires_in - 120) * 1000, userId: b.userid, connectedAt: new Date().toISOString() };
  const prev = await store.getWithings();
  await store.saveWithings({ ...prev, ...tok });
  return tok;
}

// Verwerkt de terugkeer van Withings na het inloggen en bewaart de tokens.
export async function handleCallback(settings, { code, state }) {
  if (!code) throw Object.assign(new Error('Geen autorisatiecode ontvangen'), { status: 400 });
  const p = pendingStates.get(state);
  if (!p || p.userId !== store.currentUser()?.id) throw Object.assign(new Error('Ongeldige state — start de koppeling opnieuw (ingelogd als dezelfde gebruiker)'), { status: 400 });
  pendingStates.delete(state);
  const w = settings.withings;
  return tokenRequest({ grant_type: 'authorization_code', client_id: w.clientId, client_secret: w.clientSecret, code, redirect_uri: w.redirectUri });
}

// Een geldig toegangstoken; vernieuwt het als het bijna verloopt.
async function accessToken(settings) {
  const t = await store.getWithings();
  if (!t?.refreshToken) throw new Error('Withings is nog niet gekoppeld');
  if (t.accessToken && Date.now() < t.expiresAt) return t.accessToken;
  const w = settings.withings;
  const fresh = await tokenRequest({ grant_type: 'refresh_token', client_id: w.clientId, client_secret: w.clientSecret, refresh_token: t.refreshToken });
  return fresh.accessToken;
}

const localDate = (ts) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Meettypes (Withings meastype-nummers).
const TYPES = {
  1: 'kg', 5: 'fatFree', 6: 'fat', 8: 'fatMass', 76: 'muscle', 77: 'water', 88: 'bone',
  168: 'ecw', 169: 'icw', 170: 'visceral', 226: 'bmr', 227: 'metAge',
  11: 'restHr', 91: 'pwv', 155: 'vascAge', 167: 'nerve', 229: 'nerve',
};
const SEGMENT_TYPES = { 173: 'fatFree', 174: 'fatMass', 175: 'muscle' };
const BASIC = '1,4,5,6,8,76,77,88';
const FULL = BASIC + ',11,91,155,167,168,169,170,173,174,175,226,227,229';
const FETCH_VERSION = 5; // verhogen = eenmalig alles opnieuw ophalen

// Haalt metingen op bij Withings (Measure – Getmeas).
async function getmeas(token, params) {
  let groups = [], more = true, offset, pages = 0;
  while (more && pages++ < 500) {
    const body = new URLSearchParams(offset ? { ...params, offset: String(offset) } : params);
    const r = await fetch(MEASURE_URL, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json();
    if (j.status !== 0) throw Object.assign(new Error(`Withings meetfout (status ${j.status}): ${j.error || 'onbekend'}`), { withingsStatus: j.status });
    groups = groups.concat(j.body?.measuregrps || []);
    more = !!j.body?.more; offset = j.body?.offset;
  }
  return groups;
}

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// Haalt metingen op en voegt ze samen met het logboek (per dag de laatste waarde per meettype).
export async function syncWeight(settings) {
  const token = await accessToken(settings);
  const t = await store.getWithings();
  const params = { action: 'getmeas', category: '1' };
  const incremental = t.lastUpdate && t.fetchVersion === FETCH_VERSION;
  if (incremental) params.lastupdate = String(t.lastUpdate);
  // anders: zonder startdatum → de volledige historie (Withings levert in pagina's via more/offset)

  let groups, extended = true;
  try { groups = await getmeas(token, { ...params, meastypes: FULL }); }
  catch (e) {
    if (e.withingsStatus == null) throw e;
    extended = false; // uitgebreide types niet toegestaan → basiswaarden
    groups = await getmeas(token, { ...params, meastypes: BASIC });
  }

  // per dag: laatste waarde per meettype (groepen in tijdsvolgorde verwerken)
  const perDay = new Map();
  const positions = new Set(t.positions || []);
  let segmentSeen = false;
  let height = t.height || null; // lengte (m) uit je Withings-profiel, nodig voor BMI
  for (const g of groups.sort((a, b) => a.date - b.date)) {
    const day = localDate(g.date);
    const rec = perDay.get(day) || { segments: {} };
    for (const m of g.measures || []) {
      const v = m.value * 10 ** m.unit;
      if (m.type === 4) { if (v > 1 && v < 2.5) height = round(v, 3); continue; }
      if (SEGMENT_TYPES[m.type] && m.position != null) {
        segmentSeen = true; positions.add(m.position);
        (rec.segments[m.position] ||= {})[SEGMENT_TYPES[m.type]] = round(v, 2); // 2 decimalen: nodig voor een zinvolle links/rechts-balans
      } else if (TYPES[m.type]) {
        rec[TYPES[m.type]] = ['bmr', 'metAge', 'vascAge', 'restHr'].includes(TYPES[m.type]) ? Math.round(v) : round(v);
      }
    }
    perDay.set(day, rec);
  }

  const log = await store.getBodyLog();
  const byDate = new Map(log.map((b) => [b.date, b]));
  let added = 0;
  for (const [date, rec] of perDay) {
    if (!rec.kg && !byDate.get(date)?.kg) continue;
    if (byDate.get(date)?.source === 'handmatig') continue; // handmatige meting gaat voor
    const prev = byDate.get(date)?.source === 'withings' ? byDate.get(date) : {};
    const entry = { ...prev, ...rec, date, source: 'withings' };
    if (!Object.keys(entry.segments || {}).length) delete entry.segments;
    byDate.set(date, entry); added++;
  }
  const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  await store.saveBodyLog(merged);
  await store.saveWithings({ ...(await store.getWithings()), lastUpdate: Math.floor(Date.now() / 1000), fetchVersion: FETCH_VERSION, lastSync: new Date().toISOString(), lastError: null, extended, segmentSeen: segmentSeen || !!t.segmentSeen, positions: [...positions].sort((a, b) => a - b), height });
  return { added, total: merged.length, extended, segments: segmentSeen };
}

// Status van de Withings-koppeling voor Instellingen.
export async function status() {
  const t = await store.getWithings();
  return { connected: !!t?.refreshToken, connectedAt: t?.connectedAt || null, lastSync: t?.lastSync || null, lastError: t?.lastError || null, extended: t?.extended ?? null, segmentSeen: !!t?.segmentSeen, positions: t?.positions || [], height: t?.height || null };
}

// Verbreekt de Withings-koppeling.
export async function disconnect() { await store.saveWithings({}); }

// Bewaart de laatste fout van de koppeling, voor Instellingen.
export async function recordError(msg) {
  await store.saveWithings({ ...(await store.getWithings()), lastError: msg });
}
