// In-memory cache for one serverless instance (each function has its own, so it only absorbs bursts: the CDN
// headers set by api/_api.js do the real sharing). Bounded so unique keys from callers cannot grow it forever.
const MAX_ENTRIES = 500;
const store = new Map(); // insertion order = age, oldest first

function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttlSeconds) {
  store.delete(key); // re-insert so an overwritten key counts as the newest
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}

function getCacheStats() {
  const now = Date.now();
  for (const [key, entry] of store) if (now > entry.expiresAt) store.delete(key);
  return { totalKeys: store.size };
}

function clearCache() {
  store.clear();
}

module.exports = { getCached, setCached, getCacheStats, clearCache, MAX_ENTRIES };
