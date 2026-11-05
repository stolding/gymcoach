// Controle van de meertaligheid (draait ook in de GitHub-workflow):
//  1. elke sleutel die de code gebruikt, bestaat in het Nederlandse woordenboek (public/locales/nl.js);
//  2. elke taal die gebruikers kunnen kiezen, heeft alle sleutels (andere talen: alleen een telling);
//  3. Nederlandse tekst die nog niet via t() loopt, per bestand geteld; dat aantal mag niet stijgen
//     (tools/i18n-baseline.json; bijwerken met --update-baseline als je tekst naar het woordenboek hebt verplaatst).
// Gebruik: node tools/i18n-check.mjs [--update-baseline] [--list <bestand>]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICTS, LANGS, ALL_LANGS } from '../public/i18n.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'tools', 'i18n-baseline.json');
const args = process.argv.slice(2);
const files = [
  'server.js',
  ...readdirSync(path.join(ROOT, 'lib')).filter((f) => f.endsWith('.js')).map((f) => 'lib/' + f),
  // explain.en.js, terms.nl.js e.d. zijn al per taal en tellen niet mee
  ...readdirSync(path.join(ROOT, 'public')).filter((f) => /\.(js|html)$/.test(f) && f !== 'i18n.js' && !/\.[a-z]{2}\.js$/.test(f)).map((f) => 'public/' + f),
];
const src = Object.fromEntries(files.map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));
const nl = DICTS.nl;
let errors = 0;

