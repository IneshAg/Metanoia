import {dayKey,type State} from './domain.ts';

export type MetricKey='completed'|'worth'|'planned'|'focus'|'learning';
export type DayMetrics={day:string;totalTasks:number;completedTasks:number;plannedMinutes:number;completedWorthMinutes:number;focusedMinutes:number;learningMinutes:number;lessonsCompleted:number};
export const metricLabels:Record<MetricKey,{short:string;title:string;unit:string}>={
 completed:{short:'Done',title:'Tasks completed',unit:'tasks'},
 worth:{short:'Time worth',title:'Estimated time in completed tasks',unit:'min'},
 planned:{short:'Planned',title:'Estimated time planned',unit:'min'},
 focus:{short:'Focused',title:'Recorded active Focus time',unit:'min'},
 learning:{short:'Learning',title:'Known lecture watch time',unit:'min'},
};
export function dayMetrics(state:State,day:string):DayMetrics{
 const tasks=state.tasks.filter(task=>task.day===day);
 const completedForDay=state.tasks.filter(task=>task.done && (task.completedAt ? dayKey(new Date(task.completedAt))===day : task.day===day));
 const events=(state.lessonEvents||[]).filter(event=>event.day===day);
 return {
  day,totalTasks:tasks.length,completedTasks:completedForDay.length,
  plannedMinutes:tasks.reduce((sum,task)=>sum+(task.minutes||0),0),
  completedWorthMinutes:completedForDay.reduce((sum,task)=>sum+(task.minutes||0),0),
  focusedMinutes:Math.round(state.sessions.filter(session=>session.state==='complete'&&(session.mode==='work'||!session.mode)&&dayKey(new Date(session.started_utc))===day).reduce((sum,session)=>sum+session.active_seconds/60,0)),
  learningMinutes:Math.round(Math.max(0,events.reduce((sum,event)=>sum+(event.knownWatchSeconds||0),0))/60),
  lessonsCompleted:Math.max(0,events.reduce((sum,event)=>sum+event.delta,0)),
 };
}
export function metricValue(day:DayMetrics,key:MetricKey):number{
 return key==='completed'?day.completedTasks:key==='worth'?day.completedWorthMinutes:key==='planned'?day.plannedMinutes:key==='focus'?day.focusedMinutes:day.learningMinutes;
}
export function shiftMetricDay(day:string,offset:number):string{
 const date=new Date(day+'T12:00:00+05:30');date.setUTCDate(date.getUTCDate()+offset);return dayKey(date);
}
export function metricSeries(state:State,endDay:string,days=7):DayMetrics[]{return Array.from({length:days},(_,index)=>dayMetrics(state,shiftMetricDay(endDay,index-days+1)))}
export function categoryWorth(state:State,days:string[]):{name:string;value:number}[]{
 const selected=new Set(days);
 const totals=new Map<string,number>();
 for(const task of state.tasks){
  if(!task.done||!task.minutes)continue;
  const targetDay = task.completedAt ? dayKey(new Date(task.completedAt)) : task.day;
  if(!selected.has(targetDay))continue;
  totals.set(task.category,(totals.get(task.category)||0)+task.minutes);
 }
 return [...totals].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}
