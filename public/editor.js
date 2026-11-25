// Trainingseditor: een training uit het plan aanpassen (warming-up, oefeningen, sets, modi, cooldown),
// met live het anatomische figuur, de kerncijfers en de sets per spiergroep voor de hele week.
// Wijzigingen gebeuren op een kopie (concept) en worden pas bewaard bij Opslaan.
import { bodyMap, MUSCLE_LABELS } from './bodymap.js';
import { t, localeOf, doseText } from './i18n.js';
import { askConfirm, askText } from './dialogs.js';
import { ensureWarmItem, isTimedItem, sideOf, syncWarmItem, warmRows } from './warmedit.js';

const MODES = [1, 2, 3, 4, 5];
const PUSH = new Set(['hpush', 'vpush', 'tri']), PULL = new Set(['hpull', 'vpull', 'rear', 'curl']);
const BIG = ['pecs', 'lats', 'quads', 'hamstrings', 'glutes']; // grote spiergroepen: waarschuwen bij te weinig sets
const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (v, d = 0) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
const half = (x) => Math.max(0, Math.round(x * 2) / 2);
const nlNum = (v) => Number(v).toLocaleString(localeOf(), { maximumFractionDigits: 2 });

// Sets per spiergroep in een training: hoofdspier telt 1, meewerkend 0,5 (zoals de engine).
export function sessionMuscleSets(s) {
  const out = {};
  for (const e of s.exercises || []) for (const [k, w] of Object.entries(e.muscles || {})) out[k] = (out[k] || 0) + w * (e.sets?.length || 0);
  return out;
}
// Supersets: groepen moeten aaneengesloten zijn en minstens 2 oefeningen hebben; anders wordt de groep opgeheven.
export function normalizeGroups(exs) {
  const seen = new Set();
  for (let i = 0; i < exs.length; i++) {
    const g = exs[i].group; if (!g) continue;
    if (seen.has(g) && exs[i - 1]?.group !== g) delete exs[i].group; // losgeraakt deel
    else seen.add(g);
  }
  for (const g of seen) if (exs.filter((e) => e.group === g).length < 2) for (const e of exs) if (e.group === g) delete e.group;
  // letters opnieuw toekennen in volgorde: A, B, C …
  const map = new Map(); let n = 0;
  for (const e of exs) if (e.group) { if (!map.has(e.group)) map.set(e.group, String.fromCharCode(65 + n++)); e.group = map.get(e.group); }
  return exs;
}
// Rust die echt telt: binnen een superset alleen na de laatste oefening van de ronde.
const lastInGroup = (exs, i) => !exs[i].group || exs[i + 1]?.group !== exs[i].group;
// Geschatte duur in minuten (zelfde rekenregel als de engine: 4 s per herhaling + rust + 1 min wisselen per oefening).
function estMinutes(s) {
  let sec = 0;
  for (const [i, e] of (s.exercises || []).entries()) {
    const last = lastInGroup(s.exercises, i);
    sec += (e.group && i > 0 && s.exercises[i - 1].group === e.group ? 15 : 60) + e.sets.reduce((tt, x) => tt + x.reps * 4 + (last ? x.rest : 5), 0);
    if (e.rampUp) sec += 8 * 4 + 45;
  }
  const warm = warmRows(s.warmup).length ? 6 : 0;
  const cool = s.cooldown?.length ? 4 : 0;
  return Math.round(sec / 60) + warm + cool;
}
// Laatste lichaamsgewicht (kg) uit het logboek.
function bodyKg(state) {
  const log = state?.bodyLog || [];
  for (let i = log.length - 1; i >= 0; i--) if (log[i].kg > 0) return log[i].kg;
  return null;
}
// Geschat verbruik. Krachtcircuit is ongeveer 8 MET: kcal = 8 × kg × uren.
// Bij ~75 kg is dat 10 kcal per minuut, in de buurt van de schatting op de Gym Monster.
function estKcal(minutes, kg) {
  if (!(kg > 0) || !(minutes > 0)) return null;
  return Math.round(8 * kg * (minutes / 60));
}
let dlg = null;

