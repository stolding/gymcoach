import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeTarget, mifflin, deficitTone, buildDays, homeBoard } from '../lib/goal.js';

const nov13 = { rmr: 1742, maintenance: 2695, target: 2328 };

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

test('onder de streeflijn blijft groen, geel vanaf 10% van onderhoud, rood alleen boven onderhoud', () => {
  const tone = (intake) => deficitTone({ ...nov13, intake });
  assert.equal(tone(994.51), null);
  assert.equal(tone(1742), 'ok');
  assert.equal(tone(1800), 'ok');
  assert.equal(tone(2328), 'ok');
  const edge = nov13.target + nov13.maintenance * 0.1;
  assert.equal(tone(edge - 1), 'ok');
  assert.equal(tone(edge), 'warn');
  assert.equal(tone(nov13.maintenance), 'warn');
  assert.equal(tone(nov13.maintenance + 1), 'bad');
  assert.equal(deficitTone({ ...nov13, intake: null }), null);
});

test('elke gesloten dag houdt de som van de streeflijn en de kleur', () => {
  const calc = intakeTarget({ sex: 'm', kg: 80, cm: 180, age: 40, activeKcal: 400, deficit: 300, cutting: true });
  const yellow = calc.target + calc.maintenance * 0.1;
  const days = buildDays({
    outcome: { composition: { startDate: '2026-11-20', endDate: '2026-12-18', deficit: 300, surplus: 0, weightDeltaKg: -2 } },
    settings: { sex: 'm', heightCm: 180, birthYear: 1986 },
    bodyLog: [{ date: '2026-11-01', kg: 80 }],
    daily: [
      { date: '2026-11-20', intakeKcal: calc.target - 400, activeKcal: 400 },
      { date: '2026-11-21', intakeKcal: yellow, activeKcal: 400 },
      { date: '2026-11-22', intakeKcal: calc.maintenance + 40, activeKcal: 400 },
      { date: '2026-11-23', intakeKcal: 900, activeKcal: 400 },
    ],
    today: '2026-11-24',
  });
  const under = days.find((d) => d.date === '2026-11-20');
  assert.equal(under.rmr, calc.rmr);
  assert.equal(under.sedentary, calc.sedentary);
  assert.equal(under.activeMean, 400);
  assert.equal(under.planned, 300);
  assert.equal(under.floored, false);
  assert.equal(under.maintenance - under.target, 300);
  assert.equal(under.tone, 'ok');
  assert.ok(under.intake < under.target);
  assert.equal(days.find((d) => d.date === '2026-11-21').tone, 'warn');
  assert.equal(days.find((d) => d.date === '2026-11-22').tone, 'bad');
  assert.equal(days.find((d) => d.date === '2026-11-23').tone, null);
  const today = days.find((d) => d.date === '2026-11-24');
  assert.equal(today.open, true);
  assert.equal(today.target, null);
  const board = homeBoard({
    outcome: { composition: { startDate: '2026-11-20', endDate: '2026-12-18', deficit: 300, surplus: 0 } },
    bodyLog: [], history: {}, today: '2026-11-24', calc: { ok: true, target: calc.target, protein: 160 },
    days, goalTracks: [],
  });
  assert.equal(board.spark[0].planned, 300);
  assert.equal(board.spark[0].activeMean, 400);
  assert.equal(board.spark[0].tone, 'ok');
  assert.equal(board.spark.at(-1).tone, null);
});
