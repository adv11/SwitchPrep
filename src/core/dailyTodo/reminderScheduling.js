import { REMINDER_LEAD_MS } from './limits.js';

// Pure scheduling math for the local "Remind me" reminder (issue #132) — no
// DOM/Notification/ServiceWorkerRegistration dependency, so it's testable
// without any of those in jsdom. reminderScheduler.js (which does own a
// real setTimeout + Notification API) is the only caller.

// Returns the timestamp a reminder should fire at, or null if this todo can
// never get one (already done — a completed todo has nothing left to remind
// about).
export function computeReminderFireAt(todo) {
  if (!todo || todo.done) return null;
  return todo.expiresAt - REMINDER_LEAD_MS;
}

// True only if a reminder both applies to this todo and its fire time is
// still in the future relative to `now` — false for a done todo, an already
//-expired one, or one whose lead-time window has already passed (added too
// close to its own deadline to get a 15-minute-ahead warning).
export function shouldScheduleReminder(todo, now = Date.now()) {
  const fireAt = computeReminderFireAt(todo);
  return fireAt !== null && fireAt > now;
}
