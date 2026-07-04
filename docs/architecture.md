# SwitchPrep Architecture

SwitchPrep is now structured as a small production-style frontend application rather than a single HTML file.

## Current stack

- Native ES modules for a zero-build local MVP.
- Firebase Authentication for email/password and anonymous sessions.
- Firebase Realtime Database for per-user roadmap documents.
- LocalStorage fallback for signed-out/offline progress.

## Data model

Realtime Database:

```text
users/{uid}/roadmap
  version: number
  updatedAt: number
  items: Record<itemId, RoadmapItem>
```

Each roadmap item contains:

```text
id, title, phase, section, priority, done, custom, deleted, resources[]
```

This keeps every user's edits isolated by Firebase UID. Security rules should require `auth != null && auth.uid == $uid` for both reads and writes.

## Frontend layout

```text
index.html                       # no-FOUC theme bootstrap lives inline here
src/main.js                      # boot: init theme, auth gate, hash router
src/data/roadmap.js              # seed phases, topic resources
src/services/firebase.js         # auth + realtime DB
src/services/firebase.config.js  # gitignored — your Firebase project credentials
src/services/firebase.config.example.js  # committed template, copy to the path above
src/services/roadmapStore.js
src/services/theme.js            # dark/light theme state
src/ui/pages/signIn.js
src/ui/pages/signUp.js
src/ui/pages/dashboard.js
src/ui/components/authShell.js   # shared auth-page chrome (signIn/signUp)
src/ui/components/themeToggle.js
src/ui/components/itemPanel.js
src/styles/app.css               # tokens + components, both themes
firebase/database.rules.json
```

See `CLAUDE.md` / `AGENTS.md` at the repo root for conventions AI agents working on
this project should follow (the `el()` helper contract, the store's `structuralVersion`
rendering rule, the `data-action` click-guard pattern, and the theme token system).

## Deploy checklist

1. Create a Firebase project and copy `src/services/firebase.config.example.js` to
   `src/services/firebase.config.js`, filling in that project's values (this file is
   gitignored — never commit real credentials).
2. Enable Email/Password and Anonymous auth in Firebase Console.
3. Publish Realtime Database rules from `firebase/database.rules.json`.
4. Serve static files (`python3 -m http.server 4173` locally; Firebase Hosting or any CDN in production).
5. Enable Firebase App Check before a public launch.

- Keep writes per user scoped to `users/{uid}`.
- Add Firebase App Check before public launch.
- Move public seed roadmap content to versioned static JSON or a `roadmapTemplates/{version}` node.
- Add server-side validation with Cloud Functions if sharing/community resources are introduced.
- Track analytics events without storing sensitive preparation notes.
