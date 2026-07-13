import { test, expect } from './fixtures.js';

// Issue #131 — publish a read-only share link as one signed-in guest, then
// load it in a fresh unauthenticated browser context, and revoke it. Needs a
// real (emulator) sign-in and Firebase writes, same FIREBASE_CONFIGURED skip
// precedent as every other Firebase-backed E2E spec in this repo.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('roadmap sharing — publish, view, revoke', () => {
  test('a published link renders read-only for an unauthenticated visitor, and 404s after revoke', async ({ page, browser }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    await page.context().grantPermission(['clipboard-read', 'clipboard-write']);
    await page.goto('/#/signin');
    await page.click('text=Continue as guest');
    await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
    await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
    await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

    await page.locator('.app-sidebar-identity').click();
    await page.locator('.dropdown-item', { hasText: 'Share this roadmap…' }).click();
    const modal = page.locator('.modal-overlay[aria-label="Share this roadmap"]');
    await expect(modal).toBeVisible();

    await modal.locator('button', { hasText: 'Generate a new link' }).click();
    const status = modal.locator('.share-roadmap-modal-status');
    await expect(status).toContainText('#/shared?id=', { timeout: 10_000 });
    const statusText = await status.textContent();
    const shareUrl = statusText.match(/https?:\/\/\S+/)[0];
    const shareId = new URL(shareUrl.replace('#', '')).searchParams.get('id') || shareUrl.split('id=')[1];

    // Fresh, unauthenticated context — a stranger with the link.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/#/shared?id=${shareId}`);
    await expect(guestPage.locator('.shared-view')).toBeVisible({ timeout: 10_000 });
    await expect(guestPage.locator('.shared-item-list')).toBeVisible();
    await expect(guestPage.locator('input[type="checkbox"]')).toHaveCount(0);
    await guestContext.close();

    // Revoke, then confirm the link now shows the revoked state.
    await modal.locator('.share-link-row').first().locator('button', { hasText: 'Revoke' }).click();
    await page.locator('.modal-overlay[aria-label="Revoke this share link?"] [data-action="confirm"]').click();
    await expect(modal.locator('.share-link-list')).toContainText('No published links yet.', { timeout: 10_000 });

    const revokedContext = await browser.newContext();
    const revokedPage = await revokedContext.newPage();
    await revokedPage.goto(`/#/shared?id=${shareId}`);
    await expect(revokedPage.locator('.shared-view-state')).toBeVisible({ timeout: 10_000 });
    await expect(revokedPage.locator('.shared-view-state')).toContainText('revoked');
    await revokedContext.close();
  });
});
