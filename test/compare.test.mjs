import assert from 'node:assert/strict';
import test from 'node:test';
import { compare } from '../lib/insights.js';

test('a walk on the same day stays out of the workout comparison', () => {
  const d = {
    id: '3', date: '2026-11-16', title: 'Full Body A', minutes: 43, calories: 232, volume: 3310,
    exercises: [{ sets: Array.from({ length: 21 }, () => ({})) }],
  };
  const workouts = [
    { training_id: '1', date: '2026-11-01', title: 'Full Body A', duration_secs: 40 * 60, volume: 3000, calories: 200 },
    { training_id: '2', date: '2026-11-08', title: 'Full Body A', duration_secs: 46 * 60, volume: 3200, calories: 220 },
    { training_id: '3', date: '2026-11-16', title: 'Full Body A', duration_secs: 43 * 60, volume: 3310, calories: 232 },
  ];
  const activities = [
    { date: '2026-11-01', minutes: 70, kcal: 300, type: 'wandelen' },
    { date: '2026-11-08', minutes: 80, kcal: 350, type: 'wandelen' },
    { date: '2026-11-16', minutes: 90, kcal: 400, type: 'wandelen' },
  ];
  const c = compare(d, { workouts, sessions: {}, activities });
  const dur = c.rows.find((r) => r.unit === 'min');
  assert.equal(dur.cur, 43);
  assert.equal(dur.ref, 43);
  assert.equal(c.day, false);
});
