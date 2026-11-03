// Liveness check for uptime monitors. It touches no upstream and exposes nothing about configuration.
const { withApi } = require('./_api');

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok', time: new Date().toISOString(), version: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7) });
}

module.exports = withApi(handler, { name: 'health' });
