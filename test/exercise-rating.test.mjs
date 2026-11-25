import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRatings, progress } from '../lib/engine.js';

const rx = { lo: 8, hi: 12 };
const compound = { type: 'compound', start: 20 };
const isolation = { type: 'isolation', start: 6 };
const set = (reps, weight, target = reps) => ({ reps, weight, target });
const entry = (date, sets, rating) => ({ date, trainingId: date, sets, ...(rating != null ? { rating } : {}) });

test('one easy or hard rating keeps the step from the sets', () => {
  const sets = [set(8, 20), set(8, 20)];
  const none = progress([entry('2026-11-01', sets), entry('2026-11-08', sets)], rx, compound);
  const oneEasy = progress([entry('2026-11-01', sets), entry('2026-11-08', sets, 1)], rx, compound);
  const oneHard = progress([entry('2026-11-01', sets), entry('2026-11-08', sets, 5)], rx, compound);
  assert.equal(oneEasy.weight, none.weight);
  assert.equal(oneEasy.reps, none.reps);
  assert.equal(oneHard.weight, none.weight);
  assert.equal(oneHard.reps, none.reps);
  assert.equal(none.weight, 20);
  assert.equal(none.reps, 9);
});

test('two easy ratings take one existing step up and do not stack', () => {
  const mid = [set(8, 20), set(8, 20)];
  const stepped = progress([
    entry('2026-11-01', mid, 1),
    entry('2026-11-08', mid, 2),
  ], rx, compound);
  assert.equal(stepped.weight, 22);
  assert.equal(stepped.reps, 8);

  const top = [set(12, 20), set(12, 20)];
  const once = progress([
    entry('2026-11-01', top, 1),
    entry('2026-11-08', top, 1),
  ], rx, compound);
  assert.equal(once.weight, 22);
  assert.equal(once.reps, 8);

  const light = progress([
    entry('2026-11-01', [set(8, 6)], 2),
    entry('2026-11-08', [set(8, 6)], 1),
  ], { lo: 8, hi: 12 }, isolation);
  assert.equal(light.weight, 7);
  assert.equal(light.reps, 8);
});

test('two hard ratings ease with the existing ten percent', () => {
  const sets = [set(12, 20), set(12, 20)];
  const eased = progress([
    entry('2026-11-01', sets, 5),
    entry('2026-11-08', sets, 4),
  ], rx, compound);
  assert.equal(eased.weight, 18);
  assert.equal(eased.reps, 8);
  assert.match(eased.note, /10%/);
});

test('an average rating keeps the current plan', () => {
  const held = progress([
    entry('2026-11-08', [set(12, 20, 10), set(12, 20, 10)], 3),
  ], rx, compound);
  assert.equal(held.weight, 20);
  assert.equal(held.reps, 10);
  assert.match(held.note, /gemiddeld/);
});

test('a break in the run leaves the sets in charge', () => {
  const sets = [set(12, 20), set(12, 20)];
  const broken = progress([
    entry('2026-11-01', sets, 5),
    entry('2026-11-08', sets, 3),
    entry('2026-11-15', sets, 5),
  ], rx, compound);
  assert.equal(broken.weight, 22);
  assert.equal(broken.reps, 8);
});

test('a rating is attached to that training and that exercise', () => {
  const history = {
    42: { id: 42, log: [
      { date: '2026-11-01', trainingId: 'a', sets: [] },
      { date: '2026-11-08', trainingId: 'b', sets: [] },
    ] },
    7: { id: 7, log: [{ date: '2026-11-08', trainingId: 'b', sets: [] }] },
  };
  attachRatings(history, { b: { 42: 5, 7: 1 }, a: { 7: 4 } });
  assert.equal(history[42].log[0].rating, undefined);
  assert.equal(history[42].log[1].rating, 5);
  assert.equal(history[7].log[0].rating, 1);
});
