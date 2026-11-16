import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshGrid } from '../lib/weekbalance.js';
import { defaultWeekdays, orderTrainingDays, sessionAtHours, sessionOffsetHours } from '../lib/weekdays.js';

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

test('a weekday stays with its workout when the rows are out of order', () => {
  const ordered = orderTrainingDays(['buiten', 'combinatie'], [5, 0]);
  assert.deepEqual(ordered.dayTypes, ['combinatie', 'buiten']);
  assert.deepEqual(ordered.weekdays, [0, 5]);
});
