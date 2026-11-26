import test from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, planLabel, weekStand } from '../lib/engine.js';

const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min, 0);
const set = (weight = 40) => ({ reps: 8, weight });
const ex = (title, n = 2) => ({ title, sets: Array.from({ length: n }, () => set()) });

function plan(when, sessions) {
  return { generatedAt: when.toISOString(), sessions };
}

function workout(date, name, label, setsDone) {
  return {
    planLabel: label,
    w: {
      training_id: name,
      date,
      title: `GC ${label} ${name}`,
      duration_secs: 2400,
      volume: 640,
    },
    detail: {
      detail: [{
        actionLibraryName: 'Squat',
        finishedReps: Array.from({ length: setsDone }, () => ({ finishedCount: 8, weight: 40 })),
      }],
    },
  };
}

test('monday done on wednesday is on track; friday is not due yet', () => {
  const now = at(2026, 11, 25, 12);
  const label = isoWeek(now);
  assert.equal(label, isoWeek(at(2026, 11, 23, 8)));
  const cur = plan(at(2026, 11, 23, 8), [
    { key: 'A', name: 'Full Body A', weekday: 0, slot: 2, estMinutes: 45, exercises: [ex('Squat', 2)] },
    { key: 'B', name: 'Full Body B', weekday: 4, slot: 3, estMinutes: 45, exercises: [ex('Row', 2)] },
  ]);
  assert.equal(planLabel(cur), label);
  const hit = workout('2026-11-23', 'Full Body A', label, 2);
  const stand = weekStand({
    plan: cur,
    workouts: [hit.w],
    sessions: { [hit.w.training_id]: hit.detail },
    now,
    prevPlan: plan(at(2026, 11, 16, 8), [
      { key: 'A', name: 'Full Body A', weekday: 0, slot: 2, estMinutes: 40, exercises: [ex('Squat', 2)] },
    ]),
  });
  assert.equal(stand.state, 'on');
  assert.equal(stand.sets.done, 2);
  assert.equal(stand.sets.planned, 4);
  assert.equal(stand.sets.expected, 2);
  assert.equal(stand.sessions.done, 1);
  assert.equal(stand.sessions.planned, 2);
  assert.equal(stand.planned.sessions, 2);
  assert.equal(stand.previous.sessions, 1);
  assert.equal(stand.planned.sets - stand.previous.sets, 2);
  assert.equal(stand.planned.minutes - stand.previous.minutes, 50);
});

test('a missed monday session is behind by wednesday', () => {
  const now = at(2026, 11, 25, 12);
  const cur = plan(at(2026, 11, 23, 8), [
    { key: 'A', name: 'Full Body A', weekday: 0, slot: 2, estMinutes: 45, exercises: [ex('Squat', 4)] },
    { key: 'B', name: 'Full Body B', weekday: 4, slot: 3, estMinutes: 45, exercises: [ex('Row', 4)] },
  ]);
  const stand = weekStand({ plan: cur, now });
  assert.equal(stand.state, 'behind');
  assert.equal(stand.sets.done, 0);
  assert.equal(stand.sets.expected, 4);
});

test('extra sets before the next session is ahead', () => {
  const now = at(2026, 11, 24, 18);
  const label = isoWeek(now);
  const cur = plan(at(2026, 11, 23, 8), [
    { key: 'A', name: 'Full Body A', weekday: 0, slot: 2, estMinutes: 45, exercises: [ex('Squat', 2)] },
    { key: 'B', name: 'Full Body B', weekday: 4, slot: 3, estMinutes: 45, exercises: [ex('Squat', 2)] },
    { key: 'C', name: 'Full Body C', weekday: 6, slot: 3, estMinutes: 45, exercises: [ex('Squat', 4)] },
  ]);
  const mon = workout('2026-11-23', 'Full Body A', label, 2);
  const fri = workout('2026-11-24', 'Full Body B', label, 2);
  const stand = weekStand({
    plan: cur,
    workouts: [mon.w, fri.w],
    sessions: { [mon.w.training_id]: mon.detail, [fri.w.training_id]: fri.detail },
    now,
  });
  assert.equal(stand.sets.expected, 2);
  assert.equal(stand.sets.done, 4);
  assert.equal(stand.sets.planned, 8);
  assert.equal(stand.state, 'ahead');
});

test('before the first session nothing is due', () => {
  const now = at(2026, 11, 23, 7);
  const cur = plan(at(2026, 11, 23, 6), [
    { key: 'A', name: 'Full Body A', weekday: 0, slot: 2, estMinutes: 45, exercises: [ex('Squat', 3)] },
  ]);
  const stand = weekStand({ plan: cur, now });
  assert.equal(stand.state, 'wait');
  assert.equal(stand.sets.expected, 0);
  assert.equal(stand.previous, null);
});

test('without a plan the card stays empty', () => {
  assert.equal(weekStand({ now: at(2026, 11, 25) }).state, 'empty');
});
