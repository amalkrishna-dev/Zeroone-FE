// Single source of truth for auth token persistence.
//
// Every read/write of the access & refresh tokens goes through here, so storage
// keys live in one place and all access is wrapped defensively - localStorage
// throws in private-mode Safari, when storage is disabled/full, or during SSR.
// Only these two tokens are persisted; nothing else belongs in web storage.
//
// Keys are namespaced with a `zeroone_` prefix so they never collide with
// another app served from the same origin (which used the generic
// `access_token` / `refresh_token` keys). We deliberately do NOT read or
// delete those generic keys — they may belong to that other app.

const ACCESS_TOKEN_KEY = 'zeroone_access_token';
const REFRESH_TOKEN_KEY = 'zeroone_refresh_token';

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / quota / SSR) - fail silently */
  }
}

function safeRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const getAccessToken = () => safeGet(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => safeGet(REFRESH_TOKEN_KEY);

export function setAccessToken(token) {
  if (token) safeSet(ACCESS_TOKEN_KEY, token);
}

// Persist the token pair returned by the auth endpoints.
export function setTokens(tokens) {
  if (!tokens) return;
  setAccessToken(tokens.access_token);
  if (tokens.refresh_token) safeSet(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens() {
  safeRemove(ACCESS_TOKEN_KEY);
  safeRemove(REFRESH_TOKEN_KEY);
}
