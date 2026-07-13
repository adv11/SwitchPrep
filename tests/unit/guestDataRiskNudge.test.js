import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMPLETED_THRESHOLD } from '../../src/ui/utils/guestDataRisk.js';
import { guestRiskNudgeShownKey } from '../../src/services/localStorageKeys.js';

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

function fakeStore(doneCount) {
  const items = Array.from({ length: doneCount }, (_, i) => ({ id: `i${i}`, done: true }));
  return { getSnapshot: () => ({ items }) };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  localStorage.clear();
});

async function freshNudge(opts) {
  const { maybeShowGuestDataRiskNudge } = await import('../../src/ui/components/guestDataRiskNudge.js');
  return maybeShowGuestDataRiskNudge(opts);
}

describe('maybeShowGuestDataRiskNudge', () => {
  it('never shows for a non-anonymous account', async () => {
    await freshNudge({ user: { isAnonymous: false, uid: 'u1' }, store: fakeStore(COMPLETED_THRESHOLD) });
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('never shows before the completed-item threshold', async () => {
    await freshNudge({ user: { isAnonymous: true, uid: 'guest-1' }, store: fakeStore(COMPLETED_THRESHOLD - 1) });
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  it('shows a confirmDialog for an anonymous account past the threshold and marks it shown', async () => {
    const promise = freshNudge({ user: { isAnonymous: true, uid: 'guest-2' }, store: fakeStore(COMPLETED_THRESHOLD) });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    expect(localStorage.getItem(guestRiskNudgeShownKey('guest-2'))).toBe('1');

    document.querySelector('[data-action="cancel"]').click();
    await promise;
  });

  it('navigates to /signup when the user confirms', async () => {
    const { navigate } = await import('../../src/ui/router.js');
    const promise = freshNudge({ user: { isAnonymous: true, uid: 'guest-3' }, store: fakeStore(COMPLETED_THRESHOLD) });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());

    document.querySelector('[data-action="confirm"]').click();
    await promise;

    expect(navigate).toHaveBeenCalledWith('/signup');
  });

  it('does not fire again on a second call once already shown', async () => {
    const uid = 'guest-4';
    const firstPromise = freshNudge({ user: { isAnonymous: true, uid }, store: fakeStore(COMPLETED_THRESHOLD) });
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay')).not.toBeNull());
    document.querySelector('[data-action="cancel"]').click();
    await firstPromise;
    document.body.innerHTML = '';

    await freshNudge({ user: { isAnonymous: true, uid }, store: fakeStore(COMPLETED_THRESHOLD + 5) });
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
