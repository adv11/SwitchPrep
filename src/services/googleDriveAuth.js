import { googleClientId } from './firebase.config.js';
import { googleDriveAdapter } from './storage/GoogleDriveAdapter.js';
import { isGoogleUser } from './storage/adapterFactory.js';
import { showToast } from '../ui/components/toast.js';

// Google Identity Services (GIS) token client wiring for GoogleDriveAdapter
// (issue #5 part 3). This is deliberately a separate grant from
// authApi.signInWithGoogle()'s Firebase identity popup (see firebase.js) —
// GIS's token client is what makes silent, no-popup refresh possible, which
// Firebase's own popup credential does not support.
//
// The access token lives in a module-scoped variable ONLY — never
// localStorage/sessionStorage (issue #5's non-negotiable token security
// rules; see CLAUDE.md).

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
// Silent-refresh this many seconds before the token's reported expiry.
const REFRESH_MARGIN_SECONDS = 300;
const MIN_REFRESH_DELAY_SECONDS = 30;

let gisLoadPromise = null;
let tokenClient = null;
// Resolver pair for whichever requestAccessToken() call is currently in
// flight. This module only ever has one request outstanding at a time (an
// explicit sign-in click, a scheduled silent refresh, or a 401-triggered
// retry never overlap in this app's flow).
let pendingRequest = null;
let accessToken = null;
let refreshTimer = null;
// Guards against showing the same "reconnect" toast repeatedly while
// multiple in-flight Drive requests all hit 401 in quick succession — reset
// the moment a token is successfully obtained again.
let reconnectNoticeShown = false;

function loadGisScript() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function handleTokenResponse(response) {
  const request = pendingRequest;
  pendingRequest = null;
  if (response.error) {
    request?.reject(new Error(response.error_description || response.error));
    return;
  }
  accessToken = response.access_token;
  reconnectNoticeShown = false;
  scheduleRefresh(Number(response.expires_in) || 3600);
  request?.resolve(accessToken);
}

function ensureTokenClient() {
  return loadGisScript().then(() => {
    if (tokenClient) return tokenClient;
    if (!googleClientId || googleClientId === 'YOUR_GOOGLE_OAUTH_CLIENT_ID') {
      throw new Error('googleClientId is not configured — see CLAUDE.md for setup steps');
    }
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: DRIVE_SCOPE,
      callback: handleTokenResponse
    });
    return tokenClient;
  });
}

function requestToken(options) {
  return ensureTokenClient()
    .then(client => new Promise((resolve, reject) => {
      pendingRequest = { resolve, reject };
      client.requestAccessToken(options);
    }))
    .catch(error => {
      pendingRequest = null;
      throw error;
    });
}

function scheduleRefresh(expiresInSeconds) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delaySeconds = Math.max(expiresInSeconds - REFRESH_MARGIN_SECONDS, MIN_REFRESH_DELAY_SECONDS);
  refreshTimer = setTimeout(silentRefresh, delaySeconds * 1000);
}

async function silentRefresh() {
  try {
    await requestToken({ prompt: '' });
  } catch {
    if (!reconnectNoticeShown) {
      reconnectNoticeShown = true;
      showToast('Google Drive sync needs you to sign in again.', 'error');
    }
  }
}

// Called BEFORE authApi.signInWithGoogle() (see signIn.js) — deliberately
// first, not after: main.js's authApi.onChange fires as soon as the Firebase
// identity popup resolves and immediately calls store.setUser(user), which
// (for a Google user) calls googleDriveAdapter.getMeta() — that needs a
// usable access token already in memory, or it rejects. Getting this grant
// first avoids that race entirely. Shows GIS's own popup/consent for the
// Drive scope — a separate popup from the Firebase identity one. Rejects if
// the user closes it or consent is denied; the caller (signIn.js) never
// calls signInWithGoogle() at all in that case, so there's nothing to roll
// back.
export function requestInitialToken() {
  return requestToken({});
}

// Synchronous by design — GoogleDriveAdapter.request() reads this
// un-awaited (`const token = this.getAccessToken();`), so it must always
// return a string (or throw) from memory, never a Promise.
export function getAccessToken() {
  if (!accessToken) {
    throw new Error('No Google Drive access token available — sign in with Google again');
  }
  return accessToken;
}

// Wired into googleDriveAdapter.configure() below as onTokenExpired. Attempts
// one immediate silent refresh (covers the proactive timer drifting or
// having missed); if that also fails, silentRefresh() itself surfaces the
// "reconnect" toast. Never opens a popup here — there is no user gesture
// behind this call (it fires from inside a failed fetch), and browsers block
// popups outside one anyway. Recovery is the user clicking "Sign in with
// Google" again.
export function handleTokenExpired() {
  return silentRefresh();
}

// Called from main.js right after store.setUser(user) on every auth state
// change (covers page reload restoring a persisted session). If the
// restored user is a Google user, silently try to reacquire a Drive token so
// the app can load from Drive without a visible re-login. No-op for every
// other user type — matches issue #5's "attempt GIS silent re-auth; if it
// fails, show button" spec.
export function reacquireIfGoogleUser(user) {
  if (!isGoogleUser(user)) return undefined;
  return silentRefresh();
}

// Wires the real token provider into the googleDriveAdapter singleton once,
// at module load (i.e. as soon as anything imports this module — main.js
// does, for reacquireIfGoogleUser, so this always runs at boot before any
// sign-in can resolve). Deliberately not a call main.js has to remember to
// make separately: importing this module is the wiring.
googleDriveAdapter.configure({ getAccessToken, onTokenExpired: handleTokenExpired });
