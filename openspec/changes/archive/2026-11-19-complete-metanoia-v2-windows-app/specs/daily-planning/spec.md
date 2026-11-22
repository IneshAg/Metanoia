# Spec Delta

## Purpose

Daily planning brings tasks, scheduling, and habits into one usable view of the user's day and week, with reliable actions and clear progress.

## ADDED Requirements

### Requirement: Task entry and editing
The app SHALL let the user create, edit, complete, and reschedule tasks with clear date, time, estimate, category, and optional goal controls.

#### Scenario: Estimated end time
- **WHEN** the user chooses a start time and a 60-minute estimate without manually setting an end time
- **THEN** the form shows the end time 60 minutes later and saves that schedule

#### Scenario: Goal display
- **WHEN** an imported task has a resolvable Notion goal relation
- **THEN** the task shows that goal in its detail and relevant planning views

#### Scenario: Unsynced goal
- **WHEN** the source goal cannot be resolved
- **THEN** the app leaves the goal unset or identifies it as unavailable without inventing a name

### Requirement: Flexible planning views
The app SHALL offer day, week, and month calendar views, a day list and time view, and usable task search, status, category, and order controls.

#### Scenario: View switching
- **WHEN** the user switches from week to day
- **THEN** the selected date and its tasks remain in context

#### Scenario: Filtering
- **WHEN** the user chooses a task filter
- **THEN** only matching tasks appear and the active filter is visible and reversible

### Requirement: Day-specific habit tracking
The app SHALL show habits for the selected date, allow check-in changes, and display that date's completion in the calendar.

#### Scenario: Checking a habit
- **WHEN** the user checks a habit on a selected date
- **THEN** only that date's check-in changes and its calendar indicator updates

#### Scenario: Day and week switch
- **WHEN** the user switches the habit panel between Day and Week
- **THEN** both views remain in the same planning area and show the selected date or its week

### Requirement: Focused Today surface
Today SHALL show the current or next task, a prominent Focus action, a compact day progress summary, access to several active courses, and a Studio entry without crowding the day plan.

#### Scenario: Start from Today
- **WHEN** the user starts Focus from a task on Today
- **THEN** Focus receives the selected task and duration and the user sees a clear active state

#### Scenario: List and time views
- **WHEN** the user switches the day plan's presentation
- **THEN** the same underlying tasks appear in list or hour-by-hour form without losing edits
