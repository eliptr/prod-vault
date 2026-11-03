# Compact daily workspace

Mode: Operate. Precision, familiarity, and consistency take priority over decoration.

System sans, fixed rem typography, tabular numbers. Primary labels 14px on phone, 13px on desktop; metadata 12px; page titles 18px. Use 4/8/12/16/24px spacing. Primary phone actions use 44px targets; discreet numeric adjustment buttons use 28px phone / 24px desktop widths. Heatmap cells have 24px targets around 10px squares. Desktop rows remain compact. Content wraps intentionally; never truncate the only way to identify a record.

Neutral warm light surfaces and charcoal dark surfaces. One muted green for action, focus, selection and progress. Semantic red for errors and overdue states. Thin separators, 4–6px radii, no shadows, decorative illustrations, gradients, or entrance choreography.

Shared record rows, section headings, summaries, meters, quantity controls, disclosures, form fields and notices. Today uses four equal sections in two desktop columns and one phone column. Five phone navigation links remain safe-area aware. A context-aware Add control is thumb reachable.

Native centered dialogs, max 440px. Header and footer fixed within the dialog; body scrolls. Respect visual viewport offsets, keyboard resizing, safe areas, focus and scroll restoration. Phone initial focus is the heading. Errors are inline and announced; dirty forms require discard confirmation.

Loading skeletons preserve structure. Empty states offer an action. Pending and successful writes have quiet live feedback. Errors retain input and explain retry. Disabled controls remain identifiable. Keyboard focus, contrast, reduced motion and 200% zoom are release checks.

No new dependencies, storage migration, domain-rule changes, remote assets or external services.

Habits use a flat monthly contribution view: weekday columns, week rows, neutral empty squares and three muted-green intensity levels. Check-off and weekly-day habits are binary; daily quantities show partial progress. Exact date values remain available through keyboard focus, labels and inline selection. Today has 8px phone gutters and 12px section gaps. The phone floating action is a single plus icon; duplicate Habits/Tasks page-header actions are desktop-only.

Habit heatmaps sit below the habit heading and controls, with weeks progressing downward. Habits page heading and month/archive toolbar have no extra margin between them.

Habits use two columns, with each current-day control directly above its heatmap and no visible Today caption. At widths below 360px the history list reflows to one column to retain 24px date targets. Today places Habits and Goals side by side on phones and desktops; Tasks and Projects share the second row, including on phones.

Habit checks share the compact helper line with weekly progress and current/best streaks; monthly weekly progress omits the “this week” suffix. Today goal source actions align with progress values and bars. Today task rows omit priority labels while preserving priority in the Tasks screen, Calendar and editors.

Goals support optional one-time check-offs using manual progress 0/1 and target 1. Existing goals remain unchanged; the optional oneTime field is retained in v2 backups without a database migration. Goal and project overviews use a compact title row and an action/progress row; numeric goal controls are 24px wide beside the target. Project task disclosures share the progress row. Routine local-save toasts are removed globally; errors and explicit backup/update feedback remain.

One-time goals use the standard checked/empty-square states, with the toggle aligned to the title and a compact deadline below; no type caption. Touch input has no hover/pressed background highlights, while mouse hover and keyboard focus remain available. Routine pending writes are silent; pending state still protects updates and restores.
