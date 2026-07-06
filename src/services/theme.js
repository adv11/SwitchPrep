import { KEYS } from './localStorageKeys.js';

const THEME_KEY = KEYS.THEME;
const media = window.matchMedia('(prefers-color-scheme: dark)');
const subscribers = new Set();

function systemTheme() {
  return media.matches ? 'dark' : 'light';
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  subscribers.forEach(callback => callback(theme));
}

export function getTheme() {
  return document.documentElement.dataset.theme || systemTheme();
}

export function hasExplicitPreference() {
  return !!localStorage.getItem(THEME_KEY);
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  apply(theme);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

// The inline bootstrap script in index.html already set the correct
// data-theme attribute before first paint. This just keeps the app in sync
// with the OS setting for as long as the visitor hasn't made an explicit choice.
export function initTheme() {
  media.addEventListener('change', () => {
    if (!hasExplicitPreference()) apply(systemTheme());
  });
}
