import test from 'node:test';import assert from 'node:assert/strict';import {applyAction,activeSeconds,validDay,dayKey,mergeTaskRemotes,migrateState,formatSessionTimeRange,type State,type Task} from '../src/domain.ts';
const fixture=():State=>({version:1,importedAt:'',tasks:[],courses:[{id:'c',title:'Course',done:0,total:2,deadline:'',nextLesson:'',nextUrl:null,source:'youtube'}],xp:0,credits:100,focus:null,sessions:[],redemptions:[],rewards:[{id:'r',title:'Movie',cost:30,description:'',art:''}],habits:[],habitsPartial:false,notes:[]});
const task=():Task=>({id:'',title:'Read a chapter',day:'2026-11-18',start:'09:00',end:'10:00',minutes:25,done:false,category:'study',updated:''});
test('real calendar dates and Kolkata midnight boundary',()=>{assert.ok(validDay('2028-02-29'));assert.ok(!validDay('2026-02-29'));assert.ok(!validDay('2026-13-01'));assert.equal(dayKey(new Date('2026-11-17T19:00:00Z')),'2026-11-18')});
test('task save preserves existing completion and validates time',()=>{let s=applyAction(fixture(),{type:'task.save',task:task()});const t=s.tasks[0];s=applyAction(s,{type:'task.toggle',id:t.id,done:true});s=applyAction(s,{type:'task.save',task:{...t,title:'Revised'}});assert.equal(s.tasks[0].done,true);assert.throws(()=>applyAction(s,{type:'task.save',task:{...t,end:'08:00'}}));assert.throws(()=>applyAction(s,{type:'task.save',task:{...t,day:'2026-02-30'}}))});
test('completion is idempotent; undo reverses XP',()=>{let s=applyAction(fixture(),{type:'task.save',task:task()});const id=s.tasks[0].id;s=applyAction(s,{type:'task.toggle',id,done:true});s=applyAction(s,{type:'task.toggle',id,done:true});assert.equal(s.xp,10);s=applyAction(s,{type:'task.toggle',id,done:false});assert.equal(s.xp,0)});
test('redemption is transactional and duplicate-safe',()=>{let s=applyAction(fixture(),{type:'reward.redeem',id:'r',requestId:'one'});assert.equal(s.credits,70);s=applyAction(s,{type:'reward.redeem',id:'r',requestId:'one'});assert.equal(s.credits,70);assert.equal(s.redemptions.length,1);assert.throws(()=>applyAction({...s,credits:2},{type:'reward.redeem',id:'r',requestId:'two'}));assert.equal(s.redemptions.length,1)});
test('Focus excludes paused time and caps at chosen duration',()=>{let s=applyAction(fixture(),{type:'focus.start',minutes:25},1000);s=applyAction(s,{type:'focus.pause'},61000);assert.equal(activeSeconds(s.focus!,500000),60);s=applyAction(s,{type:'focus.resume'},500000);assert.equal(activeSeconds(s.focus!,560000),120);s=applyAction(s,{type:'focus.finish'},3000000);assert.equal(s.sessions[0].active_seconds,1500);assert.equal(s.credits,105);assert.equal(s.xp,25);s=applyAction(s,{type:'focus.finish'},3000001);assert.equal(s.credits,105)});
test('short Focus earns no credits, second active session rejected',()=>{let s=applyAction(fixture(),{type:'focus.start',minutes:5},0);assert.throws(()=>applyAction(s,{type:'focus.start',minutes:25},100));s=applyAction(s,{type:'focus.finish'},1000);assert.equal(s.credits,100)});
test('saved Focus keeps the task and original start time after a pause',()=>{let s=fixture();s.tasks.push({id:'plan-1',title:'Read a chapter',day:'2026-11-19',start:'',end:'',minutes:25,done:false,category:'study',updated:''});s=applyAction(s,{type:'focus.start',minutes:25,taskId:'plan-1'},Date.parse('2026-11-19T10:00:00Z'));s=applyAction(s,{type:'focus.pause'},Date.parse('2026-11-19T10:05:00Z'));s=applyAction(s,{type:'focus.finish'},Date.parse('2026-11-19T10:20:00Z'));assert.equal(s.sessions[0].active_seconds,300);assert.equal(s.sessions[0].started_utc,'2026-11-19T10:00:00.000Z');assert.equal(s.sessions[0].taskId,'plan-1');assert.equal(s.sessions[0].intention,'Read a chapter')});
test('appearance settings and custom accent save in V2 state',()=>{const initial=fixture();const changed=applyAction(initial,{type:'settings.update',settings:{theme:'dark',palette:'plum',customColor:'#875b9b',motion:false,focusMinutes:45}});assert.deepEqual(changed.settings,{theme:'dark',palette:'plum',customColor:'#875b9b',motion:false,focusMinutes:45});assert.throws(()=>applyAction(changed,{type:'settings.update',settings:{customColor:'purple'}}));assert.equal(initial.settings,undefined)});
test('course deadlines remain optional and valid',()=>{let s=applyAction(fixture(),{type:'course.deadline',id:'c',day:'2026-12-01'});assert.equal(s.courses[0].deadline,'2026-12-01');s=applyAction(s,{type:'course.deadline',id:'c',day:''});assert.equal(s.courses[0].deadline,'')});

