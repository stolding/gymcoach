import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { pickWarmCool } from '../lib/engine.js';

const library = JSON.parse(readFileSync(new URL('../lib/library.snapshot.json', import.meta.url)));
const ids = (rows) => rows.map((r) => r.id);

test('two workouts in one week do not share the same warm-up', () => {
  const a = pickWarmCool(library, 'upper', 46 * 13);
  const b = pickWarmCool(library, 'upper', 46 * 13 + 1);
  assert.notDeepEqual(ids(a.mobility), ids(b.mobility));
  assert.notDeepEqual(ids(a.stretch), ids(b.stretch));
});

test('the next week picks other exercises', () => {
  const a = pickWarmCool(library, 'lower', 46 * 13);
  const b = pickWarmCool(library, 'lower', 47 * 13);
  assert.notDeepEqual(ids(a.mobility), ids(b.mobility));
  assert.notDeepEqual(ids(a.stretch), ids(b.stretch));
});

test('a new draw skips the exercises already in the workout', () => {
  const first = pickWarmCool(library, 'upper', 4);
  const again = pickWarmCool(library, 'upper', 5, [], first.mobility.map((r) => r.id));
  for (const id of first.mobility.map((r) => r.id)) assert.equal(again.mobility.some((r) => r.id === id), false);
});

test('upper warm-up stays on the upper body and uses the catalogue', () => {
  const byId = new Map(library.map((e) => [e.id, e]));
  const upper = new Set(['Pecs', 'Rear Delts', 'Front Delts', 'Side Delts', 'Traps', 'Lats', 'Triceps', 'Biceps', 'Forearms']);
  const pick = pickWarmCool(library, 'upper', 3);
  assert.equal(pick.cable.length, 1);
  assert.equal(pick.mobility.length, 2);
  assert.equal(pick.stretch.length, 3);
  for (const row of pick.mobility) assert.equal(byId.get(row.id).tab, 'Warmup');
  for (const row of pick.stretch) assert.equal(byId.get(row.id).tab, 'Stretch');
  for (const row of [...pick.mobility, ...pick.stretch, ...pick.cable]) assert.equal(upper.has(byId.get(row.id).muscle), true);
});
