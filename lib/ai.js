// AI-coach: Claude API of een OpenAI-compatibele server (llama.cpp / Ollama).
import { tr, userLang } from './lang.js';
// De AI doet alleen voorstellen; de regels-engine blijft de basis en alles wordt gevalideerd.

const SYSTEM = `Je bent een nuchtere krachttrainingscoach voor iemand die op een Speediance Gym Monster traint (ervaring: settings.experience).
Je krijgt instellingen, recente trainingshistorie, lichaamsgewicht, recente cardio-activiteiten (wandelen/fietsen uit Apple Health) en een voorgesteld weekplan van een regels-engine.
Sommige dagen kunnen een cardio-circuit of cardio buiten zijn (dayType); pas die niet aan naar zware kracht.
Geef kort advies in deze taal: {LANG}. Stel waar nodig concrete aanpassingen voor; ook de reason-teksten in die taal.
Regels:
- Blijf binnen de toegestane oefening-id's (allowedExercises). Verzin geen id's.
- Wijzig gewicht hooguit 15% ten opzichte van het voorstel, sets 2-5, herhalingen 5-20.
- Houd rekening met de notities over blessures en voorkeuren, en met de wens voor deze week (weekWish).
- Houd rekening met geslacht en leeftijd (person), maar volg de eigen data als die iets anders laat zien: verschillen tussen mensen zijn groter dan tussen man en vrouw.
  Vrouwen herstellen tussen sets meestal sneller en verdragen vaak iets meer volume; relatieve spiergroei is gelijk. Vanaf ~50 jaar: krachttraining is extra belangrijk voor botten en spiermassa, herstel kan langer duren.
- Herstel (recovery): state good/watch/easy uit rusthartslag, HRV, gehaalde herhalingen en vertraging binnen sets (slow = % trager in de laatste herhalingen; vanaf 40% tot het uiterste).
  Bij watch of easy: niet zwaarder maken; bij easy liever lichter of minder sets. Bij weightLoss.warn (te snel afvallen met dalende spiermassa): volume niet verlagen. Bij intake.below (inname duidelijk onder het streefgetal): volume ook niet verlagen.
- Leg nooit een voorkeur op op basis van geslacht (bijv. "vrouwen willen billen trainen"); volg de focus en de wens van de gebruiker.
- Eigen trainingen: sessies met custom (zelf gemaakt), locked (vastgezet) of edited (bewerkt) heeft de gebruiker zelf samengesteld.
  Respecteer die keuzes: de opbouw (volgorde, supersets, modi, rust, piramides) blijft staan. Stel daar alleen iets voor met een duidelijke reden
  (te zwaar/te licht volgens de historie, onbalans in de week, te lang voor de tijd, blessurenotities) en zeg in de reason waarom.
  Wissel daar alleen een oefening als het echt nodig is; binnen een superset (zelfde group) een oefening die ermee te combineren is.
  Oefeningen met fixed (vast gewicht): geen gewicht voorstellen.
- Neem de eigen trainingen mee in je oordeel over de hele week (balans duwen/trekken, sets per spiergroep, herstel).
- Staat er onlySession, geef dan alleen aanpassingen voor die sessie; het advies gaat over die training, in de context van de week.
Antwoord ALLEEN met JSON in deze vorm:
{"advice":"max ~120 woorden","adjustments":[{"session":"A","exerciseId":123,"swapToId":456|null,"sets":3|null,"reps":10|null,"weight":12.5|null,"reason":"kort"}]}`;

