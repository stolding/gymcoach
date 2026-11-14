import test from 'node:test';
import assert from 'node:assert/strict';
import { propose, normalize, goalFor, applyMinutes } from './actgoal.js';

test('walk baseline without measurements', () => {
  const p = propose('wandelen', [], '2026-11-14');
  assert.deepEqual({ times: p.times, minutes: p.minutes, km: p.km, recent: p.recent }, { times: 3, minutes: 45, km: null, recent: null });
});

test('short walk keeps the baseline and scales kilometres from pace', () => {
  const p = propose('wandelen', [{ type: 'wandelen', date: '2026-11-14', minutes: 31, km: 1.9, label: 'Wandelen', name: 'Outdoor Walk' }], '2026-11-14');
  assert.equal(p.times, 3);
  assert.equal(p.minutes, 45);
  assert.equal(p.km, 8.3);
  assert.deepEqual(p.recent, { times: 1, minutes: 31, km: 1.9 });
});

test('padel matches the label and has no kilometres', () => {
  const p = propose('padel', [{ type: 'racket', label: 'Padel', name: 'Padel', date: '2026-11-12', minutes: 70, km: 0 }], '2026-11-14');
  assert.equal(p.times, 1);
  assert.equal(p.minutes, 70);
  assert.equal(p.km, null);
});

test('normalize keeps a complete row and drops a partial one', () => {
  const goals = normalize([
    { id: 'zwemmen', times: 2, minutes: 30 },
    { id: 'yoga', times: 1, minutes: 40, km: 12 },
    { id: 'wandelen', times: 0, minutes: 45 },
  ]);
  assert.deepEqual(goals, [
    { id: 'zwemmen', times: 2, minutes: 30 },
    { id: 'yoga', times: 1, minutes: 40 },
  ]);
});

test('walk goal sets planned minutes on the matching session', () => {
  const goals = [{ id: 'wandelen', times: 3, minutes: 50 }];
  const plan = { sessions: [{ outdoor: true, activity: 'wandelen', estMinutes: 45 }, { outdoor: true, type: 'buiten', estMinutes: 45, exercises: [] }] };
  assert.equal(applyMinutes(plan, goals), true);
  assert.equal(plan.sessions[0].estMinutes, 50);
  assert.equal(plan.sessions[1].estMinutes, 50);
  assert.equal(goalFor({ outdoor: true, activity: 'zwemmen' }, goals), null);
});
