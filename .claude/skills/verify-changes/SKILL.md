---
name: verify-changes
description: Use before calling any change to app.css, index.html, or a page/component's layout done — the full cross-device/responsive/touch verification matrix (11 viewport widths, touch/hover checks, safe-area checks, real-device requirement, network-throttling checks for module-graph-affecting changes). For non-layout changes, the short manual check in root CLAUDE.md's Verifying changes section is enough.
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

## Network conditions — a separate axis from viewport width (issue #137)

DevTools' device emulation (viewport size/touch) and its network throttling are two
independent controls, and until issue #137 this matrix only ever exercised the first —
a real, measured audit found a signed-out landing page fetching 106 of the app's 116
total JS files with zero CI or manual-review signal catching it, specifically because
nothing in this matrix ever varied connection speed. Viewport emulation alone cannot
surface this class of regression; a wide/fast desktop pass and a narrow/slow mobile pass
can render pixel-identical while one loads in under half a second and the other takes
tens of seconds.

- **When required:** any change that adds a new page-level module import, a new
  top-of-file (not dynamically `import()`ed) dependency, or a new heavy third-party
  script/library — not every CSS tweak needs this, but a change that could plausibly
  grow the request count or transferred bytes does.
- **How:** DevTools → Network tab → throttling dropdown → run one pass each at
  **"Fast 3G"** and **"Slow 3G"** (the same built-in presets, via `Network.
  emulateNetworkConditions`, this issue's own investigation used) against a cold
  (hard-refreshed, cache cleared) load of the affected route. Note the `load` event
  time and the resource count from the Network tab's own summary — compare against the
  unthrottled numbers for the same route.
- **What a pass looks like:** the new/changed dependency shouldn't be fetched at all
  unless the current route actually needs it (verify this in the Network tab's request
  list, not just the timing), and total transferred bytes for the affected route
  shouldn't have grown by more than the new dependency's own genuine size.
- Local dev server numbers (`python3 -m http.server`, HTTP/1.1) don't transfer 1:1 to
  production (Firebase Hosting serves HTTP/2, which parallelizes sibling requests
  better) — treat a local-only regression as a real signal worth investigating, but
  don't block a PR on the exact local millisecond figures; re-check against a deployed
  preview URL if the local numbers look concerning.
