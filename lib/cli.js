// Dunne wrapper rond de speediance-cli binary.
import { execFile } from 'node:child_process';
import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { currentUser, speedianceDir } from './store.js';

const BIN = process.env.SPEEDIANCE_BIN || 'speediance-cli';

// Elke aanroep gebruikt de Speediance-config en token van de ingelogde gebruiker.
function userEnv() {
  const dir = speedianceDir(currentUser());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const env = { ...process.env, SPEEDIANCE_CONFIG: path.join(dir, 'config.json'), SPEEDIANCE_TOKEN_CACHE: path.join(dir, 'token.json') };
  for (const k of ['SPEEDIANCE_EMAIL', 'SPEEDIANCE_PASSWORD', 'SPEEDIANCE_REGION', 'SPEEDIANCE_DEVICE_TYPE']) delete env[k];
  return { env, cwd: dir };
}

// Draait speediance-cli met de Speediance-map van de huidige gebruiker; geeft stdout terug of gooit een leesbare fout.
function run(args, { timeout = 120000 } = {}) {
  const { env, cwd } = userEnv();
  return new Promise((resolve, reject) => {
    execFile(BIN, args, { timeout, maxBuffer: 64 * 1024 * 1024, env, cwd }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(`speediance-cli ${args[0]} faalde (exit ${err.code ?? '?'}): ${(stderr || err.message).trim().slice(0, 500)}`);
        e.exitCode = err.code;
        e.authFailure = err.code === 2;
        return reject(e);
      }
      resolve({ stdout, stderr });
    });
  });
}

// Leest JSON uit de uitvoer van de CLI; gooit een fout met context als dat niet lukt.
function parseJson(stdout, what) {
  const txt = stdout.trim();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch {
    throw new Error(`Kon JSON van '${what}' niet lezen: ${txt.slice(0, 200)}`);
  }
}

// Er staat al een token in de cache van deze gebruiker. Dan is een nieuwe login niet nodig.
export async function hasToken() {
  try {
    const tok = JSON.parse(await readFile(userEnv().env.SPEEDIANCE_TOKEN_CACHE, 'utf8'));
    return !!(tok && tok.token);
  } catch { return false; }
}

// Logt in bij Speediance met het opgeslagen account (maakt een nieuwe NANO-sessie).
export async function login() { await run(['login']); return true; }

// Lijst van trainingen van de laatste dagen.
export async function workouts(days = 90) {
  const { stdout } = await run(['workouts', '--days', String(days), '--json']);
  const data = parseJson(stdout, 'workouts');
  return Array.isArray(data) ? data : (data?.workouts ?? []);
}

// Alle details (sets, herhalingen, gewichten, tijden) van één training.
export async function session(trainingId) {
  const { stdout } = await run(['session', String(trainingId), '--json']);
  return parseJson(stdout, 'session');
}

// De oefeningencatalogus van het ingestelde toestel.
export async function library() {
  const dir = await mkdtemp(path.join(tmpdir(), 'gc-lib-'));
  try {
    const { stdout } = await run(['library', '--json', '--out', path.join(dir, 'library.json')], { timeout: 300000 });
    const data = parseJson(stdout, 'library');
    return Array.isArray(data) ? data : null;
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// Push één sessie-plan. dryRun=true bouwt alleen de payload.
export async function push(plan, { dryRun = false } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'gc-push-'));
  const file = path.join(dir, 'plan.json');
  try {
    await writeFile(file, JSON.stringify(plan, null, 2));
    const args = ['push', file, '--json'];
    if (dryRun) args.push('--dry-run');
    const { stdout, stderr } = await run(args);
    let result = null;
    try { result = JSON.parse(stdout.trim()); } catch { result = stdout.trim(); }
    return { ok: true, result, log: stderr.trim() };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// De huidige CLI-instellingen (account, regio, toestel).
export async function configShow() {
  const { stdout } = await run(['config', 'show', '--json']);
  return parseJson(stdout, 'config show');
}

// Zet één CLI-instelling.
export async function configSet(key, value) {
  await run(['config', 'set', key, String(value)]);
}

// versie van speediance-cli (voor "Over GymCoach"); eenmalig opgevraagd
let cliVersion = null;
// Versie van de geïnstalleerde speediance-cli (voor Over GymCoach).
export async function version() {
  if (cliVersion) return cliVersion;
  const { stdout } = await run(['version'], { timeout: 10000 });
  cliVersion = (stdout.match(/\d+\.\d+\.\d+/) || [stdout.trim().split('\n')[0]])[0];
  return cliVersion;
}
