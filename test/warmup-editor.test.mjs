import test from 'node:test';
import assert from 'node:assert/strict';
import { toPushPlan, progressSession } from '../lib/engine.js';
import { ensureWarmItem, isTimedItem, syncWarmItem } from '../public/warmedit.js';

const plan = { generatedAt: '2026-11-23T12:00:00Z' };

function setsOf(push, title) {
  return push.exercises.filter((e) => e.title === title).map((e) => e.sets);
}

test('Bird Dog stays a timed hold: one set of seconds and no weight', () => {
  const bird = { id: 1, title: 'Bird Dog', dose: '30 s', reps: 30, weight: 0 };
  assert.equal(isTimedItem(bird, 'mobility'), true);
  ensureWarmItem(bird, 'mobility');
  assert.deepEqual(bird.sets, [{ reps: 30, weight: 0, rest: 10, mode: 1 }]);
  bird.sets[0].reps = 45;
  syncWarmItem(bird, 'mobility');
  assert.equal(bird.dose, '45 s');
  assert.equal(bird.weight, 0);
});

test('a per-side stretch keeps two holds, and the side label stays when the seconds change', () => {
  const stretch = { id: 2, title: 'Chest Stretch', dose: '30 s per kant' };
  ensureWarmItem(stretch, 'cool');
  assert.equal(stretch.sets.length, 2);
  assert.equal(stretch.sets[0].rest, 5);
  assert.equal(stretch.sets[1].weight, 0);
  stretch.sets[0].reps = 40;
  stretch.sets[1].reps = 40;
  syncWarmItem(stretch, 'cool');
  assert.equal(stretch.dose, '40 s per kant');
});

test('a cable warm-up keeps two weighted sets, and a saved prescription is what the machine gets', () => {
  const cable = { id: 3, title: 'Face Pull', reps: 12, weight: 2 };
  assert.equal(isTimedItem(cable, 'cable'), false);
  ensureWarmItem(cable, 'cable');
  assert.deepEqual(cable.sets.map((s) => s.rest), [30, 45]);
  cable.sets = [
    { reps: 10, weight: 4, rest: 20, mode: 2 },
    { reps: 8, weight: 5, rest: 25, mode: 1 },
    { reps: 6, weight: 6, rest: 30, mode: 1 },
  ];
  const session = {
    name: 'Push',
    warmup: {
      mobility: [{ id: 1, title: 'Bird Dog', dose: '30 s', seq: 1 }],
      cable: [{ ...cable, seq: 0 }],
    },
    exercises: [{ id: 9, title: 'Press', sets: [{ reps: 8, weight: 20, rest: 90, mode: 1 }] }],
    cooldown: [{ id: 2, title: 'Chest Stretch', dose: '30 s per kant' }],
  };
  const pushed = toPushPlan(plan, session, { pushMobility: 'on' });
  assert.deepEqual(pushed.exercises.map((e) => e.title), ['Face Pull', 'Bird Dog', 'Press', 'Chest Stretch']);
  assert.deepEqual(setsOf(pushed, 'Face Pull')[0], cable.sets);
  assert.deepEqual(setsOf(pushed, 'Bird Dog')[0], [{ reps: 30, weight: 0, mode: 1, rest: 10 }]);
  assert.deepEqual(setsOf(pushed, 'Chest Stretch')[0], [
    { reps: 30, weight: 0, mode: 1, rest: 5 },
    { reps: 30, weight: 0, mode: 1, rest: 5 },
  ]);
});

test('without a saved set list the machine still gets the old warm-up and cool-down', () => {
  const session = {
    name: 'Push',
    warmup: {
      mobility: [{ id: 1, title: 'Bird Dog', dose: '30 s per kant' }],
      cable: [{ id: 3, title: 'Face Pull', reps: 12, weight: 2 }],
    },
    exercises: [],
    cooldown: [{ id: 2, title: 'Chest Stretch', dose: '20 s' }],
  };
  const on = toPushPlan(plan, session, { pushMobility: 'on' });
  assert.deepEqual(setsOf(on, 'Face Pull')[0], [
    { reps: 12, weight: 2, mode: 1, rest: 30 },
    { reps: 12, weight: 2, mode: 1, rest: 45 },
  ]);
  assert.equal(setsOf(on, 'Bird Dog')[0].length, 2);
  assert.equal(setsOf(on, 'Chest Stretch')[0].length, 1);
  const off = toPushPlan(plan, session, { pushMobility: 'off' });
  assert.deepEqual(off.exercises.map((e) => e.title), ['Face Pull']);
});

test('automatic progression moves a weighted warm-up and leaves a timed hold alone', () => {
  const history = { '3': { log: [{ date: '2026-11-01', sets: [{ reps: 12, weight: 10 }, { reps: 12, weight: 10 }] }, { date: '2026-11-08', sets: [{ reps: 12, weight: 10 }, { reps: 12, weight: 10 }] }] } };
  const session = {
    warmup: {
      mobility: [{ id: 1, title: 'Bird Dog', dose: '30 s', sets: [{ reps: 30, weight: 0, rest: 10, mode: 1 }] }],
      cable: [{ id: 3, title: 'Face Pull', reps: 12, weight: 4, sets: [{ reps: 12, weight: 4, rest: 30, mode: 1 }, { reps: 12, weight: 4, rest: 45, mode: 1 }] }],
    },
    exercises: [],
    cooldown: [],
  };
  const next = progressSession(session, history);
  assert.equal(next.warmup.mobility[0].sets[0].reps, 30);
  assert.equal(next.warmup.mobility[0].sets[0].weight, 0);
  assert.ok(next.warmup.cable[0].sets[0].weight !== 4 || next.warmup.cable[0].note);
  assert.equal(next.warmup.cable[0].weight, next.warmup.cable[0].sets[0].weight);
});
