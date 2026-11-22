# local-data-and-windows Specification

## Purpose
Local data and Windows packaging keep Metanoia V2 private, durable, and launchable while preserving the original app's database and credentials.

## Requirements

### Requirement: Separate persistent workspace
The Windows app SHALL persist tasks, habits, courses, lectures, focus sessions, rewards, settings, notes, and music preferences in V2-owned local storage.

#### Scenario: Restart
- **WHEN** the user closes and reopens the Windows app
- **THEN** saved V2 data and preferences remain available

#### Scenario: Original database
- **WHEN** V2 imports data from the original Metanoia database
- **THEN** it reads a copy or reads the original without writes and does not alter the original records

### Requirement: Explicit and idempotent import
The app SHALL import available original task, course, lecture, habit, and note metadata without overwriting newer V2 user edits, and SHALL make unavailable source fields clear.

#### Scenario: Repeated startup
- **WHEN** the app starts after an earlier successful import
- **THEN** the same source records are not duplicated or reset

#### Scenario: Sensitive source
- **WHEN** Notion or file-system source data is used
- **THEN** credentials are never bundled into frontend assets or exposed through logs and imported data remains local unless the user explicitly enables sync

### Requirement: Windows delivery
The project SHALL produce a launchable Tauri Windows build and include simple launch guidance for the delivered package.

#### Scenario: Launch built app
- **WHEN** the user launches the delivered Windows executable on the supported machine
- **THEN** Metanoia V2 opens as a desktop window with its local data service available and no browser tab required

#### Scenario: Build verification
- **WHEN** a release is prepared
- **THEN** the frontend build, relevant functional checks, and packaged executable are verified against the delivered files
