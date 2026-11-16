import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshGrid } from '../lib/weekbalance.js';
import { defaultWeekdays, orderTrainingDays, sessionOffsetHours } from '../lib/weekdays.js';

function plan(weekdays) {
  return {
    sessions: weekdays.map((weekday, i) => ({
      key: 'S' + i,
      name: 'S' + i,
      weekday,
      exercises: i === 0 ? [{ pattern: 'squat', sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }] }] : [],
    })),
  };
}

function quadAtSecond(p) {
  return p.balance.rows.find((r) => r.key === 'quads').cells[1].pct;
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
  const close = refreshGrid(plan([0, 1]), { history: {}, now: 1e12 });
  const far = refreshGrid(plan([0, 6]), { history: {}, now: 1e12 });
  assert.ok(quadAtSecond(close) < 90);
  assert.ok(quadAtSecond(far) >= 90);
  assert.ok(quadAtSecond(close) < quadAtSecond(far));
});

test('a weekday stays with its workout when the rows are out of order', () => {
  const ordered = orderTrainingDays(['buiten', 'combinatie'], [5, 0]);
  assert.deepEqual(ordered.dayTypes, ['combinatie', 'buiten']);
  assert.deepEqual(ordered.weekdays, [0, 5]);
});
