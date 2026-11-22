import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronDown,Clock3,Search,X,BookOpen,Play,FileText,ExternalLink} from 'lucide-react';
import {dayKey,type Action,type Course,type Lesson,type LessonEvent} from './domain';

const speeds=[1,1.25,1.5,1.75,2];
function duration(seconds:number|null){
  if(seconds===null)return 'Time unknown';
  const minutes=Math.floor(seconds/60);
  return `${minutes}:${String(seconds%60).padStart(2,'0')}`;
}
function longDuration(seconds:number){
  const minutes=Math.round(seconds/60);
  return minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes} min`;
}

export default function CourseDetail({
  course,
  lessons,
  events,
  close,
  edit,
  act,
  openLink,
  openNotionLink,
  busy
}:{
  course:Course;
  lessons:Lesson[];
  events:LessonEvent[];
  close:()=>void;
  edit:()=>void;
  act:(action:Action,message:string)=>Promise<boolean|undefined>;
  openLink:(url:string)=>Promise<void>;
  openNotionLink:(course:Course)=>void;
  busy:boolean;
}){
  const ref=useRef<HTMLDialogElement>(null);
  const [query,setQuery]=useState('');
  const [scope,setScope]=useState<'all'|'next'|'completed'>('all');
  const [shown,setShown]=useState(100);
  const [selectedSpeed,setSelectedSpeed]=useState(1);
  const [draftSpeeds,setDraftSpeeds]=useState<Record<string,number>>({});

  useEffect(()=>{ref.current?.showModal()},[]);

  const ordered=useMemo(()=>[...lessons].sort((a,b)=>a.position-b.position),[lessons]);
  const next=ordered.find(lesson=>!lesson.completed);
  const remaining=ordered.filter(lesson=>!lesson.completed);
  const completedList=ordered.filter(lesson=>lesson.completed);
  const knownSeconds=remaining.reduce((sum,lesson)=>sum+(lesson.durationSeconds||0),0);
  const totalKnownSeconds=ordered.reduce((sum,lesson)=>sum+(lesson.durationSeconds||0),0);
  const unknown=remaining.filter(lesson=>lesson.durationSeconds===null).length;

  const today=dayKey();
  const todaysEvents=events.filter(event=>event.day===today);
  const todayCount=Math.max(0,todaysEvents.reduce((sum,event)=>sum+event.delta,0));
  const todaySeconds=Math.max(0,todaysEvents.reduce((sum,event)=>sum+(event.knownWatchSeconds||0),0));

  const filtered=ordered.filter(lesson=>{
    if(scope==='next'&&lesson.completed)return false;
    if(scope==='completed'&&!lesson.completed)return false;
    return `${lesson.position} ${lesson.title}`.toLowerCase().includes(query.toLowerCase());
  });

  const visible=filtered.slice(0,shown);

  const setLesson=(lesson:Lesson,completed:boolean)=>act(
    {type:'lesson.set',id:lesson.id,completed,speed:draftSpeeds[lesson.id]||lesson.speed||1},
    completed?'Lecture completed and saved':'Lecture reopened'
  );

  return (
    <dialog ref={ref} className="course-dialog" onCancel={event=>{event.preventDefault();close()}} onClick={event=>{if(event.target===ref.current)close()}}>
      <div className="course-detail-shell">
        <header className="course-detail-header">
          <div>
            <div className="course-header-tags">
              <span className="eyebrow">{course.source==='youtube'?'YOUTUBE COURSE':course.source==='local'?'LOCAL FOLDER':'PERSONAL PATH'}</span>
              <span className="course-badge-pill">{ordered.length || course.total} Total Lectures</span>
            </div>
            <h2>{course.title}</h2>
            <p>{course.done} of {course.total} lectures completed ({Math.round(course.done/Math.max(1,course.total)*100)}%)</p>
          </div>
          <div className="course-header-actions">
            <button 
              type="button" 
              className="course-notion-btn-header" 
              title="Open linked Notion Notebook in Notion Desktop"
              onClick={()=>openNotionLink(course)}
            >
              <FileText size={15}/> {course.notionUrl ? 'Notion Notebook' : 'Link Notion'}
            </button>
            <button aria-label="Close course" className="icon-button" onClick={close}><X/></button>
          </div>
        </header>

        <div className="course-detail-metrics">
          <div>
            <span>Up next</span>
            <strong>{next ? `#${next.position} · ${next.title.slice(0, 32)}${next.title.length > 32 ? '…' : ''}` : 'All caught up!'}</strong>
          </div>
          <div>
            <span>Remaining at {selectedSpeed}×</span>
            <strong>{knownSeconds ? longDuration(Math.round(knownSeconds / selectedSpeed)) : '—'}</strong>
            <small>{unknown ? `${unknown} unknown times` : totalKnownSeconds ? `Total ${longDuration(totalKnownSeconds)}` : 'No lecture durations'}</small>
          </div>
          <div>
            <span>Today's Study</span>
            <strong>{todayCount} lecture{todayCount===1?'':'s'}</strong>
            <small>{todaySeconds ? `${longDuration(todaySeconds)} watched` : 'No study logged today'}</small>
          </div>
        </div>

        {next && (
          <div className="course-next-lesson">
            <div>
              <span className="eyebrow">READY TO RESUME</span>
              <h3>#{next.position} {next.title}</h3>
              <p>Lecture {next.position} of {course.total} · {duration(next.durationSeconds)}</p>
            </div>
            <div className="course-next-actions">
              {next.sourceUrl ? (
                <button className="primary" onClick={()=>void openLink(next.sourceUrl!)}>
                  <Play size={16} fill="currentColor"/> {course.source === 'local' ? 'Play in Player' : 'Open Lesson'} <ArrowUpRight size={16}/>
                </button>
              ) : (
                <span className="course-source-hint">Local source</span>
              )}
              <button onClick={()=>void setLesson(next,true)} disabled={busy}>
                <Check size={16}/> Mark complete
              </button>
            </div>
          </div>
        )}

        <div className="course-list-heading">
          <div>
            <h3>Course Videos & Lecture List <span>{ordered.length||course.total}</span></h3>
            <p>Select any lecture to play, record playback speed, or adjust progress.</p>
          </div>
          <div className="course-heading-right">
            <div className="speed-pills" role="group" aria-label="Playback speed estimate">
              <span className="speed-label">Pace:</span>
              {speeds.map(sp => (
                <button 
                  key={sp} 
                  type="button" 
                  className={`speed-pill ${selectedSpeed === sp ? 'active' : ''}`}
                  onClick={() => setSelectedSpeed(sp)}
                >
                  {sp}×
                </button>
              ))}
            </div>
            <button onClick={edit} className="btn-edit-course">Edit course</button>
          </div>
        </div>

        {ordered.length ? (
          <>
            <div className="course-list-tools">
              <div className="course-tabs">
                <button aria-pressed={scope==='all'} onClick={()=>{setScope('all');setShown(100)}}>
                  All ({ordered.length})
                </button>
                <button aria-pressed={scope==='next'} onClick={()=>{setScope('next');setShown(100)}}>
                  To Do ({remaining.length})
                </button>
                <button aria-pressed={scope==='completed'} onClick={()=>{setScope('completed');setShown(100)}}>
                  Completed ({completedList.length})
                </button>
              </div>
              <label className="course-search-label">
                <Search size={16}/>
                <input 
                  aria-label="Find a lecture" 
                  placeholder="Find by lecture number or title…" 
                  value={query} 
                  onChange={event=>setQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="course-lecture-list">
              {visible.length ? visible.map(lesson => (
                <article className={lesson.completed ? 'complete' : ''} key={lesson.id}>
                  <button 
                    className="lecture-check" 
                    aria-pressed={lesson.completed} 
                    aria-label={`${lesson.completed ? 'Reopen' : 'Complete'} ${lesson.title}`} 
                    disabled={busy} 
                    onClick={()=>void setLesson(lesson,!lesson.completed)}
                  >
                    {lesson.completed ? <Check size={16}/> : null}
                  </button>
                  <span className="lecture-number">{String(lesson.position).padStart(2,'0')}</span>
                  <div className="lecture-copy">
                    <strong>{lesson.title}</strong>
                    <small>
                      <Clock3 size={13}/>
                      {duration(lesson.durationSeconds)}
                      {lesson.completed && <> · Completed{lesson.completedDay ? ` on ${lesson.completedDay}` : ''}</>}
                    </small>
                  </div>
                  <label className="lecture-speed">
                    <span>
                      <select 
                        aria-label={`Playback speed for ${lesson.title}`} 
                        value={draftSpeeds[lesson.id] || lesson.speed || 1} 
                        onChange={event=>{
                          const speed=Number(event.target.value);
                          setDraftSpeeds(current=>({...current,[lesson.id]:speed}));
                          if(lesson.completed)void act({type:'lesson.set',id:lesson.id,completed:true,speed},'Playback speed updated');
                        }}
                      >
                        {speeds.map(speed=><option value={speed} key={speed}>{speed}×</option>)}
                      </select>
                      <ChevronDown size={12}/>
                    </span>
                  </label>
                  {lesson.sourceUrl ? (
                    <button 
                      className="lecture-open" 
                      aria-label={`Play or open ${lesson.title}`} 
                      title={lesson.sourceUrl.startsWith('file:') || lesson.sourceUrl.includes(':\\') ? 'Play in Default Media Player' : 'Open in Browser'}
                      onClick={()=>void openLink(lesson.sourceUrl!)}
                    >
                      <ArrowUpRight size={18}/>
                    </button>
                  ) : (
                    <span className="lecture-no-source" title="Local lesson">Local</span>
                  )}
                </article>
              )) : (
                <p className="course-empty">No lectures match this search or filter.</p>
              )}
            </div>

            {shown < filtered.length && (
              <div className="course-show-more-row">
                <button className="course-show-more" onClick={()=>setShown(value=>value+100)}>
                  Show next 100 lectures ({filtered.length-shown} remaining)
                </button>
                <button className="course-show-all" onClick={()=>setShown(filtered.length)}>
                  Show all {filtered.length} lectures
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="course-empty">
            <BookOpen size={32}/>
            <p>This course does not have an imported lecture list yet.</p>
            <p className="page-sub">You can update its progress and next lesson in Edit course, or import a local folder of videos.</p>
          </div>
        )}
      </div>
    </dialog>
  );
}
