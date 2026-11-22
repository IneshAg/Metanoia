export type GoalRef={id:string;title:string;source:'notion'|'local'};
export type Task={id:string;title:string;day:string;start:string;end:string;minutes:number|null;done:boolean;category:string;courseId?:string|null;goals?:GoalRef[];remoteId?:string|null;completedAt?:string|null;updated:string};
export type Course={id:string;title:string;done:number;total:number;deadline:string;nextLesson:string;nextUrl:string|null;source:string;minutesPerLesson?:number;notionUrl?:string|null};
export type Lesson={id:string;courseId:string;position:number;title:string;durationSeconds:number|null;sourceUrl:string|null;completed:boolean;completedDay?:string;speed?:number};
export type WeatherMood='rain'|'autumn'|'sunny'|'snow'|'breezy'|'none';
export type ThemeMode='light'|'dark'|'system'|'spell';
export type FocusMode='work'|'short_break'|'long_break';
export type LessonEvent={id:string;lessonId:string;courseId:string;day:string;delta:1|0|-1;speed:number;knownWatchSeconds:number|null};
export type HabitDef={id:string;name:string;archived?:boolean;scheduledDays?:number[]};
export type FocusPreset={
  id:string;
  name:string;
  workMinutes:number;
  breakMinutes:number;
  longBreakMinutes:number;
  totalRounds:number;
  autoAdvance:boolean;
  description?:string;
};
export const BUILTIN_PRESETS:FocusPreset[]=[
  {
    id:'classic',
    name:'Classic',
    workMinutes:25,
    breakMinutes:5,
    longBreakMinutes:20,
    totalRounds:4,
    autoAdvance:true,
    description:'25m focus block with 5m recovery break'
  },
  {
    id:'deep',
    name:'Deep Focus',
    workMinutes:60,
    breakMinutes:10,
    longBreakMinutes:20,
    totalRounds:1,
    autoAdvance:false,
    description:'60m uninterrupted flow with 10m recovery break'
  },
  {
    id:'extended',
    name:'Extended Focus',
    workMinutes:120,
    breakMinutes:20,
    longBreakMinutes:20,
    totalRounds:1,
    autoAdvance:false,
    description:'120m deep study block with 20m restorative break'
  }
];
export function getSuggestedBreakMinutes(workMinutes:number,completedBlocks:number=0,cumulativeFocusMinutes:number=0):{breakMinutes:number;isLong:boolean;reason:string}{
  if(workMinutes<=30){
    if(completedBlocks>=4||cumulativeFocusMinutes>=100){
      return {breakMinutes:20,isLong:true,reason:'Completed 4 focus blocks! Take a 20m restorative break 🌴'};
    }
    return {breakMinutes:5,isLong:false,reason:'5m breather to stretch and hydrate ☕'};
  }
  if(workMinutes<=75){
    if(completedBlocks>=2||cumulativeFocusMinutes>=110){
      return {breakMinutes:20,isLong:true,reason:'Substantial focused work completed! Take a 20m restorative break 🌴'};
    }
    return {breakMinutes:10,isLong:false,reason:'10m break to reset your eyes and relax ☕'};
  }
  if(workMinutes>=90){
    return {breakMinutes:20,isLong:true,reason:'Extended study block completed! Take a 20m restorative break 🌴'};
  }
  const calc=Math.min(20,Math.max(5,Math.round(workMinutes*0.2)));
  if(cumulativeFocusMinutes>=100){
    return {breakMinutes:20,isLong:true,reason:'100m+ cumulative study! Take a 20m restorative break 🌴'};
  }
  return {breakMinutes:calc,isLong:false,reason:`${calc}m break to rest and recharge ☕`};
}
export function calculatePresetTotalMinutes(preset:{workMinutes:number;breakMinutes:number;longBreakMinutes:number;totalRounds:number}):number{
  const rounds=Math.max(1,preset.totalRounds);
  const workTotal=rounds*preset.workMinutes;
  const shortBreaks=Math.max(0,rounds-1)*preset.breakMinutes;
  const longBreak=rounds>1?preset.longBreakMinutes:preset.breakMinutes;
  return workTotal+shortBreaks+longBreak;
}
export type Settings={theme:ThemeMode;palette:'forest'|'clay'|'plum'|'slate';motion:boolean;focusMinutes:number;dailyCapacityMinutes?:number;weatherMood?:WeatherMood;customColor?:string|null;shortBreakMinutes?:number;longBreakMinutes?:number;longBreakInterval?:number;autoAdvancePomodoro?:boolean;customPresets?:FocusPreset[];lastUsedPresetId?:string;streakShields?:number;unlockedAchievements?:string[];qwenRecommendationsEnabled?:boolean;soundAlerts?:boolean;desktopNotifications?:boolean;floatingTimerAlwaysOnTop?:boolean;floatingTimerMode?:'compact'|'pill';};
export type Reward={id:string;title:string;description:string;cost:number;art:string};
export type Focus={id:string;intention:string;duration:number;elapsed:number;runningSince:number|null;startedAt?:number;taskId?:string|null;courseId?:string|null;mode?:FocusMode;round?:number;totalRounds?:number;workDuration?:number;breakDuration?:number;longBreakDuration?:number;presetId?:string;targetTotalDuration?:number;interruptionCount?:number;pendingWorkSeconds?:number;autoAdvance?:boolean;completedBlocks?:number;sessionFocusSeconds?:number;sessionBreakSeconds?:number;sessionId?:string;};
export type FocusSession={id:string|number;started_utc:string;completed_utc?:string;active_seconds:number;state:string;taskId?:string|null;courseId?:string|null;intention?:string;mode?:FocusMode;round?:number;work_duration?:number;break_seconds?:number;presetId?:string;planned_duration?:number;interruption_count?:number;rating?:number;notes?:string;sessionId?:string;};
export function formatTime12h(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  } catch {
    return '';
  }
}
export function formatSessionTimeRange(startedUtc?: string | null, completedUtc?: string | null, activeSecs?: number): string {
  if (!startedUtc) return '';
  const startStr = formatTime12h(startedUtc);
  if (!startStr) return '';
  let endIso = completedUtc;
  if (!endIso && typeof activeSecs === 'number' && activeSecs >= 60) {
    try {
      endIso = new Date(new Date(startedUtc).getTime() + activeSecs * 1000).toISOString();
    } catch {}
  }
  const endStr = endIso ? formatTime12h(endIso) : '';
  if (endStr && endStr !== startStr) {
    return `${startStr} – ${endStr}`;
  }
  return startStr;
}
export type State={version:number;importedAt:string;tasks:Task[];courses:Course[];lessons:Lesson[];lessonEvents:LessonEvent[];settings:Settings;goalSnapshotApplied?:boolean;courseActivity?:{id:string;courseId:string;day:string;delta:number}[];xp:number;credits:number;focus:Focus|null;sessions:FocusSession[];redemptions:{id:string;title:string;cost:number;at:string}[];rewards:Reward[];habits:{day:string;id:string;checks:Record<string,boolean>}[];habitDefinitions?:HabitDef[];habitsPartial:boolean;notes:{id:string;title:string;created:string;modified:string;url:string}[];streakShields?:number;achievements?:string[]};
export type Action={type:string;[key:string]:unknown};
export type TaskGoalSnapshot={taskId:string;goals:GoalRef[]};
export function getHabitDefs(state:State):HabitDef[]{
 if(Array.isArray(state.habitDefinitions)&&state.habitDefinitions.length)return state.habitDefinitions;
 const latest=[...state.habits].sort((a,b)=>b.day.localeCompare(a.day))[0];
 const names=latest?Object.keys(latest.checks):[];
 return names.map(name=>({id:name.toLowerCase().replace(/[^a-z0-9]/g,'-')||'habit',name,archived:false,scheduledDays:[0,1,2,3,4,5,6]}));
}
export function migrateState(input:State,legacy?:Partial<Settings>):State{
 const state=structuredClone(input);
 state.lessons=Array.isArray(state.lessons)?state.lessons:[];
 state.lessonEvents=Array.isArray(state.lessonEvents)?state.lessonEvents:[];
 state.courseActivity=Array.isArray(state.courseActivity)?state.courseActivity:[];
 const existing=state.settings||{} as Settings;
 const rawTheme=existing.theme??legacy?.theme;
 const palette=existing.palette??legacy?.palette;
 const motion=existing.motion??legacy?.motion;
 const focusMinutes=existing.focusMinutes??legacy?.focusMinutes;
 const validThemes:ThemeMode[]=['light','dark','system','spell'];
 const theme=validThemes.includes(rawTheme as ThemeMode)?rawTheme as ThemeMode:(rawTheme==='dark'?'dark':'light');
 state.settings={theme,palette:['forest','clay','plum','slate'].includes(String(palette))?palette as Settings['palette']:'forest',motion:motion!==false,focusMinutes:Number.isInteger(focusMinutes)&&Number(focusMinutes)>=5&&Number(focusMinutes)<=180?Number(focusMinutes):25};
 if(Number.isInteger(existing.shortBreakMinutes)&&(existing.shortBreakMinutes as number)>=1&&(existing.shortBreakMinutes as number)<=60)state.settings.shortBreakMinutes=existing.shortBreakMinutes;
 if(Number.isInteger(existing.longBreakMinutes)&&(existing.longBreakMinutes as number)>=1&&(existing.longBreakMinutes as number)<=60)state.settings.longBreakMinutes=existing.longBreakMinutes;
 if(Number.isInteger(existing.longBreakInterval)&&(existing.longBreakInterval as number)>=1&&(existing.longBreakInterval as number)<=12)state.settings.longBreakInterval=existing.longBreakInterval;
 if(typeof existing.autoAdvancePomodoro==='boolean')state.settings.autoAdvancePomodoro=existing.autoAdvancePomodoro;
 if(Array.isArray(state.habitDefinitions))state.habitDefinitions=state.habitDefinitions.map(h=>({...h}));
 if(typeof existing.customColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(existing.customColor))state.settings.customColor=existing.customColor;
 if(Number.isInteger(existing.dailyCapacityMinutes)&&(existing.dailyCapacityMinutes as number)>=30&&(existing.dailyCapacityMinutes as number)<=1440)state.settings.dailyCapacityMinutes=existing.dailyCapacityMinutes;
 if(['rain','autumn','sunny','snow','breezy','none'].includes(String(existing.weatherMood)))state.settings.weatherMood=existing.weatherMood as WeatherMood;
 if(Array.isArray(existing.customPresets)){
  const bIds = new Set(BUILTIN_PRESETS.map(b => b.id.toLowerCase()));
  const bNames = new Set(BUILTIN_PRESETS.map(b => b.name.toLowerCase().trim()));
  const seenP = new Set<string>();
  state.settings.customPresets = existing.customPresets.filter(p => {
    if(!p || typeof p.id !== 'string' || typeof p.name !== 'string') return false;
    const lid = p.id.toLowerCase().trim();
    const lnm = p.name.toLowerCase().trim();
    if(bIds.has(lid) || bNames.has(lnm)) return false;
    if(seenP.has(lid) || seenP.has(lnm)) return false;
    seenP.add(lid);
    seenP.add(lnm);
    return true;
  }).map(p=>({...p}));
 }
 if(typeof existing.lastUsedPresetId==='string')state.settings.lastUsedPresetId=existing.lastUsedPresetId;
 if(typeof existing.streakShields==='number')state.settings.streakShields=existing.streakShields;
 if(Array.isArray(existing.unlockedAchievements))state.settings.unlockedAchievements=[...existing.unlockedAchievements];
 state.tasks=state.tasks.map(task=>({...task,goals:Array.isArray(task.goals)?task.goals:[]}));
 state.version=Math.max(2,state.version||0);
 return state;
}
export function mergeLessonSnapshot(input:State,snapshot:Lesson[]):State{
 const state=migrateState(input);
 const existing=new Set(state.lessons.map(lesson=>lesson.id));
 const incoming=snapshot.filter(lesson=>state.courses.some(course=>course.id===lesson.courseId)&&!existing.has(lesson.id));
 if(!incoming.length)return state;
 for(const course of state.courses){
  const lessons=incoming.filter(lesson=>lesson.courseId===course.id).sort((a,b)=>a.position-b.position).map(lesson=>({...lesson}));
  if(!lessons.length)continue;
  if(!state.lessons.some(lesson=>lesson.courseId===course.id)){
   let completed=lessons.filter(lesson=>lesson.completed).length;
   for(const lesson of lessons){if(completed>=course.done)break;if(!lesson.completed){lesson.completed=true;completed++}}
   for(const lesson of [...lessons].reverse()){if(completed<=course.done)break;if(lesson.completed){lesson.completed=false;completed--}}
  }
  state.lessons.push(...lessons);
 }
 state.lessons.sort((a,b)=>a.courseId.localeCompare(b.courseId)||a.position-b.position);
 return state;
}
export function mergeGoalSnapshot(input:State,snapshot:TaskGoalSnapshot[]):State{
 const state=migrateState(input);
 if(state.goalSnapshotApplied)return state;
 const byId=new Map(snapshot.map(item=>[item.taskId,item.goals]));
 for(const task of state.tasks){
  const goals=byId.get(task.id);
  if(goals?.length&&!task.goals?.length)task.goals=goals.map(goal=>({...goal}));
 }
 state.goalSnapshotApplied=true;
 return state;
}
export function mergeTaskRemotes(input:State,remotes:Record<string,string>):State{
 const state=migrateState(input);
 if(!remotes||typeof remotes!=='object')return state;
 for(const task of state.tasks){
  const remote=remotes[task.id];
  if(remote&&task.remoteId!==remote)task.remoteId=remote;
 }
 return state;
}
export function dayKey(date=new Date()):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function shiftDay(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function validDay(value:unknown):value is string {if(value==='')return true;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00');return !Number.isNaN(+d)&&d.getFullYear()===+value.slice(0,4)&&d.getMonth()+1===+value.slice(5,7)&&d.getDate()===+value.slice(8,10)}
export function validTime(value:unknown):value is string{return typeof value==='string'&&(value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value))}
export function activeSeconds(focus:Focus,now=Date.now()){return Math.min(focus.duration*60,focus.elapsed+(focus.runningSince===null?0:Math.max(0,Math.floor((now-focus.runningSince)/1000))))}
export function applyAction(state:State,action:Action,now=Date.now()):State{
 const s=migrateState(state);const stamp=new Date(now).toISOString();
 if(action.type==='task.save'){
  const t=action.task as Task;if(!t||typeof t.title!=='string'||!t.title.trim()||t.title.length>2000||!validDay(t.day)||!validTime(t.start)||!validTime(t.end))throw Error('Check the title, date and time.');
  if(t.start&&!t.day)throw Error('Choose a date for a timed task.');if(t.end&&(!t.start||t.end<=t.start))throw Error('End time must be after the start.');
  if(t.minutes!==null&&(!Number.isInteger(t.minutes)||t.minutes<1||t.minutes>1440))throw Error('Estimate must be 1–1440 minutes.');
  if(!['study','coding','personal','leisure'].includes(t.category))throw Error('Choose a valid category.');
  const index=s.tasks.findIndex(x=>x.id===t.id);const existing=s.tasks[index];
  const next={...t,id:existing?.id??crypto.randomUUID(),title:t.title.trim(),done:existing?.done??false,remoteId:existing?.remoteId??t.remoteId??null,completedAt:existing?.completedAt??t.completedAt??null,updated:stamp};if(index>=0)s.tasks[index]=next;else s.tasks.push(next);
 }else if(action.type==='task.set_remote'){
  const t=s.tasks.find(x=>x.id===action.id);if(t&&typeof action.remoteId==='string')t.remoteId=action.remoteId;
 }else if(action.type==='task.delete'){
  const index=s.tasks.findIndex(x=>x.id===action.id);if(index<0)throw Error('Task not found.');
  s.tasks.splice(index,1);
  if(s.focus?.taskId===action.id)s.focus=null;
 }else if(action.type==='task.toggle'){
  const t=s.tasks.find(x=>x.id===action.id);if(!t||typeof action.done!=='boolean')throw Error('Task not found.');if(t.done!==action.done){s.xp+=action.done?10:-10;t.done=action.done;t.completedAt=action.done?stamp:null;t.updated=stamp;}
 }else if(action.type==='settings.update'){
  const patch=(action.settings || (action as any).patch) as Partial<Settings>;
  if(!patch||typeof patch!=='object')throw Error('Choose valid settings.');
  const next={...s.settings,...patch};if(next.customColor===null)delete next.customColor;
  if(!['light','dark','system','spell'].includes(String(next.theme))||!['forest','clay','plum','slate'].includes(next.palette)||typeof next.motion!=='boolean'||!Number.isInteger(next.focusMinutes)||next.focusMinutes<5||next.focusMinutes>180||next.customColor!==undefined&&!/^#[0-9a-fA-F]{6}$/.test(next.customColor))throw Error('Check the appearance and Focus settings.');
  if(patch.weatherMood!==undefined&&!['rain','autumn','sunny','snow','breezy','none'].includes(String(patch.weatherMood)))throw Error('Invalid weather mood.');
  if(patch.shortBreakMinutes!==undefined&&(!Number.isInteger(patch.shortBreakMinutes)||patch.shortBreakMinutes<1||patch.shortBreakMinutes>60))throw Error('Short break must be 1–60 minutes.');
  if(patch.longBreakMinutes!==undefined&&(!Number.isInteger(patch.longBreakMinutes)||patch.longBreakMinutes<1||patch.longBreakMinutes>60))throw Error('Long break must be 1–60 minutes.');
  if(patch.longBreakInterval!==undefined&&(!Number.isInteger(patch.longBreakInterval)||patch.longBreakInterval<1||patch.longBreakInterval>12))throw Error('Long break interval must be 1–12 rounds.');
  s.settings=next;
 }else if(action.type==='habit.add'){
  const name=String(action.name||'').trim();
  if(!name)throw Error('Please provide a habit name.');
  s.habitDefinitions=getHabitDefs(s).map(h=>({...h}));
  const existing=s.habitDefinitions.find(h=>h.name.toLowerCase()===name.toLowerCase());
  if(existing){
    if(existing.archived){
      existing.archived=false;
      if(Array.isArray(action.scheduledDays))existing.scheduledDays=action.scheduledDays as number[];
    }else{
      throw Error('A habit with this name already exists.');
    }
  }else{
    s.habitDefinitions.push({
      id:crypto.randomUUID(),
      name,
      archived:false,
      scheduledDays:Array.isArray(action.scheduledDays)?action.scheduledDays as number[]:[0,1,2,3,4,5,6]
    });
  }
  for(const h of s.habits){
    if(!(name in h.checks))h.checks[name]=false;
  }
 }else if(action.type==='habit.rename'){
  const oldName=String(action.oldName||'').trim();
  const newName=String(action.newName||'').trim();
  if(!oldName||!newName)throw Error('Please provide both old and new habit names.');
  s.habitDefinitions=getHabitDefs(s).map(h=>({...h}));
  const habit=s.habitDefinitions.find(h=>h.name===oldName);
  if(habit)habit.name=newName;
  for(const h of s.habits){
    if(oldName in h.checks){
      const val=h.checks[oldName];
      delete h.checks[oldName];
      h.checks[newName]=val;
    }
  }
 }else if(action.type==='habit.archive'){
  const name=String(action.name||'').trim();
  s.habitDefinitions=getHabitDefs(s).map(h=>({...h}));
  const habit=s.habitDefinitions.find(h=>h.name===name);
  if(habit)habit.archived=true;
 }else if(action.type==='habit.restore'){
  const name=String(action.name||'').trim();
  s.habitDefinitions=getHabitDefs(s).map(h=>({...h}));
  const habit=s.habitDefinitions.find(h=>h.name===name);
  if(habit)habit.archived=false;
 }else if(action.type==='habit.begin'){
  if(!validDay(action.day)||!action.day)throw Error('Choose a valid habit date.');
  if(s.habits.some(d=>d.day===action.day))return s;
  const defs=getHabitDefs(s).filter(h=>!h.archived);
  const names=defs.length ? defs.map(h=>h.name) : (([...s.habits].sort((a,b)=>b.day.localeCompare(a.day))[0]) ? Object.keys([...s.habits].sort((a,b)=>b.day.localeCompare(a.day))[0].checks) : []);
  if(!names.length)throw Error('No habit definitions are available.');
  s.habits.push({id:crypto.randomUUID(),day:action.day,checks:Object.fromEntries(names.map(name=>[name,false]))});
 }else if(action.type==='habit.set'){
  if(!validDay(action.day)||!action.day||typeof action.name!=='string'||typeof action.done!=='boolean')throw Error('Choose a valid habit check-in.');
  const defs=getHabitDefs(s).filter(h=>!h.archived);
  const latest=[...s.habits].sort((a,b)=>b.day.localeCompare(a.day))[0];
  const knownNames=new Set([...defs.map(h=>h.name), ...(latest?Object.keys(latest.checks):[])]);
  if(!knownNames.has(action.name))throw Error('Habit not found.');
  let record=s.habits.find(d=>d.day===action.day);
  if(!record){
    const names=defs.length ? defs.map(h=>h.name) : (latest?Object.keys(latest.checks):[]);
    record={id:crypto.randomUUID(),day:action.day,checks:Object.fromEntries(names.map(name=>[name,false]))};
    s.habits.push(record);
  }
  if(!(action.name in record.checks)){
    record.checks[action.name]=false;
  }
  record.checks[action.name]=action.done;
 }else if(action.type==='habit.toggle'){
  const day=s.habits.find(d=>d.id===action.id);const name=String(action.name);if(!day||!(name in day.checks)||typeof action.done!=='boolean')throw Error('Habit record not found.');day.checks[name]=action.done;
 }else if(action.type==='habit.set_page_id'){
  const h=s.habits.find(x=>x.day===action.day);if(h&&typeof action.pageId==='string')h.id=action.pageId;
 }else if(action.type==='habit.merge_notion'){
  const incoming = action.records as Array<{id: string; day: string; checks: Record<string, boolean>}>;
  if(Array.isArray(incoming)){
    const defs=getHabitDefs(s).filter(h=>!h.archived);
    const defaultChecks = Object.fromEntries(defs.map(h=>[h.name, false]));
    for(const inc of incoming){
      if(!validDay(inc.day)||!inc.day) continue;
      const existing = s.habits.find(h => h.day === inc.day);
      if(existing){
        if(inc.id) existing.id = inc.id;
        existing.checks = { ...defaultChecks, ...existing.checks, ...inc.checks };
      }else{
        s.habits.push({
          id: inc.id || crypto.randomUUID(),
          day: inc.day,
          checks: { ...defaultChecks, ...inc.checks }
        });
      }
    }
    s.habits.sort((a,b) => b.day.localeCompare(a.day));
  }
 }else if(action.type==='course.save'){
  const c=action.course as Course;
  const deadline=typeof c?.deadline==='string'?c.deadline:'';
  const minutesPerLesson=Number.isInteger(c?.minutesPerLesson)&&Number(c.minutesPerLesson)>=1&&Number(c.minutesPerLesson)<=1440?Number(c.minutesPerLesson):25;
  if(!c||typeof c.title!=='string'||!c.title.trim()||c.title.length>300||!Number.isInteger(c.total)||c.total<1||c.total>10000||!Number.isInteger(c.done)||c.done<0||c.done>c.total||!validDay(deadline))throw Error('Check the course title, lessons and time estimate.');
  if(c.nextUrl && typeof c.nextUrl === 'string' && c.nextUrl.trim() && c.source !== 'local'){
    const nu = c.nextUrl.trim();
    const isLocalPath = nu.startsWith('file://') || /^[a-zA-Z]:[\\/]/.test(nu) || nu.startsWith('/') || nu.startsWith('\\') || nu.includes('\\');
    if(!isLocalPath){
      try{
        const u = new URL(nu);
        if(!['http:','https:'].includes(u.protocol)) throw Error();
      }catch{
        throw Error('Use a valid web link or file path for the next lesson.');
      }
    }
  }
  const rawNotion = typeof c.notionUrl === 'string' ? c.notionUrl.trim() : '';
  if(rawNotion){
    if(!rawNotion.startsWith('notion://') && !rawNotion.startsWith('https://') && !rawNotion.startsWith('http://')){
      throw Error('Notion link must start with https:// or notion://');
    }
  }
  const index=s.courses.findIndex(x=>x.id===c.id);
  const id=(index>=0?s.courses[index].id:c.id)||crypto.randomUUID();
  const next:Course={
    ...c,
    id,
    title:c.title.trim(),
    deadline,
    minutesPerLesson,
    nextUrl: typeof c.nextUrl === 'string' && c.nextUrl.trim() ? c.nextUrl.trim() : null,
    notionUrl: rawNotion || null
  };
  if(index>=0){const delta=next.done-s.courses[index].done;if(delta){s.courseActivity??=[];s.courseActivity.push({id:crypto.randomUUID(),courseId:next.id,day:dayKey(new Date(now)),delta});}s.courses[index]=next;}else s.courses.push(next);
 }else if(action.type==='course.import_local'){
  const title=String(action.title||'').trim();
  const rawLessons=Array.isArray(action.lessons)?action.lessons:[];
  if(!title||title.length>300)throw Error('Please provide a course title.');
  if(!rawLessons.length)throw Error('No videos to import.');
  const courseId='local-'+crypto.randomUUID().slice(0,8);
  const newCourse:Course={
    id:courseId,
    title,
    done:0,
    total:rawLessons.length,
    deadline:'',
    nextLesson:rawLessons[0]?.title||'Lecture 1',
    nextUrl:rawLessons[0]?.sourceUrl||null,
    source:'local',
    minutesPerLesson:20,
    notionUrl:action.notionUrl?String(action.notionUrl).trim():null,
  };
  s.courses.push(newCourse);
  rawLessons.forEach((item:any,idx:number)=>{
    s.lessons.push({
      id:`lesson-${courseId}-${idx+1}`,
      courseId,
      position:idx+1,
      title:String(item.title||`Lecture ${idx+1}`).trim().slice(0,300),
      durationSeconds:typeof item.durationSeconds==='number'&&item.durationSeconds>0?Math.round(item.durationSeconds):null,
      sourceUrl:item.sourceUrl?String(item.sourceUrl):null,
      completed:false,
      speed:1,
    });
  });
 }else if(action.type==='course.progress'){
  const c=s.courses.find(x=>x.id===action.id);if(!c||typeof action.done!=='number'||!Number.isInteger(action.done)||action.done<0||action.done>c.total)throw Error('Choose valid course progress.');const delta=action.done-c.done;c.done=action.done;if(delta){s.courseActivity??=[];s.courseActivity.push({id:crypto.randomUUID(),courseId:c.id,day:dayKey(new Date(now)),delta});}
 }else if(action.type==='lesson.set'){
  const lesson=s.lessons.find(item=>item.id===action.id);
  if(!lesson)throw Error('Lecture not found.');
  const course=s.courses.find(item=>item.id===lesson.courseId);
  if(!course)throw Error('Course not found.');
  if(typeof action.completed!=='boolean')throw Error('Choose a completion state.');
  const speed=Number(action.speed);
  if(![1,1.25,1.5,1.75,2].includes(speed))throw Error('Choose a supported playback speed.');
  const day=dayKey(new Date(now));
  const wasCompleted=lesson.completed;
  const previousSpeed=lesson.speed||1;
  if(wasCompleted===action.completed&&previousSpeed===speed)return s;
  lesson.completed=action.completed;
  lesson.speed=speed;
  if(wasCompleted!==lesson.completed){
   lesson.completedDay=lesson.completed?day:undefined;
   course.done=Math.max(0,Math.min(course.total,course.done+(lesson.completed?1:-1)));
   const delta=lesson.completed?1:-1;
   s.lessonEvents.push({id:crypto.randomUUID(),lessonId:lesson.id,courseId:course.id,day,delta,speed,knownWatchSeconds:lesson.durationSeconds===null?null:Math.round(delta*lesson.durationSeconds/speed)});
   s.courseActivity??=[];s.courseActivity.push({id:crypto.randomUUID(),courseId:course.id,day,delta});
  }else if(lesson.completed&&lesson.durationSeconds!==null){
   s.lessonEvents.push({id:crypto.randomUUID(),lessonId:lesson.id,courseId:course.id,day,delta:0,speed,knownWatchSeconds:Math.round(lesson.durationSeconds/speed)-Math.round(lesson.durationSeconds/previousSpeed)});
  }
 }else if(action.type==='course.deadline'){
  const c=s.courses.find(x=>x.id===action.id);if(!c||!validDay(action.day))throw Error('Choose a valid deadline.');c.deadline=action.day;
 }else if(action.type==='reward.redeem'){
  if(typeof action.requestId!=='string')throw Error('Missing redemption key.');if(s.redemptions.some(x=>x.id===action.requestId))return s;
  const r=s.rewards.find(x=>x.id===action.id);if(!r)throw Error('Reward unavailable.');if(s.credits<r.cost)throw Error('Not enough credits yet.');s.credits-=r.cost;s.redemptions.push({id:action.requestId,title:r.title,cost:r.cost,at:stamp});
 }else if(action.type==='focus.start'){
  if(s.focus)throw Error('A Focus session already exists.');
  const minutes=Number(action.minutes);
  if(!Number.isInteger(minutes)||minutes<1||minutes>180)throw Error('Choose 1–180 minutes.');
  const taskId=action.taskId?String(action.taskId):null;
  if(taskId&&!s.tasks.some(task=>task.id===taskId))throw Error('Choose an available task.');
  const courseId=action.courseId?String(action.courseId):null;
  if(courseId&&!s.courses.some(c=>c.id===courseId))throw Error('Choose an available course.');
  const mode:FocusMode=(action.mode==='short_break'||action.mode==='long_break')?action.mode:'work';
  const round=Number.isInteger(action.round)&&Number(action.round)>=1?Number(action.round):1;
  const totalRounds=Number.isInteger(action.totalRounds)&&Number(action.totalRounds)>=1?Number(action.totalRounds):(s.settings.longBreakInterval||4);
  const workDuration=Number.isInteger(action.workDuration)&&Number(action.workDuration)>=1?Number(action.workDuration):(mode==='work'?minutes:(s.settings.focusMinutes||25));
  const breakDuration=Number.isInteger(action.breakDuration)&&Number(action.breakDuration)>=1?Number(action.breakDuration):(s.settings.shortBreakMinutes||5);
  const longBreakDuration=Number.isInteger(action.longBreakDuration)&&Number(action.longBreakDuration)>=1?Number(action.longBreakDuration):(s.settings.longBreakMinutes||(workDuration===20?25:15));
  const presetId=typeof action.presetId==='string'?action.presetId:(mode==='work'?(minutes===25?'classic':minutes===60?'deep':minutes===120?'extended':'custom'):undefined);
  const targetTotalDuration=Number(action.targetTotalDuration)||calculatePresetTotalMinutes({workMinutes:workDuration,breakMinutes:breakDuration,longBreakMinutes:longBreakDuration,totalRounds});
  const autoAdvance=typeof action.autoAdvance==='boolean'?action.autoAdvance:(s.settings.autoAdvancePomodoro!==false);

  if(presetId){
    s.settings.lastUsedPresetId=presetId;
  }

  const sessionId = typeof action.sessionId === 'string' && action.sessionId ? action.sessionId : crypto.randomUUID();

  s.focus={
    id:crypto.randomUUID(),
    sessionId,
    intention:String(action.intention||s.tasks.find(task=>task.id===taskId)?.title||s.courses.find(c=>c.id===courseId)?.title||(mode==='work'?'Quick Focus':'Break')).slice(0,2000),
    duration:minutes,
    elapsed:0,
    runningSince:now,
    startedAt:now,
    taskId,
    courseId,
    mode,
    round,
    totalRounds,
    workDuration,
    breakDuration,
    longBreakDuration,
    presetId,
    targetTotalDuration,
    interruptionCount:0,
    autoAdvance
  };
 }else if(action.type==='focus.pause'||action.type==='focus.resume'){
  if(!s.focus)throw Error('No Focus session.');
  if(action.type==='focus.resume' && (s.focus.mode==='short_break'||s.focus.mode==='long_break') && action.stayInBreak!==true){
    const cur=s.focus;
    const startMs=cur.startedAt??now;
    const wallClockSecs=Math.max(0,Math.floor((now-startMs)/1000));
    const breakSecs=Math.max(activeSeconds(cur,now),wallClockSecs,1);
    s.sessions.push({
      id:cur.id,
      started_utc:new Date(startMs).toISOString(),
      completed_utc:new Date(now).toISOString(),
      active_seconds:breakSecs,
      break_seconds:0,
      state:'complete',
      taskId:cur.taskId,
      courseId:cur.courseId,
      intention:cur.intention,
      mode:cur.mode,
      round:cur.round||1,
      work_duration:cur.duration,
      presetId:cur.presetId
    });

    const prevWork=[...s.sessions].reverse().find(x=>x.mode==='work'&&x.round===cur.round);
    const plannedWorkSecs=(cur.workDuration||s.settings.focusMinutes||25)*60;
    let remainingWorkSecs=cur.pendingWorkSeconds;
    if(!remainingWorkSecs&&prevWork){
      const doneSecs=prevWork.active_seconds||0;
      if(doneSecs<plannedWorkSecs-60){
        remainingWorkSecs=plannedWorkSecs-doneSecs;
      }
    }
    const nextDuration=remainingWorkSecs&&remainingWorkSecs>=60?Math.ceil(remainingWorkSecs/60):(cur.workDuration||s.settings.focusMinutes||25);
    const isSameRound=Boolean(remainingWorkSecs&&remainingWorkSecs>=60);
    const nextRound=isSameRound?(cur.round||1):(cur.mode==='long_break'?1:(cur.round||1)+1);
    const taskTitle=cur.taskId?(s.tasks.find(t=>t.id===cur.taskId)?.title||'Focused work'):(cur.courseId?(s.courses.find(c=>c.id===cur.courseId)?.title||'Course Study'):'Focused work');

    s.focus={
      id:crypto.randomUUID(),
      intention:taskTitle,
      duration:nextDuration,
      elapsed:0,
      runningSince:now,
      startedAt:now,
      taskId:cur.taskId,
      courseId:cur.courseId,
      mode:'work',
      round:nextRound,
      totalRounds:cur.totalRounds,
      workDuration:cur.workDuration,
      breakDuration:cur.breakDuration,
      longBreakDuration:cur.longBreakDuration,
      presetId:cur.presetId,
      targetTotalDuration:cur.targetTotalDuration,
      autoAdvance:cur.autoAdvance
    };
  } else {
    s.focus.elapsed=activeSeconds(s.focus,now);
    if(action.type==='focus.pause'){
      s.focus.interruptionCount=(s.focus.interruptionCount||0)+1;
    }
    s.focus.runningSince=action.type==='focus.resume'?now:null;
  }
 }else if(action.type==='focus.set_round'){
  if(!s.focus)throw Error('No Focus session.');
  const r=Number(action.round);
  if(!Number.isInteger(r)||r<1||r>20)throw Error('Invalid round number.');
  s.focus.round=r;
 }else if(action.type==='focus.restart'){
  if(!s.focus)throw Error('No Focus session.');
  s.focus.elapsed=0;
  s.focus.runningSince=null;
  s.focus.startedAt=now;
 }else if(action.type==='focus.discard'){
  if(!s.focus)throw Error('No Focus session.');
  s.focus=null;
 }else if(action.type==='session.delete'){
  const id=action.id;
  if(!id)throw Error('Missing session id.');
  const idx=s.sessions.findIndex(x=>String(x.id)===String(id));
  if(idx>=0){
    const del=s.sessions[idx];
    if(del.mode==='work'&&del.active_seconds>=1200){
      s.xp=Math.max(0,s.xp-25);
      s.credits=Math.max(0,s.credits-5);
    }
    s.sessions.splice(idx,1);
  }
 }else if(action.type==='focus.extend'){
  if(!s.focus)throw Error('No Focus session.');
  const addMins=Number(action.minutes)||5;
  s.focus.duration+=addMins;
 }else if(action.type==='focus.early_break'){
  if(!s.focus)throw Error('No Focus session.');
  const cur=s.focus;
  if(cur.mode==='short_break'||cur.mode==='long_break')throw Error('Already on a break.');
  const activeSecs=activeSeconds(cur,now);
  const totalTargetSecs=cur.duration*60;
  const remainingWorkSecs=Math.max(0,totalTargetSecs-activeSecs);
  const breakMins=Number(action.breakMinutes)||(cur.breakDuration||s.settings.shortBreakMinutes||5);
  const isLong=action.longBreak===true;
  if(activeSecs>=60){
    const startMs=cur.startedAt??now;
    s.sessions.push({
      id:cur.id,
      sessionId:cur.sessionId||cur.id,
      started_utc:new Date(startMs).toISOString(),
      completed_utc:new Date(now).toISOString(),
      active_seconds:activeSecs,
      break_seconds:0,
      state:'complete',
      taskId:cur.taskId,
      courseId:cur.courseId,
      intention:cur.intention,
      mode:'work',
      round:cur.round||1,
      work_duration:Math.round(activeSecs/60),
      presetId:cur.presetId,
      interruption_count:cur.interruptionCount||0
    });
    if(activeSecs>=1200){s.xp+=25;s.credits+=5;}
  }
  s.focus={
    id:crypto.randomUUID(),
    sessionId:cur.sessionId||cur.id,
    intention:isLong?'🌴 Long Break · Recharge & Move':'☕ Early Break · Rest & Recharge',
    duration:breakMins,
    elapsed:0,
    runningSince:now,
    startedAt:now,
    taskId:cur.taskId,
    courseId:cur.courseId,
    mode:isLong?'long_break':'short_break',
    round:cur.round||1,
    totalRounds:cur.totalRounds,
    workDuration:cur.workDuration,
    breakDuration:cur.breakDuration,
    longBreakDuration:cur.longBreakDuration,
    presetId:cur.presetId,
    targetTotalDuration:cur.targetTotalDuration,
    pendingWorkSeconds:remainingWorkSecs,
    autoAdvance:cur.autoAdvance
  };
 }else if(action.type==='focus.skip_break'){
  if(!s.focus)throw Error('No Focus session.');
  const cur=s.focus;
  if(cur.mode!=='short_break'&&cur.mode!=='long_break')throw Error('Not on a break.');
  const nextRound=(cur.pendingWorkSeconds&&cur.pendingWorkSeconds>30)?(cur.round||1):(cur.mode==='long_break'?1:(cur.round||1)+1);
  const workDuration=(cur.pendingWorkSeconds&&cur.pendingWorkSeconds>30)?Math.ceil(cur.pendingWorkSeconds/60):(cur.workDuration||s.settings.focusMinutes||25);
  const taskTitle=cur.taskId?(s.tasks.find(t=>t.id===cur.taskId)?.title||'Focused work'):(cur.courseId?(s.courses.find(c=>c.id===cur.courseId)?.title||'Course Study'):'Focused work');
  s.focus={
    id:crypto.randomUUID(),
    sessionId:cur.sessionId||cur.id,
    intention:taskTitle,
    duration:workDuration,
    elapsed:0,
    runningSince:now,
    startedAt:now,
    taskId:cur.taskId,
    courseId:cur.courseId,
    mode:'work',
    round:nextRound,
    totalRounds:cur.totalRounds,
    workDuration:cur.workDuration,
    breakDuration:cur.breakDuration,
    longBreakDuration:cur.longBreakDuration,
    presetId:cur.presetId,
    targetTotalDuration:cur.targetTotalDuration,
    autoAdvance:cur.autoAdvance
  };
 }else if(action.type==='focus.postpone_break'){
  if(!s.focus)throw Error('No Focus session.');
  const addMins=Number(action.minutes)||5;
  s.focus.duration+=addMins;
 }else if(action.type==='focus.next_phase'){
  if(!s.focus)throw Error('No Focus session.');
  const cur=s.focus;
  const currentMode=cur.mode||'work';
  const isBreak=currentMode==='short_break'||currentMode==='long_break';
  const currentRound=cur.round||1;
  const totalRounds=cur.totalRounds||(s.settings.longBreakInterval||4);
  const workDuration=cur.workDuration||s.settings.focusMinutes||25;
  const startMs=cur.startedAt??now;
  const wallClockSecs=Math.max(0,Math.floor((now-startMs)/1000));
  const rawActiveSecs=activeSeconds(cur,now);
  const actionSecs=typeof action.actualSeconds==='number'&&action.actualSeconds>0?Math.round(action.actualSeconds):0;
  const maxBreakSecs=isBreak?(cur.duration*60)+120:0;
  const secs=isBreak?Math.min(Math.max(actionSecs,rawActiveSecs,1),maxBreakSecs):(actionSecs>0?actionSecs:rawActiveSecs);
  const pauseOrBreakSecs=isBreak?0:Math.max(0,wallClockSecs-secs);
  const startedUtc=new Date(startMs).toISOString();
  const completedUtc=isBreak?new Date(startMs+secs*1000).toISOString():new Date(now).toISOString();

  const todayStr=dayKey(new Date(now));
  const prevWorkIdx=currentMode==='work'?[...s.sessions].reverse().findIndex(x=>x.mode==='work'&&x.round===currentRound&&String(x.started_utc||'').startsWith(todayStr)):-1;
  const actualPrevIdx=prevWorkIdx>=0?s.sessions.length-1-prevWorkIdx:-1;

  if(currentMode==='work'&&actualPrevIdx>=0&&(cur.pendingWorkSeconds!==undefined||(cur.workDuration&&cur.duration<cur.workDuration))){
    // Resumed ongoing session: merge with previous segment so it stays ONE continuous session!
    s.sessions[actualPrevIdx].active_seconds+=secs;
    s.sessions[actualPrevIdx].break_seconds=(s.sessions[actualPrevIdx].break_seconds||0)+pauseOrBreakSecs;
    s.sessions[actualPrevIdx].completed_utc=completedUtc;
    s.sessions[actualPrevIdx].work_duration=cur.workDuration||Math.round(s.sessions[actualPrevIdx].active_seconds/60);
  }else{
    s.sessions.push({
      id:cur.id,
      sessionId:cur.sessionId||cur.id,
      started_utc:startedUtc,
      completed_utc:completedUtc,
      active_seconds:secs,
      break_seconds:pauseOrBreakSecs,
      state:'complete',
      taskId:cur.taskId,
      courseId:cur.courseId,
      intention:cur.intention,
      mode:currentMode,
      round:currentRound,
      work_duration:cur.duration,
      presetId:cur.presetId,
      interruption_count:cur.interruptionCount||0
    });
  }

  if(currentMode==='work'){
    if(secs>=1200){s.xp+=25;s.credits+=5;}
    const prevSessionFocus=(cur.sessionFocusSeconds||0)+secs;
    const completedBlocks=(cur.completedBlocks||0)+1;
    const suggested=getSuggestedBreakMinutes(workDuration,completedBlocks,Math.round(prevSessionFocus/60));
    const isLongBreak=action.longBreak===true||action.breakMode==='long_break'||suggested.isLong;
    const breakMode:FocusMode=isLongBreak?'long_break':'short_break';
    const breakMinutes=Number(action.breakMinutes)||(isLongBreak?(cur.longBreakDuration||s.settings.longBreakMinutes||suggested.breakMinutes):(cur.breakDuration||s.settings.shortBreakMinutes||suggested.breakMinutes));
    s.focus={
      id:crypto.randomUUID(),
      sessionId:cur.sessionId||cur.id,
      intention:isLongBreak?'🌴 Long Break · Recharge & Move':'☕ Break · Rest & Hydrate',
      duration:breakMinutes,
      elapsed:0,
      runningSince:now,
      startedAt:now,
      taskId:cur.taskId,
      courseId:cur.courseId,
      mode:breakMode,
      round:currentRound,
      totalRounds,
      workDuration,
      breakDuration:cur.breakDuration,
      longBreakDuration:cur.longBreakDuration,
      presetId:cur.presetId,
      targetTotalDuration:cur.targetTotalDuration,
      autoAdvance:cur.autoAdvance,
      completedBlocks,
      sessionFocusSeconds:prevSessionFocus
    };
  }else{
    // Break completed: advance to next block UNLESS there was unfinished focus time preserved
    const hasPendingWork=(cur.pendingWorkSeconds&&cur.pendingWorkSeconds>30);
    const nextRound=hasPendingWork?currentRound:(currentMode==='long_break'?1:(currentRound+1));
    const nextDuration=hasPendingWork?Math.ceil(cur.pendingWorkSeconds!/60):workDuration;
    const taskTitle=cur.taskId?(s.tasks.find(t=>t.id===cur.taskId)?.title||'Focused work'):(cur.courseId?(s.courses.find(c=>c.id===cur.courseId)?.title||'Course Study'):'Focused work');
    s.focus={
      id:crypto.randomUUID(),
      sessionId:cur.sessionId||cur.id,
      intention:taskTitle,
      duration:nextDuration,
      elapsed:0,
      runningSince:now,
      startedAt:now,
      taskId:cur.taskId,
      courseId:cur.courseId,
      mode:'work',
      round:nextRound,
      totalRounds:cur.totalRounds,
      workDuration:cur.workDuration,
      breakDuration:cur.breakDuration,
      longBreakDuration:cur.longBreakDuration,
      presetId:cur.presetId,
      targetTotalDuration:cur.targetTotalDuration,
      autoAdvance:cur.autoAdvance,
      completedBlocks:cur.completedBlocks,
      sessionFocusSeconds:cur.sessionFocusSeconds
    };
  }
 }else if(action.type==='focus.finish'){
  if(!s.focus)return s;
  const cur=s.focus;
  const currentMode=cur.mode||'work';
  const isBreak=currentMode==='short_break'||currentMode==='long_break';
  const startMs=cur.startedAt??now;
  const wallClockSecs=Math.max(0,Math.floor((now-startMs)/1000));
  const rawActiveSecs=activeSeconds(cur,now);
  const actionSecs=typeof action.actualSeconds==='number'&&action.actualSeconds>0?Math.round(action.actualSeconds):0;
  const maxBreakSecs=isBreak?(cur.duration*60)+120:0;
  const secs=isBreak?Math.min(Math.max(actionSecs,rawActiveSecs,1),maxBreakSecs):(actionSecs>0?actionSecs:rawActiveSecs);
  const pauseOrBreakSecs=isBreak?0:Math.max(0,wallClockSecs-secs);
  const startedUtc=new Date(startMs).toISOString();
  const completedUtc=isBreak?new Date(startMs+secs*1000).toISOString():new Date(now).toISOString();
  const todayStr=dayKey(new Date(now));
  const prevWorkIdx=currentMode==='work'?[...s.sessions].reverse().findIndex(x=>x.mode==='work'&&x.round===(cur.round||1)&&String(x.started_utc||'').startsWith(todayStr)):-1;
  const actualPrevIdx=prevWorkIdx>=0?s.sessions.length-1-prevWorkIdx:-1;

  if(currentMode==='work'&&actualPrevIdx>=0&&(cur.pendingWorkSeconds!==undefined||(cur.workDuration&&cur.duration<cur.workDuration))){
    // Ongoing session continuation: merge into the same round's record
    s.sessions[actualPrevIdx].active_seconds+=secs;
    s.sessions[actualPrevIdx].break_seconds=(s.sessions[actualPrevIdx].break_seconds||0)+pauseOrBreakSecs;
    s.sessions[actualPrevIdx].completed_utc=completedUtc;
    s.sessions[actualPrevIdx].work_duration=cur.workDuration||Math.round(s.sessions[actualPrevIdx].active_seconds/60);
  }else{
    s.sessions.push({
      id:cur.id,
      sessionId:cur.sessionId||cur.id,
      started_utc:startedUtc,
      completed_utc:completedUtc,
      active_seconds:secs,
      break_seconds:pauseOrBreakSecs,
      state:'complete',
      taskId:cur.taskId,
      courseId:cur.courseId,
      intention:cur.intention,
      mode:currentMode,
      round:cur.round||1,
      work_duration:cur.duration,
      presetId:cur.presetId,
      interruption_count:cur.interruptionCount||0
    });
  }
  if(currentMode==='work'&&secs>=1200){s.xp+=25;s.credits+=5;}
  s.focus=null;
 }else if(action.type==='focus.save_preset'){
  const p=action.preset as FocusPreset;
  if(!p||typeof p.name!=='string'||!p.name.trim())throw Error('Preset must have a name.');
  const bIds = new Set(BUILTIN_PRESETS.map(b => b.id.toLowerCase()));
  const bNames = new Set(BUILTIN_PRESETS.map(b => b.name.toLowerCase().trim()));
  if(bIds.has(p.id.toLowerCase()) || bNames.has(p.name.toLowerCase().trim())){
    throw Error('Cannot overwrite a built-in preset.');
  }
  s.settings.customPresets=Array.isArray(s.settings.customPresets)?s.settings.customPresets:[];
  const idx=s.settings.customPresets.findIndex(x=>x.id===p.id);
  if(idx>=0)s.settings.customPresets[idx]=p;
  else s.settings.customPresets.push(p);
  s.settings.lastUsedPresetId=p.id;
 }else if(action.type==='focus.delete_preset'){
  const id=String(action.id);
  s.settings.customPresets=(s.settings.customPresets||[]).filter(x=>x.id!==id);
  if(s.settings.lastUsedPresetId===id)s.settings.lastUsedPresetId='classic';
 }else if(action.type==='focus.review'){
  const sessionId=action.sessionId;
  const session=s.sessions.find(x=>x.id===sessionId);
  if(session){
    if(typeof action.rating==='number')session.rating=Math.min(5,Math.max(1,Math.round(action.rating)));
    if(typeof action.notes==='string')session.notes=action.notes.slice(0,1000);
  }
  if(action.markTaskDone&&action.taskId){
    const task=s.tasks.find(t=>t.id===action.taskId);
    if(task&&!task.done){
      task.done=true;
      task.completedAt=new Date(now).toISOString();
      s.xp+=10;
      s.credits+=2;
    }
  }
 }else if(action.type==='streak.use_shield'){
  if((s.streakShields||0)<=0)throw Error('No streak shields available.');
  s.streakShields=(s.streakShields||0)-1;
  s.settings.streakShields=s.streakShields;
 }else throw Error('Unsupported action.');return s;
}
