import assert from 'node:assert/strict';
import test from 'node:test';
import { extractJson, readCoachReply } from './ai.js';

test('valid coach JSON stays intact', () => {
  const j = extractJson('{"advice":"ok","adjustments":[{"session":"A","exerciseId":1,"sets":3}]}');
  assert.equal(j.advice, 'ok');
  assert.equal(j.adjustments[0].sets, 3);
});

test('missing comma between proposals is repaired', () => {
  const j = extractJson('{"advice":"ok","adjustments":[{"session":"A","exerciseId":1} {"session":"B","exerciseId":2}]}');
  assert.equal(j.adjustments.length, 2);
  assert.equal(j.adjustments[1].session, 'B');
});

test('tool form is used before free text', () => {
  const j = readCoachReply({ text: 'no json here', tool: { advice: 'rustig', adjustments: { session: 'A', exerciseId: 1 } } });
  assert.equal(j.advice, 'rustig');
  assert.equal(j.adjustments[0].session, 'A');
});

test('JSON in the thinking block is used when the visible text has none', () => {
  const j = readCoachReply({ text: '', think: 'note {"advice":"ok","adjustments":[]}' });
  assert.equal(j.advice, 'ok');
});

test('schema pipe-null becomes plain JSON', () => {
  const j = extractJson('{"advice":"ok","adjustments":[{"session":"A","exerciseId":123,"swapToId":456|null,"sets":3|null,"reps":10|null}]}');
  assert.equal(j.adjustments[0].swapToId, 456);
  assert.equal(j.adjustments[0].sets, 3);
  assert.equal(j.adjustments[0].reps, 10);
});
