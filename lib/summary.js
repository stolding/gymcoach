// Samenvatting van één training: PDF (bijlage) en e-mailtekst.
import { Pdf } from './pdf.js';
import { tr, userLang } from './lang.js';
import { localeOf } from '../public/i18n.js';

setBodymapTranslator((k, v) => tr(k, v)); // spiernamen in de PDF in de taal van de gebruiker
import { bodyShapes, level, MUSCLE_LABELS, setBodymapTranslator } from '../public/bodymap.js';

const ORANGE = '#e8590c', INK = '#1c1d1f', MUTED = '#6b6e73', LINE = '#e2e0da', SOFT = '#f4f3ef', GREEN = '#2b8a3e', RED = '#c92a2a';
const nl = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString(localeOf(userLang()));
const longDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString(localeOf(userLang()), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Sets als korte tekst, bijv. "10/10/9 × 20 kg".
function setsText(sets) {
  if (!sets?.length) return '—';
  const sameW = sets.every((s) => s.weight === sets[0].weight);
  if (sameW && sets.every((s) => s.reps === sets[0].reps)) return `${sets.length} × ${sets[0].reps} @ ${nl(sets[0].weight)} kg`;
  if (sameW) return `${sets.map((s) => s.reps).join('/')} @ ${nl(sets[0].weight)} kg`;
  return sets.map((s) => `${s.reps}×${nl(s.weight)}`).join(', ') + ' kg';
}

// kerncijfers, ook voor de e-mail
export function highlights(d) {
  const weighted = d.exercises.filter((e) => e.top > 0);
  const up = weighted.filter((e) => e.prev && e.prev.topDelta > 0);
  const prs = weighted.filter((e) => e.prev && e.prev.e1rmDelta > 0);
  const missed = weighted.reduce((n, e) => n + e.sets.filter((s) => s.target && s.reps < s.target).length, 0);
  const sets = d.exercises.reduce((n, e) => n + e.sets.length, 0);
  const reps = d.exercises.reduce((n, e) => n + e.sets.reduce((t, s) => t + (s.reps || 0), 0), 0);
  return { weighted, up, prs, missed, sets, reps };
}

// Het trainingsrapport als PDF: kerncijfers, spierkaart, oefeningen, vergelijking, hartslag en tijd.
export function workoutPdf(d, { userName = '', figure = 'neutraal' } = {}) {
  const pdf = new Pdf();
  const L = 48, R = 547;
  const h = highlights(d);

  // kop
  pdf.rect(0, 0, 595, 6, { fill: ORANGE });
  pdf.text(L, 44, tr('sum.gymcoachTrainingssamenvatting'), { size: 8.5, bold: true, color: ORANGE });
  pdf.text(R, 44, userName, { size: 9, color: MUTED, align: 'right' });
  pdf.text(L, 74, d.title, { size: 22, bold: true, maxWidth: R - L });
  const dateLine = longDate(d.date);
  pdf.text(L, 94, dateLine.charAt(0).toUpperCase() + dateLine.slice(1), { size: 11, color: MUTED });

  // tegels
  const tiles = [
    [tr('ed.duration'), d.minutes != null ? `${d.minutes} min` : '—'],
    [tr('ed.exercises'), String(d.exercises.length || '—')],
    [tr('ed.sets'), String(h.sets || '—')],
    [tr('ed.volume'), d.volume ? `${nl(d.volume, 0)} kg` : '—'],
    [tr('sum.calories'), d.calories != null ? `${d.calories} kcal` : '—'],
  ];
  if (d.calories == null && d.healthKcal != null) tiles[4] = [tr('sum.calories'), `${d.healthKcal} kcal`];
  if (d.hrAvg || d.hrMax) tiles.push([tr('sum.hartslag'), `${d.hrAvg ?? '—'}${d.hrMax ? `/${d.hrMax}` : ''}`]);
  if (d.completion != null) tiles.push(['Voltooid', `${d.completion}%`]);
  const tw = (R - L - (tiles.length - 1) * 8) / tiles.length;
  tiles.forEach(([l, v], i) => {
    const x = L + i * (tw + 8);
    pdf.rect(x, 112, tw, 52, { fill: SOFT });
    pdf.text(x + 8, 130, l.toUpperCase(), { size: 7, bold: true, color: MUTED, maxWidth: tw - 12 });
    pdf.text(x + 8, 152, v, { size: tiles.length > 6 ? 11.5 : tiles.length > 5 ? 13 : 14, bold: true, maxWidth: tw - 12 });
  });

  // anatomisch overzicht: welke spiergroepen deze training raakte
  let y = 190;
  const mus = Object.entries(d.muscles || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (mus.length) {
    const { FRONT, FRONT_BASE, BACK, BACK_BASE } = bodyShapes(figure);
    const max = mus[0][1];
    const FILL = ['#ecebe7', '#f8cfae', '#f39a5c', '#e8590c'];
    const sc = 0.42, top = y - 4;
    pdf.text(L, y, tr('sum.getraindeSpiergroepen'), { size: 7.5, bold: true, color: MUTED });
    const fig = (dx, shapes, base) => {
      for (const b of base) pdf.path(b, { x: L + dx, y: top + 10, scale: sc, fill: '#e2e0da' });
      for (const [k, dd] of shapes) pdf.path(dd, { x: L + dx, y: top + 10, scale: sc, fill: FILL[level(d.muscles[k], max)], stroke: '#ffffff', lineWidth: 0.4 });
    };
    fig(0, FRONT, FRONT_BASE); fig(200 * sc, BACK, BACK_BASE);
    pdf.text(L + 100 * sc, top + 10 + 412 * sc, tr('sum.voor'), { size: 7, color: MUTED, align: 'center' });
    pdf.text(L + 300 * sc, top + 10 + 412 * sc, tr('sum.achter'), { size: 7, color: MUTED, align: 'center' });
    // lijst met balkjes
    const lx = L + 400 * sc + 24, bw = R - lx - 150;
    let ly = y + 18;
    for (const [k, v] of mus.slice(0, 9)) {
      pdf.text(lx, ly, MUSCLE_LABELS[k] || k, { size: 9, maxWidth: 110 });
      pdf.rect(lx + 115, ly - 7, bw, 7, { fill: '#efede8' });
      pdf.rect(lx + 115, ly - 7, Math.max(2, (v / max) * bw), 7, { fill: FILL[Math.max(1, level(v, max))] });
      pdf.text(R, ly, tr('app.sets2', { a: nl(v) }), { size: 8.5, color: MUTED, align: 'right' });
      ly += 17;
    }
    pdf.text(lx, Math.max(ly, y + 18) + 4, tr('sum.inclusiefMeetrainendeSpierenHalf'), { size: 7.5, color: MUTED });
    y = top + 10 + 424 * sc + 18;
  }

  // hoogtepunten
  const notes = [];
  if (h.prs.length) notes.push([GREEN, tr('sum.note.records', { n: h.prs.length, names: h.prs.slice(0, 2).map((e) => e.name).join(', ') + (h.prs.length > 2 ? tr('sum.andMore') : '') })]);
  if (h.up.length) notes.push([GREEN, tr('sum.note.heavier', { n: h.up.length })]);
  if (h.missed) notes.push([RED, tr('sum.note.missed', { n: h.missed })]);
  if (!notes.length) notes.push([MUTED, tr('sum.note.onPlan')]);
  for (const [c, t] of notes) {
    pdf.rect(L, y - 7, 4, 4, { fill: c });
    pdf.text(L + 12, y - 2, t, { size: 10, color: INK, maxWidth: R - L - 12 });
    y += 16;
  }

  y = insightsPdf(pdf, d, y + 10, L, R);

  // tabel
  y += 14;
  if (y > 700) { pdf.addPage(); y = 50; }
  const cols = [[L, tr('app.oefening'), 'left'], [300, tr('ed.sets'), 'left'], [440, tr('sum.col.heaviest'), 'right'], [R, tr('sum.col.vsPrev'), 'right']];
  const header = () => {
    for (const [x, t, a] of cols) pdf.text(x, y, t.toUpperCase(), { size: 7.5, bold: true, color: MUTED, align: a });
    y += 8; pdf.line(L, y, R, y, { color: '#c9c7c0' }); y += 4;
  };
  header();
  let n = 0;
  for (const e of d.exercises) {
    const rowH = e.muscle ? 30 : 22;
    if (y + rowH > 790) { pdf.addPage(); y = 50; header(); }
    n++;
    const top = y + 14;
    pdf.text(L, top, `${n}. ${e.name}`, { size: 10, bold: true, maxWidth: 245 });
    if (e.muscle) pdf.text(L + 12, top + 12, e.muscle, { size: 8.5, color: MUTED, maxWidth: 235 });
    if (e.top > 0) {
      pdf.text(300, top, setsText(e.sets), { size: 9.5, maxWidth: 125 });
      const missed = e.sets.filter((s) => s.target && s.reps < s.target).length;
      if (e.sets[0]?.target) pdf.text(300, top + 12, tr('sum.doelHerh', { target: e.sets[0].target, a: missed ? tr('sum.missedN', { n: missed }) : '' }), { size: 8, color: missed ? RED : MUTED });
      pdf.text(440, top, `${nl(e.top)} kg`, { size: 10, bold: true, align: 'right' });
      if (e.prev) {
        const dlt = e.prev.topDelta;
        pdf.text(R, top, dlt > 0 ? tr('app.kg', { a: nl(dlt) }) : dlt < 0 ? `${nl(dlt)} kg` : tr('app.gelijk'), { size: 10, bold: dlt !== 0, color: dlt > 0 ? GREEN : dlt < 0 ? RED : MUTED, align: 'right' });
        pdf.text(R, top + 12, setsText(e.prev.sets), { size: 8, color: MUTED, align: 'right', maxWidth: 105 });
      } else pdf.text(R, top, tr('app.eersteKeer'), { size: 9, color: MUTED, align: 'right' });
    } else {
      const reps = e.sets.reduce((t, s) => t + (s.reps || 0), 0);
      pdf.text(300, top, tr('sum.zonderGewicht', { a: e.sets.length ? ` · ${tr('app.setsN', { n: e.sets.length })}` : '', b: reps ? ` · ${reps}` : '' }), { size: 9, color: MUTED });
    }
    y += rowH + 4;
    pdf.line(L, y - 2, R, y - 2, { color: LINE });
  }
  if (!d.exercises.length) { pdf.text(L, y + 16, tr('sum.voorDezeTrainingZijn'), { size: 10, color: MUTED }); }

  // voettekst op elke pagina
  pdf.pages.forEach((ops, i) => {
    pdf.cur = ops;
    pdf.line(L, 806, R, 806, { color: LINE });
    pdf.text(L, 820, tr('sum.gymcoachGegevensVanJe'), { size: 8, color: MUTED });
    pdf.text(R, 820, `${i + 1} / ${pdf.pages.length}`, { size: 8, color: MUTED, align: 'right' });
  });
  return pdf.toBuffer({ title: `${d.title} - ${d.date}` });
}

const ZONE_COLORS = ['#7aa2c9', '#5bb98b', '#e0c050', '#f08c3a', '#e05555'];
const lighten = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [16, 8, 0].map((sh) => Math.round(((n >> sh) & 255) + (255 - ((n >> sh) & 255)) * f).toString(16).padStart(2, '0')).join(''); };
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// vergelijking, tijd onder spanning en hartslagverloop
function insightsPdf(pdf, d, y, L, R) {
  const c = d.compare, t = d.time, h = d.heart;
  if (c || t) {
    const both = c && t, gap = 16, w = both ? (R - L - gap) / 2 : R - L;
    const hgt = Math.max(c ? 34 + c.rows.length * 15 : 0, t ? 108 : 0);
    if (y + hgt > 790) { pdf.addPage(); y = 50; }
    let x = L;
    if (c) {
      pdf.rect(x, y, w, hgt, { stroke: LINE, lineWidth: 0.7 });
      pdf.text(x + 10, y + 16, (c.basis === 'same' ? tr('sum.vergelekenMetDeLaatste', { n: c.n }) : tr('sum.vergelekenMetJeLaatste', { n: c.n })), { size: 7, bold: true, color: MUTED, maxWidth: w - 20 });
      let ry = y + 34;
      const v = (r, x2) => `${Math.round(x2).toLocaleString(localeOf(userLang()))}${r.unit ? ' ' + r.unit : ''}`;
      for (const r of c.rows) {
        pdf.text(x + 10, ry, r.label, { size: 9 });
        pdf.text(x + w * 0.56, ry, v(r, r.cur), { size: 9, bold: true, align: 'right' });
        pdf.text(x + w * 0.84, ry, tr('app.gem2', { a: v(r, r.ref) }), { size: 8, color: MUTED, align: 'right' });
        const col = r.label === 'Gem. hartslag' ? MUTED : r.pct > 2 ? GREEN : r.pct < -2 ? RED : MUTED;
        pdf.text(x + w - 10, ry, `${r.pct > 0 ? '+' : ''}${r.pct}%`, { size: 9, bold: col !== MUTED, color: col, align: 'right' });
        ry += 15;
      }
      x += w + gap;
    }
    if (t) {
      pdf.rect(x, y, w, hgt, { stroke: LINE, lineWidth: 0.7 });
      pdf.text(x + 10, y + 16, tr('sum.tijdOnderSpanning'), { size: 7, bold: true, color: MUTED });
      const dur = t.duration || 0;
      pdf.text(x + 10, y + 38, `${mmss(t.tut)} min`, { size: 17, bold: true });
      if (dur) pdf.text(x + w - 10, y + 38, tr('sum.vanDeTraining', { a: Math.round((t.tut / dur) * 100) }), { size: 8.5, color: MUTED, align: 'right' });
      if (dur) {
        const rest = Math.min(t.rest || 0, Math.max(0, dur - t.tut)), other = Math.max(0, dur - t.tut - rest);
        const bw = w - 20; let bx = x + 10;
        for (const [v, col] of [[t.tut, ORANGE], [rest, '#6c9cff'], [other, '#e2e0da']]) { if (!v) continue; const ww = (v / dur) * bw; pdf.rect(bx, y + 48, ww, 7, { fill: col }); bx += ww; }
        let ly = y + 68;
        for (const [lbl, v, col] of [[tr('sum.tut.load'), t.tut, ORANGE], [tr('sum.tut.rest'), rest, '#6c9cff'], [tr('sum.tut.other'), other, '#c9c7c0']]) {
          if (!v) continue;
          pdf.rect(x + 10, ly - 6, 6, 6, { fill: col });
          pdf.text(x + 21, ly, lbl, { size: 8 }); pdf.text(x + w - 10, ly, mmss(v), { size: 8, bold: true, align: 'right' });
          ly += 11;
        }
      }
      if (t.perRep) pdf.text(x + 10, y + hgt - 6, tr('sum.gemSPerHerhaling', { a: nl(t.perRep) }), { size: 7.5, color: MUTED });
    }
    y += hgt + 16;
  }
  const parts = h ? [h.series ? { ...h, perSet: null, title: tr('sum.hartslagTijdensDeTraining') } : null, h.perSet ? { ...h, series: null, title: tr('sum.hartslagPerSet') } : null].filter(Boolean) : [];
  for (const h of parts) {
    const H0 = 110, hgt = H0 + (h.series && h.zones ? 64 : 34);
    if (y + hgt + 14 > 790) { pdf.addPage(); y = 50; }
    pdf.text(L, y + 8, h.title, { size: 7.5, bold: true, color: MUTED });
    const top = y + 16, cl = L + 28, cr = R, cb = top + H0;
    const vals = h.series ? h.series.flatMap((p) => [p[1], p[2] ?? p[1]]) : h.perSet.map((p) => p.hr);
    let lo = Math.min(...vals) - 8, hi = Math.max(...vals) + 6;
    if (h.ref) { lo = Math.min(lo, h.ref.max * 0.5); }
    const Y = (v) => top + (1 - (v - lo) / (hi - lo)) * H0;
    (h.zones || []).forEach((z, i) => {
      const a = Math.min(hi, z.bpmTo), b = Math.max(lo, z.bpmFrom);
      if (a > b) { pdf.rect(cl, Y(a), cr - cl, Y(b) - Y(a), { fill: lighten(ZONE_COLORS[i], 0.82) }); pdf.text(cr - 4, Y(a) + 8, `Z${z.z}`, { size: 6.5, color: ZONE_COLORS[i], align: 'right' }); }
    });
    for (let i = 0; i <= 3; i++) { const v = lo + ((hi - lo) * i) / 3; pdf.line(cl, Y(v), cr, Y(v), { color: '#ebe9e3', width: 0.4 }); pdf.text(cl - 4, Y(v) + 3, String(Math.round(v)), { size: 7, color: MUTED, align: 'right' }); }
    if (h.series) {
      const s = h.series, t1 = Math.max(60, s[s.length - 1][0]);
      const X = (tt) => cl + (tt / t1) * (cr - cl);
      pdf.path('M ' + s.map((p) => `${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' L '), { stroke: ORANGE, lineWidth: 1.4 });
      const step = t1 > 3600 ? 900 : t1 > 1800 ? 600 : 300;
      for (let tt = 0; tt <= t1; tt += step) pdf.text(X(tt), cb + 10, `${Math.round(tt / 60)} min`, { size: 7, color: MUTED, align: 'center' });
      if (h.zones) {
        const tot = h.zones.reduce((a, z) => a + z.min, 0) || 1;
        let bx = cl; const by = cb + 18;
        h.zones.forEach((z, i) => { if (!z.min) return; const ww = (z.min / tot) * (cr - cl); pdf.rect(bx, by, ww, 6, { fill: ZONE_COLORS[i] }); bx += ww; });
        let lx = cl;
        h.zones.forEach((z, i) => {
          pdf.rect(lx, by + 13, 6, 6, { fill: ZONE_COLORS[i] });
          lx += 9 + pdf.text(lx + 9, by + 19, tr('sum.zMin', { z: z.z, label: z.label, a: Math.round(z.min) }), { size: 7.5 }) + 12;
        });
      }
    } else {
      const ps = h.perSet, bw = (cr - cl) / ps.length;
      ps.forEach((p, i) => pdf.rect(cl + i * bw + bw * 0.2, Y(p.hr), bw * 0.6, cb - Y(p.hr), { fill: ORANGE }));
      pdf.text(cl, cb + 10, tr('app.set1'), { size: 7, color: MUTED }); pdf.text(cr, cb + 10, tr('app.set', { n: ps.length }), { size: 7, color: MUTED, align: 'right' });
    }
    const note = h.series ? tr('sum.hr.source', { src: h.source }) + (h.ref ? tr('sum.hr.zonesMax', { max: h.ref.max, how: h.ref.how }) : '') : tr('sum.hr.perSet') + (h.ref ? tr('sum.hr.zones', { max: h.ref.max }) : '');
    pdf.text(L, y + hgt + 6, note, { size: 7.5, color: MUTED, maxWidth: R - L });
    y += hgt + 18;
  }
  return y;
}

// korte e-mailtekst (platte tekst en HTML)
export function workoutMail(d, { userName = '', appUrl = '' } = {}) {
  const h = highlights(d);
  const when = longDate(d.date);
  const subject = tr('sum.mail.subject', { when: when.replace(/^\w+ /, ''), title: d.title });
  const lines = [
    tr('sum.mail.hi', { name: userName || tr('sum.mail.there') }),
    '',
    tr('sum.mail.intro', { title: d.title, when }),
    '',
    tr('sum.mail.stats', { min: d.minutes ?? '—', ex: d.exercises.length, sets: h.sets, vol: nl(d.volume || 0, 0) }) + (d.calories != null ? ` · ${d.calories} kcal` : '') + (d.hrAvg ? tr('sum.mail.hr', { avg: d.hrAvg, max: d.hrMax ? tr('sum.mail.hrMax', { max: d.hrMax }) : '' }) : ''),
    h.prs.length ? tr('sum.mail.records', { names: h.prs.map((e) => e.name).join(', ') }) : '',
    h.up.length ? tr('sum.mail.heavier', { names: h.up.map((e) => e.name).join(', ') }) : '',
    '',
    tr('sum.mail.pdf'),
    appUrl ? tr('sum.mail.open', { url: appUrl }) : '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  const text = lines.join('\r\n');
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tile = (l, v) => `<td style="padding:10px 14px;background:#f4f3ef;border-radius:8px"><div style="font-size:11px;color:#6b6e73;text-transform:uppercase;letter-spacing:.05em">${l}</div><div style="font-size:18px;font-weight:700;color:#1c1d1f">${escH(v)}</div></td>`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1d1f">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="height:4px;background:#e8590c;border-radius:2px"></div>
<p style="font-size:12px;font-weight:700;color:#e8590c;letter-spacing:.08em;margin:16px 0 4px">GYMCOACH</p>
<h1 style="font-size:22px;margin:0">${escH(d.title)}</h1>
<p style="color:#6b6e73;margin:4px 0 16px">${escH(when)}</p>
<table cellspacing="6" style="margin:0 -6px"><tr>${tile(tr('ed.duration'), `${d.minutes ?? '—'} min`)}${tile(tr('ed.sets'), h.sets)}${tile(tr('ed.volume'), `${nl(d.volume || 0, 0)} kg`)}${d.calories != null ? tile('kcal', d.calories) : ''}${d.hrAvg ? tile(tr('sum.hartslag'), `${d.hrAvg}${d.hrMax ? '/' + d.hrMax : ''} bpm`) : ''}</tr></table>
${h.prs.length ? `<p style="color:#2b8a3e;font-weight:600">${tr('sum.nieuwRecordBij', { a: escH(h.prs.map((e) => e.name).join(', ')) })}</p>` : ''}
${h.up.length ? `<p style="color:#2b8a3e">${tr('sum.zwaarderDanVorigeKeer', { a: escH(h.up.map((e) => e.name).join(', ')) })}</p>` : ''}
<p>${tr('sum.deVolledigeSamenvattingMet')}</p>
${appUrl ? `<p><a href="${escH(appUrl)}" style="display:inline-block;background:#e8590c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">${tr('sum.openGymcoach')}</a></p>` : ''}
<p style="color:#9a9ca1;font-size:12px;margin-top:24px">${tr('sum.jeKrijgtDezeMail')}</p>
</div></body></html>`;
  return { subject, text, html };
}
