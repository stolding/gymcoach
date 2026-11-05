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
      ${!items.length && (original.warmup?.mobility?.length || original.warmup?.cable?.length) ? `<button type="button" class="btn ghost small" data-ed="restore-warm">${t('ed.restoreBlock')}</button>` : ''}</div>
      ${items.length ? `<div class="ed-wc">${items.map(([kind, i, x]) => `<div class="ed-wci"><span>${esc(x.title)}</span>
        ${kind === 'cable' ? `<label>${t('ed.reps')}<input type="number" min="1" max="30" value="${x.reps}" data-ed="wc" data-kind="cable" data-i="${i}" data-f="reps"></label><label>${t('ed.kg')}<input type="number" min="0" step="0.5" value="${x.weight}" data-ed="wc" data-kind="cable" data-i="${i}" data-f="weight"></label>`
        : `<label>${t('ed.reps')}<input type="number" min="1" max="60" value="${x.reps}" data-ed="wc" data-kind="mobility" data-i="${i}" data-f="reps"></label>`}
        <button type="button" class="ed-x" aria-label="${t('ed.remove')}" data-ed="wc-del" data-kind="${kind}" data-i="${i}">×</button></div>`).join('')}</div>` : `<div class="muted small">${t('ed.empty')}</div>`}
    </section>`;
  }
  function coolBlock() {
    const items = draft.cooldown || [];
    return `<section class="card ed-block"><div class="row between wrap gap"><div><b>${t('ed.cooldown')}</b> <span class="muted small">${t('ed.blockSum', { n: items.length, min: items.length ? 4 : 0 })}</span></div>
      ${!items.length && original.cooldown?.length ? `<button type="button" class="btn ghost small" data-ed="restore-cool">${t('ed.restoreBlock')}</button>` : ''}</div>
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
      case 'add': ctx.toast(t('ed.addSoon')); return;
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
