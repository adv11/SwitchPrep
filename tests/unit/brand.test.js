import { describe, it, expect } from 'vitest';
import { createBrandIcon, createBrandWordmark, createBrandMark } from '../../src/ui/components/brand.js';

describe('brand.js', () => {
  it('createBrandIcon renders a .brand-mark span containing an SVG glyph, no throw', () => {
    const icon = createBrandIcon();
    expect(icon.className).toBe('brand-mark');
    expect(icon.querySelector('svg')).not.toBeNull();
  });

  it('createBrandWordmark renders the wordmark text exactly as "Ascent"', () => {
    const wordmark = createBrandWordmark();
    expect(wordmark.className).toBe('brand-name');
    expect(wordmark.textContent).toBe('Ascent');
  });

  it('createBrandMark without a tagline returns [icon, wordmark]', () => {
    const [icon, wordmark] = createBrandMark();
    expect(icon.className).toBe('brand-mark');
    expect(wordmark.className).toBe('brand-name');
    expect(wordmark.textContent).toBe('Ascent');
  });

  it('createBrandMark with a tagline includes both the wordmark and the tagline text', () => {
    const [, nameGroup] = createBrandMark({ tagline: 'Engineer your next move.' });
    expect(nameGroup.textContent).toContain('Ascent');
    expect(nameGroup.textContent).toContain('Engineer your next move.');
  });

  it('never renders the raw pre-rename "SwitchPrep" string', () => {
    const wrapper = document.createElement('div');
    wrapper.append(...createBrandMark({ tagline: 'Java Spring Boot switch command center' }));
    expect(wrapper.textContent).not.toContain('SwitchPrep');
  });
});
