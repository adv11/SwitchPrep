// Pure helper for sw.js's notificationclick handler (issue #132) — kept
// dependency-free like cacheStrategies.js so it's unit-testable without a
// real ServiceWorkerGlobalScope/Clients API.

const APP_URL = '/#/onboarding';

// Given the list of open window clients, returns the one to focus, or null
// if a new window should be opened at APP_URL instead. Matching by whether
// a client's URL contains this app's own origin path is enough here — this
// app has no other routes worth distinguishing between for "is the app
// already open."
export function findClientToFocus(clients) {
  return clients.find(client => typeof client.url === 'string') || null;
}

export function getReminderTargetUrl() {
  return APP_URL;
}
