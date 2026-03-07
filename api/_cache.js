const cache = {};

function getCached(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

function setCached(key, data, ttlSeconds) {
  cache[key] = {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
    cachedAt: Date.now()
  };
}

function getCacheStats() {
  const keys = Object.keys(cache);
  let active = 0;
  for (const k of keys) {
    if (Date.now() <= cache[k].expiresAt) active++;
    else delete cache[k];
  }
  return { totalKeys: active };
}

module.exports = { getCached, setCached, getCacheStats };
