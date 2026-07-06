import { KEYS } from './localStorageKeys.js';

const RENAMES = [
  ['switchprep-theme', KEYS.THEME],
  ['switchprep-roadmap-v3', KEYS.ROADMAP],
  ['switchprep-ui-v3', KEYS.UI_STATE]
];

// One-time rename from the pre-Ascent localStorage key prefix. Must run before
// anything reads the new keys (theme.js, roadmapStore.js), so existing users'
// theme and roadmap data survive the rebrand instead of silently resetting.
export function migrateLocalStorageKeys() {
  RENAMES.forEach(([oldKey, newKey]) => {
    const value = localStorage.getItem(oldKey);
    if (value !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  });
}
