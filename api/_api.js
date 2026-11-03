// One wrapper for every serverless function (see test/api-wrapper.test.js). It does, in order:
//   CORS for our own origins only -> preflight -> GET/HEAD only -> per-client rate limit -> query validation ->
//   the handler -> safe error messages -> CDN cache headers.
// Handlers stay small: they read a query that is already validated and just call res.json().
const { normalizeQuery } = require('./_validate');

const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';
const GENERIC_ERROR = 'Data is temporarily unavailable';

const STATIC_ORIGINS = new Set([
  'https://meridian.reachpointcapital.com',
  'https://reachpointcapital.com',
  'https://www.reachpointcapital.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
const PREVIEW_ORIGIN = /^https:\/\/meridian(-[a-z0-9-]+)?-reachpointlabs-projects\.vercel\.app$/;
const isAllowedOrigin = (origin) => STATIC_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin);

// Credentials in URLs must never reach the logs (the FMP key used to be logged this way).
const SECRET_PARAM = /([?&](?:apikey|api_key|token|key|access_token)=)[^&#\s]*/gi;
const redactUrl = (url) => String(url).replace(SECRET_PARAM, '$1REDACTED');

// 5xx messages come from upstream libraries and can expose internals: callers see a fixed message.
// 4xx messages are written by our own code and pass through.
function publicError(status, message) {
  return status >= 500 ? GENERIC_ERROR : String(message || 'Request failed');
}

function clientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  if (req.headers && req.headers['x-real-ip']) return String(req.headers['x-real-ip']);
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Fixed-window limiter. Per instance, so it blunts bursts rather than guaranteeing a global limit
// (add a Vercel Firewall rate-limit rule for that; see docs/backend.md).
function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const windows = new Map();
  return (ip) => {
    const t = now();
    let w = windows.get(ip);
    if (!w || t >= w.resetAt) {
      w = { count: 0, resetAt: t + windowMs };
      windows.set(ip, w);
      if (windows.size > 2000) for (const [k, v] of windows) if (t >= v.resetAt) windows.delete(k);
    }
    w.count += 1;
    if (w.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((w.resetAt - t) / 1000)) };
    return { ok: true };
  };
}

function applyCors(req, res) {
  const origin = req.headers && req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin && isAllowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
}

function setQuery(req, query) {
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true, enumerable: true });
}

function withApi(handler, opts = {}) {
  const name = opts.name || handler.name || 'api';
  const limiter = createRateLimiter(opts.rateLimit || { limit: 120, windowMs: 60000 });

  return async function api(req, res) {
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.statusCode = 204;
      res.end();
      return;
    }

    // Wrap res.json once: sanitise error bodies, then set cache headers from the final status.
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      let status = res.statusCode || 200;
      if (status >= 400 && body && typeof body === 'object' && 'error' in body) {
        const original = String(body.error);
        if (status >= 500) {
          console.error(`[${name}] ${status}: ${redactUrl(original)}`);
          if (/not found/i.test(original)) {
            status = 404;
            res.statusCode = 404;
            body = { ...body, error: 'Symbol not found' };
          } else {
            body = { ...body, error: publicError(status, original) };
          }
        }
      }
      if (!res.getHeader('Cache-Control')) {
        if (status >= 400) {
          res.setHeader('Cache-Control', 'no-store');
        } else if (opts.cache) {
          const policy = opts.cache(req.query || {}, req);
          if (policy) res.setHeader('Cache-Control', `public, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.swr}`);
        }
      }
      return sendJson(body);
    };

    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', ALLOWED_METHODS);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const verdict = limiter(clientIp(req));
    if (!verdict.ok) {
      res.setHeader('Retry-After', String(verdict.retryAfter));
      return res.status(429).json({ error: 'Too many requests' });
    }

    const checked = normalizeQuery(req.query || {});
    if (!checked.ok) return res.status(checked.status).json({ error: checked.error });
    setQuery(req, checked.query);

    try {
      return await handler(req, res);
    } catch (err) {
      if (!res.headersSent) return res.status(500).json({ error: err && err.message });
      console.error(`[${name}] after response started: ${redactUrl((err && err.message) || err)}`);
      return undefined;
    }
  };
}

module.exports = { withApi, redactUrl, publicError, createRateLimiter, clientIp, isAllowedOrigin };
