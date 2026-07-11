# ADR-009: Progress analytics data model — completedAt vs. a separate activityLog

**Date**: 2026-07-11
**Status**: Active
**Deciders**: solo project — adv01
**Issue**: #8 (part 1 — data layer)

## Context

Issue #8 adds a Progress page (heatmap, streaks, velocity, phase/priority breakdowns, a
projected-completion estimate, and a social share card). Every one of those needs a
day-by-day history of how many items were completed — the app had no such history before
this issue. `item.completedAt` (issue #18, already shipped as an explicit prerequisite)
records the single most recent completion timestamp per item, but it is **not** a
day-by-day activity history on its own: it's cleared to `null` the instant an item is
unchecked, so a day's real completion count would disappear the moment anything from
that day is later un-toggled — an ordinary, expected action (fixing a mistaken check, or
deliberately reopening a topic to revisit it), not an edge case to design around.

Separately, `activityLog` — a brand-new store — only starts recording from the moment
this feature ships. Anyone with months of prior roadmap progress has real completion
history sitting in `completedAt`/`updatedAt` that predates `activityLog`'s existence
entirely. A heatmap that ignores this would show a hard, confusing cliff: empty for
every day before the feature shipped, populated only after.

## Options considered

| Option | Why not chosen (or chosen) |
|---|---|
| 1. Use `item.completedAt` alone, no separate log | Loses a day's history the moment any item from that day is unchecked — the exact case a heatmap/streak feature most needs to be robust against, since "I unchecked something to redo it" is common, not rare |
| 2. A full immutable event log (one row per completion/uncompletion event, timestamped) | Correct and most flexible, but real overkill for what this feature needs (daily counts, not a full audit trail) — more storage, more sync surface, no current consumer for per-event granularity |
| 3. A separate `activityLog` day→count map, append-only for past days, plus keep `completedAt` for its existing per-item purposes | **Chosen** — see below |

## Decision

**Option 3.** `activityLogStore.js` (`src/services/activityLogStore.js`) is a fourth
store, same pattern as `dailyTodoStore.js`: a flat `{ [YYYY-MM-DD]: count }` map, synced
to `users/{uid}/activityLog`, local-first with a debounced Firebase flush. Only the
*current* day is ever written — a completed-then-later-unchecked item still leaves its
completion day's count intact, because the decrement/increment pair that produced it
already happened on that same day, at the time it happened; the log is never rewritten
after the fact for a day that's already passed.

`roadmapStore.createRoadmapStore()` gained an optional `onCompletionToggle(delta)`
constructor hook (default no-op) rather than importing `activityLogStore.js` directly —
this keeps `roadmapStore.js` free of any dependency on the analytics feature and fully
testable with zero args, exactly as every existing call site and test already does.
`main.js` is the one place that wires the two stores together. The hook fires exactly
once per genuine `done` transition, from `updateItem()` and from all three branches of
`setItemDoneInTemplate()` — never from `addItem()`/`importBackupItems()`, which seed
`done`/`completedAt` without representing a live user action "just now."

**Backfill for pre-existing history**: `analyticsEngine.js`'s `buildEffectiveActivityLog()`
merges a log derived from every item's `effectiveCompletedAt` underneath the real
`activityLog`, computed at read time only — never written back to either store. The real
`activityLog` always wins for any day it has an explicit entry for (including an explicit
`0`, e.g. a same-day check-then-uncheck), so a completion that's since been unchecked is
never double-counted or resurrected by the backfill; only a day the real log has no entry
for at all (in practice, only days before this feature existed) falls back to the
items-derived count.

## Consequences

- Two fields now describe "when was this completed," and they answer different
  questions: `item.completedAt` answers "is *this specific item* currently done, and
  when," `activityLog` answers "how much did I get done, in total, on *this day*,"
  robust to items later being unchecked. Do not conflate them, and do not remove either
  one to "simplify" — see `.claude/rules/roadmap-store.md`'s `activityLogStore.js`
  section for the exact wiring.
- `analyticsEngine.js`'s pure functions (`computeStreaks`/`computeVelocity`/
  `computeHeatmap`/`computeProjection`) all operate on the *merged* effective log, not
  raw `activityLog` — always go through `computeAnalytics()` or
  `buildEffectiveActivityLog()` rather than reading `activityLogStore`'s snapshot
  directly for anything date-based, or the backfill silently stops applying.
- Any future call site that flips `done` without going through `updateItem()`/
  `setItemDoneInTemplate()` must call `onCompletionToggle` itself, or its completions
  will be invisible to the heatmap/streak/velocity/projection — nothing enforces this
  automatically.
- `activityLog` entries older than 365 days are pruned on load (a rolling window is
  enough for a 52-week heatmap and every streak/velocity calculation, which never look
  further back than a year) — pruning forces the store `dirty` so the trim actually
  propagates to Firebase, not just the in-memory snapshot.
