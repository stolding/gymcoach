import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshGrid } from '../lib/weekbalance.js';
import { historyEvents, recoveryAt } from '../lib/muscleRecovery.js';
import { alignPlanDays, assignFreeWeekday, defaultWeekdays, moveTrainingDay, orderTrainingDays, preferNamedOutdoor, sessionAtHours, sessionOffsetHours } from '../lib/weekdays.js';

function plan(items) {
  return {
    sessions: items.map((item, i) => {
      const spec = typeof item === 'number' ? { weekday: item } : item;
      return {
        key: 'S' + i,
        name: 'S' + i,
        weekday: spec.weekday,
        ...(spec.slot != null ? { slot: spec.slot } : {}),
        exercises: i === 0 ? [{ pattern: 'squat', sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }] }] : [],
      };
    }),
  };
}

function quad(p, block) {
  return p.balance.rows.find((r) => r.key === 'quads').blocks[block];
}

test('monday wednesday thursday saturday keep their gaps', () => {
  const sessions = plan([0, 2, 3, 5]).sessions;
  assert.equal(sessionOffsetHours(sessions, 0), 0);
  assert.equal(sessionOffsetHours(sessions, 1), 48);
  assert.equal(sessionOffsetHours(sessions, 2), 72);
  assert.equal(sessionOffsetHours(sessions, 3), 120);
});

test('a plan without weekdays still spreads the week over six days', () => {
  assert.equal(sessionOffsetHours([{}, {}, {}, {}], 3), 144);
  assert.deepEqual(defaultWeekdays(4), [0, 2, 4, 6]);
  assert.deepEqual(defaultWeekdays(3), [0, 3, 6]);
});

test('one day between workouts leaves less recovery than six days', () => {
  const sets = Array.from({ length: 6 }, () => ({ reps: 8, weight: 40 }));
  const closePlan = plan([0, 1]);
  const farPlan = plan([0, 6]);
  closePlan.sessions[0].exercises[0].sets = sets;
  farPlan.sessions[0].exercises[0].sets = sets.map((s) => ({ ...s }));
  const close = refreshGrid(closePlan, { history: {}, now: Date.parse('2026-11-16T12:00:00') });
  const far = refreshGrid(farPlan, { history: {}, now: Date.parse('2026-11-16T12:00:00') });
  assert.equal(close.balance.rows[0].blocks.length, 28);
  assert.equal(quad(close, 2), 100);
  assert.ok(quad(close, 3) < 90);
  assert.ok(quad(close, 7) < quad(far, 27));
  assert.equal(close.balance.rows.find((r) => r.key === 'quads').hits[0].role, 'prime');
});

test('a heavier set done today leaves less recovery than the planned weight', () => {
  const now = Date.parse('2026-11-16T20:00:00');
  const sessions = [{
    key: 'A', name: 'A', weekday: 0, slot: 0,
    exercises: [{ id: 9, pattern: 'squat', sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }] }],
  }];
  const planned = refreshGrid({ sessions }, { history: {}, now });
  const old = Array.from({ length: 8 }, () => ({ reps: 8, weight: 40 }));
  const history = {
    9: { id: 9, muscle: 'quads', log: [
      { date: '2026-10-20', sets: old },
      { date: '2026-11-16', sets: [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }] },
    ] },
  };
  const done = refreshGrid({ sessions: sessions.map((s) => ({ ...s, exercises: s.exercises.map((e) => ({ ...e })) })) }, { history, now });
  const end = 3;
  assert.ok(quad(done, end) < quad(planned, end));
});

test('a finished workout without a clock lands in the same block as its dot', () => {
  const now = Date.parse('2026-11-27T15:21:00');
  const sessions = [{
    key: 'A', name: 'Trek', weekday: 3, slot: 0,
    exercises: [{ id: 9, pattern: 'squat', sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 }] }],
  }];
  const history = {
    9: { id: 9, muscle: 'quads', log: [{ date: '2026-11-26', sets: [
      { reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 },
    ] }] },
  };
  const row = refreshGrid({ sessions }, { history, now }).balance.rows.find((r) => r.key === 'quads');
  const hit = row.hits.find((h) => h.role === 'prime');
  const before = row.blocks[hit.block - 1];
  const here = row.blocks[hit.block];
  const after = row.blocks[hit.block + 1];
  assert.ok(here < before, `training ${here} before ${before}`);
  assert.ok(here < after, `training ${here} after ${after}`);
});

