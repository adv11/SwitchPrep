import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  remindersEnabled,
  enableReminders,
  disableReminders,
  initReminderScheduler
} from '../../src/services/reminderScheduler.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

function makeStore(initialTodos = []) {
  let subscriber = null;
  return {
    todos: initialTodos,
    subscribe(callback) {
      subscriber = callback;
      callback({ todos: initialTodos });
      return () => { subscriber = null; };
    },
    push(todos) {
      subscriber?.({ todos });
    }
  };
}

describe('reminderScheduler', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // The scheduler's timer map is module-level state — clear it between
    // tests so a previous test's still-registered timer id (now stale,
    // since vi.useFakeTimers() gives each test a fresh fake clock) doesn't
    // make scheduleTimer() think this test's identically-id'd todo is
    // already scheduled.
    disableReminders();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enableReminders grants and persists when Notification.requestPermission resolves granted', async () => {
    global.Notification = { requestPermission: vi.fn().mockResolvedValue('granted') };
    const granted = await enableReminders();
    expect(granted).toBe(true);
    expect(remindersEnabled()).toBe(true);
  });

  it('enableReminders does not persist enabled when permission is denied', async () => {
    global.Notification = { requestPermission: vi.fn().mockResolvedValue('denied') };
    const granted = await enableReminders();
    expect(granted).toBe(false);
    expect(remindersEnabled()).toBe(false);
  });

  it('disableReminders clears the stored preference', () => {
    localStorage.setItem(KEYS.DAILY_TODO_REMINDERS_ENABLED, 'true');
    disableReminders();
    expect(remindersEnabled()).toBe(false);
  });

  it('does not schedule anything while reminders are disabled', () => {
    const store = makeStore([{ id: 'a', title: 'A', done: false, expiresAt: Date.now() + 60 * 60 * 1000 }]);
    const unsub = initReminderScheduler(store);
    expect(vi.getTimerCount()).toBe(0);
    unsub();
  });

  it('schedules a timer for an active todo once reminders are enabled', () => {
    localStorage.setItem(KEYS.DAILY_TODO_REMINDERS_ENABLED, 'true');
    const store = makeStore([{ id: 'a', title: 'A', done: false, expiresAt: Date.now() + 60 * 60 * 1000 }]);
    const unsub = initReminderScheduler(store);
    expect(vi.getTimerCount()).toBe(1);
    unsub();
  });

  it('cancels a todo\'s timer once it is marked done', () => {
    localStorage.setItem(KEYS.DAILY_TODO_REMINDERS_ENABLED, 'true');
    const todo = { id: 'a', title: 'A', done: false, expiresAt: Date.now() + 60 * 60 * 1000 };
    const store = makeStore([todo]);
    const unsub = initReminderScheduler(store);
    expect(vi.getTimerCount()).toBe(1);
    store.push([{ ...todo, done: true }]);
    expect(vi.getTimerCount()).toBe(0);
    unsub();
  });

  it('cancels a todo\'s timer once it is deleted', () => {
    localStorage.setItem(KEYS.DAILY_TODO_REMINDERS_ENABLED, 'true');
    const todo = { id: 'a', title: 'A', done: false, expiresAt: Date.now() + 60 * 60 * 1000 };
    const store = makeStore([todo]);
    const unsub = initReminderScheduler(store);
    expect(vi.getTimerCount()).toBe(1);
    store.push([]);
    expect(vi.getTimerCount()).toBe(0);
    unsub();
  });
});
