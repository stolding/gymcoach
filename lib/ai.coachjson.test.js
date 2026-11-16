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

test('prose without JSON stays as advice', () => {
  const j = readCoachReply({ text: 'Keep the weight the same this week and drop a set when the last reps slow down clearly.' });
  assert.match(j.advice, /weight/);
  assert.deepEqual(j.adjustments, []);
});

test('the advice object is read when other braces surround it', () => {
  const j = extractJson('Note {not json} then {"advice":"ok","adjustments":[]} done.');
  assert.equal(j.advice, 'ok');
});

test('schema pipe-null becomes plain JSON', () => {
  const j = extractJson('{"advice":"ok","adjustments":[{"session":"A","exerciseId":123,"swapToId":456|null,"sets":3|null,"reps":10|null}]}');
  assert.equal(j.adjustments[0].swapToId, 456);
  assert.equal(j.adjustments[0].sets, 3);
  assert.equal(j.adjustments[0].reps, 10);
});
