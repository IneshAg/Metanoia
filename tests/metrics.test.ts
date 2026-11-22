import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryWorth,dayMetrics,metricSeries,metricValue} from '../src/metrics.ts';
import {migrateState,type State} from '../src/domain.ts';

test('daily metrics use saved tasks, active Focus time, and dated lecture events',()=>{
 const state=migrateState({version:1,importedAt:'',tasks:[
  {id:'one',title:'Read',day:'2026-11-19',start:'',end:'',minutes:60,done:true,category:'study',updated:''},
  {id:'two',title:'Walk',day:'2026-11-19',start:'',end:'',minutes:30,done:false,category:'leisure',updated:''},
  {id:'three',title:'Write',day:'2026-11-18',start:'',end:'',minutes:45,done:true,category:'coding',updated:''},
 ],courses:[],xp:0,credits:0,focus:null,sessions:[{id:'saved',started_utc:'2026-11-19T09:00:00+05:30',active_seconds:1500,state:'complete'},{id:'ignored',started_utc:'2026-11-19T10:00:00+05:30',active_seconds:600,state:'discarded'}],redemptions:[],rewards:[],habits:[],habitsPartial:false,notes:[]} as State);
 state.lessonEvents=[{id:'e',lessonId:'l',courseId:'c',day:'2026-11-19',delta:1,speed:2,knownWatchSeconds:600}];
 const day=dayMetrics(state,'2026-11-19');
 assert.deepEqual([day.totalTasks,day.completedTasks,day.plannedMinutes,day.completedWorthMinutes,day.focusedMinutes,day.learningMinutes,day.lessonsCompleted],[2,1,90,60,25,10,1]);
 assert.equal(metricValue(day,'worth'),60);
 assert.equal(metricSeries(state,'2026-11-19',2)[0].day,'2026-11-18');
 assert.deepEqual(categoryWorth(state,['2026-11-19']),[{name:'study',value:60}]);
});
