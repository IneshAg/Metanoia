# Metanoia V2

A modern, private, and offline-first personal study operating system and focus environment built with **React 19**, **TypeScript**, and **Tauri v2 (Rust)**.

![Metanoia Preview](public/art/studio-day.png)

---

## 🌟 Key Features

### ⏱️ Focus V2 & Pomodoro Engine
- **Session vs. Interval Lifecycle**: Natural study tracking without cumbersome round-management UI. Metanoia automatically tracks continuous study sessions across multiple focus blocks and breaks until you choose to finish.
- **Adaptive Presets**: 25/5 Classic Pomodoro, 20/5 Adaptive Sprints (with 25m rejuvenation long breaks), 50/10 Deep Work, and custom user-defined intervals.
- **Break Management**: Early breaks preserve unspent focus time; intuitive resume, skip, and postpone controls.
- **Soundscapes & Ambient Audio**: Integrated lo-fi and nature audio player supporting local audio files with taste rating (`liked` / `disliked`).

### 🪟 Floating Desktop Timer
- **Ultra-Compact Overlay**: Always-on-top draggable mini-pill (210×56 / 140×44) that stays out of your way while studying or coding.
- **Clean Icon Controls**: One-click play/pause, break trigger, and return-to-app button.
- **Multi-Window Sync**: Communicates seamlessly between the main window and the floating overlay via Tauri window events.

### 📅 Daily Planner & Quests
- **Time-Blocked Scheduling**: Visual day planner with category tagging (`study`, `work`, `planning`, `review`).
- **Gamified Progress**: Earn XP and reward credits for completed study intervals and daily tasks. Redeem credits in the customizable reward shop.
- **Task Deletion & Safety**: Confirmation modals and automatic unlinking from active focus timers.

### 📊 Habits & Streak Tracking
- **Daily & Weekly Check-ins**: Flexible scheduling for daily, weekday, or custom recurring habits.
- **Optional Notion Sync**: Sync tasks and habit check-ins securely with your private Notion databases using local Windows DPAPI encryption (zero plain-text token exposure).

### 🎓 Learning Hub & Course Tracker
- **Local Media Integration**: Select local folders containing video/audio lectures. Metanoia scans, orders, and tracks lecture playback.
- **Productivity Metrics**: Tracks watch speed, calculated learning minutes, and completed lecture events.

### 🔒 100% Offline & Private
- **Zero Telemetry**: All data is stored locally in an embedded SQLite database (`%APPDATA%\com.metanoia.v2\metanoia-v2.sqlite3`).
- **Completely Self-Contained**: Runs without an internet connection or external servers.

---

## 🏗️ Architecture & Tech Stack

```
Metanoia V2
├── src/                    # Frontend (React 19 + TypeScript + Vite)
│   ├── App.tsx             # Root application & routing
│   ├── FloatingTimerApp.tsx # Compact floating desktop widget
│   ├── Today.tsx           # Daily dashboard & focus view
│   ├── Planner.tsx         # Time-blocked quest scheduler
│   ├── Courses.tsx         # Course & local media player
│   ├── Reflect.tsx         # Analytics & productivity metrics
│   ├── domain.ts           # Pure functional domain model & state reducers
│   ├── api.ts              # Tauri SQLite bridge & persistence layer
│   └── notionSync.ts       # Secure Notion integration client
├── src-tauri/              # Desktop Runtime (Rust + Tauri v2)
│   ├── src/lib.rs          # Native window management, file dialogs, DPAPI
│   ├── src/main.rs         # Tauri entry point
│   ├── Cargo.toml          # Rust dependencies (sqlx, window-vibrancy, etc.)
│   └── tauri.conf.json     # Multi-window & bundle configuration
├── tests/                  # Unit & Domain Test Suite (Node test runner)
│   ├── domain.test.ts      # State transition & business logic tests
│   ├── lessons.test.ts     # Media & progress tracking tests
│   ├── metrics.test.ts     # Time & analytics computation tests
│   └── migration.test.ts   # V1 -> V2 schema migration tests
└── outputs/                # Production release executables
    └── Metanoia V2.exe     # Standalone portable Windows binary
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20 or higher
- **Rust**: 1.78+ (via [rustup](https://rustup.rs/))
- **Windows**: Windows 10/11 with WebView2 Runtime (pre-installed on modern Windows)
- **C++ Build Tools**: Visual Studio Build Tools with C++ workload

### Installation
```bash
# Clone the repository
git clone https://github.com/IneshAg/Metanoia.git
cd Metanoia

# Install dependencies
npm install
```

### Running in Development
```bash
# Run web client only
npm run dev

# Run native desktop app in dev mode
npm run tauri dev
```

### Running Tests
Metanoia includes a suite of 38 unit and integration tests covering the full domain model, time calculations, and state migrations:
```bash
npm test
```

### Production Build
To generate a self-contained portable Windows `.exe`:
```bash
npm run tauri -- build --no-bundle
```
The compiled binary will be placed at:
`src-tauri/target/release/metanoia-v2.exe`

A pre-built portable binary is also provided in:
`outputs/Metanoia V2.exe`

---

## ⚙️ Configuration & Notion Sync (Optional)

Metanoia works entirely offline by default with no configuration required.

If you choose to sync with Notion:
1. Run `tools/save-notion-credential.ps1` in PowerShell to encrypt your Notion API key with Windows DPAPI.
2. In `src/notionSync.ts`, configure your Notion database IDs:
   ```typescript
   const TASKS_DB_ID = 'YOUR_TASKS_DATABASE_ID';
   const HABITS_DB_ID = 'YOUR_HABITS_DATABASE_ID';
   ```

---

## 📄 License
This project is for personal study and productivity management. All rights reserved.