test('new habit days reset checks, preserve source and remain idempotent',()=>{const original=fixture();original.habits=[{id:'source',day:'2026-11-18',checks:{Reading:true,Exercise:false}}];let s=applyAction(original,{type:'habit.begin',day:'2026-11-19'});assert.equal(s.habits.length,2);assert.deepEqual(s.habits[1].checks,{Reading:false,Exercise:false});s=applyAction(s,{type:'habit.toggle',id:s.habits[1].id,name:'Reading',done:true});assert.equal(s.habits[1].checks.Reading,true);assert.equal(original.habits.length,1);assert.equal(s.habits[0].checks.Reading,true);s=applyAction(s,{type:'habit.begin',day:'2026-11-19'});assert.equal(s.habits.length,2);assert.throws(()=>applyAction(s,{type:'habit.begin',day:'2026-02-30'}));assert.throws(()=>applyAction(s,{type:'habit.toggle',id:'source',name:'unknown',done:true}));});

test('habit check-in creates the chosen day and does not copy prior completions',()=>{const state=fixture();state.habits=[{id:'prior',day:'2026-11-17',checks:{Reading:true,Exercise:true}}];const next=applyAction(state,{type:'habit.set',day:'2026-11-18',name:'Reading',done:true});assert.deepEqual(next.habits.find(h=>h.day==='2026-11-18')?.checks,{Reading:true,Exercise:false});assert.equal(state.habits.length,1)});
test('course progress records daily learning without changing earlier progress',()=>{let state=fixture();state=applyAction(state,{type:'course.progress',id:'c',done:1},Date.parse('2026-11-18T10:00:00+05:30'));assert.equal(state.courses[0].done,1);assert.equal(state.courseActivity?.[0].day,'2026-11-18');assert.equal(state.courseActivity?.[0].delta,1);assert.throws(()=>applyAction(state,{type:'course.progress',id:'c',done:3}))});
test('course save accepts notion link and validates format',()=>{
  let s=applyAction(fixture(),{type:'course.save',course:{id:'c',title:'SwiftUI',done:0,total:10,deadline:'',nextLesson:'Intro',nextUrl:null,source:'youtube',minutesPerLesson:20,notionUrl:'https://notion.so/my-page'}});
  assert.equal(s.courses.find(c=>c.id==='c')?.notionUrl,'https://notion.so/my-page');
  assert.throws(()=>applyAction(s,{type:'course.save',course:{id:'c',title:'SwiftUI',done:0,total:10,deadline:'',nextLesson:'',nextUrl:null,source:'youtube',minutesPerLesson:20,notionUrl:'ftp://invalid'}}));
  
  // Verify local course with file path nextUrl can save Notion link
  let localCourse = {
    id: 'c-local',
    title: 'FastAPI – The Complete Course 2026 (Beginner + Advanced)',
    done: 0,
    total: 42,
    deadline: '',
    nextLesson: 'Lecture 1',
    nextUrl: 'C:\\Users\\inesh\\Videos\\FastAPI\\01.mp4',
    source: 'local' as const,
    minutesPerLesson: 20,
    notionUrl: null
  };
  let s2 = applyAction(fixture(), { type: 'course.save', course: localCourse });
  let savedLocal = applyAction(s2, {
    type: 'course.save',
    course: { ...localCourse, notionUrl: 'https://app.notion.com/p/FastApi-41e02ea82888800dabd6' }
  });
  assert.equal(savedLocal.courses.find(c => c.id === 'c-local')?.notionUrl, 'https://app.notion.com/p/FastApi-41e02ea82888800dabd6');

  // Verify non-local course with Windows path nextUrl can also save Notion link
  let windowsPathCourse = {
    id: 'c-win',
    title: 'FastAPI – The Complete Course 2026 (Beginner + Advanced)',
    done: 0,
    total: 52,
    deadline: '',
    nextLesson: '01. Introduction',
    nextUrl: 'D:\\TELEGRAM DESKTOP\\FastAPI - The Complete Course 2026',
    source: 'personal' as const,
    minutesPerLesson: 20,
    notionUrl: null
  };
  let s3 = applyAction(fixture(), { type: 'course.save', course: windowsPathCourse });
  let savedWin = applyAction(s3, {
    type: 'course.save',
    course: { ...windowsPathCourse, notionUrl: 'https://app.notion.com/p/FastApi-41e02ea82888800dabd6' }
  });
  assert.equal(savedWin.courses.find(c => c.id === 'c-win')?.notionUrl, 'https://app.notion.com/p/FastApi-41e02ea82888800dabd6');
});
test('local folder course import adds course and ordered lessons',()=>{let s=applyAction(fixture(),{type:'course.import_local',title:'Blender 3D',lessons:[{title:'01 - Basics',durationSeconds:600,sourceUrl:'file:///C:/videos/01.mp4'},{title:'02 - Mesh',durationSeconds:900,sourceUrl:'file:///C:/videos/02.mp4'}]});const created=s.courses.find(c=>c.title==='Blender 3D');assert.ok(created);assert.equal(created?.total,2);assert.equal(created?.source,'local');const l=s.lessons.filter(x=>x.courseId===created?.id);assert.equal(l.length,2);assert.equal(l[0].title,'01 - Basics');assert.equal(l[0].durationSeconds,600);assert.equal(l[1].position,2);});

