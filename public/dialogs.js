// Eigen vragen in de stijl van GymCoach, in plaats van confirm() en prompt() van de browser
// (die tonen het IP-adres van de server als afzender en passen niet bij het thema).

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
