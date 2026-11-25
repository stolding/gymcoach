import test from 'node:test';
import assert from 'node:assert/strict';
import { pickerMuscleScores } from '../public/editor.js';

test('the add-exercise preview maps main and assisting muscles onto the figure', () => {
  assert.deepEqual(pickerMuscleScores(['Biceps'], ['Forearms']), { biceps: 1, forearms: 0.5 });
});

test('a muscle listed as both main and assisting stays the main muscle', () => {
  assert.deepEqual(pickerMuscleScores(['Biceps'], ['Biceps', 'Forearms']), { biceps: 1, forearms: 0.5 });
});

test('an unknown muscle name is left off the figure, and the catalogue muscle fills in when the list is empty', () => {
  assert.deepEqual(pickerMuscleScores([], ['Nek'], 'Triceps'), { triceps: 1 });
  assert.deepEqual(pickerMuscleScores(['Onbekend'], []), {});
});
