// Pure helpers for the sign-in flow (see src/lib/auth.test.js). They keep AuthModal, ResetPassword and Navbar free of
// string-matching on Supabase error messages.

export const UNAVAILABLE_MESSAGE = 'Sign-in is temporarily unavailable. Please try again in a few minutes.';

const GENERIC = 'Something went wrong. Please try again.';
const RATE_LIMITED = 'Too many attempts. Please wait a minute and try again.';
const BAD_EMAIL = 'Please enter a valid email address';
const WEAK_PASSWORD = 'Password must be at least 8 characters';
const NOT_CONFIRMED = 'Please confirm your email first. Check your inbox for the link.';
const EXISTS = 'An account with this email already exists. Try signing in.';

const NETWORK_WORDING = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i;

// True when the auth server could not be reached at all (DNS failure, offline, paused project).
export function isNetworkError(err) {
  if (!err) return false;
  if (err.name === 'AuthRetryableFetchError' || err.status === 0) return true;
  return NETWORK_WORDING.test(String(err.message || err));
}

// Supabase error codes are stable; messages are not, so codes win and messages are the fallback.
const BY_CODE = {
  invalid_credentials: 'Incorrect email or password',
  email_not_confirmed: NOT_CONFIRMED,
  user_already_exists: EXISTS,
  weak_password: WEAK_PASSWORD,
  validation_failed: BAD_EMAIL,
  email_address_invalid: BAD_EMAIL,
  over_email_send_rate_limit: RATE_LIMITED,
  over_request_rate_limit: RATE_LIMITED,
  signup_disabled: 'New sign-ups are closed right now.',
};

const BY_MESSAGE = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, NOT_CONFIRMED],
  [/already (been )?registered/i, EXISTS],
  [/at least \d+ characters/i, WEAK_PASSWORD],
  [/unable to validate email|invalid (format|email)/i, BAD_EMAIL],
  [/rate limit|only request this after|too many requests/i, RATE_LIMITED],
  [/signups? not allowed/i, BY_CODE.signup_disabled],
];

// Never shows a raw server string: unknown errors get a generic message.
export function friendlyAuthError(err) {
  if (!err) return GENERIC;
  if (isNetworkError(err)) return UNAVAILABLE_MESSAGE;
  if (err.code && BY_CODE[err.code]) return BY_CODE[err.code];
  const message = typeof err === 'string' ? err : err.message || '';
  const hit = BY_MESSAGE.find(([pattern]) => pattern.test(message));
  return hit ? hit[1] : GENERIC;
}

// What a successful signUp() call actually means:
//  'signed-in' email confirmation is off, the user already has a session
//  'exists'    Supabase hides existing accounts by returning a user with no identities (and sends no email)
//  'confirm'   a confirmation email is on its way
export function interpretSignUp(result) {
  if (result?.session) return 'signed-in';
  const identities = result?.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) return 'exists';
  return 'confirm';
}

// Did this page load come from a password-recovery email? Supabase clears the URL once it has processed it, so
// callers must capture the URL at startup (see INITIAL_URL in lib/supabase.js).
export function looksLikeRecoveryLink(url) {
  if (!url) return false;
  const text = String(url);
  const hashAt = text.indexOf('#');
  const queryAt = text.indexOf('?');
  const hash = hashAt >= 0 ? text.slice(hashAt + 1) : '';
  const query = queryAt >= 0 ? text.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : '';
  const fromHash = new URLSearchParams(hash);
  const fromQuery = new URLSearchParams(query);
  return fromHash.get('type') === 'recovery'
    || fromQuery.get('type') === 'recovery'
    || fromQuery.has('code')
    || fromQuery.has('token_hash');
}

// "What should we call you?" is asked once: skipping it is remembered per user.
const skipKey = (userId) => `meridian_name_prompt_skipped:${userId}`;

export function hasSkippedNamePrompt(userId) {
  if (!userId) return false;
  try { return localStorage.getItem(skipKey(userId)) === '1'; } catch { return false; }
}

export function markNamePromptSkipped(userId) {
  if (!userId) return;
  try { localStorage.setItem(skipKey(userId), '1'); } catch { /* storage blocked: the prompt may show again */ }
}
