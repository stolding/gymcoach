// AI-coach: Claude API of een OpenAI-compatibele server (llama.cpp / Ollama).
import { tr, userLang } from './lang.js';
import { PATTERNS, progress } from './engine.js';
// De AI doet alleen voorstellen; de regels-engine houdt gewicht en herhalingen.

const SYSTEM = `Je bent een nuchtere krachttrainingscoach voor iemand die op een Speediance Gym Monster traint (ervaring: settings.experience).
Je loopt het plan van de komende week na. Je herschrijft het niet zelf. Vergelijk het plan met recentWeeks (wat er gepland was en wat er gehaald is), met weekly (de trend in trainingen, minuten en volume) en met recovery.
Sommige dagen kunnen een cardio-circuit of cardio buiten zijn (dayType); pas die niet aan naar zware kracht.
Geef kort advies in deze taal: {LANG}. Ook de reason-teksten in die taal.
Je mag alleen dit voorstellen:
- swapToId: een andere oefening uit allowedExercises, op dezelfde plek. Voor een dubbele oefening (fit.repeats) ruil je er één.
- drop: true, alleen als de training te lang is (fit.sessions over). Laat minstens één oefening staan. Voeg nooit een oefening toe; een korte training noem je alleen in het advies.
- moveTo: de sessiesleutel van een andere krachtdag, als dezelfde spiergroep te dicht op elkaar zit of de week scheef is (fit.muscles).
- part "cable", "mobility" of "cooldown", samen met exerciseId van het huidige onderdeel en swapToId uit warmChoices van dat onderdeel.
Regels:
- Stuur nooit sets, reps of weight. Gewicht en herhalingen blijven van de app.
- Blijf binnen de gegeven ids. Verzin geen ids.
- Houd rekening met de notities over blessures en voorkeuren, en met de wens voor deze week (weekWish).
- Houd rekening met geslacht en leeftijd (person), maar volg de eigen data als die iets anders laat zien: verschillen tussen mensen zijn groter dan tussen man en vrouw.
  Vrouwen herstellen tussen sets meestal sneller en verdragen vaak iets meer volume; relatieve spiergroei is gelijk. Vanaf ~50 jaar kan herstel langer duren.
- Herstel (recovery): state good/watch/easy uit rusthartslag, HRV, gehaalde herhalingen en vertraging binnen sets.
  Bij watch of easy: de week niet voller maken. Bij easy liever een oefening weg (drop) dan extra werk. Bij weightLoss.warn of intake.below: niet inkorten.
- Leg nooit een voorkeur op op basis van geslacht; volg de focus en de wens van de gebruiker.
- Eigen trainingen (custom, locked of edited): alleen een ruil, en alleen met een duidelijke reden. Geen drop en geen moveTo. Binnen een superset (zelfde group) een oefening die ermee te combineren is.
- Staat er onlySession, geef dan alleen aanpassingen voor die sessie. Geen moveTo.
- Elk voorstel is een object. Zet een komma tussen de voorstellen. Gebruik null of laat het veld weg. Schrijf nooit 3|null.
- weekday is de weekdag van die training, 0 is maandag. hour is het uur waarop die training begint. De uren daartussen bepalen het herstel.
Antwoord ALLEEN met JSON in deze vorm:
{"advice":"short","adjustments":[{"session":"A","exerciseId":123,"swapToId":null,"drop":null,"moveTo":null,"part":null,"reason":"short"}]}`;

// Wat de coach mag nalopen: lengte tegen de tijd, dubbele oefeningen, spierbalans, warming-up en cooldown.
function sessionFit(plan, minutes) {
  const budget = Number(minutes) || 45;
  const seen = new Map();
  const repeats = [];
  for (const s of plan?.sessions || []) {
    for (const e of s.exercises || []) {
      const id = Number(e.id);
      if (!id) continue;
      if (seen.has(id)) repeats.push({ id, title: e.title, sessions: [seen.get(id), s.key] });
      else seen.set(id, s.key);
    }
  }
  return {
    budgetMin: budget,
    sessions: (plan?.sessions || []).filter((s) => !s.outdoor && s.type !== 'buiten').map((s) => ({
      session: s.key,
      minutes: s.estMinutes ?? null,
      over: (s.estMinutes || 0) > budget + 5,
      exercises: (s.exercises || []).length,
      warmup: {
        cable: (s.warmup?.cable || []).map((x) => ({ id: x.id, title: x.title })),
        mobility: (s.warmup?.mobility || []).map((x) => ({ id: x.id, title: x.title })),
      },
      cooldown: (s.cooldown || []).map((x) => ({ id: x.id, title: x.title })),
    })),
    repeats: repeats.slice(0, 8),
    muscles: plan?.muscles || {},
  };
}