test('mergeTaskRemotes assigns remote Notion IDs to matching tasks and preserves existing remotes', () => {
  const s = fixture();
  s.tasks.push(
    { id: 't-1', title: 'Task 1', day: '2026-11-19', start: '', end: '', minutes: 25, done: false, category: 'study', updated: '' },
    { id: 't-2', title: 'Task 2', day: '2026-11-19', start: '', end: '', minutes: 30, done: true, category: 'coding', remoteId: 'existing-page-2', updated: '' }
  );
  const remotes = { 't-1': 'notion-page-1', 't-2': 'new-page-2' };
  const merged = mergeTaskRemotes(s, remotes);
  assert.equal(merged.tasks.find(t => t.id === 't-1')?.remoteId, 'notion-page-1');
  assert.equal(merged.tasks.find(t => t.id === 't-2')?.remoteId, 'new-page-2');
});

test('task save preserves remoteId and task.set_remote updates it', () => {
  let s = fixture();
  s.tasks.push({ id: 't-1', title: 'Task 1', day: '2026-11-19', start: '', end: '', minutes: 25, done: false, category: 'study', remoteId: 'page-uuid', updated: '' });
  s = applyAction(s, { type: 'task.save', task: { ...s.tasks[0], title: 'Task 1 Edited' } });
  assert.equal(s.tasks[0].remoteId, 'page-uuid');
  assert.equal(s.tasks[0].title, 'Task 1 Edited');
  s = applyAction(s, { type: 'task.set_remote', id: 't-1', remoteId: 'updated-page-uuid' });
  assert.equal(s.tasks[0].remoteId, 'updated-page-uuid');
});

