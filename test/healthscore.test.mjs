import assert from 'node:assert/strict';
import test from 'node:test';
import { ageSample, correction, interpolate, scoreOnDate, scoreValues, NORMS } from '../lib/healthscore.js';

const near = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

const REF = {
  fat: 19.4, visceral: 3.9, ffmi: 21.4, bmi: 26.5,
  bonePct: (3.6 / 89.7) * 100, restHr: 72, pwv: 10.2,
  vascDelta: 7, vo2max: 30.1, hrv: 27, nerve: 45.9,
  metDelta: -1, ecwTbw: 20.6 / 48.8,
};

test('interpolatie op, tussen en buiten de breekpunten', () => {
  const pts = [[0, 1], [10, 5]];
  assert.equal(interpolate(pts, 0), 1);
  assert.equal(interpolate(pts, 10), 5);
  assert.equal(interpolate(pts, 5), 3);
  assert.equal(interpolate(pts, -4), 1);
  assert.equal(interpolate(pts, 20), 5);
});

test('referentie man van 65', () => {
  const s = scoreValues({ values: REF, age: 65, sex: 'm' });
  near(s.categories.body, 8.1);
  near(s.categories.heart, 5.1);
  near(s.categories.fitness, 5.2);
  near(s.categories.other, 6.0);
  near(s.total, 6.1);
  assert.equal(s.normsApproximated, false);
});

test('vrouw van 65 met vet% 27,4 scoort hetzelfde als man 19,4', () => {
  const man = scoreValues({ values: { fat: 19.4 }, age: 65, sex: 'm' });
  const woman = scoreValues({ values: { fat: 27.4 }, age: 65, sex: 'v' });
  assert.equal(woman.metrics.fat.score, man.metrics.fat.score);
});

test('man van 25 met VO2max 48 scoort hetzelfde als man van 65 met 30', () => {
  const old = scoreValues({ values: { vo2max: 30 }, age: 65, sex: 'm' });
  const young = scoreValues({ values: { vo2max: 48 }, age: 25, sex: 'm' });
  assert.equal(young.metrics.vo2max.score, old.metrics.vo2max.score);
});

test('leeftijd 50 verschuift vet% met -1,75', () => {
  near(ageSample(NORMS.metrics.fat.age, 50), -1.75, 0.0001);
  near(correction('fat', 50, 'm').shift, -1.75, 0.0001);
});

test('BMI-correctie voor een vrouw gaat aan en uit op de verschoven grens', () => {
  const base = { ffmi: 17, bmi: 26.5, visceral: 4, bonePct: 4, restHr: 60, pwv: 8, vascDelta: 0, vo2max: 30, hrv: 40, nerve: 60, metDelta: 0, ecwTbw: 0.4 };
  const on = scoreValues({ values: { ...base, fat: 27 }, age: 65, sex: 'v' });
  const off = scoreValues({ values: { ...base, fat: 31 }, age: 65, sex: 'v' });
  assert.equal(on.metrics.bmi.bonus, true);
  assert.equal(off.metrics.bmi.bonus, undefined);
  assert.equal(on.metrics.bmi.score, 7.5);
  assert.equal(off.metrics.bmi.score, 6.5);
});

test('ontbrekende metriek herweegt de categorie en verlaagt coverage', () => {
  const values = { ...REF };
  delete values.bonePct;
  const s = scoreValues({ values, age: 65, sex: 'm' });
  near(s.coverage, 1 - 0.3 / 5, 0.001);
  assert.equal(s.metrics.bonePct, undefined);
  assert.ok(s.categories.body != null);
});

test('ontbrekende categorie herweegt het totaal', () => {
  const values = { ...REF };
  delete values.restHr; delete values.pwv; delete values.vascDelta;
  const s = scoreValues({ values, age: 65, sex: 'm' });
  near(s.coverage, 0.7, 0.001);
  assert.equal(s.categories.heart, null);
  const raw = (s.categoryRaw.body * 0.3 + s.categoryRaw.fitness * 0.25 + s.categoryRaw.other * 0.15) / 0.7;
  near(s.totalRaw, raw, 0.0001);
});

test('continuiteit rond een leeftijd zonder anker', () => {
  const a = scoreValues({ values: REF, age: 59.99, sex: 'm' });
  const b = scoreValues({ values: REF, age: 60, sex: 'm' });
  near(a.totalRaw, b.totalRaw, 0.05);
});

test('geen score onder 18 of zonder geboortedatum', () => {
  const young = scoreOnDate({ date: '2026-11-12', birthDate: '2010-01-01', sex: 'm', bodyLog: [{ date: '2026-11-12', kg: 70, fat: 18 }] });
  assert.equal(young.status, 'under18');
  assert.equal(young.total, null);
  const none = scoreOnDate({ date: '2026-11-12', birthDate: null, sex: 'm', bodyLog: [{ date: '2026-11-12', kg: 70 }] });
  assert.equal(none.status, 'nobirth');
});

test('randgevallen van geslacht en leeftijd', () => {
  const unknown = scoreValues({ values: REF, age: 65, sex: '' });
  assert.equal(unknown.normsApproximated, true);
  assert.equal(unknown.sexUsed, 'approx');
  const older = scoreValues({ values: REF, age: 90, sex: 'm' });
  assert.equal(older.normsApproximated, true);
  near(correction('fat', 90, 'm').shift, correction('fat', 85, 'm').shift, 0.0001);
});
