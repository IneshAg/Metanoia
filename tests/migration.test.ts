import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeGoalSnapshot,mergeLessonSnapshot,migrateState,type Lesson,type State,type TaskGoalSnapshot} from '../src/domain.ts';

test('V2 migration is idempotent and preserves edited task and course data',()=>{
 const old={version:1,importedAt:'2026-11-18',tasks:[{id:'task-1',title:'My edited task',day:'2026-11-19',start:'10:00',end:'11:00',minutes:60,done:false,category:'study',updated:'now'}],courses:[{id:'course-1',title:'My edited course',done:4,total:10,deadline:'',nextLesson:'',nextUrl:null,source:'youtube'}],xp:0,credits:0,focus:null,sessions:[],redemptions:[],rewards:[],habits:[],habitsPartial:false,notes:[]} as State;
 const migrated=migrateState(old,{theme:'dark',palette:'plum',motion:false,focusMinutes:45});
 assert.equal(migrated.version,2);
 assert.deepEqual(migrated.lessons,[]);
 assert.deepEqual(migrated.lessonEvents,[]);
 assert.deepEqual(migrated.tasks[0].goals,[]);
 assert.equal(migrated.tasks[0].title,'My edited task');
 assert.equal(migrated.courses[0].done,4);
 assert.deepEqual(migrated.settings,{theme:'dark',palette:'plum',motion:false,focusMinutes:45});
 assert.deepEqual(migrateState(migrated,{theme:'light',palette:'forest',motion:true,focusMinutes:25}),migrated);
 assert.equal(old.version,1);
});

test('original lecture snapshot imports once and keeps later V2 course progress',()=>{
 const seed: State = {
  version: 2,
  importedAt: '2026-11-20T00:00:00.000Z',
  tasks: [],
  courses: [{id:'course-xyz',title:'Demo Course',done:1,total:3,deadline:'',nextLesson:'Lesson 2',nextUrl:null,source:'youtube'}],
  xp: 0,
  credits: 0,
  focus: null,
  sessions: [],
  redemptions: [],
  rewards: [],
  habits: [],
  habitsPartial: false,
  notes: []
 };
 const snapshot: Lesson[] = [
  {id:'lesson-1',courseId:'course-xyz',title:'Lesson 1',durationSeconds:600,order:1,completed:true,speed:1},
  {id:'lesson-2',courseId:'course-xyz',title:'Lesson 2',durationSeconds:900,order:2,completed:false,speed:1},
  {id:'lesson-3',courseId:'course-xyz',title:'Lesson 3',durationSeconds:1200,order:3,completed:false,speed:1}
 ];
 const course=seed.courses.find(item=>item.id==='course-xyz')!;
 course.done=1;
 const merged=mergeLessonSnapshot(seed,snapshot);
 assert.equal(merged.lessons.length,3);
 assert.equal(merged.lessons.filter(lesson=>lesson.courseId===course.id&&lesson.completed).length,1);
 assert.equal(merged.courses.find(item=>item.id===course.id)?.done,1);
 assert.deepEqual(mergeLessonSnapshot(merged,snapshot),merged);
});

test('Notion goal snapshot maps real relations once and leaves user goal edits intact',()=>{
 const seed: State = {
  version: 2,
  importedAt: '2026-11-20T00:00:00.000Z',
  tasks: [{id:'task-1',title:'Sample Quest',day:'2026-11-20',start:'09:00',end:'10:00',minutes:60,done:false,category:'study',updated:'now'}],
  courses: [],
  xp: 0,
  credits: 0,
  focus: null,
  sessions: [],
  redemptions: [],
  rewards: [],
  habits: [],
  habitsPartial: false,
  notes: []
 };
 const snapshot: TaskGoalSnapshot[] = [
  {taskId:'task-1',goals:[{id:'goal-1',title:'Master Study Habit',source:'notion'}]}
 ];
 const edited=seed.tasks.find(task=>task.id===snapshot[0].taskId)!;
 edited.goals=[{id:'custom',title:'My goal',source:'local'}];
 const merged=mergeGoalSnapshot(seed,snapshot);
 assert.deepEqual(merged.tasks.find(task=>task.id===edited.id)?.goals,edited.goals);
 assert.equal(merged.tasks.filter(task=>task.goals?.length).length,1);
 assert.deepEqual(mergeGoalSnapshot(merged,snapshot),merged);
});