test('a workout already logged today is not added again at a later plan slot', () => {
  const now = Date.parse('2026-11-27T15:00:00');
  const sessions = [{
    key: 'A', name: 'A', weekday: 4, slot: 4,
    exercises: [{ id: 9, pattern: 'squat', sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }] }],
  }];
  const history = {
    9: { id: 9, muscle: 'quads', log: [{ date: '2026-11-27T10:00:00', sets: [
      { reps: 8, weight: 40 }, { reps: 8, weight: 40 },
    ] }] },
  };
  const row = refreshGrid({ sessions }, { history, now }).balance.rows.find((r) => r.key === 'quads');
  assert.ok(row.blocks[19] > row.blocks[18], `${row.blocks[19]} should be fresher than ${row.blocks[18]}`);
});

test('the clock matches finished sets and a future assist adds no half load', () => {
  const now = Date.parse('2026-11-18T14:00:00');
  const history = {
    7: { id: 7, muscle: 'biceps', log: [{ date: '2026-11-17T18:00:00', sets: [
      { reps: 10, weight: 20 }, { reps: 10, weight: 20 }, { reps: 10, weight: 20 },
    ] }] },
  };
  const pull = (n) => Array.from({ length: n }, () => ({ reps: 8, weight: 40 }));
  const sessions = [
    { key: 'A', name: 'A', weekday: 1, slot: 4, exercises: [{ id: 99, pattern: 'hpull', sets: pull(4) }] },
    { key: 'B', name: 'B', weekday: 4, slot: 4, exercises: [{ id: 100, pattern: 'hpull', sets: pull(2) }] },
  ];
  const grid = refreshGrid({ sessions }, { history, now });
  const events = historyEvents(history, undefined, now);
  const biceps = grid.balance.rows.find((r) => r.key === 'biceps');
  const lats = grid.balance.rows.find((r) => r.key === 'lats');
  const nowBlock = 10;
  const friday = 19;
  assert.equal(biceps.blocks[nowBlock], recoveryAt(events, 'biceps', now, 1));
  assert.ok(biceps.blocks[nowBlock] < 100);
  assert.equal(biceps.blocks[friday], recoveryAt(events, 'biceps', Date.parse('2026-11-20T23:59:59.999'), 1));
  assert.ok(lats.blocks[friday] < 100);
  assert.equal(lats.blocks[nowBlock], 100);
});

test('an earlier hour the next day leaves less recovery', () => {
  const now = Date.parse('2026-11-16T12:00:00');
  const early = refreshGrid(plan([{ weekday: 0, slot: 4 }, { weekday: 1, slot: 0 }]), { history: {}, now });
  const late = refreshGrid(plan([{ weekday: 0, slot: 4 }, { weekday: 1, slot: 4 }]), { history: {}, now });
  assert.equal(sessionAtHours(early.sessions, 1) - sessionAtHours(early.sessions, 0), 12);
  assert.ok(quad(early, 5) < quad(late, 7));
});

test('a named walk takes the place of the generic outdoor card on the same day', () => {
  const plan = {
    dayTypes: ['combinatie', 'buiten', 'circuit'],
    weekdays: [0, 1, 2],
    slots: [4, 4, 4],
    daysPerWeek: 3,
    sessions: [
      { key: 'A', name: 'Full Body A', weekday: 0, slot: 4, exercises: [] },
      { key: 'OUT', name: 'Cardio buiten', outdoor: true, type: 'buiten', weekday: 1, slot: 4, exercises: [] },
      { key: 'X1', name: 'Wandelen', outdoor: true, activity: 'wandelen', weekday: 1, slot: 4, exercises: [] },
    ],
  };
  assert.equal(preferNamedOutdoor(plan), true);
  assert.deepEqual(plan.sessions.map((s) => s.name), ['Full Body A', 'Wandelen']);
  assert.deepEqual(plan.dayTypes, ['combinatie', 'circuit']);
  assert.equal(plan.daysPerWeek, 2);
});

