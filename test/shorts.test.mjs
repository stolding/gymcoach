import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlan, fillShortDays } from '../lib/engine.js';
import { alignPlanDays } from '../lib/weekdays.js';
import { applyWeekBalance } from '../lib/weekbalance.js';

const sets = () => [{ reps: 8, weight: 20 }, { reps: 8, weight: 20 }, { reps: 8, weight: 20 }];
const lib = [
  { id: 93, name: 'Lateral Raise', muscle: 'Side Delts', tab: 'Training' },
  { id: 465, name: 'Lateral Raise Cable', muscle: 'Side Delts', tab: 'Training' },
  { id: 2547, name: 'Face Pull', muscle: 'Rear Delts', tab: 'Training' },
  { id: 466, name: 'Reverse Fly', muscle: 'Rear Delts', tab: 'Training' },
  { id: 199, name: 'Curl', muscle: 'Biceps', tab: 'Training' },
  { id: 335, name: 'Curl 2', muscle: 'Biceps', tab: 'Training' },
  { id: 319, name: 'Pushdown', muscle: 'Triceps', tab: 'Training' },
  { id: 418246434553857, name: 'Extension', muscle: 'Triceps', tab: 'Training' },
  { id: 372785837375489, name: 'Crunch', muscle: 'Abs', tab: 'Training' },
  { id: 391213477920769, name: 'Woodchop', muscle: 'Abs', tab: 'Training' },
  { id: 471, name: 'Calf', muscle: 'Calves', tab: 'Training' },
  { id: 438005852536833, name: 'Calf 2', muscle: 'Calves', tab: 'Training' },
  { id: 2241, name: 'Hip Thrust', muscle: 'Glutes', tab: 'Training' },
  { id: 395971079438337, name: 'Kickback', muscle: 'Glutes', tab: 'Training' },
];

test('a short day between chest and back avoids both main muscles', () => {
  const sessions = [
    { key: 'A', name: 'A', weekday: 0, slot: 4, exercises: [{ id: 1, pattern: 'hpush', muscle: 'Pecs', sets: sets() }] },
    { key: 'B', name: 'B', weekday: 3, slot: 4, exercises: [{ id: 2, pattern: 'hpull', muscle: 'Lats', sets: sets() }] },
  ];
  const before = JSON.stringify(sessions);
  const extra = fillShortDays(sessions, { settings: { goal: 'combinatie' }, library: lib, focus: [] });
  assert.equal(JSON.stringify(sessions), before);
  assert.equal(extra.length, 1);
  assert.equal(extra[0].weekday, 1);
  assert.equal(extra[0].short, true);
  assert.ok(!['pecs', 'lats'].includes(extra[0].shortMuscle));
  assert.ok(extra[0].exercises.length >= 1 && extra[0].exercises.length <= 2);
  assert.ok(extra[0].exercises.every((e) => e.sets.length === 2));
});

test('no short day when the sessions around it already train every candidate', () => {
  const patterns = ['lat', 'rear', 'curl', 'tri', 'core', 'calf', 'glute'];
  const exercises = patterns.map((pattern, i) => ({ id: 100 + i, pattern, sets: sets() }));
  const sessions = [
    { key: 'A', weekday: 0, slot: 4, exercises },
    { key: 'B', weekday: 2, slot: 4, exercises },
  ];
  assert.deepEqual(fillShortDays(sessions, { settings: { goal: 'combinatie' }, library: lib }), []);
});

test('a short session keeps the regular days as the plan days', () => {
  const plan = {
    dayTypes: ['combinatie', 'combinatie'],
    weekdays: [0, 3],
    slots: [4, 4],
    sessions: [
      { key: 'A', type: 'combinatie', weekday: 0, slot: 4, exercises: [] },
      { key: 'K1', type: 'combinatie', short: true, shortMuscle: 'sideDelts', weekday: 1, slot: 4, exercises: [] },
      { key: 'B', type: 'combinatie', weekday: 3, slot: 4, exercises: [] },
    ],
  };
  alignPlanDays(plan);
  assert.deepEqual(plan.dayTypes, ['combinatie', 'combinatie']);
  assert.deepEqual(plan.weekdays, [0, 3]);
  assert.deepEqual(plan.sessions.map((s) => s.key), ['A', 'K1', 'B']);
});

test('week balance does not move exercises onto or off a short session', () => {
  const plan = {
    sessions: [
      { key: 'A', weekday: 0, slot: 4, exercises: [{ pattern: 'hpush', title: 'Press', sets: sets() }, { pattern: 'squat', title: 'Squat', sets: sets() }] },
      { key: 'K1', short: true, weekday: 1, slot: 4, exercises: [{ pattern: 'lat', title: 'Raise', sets: [{ reps: 12, weight: 3 }, { reps: 12, weight: 3 }] }] },
      { key: 'B', weekday: 3, slot: 4, exercises: [{ pattern: 'hpull', title: 'Row', sets: sets() }, { pattern: 'hinge', title: 'Hinge', sets: sets() }] },
    ],
  };
  applyWeekBalance(plan, { history: {}, now: Date.parse('2026-11-16T12:00:00') });
  const short = plan.sessions.find((s) => s.short);
  assert.deepEqual(short.exercises.map((e) => e.title), ['Raise']);
});

test('a deload week does not add short sessions', () => {
  const settings = { goal: 'combinatie', daysPerWeek: 2, minutesPerSession: 40, experience: 'beginner', warmup: 'off', cooldown: 'off', deloadEveryWeeks: 4 };
  const plan = buildPlan({ settings, library: lib, history: {}, week: 4, snapshot: [], dayTypes: ['combinatie', 'combinatie'], weekdays: [0, 3], slots: [4, 4], shorts: true });
  assert.equal(plan.deload, true);
  assert.equal(plan.sessions.some((s) => s.short), false);
  assert.equal(plan.dayTypes.length, 2);
});
