import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.GYMCOACH_DATA ??= path.join(os.tmpdir(), 'gc-strength-test');
const { statsExtra, strengthPdf } = await import('./insights.js');

const set = (date, weight, reps = 8) => ({ date, sets: [{ weight, reps }] });

test('a session far from the exercise median drops out the strength index', () => {
  const history = {
    row: { id: 1, name: 'Row', muscle: 'Lats', log: [set('2026-11-02', 80), set('2026-11-04', 81), set('2026-11-09', 82), set('2026-11-10', 20)] },
  };
  const lats = statsExtra({ history }, '2026-11-01').strength.find((x) => x.key === 'Lats');
  assert.ok(lats.points.every((p) => p.y > 95));
  assert.ok(Math.abs(lats.change) < 5);
});

test('two sessions stay, even when they differ by about a fifth', () => {
  const history = {
    press: { id: 2, name: 'Press', muscle: 'Pecs', log: [set('2026-11-02', 100, 5), set('2026-11-09', 80, 5)] },
  };
  const pecs = statsExtra({ history }, '2026-11-01').strength.find((x) => x.key === 'Pecs');
  assert.equal(pecs.points.at(-1).y, 80);
  assert.equal(pecs.change, -20);
});

test('the weekly muscle point is the median, so one light exercise does not pull it down', () => {
  const history = {
    a: { id: 3, name: 'A', muscle: 'Biceps', log: [set('2026-11-02', 30), set('2026-11-09', 30)] },
    b: { id: 4, name: 'B', muscle: 'Biceps', log: [set('2026-11-02', 30), set('2026-11-09', 30)] },
    c: { id: 5, name: 'C', muscle: 'Biceps', log: [set('2026-11-02', 30), set('2026-11-09', 18)] },
  };
  const bi = statsExtra({ history }, '2026-11-01').strength.find((x) => x.key === 'Biceps');
  assert.equal(bi.points.at(-1).y, 100);
});

test('strength report pdf keeps only the requested muscle groups', () => {
  const buf = strengthPdf({
    strength: [
      { key: 'Lats', label: 'Lats', change: 2.5, points: [{ x: '2026-11-02', y: 100 }, { x: '2026-11-09', y: 102.5 }] },
      { key: 'Pecs', label: 'PecsOnly', change: -4, points: [{ x: '2026-11-02', y: 100 }, { x: '2026-11-09', y: 96 }] },
    ],
    since: '2026-11-01', userName: 'A', keys: ['Lats'],
  });
  const text = buf.toString('latin1');
  assert.equal(text.slice(0, 5), '%PDF-');
  assert.match(text, /Lats/);
  assert.doesNotMatch(text, /PecsOnly/);
});
