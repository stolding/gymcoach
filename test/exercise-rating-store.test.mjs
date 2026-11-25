import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(tmpdir(), 'gc-rate-'));
process.env.GYMCOACH_DATA = dir;
const store = await import('../lib/store.js');

test.after(async () => { await rm(dir, { recursive: true, force: true }); });

test('a rating is stored with that performed exercise', async () => {
  const user = { id: 'rateuser', username: 'rate' };
  await store.runAs(user, async () => {
    await store.setRating('t1', '42', 5);
    await store.setRating('t1', 'name:Row', 1);
    let all = await store.getRatings();
    assert.deepEqual(all.t1, { 42: 5, 'name:Row': 1 });
    await store.setRating('t1', '42', 3);
    all = await store.getRatings();
    assert.equal(all.t1['42'], 3);
    assert.equal(all.t1['name:Row'], 1);
    await store.setRating('t2', '42', 4);
    all = await store.getRatings();
    assert.equal(all.t2['42'], 4);
    assert.equal(all.t1['42'], 3);
  });
});
