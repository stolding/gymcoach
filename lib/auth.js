// Gebruikers, wachtwoorden (scrypt) en sessies.
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import * as store from './store.js';

const scrypt = promisify(_scrypt);
const SESSION_DAYS = 60;
const COOKIE = 'gc_sess';

// Hasht een wachtwoord met scrypt en een willekeurige salt.
export async function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(String(pw), salt, 64)).toString('hex');
  return { salt, hash };
}
// Controleert een wachtwoord tegen de opgeslagen scrypt-hash (tijdsconstant).
async function verifyPassword(pw, rec) {
  if (!rec?.salt || !rec?.hash) return false;
  const h = await scrypt(String(pw), rec.salt, 64);
  const ref = Buffer.from(rec.hash, 'hex');
  return ref.length === h.length && timingSafeEqual(ref, h);
}

// De velden van een gebruiker die naar de browser mogen (geen hash of sessies).
export const publicUser = (u) => u && { id: u.id, username: u.username, name: u.name, role: u.role, avatar: u.avatar || null };

// Controleert gebruikersnaam, naam en wachtwoord voor een nieuw account; gooit een fout met uitleg.
function validateNew({ username, name, password }) {
  if (!/^[a-zA-Z0-9._-]{2,30}$/.test(username || '')) throw Object.assign(new Error('Gebruikersnaam: 2–30 tekens (letters, cijfers, . _ -)'), { status: 400 });
  if (!name || String(name).length > 40) throw Object.assign(new Error('Vul een naam in (max. 40 tekens)'), { status: 400 });
  if (!password || String(password).length < 8) throw Object.assign(new Error('Wachtwoord: minimaal 8 tekens'), { status: 400 });
}
const idFor = (username) => String(username).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);

// Maakt een gebruiker aan (rol user of admin); gebruikersnaam moet uniek zijn.
export async function createUser({ username, name, password, role = 'user' }) {
  validateNew({ username, name, password });
  const users = await store.getUsers();
  const id = idFor(username);
  if (users.some((u) => u.id === id || u.username.toLowerCase() === String(username).toLowerCase())) throw Object.assign(new Error('Die gebruikersnaam bestaat al'), { status: 409 });
  const user = { id, username: String(username), name: String(name).trim(), role: role === 'admin' ? 'admin' : 'user', pass: await hashPassword(password), createdAt: new Date().toISOString() };
  users.push(user);
  await store.saveUsers(users);
  return user;
}

// Zet een nieuw wachtwoord en beëindigt alle sessies van die gebruiker.
export async function setPassword(id, password) {
  if (!password || String(password).length < 8) throw Object.assign(new Error('Wachtwoord: minimaal 8 tekens'), { status: 400 });
  const users = await store.getUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw Object.assign(new Error('Gebruiker niet gevonden'), { status: 404 });
  u.pass = await hashPassword(password);
  await store.saveUsers(users);
  // alle sessies van deze gebruiker beëindigen
  const s = await store.getAuthSessions();
  for (const [k, v] of Object.entries(s)) if (v.userId === id) delete s[k];
  await store.saveAuthSessions(s);
}

// Verwijdert een gebruiker met al zijn sessies; de laatste beheerder kan niet weg.
export async function deleteUser(id) {
  const users = await store.getUsers();
  const u = users.find((x) => x.id === id);
  if (!u) throw Object.assign(new Error('Gebruiker niet gevonden'), { status: 404 });
  if (u.role === 'admin' && users.filter((x) => x.role === 'admin').length === 1) throw Object.assign(new Error('De laatste beheerder kan niet worden verwijderd'), { status: 400 });
  await store.saveUsers(users.filter((x) => x.id !== id));
  const s = await store.getAuthSessions();
  for (const [k, v] of Object.entries(s)) if (v.userId === id) delete s[k];
  await store.saveAuthSessions(s);
}

// ---------- inloggen ----------
const attempts = new Map(); // ip -> { n, until }
// Logt in: controleert het wachtwoord (na 5 fouten vanaf één IP een minuut geblokkeerd) en maakt een sessietoken.
export async function login(username, password, ip) {
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) throw Object.assign(new Error('Te veel pogingen, probeer het over een minuut opnieuw'), { status: 429 });
  const users = await store.getUsers();
  const u = users.find((x) => x.username.toLowerCase() === String(username || '').toLowerCase());
  const ok = u && (await verifyPassword(password, u.pass));
  if (!ok) {
    const n = (a?.n || 0) + 1;
    attempts.set(ip, { n, until: n >= 5 ? Date.now() + 60e3 : 0 });
    throw Object.assign(new Error('Onjuiste gebruikersnaam of wachtwoord'), { status: 401 });
  }
  attempts.delete(ip);
  const token = randomBytes(32).toString('hex');
  const s = await store.getAuthSessions();
  const now = Date.now();
  for (const [k, v] of Object.entries(s)) if (v.expires < now) delete s[k];
  s[token] = { userId: u.id, created: now, expires: now + SESSION_DAYS * 864e5 };
  await store.saveAuthSessions(s);
  return { token, user: u };
}

// Beëindigt de sessie van dit token.
export async function logout(token) {
  const s = await store.getAuthSessions();
  delete s[token];
  await store.saveAuthSessions(s);
}

// Leest het sessietoken uit de cookie van het verzoek.
export function tokenFrom(req) {
  const c = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
  return c ? c.slice(COOKIE.length + 1) : null;
}

// De ingelogde gebruiker bij dit verzoek, of null.
export async function userFromRequest(req) {
  const t = tokenFrom(req);
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const s = await store.getAuthSessions();
  const sess = s[t];
  if (!sess || sess.expires < Date.now()) return null;
  return (await store.getUsers()).find((u) => u.id === sess.userId) || null;
}

// Set-Cookie-waarde voor een sessie (Secure als de verbinding https is).
export const cookieFor = (token, secure = false) => `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
// Set-Cookie-waarde die de sessiecookie wist.
export const clearCookie = () => `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
