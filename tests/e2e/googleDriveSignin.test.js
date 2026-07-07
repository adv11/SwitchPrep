import { test, expect } from './fixtures.js';

// Requires FIREBASE_CONFIGURED (the Firebase Auth Emulator running) — same gate
// every other emulator-dependent test in this suite uses. The identity half of
// "Sign in with Google" goes through the Auth Emulator's real fake-IDP popup
// (verified against a live emulator while writing this test — real selectors,
// not guessed: `#add-account-button button`, `#email-input`, `#sign-in`). The
// Drive-token half (GIS) and the Drive REST API itself are stubbed here since
// they're unrelated to Firebase and would otherwise require real Google
// network access issue #5's part 3 explicitly avoids depending on for tests.
//
// The Drive mock below registers one glob-pattern page.route() per endpoint
// rather than a single `**` catch-all with method/path dispatch inside — a
// regex-pattern route (and, separately, a single broad `**` route doing its
// own internal dispatch) was found to silently stall signInWithPopup's
// cross-window handshake with the Auth Emulator's popup in this test
// environment; plain glob patterns, one per endpoint, do not have that
// problem. Keep new Drive endpoints on this same pattern if you add any.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

function makeDriveMock() {
  const files = new Map(); // name -> { id, content, etag }
  let etagCounter = 0;

  function nextEtag() {
    etagCounter += 1;
    return `etag-${etagCounter}`;
  }

  async function registerRoutes(page) {
    await page.route('https://www.googleapis.com/drive/v3/files?*', async route => {
      const url = new URL(route.request().url());
      const name = (url.searchParams.get('q') || '').match(/name='([^']+)'/)?.[1];
      const file = name ? files.get(name) : null;
      await route.fulfill({ json: { files: file ? [{ id: file.id, name }] : [] } });
    });

    await page.route('https://www.googleapis.com/drive/v3/files/*', async route => {
      const id = new URL(route.request().url()).pathname.split('/').pop();
      const entry = [...files.entries()].find(([, f]) => f.id === id);

      if (route.request().method() === 'DELETE') {
        if (entry) files.delete(entry[0]);
        await route.fulfill({ status: 200, json: {} });
        return;
      }

      if (!entry) { await route.fulfill({ status: 404, json: {} }); return; }
      await route.fulfill({ status: 200, headers: { etag: entry[1].etag }, json: entry[1].content });
    });

    await page.route('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', async route => {
      const body = route.request().postData() || '';
      const name = body.match(/"name":"([^"]+)"/)?.[1];
      const jsonBlobs = [...body.matchAll(/Content-Type: application\/json\r?\n\r?\n([\s\S]*?)\r?\n--/g)];
      let content = {};
      try { content = JSON.parse(jsonBlobs[1]?.[1] ?? '{}'); } catch { /* leave as {} */ }
      files.set(name, { id: name, content, etag: nextEtag() });
      await route.fulfill({ json: { id: name, name } });
    });

    await page.route('https://www.googleapis.com/upload/drive/v3/files/*', async route => {
      const id = new URL(route.request().url()).pathname.split('/').pop();
      const entry = [...files.entries()].find(([, f]) => f.id === id);
      const ifMatch = route.request().headers()['if-match'];
      if (entry && ifMatch && ifMatch !== entry[1].etag) {
        await route.fulfill({ status: 412, json: {} });
        return;
      }
      let content = {};
      try { content = JSON.parse(route.request().postData() || '{}'); } catch { /* leave as {} */ }
      files.set(entry ? entry[0] : id, { id, content, etag: nextEtag() });
      await route.fulfill({ status: 200, json: {} });
    });
  }

  return { registerRoutes, files };
}

async function stubGis(page) {
  await page.addInitScript(() => {
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient(config) {
            return {
              requestAccessToken() {
                setTimeout(() => config.callback({ access_token: 'e2e-fake-drive-token', expires_in: 3600 }), 0);
              }
            };
          }
        }
      }
    };
  });
}

async function stubGoogleClientId(page) {
  // firebase.config.js is gitignored/environment-specific and never has a
  // real googleClientId in CI — override just that one export so
  // ensureTokenClient()'s "is this configured" guard passes. The real
  // firebaseConfig object (whatever CI/local provides) is left untouched.
  await page.route('**/services/firebase.config.js', async route => {
    const response = await route.fetch();
    let body = await response.text();
    const stubLine = "export const googleClientId = 'e2e-test-client.apps.googleusercontent.com';";
    body = /export const googleClientId/.test(body)
      ? body.replace(/export const googleClientId = '[^']*';/, stubLine)
      : `${body}\n${stubLine}\n`;
    await route.fulfill({ response, body, contentType: 'application/javascript' });
  });
}

async function signInWithFakeGoogleIdp(page, email) {
  await page.click('text=Sign in with Google');
  const overlay = page.locator('.modal-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    overlay.locator('[data-action="confirm"]').click()
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.click('#add-account-button button');
  await popup.fill('#email-input', email);
  await popup.click('#sign-in');
}

test.describe('Google Sign-In + Drive sync (issue #5 part 3)', () => {
  test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

  test('shows the pre-consent notice before the OAuth popup, not after', async ({ page }) => {
    await stubGis(page);
    await stubGoogleClientId(page);
    await page.goto('/');

    let popupFired = false;
    page.once('popup', () => { popupFired = true; });

    await page.click('text=Sign in with Google');
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 });
    expect(popupFired).toBe(false);
  });

  test('cancelling the consent notice never opens the OAuth popup', async ({ page }) => {
    await stubGis(page);
    await stubGoogleClientId(page);
    await page.goto('/');

    let popupFired = false;
    page.once('popup', () => { popupFired = true; });

    await page.click('text=Sign in with Google');
    const overlay = page.locator('.modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await overlay.locator('[data-action="cancel"]').click();
    await expect(overlay).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(popupFired).toBe(false);
    await expect(page.locator('.auth-title')).toContainText('Welcome back');
  });

  test('sign-in -> pick template -> toggle item -> Drive "file" is updated', async ({ page }) => {
    const drive = makeDriveMock();
    await drive.registerRoutes(page);
    await stubGis(page);
    await stubGoogleClientId(page);
    await page.goto('/');

    await signInWithFakeGoogleIdp(page, `e2e-drive-${Date.now()}@example.com`);

    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.locator('.check-item').first().click();
    await expect(page.locator('.check-item').first()).toHaveClass(/done/);

    await expect.poll(() => {
      const roadmapFile = [...drive.files.values()].find(f => f.content?.items);
      return roadmapFile ? Object.values(roadmapFile.content.items).some(item => item.done) : false;
    }, { timeout: 10_000 }).toBe(true);
  });

  test('reload silently restores the dashboard without a visible re-login popup', async ({ page }) => {
    const drive = makeDriveMock();
    await drive.registerRoutes(page);
    await stubGis(page);
    await stubGoogleClientId(page);
    await page.goto('/');

    await signInWithFakeGoogleIdp(page, `e2e-reload-${Date.now()}@example.com`);
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    let popupFired = false;
    page.once('popup', () => { popupFired = true; });

    await page.reload();

    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/#\/signin/);
    expect(popupFired).toBe(false);
  });
});