// Bouwt de compacte context voor de AI: instellingen, persoon, recente historie, gewicht, cardio en het plan van de komende week.
function compactContext({ settings, plan, history, bodyLog, weekly, allowed, activities = [], onlySession = null, signals = null, recentWeeks = [], warmChoices = null }) {
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
    review: 'upcoming-week',
    weekWish: { focus: plan.focus || [], text: plan.wish || '' },
    bodyweight: bodyLog.slice(-12),
    weekly: (weekly || []).slice(-6),
    recentWeeks: (recentWeeks || []).slice(0, 4),
    fit: sessionFit(plan, settings.minutesPerSession),
    ...(warmChoices && { warmChoices }),
    ...(signals?.recovery && { recovery: { state: signals.recovery.state, signals: signals.recovery.signals.map(({ key, recent, base, level }) => ({ key, recent, base, level })) } }),
    ...(signals?.weightLoss && { weightLoss: signals.weightLoss }),
    ...(signals?.intake && { intake: signals.intake }),
    cardioLast14Days: activities.filter((a) => a.date >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)).map((a) => ({ d: a.date, type: a.type, min: a.minutes, km: a.km })),
    history: recent,
    plan: plan.sessions.map((s) => ({
      session: s.key, name: s.name, dayType: s.type || plan.goal, ...(Number.isInteger(s.weekday) ? { weekday: s.weekday } : {}), ...(Number.isInteger(s.slot) ? { hour: [6, 9, 12, 15, 18, 21][s.slot] } : {}),
      ...(s.custom && { custom: true }), ...(s.locked && { locked: true }), ...(s.edited && { edited: true }),
      exercises: (s.exercises || []).map((e) => ({
        id: e.id, title: e.title, pattern: e.pattern, sets: (e.sets || []).length, reps: e.sets?.[0]?.reps, weight: e.sets?.[0]?.weight, note: e.note,
        ...(e.group && { group: e.group }), ...(e.fixed && { fixed: true }),
        // eigen opbouw per set (alleen als de sets verschillen): herhalingen x gewicht, modus, rust
        ...((e.sets || []).some((x) => x.reps !== e.sets?.[0]?.reps || x.weight !== e.sets?.[0]?.weight || (x.mode || 1) !== 1) && { setList: (e.sets || []).map((x) => `${x.reps}x${x.weight}${(x.mode || 1) !== 1 ? ' m' + x.mode : ''} r${x.rest}`) }),
      })),
    })),
    ...(onlySession && { onlySession }),
    allowedExercises: allowed,
  };
}

