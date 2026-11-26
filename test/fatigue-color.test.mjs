import test from 'node:test';
import assert from 'node:assert/strict';
import { fatiguePoints, recoveryFill } from '../public/bodymap.js';
import { recoveryAt } from '../lib/muscleRecovery.js';

test('fatigue points are 100 minus recovery and stay above 100', () => {
  assert.equal(fatiguePoints(100), 0);
  assert.equal(fatiguePoints(80), 20);
  assert.equal(fatiguePoints(0), 100);
  assert.equal(fatiguePoints(-40), 140);
});

test('fatigue colour is green, then orange, then red, and solid red past 100', () => {
  assert.equal(recoveryFill(81), 'var(--ok)');
  assert.equal(recoveryFill(80), 'color-mix(in oklab, var(--accent) 0%, var(--ok))');
  assert.equal(recoveryFill(25), 'color-mix(in oklab, var(--accent) 100%, var(--ok))');
  assert.equal(recoveryFill(24), 'color-mix(in oklab, var(--warn) 4%, var(--accent))');
  assert.equal(recoveryFill(0), 'color-mix(in oklab, var(--warn) 100%, var(--accent))');
  assert.equal(recoveryFill(-1), 'var(--warn)');
});

test('recovery from sets is not floored at 0 when fatigue passes 100', () => {
  const at = Date.parse('2026-11-26T12:00:00Z');
  assert.equal(recoveryAt([{ muscle: 'quads', at, stimulus: 140 }], 'quads', at), -40);
  assert.equal(recoveryAt([], 'quads', at), 100);
});
