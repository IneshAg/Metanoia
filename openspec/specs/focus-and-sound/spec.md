# focus-and-sound Specification

## Purpose
Focus and sound provide a dependable work session and a personal local soundtrack, while retaining honest time records and music preferences.

## Requirements

### Requirement: Focus session lifecycle
The app SHALL provide start, pause, resume, finish, and save actions with a clear timer, task context, and session status.

#### Scenario: Save session
- **WHEN** the user finishes and saves an active Focus session
- **THEN** it ends visibly, persists its active time, and updates the relevant daily and historical metrics

#### Scenario: Pause
- **WHEN** the user pauses and later resumes a session
- **THEN** paused time does not count toward active time

#### Scenario: Restart
- **WHEN** the Windows app restarts after a saved session
- **THEN** the session remains in history and the timer does not restart on its own

### Requirement: Local music library
The Windows app SHALL let the user select audio files or a folder, display a readable queue and player, and control playback and track changes.

#### Scenario: Add folder
- **WHEN** the user selects a folder containing supported audio files
- **THEN** the player lists playable tracks with clear empty or unsupported-file feedback

#### Scenario: Playback
- **WHEN** the user selects a track and presses Play, Next, or Previous
- **THEN** the player updates the audible track and its visible title, position, and controls

### Requirement: Persistent personalized queue
The app SHALL store each track's like or dislike in its local database and use that preference when choosing what plays next.

#### Scenario: Like or dislike
- **WHEN** the user rates a track
- **THEN** the rating persists after restart and affects subsequent queue selection

#### Scenario: Unavailable file
- **WHEN** a rated track's source file is no longer present
- **THEN** the app skips it gracefully and retains the preference record for a future re-add
