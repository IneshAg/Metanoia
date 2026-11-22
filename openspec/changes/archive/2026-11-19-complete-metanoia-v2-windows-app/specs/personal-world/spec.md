# Spec Delta

## Purpose

Metanoia's personal world gives planning a distinctive, playful desktop identity while keeping Studio, rewards, rest, and settings useful and readable.

## ADDED Requirements

### Requirement: Playful and usable interface
The app SHALL use a coherent, original visual language with tactile depth, clear hierarchy, readable text, responsive desktop layouts, and interaction states.

#### Scenario: Common window sizes
- **WHEN** the Windows app is resized to a practical laptop or large desktop window
- **THEN** primary actions, labels, and content remain visible and operable without visual overlap

#### Scenario: Dimensional content
- **WHEN** depth, illustration, or motion is used
- **THEN** it supports task, progress, learning, or Studio meaning and does not obscure controls

### Requirement: Appearance settings
The app SHALL expose Settings with light and dark modes, a less bright light theme, and user-selectable accent colors that persist.

#### Scenario: Color choice
- **WHEN** the user chooses an available accent color
- **THEN** supported UI surfaces adopt it immediately and retain it after restart

#### Scenario: Reduced motion
- **WHEN** the system requests reduced motion
- **THEN** essential information and actions remain available without nonessential animation

### Requirement: Studio and leisure
The app SHALL provide a clearly accessible Studio with meaningful companion presence, and SHALL present leisure as a normal part of the day.

#### Scenario: Enter Studio
- **WHEN** the user selects the Studio entry
- **THEN** a readable Studio view opens with its own useful interactions rather than only a small decorative link

#### Scenario: Rest activity
- **WHEN** the user adds a walk, reading, or unwind activity
- **THEN** it can be planned without requiring credits or a productivity threshold

### Requirement: Reward interaction
The app SHALL show rewards and available credits clearly, let the user inspect and redeem an affordable reward, and explain the result.

#### Scenario: Redeem
- **WHEN** the user confirms an affordable reward
- **THEN** the redemption is persisted, the balance changes once, and the result is visible

#### Scenario: Insufficient credits
- **WHEN** a reward costs more than the current balance
- **THEN** the app shows the remaining requirement without silently changing the balance
