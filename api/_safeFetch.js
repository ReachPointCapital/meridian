// Fetching a URL a visitor supplied, without letting them aim our server at private networks (SSRF).
// Used by the news reader (api/content.js ?type=article). See test/safeFetch.test.js.
//
// What it enforces: http(s) only on the standard ports, no credentials in the URL, no local/internal hostnames,
// every resolved address must be public (IPv4, IPv6 and IPv4-mapped IPv6), redirects are followed by hand and
// re-checked at every hop, the body is size-capped, and the whole request has a deadline.
// Remaining gap: a hostname can change its DNS answer between our check and the connection (DNS rebinding);
// that needs an outbound proxy or a pinned-IP dispatcher to close completely.
const dns = require('node:dns').promises;
const net = require('node:net');

class UrlNotAllowedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlNotAllowedError';
    this.code = 'URL_NOT_ALLOWED';
  }
}

function ipv4IsPrivate(ip) {
  const [a, b, c] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local, including cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF assignments, TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  return a >= 224; // multicast, reserved, broadcast
}

function ipv6IsPrivate(ip) {
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true;
  const mapped = s.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (mapped) {
    if (mapped[1]) return ipv4IsPrivate(mapped[1]);
    const hi = parseInt(mapped[2], 16);
    const lo = parseInt(mapped[3], 16);
    return ipv4IsPrivate(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (s.startsWith('::')) return true; // other IPv4-compatible / unspecified forms: not worth trusting
  const first = parseInt(s.split(':')[0], 16);
  if ((first & 0xfe00) === 0xfc00) return true; // unique local
  if ((first & 0xffc0) === 0xfe80) return true; // link-local
  return (first & 0xff00) === 0xff00; // multicast
}

// True for anything that is not a plain public unicast address, and for anything that is not an IP at all.
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return ipv4IsPrivate(ip);
  if (net.isIPv6(ip)) return ipv6IsPrivate(ip);
  return true;
}

const defaultResolve = async (host) => (await dns.lookup(host, { all: true })).map((a) => a.address);
const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp'];

// Resolves to a URL object, or throws UrlNotAllowedError.
async function assertPublicUrl(input, { resolve = defaultResolve } = {}) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new UrlNotAllowedError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UrlNotAllowedError('URL scheme not allowed');
  if (url.username || url.password) throw new UrlNotAllowedError('URL credentials not allowed');
  if (url.port && url.port !== '80' && url.port !== '443') throw new UrlNotAllowedError('URL port not allowed');

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UrlNotAllowedError('URL host not allowed');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UrlNotAllowedError('URL host not allowed');
    return url;
  }
  let addresses;
  try {
    addresses = await resolve(host);
  } catch {
    throw new UrlNotAllowedError('URL host not allowed');
  }
  if (!addresses || addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new UrlNotAllowedError('URL host not allowed');
  }
  return url;
}

async function readLimited(res, maxBytes) {
  if (!res.body) {
    const text = await res.text();
    return { text: text.slice(0, maxBytes), truncated: text.length > maxBytes };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= maxBytes) {
      truncated = size > maxBytes || !(await reader.read()).done;
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, maxBytes);
  return { text: new TextDecoder('utf-8').decode(bytes), truncated };
}

// Fetches a text page from a public host. Returns { url, status, contentType, text, truncated } or throws.
async function fetchPublic(url, {
  fetchImpl = (...args) => fetch(...args),
  resolve,
  maxBytes = 1_500_000,
  timeoutMs = 5000,
  maxRedirects = 3,
  headers = {},
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const checked = await assertPublicUrl(current, { resolve });
      const res = await fetchImpl(checked.href, { redirect: 'manual', signal: controller.signal, headers });
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, checked).href;
        if (res.body && res.body.cancel) await res.body.cancel().catch(() => {});
        continue;
      }
      if (!res.ok) throw new Error(`Upstream responded ${res.status}`);
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (!/^(text\/|application\/xhtml)/.test(contentType)) throw new Error('Unsupported content type');
      const { text, truncated } = await readLimited(res, maxBytes);
      return { url: checked.href, status: res.status, contentType, text, truncated };
    }
    throw new Error('Too many redirects');
  } catch (err) {
    if (controller.signal.aborted) throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { isPrivateAddress, assertPublicUrl, fetchPublic, UrlNotAllowedError };
