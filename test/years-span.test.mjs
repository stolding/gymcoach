import test from 'node:test';
import assert from 'node:assert/strict';
import { yearsSpan } from '../lib/year.js';

test('years fill every month and average the weight', () => {
  const span = yearsSpan({
    now: new Date(2024, 2, 15),
    workouts: [
      { date: '2024-01-10', duration_secs: 3600 },
      { date: '2024-03-02', duration_secs: 1800 },
    ],
    activities: [{ date: '2024-01-20', minutes: 30, type: 'wandelen' }],
    bodyLog: [
      { date: '2024-01-05', kg: 80, muscle: 40, fat: 20 },
      { date: '2024-01-20', kg: 84, muscle: 42, fat: 22 },
      { date: '2024-02-02', kg: 81 },
    ],
    history: { row: { log: [{ date: '2024-03-02', sets: [{ reps: 10, weight: 20, vol: 400 }] }] } },
  });
  assert.deepEqual(span.months.map((m) => m.key), ['2024-01', '2024-02', '2024-03']);
  assert.equal(span.months[0].minutes, 90);
  assert.equal(span.months[0].sessions, 2);
  assert.equal(span.months[0].kg, 82);
  assert.equal(span.months[0].muscle, 41);
  assert.equal(span.months[0].fat, 21);
  assert.equal(span.months[1].minutes, 0);
  assert.equal(span.months[1].kg, 81);
  assert.equal(span.months[1].muscle, null);
  assert.equal(span.months[2].minutes, 30);
  assert.equal(span.months[2].kg, null);
  assert.equal(span.months[2].volume, 400);
});
