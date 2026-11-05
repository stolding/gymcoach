// Kleine PDF-schrijver zonder afhankelijkheden: tekst (Helvetica), rechthoeken en lijnen op A4.
// Coördinaten van linksboven, in punten (A4 = 595 × 842).

const W = 595, H = 842;

// tekenbreedtes (per 1000) van Helvetica en Helvetica-Bold voor tekens 32–126
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

// tekens buiten ASCII die WinAnsi kent, plus vervangingen voor wat het niet kent
const WIN = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '™': 153 };
const SUBST = { '−': '-', '↑': '+', '↓': '-', '→': '>', '≈': '~', '✓': 'v', '′': "'", '\u202f': ' ', '\u00a0': ' ', '\uff08': ' (', '\uff09': ')', '\uff0c': ',', '\uff1a': ':' };

// Zet tekst om naar WinAnsi (de codering van de standaardlettertypen in PDF).
function toWin(str) {
  const out = [];
  for (const ch of [...String(str)].map((x) => SUBST[x] ?? x).join('')) {
    const c = ch.codePointAt(0);
    if (c < 128) out.push(c);
    else if (WIN[ch]) out.push(WIN[ch]);
    else if (c >= 160 && c <= 255) out.push(c); // Latin-1: é, ë, ×, ·, °, ½ …
    else out.push(63); // ?
  }
  return out;
}

// Breedte van een tekst in punten (Helvetica), voor uitlijnen en afbreken.
export function textWidth(str, size, bold = false) {
  const t = bold ? HELVB : HELV;
  let w = 0;
  for (const c of toWin(str)) {
    if (c >= 32 && c <= 126) w += t[c - 32];
    else if (c === 150) w += 556; else if (c === 151) w += 1000; else if (c === 183 || c === 149) w += 278;
    else if (c === 215) w += 584; else w += 556;
  }
  return (w / 1000) * size;
}

const esc = (bytes) => bytes.map((b) => (b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : String.fromCharCode(b))).join('');
const rgb = (hex) => { const n = parseInt(String(hex).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' '); };
const f2 = (n) => (Math.round(n * 100) / 100).toString();

export class Pdf {
  constructor() { this.pages = []; this.addPage(); }
  get width() { return W; }
  get height() { return H; }
  addPage() { this.cur = []; this.pages.push(this.cur); return this; }

  rect(x, y, w, h, { fill, stroke, lineWidth = 0.8 } = {}) {
    const ops = [];
    if (fill) ops.push(`${rgb(fill)} rg`);
    if (stroke) ops.push(`${rgb(stroke)} RG ${f2(lineWidth)} w`);
    ops.push(`${f2(x)} ${f2(H - y - h)} ${f2(w)} ${f2(h)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
    this.cur.push(ops.join(' '));
  }
  line(x1, y1, x2, y2, { color = '#d9d9d9', width = 0.6 } = {}) {
    this.cur.push(`${rgb(color)} RG ${f2(width)} w ${f2(x1)} ${f2(H - y1)} m ${f2(x2)} ${f2(H - y2)} l S`);
  }
  // SVG-pad (M/L/Q/C/Z, absoluut; 'a' alleen als volledige ellips zoals bij het hoofd) met schaal en verplaatsing
  path(d, { x = 0, y = 0, scale = 1, fill, stroke, lineWidth = 0.6 } = {}) {
    const P = (px, py) => `${f2(x + px * scale)} ${f2(H - (y + py * scale))}`;
    const tok = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    let i = 0, cx = 0, cy = 0, sx = 0, sy = 0, cmd = '';
    const n = () => Number(tok[i++]);
    const ops = [];
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      if (cmd === 'M') { cx = n(); cy = n(); sx = cx; sy = cy; ops.push(`${P(cx, cy)} m`); cmd = 'L'; }
      else if (cmd === 'L') { cx = n(); cy = n(); ops.push(`${P(cx, cy)} l`); }
      else if (cmd === 'Q') {
        const qx = n(), qy = n(), ex = n(), ey = n();
        const c1 = [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)], c2 = [ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey)];
        ops.push(`${P(...c1)} ${P(...c2)} ${P(ex, ey)} c`); cx = ex; cy = ey;
      } else if (cmd === 'C') { const a = [n(), n()], b = [n(), n()], e = [n(), n()]; ops.push(`${P(...a)} ${P(...b)} ${P(...e)} c`); [cx, cy] = e; }
      else if (cmd === 'a') {
        const rx = n(), ry = n(); n(); n(); n(); n(); n();
        const ecx = cx, ecy = cy + ry, k = 0.5523;
        const pts = [[ecx, ecy - ry], [ecx + rx, ecy], [ecx, ecy + ry], [ecx - rx, ecy]];
        ops.push(`${P(...pts[0])} m`);
        ops.push(`${P(ecx + k * rx, ecy - ry)} ${P(ecx + rx, ecy - k * ry)} ${P(...pts[1])} c`);
        ops.push(`${P(ecx + rx, ecy + k * ry)} ${P(ecx + k * rx, ecy + ry)} ${P(...pts[2])} c`);
        ops.push(`${P(ecx - k * rx, ecy + ry)} ${P(ecx - rx, ecy + k * ry)} ${P(...pts[3])} c`);
        ops.push(`${P(ecx - rx, ecy - k * ry)} ${P(ecx - k * rx, ecy - ry)} ${P(...pts[0])} c`);
      } else if (cmd === 'Z' || cmd === 'z') { ops.push('h'); cx = sx; cy = sy; cmd = ''; }
      else i++;
    }
    const paint = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.cur.push(`${fill ? rgb(fill) + ' rg ' : ''}${stroke ? rgb(stroke) + ' RG ' + f2(lineWidth) + ' w ' : ''}${ops.join(' ')} ${paint}`);
  }
  // y = basislijn van de tekst
  text(x, y, str, { size = 10, bold = false, color = '#1c1d1f', align = 'left', maxWidth } = {}) {
    let s = String(str ?? '');
    if (maxWidth) while (s.length > 1 && textWidth(s, size, bold) > maxWidth) s = s.slice(0, -2) + '…';
    const w = textWidth(s, size, bold);
    const tx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.cur.push(`BT /${bold ? 'F2' : 'F1'} ${f2(size)} Tf ${rgb(color)} rg ${f2(tx)} ${f2(H - y)} Td (${esc(toWin(s))}) Tj ET`);
    return w;
  }

  toBuffer({ title = 'GymCoach' } = {}) {
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    const catalog = add(null), pages = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fb = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    for (const ops of this.pages) {
      const stream = ops.join('\n');
      const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${fb} 0 R >> >> /Contents ${content} 0 R >>`));
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
    objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
    const info = add(`<< /Title (${esc(toWin(title))}) /Producer (GymCoach) >>`);
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}
