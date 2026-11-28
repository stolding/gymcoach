// Ringen van het weekdoel. Elke volledige ronde is een eigen ring;
// de rest van de volgende ronde vult de binnenste ring deels.
// 5 van 3: volle ring plus een tweede op 2/3. 7 van 3: twee volle plus een derde op 1/3.

export function weekLaps(done, target) {
  const t = Number(target);
  const d = Math.max(0, Number(done) || 0);
  if (!Number.isFinite(t) || t <= 0 || d <= 0) return [{ frac: 0, lap: 0 }];
  const full = Math.floor(d / t);
  const rem = (d % t) / t;
  if (rem === 0) return Array.from({ length: full }, (_, lap) => ({ frac: 1, lap }));
  return [...Array.from({ length: full }, (_, lap) => ({ frac: 1, lap })), { frac: rem, lap: full }];
}

// Tekening in viewBox 130. Eén ring blijft de oude cirkel (r 52, lijn 11).
// Meer ringen stapelen naar binnen, met een spleet ertussen.
const OUTER = 61.5;
const INNER = 37;
const GAP = 2.6;
const MIN_SW = 3.4;

export function weekRingLayout(count) {
  const n = Math.max(1, count | 0);
  if (n === 1) return [{ r: 52, sw: 11 }];
  const band = OUTER - INNER;
  let shown = n;
  let sw = (band - GAP * (shown - 1)) / shown;
  let gap = GAP;
  if (sw < MIN_SW) {
    sw = MIN_SW;
    shown = Math.min(n, Math.max(2, Math.floor((band + GAP) / (MIN_SW + GAP))));
    gap = (band - sw * shown) / (shown - 1);
  }
  const rings = [];
  let edge = OUTER;
  for (let i = 0; i < shown; i++) {
    rings.push({ r: Math.round((edge - sw / 2) * 100) / 100, sw: Math.round(sw * 100) / 100 });
    edge -= sw + gap;
  }
  return rings;
}

// 0 = de gewone accentkleur. Elke volgende ring mengt 20% meer wit, tot 60%.
export function weekRingColorMix(lap) {
  return Math.min(60, Math.max(0, lap) * 20);
}

const svgNum = (n) => String(Math.round(n * 1000) / 1000);

export function weekRingCircles(done, target) {
  const laps = weekLaps(done, target);
  const layout = weekRingLayout(laps.length);
  const shown = laps.slice(laps.length - layout.length);
  return shown.map((lap, i) => {
    const { r, sw } = layout[i];
    const mix = weekRingColorMix(lap.lap);
    const stroke = mix ? `color-mix(in srgb, var(--accent) ${100 - mix}%, white)` : 'var(--accent)';
    const track = `<circle cx="65" cy="65" r="${r}" class="ring-bg" style="stroke-width:${sw}"/>`;
    if (lap.frac >= 1) {
      return track + `<circle cx="65" cy="65" r="${r}" class="ring-fg" style="stroke:${stroke};stroke-width:${sw}"/>`;
    }
    const C = 2 * Math.PI * r;
    return track +
      `<circle cx="65" cy="65" r="${r}" class="ring-fg" style="stroke:${stroke};stroke-width:${sw}" stroke-dasharray="${svgNum(C)}" stroke-dashoffset="${svgNum(C * (1 - lap.frac))}" transform="rotate(-90 65 65)"/>`;
  }).join('');
}