// 1. gebruikte sleutels
const used = new Set(), dynamic = new Set();
for (const s of Object.values(src)) {
  for (const m of s.matchAll(/\b(?:t|tx|tr|err)\(\s*'([a-z][\w.-]*\w)'/g)) used.add(m[1]);
  for (const m of s.matchAll(/\b(?:t|tx|tr)\(\s*[^,()]*\?\s*'([a-z][\w.-]*\w)'\s*:\s*'([a-z][\w.-]*\w)'/g)) { used.add(m[1]); used.add(m[2]); }
  for (const m of s.matchAll(/data-i18n(?:-[a-z-]+)?="([a-z][\w.-]*\w)"/g)) used.add(m[1]);
  for (const m of s.matchAll(/'§([a-z][\w.-]*\w)'/g)) used.add(m[1]); // tmap-lijsten
  for (const m of s.matchAll(/\b(?:t|tx|tr)\(\s*`([a-z][\w.-]*\.)\$\{/g)) dynamic.add(m[1]);
  for (const m of s.matchAll(/\b(?:t|tx|tr|has)\(\s*'([a-z][\w.-]*\.)'\s*\+/g)) dynamic.add(m[1]);
}
const missing = [...used].filter((k) => !(k in nl));
if (missing.length) { errors++; console.log(`✗ ${missing.length} sleutel(s) gebruikt maar niet in nl.js:\n  ${missing.join('\n  ')}`); }
else console.log(`✓ ${used.size} gebruikte sleutels staan in nl.js`);
const unused = Object.keys(nl).filter((k) => !used.has(k) && ![...dynamic].some((p) => k.startsWith(p)) && !k.startsWith('fmt.'));
if (unused.length) console.log(`· ${unused.length} sleutel(s) in nl.js niet (letterlijk) gebruikt: ${unused.slice(0, 12).join(', ')}${unused.length > 12 ? ', …' : ''}`);

// 2. vertalingen
for (const l of ALL_LANGS.filter((x) => x.code !== 'nl')) {
  const d = DICTS[l.code] || {};
  const gap = Object.keys(nl).filter((k) => !(k in d));
  const pick = LANGS.some((x) => x.code === l.code);
  if (gap.length && pick) { errors++; console.log(`✗ ${l.name}: ${gap.length} sleutel(s) ontbreken (taal is te kiezen)`); }
  else console.log(`${gap.length ? '·' : '✓'} ${l.name}: ${Object.keys(nl).length - gap.length} van ${Object.keys(nl).length} vertaald${pick ? '' : ' (nog niet te kiezen)'}`);
}

// 3. Nederlandse tekst buiten het woordenboek
const NL = /\b(de|het|een|van|naar|voor|niet|geen|nog|je|jouw|wordt|deze|alle|zonder|bij|uit|ook|of|maar|dan|wat|hoe)\b/i;
function dutchLines(s) {
  const out = [];
  s.split('\n').forEach((line, i) => {
    const tr = line.trim();
    if (!tr || tr.startsWith('//') || tr.startsWith('*') || tr.startsWith('/*') || tr.startsWith('<!--')) return;
    const code = line.replace(/\s\/\/\s.*$/, '');
    const texts = [...code.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`]*)`|"([^"\\]*)"|>([^<>{}]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
    if (texts.some((x) => / /.test(x) && NL.test(x) && !/^[\w./-]+$/.test(x))) out.push(i + 1);
  });
  return out;
}
// HTML: elke zichtbare tekst en elk placeholder/title/aria-label zonder data-i18n telt mee (Nederlandse tekst
// binnen een element MET data-i18n is alleen de terugvaltekst en telt niet)
function htmlLines(s) {
  const out = new Set();
  const lineOf = (i) => s.slice(0, i).split('\n').length;
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  const body = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<title>[\s\S]*?<\/title>/g, blank)
    .replace(/(<(p|span|div)\b[^>]*data-i18n-html="[^"]*"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, a, t, inner, b) => a + blank(inner) + b);
  // tekst direct na een sluitende tag (bijv. </i>Volume per week) telt ook
  for (const m of body.matchAll(/<\/[a-z][\w-]*>([^<]*[A-Za-zÀ-ÿ]{3,}[^<]*)</gi)) if (!/^\s*[,.;:)]/.test(m[1])) out.add(lineOf(m.index));
  for (const m of body.matchAll(/<([a-z][\w-]*)([^>]*)>([^<]*)/gi)) {
    const [, , attrs, text] = m;
    if (/[A-Za-zÀ-ÿ]{2,}/.test(text.replace(/&[a-z]+;/g, '').replace(/\bGymCoach\b/g, '')) && !/data-i18n(-html)?=/.test(attrs)) out.add(lineOf(m.index + m[0].length - text.length));
    // attributen: alleen echte zinnen (met een spatie), geen voorbeeldwaarden zoals een adres of 8000
    for (const a of attrs.matchAll(/\b(placeholder|title|aria-label|label)="([^"]*)"/g)) if (/[A-Za-z]{2,} /.test(a[2]) && !/^(https?:|GymCoach &lt;)/.test(a[2]) && !attrs.includes(`data-i18n-${a[1]}=`)) out.add(lineOf(m.index));
  }
  return [...out].sort((a, b) => a - b);
}
const linesOf = (f) => (f.endsWith('.html') ? htmlLines(src[f]) : dutchLines(src[f]));
const counts = Object.fromEntries(files.map((f) => [f, linesOf(f).length]).filter(([, n]) => n));
const listArg = args.indexOf('--list');
if (listArg >= 0) { const f = args[listArg + 1]; for (const n of (src[f] ? linesOf(f) : [])) console.log(`${f}:${n}: ${src[f].split('\n')[n - 1].trim().slice(0, 140)}`); process.exit(0); }
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (args.includes('--update-baseline')) { writeFileSync(BASE, JSON.stringify(counts, null, 2) + '\n'); console.log(`baseline bijgewerkt: ${total} regels`); }
else {
  let base = {};
  try { base = JSON.parse(readFileSync(BASE, 'utf8')); } catch { console.log('· nog geen baseline: draai met --update-baseline'); }
  const worse = Object.entries(counts).filter(([f, n]) => n > (base[f] ?? 0));
  if (worse.length) { errors++; console.log(`✗ meer Nederlandse tekst buiten het woordenboek dan de baseline:\n  ${worse.map(([f, n]) => `${f}: ${n} (was ${base[f] ?? 0})`).join('\n  ')}\n  Zet de tekst in public/locales/nl.js en gebruik t(); bekijk met --list <bestand>.`); }
  console.log(`· ${total} regels met Nederlandse tekst buiten het woordenboek (${Object.keys(counts).length} bestanden)`);
}
process.exit(errors ? 1 : 0);
