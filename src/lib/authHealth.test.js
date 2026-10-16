import { isAuthReachable, resetAuthHealthCache } from './authHealth';

const URL = 'https://example-project.supabase.co';

beforeEach(() => resetAuthHealthCache());

test('reachable when the health request completes', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ type: 'opaque' });
  await expect(isAuthReachable({ url: URL, fetchImpl })).resolves.toBe(true);
  expect(fetchImpl).toHaveBeenCalledWith(`${URL}/auth/v1/health`, expect.objectContaining({ mode: 'no-cors' }));
});

test('unreachable when the host cannot be resolved', async () => {
  const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(isAuthReachable({ url: URL, fetchImpl })).resolves.toBe(false);
});

test('unreachable when the request hangs past the timeout', async () => {
  const fetchImpl = jest.fn((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
  await expect(isAuthReachable({ url: URL, fetchImpl, timeoutMs: 20 })).resolves.toBe(false);
});

test('unreachable when auth is not configured at all', async () => {
  const fetchImpl = jest.fn();
  await expect(isAuthReachable({ url: '', fetchImpl })).resolves.toBe(false);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('the answer is cached briefly so opening the modal repeatedly does not spam the host', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ type: 'opaque' });
  await isAuthReachable({ url: URL, fetchImpl });
  await isAuthReachable({ url: URL, fetchImpl });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('a failure is not cached for long, so recovery is noticed', async () => {
  const fetchImpl = jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ type: 'opaque' });
  await expect(isAuthReachable({ url: URL, fetchImpl, now: () => 0 })).resolves.toBe(false);
  await expect(isAuthReachable({ url: URL, fetchImpl, now: () => 6000 })).resolves.toBe(true);
});