test('a walk is a week activity and stays put when that day is dragged', () => {
  const plan = {
    dayTypes: ['combinatie', 'buiten', 'combinatie'],
    sessions: [
      { key: 'A', name: 'Full Body A', weekday: 0, slot: 2, exercises: [] },
      { key: 'W', name: 'Wandelen', outdoor: true, type: 'buiten', activity: 'wandelen', weekday: 0, slot: 5, exercises: [] },
      { key: 'B', name: 'Full Body B', weekday: 4, slot: 4, exercises: [] },
    ],
  };
  alignPlanDays(plan);
  assert.equal(plan.sessions.find((s) => s.key === 'W').weekday, undefined);
  assert.equal(plan.sessions.at(-1).key, 'W');
  assert.equal(plan.sessions.find((s) => s.key === 'A').weekday, 0);
  assert.equal(moveTrainingDay(plan.sessions, 'A', 2, 2), true);
  assert.equal(plan.sessions.find((s) => s.key === 'W').weekday, undefined);
  assert.equal(plan.sessions.find((s) => s.key === 'A').weekday, 2);
});

test('a workout without a day can be placed without moving the others', () => {
  const sessions = [
    { key: 'a', weekday: 0, slot: 4 },
    { key: 'w', outdoor: true, type: 'buiten', activity: 'wandelen' },
    { key: 'x' },
  ];
  assert.equal(moveTrainingDay(sessions, 'x', 1, 4), true);
  assert.deepEqual(sessions.find((s) => s.key === 'x'), { key: 'x', weekday: 1, slot: 4 });
  assert.equal(sessions.find((s) => s.key === 'a').weekday, 0);
  assert.equal(sessions.find((s) => s.key === 'w').weekday, undefined);
});

test('a new workout gets a free day even when a walk has no day', () => {
  const plan = { sessions: [{ key: 'a', weekday: 0, slot: 4 }, { key: 'w', outdoor: true, type: 'buiten' }] };
  const sess = { key: 'x' };
  assignFreeWeekday(plan, sess);
  assert.equal(sess.weekday, 1);
  assert.equal(sess.slot, 4);
});

test('dragging one workout moves every workout of that day by the same day and time', () => {
  const sessions = [
    { key: 'a', weekday: 0, slot: 1 },
    { key: 'b', weekday: 0, slot: 4 },
    { key: 'c', weekday: 3, slot: 4 },
  ];
  assert.equal(moveTrainingDay(sessions, 'a', 2, 2), true);
  assert.deepEqual(sessions.find((s) => s.key === 'a'), { key: 'a', weekday: 2, slot: 2 });
  assert.deepEqual(sessions.find((s) => s.key === 'b'), { key: 'b', weekday: 2, slot: 5 });
  assert.deepEqual(sessions.find((s) => s.key === 'c'), { key: 'c', weekday: 3, slot: 4 });
});

test('moving one column keeps two neighbouring workouts in two columns', () => {
  const sessions = [
    { key: 'a', weekday: 0, slot: 3 },
    { key: 'b', weekday: 0, slot: 4 },
  ];
  assert.equal(moveTrainingDay(sessions, 'a', 0, 5), true);
  assert.equal(sessions.find((s) => s.key === 'a').weekday, 0);
  assert.equal(sessions.find((s) => s.key === 'a').slot, 5);
  assert.equal(sessions.find((s) => s.key === 'b').weekday, 1);
  assert.equal(sessions.find((s) => s.key === 'b').slot, 0);
});

test('moving the later column left keeps the two workouts apart', () => {
  const sessions = [
    { key: 'a', weekday: 0, slot: 3 },
    { key: 'b', weekday: 0, slot: 4 },
  ];
  assert.equal(moveTrainingDay(sessions, 'b', 0, 2), true);
  assert.equal(sessions.find((s) => s.key === 'a').weekday, 0);
  assert.equal(sessions.find((s) => s.key === 'a').slot, 1);
  assert.equal(sessions.find((s) => s.key === 'b').weekday, 0);
  assert.equal(sessions.find((s) => s.key === 'b').slot, 2);
});

test('a moved workout takes the nearest free hour when the target is taken', () => {
  const sessions = [
    { key: 'a', weekday: 0, slot: 4 },
    { key: 'c', weekday: 2, slot: 4 },
  ];
  assert.equal(moveTrainingDay(sessions, 'a', 2, 4), true);
  assert.equal(sessions.find((s) => s.key === 'a').weekday, 2);
  assert.equal(sessions.find((s) => s.key === 'a').slot, 5);
  assert.equal(sessions.find((s) => s.key === 'c').slot, 4);
});

test('a weekday stays with its workout when the rows are out of order', () => {
  const ordered = orderTrainingDays(['buiten', 'combinatie'], [5, 0]);
  assert.deepEqual(ordered.dayTypes, ['combinatie', 'buiten']);
  assert.deepEqual(ordered.weekdays, [0, 5]);
});
