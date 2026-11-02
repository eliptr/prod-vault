# Productivity Vault

A phone-first, device-local productivity PWA. Habits, tasks and recurring tasks, projects, goals, calendar and reports. No account or backend is required.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev
```

For the production PWA (including offline support):

```sh
npm run build
npm run start
```

Open http://localhost:3000. Development mode does not register the service worker. Use a separate browser profile when switching between development and production on the same origin.

## Checks

```sh
npm run typecheck
npm test
npx playwright install chromium webkit
npm run build
npm run test:e2e
```

Browser checks run Chromium desktop, Chromium phone-sized, and WebKit desktop. Real iPhone/Android installation and operating-system behavior require a physical device; emulator tests do not establish those results.

## Vercel

Import this repository in Vercel. The included `vercel.json` uses `npm run build` and serves `out`. No environment variables, database, server functions, or credentials are needed. Use one stable production address: local records belong to the browser profile and origin, so preview URLs and custom domains have separate vaults. Hosting does not back up records. The production Vercel project is connected to GitHub; pushes to main deploy automatically.

## Data and backups

Records live in IndexedDB through Dexie, with a versioned schema. Settings → Export backup downloads a versioned JSON copy. Store it somewhere safe. Restore validates the file, previews counts and replaces all local records transactionally after confirmation. Export before restoring. JSON backups contain your personal records in readable text. Clearing site/browser storage removes local records; there is no cloud recovery. Requesting persistent storage is optional and browser-dependent.

Core workflows work offline after a successful first online load and service-worker installation. Update prompts activate a waiting worker only after editors close and pending writes finish. Updates preserve IndexedDB. Date keys remain unchanged if the configured timezone changes. Daily rollover refreshes within 30 seconds. Weeks start Monday by default; timezone defaults to Europe/Athens.

Habits support daily check-offs, daily quantities, and weekly day targets. Weekly progress counts distinct dates with positive entries, at most once per date, using the configured week start. Existing quantities remain stored unchanged and are interpreted as checked days. Weekly-linked goals also count distinct checked dates. New weekly targets are whole numbers from 1 to 7; legacy targets outside that range are retained and flagged until explicitly edited. Weekly streaks count successful weeks; the current week does not break a streak before it ends. Reports separate daily completion from weekly targets.

“Show daily until completed” keeps a single task visible on Today until its one completion, including after its due date. Weekly recurrence still creates dated occurrences. The v3 database upgrade combines unfinished legacy daily copies into one task using the earliest unfinished copy’s details and due date, preserves completed history, and retires old daily templates. Settings provides a downloadable pre-update recovery snapshot containing the original records. Export uses backup format v2; v1 imports receive the same conversion transactionally. Recovery snapshots stay local and are downloaded separately from regular backups.

Manual goals have minus/value/plus controls on Today and Goals. Linked goals expose their source habit or project tasks without overriding calculated progress. Each project on Today expands its unfinished tasks, including future and undated tasks, and has a project-prefilled Add task action. Editors and restore use a centered, keyboard-aware dialog with a scrollable body and fixed header/actions. Browser simulation verifies its bounds; native iPhone keyboard behavior still needs physical-device confirmation.

## Release checklist

- Run the checks above against the production build.
- Install from Safari on iPhone and Chrome on Android; check standalone display and safe areas.
- After the first online load, disable network and create/edit records, reload and navigate every section.
- Deploy an updated build; accept its update prompt and verify existing records survive.
- Export and restore a backup on the intended production address.

The UI starts empty. “Settings → Load sample data” is an explicit opt-in, available only for an empty vault. No analytics or third-party runtime requests are included.

## UI redesign and rollback

The compact workspace uses shared rows, discreet numeric controls, a thumb-accessible plus action, inline monthly habit heatmaps and restorable task/calendar view state. Monthly heatmaps support date selection, arrow-key movement and historical edits. Calendar lists tasks before habits. All original hash routes remain valid. No schema, backup-format or dependency changes accompany the redesign.

The working version before this redesign is tagged `pre-ui-redesign-2026-11-02` on GitHub. See [REDESIGN-CHECKLIST.md](REDESIGN-CHECKLIST.md) for preservation checks and the production rollback reference, and [DESIGN.md](DESIGN.md) for the UI system. Redeploy an earlier version to the existing production origin so the browser can continue using its local records.

The release before monthly heatmaps and weekly day counting is tagged `pre-habit-refinements-2026-11-02`. This tag restores the prior interface and quantity-based weekly calculations without requiring a database migration.
