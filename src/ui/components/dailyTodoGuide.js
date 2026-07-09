import { el } from '../dom.js';
import { MAX_ACTIVE_TODOS } from '../../core/dailyTodo/limits.js';

// Informational modal reachable from the Daily Todos card's corner ℹ button
// (issue #56 follow-up) — same pattern as buildYourOwnGuide.js. Explains a
// feature that has no other onboarding: it's a separate, always-visible
// list (independent of whichever roadmap is active) for short-lived,
// self-imposed deadlines, not another way to track roadmap topics.
export function openDailyTodoGuide() {
  function close() {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  const onKey = e => { if (e.key === 'Escape') close(); };

  const card = el('div', { className: 'modal-card build-guide-card' }, [
    el('h2', { className: 'modal-title', text: "About Today's Todos" }),
    el('p', {
      className: 'build-guide-intro',
      text: 'A separate, quick-add task list for anything you need done in the next few hours or days — not tied to any roadmap, and unaffected by switching or hiding one.'
    }),
    el('h3', { className: 'build-guide-heading', text: 'How the deadline works' }),
    el('p', { className: 'build-guide-body' }, [
      'Pick how long you have when you add a todo — a preset or a custom number of hours. The countdown counts down from that moment (not a calendar day), turning ',
      el('strong', { text: 'amber' }),
      ' under 6 hours left and ',
      el('strong', { text: 'red' }),
      ' under 1 hour left.'
    ]),
    el('h3', { className: 'build-guide-heading', text: 'Done and missed' }),
    el('p', { className: 'build-guide-body' }, [
      'Check the box to mark something done — it stays visible, struck through. If time runs out first, it moves into the collapsed ',
      el('strong', { text: 'Missed' }),
      ' section instead of disappearing. Either way, use the ',
      el('strong', { text: '×' }),
      ' button next to a done or missed todo to remove it for good once you\'re done with it.'
    ]),
    el('p', { className: 'build-guide-body', text: `You can have up to ${MAX_ACTIVE_TODOS} active (not-done, not-missed) todos at a time.` }),
    el('div', { className: 'panel-footer-right' }, [
      el('button', { type: 'button', className: 'btn btn-primary', text: 'Got it', onClick: close })
    ])
  ]);

  const overlay = el('div', {
    className: 'modal-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': "About Today's Todos",
    onClick: e => { if (e.target === overlay) close(); }
  }, [card]);

  window.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);

  return close;
}
