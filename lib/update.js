// Bijwerken vanaf GitHub: de beheerder vergelijkt deze installatie met origin/main en haalt die binnen.
// data/ en .env staan in .gitignore en blijven staan. Alleen een eigen git-checkout van deze map.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { err } from './lang.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = /^(server\.js|lib\/.*\.js|public\/.*\.js|tools\/.*\.mjs)$/;

// Draait een commando in de GymCoach-map. Een exitcode wordt een resultaat; een ontbrekend programma een fout.
function run(cmd, args, { cwd = ROOT, timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (e, stdout, stderr) => {
      if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return reject(e);
      resolve({ code: e ? (typeof e.code === 'number' ? e.code : 1) : 0, out: String(stdout || '').trim(), err: String(stderr || '').trim() });
    });
  });
}

// git in deze map. Een ontbrekende git levert code 127.
function git(args, opts) {
  return run('git', args, opts).catch((e) => {
    if (e.code === 'ENOENT') return { code: 127, out: '', err: '' };
    throw e;
  });
}

// Versie uit package.json van de draaiende installatie.
function localVersion() {
  try { return JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || ''; } catch { return ''; }
}

// Positief als a nieuwer is dan b (2.10.0 tegen 2.9.0).
export function compareVersions(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10));
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const d = (Number.isFinite(pa[i]) ? pa[i] : 0) - (Number.isFinite(pb[i]) ? pb[i] : 0);
    if (d) return d;
  }
  return 0;
}

const DOCKER_COMMAND = 'docker compose pull && docker compose up -d';

// Het image heeft geen git-map. De Dockerfile zet GYMCOACH_RUNTIME; /.dockerenv vangt een oudere image.
function inDocker() {
  return process.env.GYMCOACH_RUNTIME === 'docker' || existsSync('/.dockerenv');
}

function githubSlug() {
  try {
    const url = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).repository?.url || '';
    const m = /github\.com[:/]([^/]+)\/([^/#.]+)/.exec(url);
    if (m) return `${m[1]}/${m[2]}`;
  } catch { /* package.json ontbreekt */ }
  return 'stolding/gymcoach';
}

// Wat het venster toont voor een Docker-installatie, uit de versie en de changelog op GitHub.
export function dockerView({ version, remoteVersion, changelog }) {
  const behind = compareVersions(remoteVersion, version) > 0;
  return {
    git: false, docker: true, behind, version, remoteVersion: remoteVersion || '',
    remote: remoteVersion || '', local: '',
    notes: behind ? notesSince(changelog, version) : [],
    command: DOCKER_COMMAND,
  };
}

// True als deze map zelf de git-werkmap is (niet een bovenliggende repo).
async function ownRepo() {
  const top = await git(['rev-parse', '--show-toplevel']);
  return top.code === 0 && path.resolve(top.out) === ROOT;
}

// De browser vraagt elk uur. Deze cache is korter, zodat die vraag GitHub echt bereikt en een tweede tab niet meteen opnieuw ophaalt.
const CACHE_MS = 50 * 60 * 1000;
let cached = null;

// Vergelijkt HEAD met origin/main. Haalt eerst op, tenzij een recente controle nog geldig is.
export async function status({ fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = await readStatus();
  cached = { at: Date.now(), value };
  return value;
}

// Echte vergelijking. Git-checkout wint; een container kijkt naar de versie op GitHub; anders niets.
async function readStatus() {
  const version = localVersion();
  if (await ownRepo()) return readGitStatus(version);
  if (inDocker()) return readDockerStatus(version);
  return { git: false, docker: false, behind: false, version };
}

async function readDockerStatus(version) {
  const slug = githubSlug();
  const base = `https://raw.githubusercontent.com/${slug}/main`;
  let remoteVersion = '';
  let changelog = '';
  try {
    const pack = await fetch(`${base}/package.json`, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'GymCoach' } });
    const log = await fetch(`${base}/CHANGELOG.md`, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'GymCoach' } });
    if (!pack.ok) throw new Error(String(pack.status));
    remoteVersion = JSON.parse(await pack.text()).version || '';
    changelog = log.ok ? await log.text() : '';
  } catch (e) {
    console.error('update docker:', e.message);
    throw err('upd.fetchMislukt', {}, 502);
  }
  if (!remoteVersion) throw err('upd.fetchMislukt', {}, 502);
  return dockerView({ version, remoteVersion, changelog });
}