// Opent de editor voor de training met deze sleutel.
// ctx: { state, api, esc, toast, onSaved(plan) }
// Sjabloon bewerken: ctx.template = { session, onSave(draft) } (dan zonder slot, ongedaan maken blijft).
export function openEditor(key, ctx) {
  const { state, esc } = ctx;
  const plan = state.plan || { sessions: [] };
  const tpl = ctx.template || null;
  const idx = tpl ? -1 : plan.sessions.findIndex((s) => s.key === key);
  if (!tpl && idx < 0) return;
  const saved = tpl ? { key: '__tpl', warmup: { mobility: [], cable: [] }, cooldown: [], ...clone(tpl.session) } : plan.sessions[idx];
  const original = saved.original ? clone(saved.original) : (() => { const o = clone(saved); delete o.original; return o; })();
  let draft = clone(saved); delete draft.original;
  let warmTry = 1;
  if (draft.locked == null && !tpl) draft.locked = true; // bewerken = standaard vastzetten
  const prepareWarm = (s) => {
    s.warmup = s.warmup || { mobility: [], cable: [] };
    s.warmup.mobility = s.warmup.mobility || [];
    s.warmup.cable = s.warmup.cable || [];
    s.cooldown = s.cooldown || [];
    for (const x of s.warmup.mobility) ensureWarmItem(x, 'mobility');
    for (const x of s.warmup.cable) ensureWarmItem(x, 'cable');
    for (const x of s.cooldown) ensureWarmItem(x, x.weighted ? 'cable' : 'cool');
  };
  prepareWarm(draft); prepareWarm(original);
  const undo = [];
  let changes = 0, selMuscle = null;
  let openRef = { list: 'ex', kind: '', i: 0 };

  if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'editor-dlg'; document.body.appendChild(dlg); }

  const snapshot = () => { undo.push(JSON.stringify(draft)); if (undo.length > 50) undo.shift(); changes++; };

  // ---------- rechterkolom: figuur, kerncijfers, week ----------
  function sidePanel() {
    const sc = sessionMuscleSets(draft);
    const week = {};
    for (const s of plan.sessions) {
      const m = s.key === draft.key ? sc : (s.muscles || sessionMuscleSets(s));
      for (const [k, v] of Object.entries(m)) week[k] = (week[k] || 0) + v;
    }
    if (tpl) for (const [k, v] of Object.entries(sc)) week[k] = (week[k] || 0) + v; // sjabloon: alsof hij erbij komt
    const min = estMinutes(draft), target = Number(state.settings?.minutesPerSession) || 45;
    const kg = bodyKg(state), kcal = estKcal(min, kg);
    const sets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
    const vf = state.volFactors || { byId: {}, def: 1 };
    const vol = draft.exercises.reduce((v, e) => v + (vf.byId[e.id] || vf.def) * e.sets.reduce((a, x) => a + x.reps * x.weight, 0), 0);
    let push = 0, pull = 0;
    for (const e of draft.exercises) { if (PUSH.has(e.pattern)) push += e.sets.length; if (PULL.has(e.pattern)) pull += e.sets.length; }
    const ratio = push && pull ? `1 : ${nlNum((pull / push).toFixed(1))}` : push ? '1 : 0' : pull ? '0 : 1' : '—';
    const warns = [];
    if (min > target + 2) warns.push(t('ed.warnLong', { over: min - target, min: target }));
    for (const k of BIG) if ((week[k] || 0) < 6) warns.push(t('ed.warnLow', { muscle: MUSCLE_LABELS[k], n: nlNum(Math.round((week[k] || 0) * 10) / 10) }));
    for (const [k, v] of Object.entries(week)) if (v > 20) warns.push(t('ed.warnHigh', { muscle: MUSCLE_LABELS[k] || k, n: nlNum(Math.round(v * 10) / 10) }));
    if (push >= 6 && pull * 2 < push) warns.push(t('ed.warnPull'));
    const rows = Object.entries(week).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = Math.max(20, ...rows.map(([, v]) => v));
    const tile = (label, value, sub, warn) => `<div class="ed-kpi${warn ? ' warn' : ''}"><div class="eyebrow">${label}</div><div class="ed-kv">${value}</div><div class="muted small">${sub}</div></div>`;
    return `
      <div class="card ed-fig"><div class="eyebrow">${t('ed.impact')}</div>
        ${bodyMap(sc, { height: 280, title: t('ed.impact'), selected: selMuscle })}
        <div class="muted small">${t('ed.clickMuscle')}</div></div>
      <div class="ed-kpis">
        ${tile(t('ed.duration'), `~${min} min`, t('ed.durationSub', { min: target }), min > target + 2)}
        ${tile(t('ed.sets'), sets, t('ed.setsSub', { n: draft.exercises.length }))}
        ${tile(t('ed.volume'), `${Math.round(vol).toLocaleString(localeOf())} kg`, t('ed.volumeSub'))}
        ${tile(t('ed.kcal'), kcal != null ? `~${Math.round(kcal).toLocaleString(localeOf())} kcal` : '—', kcal != null ? t('ed.kcalSub', { kg: nlNum(Math.round(kg * 10) / 10) }) : t('ed.kcalNone'))}
        ${tile(t('ed.pushPull'), ratio, t('ed.pushPullSub'), push >= 6 && pull * 2 < push)}
      </div>
      <div class="card ed-week"><div class="row between"><span class="eyebrow" style="margin:0">${t('ed.week')}</span><span class="muted small">${t('ed.weekHint')}</span></div>
        <div class="ed-bars">${rows.map(([k, v]) => {
          const mine = sc[k] || 0, warn = v < 6 && BIG.includes(k) || v > 20;
          return `<button type="button" class="ed-bar${warn ? ' warn' : ''}${selMuscle === k ? ' sel' : ''}" data-ed="muscle" data-m="${k}"><span>${esc(MUSCLE_LABELS[k] || k)}</span>
            <span class="ed-track"><i style="width:${(mine / max) * 100}%" class="mine"></i><i style="width:${((v - mine) / max) * 100}%"></i></span>
            <b>${nlNum(Math.round(v * 10) / 10)}${mine ? ` <small>+${nlNum(Math.round(mine * 10) / 10)}</small>` : ''}</b></button>`;
        }).join('')}</div>
        <div class="muted small">${t('ed.weekNorm')}</div></div>
      ${warns.length ? `<div class="ed-warns">${warns.map((w) => `<div>• ${esc(w)}</div>`).join('')}</div>` : ''}`;
  }

  // ---------- warming-up, oefeningen en cooldown: dezelfde kaart ----------
  const isOpen = (spec, i) => openRef.list === spec.list && (openRef.kind || '') === (spec.kind || '') && openRef.i === i;
  const attr = (spec, i, extra = '') => `data-list="${spec.list}" data-kind="${spec.kind || ''}" data-i="${i}"${extra}`;
  function warmView() {
    const rows = warmRows(draft.warmup);
    return { rows, items: rows.map((r) => r.x) };
  }
  function commitWarm(rows) {
    const mobility = [], cable = [];
    rows.forEach((r, n) => { r.x.seq = n; (r.kind === 'cable' ? cable : mobility).push(r.x); });
    draft.warmup.mobility = mobility;
    draft.warmup.cable = cable;
  }
  function moveRows(rows, i, d) {
    const j = i + d;
    if (j < 0 || j >= rows.length) return i;
    const e = rows[i].x, other = rows[j].x;
    if (other.group && other.group !== e.group) {
      let k = j;
      while (rows[k + d]?.x.group === other.group) k += d;
      const [row] = rows.splice(i, 1);
      rows.splice(k, 0, row);
      return k;
    }
    [rows[i], rows[j]] = [rows[j], rows[i]];
    return j;
  }
  function warmBlock() {
    const { rows, items } = warmView();
    const min = items.length ? 6 : 0;
    const specAt = (i) => ({ list: 'warm', kind: rows[i].kind, items, timed: isTimedItem(items[i], rows[i].kind) });
    return `<section class="card ed-block"><div class="row between wrap gap"><div><b>${t('ed.warmup')}</b> <span class="muted small">${t('ed.blockSum', { n: items.length, min })}</span></div>
      <div class="row gap">${draft.outdoor ? '' : `<button type="button" class="btn ghost small" data-ed="regen-warm" title="${esc(t('ed.regenHint'))}">${t('ed.regen')}</button>`}${!items.length && (original.warmup?.mobility?.length || original.warmup?.cable?.length) ? `<button type="button" class="btn ghost small" data-ed="restore-warm">${t('ed.restoreBlock')}</button>` : ''}<button type="button" class="btn ghost small" data-ed="add-warm">${t('ed.add')}</button></div></div>
      ${items.length ? groupedCards(items, specAt) : `<div class="muted small">${t('ed.empty')}</div>`}
    </section>`;
  }
  function coolBlock() {
    const items = draft.cooldown || [];
    const min = items.length ? 4 : 0;
    const specAt = (i) => ({ list: 'cool', kind: items[i].weighted ? 'cable' : 'cool', items, timed: isTimedItem(items[i], items[i].weighted ? 'cable' : 'cool') });
    return `<section class="card ed-block"><div class="row between wrap gap"><div><b>${t('ed.cooldown')}</b> <span class="muted small">${t('ed.blockSum', { n: items.length, min })}</span></div>
      <div class="row gap">${draft.outdoor ? '' : `<button type="button" class="btn ghost small" data-ed="regen-cool" title="${esc(t('ed.regenHint'))}">${t('ed.regen')}</button>`}${!items.length && original.cooldown?.length ? `<button type="button" class="btn ghost small" data-ed="restore-cool">${t('ed.restoreBlock')}</button>` : ''}<button type="button" class="btn ghost small" data-ed="add-cool">${t('ed.add')}</button></div></div>
      ${items.length ? groupedCards(items, specAt) : `<div class="muted small">${t('ed.empty')}</div>`}
    </section>`;
  }

  function exCard(e, i, spec) {
    const items = spec.items, n = items.length, timed = !!spec.timed, opened = isOpen(spec, i);
    const sec = Object.entries(e.muscles || {}).filter(([, w]) => w < 1).map(([k]) => MUSCLE_LABELS[k] || k);
    const prim = Object.entries(e.muscles || {}).filter(([, w]) => w >= 1).map(([k]) => MUSCLE_LABELS[k] || k).join(', ') || e.muscle || '';
    const side = timed ? doseText(sideOf(e.dose)) : '';
    const hl = selMuscle && e.muscles?.[selMuscle] ? ' hl' : '';
    const mark = attr(spec, i);
    const head = `<div class="ed-exh">
        <button type="button" class="ed-title" data-ed="open" ${mark} aria-expanded="${opened}"><b>${e.group ? `${e.group}${items.slice(0, i + 1).filter((x) => x.group === e.group).length} · ` : `${i + 1} · `}${esc(e.title)}</b>
          <span class="muted small">${esc(prim || side)}${sec.length ? ' · ' + esc(t('ed.secondary', { list: sec.join(', ') })) : ''}${e.type ? ' · ' + t(e.type === 'compound' ? 'ed.compound' : 'ed.isolation') : ''}${e.fixed ? ` · <span class="badge">${t('ed.fixed')}</span>` : ''}</span></button>
        <div class="ed-acts">
          <button type="button" class="btn ghost small" data-ed="move" ${mark} data-d="-1" aria-label="${t('ed.up')}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn ghost small" data-ed="move" ${mark} data-d="1" aria-label="${t('ed.down')}" ${i === n - 1 ? 'disabled' : ''}>↓</button>
          ${i < n - 1 && !(e.group && items[i + 1].group === e.group) ? `<button type="button" class="btn ghost small" data-ed="ss-link" ${mark} title="${t('ss.linkHint')}">${t('ss.link')}</button>` : ''}
          <button type="button" class="btn ghost small" data-ed="swap" ${mark}>${t('ed.swap')}</button>
          <button type="button" class="btn ghost small danger-text" data-ed="ex-del" ${mark}>${t('ed.remove')}</button>
        </div></div>`;
    const s0 = e.sets[0] || { reps: timed ? 30 : 10, weight: 0, rest: 60, mode: 1 };
    const sum = timed
      ? `${e.sets.length} × ${s0.reps} s · ${s0.rest} s`
      : `${e.sets.length} × ${s0.reps} · ${nlNum(s0.weight)} kg · ${s0.rest} s${e.sets.some((x) => (x.mode || 1) !== 1) ? ` · ${t('ed.mode')}: ${[...new Set(e.sets.map((x) => t('ed.mode' + (x.mode || 1))))].join('/')}` : ''}`;
    if (!opened) return `<div class="card ed-ex${hl}">${head}<div class="ed-sum muted">${sum}</div></div>`;
    const ramp = !timed && e.rampUp ? half((s0.weight || 0) / 2) : null;
    return `<div class="card ed-ex open${hl}">${head}
      <div class="ed-advice small"><span><b class="up">${t('ed.advice')}</b> ${esc(e.note || '—')}</span><span class="muted">${e.basis ? esc(t('ed.last', { basis: e.basis })) : t('ed.noHistory')}</span>
        ${timed ? '' : `<label class="inline-check ed-prog"><input type="checkbox" data-ed="prog" ${mark} ${e.fixed ? '' : 'checked'}> ${t('ed.progression')}</label>`}</div>
      <div class="ed-sets${timed ? ' timed' : ''}" role="table">
        <div class="ed-sr head" role="row"><span>${t('ed.set')}</span><span>${timed ? t('ed.secs') : t('ed.reps')}</span>${timed ? '' : `<span>${t('ed.kg')}</span>`}<span>${t('ed.rest')}</span><span>${t('ed.mode')}</span><span></span></div>
        ${ramp != null ? `<div class="ed-sr ramp" role="row"><span>${t('ed.warmSet')}</span><span>8</span><span>${nlNum(ramp)}</span><span>45</span><span>${t('ed.mode1')}</span><span></span></div>` : ''}
        ${e.sets.map((x, j) => `<div class="ed-sr" role="row"><span>${j + 1}</span>
          <input type="number" min="${timed ? 5 : 1}" max="${timed ? 180 : 30}" step="${timed ? 5 : 1}" value="${x.reps}" aria-label="${timed ? t('ed.secs') : t('ed.reps')} ${j + 1}" data-ed="set" ${mark} data-j="${j}" data-f="reps">
          ${timed ? '' : `<input type="number" min="${spec.list === 'ex' ? 0.5 : 0}" step="0.5" value="${x.weight}" aria-label="${t('ed.kg')} ${j + 1}" data-ed="set" ${mark} data-j="${j}" data-f="weight">`}
          <input type="number" min="${spec.list === 'ex' ? 10 : 5}" max="300" step="5" value="${x.rest}" aria-label="${t('ed.rest')} ${j + 1}" data-ed="set" ${mark} data-j="${j}" data-f="rest">
          <select aria-label="${t('ed.mode')} ${j + 1}" data-ed="set" ${mark} data-j="${j}" data-f="mode" class="${(x.mode || 1) !== 1 ? 'alt' : ''}">${MODES.map((m) => `<option value="${m}" ${(x.mode || 1) === m ? 'selected' : ''}>${t('ed.mode' + m)}</option>`).join('')}</select>
          <button type="button" class="ed-x" aria-label="${t('ed.removeSet')} ${j + 1}" data-ed="set-del" ${mark} data-j="${j}">×</button></div>`).join('')}
      </div>
      <div class="ed-quick">
        <button type="button" class="chip" data-ed="set-add" ${mark}>${t('ed.addSet')}</button>
        <button type="button" class="chip" data-ed="equal" ${mark}>${t('ed.allEqual')}</button>
        ${timed ? '' : `<button type="button" class="chip" data-ed="ramp" ${mark}>${e.rampUp ? t('ed.rampOff') : t('ed.rampOn')}</button>
        <button type="button" class="chip" data-ed="pyramid" ${mark}>${t('ed.pyramid')}</button>`}
      </div></div>`;
  }

  // oefeningen tekenen, supersets in een eigen kader
  function groupedCards(items, specAt) {
    let html = '';
    for (let i = 0; i < items.length; i++) {
      const e = items[i], spec = specAt(i);
      if (!e.group) { html += exCard(e, i, spec); continue; }
      const start = i; let end = i; while (items[end + 1]?.group === e.group) end++;
      const grp = items.slice(start, end + 1);
      const rounds = Math.max(...grp.map((g) => g.sets.length));
      const rest = items[end].sets[0]?.rest ?? 60;
      html += `<div class="ed-ss"><div class="row between wrap gap"><b class="ed-ss-h">${esc(t('ss.head', { g: e.group, n: rounds, rest }))}</b>
        <button type="button" class="btn ghost small" data-ed="ss-off" ${attr(spec, i)} data-g="${e.group}">${t('ss.off')}</button></div>
        <div class="muted small">${t('ss.hint')}</div>
        ${grp.map((g, j) => exCard(g, start + j, specAt(start + j))).join('')}</div>`;
      i = end;
    }
    return html;
  }

  // ---------- alles tekenen ----------
  function render() {
    const lbl = ctx.weekLabel ? ctx.weekLabel(plan) : '';
    const sets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
    dlg.innerHTML = `<form method="dialog" class="ed">
      <div class="ed-top">
        <div class="ed-name"><div class="eyebrow">${esc(tpl ? t('ed.eyebrowTpl') : t('ed.eyebrow', { week: lbl }))}</div>
          <div class="row gap wrap"><input class="ed-nameinput" aria-label="${t('ed.nameLabel')}" value="${esc(draft.name)}" data-ed="name" maxlength="40">
            ${tpl ? '' : `<button type="button" class="badge ${draft.locked ? 'lock-on' : ''}" data-ed="lock" title="${t('ed.lockToggle')}">${draft.locked ? '🔒 ' + t('ed.locked') : t('ed.unlocked')}</button>`}
            <span class="muted small">${changes ? (changes === 1 ? t('ed.changes1') : t('ed.changes', { n: changes })) : t('ed.noChanges')}</span></div></div>
        <div class="ed-btns">
          <button type="button" class="btn ghost" data-ed="undo" ${undo.length ? '' : 'disabled'}>${t('ed.undo')}</button>
          ${tpl || saved.custom ? '' : `<button type="button" class="btn ghost" data-ed="reset" ${saved.original || changes ? '' : 'disabled'}>${t('ed.reset')}</button>`}
          ${tpl ? '' : `<button type="button" class="btn ghost" data-ed="as-tpl">${t('ed.asTemplate')}</button>`}
          <button type="button" class="btn ghost" data-ed="cancel">${t('ed.cancel')}</button>
          <button type="button" class="btn accent" data-ed="save">${t('ed.save')}</button>
        </div>
      </div>
      <div class="ed-body">
        <div class="ed-main">
          ${warmBlock()}
          <div class="row between wrap gap ed-exhead"><div><b>${t('ed.exercises')}</b> <span class="muted small">${t('ed.exSum', { n: draft.exercises.length, sets })}</span></div>
            <button type="button" class="btn accent small" data-ed="add">${t('ed.addExercise')}</button></div>
          ${groupedCards(draft.exercises, () => ({ list: 'ex', kind: '', items: draft.exercises, timed: false }))}
          ${coolBlock()}
        </div>
        <aside class="ed-side">${sidePanel()}</aside>
      </div></form>`;
  }

  // alleen de rechterkolom en de tellers bijwerken (bij typen, zodat de focus in het veld blijft)
  function refreshSide() {
    const side = dlg.querySelector('.ed-side'); if (side) side.innerHTML = sidePanel();
  }

  const close = () => { dlg.close(); };
  const targetOf = (b) => {
    const list = b.dataset.list || 'ex';
    const i = Number(b.dataset.i);
    if (list === 'cool') {
      const item = draft.cooldown?.[i];
      return { list, i, kind: item?.weighted ? 'cable' : 'cool', item, timed: isTimedItem(item, item?.weighted ? 'cable' : 'cool') };
    }
    if (list === 'warm') {
      const row = warmRows(draft.warmup)[i];
      return { list, i, kind: row?.kind || '', item: row?.x, timed: isTimedItem(row?.x, row?.kind) };
    }
    return { list: 'ex', i, kind: '', item: draft.exercises?.[i], timed: false };
  };
  const touch = (item, kind, list) => { if (list !== 'ex' && item) syncWarmItem(item, kind); };
  const listOf = (t) => (t.list === 'warm' ? warmRows(draft.warmup).map((r) => r.x) : t.list === 'cool' ? draft.cooldown : draft.exercises);

  // ---------- klikken ----------
  dlg.onclick = async (ev) => {
    const path = ev.target.closest('path[data-m]');
    if (path && dlg.contains(path)) { selMuscle = selMuscle === path.dataset.m ? null : path.dataset.m; render(); return; }
    const b = ev.target.closest('[data-ed]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
    const a = b.dataset.ed, t = targetOf(b), e = t.item, i = t.i;
    switch (a) {
      case 'open': openRef = isOpen({ list: t.list, kind: t.kind }, i) ? { list: '', kind: '', i: -1 } : { list: t.list, kind: t.kind || '', i }; break;
      case 'muscle': selMuscle = selMuscle === b.dataset.m ? null : b.dataset.m; break;
      case 'lock': snapshot(); draft.locked = !draft.locked; break;
      case 'move': {
        const d = Number(b.dataset.d);
        if (t.list === 'warm') {
          const rows = warmRows(draft.warmup);
          const dest = i + d;
          if (dest < 0 || dest >= rows.length) return;
          snapshot();
          const landed = moveRows(rows, i, d);
          normalizeGroups(rows.map((r) => r.x));
          commitWarm(rows);
          if (openRef.list === 'warm') { if (openRef.i === i) openRef.i = landed; else if (openRef.i === dest) openRef.i = i; }
          break;
        }
        const arr = t.list === 'cool' ? draft.cooldown : draft.exercises;
        const j = i + d; if (j < 0 || j >= arr.length) return; snapshot();
        const other = arr[j];
        let next = j;
        if (other.group && other.group !== e.group) { let k = j; while (arr[k + d]?.group === other.group) k += d; arr.splice(i, 1); arr.splice(k, 0, e); next = k; }
        else { [arr[i], arr[j]] = [arr[j], arr[i]]; if (openRef.list === t.list && openRef.i === i) openRef.i = j; else if (openRef.list === t.list && openRef.i === j) openRef.i = i; }
        if (next !== j && openRef.list === t.list && openRef.i === i) openRef.i = next;
        normalizeGroups(arr);
        break;
      }
      case 'ex-del': {
        snapshot();
        if (t.list === 'warm') {
          const rows = warmRows(draft.warmup);
          rows.splice(i, 1);
          normalizeGroups(rows.map((r) => r.x));
          commitWarm(rows);
        } else {
          const arr = t.list === 'cool' ? draft.cooldown : draft.exercises;
          arr.splice(i, 1);
          normalizeGroups(arr);
          if (openRef.list === t.list && openRef.i >= arr.length) openRef.i = arr.length - 1;
        }
        break;
      }
      case 'set-add': if (!e?.sets?.length) return; snapshot(); e.sets.push({ ...e.sets[e.sets.length - 1] }); touch(e, t.kind, t.list); break;
      case 'set-del': if (!e?.sets || e.sets.length <= 1) { ctx.toast(t('ed.lastRemoved'), true); return; } snapshot(); e.sets.splice(Number(b.dataset.j), 1); touch(e, t.kind, t.list); break;
      case 'equal': snapshot(); e.sets = e.sets.map(() => ({ ...e.sets[0] })); touch(e, t.kind, t.list); break;
      case 'ramp': if (t.timed) return; snapshot(); e.rampUp = !e.rampUp; break;
      case 'pyramid': {
        if (t.timed) return;
        snapshot(); const s0 = e.sets[0];
        e.sets = e.sets.map((x, j) => ({ ...x, reps: Math.max(1, s0.reps - 2 * j), weight: half(s0.weight * (1 + 0.075 * j)) }));
        touch(e, t.kind, t.list);
        break;
      }
      case 'restore-warm': snapshot(); draft.warmup = clone(original.warmup); break;
      case 'restore-cool': snapshot(); draft.cooldown = clone(original.cooldown); break;
      case 'regen-warm': case 'regen-cool': {
        const cool = a === 'regen-cool';
        const except = cool ? (draft.cooldown || []).map((x) => x.id) : [...(draft.warmup?.mobility || []), ...(draft.warmup?.cable || [])].map((x) => x.id);
        try {
          const r = await ctx.api('POST', '/api/plan/warmcool', { key: draft.key, part: cool ? 'cool' : 'warm', except, salt: ++warmTry });
          snapshot();
          if (cool) draft.cooldown = r.cooldown || [];
          else draft.warmup = r.warmup || { mobility: [], cable: [] };
          prepareWarm(draft);
        } catch (err) { ctx.toast(err.message, true); }
        break;
      }
      case 'add': case 'add-warm': case 'add-cool': {
        const start = a === 'add' ? 'ex' : a === 'add-warm' ? 'warm' : 'cool';
        const ids = [...draft.exercises, ...(draft.warmup?.mobility || []), ...(draft.warmup?.cable || []), ...(draft.cooldown || [])].map((x) => x.id);
        openPicker(start, ctx, { muscleKey: selMuscle, inSession: ids }, (items, block) => {
          if (!items.length) return;
          snapshot();
          if (block === 'ex') { draft.exercises.push(...items); openRef = { list: 'ex', kind: '', i: draft.exercises.length - items.length }; }
          else if (block === 'warm') {
            draft.warmup = draft.warmup || { mobility: [], cable: [] };
            let seq = warmRows(draft.warmup).reduce((m, r) => Math.max(m, +r.x.seq || 0), -1);
            for (const it of items) {
              const kind = it.kind === 'cable' ? 'cable' : 'mobility';
              delete it.kind;
              ensureWarmItem(it, kind);
              it.seq = ++seq;
              draft.warmup[kind].push(it);
            }
            const added = warmRows(draft.warmup);
            openRef = { list: 'warm', kind: added[added.length - 1].kind, i: added.length - 1 };
          } else {
            draft.cooldown = draft.cooldown || [];
            for (const it of items) ensureWarmItem(it, it.weighted ? 'cable' : 'cool');
            draft.cooldown.push(...items);
            const at = draft.cooldown.length - items.length;
            openRef = { list: 'cool', kind: draft.cooldown[at].weighted ? 'cable' : 'cool', i: at };
          }
          render();
        });
        return;
      }
      case 'ss-link': {
        const arr = listOf(t);
        const next = arr[i + 1]; if (!next) return;
        snapshot();
        const g = e.group || next.group || 'Z' + Date.now();
        if (next.group && next.group !== g) { const old = next.group; for (const x of arr) if (x.group === old) x.group = g; }
        e.group = g; next.group = g;
        normalizeGroups(arr);
        if (t.list === 'warm') commitWarm(warmRows(draft.warmup));
        break;
      }
      case 'ss-off': {
        snapshot();
        const which = b.dataset.list || 'ex';
        const arr = which === 'warm' ? warmRows(draft.warmup).map((r) => r.x) : which === 'cool' ? draft.cooldown : draft.exercises;
        for (const x of arr) if (x.group === b.dataset.g) delete x.group;
        normalizeGroups(arr);
        break;
      }
      case 'swap': {
        const block = t.list === 'warm' ? 'warm' : t.list === 'cool' ? 'cool' : 'ex';
        const k = Object.entries(e.muscles || {}).find(([, w]) => w >= 1)?.[0] || null;
        const ids = block === 'ex' ? draft.exercises.map((x) => x.id) : [...draft.exercises, ...(draft.warmup?.mobility || []), ...(draft.warmup?.cable || []), ...(draft.cooldown || [])].map((x) => x.id);
        openPicker(block, ctx, { muscleKey: k, inSession: ids, replace: e.title }, (items) => {
          if (!items.length) return;
          snapshot();
          const neu = items[0];
          if (block === 'ex') draft.exercises[i] = e.group ? { ...neu, group: e.group } : neu;
          else if (block === 'cool') {
            ensureWarmItem(neu, neu.weighted ? 'cable' : 'cool');
            if (e.group) neu.group = e.group;
            draft.cooldown[i] = neu;
          } else {
            const rows = warmRows(draft.warmup);
            const kind = neu.kind === 'cable' ? 'cable' : 'mobility';
            delete neu.kind;
            ensureWarmItem(neu, kind);
            neu.seq = rows[i].x.seq;
            if (rows[i].x.group) neu.group = rows[i].x.group;
            rows[i] = { kind, x: neu };
            commitWarm(rows);
          }
          openRef = { list: t.list, kind: t.kind || '', i };
          render();
        });
        return;
      }
      case 'undo': if (!undo.length) return; draft = JSON.parse(undo.pop()); changes = Math.max(0, changes - 1); break;
      case 'reset':
        if (!await askConfirm(t('ed.resetConfirm'))) return;
        snapshot(); draft = clone(original); draft.locked = false; break;
      case 'as-tpl': {
        const name = await askText(t('ed.tplName'), draft.name); if (!name) return;
        try { await ctx.api('POST', '/api/templates', { name, session: { ...clone(draft), estMinutes: estMinutes(draft) } }); ctx.toast(t('ed.tplSaved', { name })); ctx.onTemplates?.(); }
        catch (err) { ctx.toast(err.message, true); }
        return;
      }
      case 'cancel': if (changes && !await askConfirm(t('ed.cancelConfirm'))) return; close(); return;
      case 'save': await save(); return;
      default: return;
    }
    render();
  };

  // ---------- typen ----------
  dlg.onchange = (ev) => {
    const el = ev.target; const a = el.dataset?.ed; if (!a) return;
    const t = targetOf(el);
    snapshot();
    if (a === 'name') draft.name = el.value.trim().slice(0, 40) || draft.name;
    else if (a === 'prog' && t.item && !t.timed) t.item.fixed = !el.checked;
    else if (a === 'set' && t.item) {
      const x = t.item.sets[Number(el.dataset.j)], f = el.dataset.f;
      if (f === 'reps') x.reps = t.timed ? Math.min(180, Math.max(5, Math.round(num(el.value, x.reps)))) : Math.min(30, Math.max(1, Math.round(num(el.value, x.reps))));
      if (f === 'weight' && !t.timed) x.weight = t.list === 'ex' ? Math.max(0.5, half(num(el.value, x.weight))) : Math.max(0, half(num(el.value, x.weight)));
      if (f === 'rest') x.rest = Math.min(300, Math.max(t.list === 'ex' ? 10 : 5, Math.round(num(el.value, x.rest))));
      if (f === 'mode') x.mode = Number(el.value) || 1;
      if (t.timed) x.weight = 0;
      touch(t.item, t.kind, t.list);
    }
    if (a === 'set' && el.dataset.f === 'mode') render(); else { refreshSide(); const c = dlg.querySelector('.ed-name .muted'); if (c) c.textContent = changes === 1 ? t('ed.changes1') : t('ed.changes', { n: changes }); dlg.querySelector('[data-ed=undo]')?.removeAttribute('disabled'); }
  };

  async function save() {
    if (tpl) {
      try { await tpl.onSave({ ...clone(draft), estMinutes: estMinutes(draft) }); ctx.toast(t('ed.tplSaved', { name: draft.name })); close(); }
      catch (err) { ctx.toast(err.message, true); }
      return;
    }
    const p = clone(plan);
    const strip = (x) => { const c = clone(x); for (const k of ['locked', 'edited', 'original', 'estMinutes', 'pushedAt', 'changedAfterPush', 'muscles']) delete c[k]; for (const e of c.exercises || []) delete e.muscles; return JSON.stringify(c); };
    // niets meer anders dan het voorstel (bijv. na "Terug naar voorstel"): gewoon weer het voorstel
    const same = !saved.custom && strip(draft) === strip(original);
    const s = same ? { ...clone(original), locked: !!draft.locked } : saved.custom ? { ...clone(draft), estMinutes: estMinutes(draft) } : { ...clone(draft), original, edited: true, estMinutes: estMinutes(draft) };
    if (same) { delete s.edited; delete s.original; }
    if (saved.pushedAt && !same) { delete s.pushedAt; s.changedAfterPush = true; }
    p.sessions[idx] = s;
    try {
      const r = await ctx.api('PUT', '/api/plan', p);
      ctx.onSaved(r.plan);
      ctx.toast(saved.pushedAt ? t('ed.savedPushed') : t('ed.saved'));
      close();
    } catch (err) { ctx.toast(err.message, true); }
  }

  // Esc: bij wijzigingen eerst vragen (de vraag is async, dus het sluiten altijd tegenhouden en zelf sluiten)
  dlg.oncancel = async (ev) => { if (!changes) return; ev.preventDefault(); if (await askConfirm(t('ed.cancelConfirm'))) close(); };
  render();
  dlg.showModal();
}

