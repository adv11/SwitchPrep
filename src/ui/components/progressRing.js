import { svgEl } from '../utils/svg.js';

// Module-scope incrementing id suffix so two rings rendered on the same page
// (e.g. a future list of per-phase rings) never collide on the same
// <linearGradient> id — SVG gradient references are id-scoped per-document,
// not per-element.
let gradientInstanceCount = 0;

// Issue #6 Phase 3.7 — small animated SVG circular progress ring. `size` in
// px, `strokeWidth` in px; the track (background circle) uses `--track-bg`.
// issue #206 §7 — the fill now strokes `var(--gradient-alpenglow)` via an
// inline SVG <linearGradient> instead of a flat `--brand`/`--color-brand-gold`
// color. The gradient's two <stop> elements read their color through real
// CSS custom properties (`.alpenglow-gradient-stop-gold`/`-rose` in
// app.css), not an inline `style` attribute or a JS-computed literal hex —
// index.html's CSP has no `unsafe-inline` for style-src (see the "Never set
// an inline style attribute" rule), and SVG's `stop-color` presentation
// attribute can't take a `var()` reference the way a real CSS declaration
// can. This also means the gradient updates live on a theme toggle with zero
// extra JS, the same as everything else in this app that reads a token.
export function createProgressRing(pct = 0, { size = 40, strokeWidth = 4 } = {}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  gradientInstanceCount += 1;
  const gradientId = `alpenglow-gradient-${gradientInstanceCount}`;

  const svg = svgEl('svg', {
    class: 'progress-ring',
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': `${Math.round(pct)}% complete`
  });

  const gradient = svgEl('linearGradient', { id: gradientId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
  gradient.append(
    svgEl('stop', { class: 'alpenglow-gradient-stop-gold', offset: '0%' }),
    svgEl('stop', { class: 'alpenglow-gradient-stop-rose', offset: '100%' })
  );
  const defs = svgEl('defs', {});
  defs.append(gradient);

  const track = svgEl('circle', {
    class: 'progress-ring-track',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    'stroke-width': strokeWidth
  });

  const fill = svgEl('circle', {
    class: 'progress-ring-fill',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    stroke: `url(#${gradientId})`,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-dasharray': circumference,
    'stroke-dashoffset': circumference,
    transform: `rotate(-90 ${center} ${center})`
  });

  svg.append(defs, track, fill);

  function setPct(nextPct) {
    const clamped = Math.max(0, Math.min(100, nextPct));
    fill.setAttribute('stroke-dashoffset', String(circumference * (1 - clamped / 100)));
    svg.setAttribute('aria-label', `${Math.round(clamped)}% complete`);
  }

  setPct(pct);
  svg._setPct = setPct;
  return svg;
}
