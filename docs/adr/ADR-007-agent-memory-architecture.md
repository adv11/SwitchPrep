# ADR-007: Agent memory architecture — split monolithic CLAUDE.md into scoped rules + skills

**Date**: 2026-07-09
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #86

## Context

`CLAUDE.md` is loaded into every Claude Code session in this repo, in full,
unconditionally — regardless of whether the task touches auth, CSS, or nothing related
at all. Measured directly from git history (`git show <hash>:CLAUDE.md | wc -w` across
every commit that touched the file): it grew from 724 words to 10,510 words / 852 lines
in 5 days across 44 commits, a direct and mechanical consequence of the (correct-in-intent)
"update CLAUDE.md whenever a convention changes" rule combined with a house style of
writing deep "why" narratives directly into each rule. `AGENTS.md` was a near-full
duplicate (9,521 words) manually kept in sync. Anthropic's own current guidance is to
keep a `CLAUDE.md` under ~200 lines; this repo was over 4x that, with no plateau in
sight — the growth pattern would simply have continued at the same rate.

A prior attempt at addressing this already existed and had failed silently:
`.claude/rules/*.json` (six files — `no-innerHTML`, `url-validation`,
`structural-version`, `subscription-cleanup`, `store-pattern`, `docs-sync`) were added
in earlier issues (#3, #43) as "machine-readable rules for AI agents," but they used
plain JSON, not a format Claude Code actually reads. A full-repo grep found nothing
loading or referencing them beyond two docs mentioning their existence — they cost
nothing but also did nothing.

## What Claude Code actually supports (verified against current docs before deciding)

- **Root/ancestor `CLAUDE.md` and `CLAUDE.local.md`** load in full at every session
  launch, unconditionally.
- **Subdirectory `CLAUDE.md` files** load only when Claude reads a file in that
  subtree — genuine conditional loading, but requires the file tree itself to carry the
  scoping.
- **`@path/to/file` imports** inside `CLAUDE.md` are expanded and loaded eagerly at
  launch, identical cost to inline content. They help organize a file but do not reduce
  token cost — ruled out as the primary mechanism for this reason.
- **Path-scoped `.claude/rules/*.md` files** (YAML `paths:` frontmatter) load only when
  Claude reads a file matching one of the listed paths. This gives file-level (not just
  directory-level) conditional loading without restructuring the source tree.
- **Skills** (`.claude/skills/<name>/SKILL.md`) keep only the name + description
  resident at near-zero cost; the full body loads only when the skill is invoked
  (manually or via model-invocation). Suited to multi-step procedures needed at specific
  moments rather than reference material needed on every read.
- **`/context`** shows a visual breakdown of what's consuming the context window —
  used to measure before/after rather than estimate.

## Options considered

| Option | Why not chosen (or chosen) |
|---|---|
| 1. Do nothing, rely on discipline to keep entries short | Already tried implicitly — the growth data above is what discipline-only produced |
| 2. `@import`-split `CLAUDE.md` into multiple files for organization only | No token-cost reduction (imports load eagerly) — solves readability, not the actual problem |
| 3. Nested per-directory `CLAUDE.md` files only | Real conditional loading, but coarser than needed (whole-directory granularity) and would require reshaping where files live |
| 4. Path-scoped `.claude/rules/*.md` + Skills for procedures, root trimmed to universal-only content | **Chosen** — see below |

## Decision

**Option 4.** Root `CLAUDE.md` keeps only content that is short *and* genuinely
universal (product summary, stack, label taxonomy, docs-required table, a handful of
already-short cross-cutting conventions, a trimmed file map). Everything
feature/area-specific moved, content unchanged, into three topic-scoped rules files:

- `.claude/rules/roadmap-store.md` — `roadmapStore.js`/`dailyTodoStore.js`/templates/
  dashboard/onboarding/import/daily-todo domain
- `.claude/rules/ui-styling.md` — `app.css`/theming/responsive/layout domain
- `.claude/rules/auth-security.md` — `firebase.js`/auth pages/password/CSP-SRI/DB-rules
  domain

The MANDATORY WORKFLOW's step-by-step procedures (raising an issue, starting work,
opening a PR, after-merge, parallel work, the full responsive verification matrix)
became six Skills under `.claude/skills/` — each needed only at a specific moment, not
on every session.

`AGENTS.md` collapsed to a short pointer to `CLAUDE.md`/`.claude/rules/`/`.claude/skills/`
rather than staying a full duplicate — Claude Code never reads `AGENTS.md` (it reads
`CLAUDE.md`), so the duplication served only other AGENTS.md-convention tools while
costing a manual "must never diverge" sync burden on every change.

The six dead `.claude/rules/*.json` files were deleted; their intent was folded into
either root `CLAUDE.md` (the universal ones) or `roadmap-store.md` (the rest), now in
the format Claude Code actually loads.

A new CI check (`.github/workflows/ci.yml`, `pr-checklist` job) fails a PR if root
`CLAUDE.md` exceeds 220 lines, so the same unbounded-growth pattern that produced this
ADR can't silently recur.

This is a pure documentation/agent-memory restructuring: no application source, test,
or Firebase-rules change was made as part of it. Content was relocated verbatim, not
revised, specifically so this move carries zero risk of silently changing an existing
rule's meaning.

## Consequences

- Root `CLAUDE.md`'s always-loaded cost dropped from 10,510 words (852 lines) to
  roughly 2,000 words (216 lines) — about an 80% reduction in the fixed token cost of
  every Claude Code session in this repo, before any task-specific rules file loads.
- Full institutional knowledge remains discoverable, just conditionally rather than
  unconditionally loaded — verified by touching a file in each of the three scoped
  domains and confirming the matching rules file (and no other) loads.
- New risk surface: if a `paths:` entry in a rules file doesn't actually match the file
  being touched, that content silently doesn't load. Mitigated by the "Agent memory map"
  section at the top of root `CLAUDE.md`, which lists every rules file and what it
  covers — discoverable even if automatic path-matching doesn't fire for a given touch.
- The CI line-count guardrail only checks root `CLAUDE.md`; it does not (yet) cap the
  growth of the new `.claude/rules/*.md` files themselves. If one of those grows
  unboundedly the way root `CLAUDE.md` did, the same problem recurs one layer down —
  worth revisiting if `roadmap-store.md` in particular keeps growing at a similar rate,
  since it already absorbed the largest single share of the original content.
- `AGENTS.md` as a pointer-only file means any tool that strictly requires inline
  AGENTS.md content (rather than following a pointer) will not get full context from it
  going forward — accepted, since no such tool is currently in use on this project.