test('task delete removes task and clears active focus if linked', () => {
  let s = fixture();
  s.tasks.push({ id: 't-del-1', title: 'Task to Delete', day: '2026-11-19', start: '', end: '', minutes: 25, done: false, category: 'study', updated: '' });
  s.focus = { id: 'f-1', intention: 'Working on task', duration: 25, elapsed: 0, runningSince: null, taskId: 't-del-1' };
  assert.equal(s.tasks.length, 1);
  s = applyAction(s, { type: 'task.delete', id: 't-del-1' });
  assert.equal(s.tasks.length, 0);
  assert.equal(s.focus, null);
  assert.throws(() => applyAction(s, { type: 'task.delete', id: 'non-existent' }), /Task not found/);
});

test('habit.set_page_id updates habit record ID for matching date', () => {
  let s = fixture();
  s.habits = [{ id: 'local-id', day: '2026-11-19', checks: { Reading: true } }];
  s = applyAction(s, { type: 'habit.set_page_id', day: '2026-11-19', pageId: 'notion-page-123' });
  assert.equal(s.habits[0].id, 'notion-page-123');
});

test('habit.merge_notion merges Notion habit records into local state', () => {
  let s = fixture();
  s.habits = [{ id: 'local-uuid-19', day: '2026-11-19', checks: { Reading: false, 'No Fap': true } }];
  const notionRecords = [
    { id: 'notion-id-20', day: '2026-11-20', checks: { Reading: false, 'No Fap': false } },
    { id: 'notion-id-19', day: '2026-11-19', checks: { Reading: true, 'No Fap': true } }
  ];
  s = applyAction(s, { type: 'habit.merge_notion', records: notionRecords });
  assert.equal(s.habits.length, 2);
  const day19 = s.habits.find(h => h.day === '2026-11-19');
  assert.equal(day19?.id, 'notion-id-19');
  assert.equal(day19?.checks['Reading'], true);
  assert.equal(day19?.checks['No Fap'], true);

  const day20 = s.habits.find(h => h.day === '2026-11-20');
  assert.equal(day20?.id, 'notion-id-20');
  assert.equal(day20?.checks['Reading'], false);
});

test('task toggle sets and clears completedAt timestamp accurately', () => {
  let s = fixture();
  s.tasks = [{ id: 't1', title: 'Task 1', day: '2026-11-10', start: '', end: '', minutes: 25, category: 'study', done: false, updated: '' }];
  s = applyAction(s, { type: 'task.toggle', id: 't1', done: true });
  assert.equal(s.tasks[0].done, true);
  assert.ok(typeof s.tasks[0].completedAt === 'string' && s.tasks[0].completedAt.length > 0);
  
  s = applyAction(s, { type: 'task.toggle', id: 't1', done: false });
  assert.equal(s.tasks[0].done, false);
  assert.equal(s.tasks[0].completedAt, null);
});

test('habit management: add, rename, archive, and scheduled days', () => {
  let s = fixture();
  s.habits = [{ id: 'h1', day: '2026-11-19', checks: { Reading: false } }];
  s = applyAction(s, { type: 'habit.add', name: 'Meditation', scheduledDays: [1,2,3,4,5] });
  assert.ok(s.habitDefinitions?.some(h => h.name === 'Meditation' && !h.archived));
  assert.equal(s.habits[0].checks['Meditation'], false);

  s = applyAction(s, { type: 'habit.rename', oldName: 'Meditation', newName: 'Mindful Breathing' });
  assert.ok(s.habitDefinitions?.some(h => h.name === 'Mindful Breathing'));
  assert.equal(s.habits[0].checks['Mindful Breathing'], false);
  assert.equal('Meditation' in s.habits[0].checks, false);

  s = applyAction(s, { type: 'habit.archive', name: 'Mindful Breathing' });
  assert.equal(s.habitDefinitions?.find(h => h.name === 'Mindful Breathing')?.archived, true);
});

