import test from 'node:test';
import assert from 'node:assert/strict';
import { finishStatus, statusCutOff } from '../lib/ai.js';

test('a cut-off health sentence stops at the previous full stop', () => {
  const raw = 'Vetmassa stond op 19,0 en vetvrij op 70,3. Water schommelt en beoordeel vet over meerdere we';
  assert.equal(statusCutOff(raw), true);
  assert.equal(finishStatus(raw), 'Vetmassa stond op 19,0 en vetvrij op 70,3.');
});

test('a finished bullet without a full stop stays whole', () => {
  const raw = '## Advies\n- Houd conditie erbij';
  assert.equal(finishStatus(raw), raw);
});

test('a decimal point is not a sentence end', () => {
  const raw = 'VO2max is 30.05 en de trend is vlak. Daarna stopt de zin bij we';
  assert.equal(finishStatus(raw), 'VO2max is 30.05 en de trend is vlak.');
});
