import { describe, it, expect, vi, beforeEach } from 'vitest';

// Split into its own file so this file's static googleClientId mock (the
// unconfigured placeholder) never leaks into googleDriveAuth.test.js's tests,
// which need a real-looking client id.
vi.mock('../../../src/services/firebase.config.js', () => ({
  googleClientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID'
}));
vi.mock('../../../src/services/storage/adapterFactory.js', () => ({
  isGoogleUser: () => false
}));
vi.mock('../../../src/ui/components/toast.js', () => ({ showToast: vi.fn() }));

beforeEach(() => {
  window.google = { accounts: { oauth2: { initTokenClient: vi.fn(() => ({ requestAccessToken: vi.fn() })) } } };
});

describe('googleDriveAuth — unconfigured googleClientId', () => {
  it('rejects requestInitialToken() with a helpful message instead of a raw GIS error', async () => {
    const { requestInitialToken } = await import('../../../src/services/googleDriveAuth.js');
    await expect(requestInitialToken()).rejects.toThrow(/googleClientId is not configured/);
  });
});
