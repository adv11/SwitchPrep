---
name: verify-changes
description: Use before calling any change to app.css, index.html, or a page/component's layout done — the full cross-device/responsive/touch verification matrix (11 viewport widths, touch/hover checks, safe-area checks, real-device requirement). For non-layout changes, the short manual check in root CLAUDE.md's Verifying changes section is enough.
---

# Cross-device / responsive verification matrix

Relocated from `CLAUDE.md`'s "Verifying changes" section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`. Required whenever a
change touches `app.css`, `index.html`, or any page/component's layout — not just for
issue #36 (which introduced this matrix) itself. See also `.claude/rules/ui-styling.md`
for the underlying CSS/layout conventions this matrix is verifying.

- **Widths (DevTools device emulation, both themes):** 320, 375, 390, 414, 768, 820,
  1024, 1280, 1440, 1920, 2560.
- **Touch/hover:** with DevTools' device toolbar set to a touch-capable emulated
  device, confirm `.check-actions` (the row Edit/resource controls) is visible without
  hovering. With emulation off (plain mouse), confirm it's hidden until hover/focus.
- **Touch targets:** at an emulated touch width, confirm `.btn-icon`/`.btn-sm`/
  `.filter-chip`/checklist rows visually measure ~44×44px (DevTools' box-model
  inspector on the computed style, not just eyeballing).
- **Mobile browser chrome:** simulate the address-bar collapse/expand (scroll down
  then up in an emulated mobile viewport) and confirm no fixed element (item panel,
  toasts, save badge) jumps or gets cut off.
- **Real devices, in addition to emulation, before merging:** one pass on real iOS
  Safari and one on real Android Chrome — DevTools emulation does not reproduce iOS's
  input auto-zoom or a real notch/gesture-bar safe area.

Also run the baseline manual browser check from root `CLAUDE.md`'s "Verifying changes"
section (sign in as guest, toggle checklist items, resource badge, theme toggle) even
when this full matrix applies — it's not a substitute, it's a prerequisite.
