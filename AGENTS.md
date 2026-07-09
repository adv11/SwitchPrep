# Ascent — Agent Instructions

This project's canonical AI-agent rules live in **`CLAUDE.md`** at the repo root, plus
two lazily-loaded companion locations:

- **`.claude/rules/*.md`** — path-scoped conventions (roadmap/store, UI/styling,
  auth/security) that Claude Code loads only when a matching file is touched.
- **`.claude/skills/`** — step-by-step procedures (raising an issue, opening a PR,
  the responsive verification matrix) invoked on demand rather than always loaded.

This file is intentionally a pointer, not a duplicate. It previously mirrored
`CLAUDE.md` in full (~9,500 words), which had to be manually kept in sync on every
change; Claude Code itself never reads `AGENTS.md` (it reads `CLAUDE.md`), so the
duplication only served other AGENTS.md-convention tools while adding real maintenance
cost. See `docs/adr/ADR-007-agent-memory-architecture.md` (issue #86) for the full
rationale. If a tool you're using strictly requires the full content inline rather than
via a pointer, read `CLAUDE.md` and the files above directly — they are the source of
truth and are kept current; this file is not.