test('theme modes support light, dark, system, and spell in migration and action', () => {
  let s = fixture();
  // Update to system theme (Solo Leveling)
  s = applyAction(s, { type: 'settings.update', patch: { theme: 'system' } });
  assert.equal(s.settings.theme, 'system');

  // Update to spell theme (Shadow Slave)
  s = applyAction(s, { type: 'settings.update', patch: { theme: 'spell' } });
  assert.equal(s.settings.theme, 'spell');

  // Update to light theme
  s = applyAction(s, { type: 'settings.update', patch: { theme: 'light' } });
  assert.equal(s.settings.theme, 'light');

  // Verify migration preserves all 4 themes
  const migratedSystem = migrateState({ ...fixture(), settings: { theme: 'system' } as any });
  assert.equal(migratedSystem.settings.theme, 'system');

  const migratedSpell = migrateState({ ...fixture(), settings: { theme: 'spell' } as any });
  assert.equal(migratedSpell.settings.theme, 'spell');

  // Verify weatherMood 'none' and 'rain'
  s = applyAction(s, { type: 'settings.update', patch: { weatherMood: 'none' } });
  assert.equal(s.settings.weatherMood, 'none');

  s = applyAction(s, { type: 'settings.update', patch: { weatherMood: 'rain' } });
  assert.equal(s.settings.weatherMood, 'rain');
});

test('pomodoro cycles work session to short break and 4th session to long break', () => {
  let s = fixture();
  // Round 1: Work (25m)
  s = applyAction(s, { type: 'focus.start', minutes: 25, intention: 'Deep Coding', round: 1, totalRounds: 4 }, 1000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 1);
  assert.equal(s.focus?.duration, 25);

  // Extend by 5 minutes
  s = applyAction(s, { type: 'focus.extend', minutes: 5 }, 2000);
  assert.equal(s.focus?.duration, 30);

  // Complete round 1 work -> transitions to short break (5m)
  s = applyAction(s, { type: 'focus.next_phase' }, 1000 + 30 * 60 * 1000);
  assert.equal(s.sessions.length, 1);
  assert.equal(s.sessions[0].intention, 'Deep Coding');
  assert.equal(s.focus?.mode, 'short_break');
  assert.equal(s.focus?.duration, 5);
  assert.equal(s.focus?.round, 1);

  // Complete short break -> transitions to round 2 work
  s = applyAction(s, { type: 'focus.next_phase' }, 2000000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 2);
  assert.equal(s.focus?.duration, 25);

  // Advance through round 2 break, round 3 work, round 3 break, to round 4 work
  s = applyAction(s, { type: 'focus.next_phase' }, 3000000); // R2 short break
  s = applyAction(s, { type: 'focus.next_phase' }, 4000000); // R3 work
  s = applyAction(s, { type: 'focus.next_phase' }, 5000000); // R3 short break
  s = applyAction(s, { type: 'focus.next_phase' }, 6000000); // R4 work
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 4);

  // Complete round 4 work -> should trigger LONG BREAK (15m)!
  s = applyAction(s, { type: 'focus.next_phase' }, 7000000);
  assert.equal(s.focus?.mode, 'long_break');
  assert.equal(s.focus?.duration, 15);
  assert.equal(s.focus?.round, 4);

  // Long break finishes -> resets cycle to Round 1 work
  s = applyAction(s, { type: 'focus.next_phase' }, 8000000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 1);
  assert.equal(s.focus?.duration, 25);

  // Finishing session clears focus
  s = applyAction(s, { type: 'focus.finish' }, 9000000);
  assert.equal(s.focus, null);
});

