# Design

## Context

See `proposal.md` for motivation and the six capability specs for behavior. The V2 source is a React 19/TypeScript/Vite frontend packaged with Tauri 2. Its own SQLite file stores app state; `src/api.ts` currently serializes most state as JSON and has a separate `music_taste` table. `src/domain.ts` handles actions. The current Courses detail supports aggregate progress but no ordered lecture view. `src/Planner.tsx` has a Day/Week habit switch in source that still needs end-to-end verification. The original database contains lecture metadata, but the V2 source is required to leave it untouched. The user's Blender-scene attachment is separate from this app work.

OpenSpec and the V2 source now share the same root under `C:/Users/inesh/Documents/Codex/2026-11-16/.../MetanoiaV2`; the change and its task status were moved there before apply.

## Goals / Non-Goals

**Goals:**
- Keep one authoritative V2 state model for actions and metrics, with a compatibility path for already-created V2 databases.
- Make every visible control have an observable result and keep calculations traceable to real records.
- Let the visual design feel more playful through composition, depth, color, and motion without reducing readability.
- Produce a tested Windows desktop deliverable.

**Non-Goals:**
- Modifying the original Metanoia app or its database.
- Rebuilding the separate Blender scene described in the first attachment.
- Mandatory cloud sync or credential storage in frontend assets.
- Exact reproduction of a Figma frame or reference image.

## Decisions

### 1. Keep V2 on Tauri and local SQLite
Continue the existing React/TypeScript/Tauri implementation. Migrate stored V2 state in place with additive, idempotent fields and tables; do not switch to WPF. Keep music ratings in SQLite rather than treating browser storage as the lasting source. A broad rewrite or new service would add migration risk without addressing the broken flows.

### 2. Import lecture metadata as a read-only snapshot
Extract the original `courses` and `videos` metadata into a V2-owned import snapshot, keyed by stable course and lecture identities. On first load, merge metadata into V2 state without replacing V2 progress. Preserve known durations and mark missing ones unknown. Existing V2 users must not lose course edits. Bundling absolute local file paths requires a separate privacy review; use a native local-file selection path for playback where possible.

### 3. Store lecture events, not only aggregate counts
Represent individual lecture completion and speed, with dated events for completion/reversal. Derive course totals, daily counts, and known watch time from these records; retain aggregate progress as a migration fallback until lecture records cover the course. This avoids double counting when a completion is undone or the app restarts.

### 4. Keep Notion access behind a native or offline import boundary
Resolve task goal relations from permitted source data without embedding a token in JavaScript, public assets, or logs. Match Notion task IDs to existing imported task IDs, copy the goal title or stable reference into V2, and show an unavailable state if it cannot be resolved. A live Notion read needs connectivity and a valid token; the app must remain useful without either.

### 5. Use one metric layer across Today and Reflect
Compute task counts, estimated work, active focus time, and course study time from saved records and a selected day or period. Today presents compact switchable views; Reflect holds detailed charts. Recharts is the leading candidate because it has React components for bar and part-to-whole charts, responsive layouts, and accessible labels, but a dependency check and Windows WebView QA must precede adoption. Hand-built SVG remains a fallback if package installation or rendering fails. The choice does not change the metric contract.

### 6. Make depth part of the work surface
Use CSS layers, perspective, overlapping cards, restrained shadows, and responsive motion on task, course, progress, and Studio elements. The recently supplied playful dashboard and soft task-board images and the user's Figma file guide mood and interaction, not pixel layout. Light mode uses less luminous surfaces; Settings controls accent palettes and motion preference. Use system reduced-motion behavior. Avoid fixed illustration sizes that obscure content.

### 7. Verify actions through persisted state
Check each primary flow by performing it, reloading the UI, and inspecting V2-owned state: habit check-in, task schedule, lecture completion/speed, focus save, music rating, reward redemption, notes, and settings. Test against isolated V2 data; never write to the original database. Build the frontend, package Tauri, launch the delivered executable, and confirm it uses local persistence.

## Risks / Trade-offs

- **Imported course progress may already differ from source** -> Merge metadata only and prefer later V2 edits and activity records.
- **Some lectures lack durations** -> Show known minutes and unknown count, never a fabricated total.
- **Notion goal data or credentials may be unavailable** -> Keep goal optional and show provenance/availability honestly.
- **Windows file paths may change** -> Keep ratings by stable local track identity where practical, skip missing files gracefully, and let users reselect a folder.
- **Charts and depth can impair performance or readability** -> Keep Today compact, use reduced motion and text summaries, and test common window sizes.
- **NSIS packaging may fail independently of the portable build** -> Verify a launchable portable executable first; only claim an installer if it builds and launches.

## Migration Plan

1. Snapshot the original database read-only, import only required metadata, and preserve the original and existing V2 state.
2. Add idempotent V2 state migration and new event records; keep rollback copies of V2 data during schema changes.
3. Implement and verify flows incrementally, then build and smoke-test the Windows deliverable.