async function readGitStatus(version) {
  if (!(await ownRepo())) return { git: false, docker: false, behind: false, version };
  const fetch = await git(['fetch', '--prune', 'origin', 'main']);
  if (fetch.code !== 0) { console.error('update fetch:', fetch.err || fetch.out); throw err('upd.fetchMislukt', {}, 502); }
  const local = await git(['rev-parse', 'HEAD']);
  const remote = await git(['rev-parse', 'origin/main']);
  if (local.code !== 0 || remote.code !== 0) throw err('upd.fetchMislukt', {}, 502);
  const localShort = (await git(['rev-parse', '--short', 'HEAD'])).out;
  const remoteShort = (await git(['rev-parse', '--short', 'origin/main'])).out;
  let remoteVersion = '';
  try { remoteVersion = JSON.parse((await git(['show', 'origin/main:package.json'])).out).version || ''; } catch { /* package.json ontbreekt of is geen JSON */ }
  let notes = [];
  try { notes = notesSince((await git(['show', 'origin/main:CHANGELOG.md'])).out, version); } catch { /* changelog ontbreekt */ }
  // bij alleen als GitHub commits heeft die hier nog niet staan; een lokale commit die nog niet gepusht is blijft staan
  const originInHead = local.out === remote.out ? { code: 0 } : await git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
  return { git: true, docker: false, behind: originInHead.code !== 0, local: localShort, remote: remoteShort, version, remoteVersion, notes };
}

// Wijzigingen uit een CHANGELOG.md: per versie de datum, de inleidende alinea en de punten.
export function parseChangelog(text) {
  const releases = [];
  let cur = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const head = /^##\s+(\d+\.\d+\.\d+)\s+[—-]\s+(.+)$/.exec(line);
    if (head) { cur = { version: head[1], date: head[2].trim(), lead: '', items: [] }; releases.push(cur); continue; }
    if (!cur) continue;
    const item = /^-\s+(.+)$/.exec(line);
    if (item) { cur.items.push(item[1].trim()); continue; }
    const t = line.trim();
    if (t) cur.lead = cur.lead ? `${cur.lead} ${t}` : t;
  }
  return releases;
}

// Versies in de changelog die nieuwer zijn dan de draaiende versie (het bestand staat met de nieuwste bovenaan).
export function notesSince(text, version) {
  const all = parseChangelog(text);
  const idx = all.findIndex((r) => r.version === version);
  return idx === -1 ? all.slice(0, 1) : all.slice(0, idx);
}

// node --check op de nieuwe main, in een tijdelijke worktree. Gooit vóór er iets wijzigt.
async function checkRemote() {
  const wt = path.join(tmpdir(), `gymcoach-update-${process.pid}`);
  await git(['worktree', 'remove', '--force', wt]);
  const add = await git(['worktree', 'add', '--detach', '--force', wt, 'origin/main']);
  if (add.code !== 0) { console.error('update worktree:', add.err || add.out); throw err('upd.fetchMislukt', {}, 502); }
  try {
    const listed = await git(['ls-files'], { cwd: wt });
    const files = listed.out.split('\n').filter((f) => CHECK.test(f));
    for (const file of files) {
      const c = await run(process.execPath, ['--check', path.join(wt, file)], { cwd: wt, timeout: 20000 });
      if (c.code !== 0) throw err('upd.syntax', { file }, 422);
    }
  } finally {
    await git(['worktree', 'remove', '--force', wt]);
  }
}

// Herstart de gebruikersdienst nadat het antwoord naar de browser is. False als er geen systemd-dienst is.
function scheduleRestart() {
  return run('systemctl', ['--user', 'show', 'gymcoach.service', '-p', 'LoadState', '--value'], { timeout: 8000 }).then((show) => {
    if (show.code !== 0 || show.out !== 'loaded') return false;
    setTimeout(() => {
      const child = execFile('systemctl', ['--user', 'restart', 'gymcoach.service'], { timeout: 60000 }, () => {});
      child.unref?.();
    }, 1500);
    return true;
  }, () => false);
}

let busy = null;
// Haalt origin/main binnen als die verschilt, na een syntaxcontrole. Eén update tegelijk.
export function apply() {
  if (!busy) busy = doApply().finally(() => { busy = null; });
  return busy;
}

// De echte update: controle, reset --hard, daarna herstart als de dienst bestaat.
async function doApply() {
  const s = await status({ fresh: true });
  if (s.docker) throw err('upd.dockerServer', {}, 400);
  if (!s.git) throw err('upd.geenGitServer', {}, 400);
  if (!s.behind) return { updated: false, restarting: false, version: s.version, remote: s.remote };
  await checkRemote();
  const reset = await git(['reset', '--hard', 'origin/main']);
  if (reset.code !== 0) { console.error('update reset:', reset.err || reset.out); throw err('upd.resetMislukt', {}, 500); }
  cached = null;
  const restarting = await scheduleRestart();
  return { updated: true, restarting, version: s.remoteVersion || s.version, remote: s.remote };
}
