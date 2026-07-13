import { describe, it, expect } from 'vitest';
import { findClientToFocus, getReminderTargetUrl } from '../../src/services/sw/notificationHelpers.js';

describe('findClientToFocus', () => {
  it('returns the first client with a url', () => {
    const clients = [{ url: 'https://ascent.app/#/app' }, { url: 'https://ascent.app/#/onboarding' }];
    expect(findClientToFocus(clients)).toBe(clients[0]);
  });

  it('returns null when there are no window clients', () => {
    expect(findClientToFocus([])).toBeNull();
  });
});

describe('getReminderTargetUrl', () => {
  it('points at the onboarding page where the Daily Todos panel lives', () => {
    expect(getReminderTargetUrl()).toBe('/#/onboarding');
  });
});
