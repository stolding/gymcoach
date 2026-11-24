import test from 'node:test';
import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import { imageSources, mediaFile } from '../lib/exinfo.js';

const local = (u) => '/api/media?u=' + encodeURIComponent(u);

test('image sources are the catalog photos, not the video', () => {
  const src = imageSources({
    img: local('https://img.speediance.com/a/main.jpg'),
    poster: local('https://img.speediance.com/a/poster.jpg'),
    video: local('https://img.speediance.com/a/clip.mp4'),
    images: [local('https://img.speediance.com/a/still.png'), local('https://example.com/nope.png'), local('https://img.speediance.com/a/main.jpg')],
    keyPoints: [{ img: local('https://img.speediance.com/a/kp.webp') }],
  });
  assert.deepEqual(src, [
    'https://img.speediance.com/a/main.jpg',
    'https://img.speediance.com/a/poster.jpg',
    'https://img.speediance.com/a/still.png',
    'https://img.speediance.com/a/kp.webp',
  ]);
});

test('a cached exercise image is not fetched from the origin again', async () => {
  const url = `https://img.speediance.com/gymcoach-test/${Date.now()}-once.png`;
  let calls = 0;
  const prev = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(Buffer.from('png'), { status: 200 });
  };
  let file = '';
  try {
    const first = await mediaFile(url);
    file = first.file;
    const second = await mediaFile(url);
    assert.equal(calls, 1);
    assert.equal(second.file, first.file);
    assert.equal(first.type, 'image/png');
  } finally {
    globalThis.fetch = prev;
    if (file) await unlink(file).catch(() => {});
  }
});

test('two viewers share one download of the same image', async () => {
  const url = `https://img.speediance.com/gymcoach-test/${Date.now()}-share.png`;
  let calls = 0;
  const prev = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return new Response(Buffer.from('png'), { status: 200 });
  };
  let file = '';
  try {
    const [a, b] = await Promise.all([mediaFile(url), mediaFile(url)]);
    file = a.file;
    assert.equal(calls, 1);
    assert.equal(a.file, b.file);
  } finally {
    globalThis.fetch = prev;
    if (file) await unlink(file).catch(() => {});
  }
});
