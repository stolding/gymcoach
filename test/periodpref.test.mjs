import assert from 'node:assert/strict';
import { rememberPeriod, rememberedPeriod, keepOnLogout, periodStorageKey } from '../public/periodpref.js';

const mem = () => {
  const box = new Map();
  return {
    getItem: (k) => (box.has(k) ? box.get(k) : null),
    setItem: (k, v) => box.set(k, String(v)),
  };
};

assert.equal(rememberedPeriod(mem(), 'u1', 'bodyComp'), 'all', 'zonder keuze de standaard');

const box = mem();
box.setItem('gc-body-range', 'ytd');
box.setItem('gc-stat-range', 'year');
assert.equal(rememberedPeriod(box, 'ada', 'bodyComp'), 'ytd');
assert.equal(rememberedPeriod(box, 'ada', 'bodySeg'), 'ytd');
assert.equal(box.getItem(periodStorageKey('ada', 'bodyComp')), 'ytd', 'oude sleutel gaat naar dit scherm');
assert.equal(rememberedPeriod(box, 'ada', 'stats'), 'year');

box.setItem(periodStorageKey('ada', 'stats'), 'nope');
assert.equal(rememberedPeriod(box, 'ada', 'stats'), 'year', 'ongeldige eigen waarde valt terug op de oude');
assert.equal(rememberPeriod(box, 'ada', 'stats', 'eeuw'), false);

rememberPeriod(box, 'ada', 'bodyComp', '1y');
assert.equal(rememberedPeriod(box, 'ada', 'bodyComp'), '1y');
assert.equal(rememberedPeriod(box, 'ada', 'bodySeg'), 'ytd', 'segmenten blijven hun eigen periode');

const wiped = mem();
for (const [k, v] of [['gc-period:ada:bodyComp', '1y'], ['gc-period:ada:bodySeg', 'ytd'], ['gc-period:ada:stats', 'year'], ['gc-theme', 'dark'], ['gc-body-range', 'ytd']]) {
  if (keepOnLogout(k)) wiped.setItem(k, v);
}
assert.equal(wiped.getItem('gc-body-range'), null, 'oude gedeelde sleutel gaat bij uitloggen weg');
assert.equal(rememberedPeriod(wiped, 'bas', 'bodyComp'), 'all', 'na uitloggen krijgt een andere gebruiker de standaard');
rememberPeriod(wiped, 'bas', 'bodyComp', '3m');
assert.equal(rememberedPeriod(wiped, 'ada', 'bodyComp'), '1y');
assert.equal(rememberedPeriod(wiped, 'bas', 'bodyComp'), '3m');

assert.equal(keepOnLogout('gc-period:ada:bodyComp'), true);
assert.equal(keepOnLogout('gc-theme'), true);
assert.equal(keepOnLogout('gc-lang'), true);
assert.equal(keepOnLogout('gc-body-range'), false);
assert.equal(keepOnLogout('gc-stat-range'), false);

console.log('periodpref ok');
