import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAdjustments } from '../lib/ai.js';

const plan = {
  sessions: [{
    key: 'A', name: 'Push',
    exercises: [{ id: 7, title: 'Bench', sets: [{ weight: 20, reps: 8 }] }],
  }],
};
const allowed = new Set([7]);

test('a heavier proposal may reach 15% above the previous session', () => {
  const history = { 7: { log: [{ sets: [{ weight: 40, reps: 8 }, { weight: 40, reps: 8 }, { weight: 20, reps: 12 }] }] } };
  const out = validateAdjustments([{ session: 'A', exerciseId: 7, weight: 50 }], plan, allowed, null, history);
  assert.equal(out[0].weight, 46);
});

test('without history the cap stays 15% above the proposal', () => {
  const out = validateAdjustments([{ session: 'A', exerciseId: 7, weight: 50 }], plan, allowed, null, {});
  assert.equal(out[0].weight, 23);
});

test('a proposal already above the previous session is not cut', () => {
  const history = { 7: { log: [{ sets: [{ weight: 10, reps: 8 }] }] } };
  const out = validateAdjustments([{ session: 'A', exerciseId: 7, weight: 50 }], plan, allowed, null, history);
  assert.equal(out.length, 0);
});
