// Taalkeuze met vlaggetjes (inlogscherm en menubalk). Vlaggen als kleine SVG, zodat ze overal hetzelfde
// tonen (Windows heeft geen vlag-emoji).
import { t, LANGS, getLang } from './i18n.js';

const FLAGS = {
  nl: '<rect width="30" height="20" fill="#21468b"/><rect width="30" height="13.33" fill="#fff"/><rect width="30" height="6.67" fill="#ae1c28"/>',
  de: '<rect width="30" height="20" fill="#ffce00"/><rect width="30" height="13.33" fill="#dd0000"/><rect width="30" height="6.67" fill="#000"/>',
  en: '<clipPath id="ukc"><rect width="30" height="20"/></clipPath><g clip-path="url(#ukc)"><rect width="30" height="20" fill="#012169"/>'
    + '<path d="M0,0 30,20 M30,0 0,20" stroke="#fff" stroke-width="4"/><path d="M0,0 30,20 M30,0 0,20" stroke="#c8102e" stroke-width="1.6"/>'
    + '<path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="6"/><path d="M15,0 V20 M0,10 H30" stroke="#c8102e" stroke-width="3.6"/></g>',
  no: '<rect width="30" height="20" fill="#ba0c2f"/><rect x="8.18" width="5.45" height="20" fill="#fff"/><rect y="7.5" width="30" height="5" fill="#fff"/><rect x="9.55" width="2.73" height="20" fill="#00205b"/><rect y="8.75" width="30" height="2.5" fill="#00205b"/>',
};
export const flagSvg = (code) => (FLAGS[code]
  ? `<svg class="flag" viewBox="0 0 30 20" width="22" height="15" aria-hidden="true">${FLAGS[code]}</svg>`
  : '<svg class="flag" viewBox="0 0 30 20" width="22" height="15" aria-hidden="true"><rect width="30" height="20" rx="2" fill="#555"/></svg>');

// De keuze van het inlogscherm, per browser bewaard (geldt tot je in de app zelf een taal kiest).
const KEY = 'gc-lang';
export const storedLang = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const storeLang = (c) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch {} };

// Tekent een vlaggetjes-pulldown in el. opts.auto: ook "Automatisch" tonen; opts.value: huidige keuze
// ('' = automatisch); opts.onPick(code) bij een keuze.
export function langPicker(el, { auto = false, value = getLang(), onPick } = {}) {
  const shown = value || getLang();
  const items = [...(auto ? [{ code: '', name: t('lang.auto') }] : []), ...LANGS];
  el.classList.add('langpick');
  el.innerHTML = `<button type="button" class="btn ghost lp-btn" aria-haspopup="listbox" aria-expanded="false" title="${t('lang.label')}" aria-label="${t('lang.label')}">${flagSvg(shown)}<span class="lp-code">${shown.toUpperCase()}</span><span class="lp-caret" aria-hidden="true">▾</span></button>
    <ul class="lp-menu hidden" role="listbox" aria-label="${t('lang.label')}">${items.map((l) => `<li role="option" tabindex="-1" data-lang="${l.code}" aria-selected="${l.code === value}" class="${l.code === value ? 'on' : ''}">${l.code ? flagSvg(l.code) : '<span class="flag lp-auto" aria-hidden="true">🌐</span>'}<span>${l.name}</span></li>`).join('')}</ul>`;
  const btn = el.querySelector('.lp-btn'), menu = el.querySelector('.lp-menu');
  const open = (on) => { menu.classList.toggle('hidden', !on); btn.setAttribute('aria-expanded', String(on)); if (on) (menu.querySelector('.on') || menu.firstElementChild).focus(); };
  btn.onclick = (e) => { e.stopPropagation(); open(menu.classList.contains('hidden')); };
  menu.onclick = (e) => { const li = e.target.closest('[data-lang]'); if (!li) return; open(false); if (li.dataset.lang !== value) onPick?.(li.dataset.lang); };
  menu.onkeydown = (e) => {
    const lis = [...menu.children], i = lis.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); lis[(i + 1) % lis.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); lis[(i - 1 + lis.length) % lis.length].focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
    else if (e.key === 'Escape') { open(false); btn.focus(); }
  };
  if (!el.dataset.lpBound) { // één keer per element, ook als de keuze opnieuw getekend wordt
    el.dataset.lpBound = '1';
    document.addEventListener('click', (e) => { if (!el.contains(e.target)) { el.querySelector('.lp-menu')?.classList.add('hidden'); el.querySelector('.lp-btn')?.setAttribute('aria-expanded', 'false'); } });
  }
}
