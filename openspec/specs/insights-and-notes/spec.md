# insights-and-notes Specification

## Purpose
Insights and notes let the user understand real progress over time and resume recent ideas without confusing missing data with zero activity.

## Requirements

### Requirement: Switchable progress metrics
The app SHALL let the user switch among completed work, planned work, focused time, and learning time where those measures are available.

#### Scenario: Metric switch
- **WHEN** the user changes the selected metric or period
- **THEN** the value, unit, chart, and explanatory label update together

#### Scenario: No history
- **WHEN** the selected period contains no recorded activity
- **THEN** the view shows an honest empty state rather than sample or fabricated progress

### Requirement: Accessible visual trends
The app SHALL place compact progress cues on Today and deeper interactive graphs in Reflect, including time trends and an appropriate part-to-whole view.

#### Scenario: Chart inspection
- **WHEN** the user inspects a chart point or segment
- **THEN** its label, value, unit, and period can be understood visually and through accessible text

### Requirement: Recent notes
The app SHALL show the user's recent imported or locally saved notes with a working open action and clear source information.

#### Scenario: Open note
- **WHEN** the user selects a recent note
- **THEN** the original note or its local detail opens, or the app explains why it is unavailable

#### Scenario: Missing source
- **WHEN** a note has no usable destination
- **THEN** the app does not offer a dead open action