// Vraagt de Claude API (Messages) om een antwoord; geeft het ruwe bericht terug.
async function postAnthropic(ai, system, user, maxTokens = 2000, extra = null) {
  const payload = { model: ai.model || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
  if (extra) Object.assign(payload, extra);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
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
async function postOpenAI(ai, system, user, maxTokens = 2000, extra = null) {
  const base = (ai.baseUrl || 'http://localhost:8080/v1').replace(/\/$/, '');
  const headers = { 'content-type': 'application/json' };
  if (ai.apiKey) headers.authorization = `Bearer ${ai.apiKey}`;
  const payload = { model: ai.model || 'local', temperature: 0.3, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  if (extra) Object.assign(payload, extra);
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify(payload),
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

// Het model kopieert soms het schema (3|null) of vergeet een komma tussen twee voorstellen.
function repairModelJson(s) {
  return s
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/([}\]])\s*(?=[{\[])/g, '$1,')
    .replace(/(\d+(?:\.\d+)?)\s*\|\s*null\b/g, '$1')
    .replace(/\bnull\s*\|\s*(\d+(?:\.\d+)?)/g, '$1')
    .replace(/("(?:\\.|[^"\\])*")\s*\|\s*null\b/g, '$1');
}

const COACH_SCHEMA = {
  type: 'object',
  properties: {
    advice: { type: 'string' },
    adjustments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          session: { type: 'string' },
          exerciseId: { type: 'number' },
          swapToId: { type: 'number' },
          drop: { type: 'boolean' },
          moveTo: { type: 'string' },
          part: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['session', 'exerciseId'],
      },
    },
  },
  required: ['advice', 'adjustments'],
};

// Tekst zonder JSON-blok telt als advies, zonder aanpassingen.
function adviceFromProse(raw) {
  let s = String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = s.indexOf('<think>');
  if (open >= 0) s = s.slice(0, open);
  s = s.replace(/^\s*```(?:json|markdown|md)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  if (s.length < 40 || s.includes('"adjustments"')) return null;
  return { advice: s.slice(0, 2000), adjustments: [] };
}

// Formulierantwoord, anders de zichtbare tekst, anders het denkblok. Losse tekst blijft advies.
export function readCoachReply({ text = '', think = '', tool = null } = {}) {
  const asObj = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && (v.advice != null || v.adjustments != null)) {
      if (v.adjustments != null && !Array.isArray(v.adjustments)) v.adjustments = [v.adjustments];
      return v;
    }
    return null;
  };
  const direct = asObj(tool);
  if (direct) return direct;
  if (typeof tool === 'string' && tool.includes('{')) {
    try { return extractJson(tool); } catch { /* val terug op de tekst */ }
  }
  try { return extractJson(text); }
  catch {
    try { return extractJson(think || text); }
    catch (e) {
      const prose = adviceFromProse(text) || adviceFromProse(think);
      if (prose) return prose;
      const sample = String(text || think || tool || '').replace(/\s+/g, ' ').slice(0, 400);
      if (sample) console.error('coach json:', sample);
      throw e;
    }
  }
}

// Het formulier dwingt geldige velden af. Lukt dat niet, dan lezen we de tekst alsnog.
async function askCoach(ai, system, user) {
  const description = 'Review next week. Catalog swaps and session fit only. No weights or reps.';
  const anthropic = ai.provider === 'anthropic';
  const call = async (tokens, tools) => {
    if (anthropic) {
      const extra = tools ? { tools: [{ name: 'coach_advice', description, input_schema: COACH_SCHEMA }], tool_choice: { type: 'tool', name: 'coach_advice' } } : null;
      let j;
      try { j = await postAnthropic(ai, system, user, tokens, extra); }
      catch (e) { if (!tools) throw e; j = await postAnthropic(ai, system, user, tokens); }
      const parts = anthropicParts(j);
      const tool = (Array.isArray(j?.content) ? j.content : []).find((c) => c?.type === 'tool_use' && c.name === 'coach_advice');
      return { ...parts, tool: tool?.input };
    }
    const extra = tools ? { tools: [{ type: 'function', function: { name: 'coach_advice', description, parameters: COACH_SCHEMA } }], tool_choice: { type: 'function', function: { name: 'coach_advice' } } } : null;
    let j;
    try { j = await postOpenAI(ai, system, user, tokens, extra); }
    catch (e) { if (!tools) throw e; j = await postOpenAI(ai, system, user, tokens); }
    const parts = openAIParts(j);
    const fn = j?.choices?.[0]?.message?.tool_calls?.[0]?.function;
    return { ...parts, tool: fn?.name === 'coach_advice' ? fn.arguments : null };
  };
  let reply = await call(4000, true);
  try { return readCoachReply(reply); }
  catch (e) {
    if (reply.stop === 'max_tokens' || reply.stop === 'length' || !(reply.text || reply.tool)) {
      reply = await call(8000, true);
      try { return readCoachReply(reply); }
      catch (again) { e = again; }
    }
    throw e;
  }
}

// Haalt het JSON-object uit het antwoord van het model (ook als er tekst of <think>-blokken omheen staan).
function matchBrace(s, start) {
  let depth = 0;
  let quote = '';
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

export function extractJson(text) {
  const cleaned = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const slices = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== '{') continue;
    const end = matchBrace(cleaned, i);
    if (end > i) { slices.push(cleaned.slice(i, end + 1)); i = end; }
  }
  slices.sort((a, b) => (b.includes('"advice"') - a.includes('"advice"')) || (b.length - a.length));
  for (const slice of slices) {
    try { return JSON.parse(slice); }
    catch { try { return JSON.parse(repairModelJson(slice)); } catch { /* volgend blok */ } }
  }
  throw new Error(tr('ai.aiGafGeenJson'));
}

function warmList(session, part) {
  if (part === 'cable') return session.warmup?.cable;
  if (part === 'mobility') return session.warmup?.mobility;
  if (part === 'cooldown') return session.cooldown;
  return null;
}

// Controleert de voorstellen. Gewicht, herhalingen en aantal sets gaan eruit.
// onlySession: alleen die training, en geen verplaatsing naar een andere dag.
export function validateAdjustments(raw, plan, allowedIds, onlySession = null, _history = null, extra = {}) {
  const names = extra.names instanceof Map ? extra.names : new Map();
  const catalogIds = extra.catalogIds instanceof Set ? extra.catalogIds : allowedIds;
  const titleOf = (id, fallback) => names.get(Number(id)) || fallback || '';
  const out = [];
  const sessions = plan?.sessions || [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const session = sessions.find((s) => s.key === a.session);
    if (!session) continue;
    if (onlySession && session.key !== onlySession) continue;
    const own = !!(session.custom || session.locked || session.edited);
    const reason = String(a.reason || '').slice(0, 200);
    const part = ['cable', 'mobility', 'cooldown'].includes(a.part) ? a.part : null;
    if (part) {
      const list = warmList(session, part) || [];
      const item = list.find((x) => Number(x.id) === Number(a.exerciseId));
      const to = Number(a.swapToId);
      if (!item || !catalogIds.has(to) || to === Number(item.id) || list.some((x) => Number(x.id) === to)) continue;
      out.push({
        kind: part === 'cooldown' ? 'cooldown' : 'warmup', part,
        session: session.key, sessionName: session.name, own,
        exerciseId: Number(item.id), title: item.title || titleOf(item.id),
        swapToId: to, swapTitle: titleOf(to), reason,
      });
      continue;
    }
    const ex = (session.exercises || []).find((e) => Number(e.id) === Number(a.exerciseId));
    if (!ex) continue;
    const base = { session: session.key, sessionName: session.name, own, exerciseId: ex.id, title: ex.title, reason };
    const to = Number(a.swapToId);
    if (to && allowedIds.has(to) && to !== Number(ex.id)) {
      out.push({ ...base, kind: 'swap', swapToId: to, swapTitle: titleOf(to) });
      continue;
    }
    const dest = a.moveTo ? sessions.find((s) => s.key === a.moveTo) : null;
    if (dest && dest.key !== session.key && !onlySession && !own && !dest.outdoor && dest.type !== 'buiten' && !dest.custom && !dest.locked && !dest.edited && !(dest.exercises || []).some((e) => Number(e.id) === Number(ex.id))) {
      out.push({ ...base, kind: 'move', moveTo: dest.key, moveToName: dest.name });
      continue;
    }
    if ((a.drop === true || a.drop === 'true') && !own && (session.exercises || []).length > 1) out.push({ ...base, kind: 'drop', drop: true });
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
  const parsed = await askCoach(ai, system, user);
  const allowedIds = new Set(ctx.allowed.map((a) => Number(a.id)));
  const names = new Map((ctx.catalog || []).map((e) => [Number(e.id), e.name]));
  for (const a of ctx.allowed) if (!names.has(Number(a.id))) names.set(Number(a.id), a.name);
  const catalogIds = new Set((ctx.catalog || ctx.allowed).map((e) => Number(e.id)));
  const sessionName = only ? ctx.plan.sessions.find((s) => s.key === only).name : null;
  return { advice: String(parsed.advice || '').slice(0, 2000), adjustments: validateAdjustments(parsed.adjustments, ctx.plan, allowedIds, only, null, { names, catalogIds }), provider: ai.provider, model: ai.model, ...(only && { session: only, sessionName }) };
}

function patternOf(id, fallback) {
  for (const [key, p] of Object.entries(PATTERNS)) if (p.ids.includes(Number(id))) return { key, ...p };
  return { key: fallback?.pattern, type: fallback?.type || 'isolation', start: fallback?.sets?.[0]?.weight || 8 };
}

function markPushed(session) {
  if (session?.pushedAt) { session.changedAfterPush = true; delete session.pushedAt; }
}

// Gewicht en herhalingen van een geruilde oefening komen uit de progressieregels, niet uit het voorstel.
function prescribe(exercise, history) {
  const pattern = patternOf(exercise.id, exercise);
  const rx = { lo: exercise.repRange?.[0] ?? 8, hi: exercise.repRange?.[1] ?? 12 };
  const p = progress(history?.[String(exercise.id)]?.log, rx, pattern);
  exercise.sets = (exercise.sets || []).map((x) => ({ ...x, reps: p.reps, weight: p.weight }));
  exercise.note = p.note;
  exercise.basis = p.basis;
  if (pattern.key) exercise.pattern = pattern.key;
  if (pattern.type) exercise.type = pattern.type;
}

// Past de gekozen voorstellen toe. Ruilen krijgt het voorschrift van de app. Verplaatsen en schrappen houden de sets.
export function applyAdjustments(plan, adjustments, libById, ctx = {}) {
  const history = ctx.history || null;
  for (const a of adjustments || []) {
    const s = plan.sessions.find((x) => x.key === a.session);
    if (!s) continue;
    if (a.kind === 'warmup' || a.kind === 'cooldown') {
      const list = warmList(s, a.part) || [];
      const item = list.find((x) => Number(x.id) === Number(a.exerciseId));
      const lib = libById.get(Number(a.swapToId));
      if (!item || !lib) continue;
      item.id = Number(lib.id);
      item.title = lib.name;
      markPushed(s);
      continue;
    }
    if (a.kind === 'drop') {
      const before = (s.exercises || []).length;
      if (before < 2) continue;
      s.exercises = s.exercises.filter((e) => Number(e.id) !== Number(a.exerciseId));
      if (s.exercises.length < before && s.estMinutes) s.estMinutes = Math.max(8, Math.round(s.estMinutes * s.exercises.length / before));
      markPushed(s);
      continue;
    }
    if (a.kind === 'move') {
      const dest = plan.sessions.find((x) => x.key === a.moveTo);
      const idx = (s.exercises || []).findIndex((e) => Number(e.id) === Number(a.exerciseId));
      if (!dest || idx < 0 || dest.key === s.key) continue;
      const [ex] = s.exercises.splice(idx, 1);
      dest.exercises = [...(dest.exercises || []), ex];
      if (s.estMinutes) s.estMinutes = Math.max(8, Math.round(s.estMinutes * s.exercises.length / (s.exercises.length + 1)));
      markPushed(s);
      markPushed(dest);
      continue;
    }
    const e = (s.exercises || []).find((x) => Number(x.id) === Number(a.exerciseId));
    const lib = a.swapToId ? libById.get(Number(a.swapToId)) : null;
    if (!e || !lib) continue;
    Object.assign(e, { id: lib.id, title: lib.name, muscle: lib.muscle, basis: null });
    prescribe(e, history);
    if (s.custom || s.locked || s.edited) s.edited = true;
    markPushed(s);
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
Zet het antwoord direct neer. Geen denkblok en geen <think>-tekst. Maak elke zin af; stop niet midden in een woord.`;

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

// Het model stopte midden in de tekst (tokenlimiet), niet aan het eind van een zin of tabel.
export function statusCutOff(text) {
  const s = String(text || '').trimEnd();
  if (!s) return true;
  return !/[.!?…][)\]"']?\s*$/.test(s) && !/\|\s*$/.test(s);
}

// Haalt een afgekapte staart weg, tot de laatste afgeronde zin. Een punt in 4.0 blijft staan.
export function finishStatus(text) {
  const s = String(text || '').replace(/\s+$/, '');
  if (!s || !statusCutOff(s)) return s;
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (ch === '!' || ch === '?' || ch === '…') return s.slice(0, i + 1).trimEnd();
    if (ch === '.') {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';
      if (!(/\d/.test(prev) && /\d/.test(next))) return s.slice(0, i + 1).trimEnd();
    }
  }
  return s;
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
  const read = (reply) => {
    const raw = statusText(reply.text) || statusText(reply.think);
    const cut = reply.stop === 'max_tokens' || reply.stop === 'length';
    return { raw, body: cut ? finishStatus(raw) : raw, cut };
  };
  let reply = await ask(16000);
  let got = read(reply);
  // Denkmodellen vullen de tokenlimiet en knippen de laatste zin. Eén keer extra ruimte.
  if (got.cut) {
    try {
      const again = read(await ask(32000));
      if ((again.raw || '').length >= (got.raw || '').length) got = again;
    } catch { /* de hogere limiet weigerde; het eerste antwoord blijft */ }
  }
  if (!got.body) throw new Error(tr('app.health.emptyAnswer', { why: reply.stop ? ` (${reply.stop})` : '' }));
  let text = got.body;
  if (text.length > 12000) text = finishStatus(text.slice(0, 12000));
  return { text, from: data.from, to: data.to, provider: ai.provider, model: ai.model || '', at: new Date().toISOString() };
}
