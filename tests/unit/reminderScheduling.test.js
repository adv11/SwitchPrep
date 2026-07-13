import { describe, it, expect } from 'vitest';
import { computeReminderFireAt, shouldScheduleReminder } from '../../src/core/dailyTodo/reminderScheduling.js';
import { REMINDER_LEAD_MS } from '../../src/core/dailyTodo/limits.js';

function makeTodo(overrides = {}) {
  return { id: 't1', title: 'Test', expiresAt: Date.now() + 60 * 60 * 1000, done: false, ...overrides };
}

describe('computeReminderFireAt', () => {
  it('returns expiresAt - REMINDER_LEAD_MS for an active todo', () => {
    const todo = makeTodo({ expiresAt: 1000000 });
    expect(computeReminderFireAt(todo)).toBe(1000000 - REMINDER_LEAD_MS);
  });

  it('returns null for a done todo', () => {
    expect(computeReminderFireAt(makeTodo({ done: true }))).toBeNull();
  });

  it('returns null for a missing todo', () => {
    expect(computeReminderFireAt(null)).toBeNull();
  });
});

describe('shouldScheduleReminder', () => {
  it('is true when the fire time is still in the future', () => {
    const now = 1000000;
    const todo = makeTodo({ expiresAt: now + REMINDER_LEAD_MS + 5000 });
    expect(shouldScheduleReminder(todo, now)).toBe(true);
  });

  it('is false once the fire time has already passed', () => {
    const now = 1000000;
    const todo = makeTodo({ expiresAt: now + REMINDER_LEAD_MS - 5000 });
    expect(shouldScheduleReminder(todo, now)).toBe(false);
  });

  it('is false for a done todo', () => {
    const now = 1000000;
    const todo = makeTodo({ expiresAt: now + 60 * 60 * 1000, done: true });
    expect(shouldScheduleReminder(todo, now)).toBe(false);
  });

  it('is false for an already-expired todo', () => {
    const now = 1000000;
    const todo = makeTodo({ expiresAt: now - 5000 });
    expect(shouldScheduleReminder(todo, now)).toBe(false);
  });
});
