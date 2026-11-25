import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRatings, applyRatingToPlan, isoWeek, progress } from '../lib/engine.js';

const rx = { lo: 8, hi: 12 };
const compound = { type: 'compound', start: 20 };
const isolation = { type: 'isolation', start: 6 };
const set = (reps, weight, target = reps) => ({ reps, weight, target });
const entry = (date, sets, rating) => ({ date, trainingId: date, sets, ...(rating != null ? { rating } : {}) });
const weekOf = (date) => isoWeek(new Date(date + 'T12:00:00'));
const weekAfter = (date) => {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  return isoWeek(d);
};

test('the same week keeps the step from the sets', () => {
  const sets = [set(8, 20), set(8, 20)];
  const log = [entry('2026-11-01', sets), entry('2026-11-08', sets, 1)];
  const week = weekOf('2026-11-08');
  const none = progress([entry('2026-11-01', sets), entry('2026-11-08', sets)], rx, compound, { planWeek: week });
  const easy = progress(log, rx, compound, { planWeek: week });
  const hard = progress([entry('2026-11-08', [set(12, 20), set(12, 20)], 5)], rx, compound, { planWeek: week });
  assert.equal(easy.weight, none.weight);
  assert.equal(easy.reps, none.reps);
  assert.equal(none.weight, 20);
  assert.equal(none.reps, 9);
  assert.equal(hard.weight, 22);
  assert.equal(hard.reps, 8);
});

test('one easy rating steps up in the following week and does not stack', () => {
  const mid = [set(8, 20), set(8, 20)];
  const next = weekAfter('2026-11-08');
  const stepped = progress([
    entry('2026-11-01', mid),
    entry('2026-11-08', mid, 1),
  ], rx, compound, { planWeek: next });
  assert.equal(stepped.weight, 22);
  assert.equal(stepped.reps, 8);

  const alsoEasy = progress([
    entry('2026-11-08', mid, 2),
  ], rx, compound, { planWeek: next });
  assert.equal(alsoEasy.weight, 22);
  assert.equal(alsoEasy.reps, 8);

  const top = [set(12, 20), set(12, 20)];
  const once = progress([entry('2026-11-08', top, 1)], rx, compound, { planWeek: next });
  assert.equal(once.weight, 22);
  assert.equal(once.reps, 8);

  const light = progress([
    entry('2026-11-08', [set(8, 6)], 1),
  ], { lo: 8, hi: 12 }, isolation, { planWeek: next });
  assert.equal(light.weight, 7);
  assert.equal(light.reps, 8);
});

test('one hard rating eases the following week by ten percent', () => {
  const sets = [set(12, 20), set(12, 20)];
  const next = weekAfter('2026-11-08');
  const eased = progress([entry('2026-11-08', sets, 5)], rx, compound, { planWeek: next });
  assert.equal(eased.weight, 18);
  assert.equal(eased.reps, 8);
  assert.match(eased.note, /10%/);
  const four = progress([entry('2026-11-08', sets, 4)], rx, compound, { planWeek: next });
  assert.equal(four.weight, 18);
  assert.equal(four.reps, 8);
});

test('an average rating keeps the current plan in the following week', () => {
  const next = weekAfter('2026-11-08');
  const held = progress([
    entry('2026-11-08', [set(12, 20, 10), set(12, 20, 10)], 3),
  ], rx, compound, { planWeek: next });
  assert.equal(held.weight, 20);
  assert.equal(held.reps, 10);
  assert.match(held.note, /gemiddeld/);
});

test('an older rating does not override a later session', () => {
  const sets = [set(12, 20), set(12, 20)];
  const next = weekAfter('2026-11-15');
  const later = progress([
    entry('2026-11-01', sets, 5),
    entry('2026-11-15', sets),
  ], rx, compound, { planWeek: next });
  assert.equal(later.weight, 22);
  assert.equal(later.reps, 8);
});

test('a saved next-week plan changes when the rating is on the latest session', () => {
  const sets = [set(8, 20), set(8, 20)];
  const history = { 42: { log: [entry('2026-11-08', sets, 5)] }, 7: { log: [entry('2026-11-08', [set(8, 6)], 1)] } };
  const plan = () => ({
    generatedAt: '2026-11-09T08:00:00.000Z',
    sessions: [{
      key: 'A', type: 'kracht',
      exercises: [
        { id: 42, pattern: 'hpush', type: 'compound', repRange: [8, 12], sets: [{ reps: 9, weight: 20, rest: 90 }, { reps: 9, weight: 20, rest: 90 }] },
        { id: 7, pattern: 'curl', type: 'isolation', repRange: [8, 12], sets: [{ reps: 8, weight: 6, rest: 60 }] },
      ],
    }],
  });
  const next = plan();
  assert.equal(applyRatingToPlan(next, history, '42'), true);
  assert.equal(next.sessions[0].exercises[0].sets[0].weight, 18);
  assert.equal(next.sessions[0].exercises[0].sets[0].reps, 8);
  assert.equal(next.sessions[0].exercises[1].sets[0].weight, 6);

  const same = plan();
  same.generatedAt = '2026-11-08T08:00:00.000Z';
  assert.equal(applyRatingToPlan(same, history, '42'), false);
  assert.equal(same.sessions[0].exercises[0].sets[0].weight, 20);
  assert.equal(same.sessions[0].exercises[0].sets[0].reps, 9);
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
