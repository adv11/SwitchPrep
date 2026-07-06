import { describe, it, expect } from 'vitest';
import { KEYS, verifyDismissedKey } from '../../src/services/localStorageKeys.js';

describe('localStorageKeys', () => {
  it('every KEYS value is a string with the ascent- prefix', () => {
    Object.values(KEYS).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value.startsWith('ascent-')).toBe(true);
    });
  });

  it('verifyDismissedKey builds an ascent-prefixed key scoped to the uid', () => {
    expect(verifyDismissedKey('user-123')).toBe('ascent-verify-dismissed-user-123');
  });
});
