import { el } from '../dom.js';
import { createBrandMark } from './brand.js';

// Issue #6 Phase 5.1 — left panel of the split auth-page layout, hidden
// below the existing ≤1024px breakpoint tier (src/styles/app.css). Every
// value prop here names a real, already-shipped feature — no fabricated
// testimonial/quote (the original spec's mockup had one; decided against it
// since a fake customer quote reads as deceptive on a real product once
// actual users see it).
const VALUE_PROPS = [
  { icon: '🗺️', title: 'Track any roadmap', text: 'Pick a starter template or build your own, organized by phase and priority.' },
  { icon: '🔄', title: 'Sync everywhere', text: 'Your progress follows you across every device, automatically.' },
  { icon: '📌', title: 'Stay focused', text: 'Priority filters and Daily Todos keep today’s work front and center.' }
];

export function createAuthMarketingPanel() {
  return el('aside', { className: 'auth-marketing', 'aria-hidden': 'true' }, [
    el('div', { className: 'auth-marketing-inner' }, [
      el('span', { className: 'brand auth-marketing-brand' }, createBrandMark()),
      el('ul', { className: 'auth-marketing-values' }, VALUE_PROPS.map(v => el('li', { className: 'auth-marketing-value' }, [
        el('span', { className: 'auth-marketing-value-icon', 'aria-hidden': 'true', text: v.icon }),
        el('div', {}, [
          el('span', { className: 'auth-marketing-value-title', text: v.title }),
          el('span', { className: 'auth-marketing-value-text', text: v.text })
        ])
      ])))
    ])
  ]);
}
