# Change: Consolidated Dashboard, Notion Sync Reliability & Habit Management

## Date
2026-11-19

## Summary
- **Notion Sync Visibility & Reliability**: Replaced static "Happy & Offline" with dynamic `sync-status-pill` (`Saved locally` → `Syncing to Notion…` → `Synced with Notion` / `Sync Error (Retry)`). Implemented persistent failed sync retry queue with manual and automated flush. Corrected task matching to use immutable `t.id === savedTask.id`. Serialized database writes in `api.ts` with a promise write queue to eliminate background overwrite races.
- **Accurate Progress Metrics**: Added `completedAt` timestamp to tasks upon completion, ensuring completed overdue tasks credit the actual day finished in weekly and daily stats. Removed artificial 10% minimum category bar fill so uncompleted categories correctly render at 0%.
- **Today Dashboard Consolidation (3 Clean Sections)**:
  1. *Section 1: Today's Plan* - Prominent task list with inline quick task input, top Next Task Focus launcher, expandable Overdue Tasks drawer (with Do today, +1d, Archive, and bulk actions), Daily Capacity planned load meter, inline Schedule a Break button, and compact Daily Habits checklist.
  2. *Section 2: Continue Learning* - Single active course card with its next unfinished lesson and a prominent Resume Lesson button.
  3. *Section 3: Progress Summary* - Bottom deck combining weekly activity mini-chart, category breakdown pills, and metric switcher.
- **Connected Focus Experience**: Preserved task association (`taskId`) across all Focus entry points. Added post-session completion flow (Complete linked task, Continue focus, Take a break).
- **Dedicated Habit Management**: Added `HabitModal` supporting habit creation, renaming, archiving (preserving history), and active weekday scheduling.
- **Backup & Recovery Controls**: Added Full JSON Backup Export and Restore with preview confirmation in Settings.
- **UI & Filter Polish**: Replaced unstyled native dropdowns with dark-theme pill selects, standardized terminology to "Tasks", and polished clickable course cards and local folder imports.
