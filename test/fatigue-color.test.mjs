import test from 'node:test';
import assert from 'node:assert/strict';
import { fatiguePoints, recoveryFill, bodyMap } from '../public/bodymap.js';
import { recoveryAt } from '../lib/muscleRecovery.js';

test('fatigue points are 100 minus recovery and stay above 100', () => {
  assert.equal(fatiguePoints(100), 0);
  assert.equal(fatiguePoints(80), 20);
  assert.equal(fatiguePoints(0), 100);
  assert.equal(fatiguePoints(-40), 140);
});

test('fatigue colour is green, then orange, then red, and solid red past 100', () => {
  assert.equal(recoveryFill(100), 'var(--ok)');
  assert.equal(recoveryFill(90), 'color-mix(in oklab, var(--accent) 13%, var(--ok))');
  assert.equal(recoveryFill(25), 'color-mix(in oklab, var(--accent) 100%, var(--ok))');
  assert.equal(recoveryFill(24), 'color-mix(in oklab, var(--warn) 4%, var(--accent))');
  assert.equal(recoveryFill(0), 'color-mix(in oklab, var(--warn) 100%, var(--accent))');
  assert.equal(recoveryFill(-1), 'var(--warn)');
});

test('the week figure paints fatigue on the muscle path and keeps the number above 100', () => {
  const svg = bodyMap({ quads: -40, pecs: 80 }, {
    scale: 'recovery',
    labels: false,
    caption: (k, pct) => `${k}:${fatiguePoints(pct)}`,
  });
  assert.match(svg, /data-m="quads"[^>]*style="fill:var\(--warn\)"/);
  assert.match(svg, /<title>quads:140<\/title>/);
  assert.match(svg, /data-m="pecs"[^>]*style="fill:color-mix\(in oklab, var\(--accent\) 27%, var\(--ok\)\)"/);
  assert.doesNotMatch(svg, /class="bm m3/);
});

test('a rest day halves fatigue, and six hours is only a quarter of that day', () => {
  const at = Date.parse('2026-11-26T12:00:00Z');
  const h = 3600000;
  const left = (stimulus, hours) => 100 - recoveryAt([{ muscle: 'quads', at, stimulus }], 'quads', at + hours * h, 1);
  assert.equal(left(90, 24), 45);
  assert.equal(left(40, 24), 20);
  assert.equal(left(20, 24), 10);
  const block = left(40, 6);
  assert.ok(block > 33 && block < 34, block);
  assert.ok(block > left(40, 24));
});

test('recovery from sets is not floored at 0 when fatigue passes 100', () => {
  const at = Date.parse('2026-11-26T12:00:00Z');
  assert.equal(recoveryAt([{ muscle: 'quads', at, stimulus: 140 }], 'quads', at), -40);
  assert.equal(recoveryAt([], 'quads', at), 100);
});
