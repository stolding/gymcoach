import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHistory, exerciseRecent, recentPerformances, repsTimesKg } from '../lib/engine.js';

const row = (date, sets) => ({ date, trainingId: date, sets });
const set = (reps, weight, rest) => ({ reps, weight, ...(rest != null ? { rest } : {}) });

function history() {
  return {
    42: {
      id: 42,
      name: 'Seated Dual-Handle Neutral Grip Row',
      log: [
        row('2026-09-01', [set(10, 7)]),
        row('2026-09-20', [set(12, 8), set(12, 8), set(12, 8)]),
        row('2026-10-04', [set(12, 8), set(12, 8), set(10, 8)]),
        row('2026-10-18', [set(8, 4.5, 45), set(15, 8, 80), set(15, 8, 80), set(15, 8, 80)]),
        row('2026-11-01', [set(15, 8.5, 80), set(15, 8.5, 90), set(15, 8.5, 80)]),
        row('2026-11-08', [set(15, 9), set(12, 8), set(15, 9), set(12, 8)]),
        row('2026-11-18', [set(15, 9, 80), set(15, 9, 80), set(15, 9, 80)]),
      ],
    },
    7: {
      id: 7,
      name: 'Bench Press',
      log: [
        row('2026-11-20', [set(5, 100, 120)]),
        row('2026-11-21', [set(5, 110, 120)]),
      ],
    },
    'name:Other': {
      id: null,
      name: 'Other',
      log: [row('2026-11-19', [set(8, 20)])],
    },
  };
}

test('last 5 are the newest of this exercise only', () => {
  const out = recentPerformances(history(), 42);
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((r) => r.date), ['2026-11-18', '2026-11-08', '2026-11-01', '2026-10-18', '2026-10-04']);
  assert.equal(out[0].reps, '15/15/15');
  assert.equal(out[0].kg, 9);
  assert.equal(out[0].rest, 80);
  assert.equal(out[0].total, 405);
  assert.equal(out[1].reps, '15/15');
  assert.equal(out[1].kg, 9);
  assert.equal(out[1].rest, undefined);
  assert.equal(out[1].total, 270);
  assert.equal(out[3].total, 360);
  assert.equal(out[2].rest, undefined);
  assert.equal(out[3].reps, '15/15/15');
  assert.equal(out[3].kg, 8);
  assert.equal(out[3].rest, 80);
  assert.ok(out.every((r) => r.kg !== 100 && r.kg !== 110 && r.kg !== 20));
});

test('fewer than 5 logs returns only what exists', () => {
  const hist = { 7: history()[7] };
  const out = recentPerformances(hist, '7');
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => r.date), ['2026-11-21', '2026-11-20']);
  assert.equal(out[0].reps, '5');
  assert.equal(out[0].kg, 110);
  assert.equal(out[0].rest, 120);
  assert.equal(out[0].total, 550);
});

test('reps times kg is the set total, and a session total only counts the shown sets', () => {
  assert.equal(repsTimesKg([{ reps: 12, weight: 15 }]), 180);
  assert.equal(repsTimesKg([{ reps: 12, weight: 15 }, { reps: 12, weight: 15 }, { reps: 12, weight: 15 }]), 540);
  assert.equal(repsTimesKg([{ reps: 15, weight: 8.5 }, { reps: 15, weight: 8.5 }]), 255);
  assert.equal(repsTimesKg([]), 0);
  assert.equal(repsTimesKg([{ reps: 0, weight: 20 }, { reps: 10 }]), 0);
  const mixed = recentPerformances({
    1: { id: 1, log: [row('2026-11-18', [set(8, 4.5, 45), set(15, 9, 80), set(15, 9, 80), set(15, 9, 80)])] },
  }, 1);
  assert.equal(mixed[0].reps, '15/15/15');
  assert.equal(mixed[0].kg, 9);
  assert.equal(mixed[0].total, 405);
});

test('empty, unknown and a limit of zero stay empty', () => {
  assert.deepEqual(recentPerformances(history(), 99), []);
  assert.deepEqual(recentPerformances({ 1: { id: 1, log: [] } }, 1), []);
  assert.deepEqual(recentPerformances(null, 1), []);
  assert.deepEqual(recentPerformances(history(), 42, 0), []);
});