// Bouwt de compacte context voor de AI: instellingen, persoon, recente historie, gewicht, cardio en het voorgestelde plan.
function compactContext({ settings, plan, history, bodyLog, weekly, allowed, activities = [], onlySession = null, signals = null }) {
  const recent = Object.values(history).map((h) => ({
    id: h.id, name: h.name,
    last: h.log.slice(-4).map((l) => ({ d: l.date?.slice(0, 10), s: l.sets.map((s) => `${s.reps}x${s.weight}`).join(' ') })),
  })).filter((h) => h.last.length);
  return {
    settings: { goal: settings.goal, daysPerWeek: settings.daysPerWeek, minutesPerSession: settings.minutesPerSession, experience: settings.experience, notes: settings.notes },
    person: {
      sex: { m: 'man', v: 'vrouw' }[['m', 'v'].includes(settings.sex) ? settings.sex : settings.bandSex] || 'onbekend',
      age: Number(settings.birthYear) > 1900 ? new Date().getFullYear() - Number(settings.birthYear) : null,
    },
    weekWish: { focus: plan.focus || [], text: plan.wish || '' },
    bodyweight: bodyLog.slice(-12),
    weekly,
    ...(signals?.recovery && { recovery: { state: signals.recovery.state, signals: signals.recovery.signals.map(({ key, recent, base, level }) => ({ key, recent, base, level })) } }),
    ...(signals?.weightLoss && { weightLoss: signals.weightLoss }),
    ...(signals?.intake && { intake: signals.intake }),
    cardioLast14Days: activities.filter((a) => a.date >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)).map((a) => ({ d: a.date, type: a.type, min: a.minutes, km: a.km })),
    history: recent,
    plan: plan.sessions.map((s) => ({
      session: s.key, name: s.name, dayType: s.type || plan.goal,
      ...(s.custom && { custom: true }), ...(s.locked && { locked: true }), ...(s.edited && { edited: true }),
      exercises: s.exercises.map((e) => ({
        id: e.id, title: e.title, pattern: e.pattern, sets: e.sets.length, reps: e.sets[0]?.reps, weight: e.sets[0]?.weight, note: e.note,
        ...(e.group && { group: e.group }), ...(e.fixed && { fixed: true }),
        // eigen opbouw per set (alleen als de sets verschillen): herhalingen x gewicht, modus, rust
        ...(e.sets.some((x) => x.reps !== e.sets[0].reps || x.weight !== e.sets[0].weight || (x.mode || 1) !== 1) && { setList: e.sets.map((x) => `${x.reps}x${x.weight}${(x.mode || 1) !== 1 ? ' m' + x.mode : ''} r${x.rest}`) }),
      })),
    })),
    ...(onlySession && { onlySession }),
    allowedExercises: allowed,
  };
}

// Vraagt de Claude API (Messages) om een antwoord; geeft het ruwe bericht terug.
async function postAnthropic(ai, system, user, maxTokens = 2000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ai.model || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(tr('ai.claudeApi', { a: j?.error?.message || r.status }));
  return j;
}

// Zichtbare tekst en, apart, een denkblok. Denktekst hoort niet bij het coach-advies.
function anthropicParts(j) {
  const blocks = Array.isArray(j?.content) ? j.content : [];
  const text = blocks.filter((c) => c && (c.type === 'text' || c.type === 'output_text') && typeof c.text === 'string').map((c) => c.text).join('');
  const think = blocks.filter((c) => c && (c.type === 'thinking' || c.type === 'reasoning')).map((c) => c.thinking || c.reasoning || c.text || '').join('\n');
  return { text, think, stop: j?.stop_reason || '' };
}

async function callAnthropic(ai, system, user, maxTokens = 2000) {
  return anthropicParts(await postAnthropic(ai, system, user, maxTokens)).text;
}

// Vraagt een OpenAI-compatibele server (llama.cpp, Ollama) om een antwoord; geeft het ruwe bericht terug.
async function postOpenAI(ai, system, user, maxTokens = 2000) {
  const base = (ai.baseUrl || 'http://localhost:8080/v1').replace(/\/$/, '');
  const headers = { 'content-type': 'application/json' };
  if (ai.apiKey) headers.authorization = `Bearer ${ai.apiKey}`;
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: ai.model || 'local', temperature: 0.3, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(tr('ai.lokaleLlm', { a: j?.error?.message || r.status }));
  return j;
}

function openAIParts(j) {
  const msg = j?.choices?.[0]?.message || {};
  const content = msg.content;
  const text = typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((p) => (typeof p === 'string' ? p : p?.text || p?.content || '')).join('')
    : '';
  const think = [msg.reasoning_content, msg.reasoning, msg.thinking].filter((x) => typeof x === 'string').join('\n');
  return { text, think, stop: j?.choices?.[0]?.finish_reason || '' };
}

