import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,mergeLessonSnapshot,type Lesson,type State} from '../src/domain.ts';
import {dayMetrics} from '../src/metrics.ts';

test('lecture completion, speed correction, and undo update dated totals once',()=>{
 const seed: State = {
  version: 2,
  importedAt: '2026-11-20T00:00:00.000Z',
  tasks: [],
  courses: [{id:'course-1',title:'Demo Course',done:0,total:5,deadline:'',nextLesson:'Lesson 1',nextUrl:null,source:'youtube'}],
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
  {id:'lesson-1',courseId:'course-1',title:'Lesson 1',durationSeconds:1200,order:1,completed:false,speed:1}
 ];
 const original=mergeLessonSnapshot(seed,snapshot);
 const lesson=original.lessons.find(item=>!item.completed&&item.durationSeconds!==null)!;
 const starting=original.courses.find(item=>item.id===lesson.courseId)!.done;
 const first=applyAction(original,{type:'lesson.set',id:lesson.id,completed:true,speed:2},Date.parse('2026-11-19T05:00:00Z'));
 assert.equal(first.courses.find(item=>item.id===lesson.courseId)!.done,starting+1);
 assert.equal(first.lessons.find(item=>item.id===lesson.id)!.speed,2);
 assert.equal(dayMetrics(first,'2026-11-19').lessonsCompleted,1);
 assert.equal(first.lessonEvents[0].knownWatchSeconds,Math.round(lesson.durationSeconds!/2));
 const repeated=applyAction(first,{type:'lesson.set',id:lesson.id,completed:true,speed:2},Date.parse('2026-11-19T05:01:00Z'));
 assert.equal(repeated.lessonEvents.length,1);
 const corrected=applyAction(repeated,{type:'lesson.set',id:lesson.id,completed:true,speed:1.5},Date.parse('2026-11-19T05:02:00Z'));
 assert.equal(corrected.lessonEvents.length,2);
 assert.equal(dayMetrics(corrected,'2026-11-19').lessonsCompleted,1);
 assert.equal(corrected.lessonEvents[0].knownWatchSeconds!+corrected.lessonEvents[1].knownWatchSeconds!,Math.round(lesson.durationSeconds!/1.5));
 const reversed=applyAction(corrected,{type:'lesson.set',id:lesson.id,completed:false,speed:1.5},Date.parse('2026-11-19T05:03:00Z'));
 assert.equal(reversed.courses.find(item=>item.id===lesson.courseId)!.done,starting);
 assert.equal(dayMetrics(reversed,'2026-11-19').lessonsCompleted,0);
 assert.equal(dayMetrics(reversed,'2026-11-19').learningMinutes,0);
 assert.equal(original.lessons.find(item=>item.id===lesson.id)!.completed,false);
});
