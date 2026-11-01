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

Import this repository in Vercel. The included `vercel.json` uses `npm run build` and serves `out`. No environment variables, database, server functions, or credentials are needed. Use one stable production address: local records belong to the browser profile and origin, so preview URLs and custom domains have separate vaults. Hosting does not back up records. This repository prepares deployment; it does not publish automatically.

## Data and backups

Records live in IndexedDB through Dexie, with a versioned schema. Settings → Export backup downloads a versioned JSON copy. Store it somewhere safe. Restore validates the file, previews counts and replaces all local records transactionally after confirmation. Export before restoring. JSON backups contain your personal records in readable text. Clearing site/browser storage removes local records; there is no cloud recovery. Requesting persistent storage is optional and browser-dependent.

Core workflows work offline after a successful first online load and service-worker installation. Update prompts activate a waiting worker only after editors close and pending writes finish. Updates preserve IndexedDB. Date keys remain unchanged if the configured timezone changes. Daily rollover refreshes within 30 seconds. Weeks start Monday by default; timezone defaults to Europe/Athens.

Habits support check-offs and quantities. Historical grids open the corresponding calendar date. Habit schedule/target edits reinterpret existing history. Archive preserves records. Task recurrence materializes dated instances through the next 90 days; missed instances stay overdue. Editing an occurrence also starts any revised recurring schedule after today, retaining past/current instances. Deleting a recurring task deletes its whole series after confirmation. Project percentages exclude future recurring occurrences. Goals can use manual values, a project percentage, or a habit total in the goal period. Deleted goal sources display “Source removed.”

## Release checklist

- Run the checks above against the production build.
- Install from Safari on iPhone and Chrome on Android; check standalone display and safe areas.
- After the first online load, disable network and create/edit records, reload and navigate every section.
- Deploy an updated build; accept its update prompt and verify existing records survive.
- Export and restore a backup on the intended production address.

The UI starts empty. “Settings → Load sample data” is an explicit opt-in, available only for an empty vault. No analytics or third-party runtime requests are included.
