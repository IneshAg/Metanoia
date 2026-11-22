# Tasks

## 1. V2 data foundation

- [x] 1.1 Map current V2 state, source seed, and original read-only database fields for tasks, habits, courses, lectures, notes, focus, and rewards; verify a field map records source IDs, missing data, and migration rules.
- [x] 1.2 Add idempotent V2-owned state migration for lecture records, dated activity, goals, and appearance settings; verify an existing V2 database reloads without losing edited tasks or courses.
- [x] 1.3 Import original course and lecture metadata into V2 without writing to the original database; verify stable identities, counts, known durations, and preservation of later V2 edits.
- [x] 1.4 Resolve available Notion task goal relations through a credential-safe import boundary; verify mapped goal labels on matching tasks and honest unavailable states when access fails.

## 2. Daily planning and habits

- [x] 2.1 Finish the task editor's date, estimate, start/end, category, and goal interactions; verify a 60-minute estimate calculates an end time and a saved task reopens with the same values.
- [x] 2.2 Refine Planner day/week/month calendar and task search, status, category, and order controls; verify view switches retain the selected date and filters can be cleared.
- [x] 2.3 Complete and visually verify the combined Day/Week habit panel and calendar indicators; verify checking one date changes only that date and persists after restart.
- [x] 2.4 Refine Today as a playable daily work surface with list/time views, a prominent Focus action, compact progress, several courses, and Studio entry; verify all visible actions navigate or persist correctly at laptop and desktop sizes.

## 3. Courses and daily learning

- [x] 3.1 Restore course creation and editing with useful time and continuation fields; verify a new course saves, opens, and survives restart.
- [x] 3.2 Build a readable ordered lecture view with total count, known durations, remaining known time, missing-time labels, and next-lesson selection; verify imported source counts and no invented estimates.
- [x] 3.3 Wire Continue course and lesson source controls; verify each opens an actionable lesson detail or supported source and never leaves the user on a dead button.
- [x] 3.4 Record and edit per-lecture completion with playback speed, including 1x, 1.5x, 1.75x, and 2x; verify aggregate progress and undo remain consistent after restart.
- [x] 3.5 Show daily lecture counts and known watch time in Courses and Reflect; verify a completion and reversal affect only their recorded dates without double counting.

## 4. Focus and local soundtrack

- [x] 4.1 Repair Focus start, pause, resume, finish, and save with task context; verify saved active time appears in history and metrics after app restart while paused time is excluded.
- [x] 4.2 Add file and folder selection, a legible queue and player, playback position, and play/skip/change controls; verify supported local audio plays and missing or unsupported files receive clear feedback.
- [x] 4.3 Persist likes and dislikes in V2 SQLite and use them in next-track selection; verify ratings and queue behavior after restart and when a file is unavailable.

## 5. Personal world and appearance

- [x] 5.1 Apply a coherent playful, tactile visual system with dimensional progress and task surfaces, readable typography, responsive states, and restrained motion; verify common window widths and reduced-motion behavior visually.
- [x] 5.2 Add Settings for theme, dimmer light mode, and user-selected accent colors; verify choices apply immediately and persist after restart.
- [x] 5.3 Make Studio a readable, useful destination with meaningful companion presence, and improve the small Today entry; verify entry, navigation, and interactions in the packaged app.
- [x] 5.4 Improve reward browsing and redemption feedback while keeping leisure activities available without credits; verify an affordable redemption changes the balance once and an unaffordable one does not.

## 6. Insights and notes

- [x] 6.1 Build shared metrics from saved task, focus, and lecture records with selected day/period and unit handling; verify values against known isolated V2 records and honest empty states.
- [x] 6.2 Add compact switchable metrics on Today and accessible time-trend and part-to-whole charts in Reflect; verify chart labels, values, units, keyboard access, and resizing in the Windows WebView.
- [x] 6.3 Repair recent notes listing and open actions; verify an available note opens and an unavailable destination cannot masquerade as a working action.

## 7. Integration and Windows delivery

- [x] 7.1 Exercise all primary flows against isolated V2 data and reload after each save; verify no write reaches the original Metanoia database and no credentials appear in assets or logs.
- [x] 7.2 Run the frontend build and applicable functional checks, then package and launch the Tauri Windows executable; verify the delivered file opens a desktop window and reads V2-owned local data.
- [x] 7.3 Update launch guidance and a concise feature/known-limitations note alongside the delivered package; verify the instructions work from the delivered files.

## Workflow follow-up

- After implementation and review, sync the capability deltas and archive the completed change.
