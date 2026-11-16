import assert from 'node:assert/strict';
import test from 'node:test';
import { yearSeries, yearPdf, yearWeeks } from '../lib/year.js';

const now = new Date('2026-11-16T12:00:00');

test('52 mondays ending on the current week', () => {
  const weeks = yearWeeks(now);
  assert.equal(weeks.length, 52);
  assert.equal(weeks.at(-1), '2026-11-16');
  assert.equal(weeks[0], '2025-11-24');
});

test('weekly weight average, gym exercises and minutes, score over the year', () => {
  const data = yearSeries({
    now,
    workouts: [
      { date: '2026-11-16', duration_secs: 43 * 60 },
      { date: '2026-11-10', duration_secs: 40 * 60 },
    ],
    history: {
      a: { name: 'Squat', log: [
        { date: '2026-11-16', sets: [{ reps: 8, weight: 60, vol: 480 }, { reps: 8, weight: 60, vol: 480 }] },
        { date: '2026-11-10', sets: [{ reps: 8, weight: 40, vol: 320 }] },
      ] },
      b: { name: 'Row', log: [{ date: '2026-11-16', sets: [{ reps: 10, weight: 30, vol: 300 }] }] },
    },
    bodyLog: [
      { date: '2026-11-10', kg: 80, muscle: 32 },
      { date: '2026-11-16', kg: 81 },
      { date: '2026-11-16', kg: 83, muscle: 33 },
    ],
    scores: [
      { date: '2025-11-24', total: 6 },
      { date: '2026-11-16', total: 7.2 },
      { date: '2024-01-01', total: 9 },
    ],
  });
  const last = data.weeks.at(-1);
  const prev = data.weeks.at(-2);
  assert.equal(last.week, '2026-11-16');
  assert.equal(last.minutes, 43);
  assert.equal(last.exercises, 2);
  assert.equal(last.kg, 82);
  assert.equal(prev.minutes, 40);
  assert.equal(prev.exercises, 1);
  assert.equal(prev.kg, 80);
  assert.equal(data.kpi.sessions, 2);
  assert.equal(data.kpi.minutes, 83);
  assert.equal(data.kpi.exercises, 3);
  assert.equal(data.kpi.sets, 4);
  assert.equal(data.kpi.volume, 480 + 480 + 320 + 300);
  assert.equal(data.kpi.weeksTrained, 2);
  assert.equal(data.kpi.score, 7.2);
  assert.equal(data.kpi.scoreDelta, 1.2);
  assert.equal(data.kpi.weight, 83);
  assert.equal(data.kpi.weightDelta, 3);
  assert.equal(data.kpi.muscleFrom, 32);
  assert.equal(data.kpi.muscleTo, 33);
  assert.equal(data.kpi.heavy.weight, 60);
  assert.equal(data.kpi.heavy.name, 'Squat');
  const weeksBefore = data.weeks.filter((w) => w.week < '2026-11-09');
  assert.ok(weeksBefore.every((w) => w.minutes === 0 && w.exercises === 0 && w.kg == null));
});

test('the year PDF is a single page', () => {
  const data = yearSeries({ now, workouts: [], history: {}, bodyLog: [], scores: [] });
  const buf = yearPdf(data, { userName: 'A' });
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.match(buf.toString('latin1'), /\/Count 1/);
});
