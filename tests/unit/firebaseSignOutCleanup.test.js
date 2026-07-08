import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase.js talks to the real Firebase SDK over CDN URLs — mock those exact
// specifiers (plus the gitignored config) so the module under test can load
// in CI without a real Firebase project. This exercises the actual
// issue #24 anonymous-cleanup logic in src/services/firebase.js, unlike
// every other test in this repo which mocks firebase.js itself away.
const removeMock = vi.fn(() => Promise.resolve());
const deleteUserMock = vi.fn(() => Promise.resolve());
const signOutMock = vi.fn(() => Promise.resolve());

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js', () => ({
  initializeApp: vi.fn(() => ({}))
}));

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js', () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: signOutMock,
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  browserSessionPersistence: {},
  deleteUser: deleteUserMock,
  EmailAuthProvider: { credential: vi.fn() },
  linkWithCredential: vi.fn(),
  reauthenticateWithCredential: vi.fn(),
  connectAuthEmulator: vi.fn()
}));

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn((_db, path) => ({ path })),
  remove: removeMock,
  serverTimestamp: vi.fn(),
  connectDatabaseEmulator: vi.fn()
}));

vi.mock('../../src/services/firebase.config.js', () => ({
  firebaseConfig: {}
}));

describe('authApi.signOut — anonymous cleanup (issue #24)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the database node and the anonymous auth user instead of a plain sign-out', async () => {
    const { auth, authApi } = await import('../../src/services/firebase.js');
    auth.currentUser = { uid: 'guest-1', isAnonymous: true };

    await authApi.signOut();

    expect(removeMock).toHaveBeenCalledWith({ path: 'users/guest-1' });
    expect(deleteUserMock).toHaveBeenCalledWith(auth.currentUser);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('falls back to a plain sign-out for a non-anonymous user', async () => {
    const { auth, authApi } = await import('../../src/services/firebase.js');
    auth.currentUser = { uid: 'real-1', isAnonymous: false };

    await authApi.signOut();

    expect(removeMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
  });

  it('falls back to a plain sign-out if anonymous cleanup throws', async () => {
    const { auth, authApi } = await import('../../src/services/firebase.js');
    auth.currentUser = { uid: 'guest-2', isAnonymous: true };
    removeMock.mockRejectedValueOnce(new Error('offline'));

    await authApi.signOut();

    expect(signOutMock).toHaveBeenCalled();
  });
});
