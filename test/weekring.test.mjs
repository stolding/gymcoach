import test from 'node:test';
import assert from 'node:assert/strict';
import { weekLaps, weekRingLayout, weekRingColorMix, weekRingCircles } from '../public/weekring.js';

const fracs = (done, target) => weekLaps(done, target).map((l) => l.frac);

test('5 van 3 is een volle ring en een tweede op 2/3', () => {
  assert.deepEqual(fracs(5, 3), [1, 2 / 3]);
  const layout = weekRingLayout(2);
  assert.equal(layout.length, 2);
  assert.ok(layout[0].r > layout[1].r);
  assert.equal(weekRingColorMix(0), 0);
  assert.ok(weekRingColorMix(1) > weekRingColorMix(0));
  const svg = weekRingCircles(5, 3);
  assert.equal(svg.match(/class="ring-fg"/g).length, 2);
  const offsets = [...svg.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 1);
  assert.ok(Math.abs(offsets[0] / (2 * Math.PI * layout[1].r) - (1 / 3)) < 0.01);
});

test('7 van 3 is twee volle ringen en een derde op 1/3', () => {
  assert.deepEqual(fracs(7, 3), [1, 1, 1 / 3]);
  assert.ok(weekRingColorMix(2) > weekRingColorMix(1));
  const svg = weekRingCircles(7, 3);
  assert.match(svg, /var\(--accent\)/);
  assert.match(svg, /80%/);
  assert.match(svg, /60%/);
  assert.equal(svg.match(/class="ring-fg"/g).length, 3);
  const offsets = [...svg.matchAll(/stroke-dashoffset="([^"]+)"/g)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 1);
  const layout = weekRingLayout(3);
  assert.ok(Math.abs(offsets[0] / (2 * Math.PI * layout[2].r) - (2 / 3)) < 0.01);
});

test('een precies veelvoud is alleen volle ringen', () => {
  assert.deepEqual(fracs(6, 3), [1, 1]);
  assert.deepEqual(fracs(3, 3), [1]);
});

test('onder het doel blijft één ring, ook als er nog niets gedaan is', () => {
  assert.deepEqual(fracs(2, 3), [2 / 3]);
  assert.deepEqual(fracs(0, 3), [0]);
  assert.deepEqual(fracs(4, 0), [0]);
  assert.deepEqual(weekRingLayout(1), [{ r: 52, sw: 11 }]);
});

test('ringen overlappen niet en blijven om de tekst heen', () => {
  for (const n of [2, 3, 4, 7, 12]) {
    const layout = weekRingLayout(n);
    assert.ok(layout.length >= 2);
    assert.ok(layout.length <= n);
    const edges = layout.map((g) => ({ outer: g.r + g.sw / 2, inner: g.r - g.sw / 2 }));
    assert.ok(edges[0].outer <= 61.6, `buitenrand ${edges[0].outer}`);
    assert.ok(edges.at(-1).inner >= 36.5, `binnenrand ${edges.at(-1).inner}`);
    for (let i = 1; i < edges.length; i++) {
      assert.ok(edges[i].outer <= edges[i - 1].inner - 1, `spleet ${i}`);
    }
  }
});
