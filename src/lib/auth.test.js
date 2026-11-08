import {
  UNAVAILABLE_MESSAGE,
  friendlyAuthError,
  hasSkippedNamePrompt,
  interpretSignUp,
  isNetworkError,
  looksLikeRecoveryLink,
  markNamePromptSkipped,
} from './auth';

describe('isNetworkError', () => {
  test.each([
    ['fetch TypeError', new TypeError('Failed to fetch')],
    ['Supabase retryable fetch error', Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 })],
    ['Firefox wording', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari wording', new TypeError('Load failed')],
    ['status 0', { message: 'x', status: 0 }],
  ])('%s', (_label, err) => {
    expect(isNetworkError(err)).toBe(true);
  });

  test('an ordinary auth error is not a network error', () => {
    expect(isNetworkError(new Error('Invalid login credentials'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('friendlyAuthError', () => {
  test('service unreachable', () => {
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toBe(UNAVAILABLE_MESSAGE);
  });

  test.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'Incorrect email or password'],
    [{ message: 'Invalid login credentials' }, 'Incorrect email or password'],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'Please confirm your email first. Check your inbox for the link.'],
    [{ message: 'Email not confirmed' }, 'Please confirm your email first. Check your inbox for the link.'],
    [{ code: 'user_already_exists', message: 'User already registered' }, 'An account with this email already exists. Try signing in.'],
    [{ message: 'User already registered' }, 'An account with this email already exists. Try signing in.'],
    [{ code: 'weak_password', message: 'Password should be at least 6 characters' }, 'Password must be at least 8 characters'],
    [{ message: 'Password should be at least 6 characters.' }, 'Password must be at least 8 characters'],
    [{ code: 'validation_failed', message: 'Unable to validate email address: invalid format' }, 'Please enter a valid email address'],
    [{ message: 'Unable to validate email address: invalid format' }, 'Please enter a valid email address'],
    [{ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'Too many attempts. Please wait a minute and try again.'],
    [{ message: 'For security purposes, you can only request this after 45 seconds.' }, 'Too many attempts. Please wait a minute and try again.'],
    [{ code: 'signup_disabled', message: 'Signups not allowed for this instance' }, 'New sign-ups are closed right now.'],
  ])('%j', (err, expected) => {
    expect(friendlyAuthError(err)).toBe(expected);
  });

  test('unknown or empty errors get a generic message, never a raw server string', () => {
    expect(friendlyAuthError({ message: 'AuthApiError: internal xyz 0x1f' })).toBe('Something went wrong. Please try again.');
    expect(friendlyAuthError(null)).toBe('Something went wrong. Please try again.');
    expect(friendlyAuthError(undefined)).toBe('Something went wrong. Please try again.');
  });

  test('accepts a plain string', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password');
  });
});

describe('interpretSignUp', () => {
  test('a returned session means the account is already signed in (email confirmation is off)', () => {
    expect(interpretSignUp({ user: { identities: [{}] }, session: { access_token: 'x' } })).toBe('signed-in');
  });

  test('Supabase answers a sign-up for an existing email with an empty identities list', () => {
    expect(interpretSignUp({ user: { identities: [] }, session: null })).toBe('exists');
  });

  test('otherwise the user must confirm by email', () => {
    expect(interpretSignUp({ user: { identities: [{ provider: 'email' }] }, session: null })).toBe('confirm');
    expect(interpretSignUp({ user: null, session: null })).toBe('confirm');
    expect(interpretSignUp(null)).toBe('confirm');
  });
});

describe('looksLikeRecoveryLink', () => {
  test.each([
    'https://meridian.reachpointcapital.com/reset-password#access_token=abc&refresh_token=def&type=recovery',
    'https://meridian.reachpointcapital.com/reset-password?code=1a2b3c',
    'https://meridian.reachpointcapital.com/reset-password?token_hash=abc&type=recovery',
    '/reset-password#type=recovery&access_token=abc',
  ])('recognises %s', (url) => {
    expect(looksLikeRecoveryLink(url)).toBe(true);
  });

  test.each([
    'https://meridian.reachpointcapital.com/reset-password',
    'https://meridian.reachpointcapital.com/reset-password#',
    'https://meridian.reachpointcapital.com/dashboard?tab=1',
    '',
    undefined,
  ])('rejects %s', (url) => {
    expect(looksLikeRecoveryLink(url)).toBe(false);
  });
});

describe('name prompt skip', () => {
  beforeEach(() => localStorage.clear());

  test('is per user and remembered', () => {
    expect(hasSkippedNamePrompt('u1')).toBe(false);
    markNamePromptSkipped('u1');
    expect(hasSkippedNamePrompt('u1')).toBe(true);
    expect(hasSkippedNamePrompt('u2')).toBe(false);
  });

  test('ignores a missing user id and survives blocked storage', () => {
    expect(hasSkippedNamePrompt(undefined)).toBe(false);
    expect(() => markNamePromptSkipped(undefined)).not.toThrow();
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(hasSkippedNamePrompt('u1')).toBe(false);
    spy.mockRestore();
  });
});
