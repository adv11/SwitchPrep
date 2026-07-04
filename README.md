# SwitchPrep

A prep tracker for backend engineers switching companies — Java, Spring Boot,
microservices, Kafka, Redis, system design, DSA, and GenAI/agentic AI, all in one
editable, syncable checklist.

- Sign in with email/password or start instantly as a guest.
- Progress syncs across devices via Firebase, with an offline/local fallback.
- Every topic can carry its own resource links, priority, and custom notes.
- Light and dark themes, following your system preference by default.

## Tech stack

Vanilla JavaScript over native ES modules — **no build step, no bundler, no
framework**. Firebase Authentication + Realtime Database for sync, with
`localStorage` as an offline fallback. See [`docs/architecture.md`](docs/architecture.md)
for the full data model and file layout, and [`CLAUDE.md`](CLAUDE.md) /
[`AGENTS.md`](AGENTS.md) for the conventions this codebase follows.

## Getting started

1. **Clone and install** — there are no dependencies to install; this is a static
   site.
   ```bash
   git clone <this-repo-url>
   cd SwitchPrep
   ```
2. **Set up Firebase.** Create a project at [console.firebase.google.com](https://console.firebase.google.com),
   then:
   ```bash
   cp src/services/firebase.config.example.js src/services/firebase.config.js
   ```
   Fill in `firebase.config.js` with your project's values (Project settings →
   General → Your apps). This file is gitignored — it's meant to hold your own
   credentials, never a committed value.
   - Enable **Email/Password** and **Anonymous** sign-in under Authentication.
   - Publish the Realtime Database rules from `firebase/database.rules.json`.
3. **Run it.**
   ```bash
   npm run dev
   ```
   Serves the app at `http://localhost:4173`.

## Project status

No automated test suite yet — changes are verified manually against a running
dev server. See the "Verifying changes" section of [`CLAUDE.md`](CLAUDE.md) for
the checklist to run through before committing.

## License

All rights reserved — see [`LICENSE`](LICENSE). This code is shared for viewing
only; no license to use, copy, or modify is granted without permission.
