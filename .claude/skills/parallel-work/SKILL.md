---
name: parallel-work
description: Use when the user asks to work on two or more GitHub issues at the same time in this repo (e.g. "work #X and #Y in parallel") — covers the git-worktree + parallel-agent protocol and when it's safe versus unsafe.
---

# Parallel work (running multiple issues at once)

Relocated from `CLAUDE.md`'s MANDATORY WORKFLOW section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`.

Claude Code supports working on multiple issues simultaneously using **git worktrees +
parallel agents**. Each issue gets its own worktree (isolated directory + branch), so
branches never share working files and there are no mid-work conflicts.

**When it is safe**: issues that touch different files and have no "Blocked by"
relationship in tracker #11. Check the "Blocked by / Safe to run in parallel" column
before starting.

**When it is NOT safe**: two issues that both modify the same file (e.g. both touching
`app.css` or `dashboard.js`) will produce merge conflicts — do those sequentially.

**How to invoke**: tell Claude _"work #X and #Y in parallel"_. Claude will spawn two
worktree agents in a single message. Each agent runs the full workflow independently
(lint → test → rebase → PR → tracker update) and returns its own PR.

**Each parallel agent still follows every step of the MANDATORY WORKFLOW** — lint, test,
rebase, PR template, tracker update (see the `start-issue`, `open-pr`, and `after-merge`
skills). Parallel does not mean skipping steps.