async function callOpenAI(ai, system, user, maxTokens = 2000) {
  return openAIParts(await postOpenAI(ai, system, user, maxTokens)).text;
}

// Haalt het JSON-object uit het antwoord van het model (ook als er tekst of <think>-blokken omheen staan).
function extractJson(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(tr('ai.aiGafGeenJson'));
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Controleert en begrenst de voorgestelde aanpassingen.
// onlySession: alleen aanpassingen voor die ene training. Vast gewicht (fixed) wordt nooit aangepast.
export function validateAdjustments(raw, plan, allowedIds, onlySession = null) {
  const out = [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const session = plan.sessions.find((s) => s.key === a.session);
    const ex = session?.exercises.find((e) => Number(e.id) === Number(a.exerciseId));
    if (!ex) continue;
    if (onlySession && session.key !== onlySession) continue;
    const base = Math.max(0, ...ex.sets.map((x) => x.weight || 0));
    const own = !!(session.custom || session.locked || session.edited);
    const adj = { session: session.key, sessionName: session.name, own, exerciseId: ex.id, title: ex.title, reason: String(a.reason || '').slice(0, 200) };
    if (a.swapToId && allowedIds.has(Number(a.swapToId)) && Number(a.swapToId) !== Number(ex.id)) adj.swapToId = Number(a.swapToId);
    if (Number.isFinite(+a.sets) && a.sets !== null) adj.sets = Math.min(5, Math.max(2, Math.round(+a.sets)));
    if (Number.isFinite(+a.reps) && a.reps !== null) adj.reps = Math.min(20, Math.max(5, Math.round(+a.reps)));
    if (Number.isFinite(+a.weight) && a.weight !== null && +a.weight > 0 && !ex.fixed) {
      const lo = base * 0.85, hi = base * 1.15;
      adj.weight = Math.round(Math.min(hi, Math.max(lo, +a.weight)) * 2) / 2;
    }
    if (adj.swapToId || adj.sets || adj.reps || adj.weight) out.push(adj);
  }
  return out;
}

// AI-coach: vraagt advies en aanpassingen voor het plan en geeft alleen gecontroleerde aanpassingen terug.
export async function coach(ctx) {
  const { ai } = ctx.settings;
  if (!ai || ai.provider === 'none') throw new Error(ai?.apiKey ? tr('ai.deAiCoachStaat') : tr('ai.geenAiProviderIngesteld'));
  if (ai.provider === 'anthropic' && !ai.apiKey) throw new Error(tr('ai.geenClaudeApiKey'));
  const only = ctx.onlySession && ctx.plan.sessions.some((s) => s.key === ctx.onlySession) ? ctx.onlySession : null;
  const user = 'Context:\n' + JSON.stringify(compactContext({ ...ctx, onlySession: only }));
  // antwoord in de taal van de gebruiker
  const l = userLang();
  const system = SYSTEM.replace('{LANG}', new Intl.DisplayNames(['nl'], { type: 'language' }).of(l) + ` (${l})`);
  const text = ai.provider === 'anthropic' ? await callAnthropic(ai, system, user) : await callOpenAI(ai, system, user);
  const parsed = extractJson(text);
  const allowedIds = new Set(ctx.allowed.map((a) => Number(a.id)));
  const sessionName = only ? ctx.plan.sessions.find((s) => s.key === only).name : null;
  return { advice: String(parsed.advice || '').slice(0, 2000), adjustments: validateAdjustments(parsed.adjustments, ctx.plan, allowedIds, only), provider: ai.provider, model: ai.model, ...(only && { session: only, sessionName }) };
}

// Past (door de gebruiker geaccepteerde) aanpassingen toe op het plan.
export function applyAdjustments(plan, adjustments, libById) {
  for (const a of adjustments) {
    const s = plan.sessions.find((x) => x.key === a.session);
    const e = s?.exercises.find((x) => Number(x.id) === Number(a.exerciseId));
    if (!e) continue;
    if (a.swapToId && libById.has(Number(a.swapToId))) {
      const lib = libById.get(Number(a.swapToId));
      Object.assign(e, { id: lib.id, title: lib.name, muscle: lib.muscle, basis: null });
    }
    const own = s.custom || s.locked || s.edited;
    if (own) {
      // eigen training: opbouw per set (modus, rust, piramide) blijft; gewicht en herhalingen schuiven mee
      const top = Math.max(...e.sets.map((x) => x.weight || 0));
      const dW = a.weight != null && !e.fixed ? a.weight - top : 0;
      const dR = a.reps != null ? a.reps - e.sets[0].reps : 0;
      let sets = e.sets.map((x) => ({ ...x, weight: Math.max(0.5, Math.round((x.weight + dW) * 2) / 2), reps: Math.min(30, Math.max(1, x.reps + dR)) }));
      if (a.sets != null) {
        while (sets.length < a.sets) sets.push({ ...sets[sets.length - 1] });
        sets = sets.slice(0, a.sets);
      }
      e.sets = sets;
      s.edited = true; // blijft vastgezet; de wijziging geldt als jouw bewerking
    } else {
      const n = a.sets ?? e.sets.length;
      const tmpl = e.sets[0];
      e.sets = Array.from({ length: n }, () => ({ ...tmpl, reps: a.reps ?? tmpl.reps, weight: a.weight ?? tmpl.weight }));
    }
    e.note = `AI: ${a.reason || 'aangepast'}`;
    // staat deze training al op het toestel, dan is die versie nu verouderd
    if (s.pushedAt) { s.changedAfterPush = true; delete s.pushedAt; }
  }
  plan.source = 'regels + AI';
  return plan;
}

const HEALTH_SYSTEM = `Je bent een nauwkeurige data-analist voor gezondheid en fitness, ingebouwd in GymCoach.
Je vat de lichaamsmetingen van één gebruiker samen. Geef de uitvoer in deze taal: {LANG}. Vertaal de koppen uit UITVOER naar die taal.

MEETCONDITIES (altijd gelijk, tenzij de data iets anders vermeldt)
- 's Ochtends direct na het opstaan, na toiletbezoek, nuchter (niet gegeten of gedronken), vóór het douchen.
- Hierdoor zijn de metingen onderling goed vergelijkbaar. Afwijkingen tussen metingen komen
  dus vooral door echte veranderingen of door de dag ervoor (training, laat/zout eten,
  alcohol, slechte nacht), en minder door het meetmoment zelf.
- De rusthartslag op de weegschaal wordt staand gemeten, kort na het opstaan. Die ligt daardoor
  meestal 10–20 bpm hoger dan de echte rusthartslag. Gebruik de Apple Watch-rusthartslag
  (nacht/ochtend) als referentie voor echte rust.

ANALYSEREGELS
1. Analyseperiode = de afgelopen 4 weken, zoals in de data. Bepaal per meetwaarde:
   - startwaarde (gemiddelde van de eerste 2 metingen) en eindwaarde (gemiddelde van de laatste 2),
   - het verschil daartussen en de richting van de trend (stijgend / dalend / stabiel),
   - of de trend consistent is of door één uitschieter komt (noem de uitschieter met datum).
   Noem een verandering alleen "echt" als die groter is dan de meetruis
   (gewicht ±0,4 kg, vet% ±0,4, spiermassa ±0,4 kg, PWV ±0,3 m/s, HRV ±5 ms, zenuwgezondheid ±4 µS).
   Anders: "stabiel / binnen meetruis".
2. Bereken en interpreteer deze combinaties over de 4 weken:
   - Recompositie: Δvetvrije massa / Δgewicht en Δvetmassa.
   - FFMI en vet% samen (relativeer BMI als FFMI > 20). Gebruik het meegestuurde ffmi-veld; verzin geen lengte.
   - Leeftijdskloof: vasculaire leeftijd − kalenderleeftijd, en metabole leeftijd − kalenderleeftijd.
   - ECW/TBW-ratio (extracellulair water / lichaamswater) en de trend ervan. Gebruik ecwTbw als dat veld er is.
   - Rusthartslag van de weegschaal (scaleRestHr) naast die van de Apple Watch (watch.restHr).
   - Samenhang tussen trainingsvolume en de ochtend erna: HRV, rusthartslag, waterbalans
     (zware trainingsdag → meer vocht en lagere HRV is normaal; houdt dat aan, dan is er onvoldoende herstel).
   - VO2max ten opzichte van chartBands.vo2max voor leeftijd en geslacht, en de relatie met cardiominuten.
3. Referentiewaarden: PWV > 10 m/s = verhoogde vaatstijfheid; echte rusthartslag > 100 = tachycardie
   (staand na opstaan: pas opmerkelijk als die structureel > 110 ligt of als ook de Watch-waarde hoog is);
   Withings zenuwgezondheid ≥ 60 µS normaal, 40–60 matig, < 40 verhoogd risico;
   visceraal vet < 10 gunstig; ECW/TBW > 0,40 mogelijk verhoogd (BIA-schatting, alleen de trend telt).
   De kolom Beoordeling voor VO2max en polsgolfsnelheid volgt chartBands. Regel 3 blijft gelden voor de paragraaf Huisarts.
4. Je stelt geen diagnoses. Als een waarde over de 4 weken structureel buiten een referentiewaarde valt,
   of 3+ metingen op rij duidelijk verslechtert, adviseer je dit met de huisarts te bespreken.
   Bij één afwijkende meting geen alarm, wel benoemen.
5. Verzin geen waarden. Ontbreekt er data (het veld missing, of een lege lijst), zeg dat dan
   en sla de bijbehorende analyse over. Slaapduur zit niet in de data.

DATAVELDEN
- context: sex (man, vrouw of null), birthDate (YYYY-MM-DD of null), birthYear, experience, goal, heightM, device.
  Staat birthDate erbij, bereken de leeftijd op elke meetdatum vanaf die dag (nog niet jarig = een jaar jonger). Ontbreekt de datum, dan leeftijd = meetjaar minus birthYear.
- measures: Withings per meetdag, oud naar nieuw. scaleRestHr is de staande momentmeting op de weegschaal.
  ffmi en ecwTbw zijn al door GymCoach berekend. Geen lengte in context: sla FFMI over.
- watch: Apple Health per dag. restHr is de rusthartslag van de Apple Watch.
- cardio: duur van bewaarde activiteiten. De Exercise-ring zit er niet in.
- sessions en weeks: krachttraining op de Gym Monster. volumeKg is het volume.
- chartBands: grafiekgrenzen van GymCoach voor VO2max (ml/kg/min) en polsgolfsnelheid (m/s).

Je krijgt een vooraf berekende gezondheidsscore (sleutel gezondheidsscore), gecorrigeerd voor geslacht en leeftijd.
Bereken deze NIET opnieuw en wijk er niet van af. Ontbreekt het veld, sla de sectie over.
Benoem de totaalscore (één decimaal) en de trend over 4 weken, noem de 2 categorieën met de laagste score als belangrijkste verbeterpunten, en geef aan welke deelscores het snelst kunnen stijgen.

UITVOER (Markdown, max. ~350 woorden)
## Gezondheidsscore
1–2 zinnen. Alleen als de sleutel gezondheidsscore is meegegeven.
## Samenvatting (afgelopen 4 weken)
2–3 zinnen: de belangrijkste conclusie van deze periode.
## Trendtabel
Tabel met kolommen: Meting | Start | Nu | Δ | Trend (↑ ↓ →) | Beoordeling (goed / let op / binnen ruis).
Alleen de belangrijkste 8–10 metingen.
## Wat gaat goed
Punten met cijfer + trend.
## Aandachtspunten
Punten met cijfer, trend en waarom het ertoe doet.
## Verbanden
1–3 inzichten die alleen blijken uit combinaties van waarden of uit de koppeling met training.
## Advies voor de komende 2 weken
Max. 3 concrete, uitvoerbare acties (training, cardio, herstel, slaap, voeding).
## Huisarts?
Alleen opnemen als regel 4 van toepassing is.

Gebruik een feitelijke, motiverende toon. Geen opvulzinnen. Antwoord alleen met de Markdown, niet met JSON.
Zet het antwoord direct neer. Geen denkblok en geen <think>-tekst.`;

const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localISO(dt);
}

