# V2 data import map

The original `../Metanoia/Data/progress.sqlite3` is read only. V2 owns `metanoia-v2.sqlite3` in its Tauri app data directory; the browser preview owns `data/prototype.sqlite3`. The bundled `public/initial-state.json` and `data/seed.json` are snapshots, not live sync.

| V2 record | Existing seed | Original source | Identity and merge rule |
| --- | --- | --- | --- |
| Task | 291 `tasks` | 291 `metanoia_tasks` | Seed `task-<id>` maps to original numeric `id`; original `remote_id` can locate a Notion task. Keep a V2 task if it was edited later. |
| Schedule | Task `day/start/end/minutes` | `metanoia_tasks.due_day`; `metanoia_task_calendar` currently empty | Preserve V2 scheduling; missing original time is unknown. |
| Goal | No seed field | `metanoia_goals`, `metanoia_task_notion_goals`, `metanoia_task_options` currently empty | Resolve a Notion relation only through a safe import; leave absent if unavailable. Never invent a title. |
| Habit | Five dated `habits` records | Audited Notion data in `data/notion-habits-audit.json` | Merge by day and habit name; preserve V2 check-ins, never treat uninspected dates as complete history. |
| Course | Six `courses` | Six `courses` | Stable original course ID, preserving V2 edits to title, deadline, or progress. |
| Lecture | Not yet represented | 614 `videos`; 355 `local_videos` rows | Stable `(course, video, occurrence)` identity; order by `position`; import title, duration, completion and checkpoint metadata without overwriting later V2 activity. Absolute local paths need native selection rather than a public bundle. |
| Focus | One `sessions` record | One `metanoia_focus_sessions` row | Keep V2 session ID and active seconds; new records use a distinct V2 ID. Source `started_utc` is the period anchor. |
| Reward | Four `rewards`, no redemptions | Four `metanoia_rewards` | Stable reward ID; V2 credits and redemption IDs are authoritative after import. |
| Note | Ten `notes` | Audited Notion metadata in `data/notion-notes-audit.json` | Stable Notion page ID; use source URL only when valid and available. Existing audit is partial. |
| Music taste | SQLite `music_taste` table | No original source | Track key, rating +1 or -1; never put lasting preferences only in browser storage on Windows. |
| Appearance | Browser local storage today | No original source | Migrate theme, palette, motion, and default Focus duration into V2-owned state without resetting user choices. |

Import is idempotent: later V2 edits and dated events win over seed metadata. Missing duration, goal, or historical activity remains unknown rather than becoming a fabricated estimate or zero-progress claim. Credentials never enter frontend assets or logs.