test('20/5 adaptive pomodoro retains 20m work sprints across 4 rounds and provides 25m rejuvenation long break', () => {
  let s = fixture();
  // Round 1: 20m sprint
  s = applyAction(s, { type: 'focus.start', minutes: 20, intention: 'Sprint Block 1' }, 1000);
  assert.equal(s.focus?.duration, 20);
  assert.equal(s.focus?.workDuration, 20);

  // Transition to break: 5m
  s = applyAction(s, { type: 'focus.next_phase' }, 2000);
  assert.equal(s.focus?.mode, 'short_break');
  assert.equal(s.focus?.duration, 5);

  // Transition to Round 2: retains 20m work duration!
  s = applyAction(s, { type: 'focus.next_phase' }, 3000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 2);
  assert.equal(s.focus?.duration, 20);

  // Advance to Round 4 Long Break
  s = applyAction(s, { type: 'focus.next_phase' }, 4000); // R2 break
  s = applyAction(s, { type: 'focus.next_phase' }, 5000); // R3 work (20m)
  assert.equal(s.focus?.duration, 20);
  s = applyAction(s, { type: 'focus.next_phase' }, 6000); // R3 break
  s = applyAction(s, { type: 'focus.next_phase' }, 7000); // R4 work (20m)
  assert.equal(s.focus?.duration, 20);

  // Round 4 finishes -> 25m rejuvenation long break (80m work + 15m short breaks + 25m long break = 120m / 2 hours!)
  s = applyAction(s, { type: 'focus.next_phase' }, 8000);
  assert.equal(s.focus?.mode, 'long_break');
  assert.equal(s.focus?.duration, 25);

  // When 2 hours finish (long break complete), automatically cycles to Block 2 Round 1!
  s = applyAction(s, { type: 'focus.next_phase' }, 9000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 1);
  assert.equal(s.focus?.duration, 20);
});

test('focus session records start time, completion time, active duration, and break duration accurately', () => {
  let s = fixture();
  const startMs = Date.parse('2026-11-21T07:30:00.000Z');
  const finishMs = Date.parse('2026-11-21T09:00:00.000Z'); // 1.5 hours span
  s = applyAction(s, { type: 'focus.start', minutes: 60, intention: 'Deep coding sprint' }, startMs);
  // Complete at 9:00 with 60 mins active focus (3600 seconds)
  s = applyAction(s, { type: 'focus.finish', actualSeconds: 3600 }, finishMs);
  assert.equal(s.sessions.length, 1);
  const session = s.sessions[0];
  assert.equal(session.started_utc, '2026-11-21T07:30:00.000Z');
  assert.equal(session.completed_utc, '2026-11-21T09:00:00.000Z');
  assert.equal(session.active_seconds, 3600);
  assert.equal(session.break_seconds, 1800); // 30 mins pause/break in the 90 min span
  assert.equal(session.mode, 'work');
});


test('formatSessionTimeRange formats time spans cleanly and avoids duplicate timestamps', () => {
  // Full span with completion time
  const span = formatSessionTimeRange('2026-11-21T13:58:29.523Z', '2026-11-21T15:40:38.147Z', 3600);
  assert.ok(span.includes('–'));

  // Missing completion time but activeSeconds > 60: computes estimated end time
  const estimated = formatSessionTimeRange('2026-11-18T15:19:11.175Z', undefined, 240);
  assert.ok(estimated.includes('–'));

  // 0s or 1s session: does NOT show duplicate like '8:49 PM – 8:49 PM'
  const zeroSec = formatSessionTimeRange('2026-11-18T15:19:24.133Z', undefined, 0);
  assert.ok(!zeroSec.includes('–'));

  // Same minute start & end: collapses to single time
  const sameMin = formatSessionTimeRange('2026-11-18T15:19:00.000Z', '2026-11-18T15:19:20.000Z', 20);
  assert.ok(!sameMin.includes('–'));
});

