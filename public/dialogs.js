// Eigen vragen in de stijl van GymCoach, in plaats van confirm() en prompt() van de browser
// (die tonen het IP-adres van de server als afzender en passen niet bij het thema).
import { t } from './i18n.js';

// Eén sluitknop rechtsboven op elk venster. Blijft staan bij scrollen.
// Een bestaand sluitgedrag (ongeslagen editor, vraag, kiezer) blijft gelden.
function dismissDialog(dlg) {
  const own = dlg.querySelector(':scope > .dlg-x');
  const prefer = [...dlg.querySelectorAll('[data-ed="cancel"], [data-x="later"], [data-a="no"], [data-pk="close"], [data-pk="back"]')].find((el) => el !== own);
  if (prefer) { prefer.click(); return; }
  const formBtn = [...dlg.querySelectorAll('form[method="dialog"] button[value="close"], form[method="dialog"] button[value="cancel"]')].find((el) => el !== own);
  if (formBtn) { formBtn.click(); return; }
  dlg.close();
}
function ensureDlgClose(dlg) {
  if (!(dlg instanceof HTMLDialogElement)) return;
  let b = dlg.querySelector(':scope > .dlg-x');
  if (!b) {
    b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ghost small dlg-x';
    b.textContent = '✕';
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); dismissDialog(dlg); });
    dlg.prepend(b);
  }
  b.setAttribute('aria-label', t('pk.close'));
}
function watchDialogs() {
  const scan = (node) => {
    if (!(node instanceof Element)) return;
    if (node instanceof HTMLDialogElement) ensureDlgClose(node);
    node.querySelectorAll?.('dialog').forEach(ensureDlgClose);
  };
  document.querySelectorAll('dialog').forEach(ensureDlgClose);
  new MutationObserver((recs) => {
    for (const r of recs) { scan(r.target); r.addedNodes.forEach(scan); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  const orig = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function showModal() {
    ensureDlgClose(this);
    return orig.apply(this, arguments);
  };
}
if (typeof document !== 'undefined') watchDialogs();

// Bouwt en toont de dialoog; geeft een Promise met de knop (true/false) of de ingevulde tekst.
function ask({ message, input = null, okText = 'OK', cancelText = 'Annuleren', danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ask-dlg';
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    dlg.innerHTML = `<form method="dialog" class="ask-form">
      <div class="ask-head"><img src="/logo.svg" alt="" width="22" height="22"><span>GymCoach</span></div>
      <div class="ask-msg">${esc(message).replace(/\n/g, '<br>')}</div>
      ${input ? `<input class="ask-input" name="v" type="${input.type || 'text'}" value="${esc(input.value || '')}" autocomplete="off"${input.minLength ? ` minlength="${input.minLength}"` : ''} required>` : ''}
      <div class="ask-btns"><button type="button" class="btn ghost" data-a="no">${esc(cancelText)}</button><button type="submit" class="btn ${danger ? 'danger' : 'accent'}" data-a="yes">${esc(okText)}</button></div>
    </form>`;
    document.body.appendChild(dlg); // showModal zet hem in de bovenste laag, ook boven een open editor
    let done = false;
    const finish = (val) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(val); };
    const f = dlg.querySelector('form'), inp = dlg.querySelector('.ask-input');
    f.addEventListener('submit', (ev) => { ev.preventDefault(); if (inp && !inp.reportValidity()) return; finish(inp ? inp.value.trim() || null : true); });
    dlg.querySelector('[data-a=no]').addEventListener('click', () => finish(inp ? null : false));
    dlg.addEventListener('cancel', (ev) => { ev.preventDefault(); finish(inp ? null : false); });
    dlg.showModal();
    if (inp) { inp.focus(); inp.select(); } else dlg.querySelector('[data-a=yes]').focus();
  });
}

// Ja/nee-vraag. danger: rode knop voor iets dat niet terug kan.
export const askConfirm = (message, opts = {}) => ask({ message, ...opts });

// Vraag om tekst; geeft de tekst of null bij annuleren.
export const askText = (message, value = '', opts = {}) => ask({ message, input: { value, type: opts.type, minLength: opts.minLength }, ...opts });
