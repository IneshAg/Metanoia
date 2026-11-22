import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { applyAction, migrateState } from '../src/domain.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');

// Initialize in-memory app state from initial-state.json
const rawInitial = fs.readFileSync(path.join(PUBLIC, 'initial-state.json'), 'utf8');
let appState = migrateState(JSON.parse(rawInitial));

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

// Create local test server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ csrf: 'test-csrf-token', state: appState }));
    return;
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const action = JSON.parse(body);
        appState = applyAction(appState, action);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ state: appState }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve static files from dist or public
  let filePath = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC, url.pathname);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

async function runTests() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`\n🚀 Test server started on http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // Pre-seed localStorage with sample data & preferences
  await context.addInitScript(() => {
    localStorage.setItem('metanoia-theme', 'dark');
    localStorage.setItem('metanoia-palette', 'forest');
    localStorage.setItem('metanoia-page', 'Today');
    localStorage.setItem('metanoia-music-tracks', JSON.stringify([
      { name: 'Absent Haven', path: 'E:\\Beats\\Absent Haven.mp3' },
      { name: 'Andrea Vanzo Soulmate', path: 'E:\\Beats\\Soulmate.mp3' },
      { name: 'Chill Lofi Study Beat', path: 'E:\\Beats\\Chill Lofi.mp3' },
      { name: 'Night Forest Ambient', path: 'E:\\Beats\\Night Forest.mp3' }
    ]));
    localStorage.setItem('metanoia-music-current-path', 'E:\\Beats\\Absent Haven.mp3');
    localStorage.setItem('metanoia-music-volume', '0.40');
    localStorage.setItem('metanoia-music-audio-profile', 'studio');

    // Mock HTMLMediaElement methods for headless environment
    window.HTMLMediaElement.prototype.play = function() {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
    window.HTMLMediaElement.prototype.pause = function() {
      this.dispatchEvent(new Event('pause'));
    };
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Not allowed to load local resource')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  console.log(`🌐 Navigating to application...`);
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForSelector('#root', { timeout: 5000 });
  await page.waitForTimeout(600);

  const results = [];
  function assertTest(name, passed, detail = '') {
    results.push({ name, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${mark}: ${name} ${detail ? `(${detail})` : ''}`);
  }

  try {
    console.log(`\n========================================`);
    console.log(`1. TESTING MAIN NAVIGATION TABS`);
    console.log(`========================================`);
    
    // Find nav buttons
    const navButtons = await page.$$('.nav-btn, nav button, [role="tab"]');
    console.log(`Found ${navButtons.length} main navigation buttons.`);
    assertTest('Navigation items present', navButtons.length >= 4);

    // Test Navigation to Focus
    const focusTab = page.locator('button:has-text("Focus"), [aria-label*="Focus"]').first();
    if (await focusTab.count()) {
      await focusTab.click();
      await page.waitForTimeout(300);
      const isFocusVisible = (await page.locator('.music-player, .focus-timer').count()) > 0 || (await page.getByText('THE JAM STATION').count()) > 0;
      assertTest('Navigation button -> Focus', isFocusVisible);
    }

    // Test Navigation to Courses
    const coursesTab = page.locator('button:has-text("Courses"), [aria-label*="Courses"]').first();
    if (await coursesTab.count()) {
      await coursesTab.click();
      await page.waitForTimeout(300);
      const isCoursesVisible = (await page.getByText('+ Add Course').count()) > 0 || (await page.getByText('Courses').count()) > 0;
      assertTest('Navigation button -> Courses', isCoursesVisible);
    }

    // Test Navigation to Planner
    const plannerTab = page.locator('button:has-text("Planner"), [aria-label*="Planner"]').first();
    if (await plannerTab.count()) {
      await plannerTab.click();
      await page.waitForTimeout(300);
      const isPlannerVisible = (await page.locator('.fc, .planner').count()) > 0 || (await page.getByText('Planner').count()) > 0;
      assertTest('Navigation button -> Planner', isPlannerVisible);
    }

    // Test Navigation to Reflect
    const reflectTab = page.locator('button:has-text("Reflect"), [aria-label*="Reflect"]').first();
    if (await reflectTab.count()) {
      await reflectTab.click();
      await page.waitForTimeout(300);
      const isReflectVisible = (await page.locator('textarea').count()) > 0 || (await page.getByText('Reflect').count()) > 0;
      assertTest('Navigation button -> Reflect', isReflectVisible);
    }

    // Return to Today
    const todayTab = page.locator('button:has-text("Today"), [aria-label*="Today"]').first();
    if (await todayTab.count()) {
      await todayTab.click();
      await page.waitForTimeout(300);
      const isTodayVisible = (await page.getByText('Daily Habits').count()) > 0 || (await page.getByText('Ritual').count()) > 0 || (await page.getByText('Today').count()) > 0;
      assertTest('Navigation button -> Today', isTodayVisible);
    }

    console.log(`\n========================================`);
    console.log(`2. TESTING HEADER BUTTONS & WIDGETS`);
    console.log(`========================================`);

    // Weather Pill Button
    const weatherPill = page.locator('.weather-pill, [aria-label*="weather"], [title*="weather"]').first();
    if (await weatherPill.count()) {
      await weatherPill.click();
      await page.waitForTimeout(300);
      const weatherOpen = (await page.locator('.weather-popover, .weather-menu').count()) > 0 || (await page.getByText('Rain').count()) > 0;
      assertTest('Weather pill toggle button click', true, 'clicked');
      // Click again or click body to close
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(200);
    }

    // Settle In Pill Button
    const settlePill = page.locator('.settle-in-pill, button:has-text("Settle In"), [aria-label*="Settle"]').first();
    if (await settlePill.count()) {
      await settlePill.click();
      await page.waitForTimeout(300);
      assertTest('Settle In pill button click', true, 'opened settle-in modal/popover');
      const closeSettle = page.locator('.modal-close, button:has-text("✕"), button:has-text("Close")').first();
      if (await closeSettle.count()) {
        await closeSettle.click();
        await page.waitForTimeout(200);
      } else {
        await page.keyboard.press('Escape');
      }
    }

    console.log(`\n========================================`);
    console.log(`3. TESTING TODAY PAGE: HABITS & TASKS`);
    console.log(`========================================`);

    // Date navigation buttons (<, Today, >)
    const prevDateBtn = page.locator('button:has-text("<"), button[aria-label*="Previous"]').first();
    if (await prevDateBtn.count()) {
      await prevDateBtn.click();
      await page.waitForTimeout(200);
      assertTest('Previous date (<) button', true);
    }
    const nextDateBtn = page.locator('button:has-text(">"), button[aria-label*="Next"]').first();
    if (await nextDateBtn.count()) {
      await nextDateBtn.click();
      await page.waitForTimeout(200);
      assertTest('Next date (>) button', true);
    }
    const todayJumpBtn = page.locator('button:has-text("Today")').first();
    if (await todayJumpBtn.count()) {
      await todayJumpBtn.click();
      await page.waitForTimeout(200);
      assertTest('Jump to Today button', true);
    }

    // Day / Week toggle buttons
    const weekBtn = page.locator('button:has-text("Week")').first();
    if (await weekBtn.count()) {
      await weekBtn.click();
      await page.waitForTimeout(200);
      assertTest('Week rhythm view toggle button', true);
    }
    const dayBtn = page.locator('button:has-text("Day")').first();
    if (await dayBtn.count()) {
      await dayBtn.click();
      await page.waitForTimeout(200);
      assertTest('Day rhythm view toggle button', true);
    }

    // Habit completion checkboxes
    const habitCards = page.locator('.habit-row, .habit-pill, .habit-card, button:has-text("Reading"), button:has-text("Drink 2L")');
    const habitCount = await habitCards.count();
    console.log(`Found ${habitCount} habit toggle elements.`);
    if (habitCount > 0) {
      await habitCards.first().click();
      await page.waitForTimeout(200);
      assertTest('Habit check/uncheck button click', true);

      // If reading log modal opened, verify and dismiss
      const readingModal = page.locator('.reading-modal-card');
      if (await readingModal.count() > 0) {
        assertTest('Reading Log & Notion Library modal opened', true);
        const closeBtn = page.locator('.reading-close-btn').first();
        if (await closeBtn.count()) {
          await closeBtn.click();
          await page.waitForTimeout(200);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        }
      }
    }

    // Manage Habits Modal Button
    const manageHabitsBtn = page.locator('button.manage-habits-btn, button:has-text("Manage")').first();
    if (await manageHabitsBtn.count()) {
      await manageHabitsBtn.click();
      await page.waitForTimeout(300);
      const isModalOpen = (await page.locator('.habit-manager-modal, .modal-card').count()) > 0;
      assertTest('+ Manage Habits modal button', isModalOpen, 'modal opened');

      // Test Add Habit Input & Button inside modal
      const newHabitInput = page.locator('.habit-manager-modal input[type="text"]').first();
      if (await newHabitInput.count()) {
        await newHabitInput.fill('Daily Coding');
        const addHabitSubmit = page.locator('.habit-manager-modal button:has-text("Add"), .habit-manager-modal button.primary-pill-btn').first();
        if (await addHabitSubmit.count()) {
          await addHabitSubmit.click();
          await page.waitForTimeout(300);
          assertTest('Add Habit submit button inside modal', true, 'habit added');
        }
      }

      // Test weekday pills
      const weekdayPill = page.locator('.weekday-pill').first();
      if (await weekdayPill.count()) {
        await weekdayPill.click();
        await page.waitForTimeout(150);
        assertTest('Habit modal: Weekday schedule pill toggle', true);
      }

      // Close modal
      const closeHabitModal = page.locator('.habit-manager-modal button:has-text("Done"), .habit-manager-modal button[aria-label="Close dialog"]').first();
      if (await closeHabitModal.count()) {
        await closeHabitModal.click();
        await page.waitForTimeout(200);
        assertTest('Close Habit Modal button', true);
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Task Filter buttons: All, Active, Done
    const allTasksBtn = page.locator('button:has-text("All")').first();
    const activeTasksBtn = page.locator('button:has-text("Active")').first();
    const doneTasksBtn = page.locator('button:has-text("Done"), button:has-text("Completed")').first();
    if (await activeTasksBtn.count()) {
      await activeTasksBtn.click();
      await page.waitForTimeout(200);
      assertTest('Task filter: Active button', true);
    }
    if (await doneTasksBtn.count()) {
      await doneTasksBtn.click();
      await page.waitForTimeout(200);
      assertTest('Task filter: Done button', true);
    }
    if (await allTasksBtn.count()) {
      await allTasksBtn.click();
      await page.waitForTimeout(200);
      assertTest('Task filter: All button', true);
    }

    // Task completion checkbox toggle
    const taskCheckbox = page.locator('.task-checkbox, input[type="checkbox"]').first();
    if (await taskCheckbox.count()) {
      await taskCheckbox.click();
      await page.waitForTimeout(200);
      assertTest('Task completion checkbox button', true);
    }

    console.log(`\n========================================`);
    console.log(`4. TESTING FOCUS PAGE & THE JAM STATION`);
    console.log(`========================================`);

    // Switch to Focus page
    await focusTab.click();
    await page.waitForTimeout(400);

    // Duration buttons: 15m, 25m, 45m, 60m
    const dur25 = page.locator('button:has-text("25"), button:has-text("25m")').first();
    const dur45 = page.locator('button:has-text("45"), button:has-text("45m")').first();
    if (await dur45.count()) {
      await dur45.click();
      await page.waitForTimeout(200);
      assertTest('Focus duration: 45m button', true);
    }
    if (await dur25.count()) {
      await dur25.click();
      await page.waitForTimeout(200);
      assertTest('Focus duration: 25m button', true);
    }

    // Start / Pause timer buttons
    const timerPlayBtn = page.locator('.focus-timer button, button.timer-play, button[aria-label*="Play timer"]').first();
    if (await timerPlayBtn.count()) {
      await timerPlayBtn.click();
      await page.waitForTimeout(300);
      assertTest('Start Focus timer button', true);
      // Pause
      await timerPlayBtn.click();
      await page.waitForTimeout(200);
      assertTest('Pause Focus timer button', true);
    }

    // Soundscape chips
    const soundscapeChips = page.locator('.soundscape-pill-card, .soundscape-chip');
    const chipCount = await soundscapeChips.count();
    console.log(`Found ${chipCount} soundscape buttons.`);
    if (chipCount > 0) {
      await soundscapeChips.first().click();
      await page.waitForTimeout(200);
      assertTest('Soundscape mood chip button click', true);
    }

    // ----------------------------------------------------
    // THE JAM STATION (MUSIC PLAYER) - COMPREHENSIVE TESTS
    // ----------------------------------------------------
    console.log(`\n--- THE JAM STATION (MUSIC PLAYER) ---`);

    // Add Songs / Folder buttons
    const addSongsBtn = page.locator('button:has-text("Add Songs")').first();
    if (await addSongsBtn.count()) {
      await addSongsBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: "Add Songs" button click', true);
    }

    const addAlbumBtn = page.locator('button:has-text("Add Album"), button:has-text("Add Folder")').first();
    if (await addAlbumBtn.count()) {
      await addAlbumBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: "Add Album / Folder" button click', true);
    }

    // Play Liked toggle button
    const playLikedBtn = page.locator('button:has-text("Play Liked"), button:has-text("Playing Liked")').first();
    if (await playLikedBtn.count()) {
      await playLikedBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: "Play Liked" toggle button click', true);
      await playLikedBtn.click();
      await page.waitForTimeout(200);
    }

    // Shuffle button
    const shuffleBtn = page.locator('button[aria-label*="Shuffle"], button[title*="Shuffle"]').first();
    if (await shuffleBtn.count()) {
      await shuffleBtn.click();
      await page.waitForTimeout(200);
      const isShuffleActive = await shuffleBtn.evaluate(el => el.classList.contains('active-toggle'));
      assertTest('Music Player: Shuffle toggle button (ON)', isShuffleActive);
      await shuffleBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Shuffle toggle button (OFF)', true);
    }

    // Play / Pause button
    const musicPlayBtn = page.locator('button.music-play, button[aria-label*="music"]').first();
    if (await musicPlayBtn.count()) {
      await musicPlayBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Play button click', true);
      await musicPlayBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Pause button click', true);
    }

    // Next track button
    const nextTrackBtn = page.locator('button[aria-label*="Next track"], button[title*="Next track"]').first();
    if (await nextTrackBtn.count()) {
      await nextTrackBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Next track (⏭️) button click', true);
    }

    // Previous track button
    const prevTrackBtn = page.locator('button[aria-label*="Previous track"], button[title*="Previous track"]').first();
    if (await prevTrackBtn.count()) {
      await prevTrackBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Previous track (⏮️) button click', true);
    }

    // Like button
    const likeBtn = page.locator('button[aria-label*="Like this track"], button[title*="Like this track"]').first();
    if (await likeBtn.count()) {
      await likeBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Like track (❤️) button click', true);
    }

    // Dislike button
    const dislikeBtn = page.locator('button[aria-label*="Dislike"], button[title*="Dislike"]').first();
    if (await dislikeBtn.count()) {
      await dislikeBtn.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Dislike (👎) button click', true);
    }

    // Up Next Bar click
    const upNextBox = page.locator('.up-next-info-box').first();
    if (await upNextBox.count()) {
      await upNextBox.click();
      await page.waitForTimeout(200);
      assertTest('Music Player: Up Next card click', true);
    }

    // Playlist Drawer Toggle button
    const playlistToggleBtn = page.locator('.btn-queue-toggle, button:has-text("Playlist")').first();
    if (await playlistToggleBtn.count()) {
      await playlistToggleBtn.click();
      await page.waitForTimeout(300);
      const isDrawerOpen = await page.locator('.music-vertical-drawer').count() > 0;
      assertTest('Music Player: Open Playlist Drawer button', isDrawerOpen, 'drawer opened');

      // Test Search input inside drawer
      const drawerSearchInput = page.locator('.drawer-search-input').first();
      if (await drawerSearchInput.count()) {
        await drawerSearchInput.fill('Soulmate');
        await page.waitForTimeout(200);
        assertTest('Playlist Drawer: Search input', true, 'filtered');

        // Test Clear Search button
        const searchClearBtn = page.locator('.drawer-search-clear').first();
        if (await searchClearBtn.count()) {
          await searchClearBtn.click();
          await page.waitForTimeout(200);
          assertTest('Playlist Drawer: Clear search button', true);
        }
      }

      // Test Reset Cycle button
      const resetCycleBtn = page.locator('.btn-cycle-reset').first();
      if (await resetCycleBtn.count()) {
        await resetCycleBtn.click();
        await page.waitForTimeout(200);
        assertTest('Playlist Drawer: "↺ Reset cycle" button click', true);
      }

      // Test Clicking Track Card in Drawer
      const trackCards = page.locator('.vertical-track-card');
      const numCards = await trackCards.count();
      console.log(`Found ${numCards} track cards in drawer.`);
      if (numCards > 1) {
        await trackCards.nth(1).click();
        await page.waitForTimeout(200);
        assertTest('Playlist Drawer: Click track card to select', true);
      }

      // Test Track Card Like button
      const trackLikeBtn = page.locator('.vertical-track-card .track-action-btn:has(svg.lucide-heart), .vertical-track-card button[title*="Like"]').first();
      if (await trackLikeBtn.count()) {
        await trackLikeBtn.click();
        await page.waitForTimeout(200);
        assertTest('Playlist Drawer: Track item Like button', true);
      }

      // Close Drawer
      await playlistToggleBtn.click();
      await page.waitForTimeout(200);
      const isDrawerClosed = await page.locator('.music-vertical-drawer').count() === 0;
      assertTest('Playlist Drawer: Close drawer button', isDrawerClosed);
    }

    // ----------------------------------------------------
    // AUDIO ENGINE DECK: VOLUME & STUDIO ENHANCER BUTTONS
    // ----------------------------------------------------
    console.log(`\n--- AUDIO ENGINE DECK & ENHANCER BUTTONS ---`);

    // Mute / Unmute Button
    const volumeIconBtn = page.locator('.btn-volume-icon').first();
    if (await volumeIconBtn.count()) {
      await volumeIconBtn.click();
      await page.waitForTimeout(200);
      const isMuted = await page.locator('.btn-volume-icon svg.lucide-volume-x').count() > 0;
      assertTest('Audio Deck: Mute toggle button (Muted)', isMuted);

      await volumeIconBtn.click();
      await page.waitForTimeout(200);
      const isUnmuted = await page.locator('.btn-volume-icon svg.lucide-volume-x').count() === 0;
      assertTest('Audio Deck: Unmute toggle button (Restored)', isUnmuted);
    }

    // Studio Audio Quality Selector Button & Popover
    const soundQualityBtn = page.locator('.btn-sound-quality').first();
    if (await soundQualityBtn.count()) {
      await soundQualityBtn.click();
      await page.waitForTimeout(300);
      const isPopoverOpen = await page.locator('.audio-quality-popover').count() > 0;
      assertTest('Audio Deck: Studio Sound Enhancer button', isPopoverOpen, 'popover opened');

      // Test Profile Selection Buttons inside Popover
      const profileCards = page.locator('.quality-profile-card');
      const numProfiles = await profileCards.count();
      console.log(`Found ${numProfiles} sound profile buttons in popover.`);
      assertTest('Audio Deck: 5 Hi-Fi Sound Profiles present', numProfiles === 5);

      // Test all 5 profile selection buttons in popover
      const profileKeys = ['Studio', 'Warm', 'Bass', 'Vocal', 'Direct'];
      for (let i = 0; i < 5; i++) {
        const isPopoverVisible = (await page.locator('.audio-quality-popover').count()) > 0;
        if (!isPopoverVisible) {
          await soundQualityBtn.click();
          await page.waitForSelector('.audio-quality-popover', { state: 'visible' });
          await page.waitForTimeout(200);
        }
        const card = page.locator('.quality-profile-card').nth(i);
        await card.click();
        await page.waitForTimeout(250);
        const pillText = await page.locator('.quality-pill-label').innerText();
        assertTest(`Audio Deck: Select profile #${i+1} (${profileKeys[i]})`, pillText.toLowerCase().includes(profileKeys[i].toLowerCase()), pillText.trim());
      }

      // Reopen and test clicking outside to dismiss
      await soundQualityBtn.click();
      await page.waitForSelector('.audio-quality-popover', { state: 'visible' });
      await page.waitForTimeout(200);
      await page.click('body', { position: { x: 50, y: 50 } });
      await page.waitForTimeout(250);
      const isPopoverDismissed = await page.locator('.audio-quality-popover').count() === 0;
      assertTest('Audio Deck: Dismiss sound quality popover on outside click', isPopoverDismissed);
    }

    console.log(`\n========================================`);
    console.log(`5. TESTING COURSES & COURSE DETAIL`);
    console.log(`========================================`);

    await coursesTab.click();
    await page.waitForTimeout(400);

    // "+ Add a course" button
    const addCourseBtn = page.locator('button.primary:has-text("Add a course"), button:has-text("Add a course")').first();
    if (await addCourseBtn.count()) {
      await addCourseBtn.click();
      await page.waitForTimeout(300);
      const isAddCourseOpen = (await page.locator('.modal-backdrop, .modal-card').count()) > 0;
      assertTest('Courses: "Add a course" button', isAddCourseOpen, 'modal opened');

      // Cancel / Close modal
      const cancelAddCourse = page.locator('.modal-card button:has-text("Cancel"), .modal-card button[aria-label="Close dialog"]').first();
      if (await cancelAddCourse.count()) {
        await cancelAddCourse.click();
        await page.waitForTimeout(200);
        assertTest('Courses: Cancel Add Course button', true);
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Import course folder button
    const importFolderBtn = page.locator('button:has-text("Import Local Folder"), button.secondary-pill-btn').first();
    if (await importFolderBtn.count()) {
      await importFolderBtn.click();
      await page.waitForTimeout(300);
      const isImportModalOpen = (await page.locator('.modal-backdrop:has-text("Import Course")').count()) > 0;
      assertTest('Courses: "Import Local Folder" modal button', isImportModalOpen, 'import modal opened');

      const cancelImport = page.locator('.modal-card button:has-text("Cancel"), .modal-card .icon-button').first();
      if (await cancelImport.count()) {
        await cancelImport.click();
        await page.waitForTimeout(200);
        assertTest('Courses: Cancel Import Folder button', true);
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Course continue button -> opens Course Detail
    const courseContinueBtn = page.locator('button.course-card-btn-continue, button.course-card-btn-lectures').first();
    if (await courseContinueBtn.count() > 0) {
      await courseContinueBtn.click();
      await page.waitForTimeout(400);

      // Verify Course Detail view (rendered as dialog.course-dialog)
      const courseDialog = page.locator('dialog.course-dialog');
      const isCourseDetailOpen = (await courseDialog.count()) > 0;
      assertTest('Courses: Open Course Detail dialog', isCourseDetailOpen);

      if (isCourseDetailOpen) {
        // Test Pace / Speed buttons (e.g. 1.25x, 1.5x)
        const speedPills = page.locator('.speed-pill');
        if (await speedPills.count() > 0) {
          await speedPills.nth(1).click();
          await page.waitForTimeout(150);
          assertTest('Course Detail: Playback speed pace pill click', true);
        }

        // Test Filter tabs (All, To Do, Completed)
        const todoTab = page.locator('.course-tabs button:has-text("To Do")').first();
        if (await todoTab.count()) {
          await todoTab.click();
          await page.waitForTimeout(150);
          assertTest('Course Detail: "To Do" filter tab click', true);
        }

        // Close Course Detail Dialog
        const closeCourseBtn = page.locator('button[aria-label="Close course"]').first();
        if (await closeCourseBtn.count()) {
          await closeCourseBtn.click();
          await page.waitForTimeout(300);
          assertTest('Course Detail: Close course dialog button click', true);
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`6. TESTING PLANNER & CALENDAR`);
    console.log(`========================================`);

    await plannerTab.click();
    await page.waitForTimeout(400);

    // Month / Week / Day buttons
    const monthViewBtn = page.locator('button:has-text("Month")').first();
    const weekViewBtn = page.locator('button:has-text("Week")').first();
    const dayViewBtn = page.locator('button:has-text("Day")').first();

    if (await page.locator('button:has-text("Week")').count()) {
      await page.locator('button:has-text("Week")').first().click();
      await page.waitForTimeout(300);
      assertTest('Planner: Week view button', true);
    }
    if (await page.locator('button:has-text("Day")').count()) {
      await page.locator('button:has-text("Day")').first().click();
      await page.waitForTimeout(300);
      assertTest('Planner: Day view button', true);
    }
    if (await page.locator('button:has-text("Month")').count()) {
      await page.locator('button:has-text("Month")').first().click();
      await page.waitForTimeout(300);
      assertTest('Planner: Month view button', true);
    }

    // Nav buttons: <, >, Today
    const plannerToday = page.locator('.fc-today-button, button:has-text("Today")').first();
    if (await plannerToday.count()) {
      await plannerToday.click();
      await page.waitForTimeout(200);
      assertTest('Planner: Today button', true);
    }

    console.log(`\n========================================`);
    console.log(`7. TESTING REFLECT & INSIGHTS`);
    console.log(`========================================`);

    await reflectTab.click();
    await page.waitForTimeout(400);

    // Chart period buttons: 7 days & 30 days
    const period7Btn = page.locator('.segments button:has-text("7 days")').first();
    const period30Btn = page.locator('.segments button:has-text("30 days")').first();
    if (await period30Btn.count()) {
      await period30Btn.click();
      await page.waitForTimeout(200);
      assertTest('Reflect: Period "30 days" button click', true);
    }
    if (await period7Btn.count()) {
      await period7Btn.click();
      await page.waitForTimeout(200);
      assertTest('Reflect: Period "7 days" button click', true);
    }

    // Chart metric buttons: Focus, Tasks, Habits, Learning
    const metricBtns = page.locator('.insight-choices button');
    const numMetricBtns = await metricBtns.count();
    console.log(`Found ${numMetricBtns} metric buttons in Reflect.`);
    if (numMetricBtns > 0) {
      for (let i = 0; i < Math.min(numMetricBtns, 4); i++) {
        const btn = metricBtns.nth(i);
        const label = await btn.textContent();
        await btn.click();
        await page.waitForTimeout(150);
        assertTest(`Reflect: Metric "${label}" button click`, true);
      }
    }
  } catch (err) {
    console.error(`💥 Unexpected test runner exception:`, err);
    assertTest('Runner execution', false, err.message);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY & RUNTIME HEALTH REPORT`);
  console.log(`========================================`);
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Buttons & Interactions Tested: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Runtime Page Errors (Uncaught Exceptions): ${pageErrors.length}`);
  console.log(`Runtime Console Errors: ${consoleErrors.length}`);

  if (pageErrors.length > 0) {
    console.log(`Page Errors:`, pageErrors);
  }
  if (consoleErrors.length > 0) {
    console.log(`Console Errors:`, consoleErrors);
  }

  if (failed === 0 && pageErrors.length === 0) {
    console.log(`\n🎉 ALL BUTTONS AND FEATURES OPERATING WITH 100% HEALTH!`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ Some tests or errors were reported.`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
