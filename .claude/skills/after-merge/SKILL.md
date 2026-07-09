---
name: after-merge
description: Use right after a PR merges in this repo — covers what tracker-sync.yml already handles automatically versus the still-manual steps (Step banner text, unblocking notes).
---

# After a PR merges

Relocated from `CLAUDE.md`'s MANDATORY WORKFLOW section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`.

1. The `tracker-sync.yml` workflow automatically sets the issue's tracker status →
   `✅ Done — merged PR #N` and updates the reference table. Nothing to do here.
2. **Still manual**: update the Step banner text (the `> …` line above the table) in
   tracker issue #11 if the step's overall state changed — automation updates rows/refs
   only, not free-text banners.
3. Note in the tracker if any issue in the next Step is now unblocked as a result of this
   merge (e.g. add a note in its row's Note column, or update the Step's banner text).
