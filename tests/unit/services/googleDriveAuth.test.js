import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/services/firebase.config.js', () => ({
  googleClientId: 'test-client-id.apps.googleusercontent.com'
}));
vi.mock('../../../src/services/storage/adapterFactory.js', () => ({
  isGoogleUser: user => !!user?.providerData?.some(p => p.providerId === 'google.com')
}));
vi.mock('../../../src/ui/components/toast.js', () => ({ showToast: vi.fn() }));

function installFakeGis() {
  const requestAccessToken = vi.fn();
  const initTokenClient = vi.fn(() => ({ requestAccessToken }));
  window.google = { accounts: { oauth2: { initTokenClient } } };
  return { initTokenClient, requestAccessToken };
}

function getCallback(initTokenClient) {
  return initTokenClient.mock.calls[0][0].callback;
}

async function loadModule() {
  return import('../../../src/services/googleDriveAuth.js');
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  delete window.google;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('googleDriveAuth — requestInitialToken', () => {
  it('resolves with the access token on a successful grant, then getAccessToken() returns it', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    requestAccessToken.mockImplementation(() => {
      getCallback(initTokenClient)({ access_token: 'tok-1', expires_in: 3600 });
    });

    await expect(mod.requestInitialToken()).resolves.toBe('tok-1');
    expect(mod.getAccessToken()).toBe('tok-1');
  });

  it('rejects when the token client reports an error (e.g. popup closed/consent denied)', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    requestAccessToken.mockImplementation(() => {
      getCallback(initTokenClient)({ error: 'access_denied', error_description: 'User denied consent' });
    });

    await expect(mod.requestInitialToken()).rejects.toThrow('User denied consent');
  });

  // The placeholder-clientId case lives in its own file
  // (googleDriveAuthPlaceholder.test.js) — vi.mock's factory for
  // firebase.config.js needs a different static value there, and vi.doMock
  // overrides leak across vi.resetModules() within the same file.
});

describe('googleDriveAuth — getAccessToken', () => {
  it('throws when no token has ever been obtained', async () => {
    installFakeGis();
    const mod = await loadModule();
    expect(() => mod.getAccessToken()).toThrow(/No Google Drive access token/);
  });
});

describe('googleDriveAuth — silent refresh scheduling', () => {
  it('schedules a silent requestAccessToken({prompt: \'\'}) 5 minutes before expiry', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    requestAccessToken.mockImplementationOnce(() => {
      getCallback(initTokenClient)({ access_token: 'tok-1', expires_in: 3600 });
    });
    await mod.requestInitialToken();

    requestAccessToken.mockImplementationOnce(() => {
      getCallback(initTokenClient)({ access_token: 'tok-2', expires_in: 3600 });
    });

    await vi.advanceTimersByTimeAsync((3600 - 300) * 1000);

    expect(requestAccessToken).toHaveBeenCalledTimes(2);
    expect(requestAccessToken.mock.calls[1][0]).toEqual({ prompt: '' });
    expect(mod.getAccessToken()).toBe('tok-2');
  });
});

describe('googleDriveAuth — handleTokenExpired (401 handling)', () => {
  it('attempts one immediate silent refresh; on failure it does not throw and only toasts once', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const { showToast } = await import('../../../src/ui/components/toast.js');
    showToast.mockClear();
    const mod = await loadModule();

    requestAccessToken.mockImplementation(() => {
      getCallback(initTokenClient)({ error: 'invalid_grant', error_description: 'expired' });
    });

    await mod.handleTokenExpired();
    await mod.handleTokenExpired();

    expect(requestAccessToken).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('re-arms the reconnect toast once a subsequent refresh succeeds', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const { showToast } = await import('../../../src/ui/components/toast.js');
    // The mocked toast module's vi.fn() can outlive vi.resetModules() (only
    // the SUT module itself is guaranteed fresh), so clear it explicitly
    // rather than relying on call counts from a previous test in this file.
    showToast.mockClear();
    const mod = await loadModule();

    requestAccessToken.mockImplementationOnce(() => {
      getCallback(initTokenClient)({ error: 'invalid_grant', error_description: 'expired' });
    });
    await mod.handleTokenExpired();
    expect(showToast).toHaveBeenCalledTimes(1);

    requestAccessToken.mockImplementationOnce(() => {
      getCallback(initTokenClient)({ access_token: 'tok-recovered', expires_in: 3600 });
    });
    await mod.handleTokenExpired();
    expect(mod.getAccessToken()).toBe('tok-recovered');

    requestAccessToken.mockImplementationOnce(() => {
      getCallback(initTokenClient)({ error: 'invalid_grant', error_description: 'expired again' });
    });
    await mod.handleTokenExpired();
    expect(showToast).toHaveBeenCalledTimes(2);
  });
});

describe('googleDriveAuth — setInitialAccessToken', () => {
  it('seeds the token from a credential (e.g. from signInWithGoogle) with no GIS popup', async () => {
    const { requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    mod.setInitialAccessToken('tok-from-firebase-credential');

    expect(mod.getAccessToken()).toBe('tok-from-firebase-credential');
    expect(requestAccessToken).not.toHaveBeenCalled();
  });

  it('arms the same silent-refresh timer requestInitialToken() would have', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    mod.setInitialAccessToken('tok-1');

    requestAccessToken.mockImplementationOnce(() => {
      getCallback(initTokenClient)({ access_token: 'tok-2', expires_in: 3600 });
    });
    await vi.advanceTimersByTimeAsync((3600 - 300) * 1000);

    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: '' });
    expect(mod.getAccessToken()).toBe('tok-2');
  });
});

describe('googleDriveAuth — reacquireIfGoogleUser', () => {
  it('is a no-op for a non-Google user', async () => {
    const { requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    mod.reacquireIfGoogleUser({ uid: 'u1', providerData: [{ providerId: 'password' }] });
    expect(requestAccessToken).not.toHaveBeenCalled();
  });

  it('is a no-op for a null user', async () => {
    const { requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    mod.reacquireIfGoogleUser(null);
    expect(requestAccessToken).not.toHaveBeenCalled();
  });

  it('silently requests a token for a Google user (e.g. restoring a session on reload)', async () => {
    const { initTokenClient, requestAccessToken } = installFakeGis();
    const mod = await loadModule();

    requestAccessToken.mockImplementation(() => {
      getCallback(initTokenClient)({ access_token: 'tok-reload', expires_in: 3600 });
    });

    await mod.reacquireIfGoogleUser({ uid: 'u1', providerData: [{ providerId: 'google.com' }] });

    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: '' });
    expect(mod.getAccessToken()).toBe('tok-reload');
  });
});
