// Pure guard used by firebase.js's deleteAccount() (issue #53) — no Firebase
// imports, so it's unit-testable without a real firebase.config.js or network
// access, same reasoning as authCleanup.js's signOutWithCleanup(). Defense in
// depth: the dashboard already hides the Delete button for anonymous users,
// but an anonymous account has no email/password credential to reauthenticate
// with, so the API layer must also reject it directly rather than relying
// solely on the UI never calling it.
export function assertAccountDeletable(user) {
  if (user?.isAnonymous) {
    throw new Error('Guest sessions cannot be deleted this way. Sign out to end a guest session.');
  }
}
