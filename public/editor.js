// Trainingseditor: een training uit het plan aanpassen (warming-up, oefeningen, sets, modi, cooldown),
// met live het anatomische figuur, de kerncijfers en de sets per spiergroep voor de hele week.
// Wijzigingen gebeuren op een kopie (concept) en worden pas bewaard bij Opslaan.
import { bodyMap, MUSCLE_LABELS } from './bodymap.js';
import { t } from './i18n.js';

const MODES = [1, 2, 3, 4, 5];
const PUSH = new Set(['hpush', 'vpush', 'tri']), PULL = new Set(['hpull', 'vpull', 'rear', 'curl']);
const BIG = ['pecs', 'lats', 'quads', 'hamstrings', 'glutes']; // grote spiergroepen: waarschuwen bij te weinig sets
const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (v, d = 0) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };
const half = (x) => Math.max(0, Math.round(x * 2) / 2);
const nlNum = (v) => String(v).replace('.', ',');

// Sets per spiergroep in een training: hoofdspier telt 1, meewerkend 0,5 (zoals de engine).
export function sessionMuscleSets(s) {
  const out = {};
  for (const e of s.exercises || []) for (const [k, w] of Object.entries(e.muscles || {})) out[k] = (out[k] || 0) + w * (e.sets?.length || 0);
  return out;
}
// Geschatte duur in minuten (zelfde rekenregel als de engine: 4 s per herhaling + rust + 1 min wisselen per oefening).
function estMinutes(s) {
  let sec = 0;
  for (const e of s.exercises || []) {
    sec += 60 + e.sets.reduce((tt, x) => tt + x.reps * 4 + x.rest, 0);
    if (e.rampUp) sec += 8 * 4 + 45;
  }
  const warm = (s.warmup?.mobility?.length || 0) + (s.warmup?.cable?.length || 0) ? 6 : 0;
  const cool = s.cooldown?.length ? 4 : 0;
  return Math.round(sec / 60) + warm + cool;
}
// Seconden uit een dosering als "30 s per kant".
const secsOf = (dose) => { const m = /(\d+)\s*s\b/i.exec(dose || ''); return m ? Number(m[1]) : 30; };

let dlg = null;

