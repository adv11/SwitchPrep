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