test('exerciseRecent keeps each exercise on its own id', () => {
  const map = exerciseRecent(history());
  assert.deepEqual(Object.keys(map).sort(), ['42', '7']);
  assert.equal(map['42'].length, 5);
  assert.equal(map['7'].length, 2);
  assert.ok(map['42'].every((r) => r.date < '2026-11-20'));
  assert.ok(map['7'].every((r) => r.kg >= 100));
});

test('buildHistory does not mix exercises, and rest comes from the set', () => {
  const rep = (count, weight, rest) => ({ finishedCount: count, weight, targetCount: count, breakTime: rest, capacity: count * weight });
  const sessions = {};
  for (let i = 1; i <= 6; i++) {
    sessions['t' + i] = {
      date: `2026-10-${String(i).padStart(2, '0')}`,
      training_id: 't' + i,
      detail: [
        { actionLibraryName: 'Seated Row', finishedReps: [rep(15, 9, 80), rep(15, 9, 80), rep(15, 9, 80)] },
        { actionLibraryName: 'Bench Press', finishedReps: [rep(8, 40, 90)] },
      ],
    };
  }
  const built = buildHistory(sessions, [{ id: 42, name: 'Seated Row' }, { id: 7, name: 'Bench Press' }]);
  const rowLog = recentPerformances(built, 42);
  const bench = recentPerformances(built, 7);
  assert.equal(rowLog.length, 5);
  assert.equal(bench.length, 5);
  assert.deepEqual(rowLog.map((r) => r.date), ['2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02']);
  assert.ok(rowLog.every((r) => r.reps === '15/15/15' && r.kg === 9 && r.rest === 80 && r.total === 405));
  assert.ok(bench.every((r) => r.reps === '8' && r.kg === 40 && r.rest === 90 && r.total === 320));
  assert.equal(built['42'].log.length, 6);
});

// Het losse veld weight bevatte hier het aantal herhalingen (22) en finishedCount de kilo (14).
// De lijst trainingInfoDetail.weights is de sessie: 22 keer 14 kg.
test('2 sets of 22 reps at 14 kg are not shown as 14/14 and 22 kg', () => {
  const crossed = (reps, kg) => ({
    finishedCount: kg,
    weight: reps,
    targetCount: 15,
    breakTime: 45,
    capacity: reps * kg,
    trainingInfoDetail: { weights: Array(reps).fill(kg) },
  });
  const sessions = {
    a: {
      date: '2026-11-13', training_id: 'a',
      detail: [{ actionLibraryName: 'Standing Tricep Rope Pushdown', maxWeight: 22, finishedReps: [crossed(22, 14), crossed(22, 14)] }],
    },
    b: {
      date: '2026-11-04', training_id: 'b',
      detail: [{ actionLibraryName: 'Standing Tricep Rope Pushdown', maxWeight: 26, finishedReps: [crossed(26, 12)] }],
    },
    c: {
      date: '2026-11-01', training_id: 'c',
      detail: [{
        actionLibraryName: 'Standing Tricep Rope Pushdown', maxWeight: 22,
        finishedReps: [{ finishedCount: 14, weight: 22, breakTime: 45, capacity: 14 * 22, trainingInfoDetail: { weights: Array(14).fill(22) } }],
      }],
    },
  };
  const built = buildHistory(sessions, [{ id: 319, name: 'Standing Tricep Rope Pushdown' }]);
  const rows = recentPerformances(built, 319);
  assert.equal(rows[0].date, '2026-11-13');
  assert.equal(rows[0].reps, '22/22');
  assert.equal(rows[0].kg, 14);
  assert.equal(rows[0].total, 616);
  assert.notEqual(`${rows[0].reps}|${rows[0].kg}`, '14/14|22');
  assert.equal(rows[1].reps, '26');
  assert.equal(rows[1].kg, 12);
  assert.equal(rows[1].total, 312);
  assert.equal(rows[2].reps, '14');
  assert.equal(rows[2].kg, 22);
  assert.equal(rows[2].total, 308);
});
