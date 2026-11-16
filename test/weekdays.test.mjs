import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshGrid } from '../lib/weekbalance.js';
import { defaultWeekdays, moveTrainingDay, orderTrainingDays, preferNamedOutdoor, sessionAtHours, sessionOffsetHours } from '../lib/weekdays.js';

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
  const close = refreshGrid(plan([0, 1]), { history: {}, now: Date.parse('2026-11-16T12:00:00') });
  const far = refreshGrid(plan([0, 6]), { history: {}, now: Date.parse('2026-11-16T12:00:00') });
  assert.equal(close.balance.rows[0].blocks.length, 28);
  assert.equal(quad(close, 2), 100);
  assert.ok(quad(close, 3) < 90);
  assert.ok(quad(close, 7) < quad(far, 27));
  assert.equal(close.balance.rows.find((r) => r.key === 'quads').hits[0].role, 'prime');
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
