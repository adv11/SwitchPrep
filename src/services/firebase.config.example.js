// Copy this file to `firebase.config.js` (same folder) and fill in your own
// Firebase project's values — Project settings → General → Your apps → SDK
// setup and configuration, in the Firebase console.
//
// `firebase.config.js` is gitignored on purpose: every deployment (yours,
// a customer's, a contributor's) points at its own Firebase project rather
// than sharing one. See CLAUDE.md for the full setup checklist.

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
  measurementId: 'YOUR_MEASUREMENT_ID'
};

// OAuth Web Client ID for Google Sign-In + Drive sync (issue #5 part 3).
// Enable the Google sign-in provider in Firebase Console -> Authentication ->
// Sign-in method first (this auto-creates the OAuth client in the linked
// Google Cloud project); then copy its Client ID from Google Cloud Console ->
// APIs & Services -> Credentials. See CLAUDE.md for the full checklist
// (enabling the Drive API, OAuth consent screen scopes, authorized origins).
export const googleClientId = 'YOUR_GOOGLE_OAUTH_CLIENT_ID';
