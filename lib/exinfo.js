// Uitleg, beelden en video van oefeningen uit de Speediance-catalogus, met een gedeelde cache op de server.
// - Gegevens per oefening en taal staan in de database (tabel exercise_info) en gelden voor alle gebruikers;
//   na 30 dagen worden ze opnieuw opgehaald.
// - Foto's en video's worden pas gedownload als iemand ze bekijkt, en daarna vanaf de eigen server getoond
//   (map data/media). Zo gaan er zo min mogelijk verzoeken naar Speediance, ook niet vanuit de browser.
import { createHash } from 'node:crypto';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as store from './store.js';
import { exerciseInfo } from './speediance.js';

const MAX_AGE_DAYS = 30;
const MEDIA_DIR = path.join(store.DATA_DIR, 'media');
const MAX_MEDIA = 80 * 1024 * 1024; // grotere bestanden niet bewaren
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
// Talen waarvoor Speediance volledige teksten heeft (Nederlands levert Chinees terug, dus niet gebruiken).
export const INFO_LANGS = ['en', 'de'];

// Is dit een mediabestand van Speediance dat we mogen ophalen?
function allowed(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)speediance\.com$/i.test(x.hostname) && TYPES[path.extname(x.pathname).toLowerCase()]; } catch { return false; }
}
// Adres waaronder de browser een mediabestand via de eigen server opvraagt.
const local = (u) => (u && allowed(u) ? `/api/media?u=${encodeURIComponent(u)}` : null);
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Zet het antwoord van Speediance om naar wat de app toont.
function normalize(d, lang) {
  if (!d) return null;
  const coaches = Array.isArray(d.actionLibraryList) ? d.actionLibraryList : [];
  const coach = coaches.find((c) => c.coachLanguage === lang) || coaches.find((c) => c.coachLanguage === 'en') || coaches[0] || null;
  let keyPoints = [];
  try { keyPoints = (JSON.parse(d.showDetails || '[]') || []).map((k) => ({ text: String(k.context || ''), img: local(k.img) })); } catch {}
  const guide = [];
  for (let i = 1; i <= 12; i++) if (d[`guideVoice${i}Txt`]) guide.push(String(d[`guideVoice${i}Txt`]));
  const names = (arr) => (Array.isArray(arr) ? arr.map((m) => m.muscleGroupName).filter(Boolean) : []);
  return {
    id: Number(d.id), lang, title: String(d.title || ''), tab: d.tabName || null,
    img: local(d.img), images: list(d.showDetailsImgs).map(local).filter(Boolean),
    video: local(coach?.videoPath), poster: local(coach?.img), coach: coach?.coach?.name || null,
    steps: String(d.context || ''), keyPoints, breathing: d.breathingRate || '', feeling: d.motionFeeling || '', mistake: d.errorCorrection || '', guide,
    main: names(d.mainMuscleGroupList), aux: names(d.auxiliaryMuscleGroupList),
    unilateral: Number(d.isLeftRight) === 1, compound: Number(d.isSingleJoint) !== 1, barbell: Number(d.isBarbell) === 1,
    recommendedWeight: Number(d.recommendedWeight) > 0 ? Number(d.recommendedWeight) : null,
    presets: (Array.isArray(d.templatePresetList) ? d.templatePresetList : []).map((p) => ({
      name: p.name || null, sets: p.groupCount, reps: [p.trainingCountScopeStart, p.trainingCountScopeEnd], rest: [p.relaxTimeScopeStart, p.relaxTimeScopeEnd], weight: p.weight,
    })),
  };
}

// Gegevens van één oefening: uit de cache, of (te oud of nog niet aanwezig) bij Speediance ophalen.
// Moet draaien als een gebruiker met een Speediance-account (voor het ophalen).
export async function getInfo(id, lang = 'en') {
  const L = INFO_LANGS.includes(lang) ? lang : 'en';
  const cached = store.getExerciseInfo(Number(id), L);
  const fresh = cached && Date.now() - Date.parse(cached.fetchedAt) < MAX_AGE_DAYS * 864e5;
  if (fresh) return cached.info;
  try {
    const info = normalize(await exerciseInfo(id, L), L);
    if (info) store.saveExerciseInfo(Number(id), L, info);
    return info;
  } catch (e) {
    if (cached) return cached.info; // liever oude gegevens dan niets
    throw e;
  }
}

const busy = new Map(); // één download tegelijk per bestand
// Pad naar het lokale mediabestand; downloadt het de eerste keer.
export async function mediaFile(u) {
  if (!allowed(u)) throw Object.assign(new Error('Ongeldig mediabestand'), { status: 400 });
  const ext = path.extname(new URL(u).pathname).toLowerCase();
  const file = path.join(MEDIA_DIR, createHash('sha1').update(u).digest('hex') + ext);
  const type = TYPES[ext];
  if (await stat(file).catch(() => null)) return { file, type };
  if (!busy.has(file)) {
    busy.set(file, (async () => {
      const r = await fetch(u);
      if (!r.ok) throw Object.assign(new Error(`Speediance-media: ${r.status}`), { status: 502 });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_MEDIA) throw Object.assign(new Error('Mediabestand te groot'), { status: 413 });
      await mkdir(MEDIA_DIR, { recursive: true, mode: 0o700 });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, buf, { mode: 0o600 });
      await rename(tmp, file);
    })().finally(() => busy.delete(file)));
  }
  await busy.get(file);
  return { file, type };
}
