// AI-coach: Claude API of een OpenAI-compatibele server (llama.cpp / Ollama).
// De AI doet alleen voorstellen; de regels-engine blijft de basis en alles wordt gevalideerd.

const SYSTEM = `Je bent een nuchtere krachttrainingscoach voor iemand die op een Speediance Gym Monster traint (ervaring: settings.experience).
Je krijgt instellingen, recente trainingshistorie, lichaamsgewicht, recente cardio-activiteiten (wandelen/fietsen uit Apple Health) en een voorgesteld weekplan van een regels-engine.
Sommige dagen kunnen een cardio-circuit of cardio buiten zijn (dayType); pas die niet aan naar zware kracht.
Geef kort advies in het Nederlands en stel waar nodig concrete aanpassingen voor.
Regels:
- Blijf binnen de toegestane oefening-id's (allowedExercises). Verzin geen id's.
- Wijzig gewicht hooguit 15% ten opzichte van het voorstel, sets 2-5, herhalingen 5-20.
- Houd rekening met de notities over blessures en voorkeuren, en met de wens voor deze week (weekWish).
- Houd rekening met geslacht en leeftijd (person), maar volg de eigen data als die iets anders laat zien: verschillen tussen mensen zijn groter dan tussen man en vrouw.
  Vrouwen herstellen tussen sets meestal sneller en verdragen vaak iets meer volume; relatieve spiergroei is gelijk. Vanaf ~50 jaar: krachttraining is extra belangrijk voor botten en spiermassa, herstel kan langer duren.
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
function compactContext({ settings, plan, history, bodyLog, weekly, allowed, activities = [], onlySession = null }) {
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

// Vraagt de Claude API (Messages) om een antwoord; geeft de tekst terug.
async function callAnthropic(ai, system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ai.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ai.model || 'claude-sonnet-5-5', max_tokens: 2000, system, messages: [{ role: 'user', content: user }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Claude API: ${j?.error?.message || r.status}`);
  return j.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? '';
}

// Vraagt een OpenAI-compatibele server (llama.cpp, Ollama) om een antwoord; geeft de tekst terug.
async function callOpenAI(ai, system, user) {
  const base = (ai.baseUrl || 'http://localhost:8080/v1').replace(/\/$/, '');
  const headers = { 'content-type': 'application/json' };
  if (ai.apiKey) headers.authorization = `Bearer ${ai.apiKey}`;
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: ai.model || 'local', temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Lokale LLM: ${j?.error?.message || r.status}`);
  return j.choices?.[0]?.message?.content ?? '';
}

// Haalt het JSON-object uit het antwoord van het model (ook als er tekst of <think>-blokken omheen staan).
function extractJson(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI gaf geen JSON terug');
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
  if (!ai || ai.provider === 'none') throw new Error(ai?.apiKey ? 'De AI-coach staat nog uit: kies bij Instellingen → AI-coach de provider "Claude API" en sla op.' : 'Geen AI-provider ingesteld (Instellingen → AI-coach)');
  if (ai.provider === 'anthropic' && !ai.apiKey) throw new Error('Geen Claude API-key ingesteld');
  const only = ctx.onlySession && ctx.plan.sessions.some((s) => s.key === ctx.onlySession) ? ctx.onlySession : null;
  const user = 'Context:\n' + JSON.stringify(compactContext({ ...ctx, onlySession: only }));
  const text = ai.provider === 'anthropic' ? await callAnthropic(ai, SYSTEM, user) : await callOpenAI(ai, SYSTEM, user);
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
