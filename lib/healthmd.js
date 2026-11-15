// De gezondheidsstatus is Markdown. De telefoon krijgt er blokken van, zodat koppen en de tabel heel blijven.

const CATS = [['body', 'score.cat.body'], ['heart', 'score.cat.heart'], ['fitness', 'score.cat.fitness'], ['other', 'score.cat.other']];

export function healthCol(label) {
  const s = String(label || '').trim().toLowerCase();
  if (/[\u0394\u2206\u03B4]/.test(label) || /delta|verschil|änderung|aenderung|change|endring/.test(s)) return 'delta';
  if (s.includes('trend') || /pijl|richting|arrow/.test(s)) return 'trend';
  if (/beoordel|oordeel|assessment|rating|bewertung|vurdering|duiding/.test(s)) return 'judge';
  return '';
}

// Goed, aandacht of neutraal. Een pijl omhoog is niet vanzelf gunstig.
export function healthTone(judge) {
  const s = String(judge || '').toLowerCase();
  if (/slecht|risico|ongunstig|verhoogd|te hoog|te laag|poor|elevated|schlecht|risiko|erhöht|dårlig|forhøyet/.test(s)) return 'bad';
  if (/let op|attention|caution|achtung|pass på/.test(s)) return 'watch';
  if (/onderkant|bovenkant|below average|above average|unteres mittel|øvre|nedre|matig|moderate|mäßig|moderat/.test(s)) return 'watch';
  if (/\bgoed\b|gunstig|prima|uitstekend|\bgood\b|favour|favor|günstig|\bgut\b|\bbra\b|utmerket/.test(s)) return 'good';
  return 'flat';
}

function headingIcon(text) {
  const s = String(text || '').toLowerCase();
  if (/score/.test(s)) return 'heart.text.square';
  if (/samen|summary|zusammen|oppsummer/.test(s)) return 'text.alignleft';
  if (/tabel|table|trend/.test(s)) return 'tablecells';
  if (/goed|going well|läuft gut|gar bra|positiv/.test(s)) return 'checkmark.circle';
  if (/aandacht|watch|achtung|oppmerk|attention/.test(s)) return 'exclamationmark.triangle';
  if (/verband|link|zusammenhang|sammenheng/.test(s)) return 'link';
  if (/advies|advice|empfehl|råd|rat\b/.test(s)) return 'lightbulb';
  if (/huisarts|doctor|arzt|lege/.test(s)) return 'cross.case';
  return 'smallcircle.filled.circle';
}

function cells(row) {
  return String(row || '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function toneOf(raw, kinds) {
  const judgeAt = kinds.indexOf('judge');
  if (judgeAt >= 0) return healthTone(raw[judgeAt] || '');
  let tone = '';
  for (const c of raw) {
    const t = healthTone(c);
    if (t === 'bad') return 'bad';
    if (t === 'watch') tone = 'watch';
    else if (t === 'good' && !tone) tone = 'good';
  }
  return tone || 'flat';
}

// Koppen, alinea's, lijsten en de trendtabel. De scheidingsrij van een tabel valt weg.
export function healthBlocks(src) {
  const lines = String(src || '').split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^#{1,3}\s+/.test(line)) {
      const text = line.replace(/^#+\s+/, '').trim();
      blocks.push({ type: 'h', text, icon: headingIcon(text) });
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rawRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rawRows.push(lines[i++]);
      const parsed = rawRows.map(cells).filter((r) => r.some((c) => c && !/^:?-{2,}:?$/.test(c)));
      if (parsed.length) {
        const columns = parsed[0];
        const kinds = columns.map(healthCol);
        const rows = parsed.slice(1).filter((r) => r.some(Boolean)).map((r) => {
          const padded = columns.map((_, n) => r[n] || '');
          return { cells: padded, tone: toneOf(padded, kinds) };
        });
        if (rows.length) blocks.push({ type: 'table', columns, kinds, rows });
      }
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, '').trim());
      if (items.length) blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, '').trim());
      if (items.length) blocks.push({ type: 'ol', items });
      continue;
    }
    const para = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s+/.test(lines[i]) && !lines[i].trim().startsWith('|') && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

// Compacte score voor het telefoonscherm. Zonder totaalscore is er niets te tonen.
export function scoreBlock(view, tr) {
  const rec = view?.record;
  if (!rec || rec.total == null || view.status === 'nobirth' || view.status === 'under18' || view.status === 'empty') return null;
  return {
    total: rec.total,
    delta: view.delta4w ?? null,
    trend: view.trend || 'flat',
    since: view.since || '',
    categories: CATS.filter(([id]) => rec.categories?.[id] != null).map(([id, key]) => ({
      id, label: tr(key), score: rec.categories[id],
    })),
  };
}
