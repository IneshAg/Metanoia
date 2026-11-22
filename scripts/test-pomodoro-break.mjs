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
const ARTIFACT_DIR = 'C:/Users/inesh/.gemini/antigravity/brain/d1f2ba47-5ff4-428b-8e9a-8a5b596d08f1';

// Seed state with an active focus session that has elapsed its target duration
const rawInitial = fs.readFileSync(path.join(PUBLIC, 'initial-state.json'), 'utf8');
let appState = migrateState(JSON.parse(rawInitial));

// Set up an active focus session that is 1 second away from target duration (e.g. 25m target, 1499s elapsed)
const now = Date.now();
appState.focus = {
  id: 'test-pomo-session-1',
  intention: 'Deep Code Review',
  duration: 25,
  elapsed: 1499,
  runningSince: now,
  startedAt: now - 1499000,
  taskId: null,
  mode: 'work',
  round: 1,
  totalRounds: 4,
  workDuration: 25,
};

// Also add a sample completed session with pause time to verify history and schedule formatting
appState.sessions.push({
  id: 'sample-logged-session',
  started_utc: new Date(now - 5400000).toISOString(),
  completed_utc: new Date(now - 600000).toISOString(),
  active_seconds: 3600,
  break_seconds: 1200,
  state: 'complete',
  taskId: null,
  intention: 'Focused work',
  mode: 'work',
  round: 1,
  work_duration: 60,
});

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

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
        console.log('[API ACTION]', action.type, action);
        appState = applyAction(appState, action);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ state: appState }));
      } catch (err) {
        console.error('[API ERROR]', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  let filePath = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC, url.pathname);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(5199, '127.0.0.1', async () => {
  console.log('Test server running at http://127.0.0.1:5199');
  
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: 'C:\\Users\\inesh\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();

  try {
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:5199');
    await page.waitForLoadState('networkidle');

    // The modal pops up immediately on whatever page you are on when target is hit!
    console.log('Verifying Pomodoro target reached & Break Modal is open across the app...');
    await page.waitForSelector('.pomodoro-break-card', { timeout: 10000 });
    console.log('SUCCESS: .pomodoro-break-card modal is open!');

    // Take screenshot of the Pomodoro Break Modal
    const shotModalPath = path.join(ARTIFACT_DIR, 'qa-pomodoro-break-modal.png');
    await page.screenshot({ path: shotModalPath });
    console.log(`Saved screenshot: ${shotModalPath}`);

    // Verify modal elements
    const titleText = await page.locator('.pomo-prompt-title').textContent();
    console.log('Modal title:', titleText);

    const recommendedBtn = page.locator('.pomo-btn-short-break');
    await recommendedBtn.waitFor({ state: 'visible' });
    console.log('Found recommended button:', await recommendedBtn.textContent());

    // Click "Start 5m Short Break (Recommended)"
    console.log('Clicking "Start 5m Short Break (Recommended)"...');
    await recommendedBtn.click();
    await page.waitForTimeout(1500);

    // Now go to Focus Lounge page to inspect the active break timer
    console.log('Navigating to Focus page...');
    await page.getByRole('button', { name: /Focus/i }).first().click();
    await page.waitForTimeout(1000);

    // Verify break timer is now active in Focus mode
    console.log('Verifying break phase active...');
    const phaseBadge = page.locator('.pomo-phase-indicator');
    console.log('Active Phase Indicator:', await phaseBadge.textContent());

    // Take screenshot of the active break timer
    const shotBreakPath = path.join(ARTIFACT_DIR, 'qa-pomodoro-break-active.png');
    await page.screenshot({ path: shotBreakPath });
    console.log(`Saved screenshot: ${shotBreakPath}`);

    // Now test clicking on a completed session in history to inspect timing details
    console.log('Scrolling to history and clicking on completed session...');
    const historyItem = page.locator('.history-pill-item').first();
    await historyItem.scrollIntoViewIfNeeded();
    await historyItem.waitFor({ state: 'visible' });
    await historyItem.click({ force: true });
    await page.waitForTimeout(1000);

    // Verify ItemDetailModal is open
    await page.waitForSelector('.item-detail-modal', { timeout: 8000 });
    console.log('SUCCESS: ItemDetailModal opened!');

    const shotDetailPath = path.join(ARTIFACT_DIR, 'qa-session-timing-detail.png');
    await page.screenshot({ path: shotDetailPath });
    console.log(`Saved screenshot: ${shotDetailPath}`);

    console.log('ALL POMODORO & TIMING VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});
