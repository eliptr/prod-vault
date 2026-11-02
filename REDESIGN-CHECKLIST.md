# Redesign preservation checklist

Rollback: annotated Git tag `pre-ui-redesign-2026-11-02`, commit `0dbc46b`, pushed to origin before changes. Work branch: `codex/compact-workspace-redesign`.

To restore the old source safely, create a branch from the tag rather than resetting or deleting current work:

```sh
git switch -c rollback/pre-redesign pre-ui-redesign-2026-11-02
```

The tag restores application code, not personal browser records. Export JSON before changing installed versions. Keep the same production origin when redeploying.

- [x] Shared system, responsive shell, five phone links and all hash routes
- [x] Daily/weekly habits, exact quantities, schedules, history, streaks, archive/delete
- [x] Task filters, notes, priorities, dates, subtasks, daily display, weekly recurrence, reopen
- [x] Project status, tasks, prefilled creation and calculated progress
- [x] Manual/linked goals, dates, source actions and missing-source state
- [x] Calendar selection and historical edits
- [x] Report metric definitions, exact numbers and accessible charts
- [x] Settings, themes, timezone, week start, installation, persistence, sample data
- [x] Schema/IDs/records untouched; v1/v2 restore, v2 export and recovery downloads
- [x] Offline edits, reload persistence, update lifecycle and backup reminder
- [x] Form validation, dirty close, dialog viewport/focus, keyboard and automated accessibility checks
- [x] Unit tests, typecheck, production build and Chromium/WebKit workflows
- [x] Rendered phone/tablet/desktop light/dark review
- [ ] Physical iPhone installation, operating-system keyboard and status-bar confirmation

## Verification

- Baseline: 11 unit tests, 29 browser checks passed; one WebKit service-worker lifecycle check intentionally skipped.
- Redesigned full suite: 47 passed, one intentionally skipped across Chromium desktop, Chromium phone and WebKit desktop.
- Added 200% text/landscape checks: three passed. Rechecked normal density, navigation and iPhone safe-area simulations after the text-size fix: nine passed.
- Production build and type checking passed. The database, domain functions, service-worker build script, dependency manifest and lockfile are unchanged.
- Layout fixtures cover 360, 390, 430, 768, 1280 and 1440px in light/dark themes, plus long text, offline history edits, exact goal controls, dirty-form confirmation, simulated keyboard offsets, backups, all four record editors and archive actions.
- Screenshots: ignored `test-results/redesign-*.png`, `test-results/today-controls-*.png`, and `test-results/dialog-*.png`.
- Code review used Impeccable Operate guidance, UI/UX Pro Max, React/Next.js best practices and Web Interface Guidelines. The Impeccable launcher was unavailable; guidance was read directly.

## Deployment rollback reference

The previous production deployment was `dpl_GsnySnmSvgbLvLYkLpnj3LfM7tp5`, URL `https://prod-vault-59uv7kf3g-eliptrs-projects.vercel.app`. The stable production origin is `https://prod-vault-ten.vercel.app`.

Redeploy the rollback tag in the existing Vercel project to restore the old UI at the same origin. A source rollback does not restore or erase personal IndexedDB records. Export JSON before switching versions. Vercel's platform rollback can suspend automatic production alias assignment; promoting a subsequent production deployment restores it.
