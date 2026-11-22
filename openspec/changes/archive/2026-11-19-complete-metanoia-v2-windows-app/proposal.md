# Proposal

## Why

Metanoia V2 runs as a Windows app, but key flows remain incomplete or difficult to use: daily habits, course lessons, focus history, music, task planning, notes, and progress views. The current presentation also lacks the playful, tactile identity the user described, and the unfinished work needs a durable record across Codex chats.

## What Changes

- Complete the React/TypeScript/Tauri V2 Windows experience, preserving its separate local SQLite state and the original Metanoia data.
- Redesign Today, Planner, and task creation around a legible, playful daily work surface with useful depth, clear controls, and user-selected light-mode colors. Use the supplied Figma and image references for direction without copying them.
- Put daily and weekly habit check-ins together with a switch, and show day-specific completion in the calendar.
- Restore the full course journey: add/edit courses, actual lecture lists and counts, known durations and remaining time, playback-speed check-ins, daily study progress, and working continuation.
- Make Focus sessions, local folder/file music playback, saved likes/dislikes, notes, settings, rewards, Studio entry, and progress metrics operate end to end.
- Show task goals from Notion when available, with an explicit mapping and honest handling of unavailable source data; do not ship credentials.
- Add meaningful switchable metrics and accessible charts in the appropriate views, with no fabricated activity or estimates.
- Verify the Windows build and deliver a launchable V2 package.

## Capabilities

### New Capabilities

- `daily-planning`: Today, Planner, task creation, scheduling, filters, and daily/weekly habit views.
- `learning-journey`: Course and lecture management, progress, speeds, and daily learning history.
- `focus-and-sound`: Focus session lifecycle, history, and personalized local music playback.
- `personal-world`: Studio, rewards, leisure, themes, colors, settings, and the app's visual behavior.
- `insights-and-notes`: Real progress metrics, charts, notes, and navigation to source records.
- `local-data-and-windows`: Separate SQLite persistence, safe import/sync boundaries, and Windows packaging.

### Modified Capabilities

None; this OpenSpec root has no existing capability specs.

## Impact

The target implementation and OpenSpec root are `C:/Users/inesh/Documents/Codex/2026-11-16/metanoia-blender-mcp-scene-refinement-blender/outputs/MetanoiaV2`, especially `src/`, `tools/`, `public/`, and `src-tauri/`. The earlier Blender-scene brief is separate work and is not included in this app change.
