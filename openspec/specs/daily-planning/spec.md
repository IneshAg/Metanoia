# daily-planning Specification

## Purpose
Daily planning brings tasks, scheduling, habits, and progress into a consolidated, highly dependable, and intuitive view of the user's day, with reliable offline persistence, visible synchronization, and zero clutter.

## Requirements

### Requirement: Task entry and editing
The app SHALL let the user create, edit, complete, and reschedule tasks with clear date, time, estimate, category, and optional goal controls. Task completions SHALL record a `completedAt` ISO timestamp to credit completions to the actual day completed.

#### Scenario: Estimated end time
- **WHEN** the user chooses a start time and a 60-minute estimate without manually setting an end time
- **THEN** the form shows the end time 60 minutes later and saves that schedule

#### Scenario: Completion timestamp recording
- **WHEN** the user completes an overdue task from 5 days ago today
- **THEN** the task records `completedAt` as today's timestamp and today's metrics and weekly stats accurately reflect the completion

### Requirement: Consolidated Three-Section Today Dashboard
Today SHALL be organized into three distinct, non-competing sections:
1. **Today's plan**: prominent task list with inline Add Task, top Next Task Focus launcher, expandable Overdue Tasks drawer, Daily Planned Capacity load bar, inline Schedule a Break action, and a compact Daily Habits checklist alongside it.
2. **Continue learning**: single active course card with its next unfinished lesson and a single prominent **Resume lesson** action, with a link to the full catalog in Courses.
3. **Progress summary**: compact bottom summary combining the weekly activity mini-chart, category breakdown (Study, Coding, Personal, Leisure with true 0% fill when uncompleted), and compact metric switcher.

#### Scenario: Overdue tasks review and capacity management
- **WHEN** earlier uncompleted tasks exist before today
- **THEN** Today displays an expandable Earlier Tasks drawer showing overdue counts and minutes, with per-task "Do today", "+1d", and "Archive" buttons, plus bulk "Move all to today" and "Reschedule all" actions.
- **AND** the Daily Load bar shows planned minutes against target daily capacity (e.g. 180m / 360m) to prevent silent burnout.

### Requirement: Day-specific and Configurable Habit Management
The app SHALL provide a dedicated Habit Management modal allowing the user to add new habits, rename habits, archive old routines without destroying historical check-in records, and configure scheduled active weekdays.

#### Scenario: Habit scheduling and weekday filtering
- **WHEN** a habit is configured for weekdays (Mon-Fri)
- **THEN** it appears on weekdays and does not clutter Saturday/Sunday check-in lists.

### Requirement: Connected Focus Session and Post-Session Actions
The app SHALL preserve the associated `taskId` across all Focus entry points (Today, Planner, Focus page). Upon session completion, the app SHALL present clear post-session actions:
- Complete Linked Task (checking off the task and syncing)
- Continue Focus (starting a fresh block on the same task)
- Take a Break (scheduling a 15m rest break)
- Accurately distinguishing running, paused, and finished states.

### Requirement: Visible and Reliable Notion Synchronization
The app SHALL show real-time synchronization state in the header badge (`Saved locally` → `Syncing to Notion…` → `Synced with Notion` / `Sync Error (Retry)`). When synchronization encounters a network or API issue, failed actions SHALL be enqueued in a persistent retry queue with one-click retry. All task updates SHALL match tasks strictly by immutable `id`.

#### Scenario: Offline resiliency and retry
- **WHEN** a Notion API call fails due to offline connectivity
- **THEN** the local action succeeds instantly in SQLite, the header displays an error indicator with failed item count, and clicking the badge flushes the queue upon reconnection.

### Requirement: Database Write Serialization & Backup Recovery
Database updates SHALL be serialized via an asynchronous write queue to prevent overlapping read-modify-write race conditions. Settings SHALL provide manual JSON export ("Export Full Backup") and file restore with preview confirmation.
