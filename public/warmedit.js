// Warming-up en cooldown bewerken als een gewone oefening (sets, rust, modus).
// Tijdsoefeningen (Bird Dog, wandelen, stretches) houden seconden; kilo geldt daar niet.

export const sideOf = (dose) => {
  const m = String(dose || '').match(/per (kant|been|arm)/i);
  return m ? `per ${m[1].toLowerCase()}` : '';
};
export const secsOf = (dose) => {
  const m = /(\d+)\s*s\b/i.exec(dose || '');
  return m ? Number(m[1]) : 30;
};

// Kabel- en krachtoefeningen hebben kilo. Mobiliteit en stretches zijn seconden.
export function isTimedItem(item, kind) {
  if (!item) return true;
  if (item.weighted || item.kind === 'cable' || kind === 'cable') return false;
  if (kind === 'mobility' || kind === 'cool') return true;
  return !(item.weight > 0 || item.sets?.some((s) => s.weight > 0));
}

const clampInt = (v, lo, hi, d) => {
  const n = Math.round(+v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

// Zonder sets: dezelfde opbouw als het toestel nu krijgt (kabel 2 sets, per kant 2 houdingen).
export function ensureWarmItem(item, kind) {
  if (!item) return item;
  const timed = isTimedItem(item, kind);
  if (item.sets?.length) {
    if (timed) for (const s of item.sets) s.weight = 0;
    return item;
  }
  if (!timed) {
    const reps = clampInt(item.reps, 1, 30, 12);
    const weight = Math.max(0, Math.round((+item.weight || 0) * 2) / 2);
    item.sets = [
      { reps, weight, rest: 30, mode: 1 },
      { reps, weight, rest: 45, mode: 1 },
    ];
    return item;
  }
  const secs = clampInt(secsOf(item.dose), 5, 180, 30);
  const n = sideOf(item.dose) ? 2 : 1;
  const rest = kind === 'cool' ? 5 : 10;
  item.sets = Array.from({ length: n }, () => ({ reps: secs, weight: 0, rest, mode: 1 }));
  return item;
}

// Houd de oude velden (dose, reps, weight) gelijk aan de eerste set, voor het dashboard en oude plannen.
export function syncWarmItem(item, kind) {
  if (!item?.sets?.length) return item;
  const s0 = item.sets[0];
  if (isTimedItem(item, kind)) {
    const secs = clampInt(s0.reps, 5, 180, 30);
    s0.reps = secs;
    const side = sideOf(item.dose);
    item.dose = side ? `${secs} s ${side}` : `${secs} s`;
    item.reps = secs;
    item.weight = 0;
    for (const s of item.sets) s.weight = 0;
  } else {
    item.reps = clampInt(s0.reps, 1, 30, 12);
    item.weight = Math.max(0, Math.round((+s0.weight || 0) * 2) / 2);
    item.dose = '';
    item.weighted = true;
  }
  return item;
}

export function sanitizeWarmItem(item, kind) {
  if (!item) return item;
  const timed = isTimedItem(item, kind);
  if (Array.isArray(item.sets) && item.sets.length) {
    item.sets = item.sets.map((s) => ({
      reps: clampInt(s.reps, timed ? 5 : 1, timed ? 180 : 30, timed ? 30 : 10),
      weight: timed ? 0 : Math.max(0, Math.round(+s.weight * 2) / 2 || 0),
      rest: clampInt(s.rest, 5, 300, kind === 'cool' ? 5 : timed ? 10 : 30),
      mode: clampInt(s.mode, 1, 5, 1),
    }));
    syncWarmItem(item, kind);
  } else if (!timed) {
    item.reps = clampInt(item.reps, 1, 30, 12);
    item.weight = Math.max(0, Math.round(+item.weight * 2) / 2 || 0);
  }
  return item;
}

// Mobiliteit eerst, dan kabel, tenzij de editor een volgorde (seq) heeft gezet.
export function warmRows(warmup) {
  const rows = [
    ...(warmup?.mobility || []).map((x) => ({ kind: 'mobility', x })),
    ...(warmup?.cable || []).map((x) => ({ kind: 'cable', x })),
  ];
  if (rows.some((r) => Number.isFinite(+r.x?.seq))) rows.sort((a, b) => (+a.x.seq || 0) - (+b.x.seq || 0));
  return rows;
}

// Kopie met sets, zonder het opgeslagen item te wijzigen. Zo blijft een oud plan hetzelfde tot je het bewerkt.
export function materializeWarm(item, kind) {
  const copy = { ...item, sets: item.sets?.map((s) => ({ ...s })) };
  return ensureWarmItem(copy, kind);
}
