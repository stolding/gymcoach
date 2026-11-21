import test from 'node:test';
import assert from 'node:assert/strict';
import { stats, weekProgressPct } from '../lib/engine.js';

const set = (weight) => ({ weight, reps: 30 });
const session = (date, id, weight) => ({ date, trainingId: id, sets: [set(weight)] });

test('progress uses the median of the last two weeks, not the first and last session', () => {
  const log = [
    session('2026-11-02', 'a', 50),
    session('2026-11-09', 'b', 40),
    session('2026-11-10', 'c', 50),
    session('2026-11-16', 'd', 49.5),
  ];
  assert.equal(weekProgressPct(log), 10);
  const out = stats({
    history: { row: { id: 1, name: 'Row', muscle: 'Lats', log } },
    workouts: [],
    sessions: {},
  }, 0, '2026-10-01');
  assert.equal(out.exercises[0].progressPct, 10);
});

test('two sessions in the same week are not progress', () => {
  const log = [session('2026-11-16', 'a', 40), session('2026-11-18', 'b', 50)];
  assert.equal(weekProgressPct(log), 0);
});