function isoWeek(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const w = 1 + Math.round((t - first) / 604800000);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

const round1 = (v) => Math.round(v * 10) / 10;
const keep = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));

// Compacte context voor de gezondheidsstatus: 4 weken metingen, training en Apple Watch.
export function healthPayload({ settings = {}, bodyLog = [], workouts = [], daily = [], activities = [], heightM = null, today = localISO(new Date()), gezondheidsscore = null } = {}) {
  const from = addDays(today, -27);
  const inRange = (d) => d >= from && d <= today;
  const h = Number(heightM) > 0.5 ? Number(heightM) : null;
  const measures = bodyLog.filter((b) => inRange(String(b.date || '').slice(0, 10))).map((b) => {
    const date = String(b.date).slice(0, 10);
    const row = keep({
      date, kg: b.kg, fatPct: b.fat, fatMassKg: b.fatMass, fatFreeKg: b.fatFree, muscleKg: b.muscle,
      waterKg: b.water, ecwKg: b.ecw, icwKg: b.icw, visceral: b.visceral, boneKg: b.bone,
      pwv: b.pwv, vascAge: b.vascAge, metAge: b.metAge, nerveUs: b.nerve, scaleRestHr: b.restHr, bmr: b.bmr,
    });
    if (h && b.fatFree) row.ffmi = round1(b.fatFree / (h * h));
    if (b.ecw != null && Number(b.water) > 0) row.ecwTbw = Math.round((b.ecw / b.water) * 1000) / 1000;
    return row;
  });
  const sessions = workouts.filter((w) => inRange(String(w.date || '').slice(0, 10))).map((w) => keep({
    date: String(w.date).slice(0, 10),
    volumeKg: Math.round(Number(w.volume) || 0),
    minutes: w.duration_secs ? Math.round(Number(w.duration_secs) / 60) : null,
  }));
  const byWeek = new Map();
  for (const s of sessions) {
    const k = isoWeek(s.date);
    const o = byWeek.get(k) || { week: k, sessions: 0, volumeKg: 0, minutes: 0 };
    o.sessions += 1; o.volumeKg += s.volumeKg || 0; o.minutes += s.minutes || 0;
    byWeek.set(k, o);
  }
  const watch = daily.filter((d) => inRange(d.date) && (d.restHr || d.hrv || d.vo2max || d.steps || d.activeKcal)).map((d) => keep({
    date: d.date, restHr: d.restHr, hrv: d.hrv, vo2max: d.vo2max, steps: d.steps, activeKcal: d.activeKcal,
  }));
  const cardio = activities.filter((a) => inRange(a.date) && Number(a.minutes) > 0).map((a) => keep({
    date: a.date, type: a.type, minutes: Math.round(Number(a.minutes)), km: a.km,
  }));
  const sex = ['m', 'v'].includes(settings.sex) ? settings.sex : (['m', 'v'].includes(settings.bandSex) ? settings.bandSex : '');
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(String(settings.birthDate || '')) ? settings.birthDate : null;
  const birthYear = birthDate ? Number(birthDate.slice(0, 4)) : (Number(settings.birthYear) > 1900 ? Math.round(Number(settings.birthYear)) : null);
  const goal = { spieropbouw: 'spieropbouw', afvallen: 'vetverlies', combinatie: 'vetverlies en spieropbouw' }[settings.goal] || settings.goal || null;
  const missing = ['slaapduur'];
  if (!measures.length) missing.push('Withings-metingen');
  if (!watch.length) missing.push('Apple Watch-dagwaarden');
  if (!sessions.length) missing.push('trainingsdata');
  if (!cardio.length) missing.push('cardiominuten');
  if (!h) missing.push('lengte');
  if (!birthYear) missing.push('geboortejaar');
  if (!sex) missing.push('geslacht');
  return {
    from, to: today, measures, sessions, weeks: [...byWeek.values()], watch, cardio, missing,
    ...(gezondheidsscore ? { gezondheidsscore } : {}),
    context: {
      sex: sex === 'm' ? 'man' : sex === 'v' ? 'vrouw' : null,
      birthDate,
      birthYear,
      experience: settings.experience === 'gevorderd' ? 'gevorderd' : 'beginner',
      goal,
      heightM: h ? Math.round(h * 1000) / 1000 : null,
      device: 'Speediance Gym Monster',
    },
    chartBands: {
      vo2max: 'ml/kg/min. Below the first number: below average. From the first up to the second: average. From the second: good to excellent.',
      vo2maxMen: { '20-29': [42, 47], '30-39': [40, 45], '40-49': [37, 42], '50-59': [34, 39], '60+': [30, 35] },
      vo2maxWomen: { '20-29': [33, 38], '30-39': [31, 36], '40-49': [29, 34], '50-59': [26, 31], '60+': [23, 28] },
      pwv: 'm/s, lower is more elastic. Up to the first number: average or more elastic. Above that through the second: above average. Above the second: elevated. PWV above 10 m/s stays the medical line in rule 3.',
      pwvByAge: { '<30': [6.5, 7.5], '30-39': [7.0, 8.5], '40-49': [7.8, 9.5], '50-59': [8.8, 10.5], '60-69': [10.3, 11.5], '70+': [12.0, 13.0] },
    },
  };
}

