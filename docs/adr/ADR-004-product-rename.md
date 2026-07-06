# ADR-004: Product rename to Ascent

**Date**: 2026-07-06
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #7

## Context

SwitchPrep is moving from a personal tool toward a sellable SaaS product. "SwitchPrep"
reads as an internal/personal project name rather than a product identity, and the app
needed a brand system (name, wordmark, colors, tagline) that could stand on its own,
plus a way to roll a future rename out safely without silently breaking existing users'
local data.

## Options considered

| Name | Reason not chosen |
|---|---|
| SwitchPrep | Reads as internal/personal project name, not a product |
| DevPath | Generic; confusable with many existing products |
| Forge | Overused in dev tooling (e.g. GitLab Forge) |
| Stride | Directionally ambiguous |
| Launchpad | Already used by Apple and Google |

## Decision

**Rename the product to Ascent.** Tagline: "Engineer your next move." The existing
teal (`#0f766e`) + orange (`#f97316`) palette is kept unchanged — it already tests well
in both themes and doesn't need to change just because the name did.

### Brand component

`src/ui/components/brand.js` is the single source of truth for the wordmark
(`createBrandMark`/`createBrandIcon`/`createBrandWordmark`). The brand mark previously
existed as duplicated inline markup in both `authShell.js` and `dashboard.js` (a `✓`
glyph in a gradient square); both now render through this shared module, and the glyph
becomes an inline SVG triangle so it also works as a crisp favicon at small sizes.

### localStorage key migration

Renaming persisted keys (`switchprep-theme`, `switchprep-roadmap-v3`,
`switchprep-ui-v3`) without a migration would silently reset every existing user's
theme and roadmap progress on their next visit. `src/services/migration.js` exports
`migrateLocalStorageKeys()`, run once at the top of `src/main.js`: for each old/new key
pair, if the new key is absent and the old key is present, copy the value over and
remove the old key. `src/services/localStorageKeys.js` centralizes the new key strings
so no file hardcodes a raw `ascent-*` string.

`src/services/themeBootstrap.js` is a classic `<script>` that sets `data-theme`
synchronously before `main.js` (and therefore before the migration above) ever runs.
It now reads `ascent-theme` first and falls back to `switchprep-theme`, so existing
users still get the correct theme on first paint on the first post-rename load, instead
of one flash of the default theme before the migration has a chance to run.

The `sessionStorage` dismissal key in `verificationBanner.js` is renamed to the
`ascent-` prefix going forward but is not migrated — it's per-session, non-persistent
state (worst case an already-verified-email banner reappears once), not worth a
migration path.

### Deferred / explicitly out of scope

- **GitHub repository rename** (`adv11/SwitchPrep` → a new repo name), topics, and
  branch protection are Issue #10 (Phase 4, after v1.0 launch prep). This PR does not
  touch the repo slug, `.github/ISSUE_TEMPLATE/config.yml`'s repo URLs, or the
  `git clone` instructions in `README.md` — they still correctly describe the current,
  unrenamed repository.
- **Firebase Console changes** (project public-facing display name, the four Auth
  email templates, and optionally a custom domain for auth action links) are manual,
  console-only steps with no code representation. They're tracked as a checklist in
  the PR that closes this issue, to be completed by the project owner the same day the
  PR merges.
- No custom domain exists yet, so the Open Graph `og:image` uses a root-relative path
  and no `og:url` is set, rather than guessing a domain.

## Consequences

- **Positive**: A future rename (or a white-label/multi-tenant variant) becomes a
  one-file change to `brand.js` plus a new migration entry, instead of a repo-wide grep.
- **Positive**: Existing users' theme preference and roadmap progress survive the
  rename with no visible data loss and, after the `themeBootstrap.js` fallback, no
  flash-of-wrong-theme either.
- **Negative**: Until Issue #10 ships, the product name (Ascent) and the GitHub repo
  name (`SwitchPrep`) intentionally disagree. This is called out explicitly rather than
  fixed here to avoid mixing an in-app rebrand with repository-level changes (CI/CD
  URLs, clone instructions, existing PR links) that carry their own risk.
- **Negative**: The issue's brand spec assumed Plus Jakarta Sans would already be
  loaded (Issue #6, Phase 2 — not started, and itself depends on this issue). The
  wordmark and generated OG image use Inter 800/900 (already loaded in `index.html`)
  instead; this should be revisited once Issue #6 lands the new font.
