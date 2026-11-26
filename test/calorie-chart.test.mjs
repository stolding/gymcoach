import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeTarget, mifflin, deficitTone, buildDays, homeBoard } from '../lib/goal.js';

test('de streeflijn is onderhoud min het tekort van het doel, en zakt niet onder de ruststofwisseling', () => {
  const rmr = mifflin({ sex: 'm', kg: 80, cm: 180, age: 40 });
  const calc = intakeTarget({ sex: 'm', kg: 80, cm: 180, age: 40, activeKcal: 400, deficit: 300, cutting: true });
  assert.equal(calc.rmr, rmr);
  assert.equal(calc.sedentary, Math.round(rmr * 1.2));
  assert.equal(calc.active, 400);
  assert.equal(calc.maintenance, calc.sedentary + 400);
  assert.equal(calc.target, calc.maintenance - 300);
  assert.ok(calc.maintenance > calc.target);
  assert.ok(calc.target > calc.rmr);
  const floored = intakeTarget({ sex: 'm', kg: 80, cm: 180, age: 40, activeKcal: 0, deficit: 9000, cutting: true });
  assert.equal(floored.target, floored.rmr);
  assert.equal(floored.floored, true);
});

test('het tekort kleurt groen dicht bij het doel, geel iets ernaast en rood ver ernaast', () => {
  const maint = 2200;
  assert.equal(deficitTone(maint - 300, maint, 300), 'ok');
  assert.equal(deficitTone(maint - 450, maint, 300), 'warn');
  assert.equal(deficitTone(maint - 150, maint, 300), 'warn');
  assert.equal(deficitTone(maint - 700, maint, 300), 'bad');
  assert.equal(deficitTone(maint + 200, maint, 300), 'bad');
  assert.equal(deficitTone(2450, maint, -250), 'ok');
  assert.equal(deficitTone(null, maint, 300), null);
});

test('elke gesloten dag houdt ruststofwisseling, onderhoud en de kleur van het tekort', () => {
  const calc = intakeTarget({ sex: 'm', kg: 80, cm: 180, age: 40, activeKcal: 400, deficit: 300, cutting: true });
  const days = buildDays({
    outcome: { composition: { startDate: '2026-11-20', endDate: '2026-12-18', deficit: 300, surplus: 0, weightDeltaKg: -2 } },
    settings: { sex: 'm', heightCm: 180, birthYear: 1986 },
    bodyLog: [{ date: '2026-11-01', kg: 80 }],
    daily: [
      { date: '2026-11-20', intakeKcal: calc.target, activeKcal: 400 },
      { date: '2026-11-21', intakeKcal: calc.maintenance - 450, activeKcal: 400 },
      { date: '2026-11-22', intakeKcal: calc.maintenance + 400, activeKcal: 400 },
    ],
    today: '2026-11-23',
  });
  const on = days.find((d) => d.date === '2026-11-20');
  assert.equal(on.rmr, calc.rmr);
  assert.equal(on.maintenance, calc.maintenance);
  assert.equal(on.target, calc.target);
  assert.equal(on.maintenance - on.target, 300);
  assert.equal(on.tone, 'ok');
  assert.equal(days.find((d) => d.date === '2026-11-21').tone, 'warn');
  assert.equal(days.find((d) => d.date === '2026-11-22').tone, 'bad');
  const today = days.find((d) => d.date === '2026-11-23');
  assert.equal(today.open, true);
  assert.equal(today.target, null);
  assert.equal(today.rmr, null);
  const board = homeBoard({
    outcome: { composition: { startDate: '2026-11-20', endDate: '2026-12-18', deficit: 300, surplus: 0 } },
    bodyLog: [], history: {}, today: '2026-11-23', calc: { ok: true, target: calc.target, protein: 160 },
    days, goalTracks: [],
  });
  assert.equal(board.spark.length, 3);
  assert.equal(board.spark[0].maintenance, calc.maintenance);
  assert.equal(board.spark[0].rmr, calc.rmr);
  assert.equal(board.spark[0].tone, 'ok');
  assert.equal(board.spark.at(-1).tone, 'bad');
});
