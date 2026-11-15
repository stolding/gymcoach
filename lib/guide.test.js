import test from 'node:test';
import assert from 'node:assert/strict';
import nl from '../public/explain.nl.js';
import en from '../public/explain.en.js';
import de from '../public/explain.de.js';
import no from '../public/explain.no.js';

const ids = (xs) => xs.map((x) => x.id).join(',');

test('guide languages share section ids and include setup plus the health score', () => {
  assert.equal(ids(en), ids(nl));
  assert.equal(ids(de), ids(nl));
  assert.equal(ids(no), ids(nl));
  assert.equal(nl[0].id, 'starten');
  assert.match(nl.find((x) => x.id === 'meten').html, /Gezondheidsscore/);
  assert.match(en.find((x) => x.id === 'meten').html, /Health score/);
  for (const xs of [nl, en, de, no]) assert.ok(xs.find((x) => x.id === 'starten').html.includes('Apple Health'));
});
