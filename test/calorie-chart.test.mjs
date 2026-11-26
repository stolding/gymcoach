import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeTarget, mifflin, deficitTone, buildDays, homeBoard, assemble, trainingRaise } from '../lib/goal.js';

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

test('tussen streef en BMR: bovenste helft groen, dan geel, het kwart bij de BMR rood', () => {
  const tone = (intake) => deficitTone({ ...nov13, intake });
  const span = nov13.target - nov13.rmr;
  const quarter = nov13.rmr + span * 0.25;
  const mid = nov13.rmr + span * 0.5;
  assert.equal(tone(994.51), null);
  assert.equal(tone(nov13.rmr), 'bad');
  assert.equal(tone(quarter - 1), 'bad');
  assert.equal(tone(quarter), 'warn');
  assert.equal(tone(mid - 1), 'warn');
  assert.equal(tone(mid), 'ok');
  assert.equal(tone(nov13.target), 'ok');
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
      { date: '2026-11-20', intakeKcal: Math.round((calc.target + calc.rmr) / 2) + 40, activeKcal: 400 },
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
  assert.ok(under.intake > (under.target + under.rmr) / 2);
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

test('een voorbije dag gebruikt de beweging van die dag, niet het gemiddelde', () => {
  const settings = { sex: 'm', heightCm: 180, birthYear: 1986 };
  const outcome = { composition: { startDate: '2026-11-20', endDate: '2026-12-18', deficit: 300, surplus: 0, weightDeltaKg: -2 } };
  const bodyLog = [{ date: '2026-11-01', kg: 80 }];
  const intake = 2300;
  const days = buildDays({
    outcome, settings, bodyLog, today: '2026-11-24',
    daily: [
      { date: '2026-11-20', intakeKcal: intake, activeKcal: 100 },
      { date: '2026-11-21', intakeKcal: intake, activeKcal: 900 },
      { date: '2026-11-22', intakeKcal: intake },
    ],
  });
  const rest = days.find((d) => d.date === '2026-11-20');
  const train = days.find((d) => d.date === '2026-11-21');
  const missing = days.find((d) => d.date === '2026-11-22');
  assert.equal(rest.activeMean, 100);
  assert.equal(train.activeMean, 900);
  assert.equal(rest.maintenance, rest.sedentary + 100);
  assert.equal(train.maintenance, train.sedentary + 900);
  assert.equal(rest.maintenance - rest.target, 300);
  assert.equal(train.maintenance - train.target, 300);
  assert.notEqual(rest.tone, train.tone);
  assert.equal(rest.tone, 'bad');
  assert.equal(train.tone, 'ok');
  assert.equal(missing.target, null);
  assert.equal(missing.tone, null);
  assert.equal(missing.maintenance, null);
});

test('vandaag houdt het gemiddelde van 7 dagen en gaat omhoog als er een training gepland is', () => {
  const today = '2026-11-24';
  const weekday = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const daily = [];
  for (let i = 1; i <= 7; i++) {
    const date = ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'][i - 1];
    const trained = i % 2 === 1;
    daily.push({ date, activeKcal: trained ? 800 : 200, intakeKcal: 2100 });
  }
  const workouts = daily.filter((d) => d.activeKcal === 800).map((d) => ({ date: d.date, calories: 500 }));
  const plan = { sessions: [{ weekday, key: 'A' }, { weekday: (weekday + 2) % 7, key: 'B' }] };
  const settings = { sex: 'm', heightCm: 180, birthYear: 1986, outcome: { composition: { startDate: '2026-11-17', deficit: 300, surplus: 0 } } };
  const quiet = assemble({ settings, bodyLog: [{ date: '2026-11-01', kg: 80 }], daily, history: {}, today, plan: { sessions: [] }, workouts });
  const raised = assemble({ settings, bodyLog: [{ date: '2026-11-01', kg: 80 }], daily, history: {}, today, plan, workouts });
  assert.equal(trainingRaise(daily, today, plan, workouts), raised.calc.session);
  assert.ok(raised.calc.session > 0);
  assert.equal(quiet.calc.active, raised.calc.active);
  assert.equal(raised.calc.maintenance, quiet.calc.maintenance + raised.calc.session);
  assert.equal(raised.calc.lines.some((line) => line.key === 'session'), true);
  assert.equal(quiet.calc.lines.some((line) => line.key === 'session'), false);
  assert.equal(raised.below, quiet.below);
  const past = raised.days.find((d) => d.date === '2026-11-22');
  assert.equal(past.activeMean, 200);
  assert.equal(past.maintenance, past.sedentary + 200);
});
