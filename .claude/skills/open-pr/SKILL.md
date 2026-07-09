---
name: open-pr
description: Use right before and when opening a pull request in this repo — the four required pre-PR checks (test/lint/rebase/push) and the PR template/linking convention. tracker-sync.yml handles the tracker row automatically; this skill only covers the manual steps.
---

# Before opening a PR — all four required, no exceptions

Relocated from `CLAUDE.md`'s MANDATORY WORKFLOW section (issue #86) with no content
changes — see `docs/adr/ADR-007-agent-memory-architecture.md`.

1. `npm test` — zero failures
2. `npm run lint` — zero errors
3. `git fetch origin && git rebase origin/main` — branch must be on top of latest main
4. `git push --force-with-lease origin <branch>`

# Opening the PR

1. Follow `.github/PULL_REQUEST_TEMPLATE.md` in full: What / How / Testing / Docs updated / Screenshots / Linked issue
2. Use `Refs #N` (not `Closes #N`) when the issue spans multiple PRs; use `Closes #N` only when this PR fully resolves the issue
3. The `tracker-sync.yml` workflow **automatically** updates the tracker table row and reference table when the PR is opened or merged — no manual update needed for those two events (see the `after-merge` skill for what's still manual after merge)

Also confirm the "Docs that must ship with every code PR" table in root `CLAUDE.md` is
satisfied before opening: `CHANGELOG.md` always; `CLAUDE.md`/the relevant
`.claude/rules/*.md` file if a convention changed; `docs/architecture.md` (+ Build Log
entry) if structure/CI/data-flow/test setup changed; `docs/api.md` if a public
store/service contract changed.
