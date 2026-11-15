import test from 'node:test';
import assert from 'node:assert/strict';
import { healthBlocks, scoreBlock } from './healthmd.js';

const sample = `## Gezondheidsscore
Totaalscore **6,2**, vlak over 4 weken.

## Samenvatting (afgelopen 4 weken)
Lichaamssamenstelling blijft stabiel.

## Trendtabel
| Meting | Start | Nu | Δ | Trend | Beoordeling |
| --- | --- | --- | --- | --- | --- |
| Gewicht (kg) | 89,65 | 89,75 | 0,0 | → | binnen ruis |
| Rusthartslag Watch (bpm) | 62 | 69,5 | +7,5 | ↑ | let op |
| VO2max | 30,1 | 30,1 | 0 | → | goed |

## Pluspunten
- FFMI 21,1 is stabiel
- Trainingsvolume steeg

## Advies 2 weken
1. Houd conditie erbij
`;

test('health status keeps headings, the table and the lists apart', () => {
  const blocks = healthBlocks(sample);
  assert.deepEqual(blocks.map((b) => b.type), ['h', 'p', 'h', 'p', 'h', 'table', 'h', 'ul', 'h', 'ol']);
  const table = blocks.find((b) => b.type === 'table');
  assert.deepEqual(table.kinds, ['', '', '', 'delta', 'trend', 'judge']);
  assert.equal(table.rows[0].tone, 'flat');
  assert.equal(table.rows[1].tone, 'watch');
  assert.equal(table.rows[1].cells[4], '↑');
  assert.equal(table.rows[2].tone, 'good');
  assert.equal(blocks.find((b) => b.type === 'h' && b.text.startsWith('Trend')).icon, 'tablecells');
  assert.deepEqual(blocks.find((b) => b.type === 'ul').items, ['FFMI 21,1 is stabiel', 'Trainingsvolume steeg']);
});

test('score block keeps the four categories and skips an empty score', () => {
  const view = scoreBlock({
    status: 'ok',
    delta4w: 0,
    trend: 'flat',
    since: '2026-11-04',
    record: { total: 6.2, categories: { body: 7.1, heart: 5.4, fitness: 4.9, other: 6 } },
  }, (key) => key);
  assert.equal(view.total, 6.2);
  assert.deepEqual(view.categories.map((c) => c.id), ['body', 'heart', 'fitness', 'other']);
  assert.equal(scoreBlock({ status: 'empty', record: null }, (key) => key), null);
});
