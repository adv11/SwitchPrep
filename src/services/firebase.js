import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  reauthenticateWithCredential,
  connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase,
  ref,
  remove,
  serverTimestamp,
  connectDatabaseEmulator
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { firebaseConfig } from './firebase.config.js';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);

// In Playwright E2E tests the fixture injects this flag before any page scripts run.
if (typeof window !== 'undefined' && window.__USE_FIREBASE_EMULATOR__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(database, '127.0.0.1', 9000);
}
export const firebaseClock = serverTimestamp;

// Requested directly on the sign-in popup's own provider so a single popup
// covers both identity and Drive access — see signInWithGoogle() below. Must
// stay in sync with DRIVE_SCOPE in googleDriveAuth.js.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export const authApi = {
  onChange(callback) {
    return onAuthStateChanged(auth, callback);
  },
  signIn(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  signUp(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  },
  async linkGuest(email, password) {
    const user = auth.currentUser;
    if (!user?.isAnonymous) throw new Error('No guest session to link');
    const cred = EmailAuthProvider.credential(email, password);
    return linkWithCredential(user, cred);
  },
  guest() {
    return signInAnonymously(auth);
  },
  // Identity + Drive access in a single popup. This used to be two sequential
  // popups — a GIS popup for the Drive scope, then this one for Firebase
  // identity — but chaining two popups let the browser's user-gesture window
  // lapse between them, so the second popup was frequently auto-closed by
  // the browser (auth/popup-closed-by-user / auth/cancelled-popup-request)
  // on a real click. Found by manual testing with a real Google account, not
  // by the E2E suite: the Playwright tests stub GIS's token client as a
  // synchronous fake that never opens a real popup, so they never exercised
  // two real browser popups back to back.
  //
  // Adding the scope directly to this provider means the OAuth credential
  // Firebase hands back already carries Drive access —
  // GoogleAuthProvider.credentialFromResult(result).accessToken — so the
  // caller (signIn.js) can hand that straight to
  // googleDriveAuth.js's setInitialAccessToken() with no second popup.
  // GIS's own token client (googleDriveAuth.js) is still used afterwards for
  // silent background refresh, since this credential has no refresh
  // mechanism of its own — that still works because Firebase's
  // auto-created OAuth client for "Sign in with Google" and `googleClientId`
  // (configured for GIS) are the same OAuth client, so consent granted here
  // is visible to GIS's silent `prompt: ''` refresh later.
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { user: result.user, driveAccessToken: credential?.accessToken || null };
  },
  signOut() {
    return signOut(auth);
  },
  sendResetEmail(email) {
    return sendPasswordResetEmail(auth, email);
  },
  sendVerificationEmail() {
    return sendEmailVerification(auth.currentUser);
  },
  setPersistence(rememberMe) {
    return setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  },
  async deleteAccount(password) {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    // Delete DB data before Auth record to avoid orphaned data
    await remove(ref(database, `users/${user.uid}`));
    await deleteUser(user);
  }
};

export function authErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'That email already has an account. Use sign in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/invalid-login-credentials': 'Email or password is incorrect.',
    'auth/missing-password': 'Enter your password.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'auth/user-not-found': 'No account found for that email.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/requires-recent-login': 'For security, please sign out and sign in again before deleting your account.',
    'auth/popup-closed-by-user': 'Sign-in was closed before finishing. Try again.',
    'auth/cancelled-popup-request': 'Sign-in was closed before finishing. Try again.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
  };
  return messages[error?.code] || error?.message || 'Something went wrong. Please try again.';
}
