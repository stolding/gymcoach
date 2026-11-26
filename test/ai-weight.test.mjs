import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAdjustments, applyAdjustments } from '../lib/ai.js';

const plan = () => ({
  source: 'regels',
  sessions: [
    {
      key: 'A', name: 'Push', estMinutes: 40,
      exercises: [
        { id: 242, title: 'Bench', type: 'compound', pattern: 'hpush', repRange: [8, 12], sets: [{ weight: 20, reps: 8, rest: 90, mode: 1 }, { weight: 20, reps: 8, rest: 90, mode: 1 }] },
        { id: 47, title: 'Row', type: 'compound', pattern: 'hpull', repRange: [8, 12], sets: [{ weight: 30, reps: 10, rest: 90, mode: 1 }] },
      ],
      warmup: { cable: [{ id: 1, title: 'Arm circle', reps: 12, weight: 2 }], mobility: [] },
      cooldown: [{ id: 9, title: 'Chest stretch', dose: '30 s' }],
    },
    {
      key: 'B', name: 'Pull', estMinutes: 40,
      exercises: [{ id: 434, title: 'Pulldown', type: 'compound', pattern: 'vpull', repRange: [8, 12], sets: [{ weight: 25, reps: 8, rest: 90, mode: 1 }] }],
    },
  ],
});

const allowed = new Set([242, 2237, 47, 434]);
const names = new Map([[2237, 'Incline'], [2, 'Band pull']]);
const catalogIds = new Set([1, 2, 9, 242, 2237, 47, 434]);

test('weight, reps and set count from the coach are ignored', () => {
  const out = validateAdjustments([{ session: 'A', exerciseId: 242, weight: 50, reps: 12, sets: 5 }], plan(), allowed, null, {});
  assert.equal(out.length, 0);
});

test('a catalog swap stays, and the weight the coach sent does not', () => {
  const out = validateAdjustments([{ session: 'A', exerciseId: 242, swapToId: 2237, weight: 99, reason: 'balans' }], plan(), allowed, null, {}, { names });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'swap');
  assert.equal(out[0].swapTitle, 'Incline');
  assert.equal(out[0].weight, undefined);
  assert.equal(out[0].reps, undefined);
  assert.equal(out[0].sets, undefined);
});

test('a swap gets its weight and reps from the app rules', () => {
  const src = plan();
  const adj = validateAdjustments([{ session: 'A', exerciseId: 242, swapToId: 2237, weight: 99 }], src, allowed, null, {}, { names });
  applyAdjustments(src, adj, new Map([[2237, { id: 2237, name: 'Incline', muscle: 'Pecs' }]]), { history: {} });
  const ex = src.sessions[0].exercises[0];
  assert.equal(ex.id, 2237);
  assert.equal(ex.title, 'Incline');
  assert.equal(ex.sets.length, 2);
  assert.equal(ex.sets[0].weight, 10);
  assert.equal(ex.sets[0].reps, 8);
  assert.equal(ex.sets[0].rest, 90);
  assert.notEqual(ex.sets[0].weight, 99);
});

test('dropping an exercise shortens the session and keeps the other weights', () => {
  const src = plan();
  const adj = validateAdjustments([{ session: 'A', exerciseId: 47, drop: true, reason: 'te lang' }], src, allowed);
  assert.equal(adj[0].kind, 'drop');
  applyAdjustments(src, adj, new Map());
  assert.equal(src.sessions[0].exercises.length, 1);
  assert.equal(src.sessions[0].exercises[0].sets[0].weight, 20);
  assert.ok(src.sessions[0].estMinutes < 40);
});

test('moving an exercise keeps its sets and does not touch a locked session', () => {
  const src = plan();
  src.sessions[1].locked = true;
  const blocked = validateAdjustments([{ session: 'A', exerciseId: 47, moveTo: 'B' }], src, allowed);
  assert.equal(blocked.length, 0);
  src.sessions[1].locked = false;
  const adj = validateAdjustments([{ session: 'A', exerciseId: 47, moveTo: 'B', weight: 80 }], src, allowed);
  assert.equal(adj[0].kind, 'move');
  applyAdjustments(src, adj, new Map());
  assert.equal(src.sessions[0].exercises.some((e) => e.id === 47), false);
  const moved = src.sessions[1].exercises.find((e) => e.id === 47);
  assert.equal(moved.sets[0].weight, 30);
  assert.equal(moved.sets[0].reps, 10);
});

test('a warm-up swap changes the exercise and keeps the dose', () => {
  const src = plan();
  const adj = validateAdjustments([{ session: 'A', part: 'cable', exerciseId: 1, swapToId: 2, weight: 40 }], src, allowed, null, {}, { names, catalogIds });
  assert.equal(adj[0].kind, 'warmup');
  applyAdjustments(src, adj, new Map([[2, { id: 2, name: 'Band pull' }]]));
  assert.equal(src.sessions[0].warmup.cable[0].id, 2);
  assert.equal(src.sessions[0].warmup.cable[0].title, 'Band pull');
  assert.equal(src.sessions[0].warmup.cable[0].weight, 2);
});

test('one session does not move an exercise, and an own session is not dropped', () => {
  const src = plan();
  assert.equal(validateAdjustments([{ session: 'A', exerciseId: 47, moveTo: 'B' }], src, allowed, 'A').length, 0);
  src.sessions[0].locked = true;
  assert.equal(validateAdjustments([{ session: 'A', exerciseId: 47, drop: true }], src, allowed).length, 0);
  const swap = validateAdjustments([{ session: 'A', exerciseId: 242, swapToId: 2237 }], src, allowed, 'A', {}, { names });
  assert.equal(swap[0].kind, 'swap');
  assert.equal(swap[0].own, true);
});
