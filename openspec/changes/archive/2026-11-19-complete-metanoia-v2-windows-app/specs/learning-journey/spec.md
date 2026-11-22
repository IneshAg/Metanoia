# Spec Delta

## Purpose

The learning journey helps the user continue real courses at a comfortable pace and see lecture-level progress and time invested over each day.

## ADDED Requirements

### Requirement: Course management
The app SHALL let the user add and edit courses, including their title, source, lesson count, known lesson time, optional deadline, and continuation target.

#### Scenario: New course
- **WHEN** the user saves a valid new course
- **THEN** it appears in Courses and can be opened for progress tracking

### Requirement: Lecture detail
The app SHALL show an available course's ordered lecture list, total lecture count, individual known durations, completed state, and next lecture.

#### Scenario: Imported library
- **WHEN** a previously tracked course has lecture metadata in the original read-only source
- **THEN** the V2 copy shows those lecture titles, counts, and known durations without replacing existing V2 progress

#### Scenario: Unknown duration
- **WHEN** some lectures lack duration data
- **THEN** the app labels the missing time and does not present an invented total or remaining estimate as fact

### Requirement: Lesson continuation and completion
The app SHALL make Continue course open a useful lesson detail or playable source, and SHALL allow a user to complete or undo a specific lecture.

#### Scenario: Continue course
- **WHEN** the user activates Continue course
- **THEN** the ordered lecture list opens at the next incomplete lecture with an actionable study or open control

#### Scenario: Playback speed
- **WHEN** the user records completion of a lecture
- **THEN** they can record the speed used, including 1x, 1.5x, 1.75x, and 2x, and review or change it later

### Requirement: Daily course progress
The app SHALL record lecture completion by date and show lessons completed and known watch time for the selected day and over time.

#### Scenario: Study today
- **WHEN** the user completes a lecture today
- **THEN** the course's completed count and today's course activity update together

#### Scenario: Reversal
- **WHEN** the user undoes a completed lecture
- **THEN** aggregate and daily activity reflect the reversal without double counting
