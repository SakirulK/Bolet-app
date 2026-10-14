import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('scripts/sw-template.js', 'utf8');
function worker(entries, fetch) {
  const handlers = new Map();
  const cache = {
    match: async key => entries.get(typeof key === 'string' ? key : key.url)?.clone(),
    put: async () => {},
  };
  runInNewContext(source, {
    self: { location: { origin: 'https://brainbo.test' }, addEventListener: (name, handler) => handlers.set(name, handler) },
    caches: { open: async () => cache }, URL, Response, fetch,
  });
  return path => {
    let response;
    handlers.get('fetch')({
      request: { url: `https://brainbo.test${path}`, method: 'GET', mode: 'navigate' },
      respondWith: value => { response = value; },
    });
    return response;
  };
}

test('installed app shells open without waiting for any network request', async () => {
  let requests = 0;
  const navigate = worker(new Map([
    ['/', new Response('home')], ['/library', new Response('library')],
    ['/practice', new Response('practice')], ['/offline', new Response('dynamic shell')],
  ]), async () => { requests++; throw new Error('Network stalled'); });
  for (const [path, expected] of [
    ['/', 'home'], ['/library?q=biology', 'library'], ['/practice?deck=abc&mode=learn', 'practice'],
    ['/library/abc', 'dynamic shell'], ['/study/abc?mode=test', 'dynamic shell'],
  ]) assert.equal(await (await navigate(path)).text(), expected);
  assert.equal(requests, 0);
});

test('uncached and account routes still use the network', async () => {
  const requests = [];
  const navigate = worker(new Map([['/offline', new Response('offline')]]), async request => {
    requests.push(request.url); return new Response('fresh');
  });
  assert.equal(await (await navigate('/')).text(), 'fresh');
  assert.equal(await (await navigate('/reset-password?code=abc')).text(), 'fresh');
  assert.equal(requests.length, 2);
});
