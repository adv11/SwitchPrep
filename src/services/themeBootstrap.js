(function () {
  // Falls back to the pre-rename key because this classic script runs before
  // main.js's migrateLocalStorageKeys() ever gets a chance to run — without the
  // fallback, existing users would see one flash of the default theme on their
  // first post-rename load.
  var stored = localStorage.getItem('ascent-theme') || localStorage.getItem('switchprep-theme');
  var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
})();