test('Focus V2: early break preserves unfinished focus time and keeps round', () => {
  let s = fixture();
  // Start 25m focus sprint on Round 1
  s = applyAction(s, { type: 'focus.start', minutes: 25, intention: 'Deep Research', round: 1 }, 1000);
  assert.equal(s.focus?.round, 1);
  assert.equal(s.focus?.duration, 25);

  // Focus for 15 minutes (900 seconds)
  s.focus!.elapsed = 900;
  s.focus!.runningSince = 1000 + 900 * 1000;

  // Take an early break (e.g. 5m) because user needed a breather
  s = applyAction(s, { type: 'focus.early_break', breakMinutes: 5 }, 1000 + 900 * 1000);
  
  // Verify it is on break, but STILL ON ROUND 1!
  assert.equal(s.focus?.mode, 'short_break');
  assert.equal(s.focus?.round, 1);
  assert.equal(s.focus?.duration, 5);
  // Unfinished work (25m - 15m = 10m = 600s) is preserved!
  assert.equal(s.focus?.pendingWorkSeconds, 600);

  // When the break finishes, it resumes ROUND 1 with the remaining 10 minutes!
  s = applyAction(s, { type: 'focus.next_phase' }, 1000 + (900 + 300) * 1000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 1); // Round 1 NOT skipped!
  assert.equal(s.focus?.duration, 10); // 10 minutes remaining!
});

test('Focus V2: clicking resume on a break returns to work with remaining time left', () => {
  let s = fixture();
  // User had a 60m session, did 39m (2340s) and is currently in a 5m break
  s.sessions.push({
    id: 'partial-work-1',
    started_utc: '2026-11-22T10:00:00.000Z',
    completed_utc: '2026-11-22T10:39:00.000Z',
    active_seconds: 2340,
    state: 'complete',
    mode: 'work',
    round: 1,
    work_duration: 60
  });

  s.focus = {
    id: 'current-break-1',
    intention: '☕ Short Break · Rest & Hydrate',
    duration: 5,
    elapsed: 300,
    runningSince: null,
    startedAt: 1795344516305,
    mode: 'short_break',
    round: 1,
    totalRounds: 4,
    workDuration: 60
  };

  // Clicking Resume Flow sends { type: 'focus.resume' }
  s = applyAction(s, { type: 'focus.resume' }, 1795344886305);

  // Must switch back to WORK mode, staying on Round 1, with the 21 minutes left!
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 1);
  assert.equal(s.focus?.duration, 21); // 60m - 39m = 21m left!
});

test('Focus V2: skip and postpone break controls work seamlessly', () => {
  let s = fixture();
  // Start focus
  s = applyAction(s, { type: 'focus.start', minutes: 25, intention: 'Sprint' }, 1000);

  // Postpone break by +10m
  s = applyAction(s, { type: 'focus.postpone_break', minutes: 10 }, 2000);
  assert.equal(s.focus?.duration, 35);

  // Transition to break
  s = applyAction(s, { type: 'focus.next_phase' }, 3000);
  assert.equal(s.focus?.mode, 'short_break');

  // Skip break directly into Round 2 work
  s = applyAction(s, { type: 'focus.skip_break' }, 4000);
  assert.equal(s.focus?.mode, 'work');
  assert.equal(s.focus?.round, 2);
});

test('Focus V2: custom presets save and load correctly', () => {
  let s = fixture();
  const customPreset = {
    id: 'study-45-15',
    name: 'Study 45/15',
    workMinutes: 45,
    breakMinutes: 15,
    longBreakMinutes: 30,
    totalRounds: 3,
    autoAdvance: true
  };

  s = applyAction(s, { type: 'focus.save_preset', preset: customPreset });
  assert.equal(s.settings.customPresets?.length, 1);
  assert.equal(s.settings.customPresets?.[0].name, 'Study 45/15');
  assert.equal(s.settings.lastUsedPresetId, 'study-45-15');
});