// Opent de editor voor de training met deze sleutel.
// ctx: { state, api, esc, toast, onSaved(plan) }
export function openEditor(key, ctx) {
  const { state, esc } = ctx;
  const plan = state.plan;
  const idx = plan.sessions.findIndex((s) => s.key === key);
  if (idx < 0) return;
  const saved = plan.sessions[idx];
  const original = saved.original ? clone(saved.original) : (() => { const o = clone(saved); delete o.original; return o; })();
  let draft = clone(saved); delete draft.original;
  if (draft.locked == null) draft.locked = true; // bewerken = standaard vastzetten
  const undo = [];
  let changes = 0, open = 0, selMuscle = null;

  if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'editor-dlg'; document.body.appendChild(dlg); }

  const snapshot = () => { undo.push(JSON.stringify(draft)); if (undo.length > 50) undo.shift(); changes++; };
  const exAt = (i) => draft.exercises[i];

  // ---------- rechterkolom: figuur, kerncijfers, week ----------
  function sidePanel() {
    const sc = sessionMuscleSets(draft);
    const week = {};
    for (const s of plan.sessions) {
      const m = s.key === draft.key ? sc : (s.muscles || sessionMuscleSets(s));
      for (const [k, v] of Object.entries(m)) week[k] = (week[k] || 0) + v;
    }
    const min = estMinutes(draft), target = Number(state.settings?.minutesPerSession) || 45;
    const sets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
    const vol = draft.exercises.reduce((v, e) => v + e.sets.reduce((a, x) => a + x.reps * x.weight, 0), 0);
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
        ${tile(t('ed.volume'), `${Math.round(vol).toLocaleString('nl-NL')} kg`, t('ed.volumeSub'))}
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

  // ---------- warming-up en cooldown ----------
  function warmBlock() {
    const items = [...(draft.warmup?.mobility || []).map((x, i) => ['mobility', i, x]), ...(draft.warmup?.cable || []).map((x, i) => ['cable', i, x])];
    const min = items.length ? 6 : 0;
    return `<section class="card ed-block"><div class="row between wrap gap"><div><b>${t('ed.warmup')}</b> <span class="muted small">${t('ed.blockSum', { n: items.length, min })}</span></div>
      <div class="row gap">${!items.length && (original.warmup?.mobility?.length || original.warmup?.cable?.length) ? `<button type="button" class="btn ghost small" data-ed="restore-warm">${t('ed.restoreBlock')}</button>` : ''}<button type="button" class="btn ghost small" data-ed="add-warm">${t('ed.add')}</button></div></div>
      ${items.length ? `<div class="ed-wc">${items.map(([kind, i, x]) => `<div class="ed-wci"><span>${esc(x.title)}</span>
        ${kind === 'cable' ? `<label>${t('ed.reps')}<input type="number" min="1" max="30" value="${x.reps}" data-ed="wc" data-kind="cable" data-i="${i}" data-f="reps"></label><label>${t('ed.kg')}<input type="number" min="0" step="0.5" value="${x.weight}" data-ed="wc" data-kind="cable" data-i="${i}" data-f="weight"></label>`
        : `<label>${t('ed.reps')}<input type="number" min="1" max="60" value="${x.reps}" data-ed="wc" data-kind="mobility" data-i="${i}" data-f="reps"></label>`}
        <button type="button" class="ed-x" aria-label="${t('ed.remove')}" data-ed="wc-del" data-kind="${kind}" data-i="${i}">×</button></div>`).join('')}</div>` : `<div class="muted small">${t('ed.empty')}</div>`}
    </section>`;
  }
  function coolBlock() {
    const items = draft.cooldown || [];
    return `<section class="card ed-block"><div class="row between wrap gap"><div><b>${t('ed.cooldown')}</b> <span class="muted small">${t('ed.blockSum', { n: items.length, min: items.length ? 4 : 0 })}</span></div>
      <div class="row gap">${!items.length && original.cooldown?.length ? `<button type="button" class="btn ghost small" data-ed="restore-cool">${t('ed.restoreBlock')}</button>` : ''}<button type="button" class="btn ghost small" data-ed="add-cool">${t('ed.add')}</button></div></div>
      ${items.length ? `<div class="ed-wc">${items.map((x, i) => `<div class="ed-wci"><span>${esc(x.title)} <span class="muted small">${esc((x.dose || '').replace(/^\d+\s*s\s*/, ''))}</span></span>
        <label>${t('ed.secs')}<input type="number" min="5" max="180" step="5" value="${secsOf(x.dose)}" data-ed="cool" data-i="${i}"></label>
        <button type="button" class="ed-x" aria-label="${t('ed.remove')}" data-ed="cool-del" data-i="${i}">×</button></div>`).join('')}</div>` : `<div class="muted small">${t('ed.empty')}</div>`}
    </section>`;
  }

  // ---------- oefeningen ----------
  function exCard(e, i) {
    const n = draft.exercises.length;
    const sec = Object.entries(e.muscles || {}).filter(([, w]) => w < 1).map(([k]) => MUSCLE_LABELS[k] || k);
    const prim = Object.entries(e.muscles || {}).filter(([, w]) => w >= 1).map(([k]) => MUSCLE_LABELS[k] || k).join(', ') || e.muscle || '';
    const hl = selMuscle && e.muscles?.[selMuscle] ? ' hl' : '';
    const head = `<div class="ed-exh">
        <button type="button" class="ed-title" data-ed="open" data-i="${i}" aria-expanded="${open === i}"><b>${i + 1} · ${esc(e.title)}</b>
          <span class="muted small">${esc(prim)}${sec.length ? ' · ' + esc(t('ed.secondary', { list: sec.join(', ') })) : ''}${e.type ? ' · ' + t(e.type === 'compound' ? 'ed.compound' : 'ed.isolation') : ''}${e.fixed ? ` · <span class="badge">${t('ed.fixed')}</span>` : ''}</span></button>
        <div class="ed-acts">
          <button type="button" class="btn ghost small" data-ed="move" data-i="${i}" data-d="-1" aria-label="${t('ed.up')}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn ghost small" data-ed="move" data-i="${i}" data-d="1" aria-label="${t('ed.down')}" ${i === n - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn ghost small" data-ed="swap" data-i="${i}">${t('ed.swap')}</button>
          <button type="button" class="btn ghost small danger-text" data-ed="ex-del" data-i="${i}">${t('ed.remove')}</button>
        </div></div>`;
    if (open !== i) return `<div class="card ed-ex${hl}" data-i="${i}">${head}<div class="ed-sum muted">${e.sets.length} × ${e.sets[0]?.reps} · ${nlNum(e.sets[0]?.weight)} kg · ${e.sets[0]?.rest} s${e.sets.some((x) => (x.mode || 1) !== 1) ? ` · ${t('ed.mode')}: ${[...new Set(e.sets.map((x) => t('ed.mode' + (x.mode || 1))))].join('/')}` : ''}</div></div>`;
    const ramp = e.rampUp ? half((e.sets[0]?.weight || 0) / 2) : null;
    return `<div class="card ed-ex open${hl}" data-i="${i}">${head}
      <div class="ed-advice small"><span><b class="up">${t('ed.advice')}</b> ${esc(e.note || '—')}</span><span class="muted">${e.basis ? esc(t('ed.last', { basis: e.basis })) : t('ed.noHistory')}</span>
        <label class="inline-check ed-prog"><input type="checkbox" data-ed="prog" data-i="${i}" ${e.fixed ? '' : 'checked'}> ${t('ed.progression')}</label></div>
      <div class="ed-sets" role="table">
        <div class="ed-sr head" role="row"><span>${t('ed.set')}</span><span>${t('ed.reps')}</span><span>${t('ed.kg')}</span><span>${t('ed.rest')}</span><span>${t('ed.mode')}</span><span></span></div>
        ${ramp != null ? `<div class="ed-sr ramp" role="row"><span>${t('ed.warmSet')}</span><span>8</span><span>${nlNum(ramp)}</span><span>45</span><span>${t('ed.mode1')}</span><span></span></div>` : ''}
        ${e.sets.map((x, j) => `<div class="ed-sr" role="row"><span>${j + 1}</span>
          <input type="number" min="1" max="30" value="${x.reps}" aria-label="${t('ed.reps')} ${j + 1}" data-ed="set" data-i="${i}" data-j="${j}" data-f="reps">
          <input type="number" min="0.5" step="0.5" value="${x.weight}" aria-label="${t('ed.kg')} ${j + 1}" data-ed="set" data-i="${i}" data-j="${j}" data-f="weight">
          <input type="number" min="10" max="300" step="5" value="${x.rest}" aria-label="${t('ed.rest')} ${j + 1}" data-ed="set" data-i="${i}" data-j="${j}" data-f="rest">
          <select aria-label="${t('ed.mode')} ${j + 1}" data-ed="set" data-i="${i}" data-j="${j}" data-f="mode" class="${(x.mode || 1) !== 1 ? 'alt' : ''}">${MODES.map((m) => `<option value="${m}" ${(x.mode || 1) === m ? 'selected' : ''}>${t('ed.mode' + m)}</option>`).join('')}</select>
          <button type="button" class="ed-x" aria-label="${t('ed.removeSet')} ${j + 1}" data-ed="set-del" data-i="${i}" data-j="${j}">×</button></div>`).join('')}
      </div>
      <div class="ed-quick">
        <button type="button" class="chip" data-ed="set-add" data-i="${i}">${t('ed.addSet')}</button>
        <button type="button" class="chip" data-ed="equal" data-i="${i}">${t('ed.allEqual')}</button>
        <button type="button" class="chip" data-ed="ramp" data-i="${i}">${e.rampUp ? t('ed.rampOff') : t('ed.rampOn')}</button>
        <button type="button" class="chip" data-ed="pyramid" data-i="${i}">${t('ed.pyramid')}</button>
      </div></div>`;
  }

  // ---------- alles tekenen ----------
  function render() {
    const lbl = ctx.weekLabel ? ctx.weekLabel(plan) : '';
    const sets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
    dlg.innerHTML = `<form method="dialog" class="ed">
      <div class="ed-top">
        <div class="ed-name"><div class="eyebrow">${esc(t('ed.eyebrow', { week: lbl }))}</div>
          <div class="row gap wrap"><input class="ed-nameinput" aria-label="${t('ed.nameLabel')}" value="${esc(draft.name)}" data-ed="name" maxlength="40">
            <button type="button" class="badge ${draft.locked ? 'lock-on' : ''}" data-ed="lock" title="${t('ed.lockToggle')}">${draft.locked ? '🔒 ' + t('ed.locked') : t('ed.unlocked')}</button>
            <span class="muted small">${changes ? (changes === 1 ? t('ed.changes1') : t('ed.changes', { n: changes })) : t('ed.noChanges')}</span></div></div>
        <div class="ed-btns">
          <button type="button" class="btn ghost" data-ed="undo" ${undo.length ? '' : 'disabled'}>${t('ed.undo')}</button>
          <button type="button" class="btn ghost" data-ed="reset" ${saved.original || changes ? '' : 'disabled'}>${t('ed.reset')}</button>
          <button type="button" class="btn ghost" data-ed="cancel">${t('ed.cancel')}</button>
          <button type="button" class="btn accent" data-ed="save">${t('ed.save')}</button>
        </div>
      </div>
      <div class="ed-body">
        <div class="ed-main">
          ${warmBlock()}
          <div class="row between wrap gap ed-exhead"><div><b>${t('ed.exercises')}</b> <span class="muted small">${t('ed.exSum', { n: draft.exercises.length, sets })}</span></div>
            <button type="button" class="btn accent small" data-ed="add">${t('ed.addExercise')}</button></div>
          ${draft.exercises.map(exCard).join('')}
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

  // ---------- klikken ----------
  dlg.onclick = async (ev) => {
    const path = ev.target.closest('path[data-m]');
    if (path && dlg.contains(path)) { selMuscle = selMuscle === path.dataset.m ? null : path.dataset.m; render(); return; }
    const b = ev.target.closest('[data-ed]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
    const a = b.dataset.ed, i = Number(b.dataset.i), e = exAt(i);
    switch (a) {
      case 'open': open = open === i ? -1 : i; break;
      case 'muscle': selMuscle = selMuscle === b.dataset.m ? null : b.dataset.m; break;
      case 'lock': snapshot(); draft.locked = !draft.locked; break;
      case 'move': { const d = Number(b.dataset.d), j = i + d; if (j < 0 || j >= draft.exercises.length) return; snapshot(); [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]]; if (open === i) open = j; else if (open === j) open = i; break; }
      case 'ex-del': snapshot(); draft.exercises.splice(i, 1); if (open >= draft.exercises.length) open = draft.exercises.length - 1; break;
      case 'set-add': snapshot(); e.sets.push({ ...e.sets[e.sets.length - 1] }); break;
      case 'set-del': if (e.sets.length <= 1) { ctx.toast(t('ed.lastRemoved'), true); return; } snapshot(); e.sets.splice(Number(b.dataset.j), 1); break;
      case 'equal': snapshot(); e.sets = e.sets.map(() => ({ ...e.sets[0] })); break;
      case 'ramp': snapshot(); e.rampUp = !e.rampUp; break;
      case 'pyramid': {
        // gewicht per set omhoog (ca. 7,5%), herhalingen omlaag (−2), vanaf de eerste set
        snapshot(); const s0 = e.sets[0];
        e.sets = e.sets.map((x, j) => ({ ...x, reps: Math.max(1, s0.reps - 2 * j), weight: half(s0.weight * (1 + 0.075 * j)) }));
        break;
      }
      case 'wc-del': snapshot(); draft.warmup[b.dataset.kind].splice(i, 1); break;
      case 'cool-del': snapshot(); draft.cooldown.splice(i, 1); break;
      case 'restore-warm': snapshot(); draft.warmup = clone(original.warmup); break;
      case 'restore-cool': snapshot(); draft.cooldown = clone(original.cooldown); break;
      case 'add': case 'add-warm': case 'add-cool': {
        const start = a === 'add' ? 'ex' : a === 'add-warm' ? 'warm' : 'cool';
        const ids = [...draft.exercises, ...(draft.warmup?.mobility || []), ...(draft.warmup?.cable || []), ...(draft.cooldown || [])].map((x) => x.id);
        openPicker(start, ctx, { muscleKey: selMuscle, inSession: ids }, (items, block) => {
          if (!items.length) return;
          snapshot();
          if (block === 'ex') { draft.exercises.push(...items); open = draft.exercises.length - items.length; }
          else if (block === 'warm') { draft.warmup = draft.warmup || { mobility: [], cable: [] }; for (const it of items) { const k = it.kind === 'cable' ? 'cable' : 'mobility'; delete it.kind; draft.warmup[k].push(it); } }
          else { draft.cooldown = draft.cooldown || []; draft.cooldown.push(...items); }
          render();
        });
        return;
      }
      case 'swap': {
        const k = Object.entries(e.muscles || {}).find(([, w]) => w >= 1)?.[0] || null;
        openPicker('ex', ctx, { muscleKey: k, inSession: draft.exercises.map((x) => x.id), replace: e.title }, (items) => {
          if (!items.length) return;
          snapshot(); draft.exercises[i] = items[0]; open = i; render();
        });
        return;
      }
      case 'undo': if (!undo.length) return; draft = JSON.parse(undo.pop()); changes = Math.max(0, changes - 1); break;
      case 'reset':
        if (!confirm(t('ed.resetConfirm'))) return;
        snapshot(); draft = clone(original); draft.locked = false; break;
      case 'cancel': if (changes && !confirm(t('ed.cancelConfirm'))) return; close(); return;
      case 'save': await save(); return;
      default: return;
    }
    render();
  };

  // ---------- typen ----------
  dlg.onchange = (ev) => {
    const el = ev.target; const a = el.dataset?.ed; if (!a) return;
    const i = Number(el.dataset.i), e = exAt(i);
    snapshot();
    if (a === 'name') draft.name = el.value.trim().slice(0, 40) || draft.name;
    else if (a === 'prog') e.fixed = !el.checked;
    else if (a === 'set') {
      const x = e.sets[Number(el.dataset.j)], f = el.dataset.f;
      if (f === 'reps') x.reps = Math.min(30, Math.max(1, Math.round(num(el.value, x.reps))));
      if (f === 'weight') x.weight = Math.max(0.5, half(num(el.value, x.weight)));
      if (f === 'rest') x.rest = Math.min(300, Math.max(10, Math.round(num(el.value, x.rest))));
      if (f === 'mode') x.mode = Number(el.value) || 1;
    } else if (a === 'wc') {
      const x = draft.warmup[el.dataset.kind][i];
      if (el.dataset.f === 'reps') x.reps = Math.min(60, Math.max(1, Math.round(num(el.value, x.reps))));
      if (el.dataset.f === 'weight') x.weight = half(num(el.value, x.weight));
    } else if (a === 'cool') {
      const x = draft.cooldown[i], s = Math.min(180, Math.max(5, Math.round(num(el.value, 30))));
      x.dose = /\d+\s*s\b/i.test(x.dose || '') ? x.dose.replace(/\d+\s*s\b/i, `${s} s`) : `${s} s`;
    }
    // wijziging in een veld: alleen kop en rechterkolom bijwerken
    if (a === 'set' && el.dataset.f === 'mode') render(); else { refreshSide(); const c = dlg.querySelector('.ed-name .muted'); if (c) c.textContent = changes === 1 ? t('ed.changes1') : t('ed.changes', { n: changes }); dlg.querySelector('[data-ed=undo]')?.removeAttribute('disabled'); }
  };

  async function save() {
    const p = clone(plan);
    const strip = (x) => { const c = clone(x); for (const k of ['locked', 'edited', 'original', 'estMinutes', 'pushedAt', 'changedAfterPush', 'muscles']) delete c[k]; for (const e of c.exercises || []) delete e.muscles; return JSON.stringify(c); };
    // niets meer anders dan het voorstel (bijv. na "Terug naar voorstel"): gewoon weer het voorstel
    const same = strip(draft) === strip(original);
    const s = same ? { ...clone(original), locked: !!draft.locked } : { ...clone(draft), original, edited: true, estMinutes: estMinutes(draft) };
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

  dlg.oncancel = (ev) => { if (changes && !confirm(t('ed.cancelConfirm'))) ev.preventDefault(); };
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
// sleutel van het figuur → spiergroep in de catalogus
const KEY2LIB = { pecs: 'Pecs', lats: 'Lats', traps: 'Traps', frontDelts: 'Front Delts', sideDelts: 'Side Delts', rearDelts: 'Rear Delts', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', adductors: 'Adductors', calves: 'Calves', abs: 'Abs', lowerBack: 'Back Extensors' };
const musName = (m) => { const k = 'mus.' + m; const v = t(k); return v === k ? m : v; };
const tabName = (x) => { const k = 'tab.' + x; const v = t(k); return v === k ? x : v; };

let libCache = null, pdlg = null;
const infoCache = new Map();

// Opent de kiezer. block: waar de oefeningen standaard heen gaan ('ex', 'warm' of 'cool'; te wijzigen in de kiezer).
// replace: naam van de oefening die gewisseld wordt (dan één keuze, altijd naar 'ex').
// onAdd(lijst, blok) krijgt de klaargezette oefeningen.
export async function openPicker(block, ctx, { muscleKey = null, inSession = [], replace = null } = {}, onAdd) {
  const { esc } = ctx;
  if (!pdlg) { pdlg = document.createElement('dialog'); pdlg.className = 'picker-dlg'; document.body.appendChild(pdlg); }
  pdlg.innerHTML = `<div class="pk-loading muted">${t('pk.loading')}</div>`;
  pdlg.showModal();
  try { libCache = libCache || await ctx.api('GET', '/api/library'); } catch (e) { ctx.toast(e.message, true); pdlg.close(); return; }
  const lib = libCache;
  const avoid = new Set((lib.avoid || []).map(Number));
  const inS = new Set(inSession.map(Number));
  const defTab = (bl) => (bl === 'ex' ? 'Training' : bl === 'warm' ? 'Warmup' : 'Stretch');
  const st = {
    block,
    muscle: block === 'ex' && muscleKey ? KEY2LIB[muscleKey] || null : null,
    tab: defTab(block),
    q: '', onlyDone: false, hideAvoid: true, sel: new Set(), detail: null, busy: false,
  };
  const counts = (filterTab) => {
    const c = {};
    for (const e of lib.items) if (!st.muscle || e.muscle === st.muscle) c[e.tab] = (c[e.tab] || 0) + 1;
    return c;
  };
  const filtered = () => {
    const q = st.q.trim().toLowerCase();
    return lib.items.filter((e) => (st.tab === 'all' || e.tab === st.tab) && (!st.muscle || e.muscle === st.muscle) && (!q || e.name.toLowerCase().includes(q))
      && (!st.onlyDone || lib.history[e.id]) && (!st.hideAvoid || !avoid.has(Number(e.id))))
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
        <span class="muted small">${esc(musName(e.muscle))} · ${esc(tabName(e.tab))}${inS.has(Number(e.id)) ? ` · <span class="badge">${t('pk.inSession')}</span>` : ''}${avoid.has(Number(e.id)) ? ` · <span class="badge warn">${t('pk.avoided')}</span>` : ''}</span>
        <span class="small ${h ? 'up' : 'muted'}">${h ? esc(t('pk.done', { date: h.last, sets: h.sets, times: h.times })) : t('pk.new')}</span></button>
      <span class="pk-chev" aria-hidden="true">›</span></div>`;
  }

  function detailHtml(e, info, trend, err) {
    const list = filtered(); const i = list.findIndex((x) => x.id === e.id);
    const on = st.sel.has(Number(e.id));
    const h = lib.history[e.id];
    const spark = trend?.length > 1 ? (() => { const ys = trend.map((p) => p.y), lo = Math.min(...ys), hi = Math.max(...ys) || 1; const pts = trend.map((p, j) => `${(j / (trend.length - 1)) * 600},${50 - ((p.y - lo) / (hi - lo || 1)) * 42}`).join(' '); return `<svg viewBox="0 0 600 54" preserveAspectRatio="none" class="pk-spark" role="img" aria-label="${t('pk.history')}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5"/></svg><div class="muted small">${esc(trend[0].x)}: ${String(trend[0].y).replace('.', ',')} kg → ${esc(trend[trend.length - 1].x)}: ${String(trend[trend.length - 1].y).replace('.', ',')} kg</div>`; })() : `<div class="muted small">${h ? '' : t('pk.noHistory')}</div>`;
    return `<div class="pk-dhead"><button type="button" class="btn ghost small" data-pk="back">${t('pk.back')}</button>
        <div class="row gap"><button type="button" class="btn ghost small" data-pk="nav" data-d="-1" aria-label="${t('pk.prev')}" ${i <= 0 ? 'disabled' : ''}>‹</button><button type="button" class="btn ghost small" data-pk="nav" data-d="1" aria-label="${t('pk.next')}" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>›</button></div></div>
      <div class="pk-detail">
        <h3>${esc(info?.title || e.name)}</h3>
        <div class="muted small">${esc(musName(e.muscle))} · ${esc(tabName(e.tab))}${info?.barbell ? ' · ' + t('pk.barbell') : ''}${info?.unilateral ? ' · ' + t('pk.perSide') : ''}</div>
        ${err ? `<div class="note">${esc(t('pk.infoError', { msg: err }))}</div>` : !info ? `<div class="muted">${t('pk.loading')}</div>` : `
        <div class="pk-media">
          ${info.video ? `<video controls preload="none" playsinline ${info.poster || info.img ? `poster="${esc(info.poster || info.img)}"` : ''} src="${esc(info.video)}"></video>` : info.img ? `<img src="${esc(info.img)}" alt="">` : ''}
          <div class="pk-mus"><div class="eyebrow">${t('pk.muscles')}</div>
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
        <div class="muted small">${t('pk.source')}</div>`}
        <div><div class="eyebrow">${t('pk.history')}</div>${h ? `<div class="small up">${esc(t('pk.done', { date: h.last, sets: h.sets, times: h.times }))}</div>` : ''}${spark}</div>
      </div>
      <div class="pk-dfoot">${avoid.has(Number(e.id)) ? `<span class="badge warn">${t('pk.avoided')}</span>` : `<button type="button" class="btn ghost" data-pk="avoid" data-id="${e.id}">${t('pk.avoid')}</button>`}
        <button type="button" class="btn ${on ? 'ghost' : 'accent'}" data-pk="toggle" data-id="${e.id}">${on ? t('pk.deselect') : t('pk.select')}</button></div>`;
  }

  function render() {
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
        </aside>
        <section class="pk-main">${st.detail ? '<div class="pk-dwrap"></div>' : `
          <input type="search" class="pk-search" placeholder="${esc(t('pk.search'))}" aria-label="${esc(t('pk.search'))}" value="${esc(st.q)}" data-pk="q">
          <div class="pk-tabs"><button type="button" class="chip ${st.tab === 'all' ? 'on' : ''}" data-pk="tab" data-t="all">${t('pk.all')}</button>${TABS.filter((x) => c[x]).map((x) => `<button type="button" class="chip ${st.tab === x ? 'on' : ''}" data-pk="tab" data-t="${esc(x)}">${esc(tabName(x))} · ${c[x]}</button>`).join('')}</div>
          <div class="pk-list">${list.length ? list.slice(0, 150).map(row).join('') + (list.length > 150 ? `<div class="muted small">${t('pk.more', { n: list.length - 150 })}</div>` : '') : `<div class="muted">${t('pk.none')}</div>`}</div>`}
        </section>
      </div>
      <div class="pk-foot"><span class="small">${t('pk.selected', { n: st.sel.size })}</span>
        <div class="row gap wrap">${replace ? '' : `<span class="small muted">${t('pk.target')}</span><div class="pk-target">${['warm', 'ex', 'cool'].map((x) => `<button type="button" class="chip ${st.block === x ? 'on' : ''}" data-pk="target" data-b="${x}">${t(x === 'warm' ? 'ed.warmup' : x === 'cool' ? 'ed.cooldown' : 'ed.exercises')}</button>`).join('')}</div>`}
        <button type="button" class="btn accent" data-pk="add" ${st.sel.size && !st.busy ? '' : 'disabled'}>${st.busy ? t('pk.adding') : replace ? t('pk.swap') : t('pk.add')}</button></div></div>
    </div>`;
    if (st.detail) showDetail(st.detail);
  }

  async function showDetail(id) {
    const e = lib.items.find((x) => x.id === id); if (!e) return;
    const wrap = pdlg.querySelector('.pk-dwrap'); if (!wrap) return;
    const c = infoCache.get(id);
    wrap.innerHTML = detailHtml(e, c?.info, c?.trend, c?.err);
    if (c) return;
    try { const r = await ctx.api('GET', `/api/exercise/info?id=${encodeURIComponent(id)}&lang=en`); infoCache.set(id, { info: r.info, trend: r.trend }); }
    catch (err) { infoCache.set(id, { err: err.message }); }
    if (st.detail === id) { const w = pdlg.querySelector('.pk-dwrap'); const x = infoCache.get(id); if (w) w.innerHTML = detailHtml(e, x.info, x.trend, x.err); }
  }

  pdlg.onclick = async (ev) => {
    const b = ev.target.closest('[data-pk]'); if (!b || b.tagName === 'INPUT') return;
    const a = b.dataset.pk;
    if (a === 'close') { pdlg.close(); return; }
    if (a === 'muscle') { st.muscle = b.dataset.m || null; st.detail = null; }
    else if (a === 'tab') st.tab = b.dataset.t;
    else if (a === 'detail') st.detail = isNaN(+b.dataset.id) ? b.dataset.id : +b.dataset.id;
    else if (a === 'back') st.detail = null;
    else if (a === 'nav') { const list = filtered(); const i = list.findIndex((x) => x.id === st.detail) + Number(b.dataset.d); if (list[i]) st.detail = list[i].id; }
    else if (a === 'toggle') { const id = Number(b.dataset.id); if (st.sel.has(id)) st.sel.delete(id); else { if (replace) st.sel.clear(); st.sel.add(id); } }
    else if (a === 'target') { st.block = b.dataset.b; st.tab = lib.items.some((e) => e.tab === defTab(st.block)) ? defTab(st.block) : 'all'; if (st.block !== 'ex') st.muscle = null; }
    else if (a === 'avoid') {
      const id = Number(b.dataset.id);
      try { await ctx.api('POST', '/api/avoid', { id, regenerate: false }); avoid.add(id); (lib.avoid ||= []).push(id); st.sel.delete(id); ctx.toast(t('pk.avoidedToast')); } catch (err) { ctx.toast(err.message, true); }
    }
    else if (a === 'add') {
      st.busy = true; render();
      const out = [];
      try {
        for (const id of st.sel) {
          const r = await ctx.api('POST', '/api/exercise/template', { id, block: replace ? 'ex' : st.block });
          out.push(r.exercise || r.item);
        }
        pdlg.close(); onAdd(out, replace ? 'ex' : st.block);
      } catch (err) { ctx.toast(err.message, true); st.busy = false; render(); }
      return;
    } else return;
    render();
  };
  pdlg.onchange = (ev) => {
    const el = ev.target; const a = el.dataset?.pk;
    if (a === 'sel') { const id = Number(el.dataset.id); if (el.checked) { if (replace) st.sel.clear(); st.sel.add(id); } else st.sel.delete(id); render(); }
    else if (a === 'onlyDone' || a === 'hideAvoid') { st[a] = el.checked; render(); }
  };
  pdlg.oninput = (ev) => {
    if (ev.target.dataset?.pk !== 'q') return;
    st.q = ev.target.value;
    const listEl = pdlg.querySelector('.pk-list'); const list = filtered();
    if (listEl) listEl.innerHTML = list.length ? list.slice(0, 150).map(row).join('') : `<div class="muted">${t('pk.none')}</div>`;
  };
  render();
}