function unwrapFence(s) {
  return String(s || '').replace(/^\s*```(?:markdown|md)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

// Zichtbare Markdown. Staat het hele antwoord in een denkblok, dan telt dat blok alsnog.
export function statusText(raw) {
  const src = String(raw || '').replace(/^\uFEFF/, '');
  const think = [...src.matchAll(/<think>([\s\S]*?)<\/think>/g)].map((m) => m[1].trim()).filter(Boolean).join('\n');
  let clean = src.replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = clean.indexOf('<think>');
  if (open >= 0) clean = clean.slice(0, open);
  clean = unwrapFence(clean);
  if (!clean && think) clean = unwrapFence(think);
  if (clean.startsWith('{')) {
    try {
      const j = JSON.parse(clean);
      const inner = j.markdown || j.text || j.status || j.samenvatting;
      if (typeof inner === 'string' && inner.trim()) return inner.trim();
    } catch { /* geen JSON, dan de tekst zelf */ }
  }
  return clean;
}

// Gezondheidsstatus over 4 weken, via dezelfde AI-koppeling als de coach. Alleen tekst, geen planaanpassing.
export async function healthStatus(ctx) {
  const { ai } = ctx.settings || {};
  if (!ai || ai.provider === 'none') throw new Error(ai?.apiKey ? tr('ai.deAiCoachStaat') : tr('ai.geenAiProviderIngesteld'));
  if (ai.provider === 'anthropic' && !ai.apiKey) throw new Error(tr('ai.geenClaudeApiKey'));
  const data = healthPayload(ctx);
  if (!data.measures.length && !data.watch.length && !data.sessions.length) throw new Error(tr('app.health.noData'));
  const l = userLang();
  const lang = new Intl.DisplayNames(['nl'], { type: 'language' }).of(l) + ` (${l})`;
  const user = JSON.stringify(data);
  const system = HEALTH_SYSTEM.replace('{LANG}', lang);
  const ask = async (maxTokens) => (ai.provider === 'anthropic' ? anthropicParts(await postAnthropic(ai, system, user, maxTokens)) : openAIParts(await postOpenAI(ai, system, user, maxTokens)));
  let reply = await ask(8000);
  let body = statusText(reply.text) || statusText(reply.think);
  // denkmodel dat de hele ruimte opmaakte aan redeneren: één keer extra ruimte
  if (!body && (reply.stop === 'max_tokens' || reply.stop === 'length')) {
    reply = await ask(16000);
    body = statusText(reply.text) || statusText(reply.think);
  }
  if (!body) throw new Error(tr('app.health.emptyAnswer', { why: reply.stop ? ` (${reply.stop})` : '' }));
  return { text: body.slice(0, 12000), from: data.from, to: data.to, provider: ai.provider, model: ai.model || '', at: new Date().toISOString() };
}
