import { describe, it, expect, beforeEach } from 'vitest';
import { migrateLocalStorageKeys } from '../../src/services/migration.js';

const PAIRS = [
  ['switchprep-theme', 'ascent-theme'],
  ['switchprep-roadmap-v3', 'ascent-roadmap-v3'],
  ['switchprep-ui-v3', 'ascent-ui-v3']
];

beforeEach(() => {
  localStorage.clear();
});

describe('migrateLocalStorageKeys', () => {
  it('copies each old key to the new key and removes the old key', () => {
    PAIRS.forEach(([oldKey]) => localStorage.setItem(oldKey, `value-for-${oldKey}`));

    migrateLocalStorageKeys();

    PAIRS.forEach(([oldKey, newKey]) => {
      expect(localStorage.getItem(oldKey)).toBeNull();
      expect(localStorage.getItem(newKey)).toBe(`value-for-${oldKey}`);
    });
  });

  it('does not overwrite a new key that already has a value', () => {
    const [oldKey, newKey] = PAIRS[0];
    localStorage.setItem(oldKey, 'stale-old-value');
    localStorage.setItem(newKey, 'current-new-value');

    migrateLocalStorageKeys();

    expect(localStorage.getItem(newKey)).toBe('current-new-value');
  });

  it('is a no-op when neither key is present', () => {
    migrateLocalStorageKeys();

    PAIRS.forEach(([oldKey, newKey]) => {
      expect(localStorage.getItem(oldKey)).toBeNull();
      expect(localStorage.getItem(newKey)).toBeNull();
    });
  });
});