test('Focus V2: set_round, restart, discard, and delete session', () => {
  let s = fixture();
  s = applyAction(s, { type: 'focus.start', minutes: 25, round: 1 }, 1000);
  assert.equal(s.focus?.round, 1);

  // Set round manually
  s = applyAction(s, { type: 'focus.set_round', round: 2 }, 2000);
  assert.equal(s.focus?.round, 2);

  // Restart session
  s.focus!.elapsed = 500;
  s = applyAction(s, { type: 'focus.restart' }, 3000);
  assert.equal(s.focus?.elapsed, 0);

  // Discard session
  s = applyAction(s, { type: 'focus.discard' }, 4000);
  assert.equal(s.focus, null);

  // Delete completed session with reward reversal
  s.xp = 100;
  s.credits = 20;
  s.sessions.push({
    id: 'rewarded-session',
    started_utc: new Date().toISOString(),
    active_seconds: 1500,
    state: 'complete',
    mode: 'work'
  });
  s = applyAction(s, { type: 'session.delete', id: 'rewarded-session' });
  assert.equal(s.sessions.some(x => x.id === 'rewarded-session'), false);
  assert.equal(s.xp, 75); // Reversed 25 XP
  assert.equal(s.credits, 15); // Reversed 5 credits
});

test('Focus V2: expired break is capped and does not inflate time', () => {
  let s = fixture();
  // Start a 5m short break
  s = applyAction(s, { type: 'focus.start', minutes: 5, mode: 'short_break', round: 1 }, 1000);
  
  // Finish 45 minutes later (wall clock 2700s)
  s = applyAction(s, { type: 'focus.finish' }, 1000 + 2700 * 1000);
  
  const loggedBreak = s.sessions[s.sessions.length - 1];
  assert.equal(loggedBreak.mode, 'short_break');
  // Break duration 5m (300s) + 120s grace = 420s max, NOT 2700s
  assert.ok(loggedBreak.active_seconds <= 420);
});

test('Focus V2: Session vs Interval lifecycle tracks continuous sessions vs new sessions', () => {
  let s = fixture();
  const t0 = 10000;
  
  // 1. Start Study Session A
  s = applyAction(s, { type: 'focus.start', minutes: 25, workDuration: 25 }, t0);
  assert.ok(s.focus);
  const sessionA_Id = s.focus.sessionId;
  assert.ok(sessionA_Id, 'Session A must have a sessionId');

  // 2. Complete 25m work block and click Continue (adds suggested break under same session)
  s = applyAction(s, { type: 'focus.next_phase', actualSeconds: 1500 }, t0 + 1500 * 1000);
  assert.ok(s.focus);
  assert.equal(s.focus.sessionId, sessionA_Id, 'Break must inherit Session A ID');
  assert.equal(s.focus.completedBlocks, 1);
  assert.equal(s.sessions[s.sessions.length - 1].sessionId, sessionA_Id);

  // 3. Complete 5m break and click Continue (starts Block 2 under same session)
  s = applyAction(s, { type: 'focus.next_phase', actualSeconds: 300 }, t0 + 1800 * 1000);
  assert.ok(s.focus);
  assert.equal(s.focus.sessionId, sessionA_Id, 'Block 2 must inherit Session A ID');

  // 4. Complete 25m work and click Finish Session
  s = applyAction(s, { type: 'focus.finish', actualSeconds: 1500 }, t0 + 3300 * 1000);
  assert.equal(s.focus, null, 'Session A is now closed and finalized');

  // Verify all intervals from Study Session A share the exact same sessionId
  const sessionARecords = s.sessions.filter(x => x.sessionId === sessionA_Id);
  assert.equal(sessionARecords.length, 3, 'Must have 3 logged intervals (Work, Break, Work)');
  sessionARecords.forEach(r => assert.equal(r.sessionId, sessionA_Id));

  // 5. Start Study Session B (from idle) -> must generate a brand new session ID
  s = applyAction(s, { type: 'focus.start', minutes: 60, workDuration: 60 }, t0 + 5000 * 1000);
  assert.ok(s.focus);
  const sessionB_Id = s.focus.sessionId;
  assert.ok(sessionB_Id);
  assert.notEqual(sessionB_Id, sessionA_Id, 'New session must have a fresh unique sessionId');
});
