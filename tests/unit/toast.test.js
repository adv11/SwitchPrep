import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// toast.js keeps a module-level singleton `root` node — reset the module
// registry and re-import fresh in every test so each test gets its own
// detached root instead of silently reusing a previous test's (possibly
// already-removed-from-the-DOM) stack element.
async function freshShowToast() {
  vi.resetModules();
  const mod = await import('../../src/ui/components/toast.js');
  return mod.showToast;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('showToast', () => {
  it('renders a toast with the type-based class and message text', async () => {
    const showToast = await freshShowToast();
    showToast('Deleted "Foo".', 'success');
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.className).toContain('toast-success');
    expect(toast.textContent).toBe('Deleted "Foo".');
  });

  it('defaults to the "info" type when none is passed', async () => {
    const showToast = await freshShowToast();
    showToast('Just fyi.');
    expect(document.querySelector('.toast').className).toContain('toast-info');
  });

  it('adds the "show" class on the next animation frame', async () => {
    const showToast = await freshShowToast();
    showToast('Hi', 'info');
    const toast = document.querySelector('.toast');
    expect(toast.classList.contains('show')).toBe(false);
    vi.advanceTimersToNextFrame();
    expect(toast.classList.contains('show')).toBe(true);
  });

  it('auto-dismisses and removes the toast after its duration', async () => {
    const showToast = await freshShowToast();
    showToast('Bye', 'info', 1000);
    const toast = document.querySelector('.toast');
    vi.advanceTimersToNextFrame();

    vi.advanceTimersByTime(1000);
    expect(toast.classList.contains('show')).toBe(false);

    vi.advanceTimersByTime(260);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('uses the default 3200ms duration when none is passed', async () => {
    const showToast = await freshShowToast();
    showToast('Default duration');
    const toast = document.querySelector('.toast');
    vi.advanceTimersToNextFrame();

    vi.advanceTimersByTime(3199);
    expect(document.body.contains(toast)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(toast.classList.contains('show')).toBe(false);
  });

  it('stacks multiple toasts without one clobbering another\'s DOM node', async () => {
    const showToast = await freshShowToast();
    showToast('First', 'success');
    showToast('Second', 'error');
    const toasts = document.querySelectorAll('.toast');
    expect(toasts.length).toBe(2);
    expect(toasts[0].textContent).toBe('First');
    expect(toasts[0].className).toContain('toast-success');
    expect(toasts[1].textContent).toBe('Second');
    expect(toasts[1].className).toContain('toast-error');
  });

  it('dismissing one toast does not remove a sibling toast still pending', async () => {
    const showToast = await freshShowToast();
    showToast('Short', 'info', 500);
    showToast('Long', 'info', 5000);
    vi.advanceTimersToNextFrame();

    vi.advanceTimersByTime(500 + 260);
    const remaining = document.querySelectorAll('.toast');
    expect(remaining.length).toBe(1);
    expect(remaining[0].textContent).toBe('Long');
  });

  it('reuses a single shared toast-stack root across multiple calls', async () => {
    const showToast = await freshShowToast();
    showToast('A');
    showToast('B');
    expect(document.querySelectorAll('.toast-stack').length).toBe(1);
  });
});
