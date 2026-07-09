---
name: start-issue
description: Use when starting work on an already-filed GitHub issue in this repo — covers updating the tracker status and branching correctly off up-to-date main.
---

# Starting work on an issue

Relocated from `CLAUDE.md`'s MANDATORY WORKFLOW section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`.

1. Fetch the live tracker body (`gh issue view 11 --json body`) and set the issue's status → `🔄 In progress`. Push with `gh issue edit 11 --body-file <file>`.
2. Branch off up-to-date main:
   ```
   git fetch origin && git checkout -b <type>/issue-<N>-slug origin/main
   ```
   Never branch off a stale local `main` or off another feature branch unless the issue is explicitly a follow-up that depends on unmerged work.