// ---------- oefening kiezen (catalogus van het toestel) ----------

const GROUPS = [
  ['pk.upper', ['Pecs', 'Lats', 'Traps', 'Front Delts', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms']],
  ['pk.lower', ['Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves']],
  ['pk.trunk', ['Abs', 'Back Extensors', 'Full Body']],
];
const TABS = ['Training', 'Bodyweight', 'Warmup', 'Stretch', 'Recovery', 'HIIT', 'Pilates-Mat', 'Row & Ski'];
const GEAR = ['barbell', 'bench', 'handles', 'rope', 'belt', 'rowski', 'mat'];
// sleutel van het figuur → spiergroep in de catalogus
const KEY2LIB = { pecs: 'Pecs', lats: 'Lats', traps: 'Traps', frontDelts: 'Front Delts', sideDelts: 'Side Delts', rearDelts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', adductors: 'Adductors', calves: 'Calves', abs: 'Abs', lowerBack: 'Back Extensors' };
const LIB2KEY = Object.fromEntries(Object.entries(KEY2LIB).map(([k, v]) => [v, k]));
// Hoofdspier 1, meewerkend 0,5, op de sleutels van de spierkaart. Onbekende namen tellen niet mee.
export function pickerMuscleScores(main, aux, fallback) {
  const scores = {};
  const mains = main?.length ? main : (fallback ? [fallback] : []);
  for (const name of aux || []) { const k = LIB2KEY[name]; if (k) scores[k] = scores[k] || 0.5; }
  for (const name of mains) { const k = LIB2KEY[name]; if (k) scores[k] = 1; }
  return scores;
}
const musName = (m) => { const k = 'mus.' + m; const v = t(k); return v === k ? m : v; };
const tabName = (x) => { const k = 'tab.' + x; const v = t(k); return v === k ? x : v; };

let libCache = null, pdlg = null, detailDlg = null;
// Sluiten van het oefeningenvenster mag het klik- of Escape-event niet doorgeven aan de kiezer eronder.
let blockPickerDismiss = false;
const infoCache = new Map();

// Opent de kiezer. block: waar de oefeningen standaard heen gaan ('ex', 'warm' of 'cool'; te wijzigen in de kiezer).
// replace: naam van de oefening die gewisseld wordt (dan één keuze, altijd naar 'ex').
// onAdd(lijst, blok) krijgt de klaargezette oefeningen.
export async function openPicker(block, ctx, { muscleKey = null, inSession = [], replace = null } = {}, onAdd) {
  const { esc } = ctx;
  if (!pdlg) {
    pdlg = document.createElement('dialog');
    pdlg.className = 'picker-dlg';
    try { if ('closedBy' in pdlg) pdlg.closedBy = 'closerequest'; } catch { /* oudere browser */ }
    document.body.appendChild(pdlg);
    // Een klik die na het sluiten van het oefeningenvenster op de kiezer valt, sluit de kiezer niet.
    pdlg.addEventListener('click', (ev) => {
      if (!blockPickerDismiss) return;
      ev.stopPropagation();
      ev.preventDefault();
    }, true);
  }
  if (!detailDlg) {
    detailDlg = document.createElement('dialog');
    detailDlg.className = 'picker-detail-dlg';
    try { if ('closedBy' in detailDlg) detailDlg.closedBy = 'closerequest'; } catch { /* oudere browser */ }
    document.body.appendChild(detailDlg);
  }
  if (detailDlg.open) detailDlg.close();
  pdlg.innerHTML = `<div class="pk-loading muted">${t('pk.loading')}</div>`;
  if (!pdlg.open) pdlg.showModal();
  try { libCache = libCache || await ctx.api('GET', '/api/library'); } catch (e) { ctx.toast(e.message, true); pdlg.close(); return; }
  const lib = libCache;
  const avoid = new Set((lib.avoid || []).map(Number));
  // oefeningen met een accessoire dat je niet gebruikt (Instellingen → Training)
  const noAcc = new Set(lib.noAcc || []);
  const accBlocked = (e) => (e.acc || []).some((k) => noAcc.has(k));
  const inS = new Set(inSession.map(Number));
  const defTab = (bl) => (bl === 'ex' ? 'Training' : bl === 'warm' ? 'Warmup' : 'Stretch');
  const st = {
    block,
    muscle: block === 'ex' && muscleKey ? KEY2LIB[muscleKey] || null : null,
    tab: defTab(block),
    q: '', onlyDone: false, hideAvoid: true, hideAcc: true, gear: new Set(), sel: new Set(), detail: null, busy: false,
  };
  const gearOn = (e) => !st.gear.size || (e.acc || []).some((k) => st.gear.has(k));
  const gearKeys = GEAR.filter((k) => lib.items.some((e) => (e.acc || []).includes(k)));
  const counts = () => {
    const c = {};
    for (const e of lib.items) if ((!st.muscle || e.muscle === st.muscle) && gearOn(e)) c[e.tab] = (c[e.tab] || 0) + 1;
    return c;
  };
  const filtered = () => {
    const q = st.q.trim().toLowerCase();
    return lib.items.filter((e) => (st.tab === 'all' || e.tab === st.tab) && (!st.muscle || e.muscle === st.muscle) && (!q || e.name.toLowerCase().includes(q))
      && gearOn(e) && (!st.onlyDone || lib.history[e.id]) && (!st.hideAvoid || !avoid.has(Number(e.id))) && (!st.hideAcc || !accBlocked(e)))
      .sort((a, b) => (lib.history[b.id]?.times || 0) - (lib.history[a.id]?.times || 0) || a.name.localeCompare(b.name));
  };
  // soort zonder oefeningen in deze catalogus: dan alles tonen
  if (!lib.items.some((e) => e.tab === st.tab)) st.tab = 'all';
  const title = replace ? t('pk.titleSwap', { name: replace }) : t('pk.title');

  function row(e) {
    const h = lib.history[e.id];
    const on = st.sel.has(Number(e.id));
    return `<div class="pk-row${on ? ' on' : ''}">
      <input type="checkbox" ${on ? 'checked' : ''} data-pk="sel" data-id="${e.id}" aria-label="${t('pk.select')}: ${esc(e.name)}">
      <button type="button" class="pk-name" data-pk="detail" data-id="${e.id}"><b>${esc(e.name)}</b>
        <span class="muted small">${esc(musName(e.muscle))} · ${esc(tabName(e.tab))}${inS.has(Number(e.id)) ? ` · <span class="badge">${t('pk.inSession')}</span>` : ''}${avoid.has(Number(e.id)) ? ` · <span class="badge warn">${t('pk.avoided')}</span>` : ''}${accBlocked(e) ? ` · <span class="badge warn">${t('pk.accBlocked')}</span>` : ''}</span>
        <span class="small ${h ? 'up' : 'muted'}">${h ? esc(t('pk.done', { date: h.last, sets: h.sets, times: h.times })) : t('pk.new')}</span></button>
      <button type="button" class="pk-chev" data-pk="detail" data-id="${e.id}" aria-label="${esc(e.name)}">›</button></div>`;
  }

  function detailHtml(e, info, trend, err) {
    const list = filtered(); const i = list.findIndex((x) => x.id === e.id);
    const on = st.sel.has(Number(e.id));
    const h = lib.history[e.id];
    const spark = trend?.length > 1 ? (() => { const ys = trend.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys) || 1; const pts = trend.map((p, j) => `${(j / (trend.length - 1)) * 600},${50 - ((p.y - lo) / (hi - lo || 1)) * 42}`).join(' '); return `<svg viewBox="0 0 600 54" preserveAspectRatio="none" class="pk-spark" role="img" aria-label="${t('pk.history')}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5"/></svg><div class="muted small">${esc(trend[0].x)}: ${nlNum(trend[0].y)} kg → ${esc(trend[trend.length - 1].x)}: ${nlNum(trend[trend.length - 1].y)} kg</div>`; })() : `<div class="muted small">${h ? '' : t('pk.noHistory')}</div>`;
    const scores = info ? pickerMuscleScores(info.main, info.aux, e.muscle) : {};
    const map = Object.keys(scores).length ? `<div class="pk-map">${bodyMap(scores, { height: 320, title: t('pk.muscles'), caption: (k, v) => `${MUSCLE_LABELS[k] || k}: ${v >= 1 ? t('pk.main') : t('pk.aux')}` })}</div>` : '';
    return `<div class="pk-dhead"><button type="button" class="btn ghost small" data-pk="back">${t('pk.back')}</button>
        <div class="row gap"><button type="button" class="btn ghost small" data-pk="nav" data-d="-1" aria-label="${t('pk.prev')}" ${i <= 0 ? 'disabled' : ''}>‹</button><button type="button" class="btn ghost small" data-pk="nav" data-d="1" aria-label="${t('pk.next')}" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>›</button></div></div>
      <div class="pk-detail">
        <h3>${esc(info?.title || e.name)}</h3>
        <div class="muted small">${esc(musName(e.muscle))} · ${esc(tabName(e.tab))}${info?.barbell ? ' · ' + t('pk.barbell') : ''}${info?.unilateral ? ' · ' + t('pk.perSide') : ''}</div>
        ${err ? `<div class="note">${esc(t('pk.infoError', { msg: err }))}</div>` : !info ? `<div class="muted">${t('pk.loading')}</div>` : `
        <div class="pk-media">
          ${info.video ? `<video controls preload="metadata" playsinline ${info.poster || info.img ? `poster="${esc(info.poster || info.img)}"` : ''} src="${esc(info.video)}"></video>` : info.img ? `<img src="${esc(info.img)}" alt="">` : ''}
          <div class="pk-mus"><div class="eyebrow">${t('pk.muscles')}</div>
            ${map}
            ${info.main.map((m) => `<div class="row between"><span>${esc(musName(m))}</span><span class="accent-text small">${t('pk.main')}</span></div>`).join('')}
            ${info.aux.map((m) => `<div class="row between"><span>${esc(musName(m))}</span><span class="muted small">${t('pk.aux')}</span></div>`).join('')}
            ${info.coach ? `<div class="muted small" style="margin-top:auto">${esc(t('pk.coach', { name: info.coach }))}</div>` : ''}</div>
        </div>
        ${info.steps ? `<div><div class="eyebrow">${t('pk.steps')}</div><p class="pk-text">${esc(info.steps)}</p></div>` : ''}
        ${info.keyPoints.length ? `<div><div class="eyebrow">${t('pk.keyPoints')}</div><div class="pk-kps">${info.keyPoints.map((k) => `<figure>${k.img ? `<img src="${esc(k.img)}" alt="" loading="lazy">` : ''}<figcaption class="pk-text">${esc(k.text)}</figcaption></figure>`).join('')}</div></div>` : ''}
        <div class="pk-facts">
          ${info.breathing ? `<div><b>${t('pk.breathing')}:</b> ${esc(info.breathing)}</div>` : ''}
          ${info.feeling ? `<div><b>${t('pk.feeling')}:</b> ${esc(info.feeling)}</div>` : ''}
          ${info.mistake ? `<div><b class="warn-text">${t('pk.mistake')}:</b> ${esc(info.mistake)}</div>` : ''}
        </div>
        ${info.presets?.length ? `<div><div class="eyebrow">${t('pk.presets')}</div>${info.presets.filter((p) => p.name).map((p) => `<div class="small muted">${esc(t('pk.preset', { name: p.name, sets: p.sets, r1: p.reps[0], r2: p.reps[1], s1: p.rest[0], s2: p.rest[1] }))}</div>`).join('')}</div>` : ''}
        <div class="muted small">${t('pk.source', { lang: (() => { try { return new Intl.DisplayNames([localeOf()], { type: 'language' }).of(info.lang || 'en'); } catch { return info.lang || 'en'; } })() })}</div>`}
        <div><div class="eyebrow">${t('pk.history')}</div>${h ? `<div class="small up">${esc(t('pk.done', { date: h.last, sets: h.sets, times: h.times }))}</div>` : ''}${spark}</div>
      </div>
      <div class="pk-dfoot">${avoid.has(Number(e.id)) ? `<span class="badge warn">${t('pk.avoided')}</span>` : `<button type="button" class="btn ghost" data-pk="avoid" data-id="${e.id}">${t('pk.avoid')}</button>`}
        <button type="button" class="btn ${on ? 'ghost' : 'accent'}" data-pk="toggle" data-id="${e.id}">${on ? t('pk.deselect') : t('pk.select')}</button></div>`;
  }

  function render() {
    const main = pdlg.querySelector('.pk-main');
    const side = pdlg.querySelector('.pk-side');
    const scroll = { main: main?.scrollTop || 0, side: side?.scrollTop || 0 };
    const c = counts();
    const list = filtered();
    pdlg.innerHTML = `<div class="pk">
      <div class="pk-top"><div><div class="eyebrow">${esc(title)}</div></div><button type="button" class="btn ghost small" data-pk="close" aria-label="${t('pk.close')}">✕</button></div>
      <div class="pk-body">
        <aside class="pk-side">
          <div class="eyebrow">${t('pk.muscle')}</div>
          <button type="button" class="chip ${!st.muscle ? 'on' : ''}" data-pk="muscle" data-m="">${t('pk.anyMuscle')}</button>
          ${GROUPS.map(([g, ms]) => `<div class="muted small">${t(g)}</div><div class="pk-chips">${ms.map((m) => `<button type="button" class="chip ${st.muscle === m ? 'on' : ''}" data-pk="muscle" data-m="${esc(m)}">${esc(musName(m))}</button>`).join('')}</div>`).join('')}
          <div class="eyebrow" style="margin-top:.6rem">${t('pk.filters')}</div>
          <label class="inline-check small"><input type="checkbox" data-pk="onlyDone" ${st.onlyDone ? 'checked' : ''}> ${t('pk.onlyDone')}</label>
          <label class="inline-check small"><input type="checkbox" data-pk="hideAvoid" ${st.hideAvoid ? 'checked' : ''}> ${t('pk.hideAvoid')}</label>
          ${noAcc.size ? `<label class="inline-check small"><input type="checkbox" data-pk="hideAcc" ${st.hideAcc ? 'checked' : ''}> ${t('pk.hideAcc')}</label>` : ''}
          ${gearKeys.length ? `<div class="eyebrow" style="margin-top:.6rem">${t('pk.gear')}</div>
          <button type="button" class="chip ${st.gear.size ? '' : 'on'}" data-pk="gear" data-g="">${t('pk.anyGear')}</button>
          <div class="pk-chips">${gearKeys.map((k) => `<button type="button" class="chip ${st.gear.has(k) ? 'on' : ''}" data-pk="gear" data-g="${esc(k)}">${esc(t('acc.' + k))}</button>`).join('')}</div>` : ''}
        </aside>
        <section class="pk-main">
          <input type="search" class="pk-search" placeholder="${esc(t('pk.search'))}" aria-label="${esc(t('pk.search'))}" value="${esc(st.q)}" data-pk="q">
          <div class="pk-tabs"><button type="button" class="chip ${st.tab === 'all' ? 'on' : ''}" data-pk="tab" data-t="all">${t('pk.all')}</button>${TABS.filter((x) => c[x]).map((x) => `<button type="button" class="chip ${st.tab === x ? 'on' : ''}" data-pk="tab" data-t="${esc(x)}">${esc(tabName(x))} · ${c[x]}</button>`).join('')}</div>
          <div class="pk-list">${list.length ? list.slice(0, 150).map(row).join('') + (list.length > 150 ? `<div class="muted small">${t('pk.more', { n: list.length - 150 })}</div>` : '') : `<div class="muted">${t('pk.none')}</div>`}</div>
        </section>
      </div>
      <div class="pk-foot"><span class="small">${t('pk.selected', { n: st.sel.size })}</span>
        <div class="row gap wrap">${replace ? '' : `<span class="small muted">${t('pk.target')}</span><div class="pk-target">${['warm', 'ex', 'cool'].map((x) => `<button type="button" class="chip ${st.block === x ? 'on' : ''}" data-pk="target" data-b="${x}">${t(x === 'warm' ? 'ed.warmup' : x === 'cool' ? 'ed.cooldown' : 'ed.exercises')}</button>`).join('')}</div>`}
        <button type="button" class="btn accent" data-pk="add" ${st.sel.size && !st.busy ? '' : 'disabled'}>${st.busy ? t('pk.adding') : replace ? t('pk.swap') : t('pk.add')}</button></div></div>
    </div>`;
    const main2 = pdlg.querySelector('.pk-main');
    const side2 = pdlg.querySelector('.pk-side');
    if (main2) main2.scrollTop = scroll.main;
    if (side2) side2.scrollTop = scroll.side;
  }

  // In Chrome sluit één Escape elke open dialoog, en het cancel-event is niet te stoppen.
  // Zolang het oefeningenvenster open is, negeren de dialogen eronder Escape.
  function shieldDialogs(on) {
    for (const d of document.querySelectorAll('dialog')) {
      if (!('closedBy' in d) || d === detailDlg) continue;
      if (on) {
        if (!d.open || d.dataset.closedByShield != null) continue;
        d.dataset.closedByShield = d.closedBy || 'closerequest';
        try { d.closedBy = 'none'; } catch { /* oudere browser */ }
      } else if (d.dataset.closedByShield != null) {
        try { d.closedBy = d.dataset.closedByShield; } catch { /* oudere browser */ }
        delete d.dataset.closedByShield;
      }
    }
  }

  function closeDetail() {
    const wasOpen = !!detailDlg?.open;
    st.detail = null;
    if (!wasOpen) { shieldDialogs(false); return; }
    blockPickerDismiss = true;
    detailDlg.querySelectorAll('video').forEach((v) => v.pause());
    detailDlg.close();
    shieldDialogs(false);
    setTimeout(() => { blockPickerDismiss = false; }, 0);
  }

  async function showDetail(id) {
    const e = lib.items.find((x) => x.id === id); if (!e) return;
    st.detail = id;
    const c = infoCache.get(id);
    detailDlg.innerHTML = `<div class="pk-dwrap">${detailHtml(e, c?.info, c?.trend, c?.err)}</div>`;
    shieldDialogs(true);
    if (!detailDlg.open) detailDlg.showModal();
    if (c) return;
    try { const r = await ctx.api('GET', `/api/exercise/info?id=${encodeURIComponent(id)}`); infoCache.set(id, { info: r.info, trend: r.trend }); }
    catch (err) { infoCache.set(id, { err: err.message }); }
    if (st.detail === id && detailDlg.open) { const x = infoCache.get(id); detailDlg.innerHTML = `<div class="pk-dwrap">${detailHtml(e, x.info, x.trend, x.err)}</div>`; }
  }

  async function act(a, b) {
    if (a === 'close') { closeDetail(); pdlg.close(); return; }
    if (a === 'muscle') { st.muscle = b.dataset.m || null; closeDetail(); }
    else if (a === 'gear') { const g = b.dataset.g; if (!g) st.gear.clear(); else if (st.gear.has(g)) st.gear.delete(g); else st.gear.add(g); closeDetail(); }
    else if (a === 'tab') st.tab = b.dataset.t;
    else if (a === 'detail') { showDetail(isNaN(+b.dataset.id) ? b.dataset.id : +b.dataset.id); return; }
    else if (a === 'back') { closeDetail(); return; }
    else if (a === 'nav') { const list = filtered(); const i = list.findIndex((x) => x.id === st.detail) + Number(b.dataset.d); if (list[i]) showDetail(list[i].id); return; }
    else if (a === 'toggle') {
      const id = Number(b.dataset.id); if (st.sel.has(id)) st.sel.delete(id); else { if (replace) st.sel.clear(); st.sel.add(id); }
      render(); if (st.detail != null) showDetail(st.detail); return;
    }
    else if (a === 'target') { st.block = b.dataset.b; st.tab = lib.items.some((e) => e.tab === defTab(st.block)) ? defTab(st.block) : 'all'; if (st.block !== 'ex') st.muscle = null; }
    else if (a === 'avoid') {
      const id = Number(b.dataset.id);
      try { await ctx.api('POST', '/api/avoid', { id, regenerate: false }); avoid.add(id); (lib.avoid ||= []).push(id); st.sel.delete(id); ctx.toast(t('pk.avoidedToast')); } catch (err) { ctx.toast(err.message, true); }
      render(); if (detailDlg.open && st.detail != null) showDetail(st.detail); return;
    }
    else if (a === 'add') {
      st.busy = true; render();
      const out = [];
      try {
        for (const id of st.sel) {
          const r = await ctx.api('POST', '/api/exercise/template', { id, block: st.block });
          out.push(r.exercise || r.item);
        }
        closeDetail(); pdlg.close(); onAdd(out, st.block);
      } catch (err) { ctx.toast(err.message, true); st.busy = false; render(); }
      return;
    } else return;
    render();
  }
  pdlg.onclick = (ev) => {
    if (blockPickerDismiss) return;
    const b = ev.target.closest('[data-pk]'); if (!b || b.tagName === 'INPUT') return;
    act(b.dataset.pk, b);
  };
  // Het oefeningenvenster is een eigen dialoog. Escape en de achtergrond sluiten alleen dát venster.
  detailDlg.onclick = (ev) => {
    if (ev.target === detailDlg) { ev.stopPropagation(); closeDetail(); return; }
    const b = ev.target.closest('[data-pk]'); if (!b || b.tagName === 'INPUT') return;
    act(b.dataset.pk, b);
  };
  detailDlg.oncancel = () => { st.detail = null; };
  detailDlg.onclose = () => {
    detailDlg.querySelectorAll('video').forEach((v) => v.pause());
    st.detail = null;
    shieldDialogs(false);
    blockPickerDismiss = true;
    setTimeout(() => { blockPickerDismiss = false; }, 0);
  };
  pdlg.oncancel = (ev) => {
    if (detailDlg.open || blockPickerDismiss) { ev.preventDefault(); if (detailDlg.open) closeDetail(); }
  };
  pdlg.onclose = () => { if (detailDlg.open) closeDetail(); else shieldDialogs(false); };
  pdlg.onchange = (ev) => {
    const el = ev.target; const a = el.dataset?.pk;
    if (a === 'sel') { const id = Number(el.dataset.id); if (el.checked) { if (replace) st.sel.clear(); st.sel.add(id); } else st.sel.delete(id); render(); }
    else if (a === 'onlyDone' || a === 'hideAvoid' || a === 'hideAcc') { st[a] = el.checked; render(); }
  };
  pdlg.oninput = (ev) => {
    if (ev.target.dataset?.pk !== 'q') return;
    st.q = ev.target.value;
    const listEl = pdlg.querySelector('.pk-list'); const list = filtered();
    if (listEl) listEl.innerHTML = list.length ? list.slice(0, 150).map(row).join('') : `<div class="muted">${t('pk.none')}</div>`;
  };
  render();
}
