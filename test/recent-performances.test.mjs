import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory, exerciseRecent, recentPerformances } from '../lib/engine.js';

const row = (date, sets) => ({ date, trainingId: date, sets });
const set = (reps, weight, rest) => ({ reps, weight, ...(rest != null ? { rest } : {}) });

function history() {
  return {
    42: {
      id: 42,
      name: 'Seated Dual-Handle Neutral Grip Row',
      log: [
        row('2026-09-01', [set(10, 7)]),
        row('2026-09-20', [set(12, 8), set(12, 8), set(12, 8)]),
        row('2026-10-04', [set(12, 8), set(12, 8), set(10, 8)]),
        row('2026-10-18', [set(8, 4.5, 45), set(15, 8, 80), set(15, 8, 80), set(15, 8, 80)]),
        row('2026-11-01', [set(15, 8.5, 80), set(15, 8.5, 90), set(15, 8.5, 80)]),
        row('2026-11-08', [set(15, 9), set(12, 8), set(15, 9), set(12, 8)]),
        row('2026-11-18', [set(15, 9, 80), set(15, 9, 80), set(15, 9, 80)]),
      ],
    },
    7: {
      id: 7,
      name: 'Bench Press',
      log: [
        row('2026-11-20', [set(5, 100, 120)]),
        row('2026-11-21', [set(5, 110, 120)]),
      ],
    },
    'name:Other': {
      id: null,
      name: 'Other',
      log: [row('2026-11-19', [set(8, 20)])],
    },
  };
}

test('last 5 are the newest of this exercise only', () => {
  const out = recentPerformances(history(), 42);
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((r) => r.date), ['2026-11-18', '2026-11-08', '2026-11-01', '2026-10-18', '2026-10-04']);
  assert.equal(out[0].reps, '15/15/15');
  assert.equal(out[0].kg, 9);
  assert.equal(out[0].rest, 80);
  assert.equal(out[1].reps, '15/15');
  assert.equal(out[1].kg, 9);
  assert.equal(out[1].rest, undefined);
  assert.equal(out[2].rest, undefined);
  assert.equal(out[3].reps, '15/15/15');
  assert.equal(out[3].kg, 8);
  assert.equal(out[3].rest, 80);
  assert.ok(out.every((r) => r.kg !== 100 && r.kg !== 110 && r.kg !== 20));
});

test('fewer than 5 logs returns only what exists', () => {
  const hist = { 7: history()[7] };
  const out = recentPerformances(hist, '7');
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => r.date), ['2026-11-21', '2026-11-20']);
  assert.equal(out[0].reps, '5');
  assert.equal(out[0].kg, 110);
  assert.equal(out[0].rest, 120);
});

test('empty, unknown and a limit of zero stay empty', () => {
  assert.deepEqual(recentPerformances(history(), 99), []);
  assert.deepEqual(recentPerformances({ 1: { id: 1, log: [] } }, 1), []);
  assert.deepEqual(recentPerformances(null, 1), []);
  assert.deepEqual(recentPerformances(history(), 42, 0), []);
});

test('exerciseRecent keeps each exercise on its own id', () => {
  const map = exerciseRecent(history());
  assert.deepEqual(Object.keys(map).sort(), ['42', '7']);
  assert.equal(map['42'].length, 5);
  assert.equal(map['7'].length, 2);
  assert.ok(map['42'].every((r) => r.date < '2026-11-20'));
  assert.ok(map['7'].every((r) => r.kg >= 100));
});

test('buildHistory does not mix exercises, and rest comes from the set', () => {
  const rep = (count, weight, rest) => ({ finishedCount: count, weight, targetCount: count, breakTime: rest, capacity: count * weight });
  const sessions = {};
  for (let i = 1; i <= 6; i++) {
    sessions['t' + i] = {
      date: `2026-10-${String(i).padStart(2, '0')}`,
      training_id: 't' + i,
      detail: [
        { actionLibraryName: 'Seated Row', finishedReps: [rep(15, 9, 80), rep(15, 9, 80), rep(15, 9, 80)] },
        { actionLibraryName: 'Bench Press', finishedReps: [rep(8, 40, 90)] },
      ],
    };
  }
  const built = buildHistory(sessions, [{ id: 42, name: 'Seated Row' }, { id: 7, name: 'Bench Press' }]);
  const rowLog = recentPerformances(built, 42);
  const bench = recentPerformances(built, 7);
  assert.equal(rowLog.length, 5);
  assert.equal(bench.length, 5);
  assert.deepEqual(rowLog.map((r) => r.date), ['2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02']);
  assert.ok(rowLog.every((r) => r.reps === '15/15/15' && r.kg === 9 && r.rest === 80));
  assert.ok(bench.every((r) => r.reps === '8' && r.kg === 40 && r.rest === 90));
  assert.equal(built['42'].log.length, 6);
});
