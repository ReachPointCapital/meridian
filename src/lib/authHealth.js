// Is the Supabase auth server reachable right now? When the project is paused or deleted its hostname stops
// resolving and every sign-in fails with a bare "Failed to fetch". Asking first lets the UI say so plainly.
// no-cors means any answer from the host counts as reachable; only a network failure or a timeout does not.

const OK_TTL_MS = 30000;
const FAIL_TTL_MS = 5000;

let cached = null; // { at, ok }

export function resetAuthHealthCache() {
  cached = null;
}

export async function isAuthReachable({
  url = process.env.REACT_APP_SUPABASE_URL,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 4000,
  now = Date.now,
} = {}) {
  if (!url) return false;

  const at = now();
  if (cached && at - cached.at < (cached.ok ? OK_TTL_MS : FAIL_TTL_MS)) return cached.ok;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let ok = false;
  try {
    await fetchImpl(`${url}/auth/v1/health`, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    ok = true;
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }
  cached = { at, ok };
  return ok;
}
