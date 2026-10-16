const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cache = require('../api/_cache');

beforeEach(() => cache.clearCache());

test('a value is returned until its ttl passes, then it is gone', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  cache.setCached('k', { a: 1 }, 60);
  assert.deepEqual(cache.getCached('k'), { a: 1 });
  t.mock.timers.tick(59_000);
  assert.deepEqual(cache.getCached('k'), { a: 1 });
  t.mock.timers.tick(2_000);
  assert.equal(cache.getCached('k'), null);
});

test('an unknown key is null', () => {
  assert.equal(cache.getCached('never-set'), null);
});

test('stats count only live entries', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  cache.setCached('short', 1, 10);
  cache.setCached('long', 2, 1000);
  t.mock.timers.tick(20_000);
  assert.equal(cache.getCacheStats().totalKeys, 1);
});

test('the cache is bounded: the oldest entries are evicted first', () => {
  const max = cache.MAX_ENTRIES;
  for (let i = 0; i < max + 5; i++) cache.setCached(`key${i}`, i, 3600);
  assert.equal(cache.getCacheStats().totalKeys, max);
  assert.equal(cache.getCached('key0'), null);
  assert.equal(cache.getCached('key4'), null);
  assert.equal(cache.getCached('key5'), 5);
  assert.equal(cache.getCached(`key${max + 4}`), max + 4);
});

test('overwriting a key does not evict others and refreshes its age', () => {
  const max = cache.MAX_ENTRIES;
  for (let i = 0; i < max; i++) cache.setCached(`key${i}`, i, 3600);
  cache.setCached('key0', 'fresh', 3600); // oldest key, now the newest
  cache.setCached('extra', 'x', 3600);    // forces one eviction: key1, not key0
  assert.equal(cache.getCached('key0'), 'fresh');
  assert.equal(cache.getCached('key1'), null);
  assert.equal(cache.getCacheStats().totalKeys, max);
});

test('clearCache empties it', () => {
  cache.setCached('a', 1, 60);
  cache.clearCache();
  assert.equal(cache.getCached('a'), null);
});
