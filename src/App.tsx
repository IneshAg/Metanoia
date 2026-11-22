import {useEffect,useRef,useState,useMemo,lazy,Suspense,type FormEvent} from 'react';
import {motion,AnimatePresence,MotionConfig,useReducedMotion} from 'motion/react';
import {ArrowUpRight,ArrowRight,BookOpen,CalendarDays,Check,Clock3,Gift,Leaf,Plus,Search,Sun,Moon,X,Play,Pause,Settings2,Sparkles,BarChart3,CheckCheck,Flame,Smile,ChevronDown,RotateCcw,Loader2,AlertCircle,Cloud,RefreshCw,Download,Upload,ShieldCheck,CheckCircle,Coffee,Zap,Trash2} from 'lucide-react';
import Today from './Today';
import MusicPlayer, { stopMusicPlayback } from './MusicPlayer';
import CourseDetail from './CourseDetail';
import Courses from './Courses';
import {openExternal, openNotion} from './external';
import {syncTaskToNotion, syncHabitToNotion, archiveTaskInNotion, pullHabitsFromNotion} from './notionSync';
const Planner=lazy(()=>import('./Planner'));
const Reflect=lazy(()=>import('./Reflect'));
import {load,send} from './api';
import {dayKey,activeSeconds,migrateState,formatTime12h,formatSessionTimeRange,type State,type Task,type Course,type Action,type Reward,type WeatherMood,type ThemeMode,type FocusSession} from './domain';
import WeatherBackground from './WeatherBackground';
import WeatherPill from './WeatherPill';
import SettleInPill from './SettleInPill';
import ItemDetailModal from './ItemDetailModal';
import PomodoroBreakModal, { type BreakPromptData } from './PomodoroBreakModal';
import { playPomodoroChime, sendDesktopNotification } from './pomodoroAlert';
import SessionReviewModal from './SessionReviewModal';
import { fetchQwenFocusRecommendation, type QwenSuggestion } from './qwenAdaptation';
import { computeCourseProductivity } from './courseProductivity';
import { calculateStreak, getRank } from './gamification';
import { BUILTIN_PRESETS, calculatePresetTotalMinutes, type FocusPreset } from './domain';
import { invoke } from '@tauri-apps/api/core';

const tabs=[
  ['Today',Leaf],
  ['Planner',CalendarDays],
  ['Courses',BookOpen],
  ['Rewards',Gift],
  ['Reflect',BarChart3],
  ['Focus',Clock3],
  ['Studio',Sun],
  ['Settings',Settings2]
] as const;

function Art({src,className=''}:{src:string;className?:string}){
  return <img draggable="false" className={'art '+className} src={'/art/'+src} alt=""/>;
}

function Meter({value,label}:{value:number;label:string}){
  return (
    <div className="meter" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.i initial={false} animate={{width:`${Math.max(0,Math.min(100,value))}%`}} transition={{duration:.5}}/>
    </div>
  );
}

function Companion({active}:{active:boolean}){
  const video=useRef<HTMLVideoElement>(null);
  const reduced=useReducedMotion();
  useEffect(()=>{
    const update=()=>{
      if(video.current){
        if(active&&!document.hidden&&!reduced)void video.current.play().catch(()=>{});
        else video.current.pause();
      }
    };
    update();
    document.addEventListener('visibilitychange',update);
    return()=>{
      document.removeEventListener('visibilitychange',update);
      video.current?.pause();
    };
  },[active,reduced]);
  return <video ref={video} className="companion-film" muted loop playsInline poster="/art/working.jpg" src={active?'/art/working.mp4':undefined}/>;
}

export default function App(){
  const [state,setState]=useState<State|null>(null);
  const [page,setPage]=useState(()=>localStorage.getItem('metanoia-page')||'Today');
  const [selectedDay,setSelectedDay]=useState(dayKey());
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [dark,setDark]=useState(localStorage.getItem('metanoia-theme')==='dark');
  const [palette,setPalette]=useState(localStorage.getItem('metanoia-palette')||'forest');
  const [editor,setEditor]=useState<Task|null>(null);
  const [reward,setReward]=useState<Reward|null>(null);
  const [courseEditor,setCourseEditor]=useState<Course|null>(null);
  const [courseDetail,setCourseDetail]=useState<string|null>(()=>localStorage.getItem('metanoia-course-detail')||null);
  const [notionPromptCourse,setNotionPromptCourse]=useState<Course|null>(null);
  const [notionInputUrl,setNotionInputUrl]=useState('');
  const [notice,setNotice]=useState('');
  const [undo,setUndo]=useState<Action|null>(null);
  const [query,setQuery]=useState('');
  const [taskFilter,setTaskFilter]=useState('open');
  const [categoryFilter,setCategoryFilter]=useState('all');
  const [goalFilter,setGoalFilter]=useState('all');
  const [taskSort,setTaskSort]=useState('date');
  const [search,setSearch]=useState(false);
  const [syncStatus, setSyncStatus]=useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [failedSyncs, setFailedSyncs]=useState<Array<{type: 'task' | 'habit'; id: string; payload: any}>>([]);
  const [completedSession, setCompletedSession] = useState<{ id: string; intention: string; taskId?: string | null; activeSeconds: number; duration: number } | null>(null);
  const [restorePreview, setRestorePreview] = useState<any | null>(null);
  const [activeTopbarDropdown, setActiveTopbarDropdown] = useState<'weather' | 'settle' | null>(null);

  // Auto-dismiss floating notifications (e.g. "Habit check-in saved") after 2.8 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice('');
      setUndo(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Persist active page and course view across restarts
  useEffect(() => {
    localStorage.setItem('metanoia-page', page);
  }, [page]);

  useEffect(() => {
    if (courseDetail) {
      localStorage.setItem('metanoia-course-detail', courseDetail);
    } else {
      localStorage.removeItem('metanoia-course-detail');
    }
  }, [courseDetail]);

  const handleExportBackup = () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metanoia-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice('Backup exported successfully! 📦');
  };

  const handleFileRestoreSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed || !Array.isArray(parsed.tasks)) {
          throw new Error('Invalid backup file. Tasks array not found.');
        }
        setRestorePreview(parsed);
      } catch (err) {
        setError('Failed to parse backup file: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;
    try {
      setBusy(true);
      const migrated = migrateState(restorePreview);
      await send({ type: 'settings.update', settings: migrated.settings });
      for (const t of migrated.tasks) {
        await send({ type: 'task.save', task: t });
      }
      setState(migrated);
      setRestorePreview(null);
      setNotice('Data restored successfully! ✨');
    } catch (err) {
      setError('Restore failed: ' + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flushNotionSyncQueue = async () => {
    if (syncStatus === 'syncing') return;
    setSyncStatus('syncing');
    let hadError = false;

    try {
      const records = await pullHabitsFromNotion();
      if (records.length > 0) {
        const next = await send({ type: 'habit.merge_notion', records });
        setState(next);
      }
    } catch (e) {
      console.warn('Failed to pull habits from Notion:', e);
    }

    if (failedSyncs.length) {
      const queue = [...failedSyncs];
      setFailedSyncs([]);
      for (const item of queue) {
        try {
          if (item.type === 'task') {
            const task = state?.tasks.find(t => t.id === item.id) || item.payload;
            if (task) await syncTaskToNotion(task);
          } else if (item.type === 'habit') {
            const { day, name, done, id } = item.payload;
            await syncHabitToNotion(day, name, done, id);
          }
        } catch {
          hadError = true;
          setFailedSyncs(prev => [...prev, item]);
        }
      }
    }
    setSyncStatus(hadError ? 'error' : 'synced');
    setTimeout(() => setSyncStatus('idle'), 2500);
  };
  const [minutes,setMinutes]=useState(Number(localStorage.getItem('metanoia-focus-minutes')||25));
  const [focusIntention,setFocusIntention]=useState('');
  const [focusMode,setFocusMode]=useState<'work'|'short_break'|'long_break'>('work');
  const lastChimedPhaseRef=useRef<string|null>(null);
  const [now,setNow]=useState(Date.now());
  const [visible,setVisible]=useState(!document.hidden);
  const [motionOn,setMotionOn]=useState(localStorage.getItem('metanoia-motion')!=='off');
  const [customColor,setCustomColor]=useState('#4b7866');
  const [focusTaskId,setFocusTaskId]=useState('');
  const [focusCourseId,setFocusCourseId]=useState('');
  const [inspectingSession, setInspectingSession]=useState<FocusSession | null>(null);
  const [reviewingSession, setReviewingSession]=useState<FocusSession | null>(null);
  const [breakPrompt, setBreakPrompt] = useState<BreakPromptData | null>(null);
  const [qwenSuggestion, setQwenSuggestion] = useState<QwenSuggestion | null>(null);
  const [qwenDismissed, setQwenDismissed] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showAdjustTime, setShowAdjustTime] = useState(false);
  const [wrapUpAdded, setWrapUpAdded] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('My Custom Sprint');
  const [presetWorkInput, setPresetWorkInput] = useState(30);
  const [presetBreakInput, setPresetBreakInput] = useState(6);
  const [presetLongBreakInput, setPresetLongBreakInput] = useState(18);
  const [presetRoundsInput, setPresetRoundsInput] = useState(3);
  const [weatherMood, setWeatherMood] = useState<WeatherMood>(() => {
    return (localStorage.getItem('metanoia-weather-mood') as WeatherMood) || 'breezy';
  });
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [floatingTimerActive, setFloatingTimerActive] = useState<boolean>(() => localStorage.getItem('metanoia-floating-visible') === 'true');
  const [cycleMode, setCycleMode] = useState<'single' | 'cycle'>('cycle');
  const lock=useRef(false);
  const today=dayKey();

  const todaySessions = useMemo(() => {
    return (state?.sessions || []).filter(s => String(s.started_utc || '').startsWith(today));
  }, [state?.sessions, today]);

  const todayFocusSessions = useMemo(() => {
    return todaySessions.filter(s => s.mode === 'work' || !s.mode);
  }, [todaySessions]);

  const todayBreaks = useMemo(() => {
    return todaySessions.filter(s => s.mode === 'short_break' || s.mode === 'long_break');
  }, [todaySessions]);

  const isCurrentlyFocusing = Boolean(state?.focus && (state.focus.mode === 'work' || !state.focus.mode));
  const currentFocusSecs = isCurrentlyFocusing && state?.focus
    ? activeSeconds(state.focus, now)
    : 0;

  const totalFocusSeconds = useMemo(() => {
    const completedFocusSecs = todayFocusSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
    return completedFocusSecs + currentFocusSecs;
  }, [todayFocusSessions, currentFocusSecs]);

  const todayFocusMinutes = useMemo(() => {
    return Math.round(totalFocusSeconds / 60);
  }, [totalFocusSeconds]);

  const isCurrentlyOnBreak = Boolean(state?.focus && (state.focus.mode === 'short_break' || state.focus.mode === 'long_break'));
  const currentBreakSecs = isCurrentlyOnBreak && state?.focus
    ? (state.focus.startedAt ? Math.max(state.focus.elapsed, Math.floor((now - state.focus.startedAt) / 1000)) : state.focus.elapsed)
    : 0;

  const totalBreakSeconds = useMemo(() => {
    const completedBreakSecs = todayBreaks.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
    return completedBreakSecs + currentBreakSecs;
  }, [todayBreaks, currentBreakSecs]);

  const totalBreakMinutes = useMemo(() => {
    return Math.round(totalBreakSeconds / 60);
  }, [totalBreakSeconds]);

  const totalBreakCount = useMemo(() => {
    return todayBreaks.length + (isCurrentlyOnBreak ? 1 : 0);
  }, [todayBreaks, isCurrentlyOnBreak]);

  const todayPauseSeconds = useMemo(() => {
    return todayFocusSessions.reduce((acc, s) => acc + (s.break_seconds || 0), 0);
  }, [todayFocusSessions]);

  const todayPauseMinutes = useMemo(() => {
    return Math.round(todayPauseSeconds / 60);
  }, [todayPauseSeconds]);

  const todayBreakMinutes = useMemo(() => {
    return Math.round((totalBreakSeconds + todayPauseSeconds) / 60);
  }, [totalBreakSeconds, todayPauseSeconds]);

  const allPresets = useMemo(() => {
    const builtinIds = new Set(BUILTIN_PRESETS.map(b => b.id.toLowerCase()));
    const builtinNames = new Set(BUILTIN_PRESETS.map(b => b.name.toLowerCase().trim()));
    const seen = new Set<string>();
    const customList: FocusPreset[] = [];

    for (const cp of state?.settings.customPresets || []) {
      if (!cp || !cp.id || !cp.name) continue;
      const lowerId = cp.id.toLowerCase().trim();
      const lowerName = cp.name.toLowerCase().trim();
      if (builtinIds.has(lowerId) || builtinNames.has(lowerName)) continue;
      if (seen.has(lowerId) || seen.has(lowerName)) continue;
      seen.add(lowerId);
      seen.add(lowerName);
      customList.push(cp);
    }
    return [...BUILTIN_PRESETS, ...customList];
  }, [state?.settings.customPresets]);

  const activePreset = useMemo(() => {
    const currentPresetId = state?.focus?.presetId || state?.settings.lastUsedPresetId || 'classic';
    return allPresets.find(p => p.id === currentPresetId) || BUILTIN_PRESETS[0];
  }, [allPresets, state?.focus?.presetId, state?.settings.lastUsedPresetId]);

  const nextRoundForNewSession = useMemo(() => {
    const todayWorkSessions = todayFocusSessions;
    if (todayWorkSessions.length === 0) return 1;
    const lastRound = todayWorkSessions[todayWorkSessions.length - 1].round || 1;
    const totalR = activePreset.totalRounds || 4;
    return (lastRound % totalR) + 1;
  }, [todayFocusSessions, activePreset.totalRounds]);

  const effectiveRound = state?.focus?.round ?? (selectedRound ?? nextRoundForNewSession);

  const totalFocusSessionCount = useMemo(() => {
    return todayFocusSessions.length + (isCurrentlyFocusing ? 1 : 0);
  }, [todayFocusSessions.length, isCurrentlyFocusing]);

  const streakInfo = useMemo(() => {
    return calculateStreak(state?.sessions || [], today);
  }, [state?.sessions, today]);

  const rank = useMemo(() => {
    return getRank(state?.xp || 0);
  }, [state?.xp]);

  const selectedCourseProductivity = useMemo(() => {
    if (!state || !focusCourseId) return null;
    return computeCourseProductivity(state, focusCourseId);
  }, [state, focusCourseId]);

  useEffect(() => {
    if (state?.sessions && state.sessions.length >= 2 && !qwenDismissed) {
      void fetchQwenFocusRecommendation(state.sessions).then(sug => {
        if (sug && sug.confidenceScore >= 60) {
          setQwenSuggestion(sug);
        }
      });
    }
  }, [state?.sessions, qwenDismissed]);

  const changeWeatherMood = (m: WeatherMood) => {
    setWeatherMood(m);
    localStorage.setItem('metanoia-weather-mood', m);
    void act({ type: 'settings.update', settings: { weatherMood: m } }, `Weather atmosphere set to ${m}`);
  };

  useEffect(()=>{
    load().then(saved=>{
      setState(saved);
      setDark(saved.settings.theme==='dark');
      setPalette(saved.settings.palette);
      setMotionOn(saved.settings.motion);
      setMinutes(saved.settings.focusMinutes);
      setCustomColor(saved.settings.customColor||'#4b7866');
      if (saved.settings?.weatherMood) {
        setWeatherMood(saved.settings.weatherMood);
        localStorage.setItem('metanoia-weather-mood', saved.settings.weatherMood);
      }
      pullHabitsFromNotion().then(records => {
        if (records.length > 0) {
          void send({ type: 'habit.merge_notion', records }).then(setState).catch(console.warn);
        }
      }).catch(console.warn);
    }).catch(e=>setError(e.message));
  },[]);

  useEffect(()=>{
    if(!state)return;
    const curTheme = state.settings.theme || 'dark';
    setDark(curTheme !== 'light');
    setPalette(state.settings.palette);
    setMotionOn(state.settings.motion);
    setMinutes(state.settings.focusMinutes);
    setCustomColor(state.settings.customColor||'#4b7866');
    if (state.settings.weatherMood && state.settings.weatherMood !== weatherMood) {
      setWeatherMood(state.settings.weatherMood);
      localStorage.setItem('metanoia-weather-mood', state.settings.weatherMood);
    }
    document.documentElement.dataset.theme = curTheme;
    localStorage.setItem('metanoia-theme', curTheme);
  },[state?.settings.theme,state?.settings.palette,state?.settings.motion,state?.settings.focusMinutes,state?.settings.customColor,state?.settings.weatherMood]);

  useEffect(()=>{
    const curTheme = state?.settings.theme || (dark ? 'dark' : 'light');
    document.documentElement.dataset.theme = curTheme;
    localStorage.setItem('metanoia-theme', curTheme);
  },[dark, state?.settings.theme]);

  useEffect(()=>{
    document.documentElement.dataset.palette=palette;
    localStorage.setItem('metanoia-palette',palette);
  },[palette]);

  useEffect(()=>{
    const root=document.documentElement;
    if(state?.settings.customColor){
      root.style.setProperty('--accent',state.settings.customColor);
      root.style.setProperty('--teal',state.settings.customColor);
    }else{
      root.style.removeProperty('--accent');
      root.style.removeProperty('--teal');
    }
  },[state?.settings.customColor]);

  useEffect(()=>{
    const change=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',change);
    return()=>document.removeEventListener('visibilitychange',change);
  },[]);

  useEffect(()=>{
    if(!state?.focus?.runningSince)return;
    const id=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(id);
  },[state?.focus?.runningSince]);

  // Pomodoro automatic pause & break alert watcher
  useEffect(()=>{
    if(!state?.focus?.runningSince) return;
    const curElapsed = state.focus.elapsed + Math.max(0, Math.floor((now - state.focus.runningSince)/1000));
    const target = state.focus.duration * 60;
    if(curElapsed >= target){
      const phaseKey = `${state.focus.id}-${state.focus.mode || 'work'}-${state.focus.round || 1}`;
      if(lastChimedPhaseRef.current !== phaseKey){
        lastChimedPhaseRef.current = phaseKey;
        const isWork = (state.focus.mode || 'work') === 'work';
        const round = state.focus.round || 1;
        const totalRounds = state.focus.totalRounds || 4;
        const isLong = isWork && (round % totalRounds === 0);

        // 1. Immediately pause focus work sprint so it does NOT runaway into unprompted hours!
        // Break mode continues counting overtime so if user rests for 6m 10s, it accurately captures the full break!
        if (isWork) {
          void act({ type: 'focus.pause' });
        }

        // 2. Stop break music if needed
        if (!isWork) {
          stopMusicPlayback();
          setNotice('☕ Break complete! Music stopped — ready for next focus sprint 🚀');
        }

        // 3. Play loud, rich, pleasant Pomodoro chime
        playPomodoroChime(isWork ? 'work_complete' : 'break_complete');

        // 4. Send desktop OS notification and flash window title
        if (isWork) {
          sendDesktopNotification(
            `🔔 Focus Sprint Complete! (Round ${round}/${totalRounds})`,
            isLong
              ? 'Round 4 complete! Time for a 20m rejuvenation break 🌴'
              : 'Great sprint! Time for a 5-minute break ☕ Step away and rest your eyes.'
          );
        } else {
          sendDesktopNotification(
            '☕ Break Complete!',
            `Recharged! Ready to begin Round ${state.focus.mode === 'long_break' ? 1 : round + 1} 🚀`
          );
        }

        // 5. Open the Pomodoro Break Ask Modal
        setBreakPrompt({
          sessionId: state.focus.id,
          mode: state.focus.mode || 'work',
          round,
          totalRounds,
          duration: state.focus.duration,
          workDuration: state.focus.workDuration || (isWork ? state.focus.duration : 25),
          intention: state.focus.intention || 'Focused work',
          taskId: state.focus.taskId || null,
        });
      }
    }
  },[now, state?.focus]);

  useEffect(()=>{
    localStorage.setItem('metanoia-motion',motionOn?'on':'off');
  },[motionOn]);

  useEffect(()=>{
    localStorage.setItem('metanoia-focus-minutes',String(minutes));
  },[minutes]);

  // Global Ctrl+K Command Palette Shortcut
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='k'){
        e.preventDefault();
        setSearch(v=>!v);
      }
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[]);

  async function act(action:Action,message='Saved'){
    if(lock.current)return;
    lock.current=true;
    setBusy(true);
    setError('');
    try{
      const nextState = await send(action);
      setState(nextState);
      setNotice(message);

      // Asynchronous background sync to Notion with live status updates
      if(action.type === 'task.toggle'){
        const updatedTask = nextState.tasks.find(t => t.id === action.id);
        if(updatedTask){
          setSyncStatus('syncing');
          syncTaskToNotion(updatedTask)
            .then(() => {
              setSyncStatus('synced');
              setTimeout(() => setSyncStatus('idle'), 2000);
            })
            .catch(err => {
              console.warn('Notion task sync failed:', err);
              setSyncStatus('error');
              setFailedSyncs(prev => [...prev, { type: 'task', id: updatedTask.id, payload: updatedTask }]);
            });
        }
      } else if(action.type === 'task.save'){
        const savedTask = action.task as Task;
        const currentTask = nextState.tasks.find(t => t.id === savedTask.id) || savedTask;
        setSyncStatus('syncing');
        syncTaskToNotion(currentTask).then(remoteId => {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
          if(remoteId && currentTask.id && currentTask.remoteId !== remoteId){
            void send({ type: 'task.set_remote', id: currentTask.id, remoteId }).then(setState).catch(console.error);
          }
        }).catch(err => {
          console.warn('Notion task save sync failed:', err);
          setSyncStatus('error');
          setFailedSyncs(prev => [...prev, { type: 'task', id: currentTask.id, payload: currentTask }]);
        });
      } else if(action.type === 'habit.set'){
        const habitRecord = nextState.habits.find(h => h.day === action.day);
        setSyncStatus('syncing');
        syncHabitToNotion(String(action.day), String(action.name), Boolean(action.done), habitRecord?.id).then(pageId => {
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
          if(pageId && habitRecord && habitRecord.id !== pageId){
            void send({ type: 'habit.set_page_id', day: action.day, pageId }).then(setState).catch(console.error);
          }
        }).catch(err => {
          console.warn('Notion habit sync failed:', err);
          setSyncStatus('error');
          setFailedSyncs(prev => [...prev, { type: 'habit', id: String(action.day), payload: { day: action.day, name: action.name, done: action.done, id: habitRecord?.id } }]);
        });
      } else if(action.type === 'task.delete'){
        const deletedTask = state?.tasks.find(t => t.id === action.id);
        if(deletedTask?.remoteId){
          setSyncStatus('syncing');
          archiveTaskInNotion(deletedTask.remoteId).then(() => {
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
          }).catch(err => {
            console.warn('Notion task delete sync failed:', err);
            setSyncStatus('idle');
          });
        }
      }

      return true;
    }catch(e){
      setError((e as Error).message);
      return false;
    }finally{
      lock.current=false;
      setBusy(false);
    }
  }

  const availableGoals = useMemo<string[]>(()=>{
    if(!state) return [];
    const set = new Set<string>();
    for(const t of state.tasks){
      if(t.goals){
        for(const g of t.goals){
          if(g.title?.trim()) set.add(g.title.trim());
        }
      }
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  },[state?.tasks]);

  const handleOpenNotion = (course:Course)=>{
    if(course.notionUrl && course.notionUrl.trim()){
      void openNotion(course.notionUrl).catch(e=>setError((e as Error).message));
    } else {
      setNotionPromptCourse(course);
      setNotionInputUrl(course.notionUrl || '');
    }
  };

  function newTask(day=today,start=''){
    setEditor({id:'',title:'',day,start,end:'',minutes:null,category:'personal',done:false,updated:''});
  }

  function toggle(t:Task){
    void act({type:'task.toggle',id:t.id,done:!t.done},t.done?'Task reopened':'Great job! Progress made ✦').then(ok=>{
      if(ok)setUndo({type:'task.toggle',id:t.id,done:t.done});
    });
  }

  const open=state?.tasks.filter(t=>!t.done)||[];
  const doneCount=state?.tasks.filter(t=>t.done).length||0;

  function TaskRow({task:t}:{task:Task}){
    return (
      <motion.div layout className={'task-row '+(t.done?'done':'')}>
        <button 
          className="check" 
          role="checkbox" 
          aria-checked={t.done} 
          aria-label={(t.done?'Reopen ':'Complete ')+t.title} 
          disabled={busy} 
          onClick={()=>toggle(t)}
        >
          {t.done&&<motion.span initial={{scale:.4}} animate={{scale:1}}><Check size={14} strokeWidth={3}/></motion.span>}
        </button>
        <button className="task-title" onClick={()=>setEditor(t)}>
          <strong>{t.title}</strong>
          <small>{t.start||'Any time'}{t.minutes?` · ${t.minutes} min`:''} · {t.category}</small>
          {!!t.goals?.length&&<span className="task-goals">{t.goals.map(goal=><span key={goal.id}>{goal.title}</span>)}</span>}
        </button>
        {!t.done && (
          <button 
            type="button"
            className="task-row-focus-pill" 
            title="Focus on this task" 
            onClick={()=>{
              setPage('Focus');
              setFocusIntention(t.title);
              setFocusTaskId(t.id);
            }}
          >
            <Play size={11} fill="currentColor"/> Focus
          </button>
        )}
        <button className="icon-button" title="Edit task" onClick={()=>setEditor(t)}>
          <ArrowUpRight size={16}/>
        </button>
      </motion.div>
    );
  }

  if(!state) return (
    <div className="boot">
      <Leaf size={42} className="text-teal"/>
      <h1>Opening Metanoia…</h1>
      <p>{error||'Loading your workspace data'}</p>
      {error&&<button className="primary" onClick={()=>location.reload()}>Retry</button>}
    </div>
  );

  const elapsedSeconds = state.focus
    ? state.focus.elapsed + (state.focus.runningSince ? Math.max(0, Math.floor((now - state.focus.runningSince) / 1000)) : 0)
    : 0;
  const targetSeconds = (state.focus?.duration || minutes) * 60;
  const isOvertime = Boolean(state.focus && elapsedSeconds >= targetSeconds);
  const overtimeSeconds = isOvertime ? elapsedSeconds - targetSeconds : 0;
  const countdownSeconds = Math.max(0, targetSeconds - elapsedSeconds);
  const remaining = isOvertime ? overtimeSeconds : countdownSeconds;

  return (
    <MotionConfig reducedMotion={motionOn?'user':'always'}>
      <div className={'app-modern-shell '+(!visible||!motionOn?'motion-paused':'')}>
        {/* Living Ambient Weather Motion Backdrop (Rain, Autumn Fall, Sunny, Snow, Breeze) */}
        <WeatherBackground mood={weatherMood} active={visible} />
        {/* Modern Playful Sidebar Dock (Reference Images 1 & 2) */}
        <aside className="modern-dock">
          <div className="dock-brand">
            <a href="#" className="brand-pill" onClick={e=>{e.preventDefault();setPage('Today');}}>
              <span className="brand-dot"/>
              <span className="brand-title">metanoia</span>
            </a>
          </div>

          <nav className="dock-nav" aria-label="Main Navigation">
            {tabs.map(([label,Icon])=>{
              const isActive = page === label;
              return (
                <button
                  key={label}
                  type="button"
                  className={`dock-nav-item ${isActive ? 'active' : ''}`}
                  onClick={()=>setPage(label)}
                  title={label}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8}/>
                  <span>{label}</span>
                  {isActive && <motion.span layoutId="activeDockPill" className="dock-active-indicator"/>}
                </button>
              );
            })}
          </nav>

          <div className="dock-foot">
            <button 
              type="button" 
              className="dock-icon-btn" 
              title={`Theme: ${state.settings.theme || 'dark'} (Click to cycle themes)`} 
              onClick={() => {
                const current = (state.settings.theme || 'dark') as ThemeMode;
                const order: ThemeMode[] = ['light', 'dark', 'system', 'spell'];
                const nextTheme = order[(order.indexOf(current) + 1) % order.length];
                void act({ type: 'settings.update', settings: { theme: nextTheme } }, `Switched to ${nextTheme} theme`);
              }}
            >
              {(state.settings.theme === 'light') && <Sun size={18}/>}
              {(state.settings.theme === 'dark') && <Moon size={18}/>}
              {(state.settings.theme === 'system') && <Zap size={18} className="text-cyan"/>}
              {(state.settings.theme === 'spell') && <Sparkles size={18} className="text-purple"/>}
              {(!state.settings.theme) && <Moon size={18}/>}
            </button>
            <div className="dock-avatar" title="Inesh" onClick={()=>setPage('Settings')}>
              <span>I</span>
            </div>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="modern-main">
          {/* Top Header Bar */}
          <header className="modern-topbar">
            <div className="topbar-left">
              <span className="page-tag">
                {page==='Today' && '🌱 Today\'s Flow'}
                {page==='Planner' && '🗓️ Weekly Planner'}
                {page==='Courses' && '📚 Learning Studio'}
                {page==='Rewards' && '🎁 Little Joys'}
                {page==='Reflect' && '✨ Sparks & Insights'}
                {page==='Focus' && '⏱️ Focus Session'}
                {page==='Studio' && '🎨 Cozy Sanctuary'}
                {page==='Settings' && '⚙️ Settings & Theme'}
              </span>
              <div 
                className={`workspace-badge sync-status-pill sync-${syncStatus}`}
                onClick={flushNotionSyncQueue}
                style={{ cursor: 'pointer' }}
                title="Click to sync habits & tasks with Notion"
              >
                {syncStatus === 'syncing' && <><Loader2 size={12} className="spin text-blue"/> <span>Syncing with Notion…</span></>}
                {syncStatus === 'synced' && <><Check size={12} className="text-emerald"/> <span>Synced with Notion</span></>}
                {syncStatus === 'error' && <><AlertCircle size={12} className="text-amber"/> <span>Sync Error ({failedSyncs.length}) · Retry</span></>}
                {syncStatus === 'idle' && <><Cloud size={12} className="text-muted"/> <span>Notion Sync · Click to sync</span></>}
              </div>
            </div>

            <div className="topbar-center">
              <button type="button" className="modern-search-pill" onClick={()=>setSearch(true)}>
                <Search size={16}/>
                <span>Search quests, courses &amp; views…</span>
                <kbd>Ctrl K</kbd>
              </button>
            </div>

            <div className="topbar-right">
              <WeatherPill
                mood={weatherMood}
                onSelectMood={changeWeatherMood}
                align="right"
                isOpen={activeTopbarDropdown === 'weather'}
                onToggle={(open) => setActiveTopbarDropdown(open ? 'weather' : null)}
              />
              <SettleInPill
                state={state}
                remaining={remaining}
                act={act}
                setPage={setPage}
                defaultMinutes={minutes}
                isOpen={activeTopbarDropdown === 'settle'}
                onToggle={(open) => setActiveTopbarDropdown(open ? 'settle' : null)}
              />
            </div>
          </header>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={()=>setError('')} aria-label="Dismiss error"><X size={16}/></button>
            </div>
          )}

          {/* Page Routing */}
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{opacity:0,y:8}}
              animate={{opacity:1,y:0}}
              exit={{opacity:0,y:-6}}
              transition={{duration:.2}}
            >
              {page==='Today'&& (
                <Today
                  state={state}
                  day={selectedDay}
                  setDay={setSelectedDay}
                  busy={busy}
                  act={act}
                  onEdit={setEditor}
                  onNew={newTask}
                  onToggle={toggle}
                  navigate={setPage}
                  minutes={minutes}
                  setMinutes={setMinutes}
                  startFocus={async (intention, taskId)=>{
                    if(state.focus){setPage('Focus');return;}
                    if(await act({type:'focus.start',minutes,intention,taskId:taskId||null},'Focus started!'))setPage('Focus');
                  }}
                  onOpenCourseDetail={setCourseDetail}
                  onOpenNotion={handleOpenNotion}
                />
              )}

              {page==='Planner'&& (
                <div className="planner-page-wrap">
                  <div className="page-header-clean">
                    <div>
                      <h2>🗓️ Weekly Planner</h2>
                      <p className="page-sub">Plan your schedule, organize upcoming priorities, and pace your week calmly.</p>
                    </div>
                    <button className="primary-pill-btn" onClick={()=>newTask(selectedDay)}>
                      <Plus size={16}/> New Task
                    </button>
                  </div>

                  <Suspense fallback={<p className="loading-state">Loading calendar…</p>}>
                    <Planner
                      state={state}
                      day={selectedDay}
                      setDay={setSelectedDay}
                      act={act}
                      busy={busy}
                      tasks={state.tasks}
                      onEdit={setEditor}
                      onNew={newTask}
                      save={async t=>{return !!await act({type:'task.save',task:t},'Schedule saved');}}
                    />
                  </Suspense>

                  <section className="inbox-section">
                    <div className="section-head-clean">
                      <h3>Upcoming &amp; Unscheduled Tasks</h3>
                      <span className="badge-count">{open.length} open tasks</span>
                    </div>

                    {/* Neo-pop Tactile Filter Deck */}
                    <div className="task-filter-deck">
                      {/* Top row: search + segmented status pills */}
                      <div className="filter-deck-top">
                        <div className="search-pill-box">
                          <Search size={15} className="search-icon"/>
                          <input 
                            aria-label="Search tasks" 
                            placeholder="Filter tasks by keyword…" 
                            value={query} 
                            onChange={e=>setQuery(e.target.value)}
                            className="search-pill-input"
                          />
                          {query && (
                            <button 
                              type="button" 
                              className="search-clear-btn" 
                              onClick={()=>setQuery('')}
                              aria-label="Clear search"
                            >
                              <X size={13}/>
                            </button>
                          )}
                        </div>

                        <div className="segmented-status-pills" role="tablist" aria-label="Task status filter">
                          <button 
                            type="button"
                            role="tab"
                            aria-selected={taskFilter==='open'}
                            className={`status-pill ${taskFilter==='open'?'active':''}`}
                            onClick={()=>setTaskFilter('open')}
                          >
                            <span className="status-pill-dot open-dot"/>
                            <span>Open</span>
                            <span className="status-pill-count">{open.length}</span>
                          </button>
                          <button 
                            type="button"
                            role="tab"
                            aria-selected={taskFilter==='done'}
                            className={`status-pill ${taskFilter==='done'?'active':''}`}
                            onClick={()=>setTaskFilter('done')}
                          >
                            <span className="status-pill-dot done-dot"/>
                            <span>Completed</span>
                            <span className="status-pill-count">{doneCount}</span>
                          </button>
                          <button 
                            type="button"
                            role="tab"
                            aria-selected={taskFilter==='all'}
                            className={`status-pill ${taskFilter==='all'?'active':''}`}
                            onClick={()=>setTaskFilter('all')}
                          >
                            <span>All</span>
                            <span className="status-pill-count">{state.tasks.length}</span>
                          </button>
                        </div>
                      </div>

                      {/* Bottom row: category chip, notion goal chip, sort chip, and reset */}
                      <div className="filter-deck-chips">
                        <div className="filter-chip-wrapper">
                          <span className="filter-chip-label">Category:</span>
                          <div className="filter-select-container">
                            <select 
                              aria-label="Task category" 
                              className="filter-pill-select"
                              value={categoryFilter} 
                              onChange={e=>setCategoryFilter(e.target.value)}
                            >
                              <option value="all">🌈 All Categories</option>
                              <option value="study">📚 Study</option>
                              <option value="coding">💻 Coding</option>
                              <option value="personal">🌱 Personal</option>
                              <option value="leisure">🎮 Leisure</option>
                            </select>
                            <ChevronDown size={13} className="select-arrow-icon"/>
                          </div>
                        </div>

                        {availableGoals.length > 0 && (
                          <div className="filter-chip-wrapper">
                            <span className="filter-chip-label">Goal:</span>
                            <div className="filter-select-container">
                              <select 
                                aria-label="Filter by Notion Goal" 
                                className="filter-pill-select goal-select" 
                                value={goalFilter} 
                                onChange={e=>setGoalFilter(e.target.value)}
                              >
                                <option value="all">🎯 All Goals ({availableGoals.length})</option>
                                {availableGoals.map((g:string)=><option key={g} value={g}>{g}</option>)}
                              </select>
                              <ChevronDown size={13} className="select-arrow-icon"/>
                            </div>
                          </div>
                        )}

                        <div className="filter-chip-wrapper">
                          <span className="filter-chip-label">Sort:</span>
                          <div className="filter-select-container">
                            <select 
                              aria-label="Sort tasks" 
                              className="filter-pill-select"
                              value={taskSort} 
                              onChange={e=>setTaskSort(e.target.value)}
                            >
                              <option value="date">📅 By Due Date</option>
                              <option value="title">🔤 By Title</option>
                            </select>
                            <ChevronDown size={13} className="select-arrow-icon"/>
                          </div>
                        </div>

                        {(query || taskFilter!=='open' || categoryFilter!=='all' || goalFilter!=='all' || taskSort!=='date') && (
                          <button 
                            type="button" 
                            className="filter-reset-pill" 
                            onClick={()=>{
                              setQuery('');
                              setTaskFilter('open');
                              setCategoryFilter('all');
                              setGoalFilter('all');
                              setTaskSort('date');
                            }}
                            title="Reset all filters to default"
                          >
                            <RotateCcw size={12}/>
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="task-rows-container">
                      {state.tasks
                        .filter(t => {
                          const q = query.trim().toLowerCase();
                          const matchesQuery = !q || (
                            t.title.toLowerCase().includes(q) ||
                            t.category.toLowerCase().includes(q) ||
                            (t.goals && t.goals.some(g => g.title.toLowerCase().includes(q)))
                          );
                          const statusMatch = !q 
                            ? (taskFilter === 'all' || (taskFilter === 'done' ? t.done : !t.done))
                            : (taskFilter === 'all' ? true : (taskFilter === 'done' ? t.done : true));
                          const categoryMatch = categoryFilter === 'all' || t.category === categoryFilter;
                          const goalMatch = goalFilter === 'all' || (t.goals && t.goals.some(g => g.title === goalFilter || g.id === goalFilter));
                          return statusMatch && categoryMatch && goalMatch && matchesQuery;
                        })
                        .sort((a,b)=>taskSort==='title'?a.title.localeCompare(b.title):(a.day||'9999').localeCompare(b.day||'9999'))
                        .slice(0,50)
                        .map(t=><TaskRow key={t.id} task={t}/>)}
                    </div>
                  </section>
                </div>
              )}

              {page==='Courses'&& (
                <Courses
                  state={state}
                  onAdd={()=>setCourseEditor({id:'',title:'',done:0,total:1,deadline:'',nextLesson:'',nextUrl:null,source:'personal',minutesPerLesson:30,notionUrl:null})}
                  onOpen={setCourseDetail}
                  onEdit={setCourseEditor}
                  onImportLocal={async data=>{
                    if(await act({type:'course.import_local',title:data.title,folder:data.folder,lessons:data.lessons,notionUrl:data.notionUrl},`Course "${data.title}" imported with ${data.lessons.length} video lectures`)){
                      setNotice(`Course "${data.title}" imported successfully!`);
                    }
                  }}
                  onOpenNotion={handleOpenNotion}
                />
              )}

              {page==='Rewards'&& (
                <div className="rewards-page-wrap">
                  <div className="page-header-clean">
                    <div>
                      <h2>Rewards & Little Joys</h2>
                      <p className="page-sub">Celebrate your progress. Rest and hobbies are well earned.</p>
                    </div>
                    <div className="credit-pill-badge">
                      <Sparkles size={16} className="text-yellow"/>
                      <strong>{state.credits}</strong>
                      <span>Credits</span>
                    </div>
                  </div>

                  <div className="reward-gallery">
                    {state.rewards.map((r,i)=>(
                      <motion.button 
                        whileHover={{y:-6}} 
                        whileTap={{scale:.98}} 
                        className={'reward-card-playful reward-'+i} 
                        key={r.id} 
                        onClick={()=>setReward(r)}
                      >
                        <div className="artifact-stage">
                          <Art src={r.art}/>
                        </div>
                        <span className="reward-item-num">JOY № 0{i+1}</span>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                        <span className="reward-cost-pill">{r.cost} credits <ArrowUpRight size={15}/></span>
                      </motion.button>
                    ))}
                  </div>

                  <section className="xp-journey-card">
                    <div>
                      <span className="journey-tag">PERMANENT PROGRESS</span>
                      <h3>{state.xp.toLocaleString()} XP Collected</h3>
                      <p className="page-sub">Every completed task, focus session, and lesson adds to your permanent XP.</p>
                    </div>
                    <Meter value={(state.xp%500)/5} label="Progress to next milestone"/>
                    <span className="milestone-note">{500-(state.xp%500)} XP to the next 500-point milestone</span>
                  </section>

                  {state.redemptions.length>0&&(
                    <section className="recent-redemptions">
                      <h3>Enjoyed Recently</h3>
                      <div className="redemptions-list">
                        {state.redemptions.map(r=>(
                          <div key={r.id} className="redemption-item">
                            <span>{r.title}</span>
                            <small>{r.cost} credits</small>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {page==='Studio'&& (
                <div className="studio-page-wrap">
                  <div className="page-header-clean">
                    <div>
                      <h2>🎨 Cozy Studio Sanctuary</h2>
                      <p className="page-sub">A peaceful digital nook with your companion to study, daydream, and recharge. 🐾</p>
                    </div>
                    <button className="primary-pill-btn" onClick={()=>setPage('Focus')}>
                      <Play size={16} fill="currentColor"/> Hop into Focus 🚀
                    </button>
                  </div>

                  <section className="studio-scene-card">
                    <img src={'/art/studio-'+(dark?'evening':'day')+'.png'} alt="Metanoia Studio"/>
                    <div className="studio-companion-overlay">
                      <Companion active={visible&&motionOn}/>
                      <p><span className="live-dot-pulse"/> Your cheerful companion is right here with you.</p>
                    </div>
                  </section>

                  {/* Studio Deck: Ambient Soundscapes & Mindful Reflection */}
                  <div className="studio-deck-grid">
                    <section className="studio-ambient-card">
                      <div className="studio-card-head">
                        <div>
                          <p className="eyebrow">✦ ATMOSPHERE &amp; VIBES</p>
                          <h3>Soundscapes &amp; Mood</h3>
                        </div>
                        <span className="live-tag">✨ Cozy Ambiance</span>
                      </div>
                      <p className="page-sub">Select soothing background soundscapes to accompany your reading and creative work.</p>
                      <div className="soundscape-chips-grid">
                        {[
                          {name:'Forest Breeze', icon:'🌲', desc:'Gentle wind in pines'},
                          {name:'Rain on Glass', icon:'🌧️', desc:'Soft rhythmic rainfall'},
                          {name:'Warm Cafe', icon:'☕', desc:'Subtle background murmur'},
                          {name:'Ocean Tide', icon:'🌊', desc:'Slow rolling waves'},
                          {name:'Night Crickets', icon:'🌙', desc:'Serene twilight hum'},
                          {name:'Lo-Fi Tape', icon:'📻', desc:'Warm vinyl crackle'}
                        ].map(item => (
                          <div key={item.name} className="soundscape-pill-card">
                            <span className="soundscape-icon">{item.icon}</span>
                            <div className="soundscape-text">
                              <strong>{item.name}</strong>
                              <small>{item.desc}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="studio-mindful-card">
                      <div className="studio-card-head">
                        <div>
                          <p className="eyebrow">✦ DAILY SPARK</p>
                          <h3>Mindful Reset</h3>
                        </div>
                        <Sparkles size={16} className="text-amber"/>
                      </div>
                      <blockquote className="studio-quote">
                        “The secret of getting ahead is getting started. The secret of getting started is breaking your complex overwhelming quests into tiny playful wins.”
                      </blockquote>
                      <div className="studio-mindful-actions">
                        <button type="button" className="btn-clean-ghost" onClick={()=>setPage('Today')}>
                          Review Today's Flow →
                        </button>
                        <button type="button" className="primary-pill-btn" onClick={()=>setPage('Focus')}>
                          Launch Focus Session 🚀
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {page==='Settings'&& (
                <div className="settings-page-wrap">
                  <div className="page-header-clean">
                    <div>
                      <h2>🎨 Theme Playground &amp; Vibe</h2>
                      <p className="page-sub">Make Metanoia look and feel uniquely yours with colorful accents &amp; cozy settings! 🌈</p>
                    </div>
                  </div>

                  <div className="settings-clay-grid">
                    {/* Appearance Mode Card */}
                    <section className="settings-clay-card">
                      <div className="card-head-simple">
                        <p className="eyebrow">✦ WORKSPACE THEME</p>
                        <h3>Appearance Mode</h3>
                      </div>
                      <p className="page-sub">Choose your dedicated interface style and visual world.</p>
                      
                      <div className="theme-toggle-quad">
                        <button
                          type="button"
                          className={`theme-option-card ${state.settings?.theme === 'light' ? 'selected' : ''}`}
                          onClick={()=>void act({type:'settings.update',settings:{theme:'light'}},'Calm Daylight theme saved')}
                        >
                          <Sun size={24} className="text-amber"/>
                          <div>
                            <strong>☀️ Calm Daylight</strong>
                            <small>Soft warm oat &amp; parchment</small>
                          </div>
                          {state.settings?.theme === 'light' && <span className="active-badge">Active ✨</span>}
                        </button>

                        <button
                          type="button"
                          className={`theme-option-card ${state.settings?.theme === 'dark' || !state.settings?.theme ? 'selected' : ''}`}
                          onClick={()=>void act({type:'settings.update',settings:{theme:'dark'}},'Midnight theme saved')}
                        >
                          <Moon size={24} className="text-indigo"/>
                          <div>
                            <strong>🌙 Midnight</strong>
                            <small>Cozy modern slate</small>
                          </div>
                          {(state.settings?.theme === 'dark' || !state.settings?.theme) && <span className="active-badge">Active ✨</span>}
                        </button>

                        <button
                          type="button"
                          className={`theme-option-card system-theme-btn ${state.settings?.theme === 'system' ? 'selected' : ''}`}
                          onClick={()=>void act({type:'settings.update',settings:{theme:'system'}},'The System HUD activated')}
                        >
                          <Zap size={24} className="text-cyan pulse-glow"/>
                          <div>
                            <strong>⚡ The System</strong>
                            <small>Solo Leveling Hunter HUD</small>
                          </div>
                          {state.settings?.theme === 'system' && <span className="active-badge text-cyan">Active ⚡</span>}
                        </button>

                        <button
                          type="button"
                          className={`theme-option-card spell-theme-btn ${state.settings?.theme === 'spell' ? 'selected' : ''}`}
                          onClick={()=>void act({type:'settings.update',settings:{theme:'spell'}},'The Spell theme awakened')}
                        >
                          <Sparkles size={24} className="text-purple"/>
                          <div>
                            <strong>🔮 The Spell</strong>
                            <small>Shadow Slave ancient runes</small>
                          </div>
                          {state.settings?.theme === 'spell' && <span className="active-badge text-purple">Active ᛋ</span>}
                        </button>
                      </div>
                    </section>

                    {/* Accent Palette Card */}
                    <section className="settings-clay-card">
                      <div className="card-head-simple">
                        <p className="eyebrow">✦ COLOR PALETTE</p>
                        <h3>Playful Accent Tone</h3>
                      </div>
                      <p className="page-sub">Choose your favorite tactile candy accent color for active buttons and badges.</p>

                      <div className="palette-clay-grid">
                        {[
                          ['forest','🌲 Forest','#285A43','Fresh pine & sage'],
                          ['clay','🏺 Clay','#815B4D','Warm terracotta'],
                          ['plum','🍇 Plum','#6D5575','Twilight velvet violet'],
                          ['slate','🌊 Slate','#3B5A6A','Oceanic breeze']
                        ].map(([key,label,hex,sub])=>(
                          <button
                            key={key}
                            type="button"
                            className={`palette-chip-btn ${palette===key && !state.settings?.customColor ? 'active' : ''}`}
                            onClick={()=>void act({type:'settings.update',settings:{palette:key as any,customColor:null}},'Palette updated')}
                          >
                            <span style={{background:hex}} className="swatch-circle"/>
                            <div>
                              <strong>{label}</strong>
                              <small>{sub}</small>
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="custom-color-inline">
                        <label className="custom-picker-label">
                          <input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)}/>
                          <span>Custom Color: <code>{customColor}</code></span>
                        </label>
                        <button className="primary-pill-btn btn-sm" onClick={()=>void act({type:'settings.update',settings:{customColor}},'Custom color applied')}>
                          Apply Custom ✨
                        </button>
                      </div>
                    </section>

                    {/* Focus & Attention Pace Card */}
                    <section className="settings-clay-card">
                      <div className="card-head-simple">
                        <p className="eyebrow">✦ FOCUS &amp; PACE</p>
                        <h3>Session Pacing</h3>
                      </div>
                      <p className="page-sub">Configure starting duration and motion comfort for focus sessions.</p>

                      <div className="settings-field-group">
                        <label className="field-group-label">Default Focus Duration</label>
                        <div className="duration-pill-buttons">
                          {[15, 25, 45, 60].map(m=>(
                            <button
                              key={m}
                              type="button"
                              className={`duration-pill-btn ${minutes===m ? 'active' : ''}`}
                              onClick={()=>void act({type:'settings.update',settings:{focusMinutes:m}},'Duration updated')}
                            >
                              ⏱️ {m} min
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="settings-field-group">
                        <label className="field-group-label">Ambient Animations</label>
                        <div className="motion-toggle-row">
                          <p className="page-sub">Allow companion video and bouncy spring transitions.</p>
                          <button
                            type="button"
                            className={`btn-toggle-pill ${motionOn ? 'active' : ''}`}
                            onClick={()=>void act({type:'settings.update',settings:{motion:!motionOn}},'Motion preference saved')}
                          >
                            <span className={motionOn ? 'live-dot-pulse' : 'quiet-dot'}/>
                            {motionOn ? '✨ Bouncy Animations On' : 'Reduced Motion'}
                          </button>
                        </div>
                      </div>

                      <div className="settings-field-group">
                        <label className="field-group-label">Weather &amp; Season Atmosphere</label>
                        <p className="page-sub">Choose your live ambient background motion and mood.</p>
                        <div className="weather-mood-pill-group">
                          {[
                            ['rain', '🌧️ Rainy', '18°C · Slow & calm rain'],
                            ['autumn', '🍂 Autumn', '16°C · Fluttering leaves'],
                            ['sunny', '☀️ Sunny', '27°C · Warm sunbeams'],
                            ['snow', '❄️ Snowy', '1°C · Drifting snow'],
                            ['breezy', '⛅ Crisp', '24°C · Calm breeze'],
                            ['none', '🚫 None', 'Static · No weather motion'],
                          ].map(([key, label, desc]) => (
                            <button
                              key={key}
                              type="button"
                              className={`weather-mood-btn ${weatherMood === key ? 'active' : ''}`}
                              onClick={() => changeWeatherMood(key as WeatherMood)}
                              title={desc}
                            >
                              <strong>{label}</strong>
                              <small>{desc}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* Daily Capacity & Planning Card */}
                    <section className="settings-clay-card">
                      <div className="card-head-simple">
                        <p className="eyebrow">✦ CAPACITY &amp; PACING</p>
                        <h3>Daily Planned Capacity</h3>
                      </div>
                      <p className="page-sub">Set your daily target work minutes to prevent over-scheduling and burnout.</p>

                      <div className="duration-pill-buttons">
                        {[240, 300, 360, 420, 480].map(cap => (
                          <button
                            key={cap}
                            type="button"
                            className={`duration-pill-btn ${(state.settings?.dailyCapacityMinutes || 360) === cap ? 'active' : ''}`}
                            onClick={() => void act({ type: 'settings.update', settings: { dailyCapacityMinutes: cap } }, 'Daily capacity updated')}
                          >
                            {cap / 60}h ({cap}m)
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Local Storage, Backup & Restore Card */}
                    <section className="settings-clay-card">
                      <div className="card-head-simple">
                        <p className="eyebrow">✦ DATA, BACKUP &amp; RECOVERY</p>
                        <h3>Data Vault &amp; Backups</h3>
                      </div>
                      <p className="page-sub">100% offline-first. Your tasks, habits, and courses are stored safely in local SQLite with serialized writes.</p>

                      <div className="sqlite-stats-box">
                        <div className="stat-pill-item">
                          <span>Tasks</span>
                          <strong>{state.tasks.length}</strong>
                        </div>
                        <div className="stat-pill-item">
                          <span>Courses</span>
                          <strong>{state.courses.length}</strong>
                        </div>
                        <div className="stat-pill-item">
                          <span>Habit Days</span>
                          <strong>{state.habits.length}</strong>
                        </div>
                        <div className="stat-pill-item">
                          <span>Sessions</span>
                          <strong>{state.sessions.length}</strong>
                        </div>
                      </div>

                      <div className="backup-actions-row">
                        <button type="button" className="primary-pill-btn" onClick={handleExportBackup}>
                          <Download size={15}/> Export Full Backup (JSON)
                        </button>
                        <label className="secondary-pill-btn file-upload-btn">
                          <Upload size={15}/> Restore Backup…
                          <input type="file" accept=".json" onChange={handleFileRestoreSelect} style={{ display: 'none' }}/>
                        </label>
                      </div>

                      {restorePreview && (
                        <div className="restore-preview-box">
                          <h4>Confirm Backup Restoration</h4>
                          <p>
                            Found backup with <strong>{restorePreview.tasks?.length || 0} tasks</strong>, 
                            <strong> {restorePreview.courses?.length || 0} courses</strong>, and 
                            <strong> {restorePreview.habits?.length || 0} habit records</strong>.
                          </p>
                          <div className="restore-preview-actions">
                            <button type="button" className="primary-pill-btn btn-sm" onClick={handleConfirmRestore} disabled={busy}>
                              Restore &amp; Apply
                            </button>
                            <button type="button" className="btn-clean-ghost btn-sm" onClick={() => setRestorePreview(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {page==='Reflect'&& (
                <Suspense fallback={<p className="loading-state">Loading your insights…</p>}>
                  <Reflect state={state}/>
                </Suspense>
              )}

              {page==='Focus'&& (
                <div className="focus-page-wrap">
                  <div className="page-header-clean">
                    <div>
                      <h2>🚀 Deep Focus Lounge</h2>
                      <p className="page-sub">One fun quest at a time. Put on your headphones and ride the flow wave! 🌊</p>
                    </div>
                  </div>

                  <section className="focus-room-modern">
                    <div className="focus-left-column">
                      <div className="focus-companion-card">
                        <Companion active={visible&&motionOn}/>
                        <div className="companion-caption">
                          <span>🐾 Companion is present</span>
                          <button type="button" className="btn-link" onClick={()=>setPage('Studio')}>Visit Studio →</button>
                        </div>
                      </div>

                      {/* Music Player paired neatly on the left */}
                      <div id="focus-music-slot" className="focus-music-slot"/>
                    </div>

                    <div className="focus-timer-card">
                      {/* Astral Gamification Status Strip */}
                      <div className="gamification-status-strip">
                        <span className="rank-badge" title={`Astral Rank: ${rank.name} · Level ${rank.level}`}>
                          {rank.badge} <strong>{rank.name}</strong>
                        </span>
                        <span className="astral-streak-badge" title="Consecutive days of mindful focus">
                          ⭐ <strong>{streakInfo.streakDays} Day{streakInfo.streakDays === 1 ? '' : 's'} Streak</strong>
                        </span>
                        <span className="streak-shield-badge" title="Streak Shields protect your study streak if you miss a day">
                          🛡️ <strong>{state.streakShields ?? 1} Shield{(state.streakShields ?? 1) === 1 ? '' : 's'}</strong>
                        </span>
                        <button
                          type="button"
                          className={`btn-pill-subtle btn-sm ${floatingTimerActive ? 'active' : ''}`}
                          style={{ marginLeft: 'auto' }}
                          title="Open floating on-screen desktop timer overlay above other apps"
                          onClick={async () => {
                            try {
                              const isVisible = await invoke<boolean>('is_floating_timer_visible').catch(() => false);
                              if (isVisible) {
                                await invoke('hide_floating_timer');
                                setFloatingTimerActive(false);
                                localStorage.setItem('metanoia-floating-visible', 'false');
                                setNotice('Floating Timer minimized');
                              } else {
                                await invoke('show_floating_timer');
                                setFloatingTimerActive(true);
                                localStorage.setItem('metanoia-floating-visible', 'true');
                                setNotice('Floating Timer opened above windows! 🖥️');
                              }
                            } catch (e) {
                              console.warn(e);
                            }
                          }}
                        >
                          🖥️ Floating Timer {floatingTimerActive ? '● ON' : '○'}
                        </button>
                      </div>

                      {/* Qwen Local Adaptation Recommendation Card (Suggests; user approves) */}
                      {qwenSuggestion && !qwenDismissed && !state.focus && (
                        <div className="qwen-suggestion-card">
                          <div className="qwen-card-header">
                            <Sparkles size={16} className="text-cyan" />
                            <span>Qwen Pacing Recommendation</span>
                            <span className="qwen-badge">AI Assistant</span>
                          </div>
                          <p className="qwen-reason">{qwenSuggestion.reason}</p>
                          <div className="qwen-actions">
                            <button
                              type="button"
                              className="btn-pill-subtle btn-sm active"
                              onClick={() => {
                                setMinutes(qwenSuggestion.recommendedWorkMinutes);
                                setNotice(`Applied Qwen suggestion: ${qwenSuggestion.recommendedWorkMinutes}m work sprint!`);
                                setQwenDismissed(true);
                              }}
                            >
                              ✓ Approve & Apply ({qwenSuggestion.recommendedWorkMinutes}m / {qwenSuggestion.recommendedBreakMinutes}m)
                            </button>
                            <button
                              type="button"
                              className="btn-link text-muted btn-sm"
                              onClick={() => setQwenDismissed(true)}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Active Session Status Strip */}
                      {state.focus && (
                        <div className="focus-session-header-badge">
                          <span className="badge-block">
                            {state.focus.mode === 'short_break' || state.focus.mode === 'long_break'
                              ? `☕ Break · Focus Block ${state.focus.round || 1} Complete`
                              : `⚡ Focus Block ${state.focus.round || 1}`}
                          </span>
                          {(state.focus.sessionFocusSeconds || 0) + (state.focus.mode === 'work' ? elapsedSeconds : 0) >= 60 && (
                            <span className="badge-stat">
                              ⭐ {Math.floor(((state.focus.sessionFocusSeconds || 0) + (state.focus.mode === 'work' ? elapsedSeconds : 0)) / 60)}m focused this session
                            </span>
                          )}
                          {(totalBreakSeconds > 0 || todayPauseMinutes > 0) && (
                            <span className="badge-stat">
                              ☕ {totalBreakMinutes > 0 ? `${totalBreakMinutes}m` : `${totalBreakSeconds}s`} break{todayPauseMinutes > 0 ? ` (+${todayPauseMinutes}m paused)` : ''}
                            </span>
                          )}
                        </div>
                      )}

                      <span className={`timer-status-tag ${
                        state.focus?.mode === 'short_break' ? 'timer-tag-break' :
                        state.focus?.mode === 'long_break' ? 'timer-tag-long-break' :
                        state.focus ? 'timer-tag-work' : ''
                      }`}>
                        {state.focus ? (
                          state.focus.mode === 'short_break' ? '☕ SHORT BREAK · REST & RECHARGE' :
                          state.focus.mode === 'long_break' ? '🌴 LONG BREAK · STEP AWAY & MOVE' :
                          (elapsedSeconds >= targetSeconds && !state.focus.runningSince ? '🎉 BLOCK COMPLETE · CONTINUE OR FINISH' :
                           state.focus.runningSince ? `⚡ FOCUSING · BLOCK ${state.focus.round || 1}` : '⏸️ SESSION PAUSED')
                        ) : '✨ READY TO FOCUS'}
                      </span>

                      <h2 className="focus-intention-title">
                        {state.focus
                          ? (state.focus.mode === 'short_break' ? 'Take a breath, stretch & hydrate 💧' :
                             state.focus.mode === 'long_break' ? 'Substantial focus completed! Relax your eyes & body 🌴' :
                             (state.focus.intention || 'Focused work'))
                          : (focusMode === 'work' ? (focusIntention || 'What quest will you tackle?') : 'Recharge Break')}
                      </h2>

                      {!state.focus && (
                        <>
                          <div className="preset-selector-row">
                            {allPresets.map(p => {
                              const isActive = activePreset.id === p.id && minutes === p.workMinutes;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={`preset-tab-btn ${isActive ? 'active' : ''}`}
                                  onClick={() => {
                                    setFocusMode('work');
                                    setMinutes(p.workMinutes);
                                    void act({ type: 'settings.update', settings: { lastUsedPresetId: p.id } });
                                  }}
                                  title={`${p.name}: ${p.workMinutes}m focus with ${p.breakMinutes}m break`}
                                >
                                  <span>⏱️ {p.name}</span>
                                  <span className="preset-duration-tag">
                                    {p.workMinutes}m focus · {p.breakMinutes}m break
                                  </span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              className="preset-tab-btn btn-add-preset"
                              onClick={() => setShowPresetModal(true)}
                              title="Create and save a custom duration preset"
                            >
                              + Custom Preset
                            </button>
                          </div>

                          <div className="cycle-mode-selector-row" style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn-pill-subtle btn-sm"
                              title="Open floating desktop timer overlay above other apps"
                              onClick={async () => {
                                try {
                                  await invoke('show_floating_timer');
                                  setNotice('Floating Timer opened above windows! 🖥️');
                                } catch (e) {
                                  console.warn(e);
                                }
                              }}
                            >
                              🖥️ Floating Timer
                            </button>
                            <button
                              type="button"
                              className={`btn-pill-subtle btn-sm ${state.settings.soundAlerts !== false ? 'active' : ''}`}
                              title="Toggle sound chime on interval completion"
                              onClick={() => {
                                const nextVal = state.settings.soundAlerts === false;
                                void act({ type: 'settings.update', settings: { soundAlerts: nextVal } }, nextVal ? 'Chimes enabled 🔔' : 'Chimes muted 🔕');
                              }}
                            >
                              {state.settings.soundAlerts !== false ? '🔔 Chimes On' : '🔕 Chimes Off'}
                            </button>
                          </div>
                        </>
                      )}

                      {!state.focus && focusMode === 'work' && (
                        <div className="intention-pickers">
                          <input 
                            className="modern-input" 
                            aria-label="Focus intention" 
                            placeholder="Quick Focus / Name your quest… ✨" 
                            maxLength={200} 
                            value={focusIntention} 
                            onChange={e=>setFocusIntention(e.target.value)}
                          />
                          <select 
                            className="modern-select" 
                            aria-label="Link a planned task (optional)" 
                            value={focusTaskId} 
                            onChange={e=>{
                              setFocusTaskId(e.target.value);
                              if(e.target.value) setFocusIntention(state.tasks.find(t=>t.id===e.target.value)?.title||'');
                            }}
                          >
                            <option value="">No linked task · Independent Quick Focus</option>
                            {state.tasks.filter(t=>!t.done).slice(0,80).map(t=>(
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                          <select
                            className="modern-select"
                            aria-label="Link a course (optional)"
                            value={focusCourseId}
                            onChange={e=>setFocusCourseId(e.target.value)}
                          >
                            <option value="">No linked course</option>
                            {state.courses.map(c=>(
                              <option key={c.id} value={c.id}>📚 {c.title}</option>
                            ))}
                          </select>
                          {selectedCourseProductivity && selectedCourseProductivity.effectiveProcessingRate > 0 && (
                            <div className="course-productivity-chip" title="Calculated from your unique lecture progress vs focused study time">
                              ⚡ Pace: <strong>{selectedCourseProductivity.effectiveProcessingRate}x speed</strong> · ⏱️ <strong>{selectedCourseProductivity.estimatedRemainingStudyHours}h</strong> remaining study
                            </div>
                          )}
                        </div>
                      )}

                      {/* Huge Timer Display with Overtime & Soft Warning */}
                      {state.focus && isOvertime ? (
                        <>
                          <div className="huge-timer-display in-overtime" title="Minimal target reached · Tracking flow overtime">
                            <span className="overtime-plus">+</span>
                            {Math.floor(overtimeSeconds / 60).toString().padStart(2, '0')}
                            <span className="colon-pulse">:</span>
                            {String(overtimeSeconds % 60).padStart(2, '0')}
                          </div>
                          <div className="overtime-subcaption">
                            {(state.focus.mode || 'work') === 'work' 
                              ? `🎯 Target (${state.focus.duration}m) complete · Total: ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s in flow`
                              : `☕ Target (${state.focus.duration}m) complete · Total break: ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`}
                          </div>
                        </>
                      ) : (
                        <div className="huge-timer-display">
                          {Math.floor(countdownSeconds / 60).toString().padStart(2, '0')}
                          <span className="colon-pulse">:</span>
                          {String(countdownSeconds % 60).padStart(2, '0')}
                        </div>
                      )}

                      {/* Visual Progress Bar */}
                      {state.focus && (
                        <div className="pomo-progress-track">
                          <div
                            className={`pomo-progress-fill fill-${state.focus.mode === 'short_break' ? 'break' : state.focus.mode === 'long_break' ? 'long-break' : 'work'}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, Math.round((elapsedSeconds / targetSeconds) * 100)))}%`
                            }}
                          />
                        </div>
                      )}

                      {/* Pomodoro Target Reached Alert Banner (when paused at target) */}
                      {state.focus && elapsedSeconds >= targetSeconds && !state.focus.runningSince && (
                        <div className="pomo-sprint-complete-banner">
                          <div className="pomo-complete-banner-title">
                            {(state.focus.mode || 'work') === 'work' ? '🔔 Focus Sprint Complete!' : '☕ Break Complete!'}
                          </div>
                          <p className="pomo-complete-banner-text">
                            {(state.focus.mode || 'work') === 'work'
                              ? `You completed your ${state.focus.duration}m sprint goal! Timer safely paused so focus time doesn't run away. Take a 5m recovery break to recharge, or keep flowing below.`
                              : 'Recovery break finished! Mind refreshed and ready for your next focus round.'}
                          </p>
                        </div>
                      )}

                      {/* Soft Warning Flow Notice (Gentle, non-blocking reminder if user resumed into overtime) */}
                      {state.focus && isOvertime && state.focus.runningSince && (
                        <div className="soft-flow-notice">
                          <div className="soft-flow-badge">🎯 FLOW OVERTIME</div>
                          <p>
                            {(state.focus.mode || 'work') === 'work' 
                              ? `Minimal target (${state.focus.duration}m) complete! You're in flow state — continue as long as you like, or take a break whenever ready ☕` 
                              : `Break target (${state.focus.duration}m) complete! Rest as long as needed, or jump into Round ${(state.focus.mode === 'long_break' ? 1 : (state.focus.round || 1) + 1)} when ready 🚀`}
                          </p>
                        </div>
                      )}

                      {!state.focus && (
                        <div className="duration-quick-selector">
                          <div className="duration-pill-group">
                            {[15,20,25,45,50,60].map(m=>(
                              <button key={m} className={minutes===m?'active':''} onClick={()=>setMinutes(m)}>⏱️ {m} min</button>
                            ))}
                          </div>
                          <input type="range" aria-label="Focus minutes" min="5" max="120" step="5" value={minutes} onChange={e=>setMinutes(+e.target.value)}/>
                        </div>
                      )}

                      <div className="focus-controls-container">
                        {state.focus ? (
                          (state.focus.mode === 'short_break' || state.focus.mode === 'long_break') ? (
                            <>
                              {/* Break Mode: Tier 1 - Prominent Primary Action */}
                              <div className="focus-primary-action-wrap">
                                <button 
                                  type="button"
                                  className="primary-pill-btn primary-action-btn" 
                                  disabled={busy} 
                                  title="Complete break and proceed to your next focus block"
                                  onClick={() => {
                                    stopMusicPlayback();
                                    void act({ type: 'focus.resume' }, 'Break complete! Starting focus block 🚀');
                                  }}
                                >
                                  <Zap size={18} fill="currentColor"/>
                                  {state.focus.pendingWorkSeconds
                                    ? `Return to Focus (${Math.ceil(state.focus.pendingWorkSeconds / 60)}m left)`
                                    : `Continue to Focus Block ${(state.focus.round || 1) + 1} (${state.focus.workDuration || 25}m)`}
                                </button>
                              </div>

                              {/* Break Mode: Tier 2 - Secondary Actions */}
                              <div className="focus-secondary-actions-row">
                                <button
                                  type="button"
                                  className="secondary-pill-btn secondary-action-btn"
                                  disabled={busy}
                                  title={state.focus.runningSince ? 'Pause break timer' : 'Resume break timer'}
                                  onClick={() => void act({ type: state.focus?.runningSince ? 'focus.pause' : 'focus.resume', stayInBreak: true })}
                                >
                                  {state.focus.runningSince ? <Pause size={16}/> : <Play size={16} fill="currentColor"/>}
                                  {state.focus.runningSince ? 'Pause Break' : 'Resume Break'}
                                </button>
                                <button
                                  type="button"
                                  className="secondary-pill-btn secondary-action-btn btn-danger-soft"
                                  disabled={busy}
                                  title="End session now and save study history"
                                  onClick={async () => {
                                    stopMusicPlayback();
                                    const cur = state.focus;
                                    const realSecs = cur?.startedAt ? Math.max(elapsedSeconds, Math.floor((now - cur.startedAt) / 1000)) : elapsedSeconds;
                                    await act({ type: 'focus.finish', actualSeconds: realSecs }, 'Break logged!');
                                  }}
                                >
                                  <CheckCircle size={16}/>
                                  End Session
                                </button>
                              </div>

                              {/* Break Mode: Tier 3 - Utility Actions */}
                              <div className="focus-utility-actions-row">
                                <button
                                  type="button"
                                  className="btn-utility"
                                  disabled={busy}
                                  onClick={() => setShowAdjustTime(!showAdjustTime)}
                                  title="Adjust break duration or skip"
                                >
                                  <Clock3 size={13}/>
                                  + Adjust Break {showAdjustTime ? '▲' : '▼'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-utility"
                                  disabled={busy}
                                  title="Restart break timer to 00:00"
                                  onClick={() => void act({ type: 'focus.restart' }, 'Break timer restarted ↺')}
                                >
                                  <RotateCcw size={13}/>
                                  ↺ Restart
                                </button>
                                <button
                                  type="button"
                                  className="btn-utility text-danger-soft"
                                  disabled={busy}
                                  title="Discard session completely without saving to history"
                                  onClick={() => {
                                    if (confirm('Discard this session completely without saving to history?')) {
                                      stopMusicPlayback();
                                      void act({ type: 'focus.discard' }, 'Session discarded ✕');
                                    }
                                  }}
                                >
                                  <X size={13}/>
                                  ✕ Discard
                                </button>
                              </div>

                              {showAdjustTime && (
                                <div className="time-adjust-pills-row">
                                  <button
                                    type="button"
                                    className="time-adjust-pill"
                                    disabled={busy}
                                    onClick={() => void act({ type: 'focus.extend', minutes: 5 }, '+5m break added!')}
                                  >
                                    +5m Break
                                  </button>
                                  <button
                                    type="button"
                                    className="time-adjust-pill"
                                    disabled={busy}
                                    onClick={() => void act({ type: 'focus.extend', minutes: 10 }, '+10m break added!')}
                                  >
                                    +10m Break
                                  </button>
                                  <button
                                    type="button"
                                    className="time-adjust-pill"
                                    disabled={busy}
                                    onClick={() => {
                                      stopMusicPlayback();
                                      void act({ type: 'focus.skip_break' }, 'Break skipped! 🚀');
                                    }}
                                  >
                                    Skip Break ⏩
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {elapsedSeconds >= targetSeconds ? (
                                <>
                                  {/* Work Complete Mode: Tier 1 - Prominent Primary Action */}
                                  <div className="focus-primary-action-wrap">
                                    <button
                                      type="button"
                                      className="primary-pill-btn primary-action-btn"
                                      disabled={busy}
                                      title="Complete this focus interval and begin recovery break"
                                      onClick={() => {
                                        stopMusicPlayback();
                                        const isLong = ((state.focus?.round || 1) % (state.focus?.totalRounds || 4) === 0);
                                        void act(
                                          { type: 'focus.next_phase', actualSeconds: elapsedSeconds, longBreak: isLong, breakMinutes: isLong ? 20 : 5 },
                                          isLong ? 'Started 20m Long Break 🌴' : 'Started 5m Short Break ☕'
                                        );
                                      }}
                                    >
                                      <Coffee size={18}/>
                                      {((state.focus?.round || 1) % (state.focus?.totalRounds || 4) === 0)
                                        ? '🌴 Start 20m Long Break'
                                        : `☕ Start 5m Break (Round ${state.focus?.round || 1} Done)`}
                                    </button>
                                  </div>

                                  {/* Work Complete Mode: Tier 2 - Secondary Actions */}
                                  <div className="focus-secondary-actions-row">
                                    <button
                                      type="button"
                                      className="secondary-pill-btn secondary-action-btn"
                                      disabled={busy}
                                      title="Skip break and immediately launch next round focus"
                                      onClick={async () => {
                                        stopMusicPlayback();
                                        const cur = state.focus;
                                        if (!cur) return;
                                        const nextRound = (cur.round || 1) + 1;
                                        const sprintMins = cur.workDuration || 25;
                                        await act({ type: 'focus.finish', actualSeconds: elapsedSeconds });
                                        await act({
                                          type: 'focus.start',
                                          minutes: sprintMins,
                                          workDuration: sprintMins,
                                          mode: 'work',
                                          round: nextRound,
                                          totalRounds: cur.totalRounds || 4,
                                          intention: cur.intention || 'Focused work',
                                          taskId: cur.taskId,
                                          courseId: cur.courseId
                                        }, `Started Round ${nextRound} Focus 🚀`);
                                      }}
                                    >
                                      <Zap size={16} fill="currentColor"/>
                                      Launch Round {(state.focus?.round || 1) + 1}
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-pill-btn secondary-action-btn btn-danger-soft"
                                      disabled={busy}
                                      title="Finish session and save history"
                                      onClick={async () => {
                                        const cur = state.focus;
                                        if (!cur) return;
                                        const secs = Math.max(activeSeconds(cur, Date.now()), elapsedSeconds);
                                        await act({ type: 'focus.finish', actualSeconds: secs }, 'Focus session completed!');
                                        setReviewingSession({
                                          id: cur.id,
                                          started_utc: new Date(cur.startedAt || (now - secs * 1000)).toISOString(),
                                          completed_utc: new Date(now).toISOString(),
                                          active_seconds: secs,
                                          break_seconds: 0,
                                          state: 'complete',
                                          taskId: cur.taskId,
                                          courseId: cur.courseId,
                                          intention: cur.intention || 'Focused work',
                                          mode: 'work',
                                          round: cur.round || 1,
                                          work_duration: cur.duration
                                        });
                                      }}
                                    >
                                      <CheckCircle size={16}/>
                                      End Session
                                    </button>
                                  </div>

                                  {/* Work Complete Mode: Tier 3 - Utility Actions */}
                                  <div className="focus-utility-actions-row">
                                    <button
                                      type="button"
                                      className="btn-utility"
                                      disabled={busy}
                                      onClick={() => setShowAdjustTime(!showAdjustTime)}
                                      title="Add time or wrap up"
                                    >
                                      <Clock3 size={13}/>
                                      + Adjust Time {showAdjustTime ? '▲' : '▼'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-utility"
                                      disabled={busy}
                                      title="Restart interval back to 00:00"
                                      onClick={() => void act({ type: 'focus.restart' }, 'Interval restarted to 00:00 ↺')}
                                    >
                                      <RotateCcw size={13}/>
                                      ↺ Restart
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-utility text-danger-soft"
                                      disabled={busy}
                                      title="Discard session completely without saving to history"
                                      onClick={() => {
                                        if (confirm('Discard this focus session without saving to history?')) {
                                          stopMusicPlayback();
                                          void act({ type: 'focus.discard' }, 'Session discarded ✕');
                                        }
                                      }}
                                    >
                                      <X size={13}/>
                                      ✕ Discard
                                    </button>
                                  </div>

                                  {showAdjustTime && (
                                    <div className="time-adjust-pills-row">
                                      <button
                                        type="button"
                                        className="time-adjust-pill"
                                        disabled={busy}
                                        onClick={() => {
                                          setWrapUpAdded(true);
                                          void act({ type: 'focus.extend', minutes: 5 }, '+5m wrap-up added!');
                                          if (!state.focus?.runningSince) void act({ type: 'focus.resume' });
                                        }}
                                      >
                                        +5m Wrap-up
                                      </button>
                                      <button
                                        type="button"
                                        className="time-adjust-pill"
                                        disabled={busy}
                                        onClick={() => void act({ type: 'focus.extend', minutes: 15 }, '+15m added!')}
                                      >
                                        +15m
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Active Work Mode: Tier 1 - Prominent Primary Action */}
                                  <div className="focus-primary-action-wrap">
                                    <button 
                                      type="button"
                                      className="primary-pill-btn primary-action-btn" 
                                      disabled={busy} 
                                      onClick={() => void act(
                                        { type: state.focus?.runningSince ? 'focus.pause' : 'focus.resume' },
                                        state.focus?.runningSince ? 'Session paused' : 'Focus resumed!'
                                      )}
                                    >
                                      {state.focus?.runningSince ? <Pause size={18}/> : <Play size={18} fill="currentColor"/>}
                                      {state.focus?.runningSince ? '⏸ Pause Focus' : '▶ Resume Focus'}
                                    </button>
                                  </div>

                                  {/* Active Work Mode: Tier 2 - Secondary Actions */}
                                  <div className="focus-secondary-actions-row">
                                    <button
                                      type="button"
                                      className="secondary-pill-btn secondary-action-btn"
                                      disabled={busy}
                                      title="Need a pause? Take an early break now without losing unfinished focus time"
                                      onClick={() => {
                                        const isLong = ((state.focus?.round || 1) % (state.focus?.totalRounds || 4) === 0);
                                        void act(
                                          { type: 'focus.early_break', longBreak: isLong, breakMinutes: isLong ? 20 : 5 },
                                          isLong ? 'Started 20m Long Break 🌴' : 'Preserved remaining focus time & started 5m break ☕'
                                        );
                                      }}
                                    >
                                      <Coffee size={16}/>
                                      {((state.focus?.round || 1) % (state.focus?.totalRounds || 4) === 0) ? '🌴 Long Break' : '☕ Early Break'}
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-pill-btn secondary-action-btn btn-danger-soft"
                                      disabled={busy}
                                      title="End session now and save study history"
                                      onClick={async () => {
                                        const cur = state.focus;
                                        if (!cur) return;
                                        const secs = Math.max(activeSeconds(cur, Date.now()), elapsedSeconds);
                                        await act({ type: 'focus.finish', actualSeconds: secs }, 'Focus session completed!');
                                        setReviewingSession({
                                          id: cur.id,
                                          started_utc: new Date(cur.startedAt || (now - secs * 1000)).toISOString(),
                                          completed_utc: new Date(now).toISOString(),
                                          active_seconds: secs,
                                          break_seconds: 0,
                                          state: 'complete',
                                          taskId: cur.taskId,
                                          courseId: cur.courseId,
                                          intention: cur.intention || 'Focused work',
                                          mode: 'work',
                                          round: cur.round || 1,
                                          work_duration: cur.duration
                                        });
                                      }}
                                    >
                                      <CheckCircle size={16}/>
                                      End Session
                                    </button>
                                  </div>

                                  {/* Active Work Mode: Tier 3 - Utility Actions */}
                                  <div className="focus-utility-actions-row">
                                    <button
                                      type="button"
                                      className="btn-utility"
                                      disabled={busy}
                                      onClick={() => setShowAdjustTime(!showAdjustTime)}
                                      title="Adjust focus duration"
                                    >
                                      <Clock3 size={13}/>
                                      + Adjust Time {showAdjustTime ? '▲' : '▼'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-utility"
                                      disabled={busy}
                                      title="Restart this sprint back to 00:00 without saving partial progress"
                                      onClick={() => void act({ type: 'focus.restart' }, 'Timer restarted to 00:00 ↺')}
                                    >
                                      <RotateCcw size={13}/>
                                      ↺ Restart
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-utility text-danger-soft"
                                      disabled={busy}
                                      title="Discard this session completely without saving to history"
                                      onClick={() => {
                                        if (confirm('Discard this focus session without saving to history?')) {
                                          stopMusicPlayback();
                                          void act({ type: 'focus.discard' }, 'Session discarded ✕');
                                        }
                                      }}
                                    >
                                      <X size={13}/>
                                      ✕ Discard
                                    </button>
                                  </div>

                                  {showAdjustTime && (
                                    <div className="time-adjust-pills-row">
                                      <button
                                        type="button"
                                        className="time-adjust-pill"
                                        disabled={busy}
                                        title="Add 5 more minutes flow"
                                        onClick={() => {
                                          void act({ type: 'focus.postpone_break', minutes: 5 }, '+5m focus added!');
                                          if (!state.focus?.runningSince) void act({ type: 'focus.resume' });
                                        }}
                                      >
                                        +5m
                                      </button>
                                      <button
                                        type="button"
                                        className="time-adjust-pill"
                                        disabled={busy}
                                        title="Chain 15 more minutes onto this session"
                                        onClick={() => void act({ type: 'focus.extend', minutes: 15 }, '+15 minutes chained!')}
                                      >
                                        +15m
                                      </button>
                                      <button
                                        type="button"
                                        className="time-adjust-pill"
                                        disabled={busy}
                                        title="Chain 30 more minutes onto this session"
                                        onClick={() => void act({ type: 'focus.extend', minutes: 30 }, '+30 minutes chained!')}
                                      >
                                        +30m
                                      </button>
                                      <button
                                        type="button"
                                        className="time-adjust-pill"
                                        disabled={busy}
                                        title="Take a 20-minute restorative break right now"
                                        onClick={() => void act({ type: 'focus.early_break', longBreak: true, breakMinutes: 20 }, 'Started 20m Long Break 🌴')}
                                      >
                                        🌴 20m Break
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )
                        ) : (
                          <div className="focus-primary-action-wrap">
                            <button 
                              type="button"
                              className="primary-pill-btn primary-action-btn" 
                              disabled={busy} 
                              onClick={() => {
                                const roundToStart = selectedRound ?? nextRoundForNewSession;
                                setSelectedRound(null);
                                void act(
                                  {
                                    type: 'focus.start',
                                    minutes,
                                    workDuration: minutes,
                                    intention: focusIntention.trim() || state.tasks.find(t=>t.id===focusTaskId)?.title || state.courses.find(c=>c.id===focusCourseId)?.title || 'Quick Focus',
                                    taskId: focusTaskId || null,
                                    courseId: focusCourseId || null,
                                    mode: 'work',
                                    round: roundToStart,
                                    totalRounds: cycleMode === 'single' ? 1 : (activePreset.totalRounds || 4),
                                    breakDuration: activePreset.breakMinutes || 5,
                                    longBreakDuration: activePreset.longBreakMinutes || 20,
                                    presetId: activePreset.id,
                                    targetTotalDuration: calculatePresetTotalMinutes(activePreset),
                                    autoAdvance: cycleMode === 'cycle' && activePreset.autoAdvance !== false
                                  },
                                  `Round ${roundToStart} started! 🚀`
                                );
                              }}
                            >
                              <Play size={18} fill="currentColor"/>
                              🚀 Start Round {selectedRound ?? nextRoundForNewSession} Focus ({minutes}m)
                            </button>
                          </div>
                        )}
                      </div>

                      {completedSession && (
                        <div className="session-complete-banner">
                          <div className="session-complete-head">
                            <CheckCircle size={22} className="text-emerald"/>
                            <div>
                              <strong>
                                Block Finished! ({Math.round(completedSession.activeSeconds / 60)}m focused)
                                {todayFocusMinutes > 0 ? ` · 🔥 Total Today: ${Math.floor(todayFocusMinutes / 60) > 0 ? `${Math.floor(todayFocusMinutes / 60)}h ` : ''}${todayFocusMinutes % 60}m` : ''}
                              </strong>
                              <p className="session-complete-sub">
                                {completedSession.intention} · Ready to start your next block?
                              </p>
                            </div>
                          </div>
                          <div className="session-complete-actions">
                            <button 
                              type="button" 
                              className="primary-pill-btn btn-sm"
                              title={`Start next ${completedSession.duration || minutes}m block right away`}
                              onClick={() => {
                                const intention = completedSession.intention;
                                const taskId = completedSession.taskId;
                                const blockMins = completedSession.duration || minutes;
                                setCompletedSession(null);
                                void act({ 
                                  type: 'focus.start', 
                                  minutes: blockMins, 
                                  workDuration: blockMins,
                                  intention, 
                                  taskId: taskId || null 
                                }, `Started next ${blockMins}m block 🚀`);
                              }}
                            >
                              <Play size={13} fill="currentColor"/> Start Next {completedSession.duration ? `${completedSession.duration}m Block` : 'Hour'} 🚀
                            </button>

                            <button 
                              type="button" 
                              className="secondary-pill-btn btn-sm"
                              title="Take a quick 5-minute breather before starting your next round"
                              onClick={() => {
                                const taskId = completedSession.taskId;
                                setCompletedSession(null);
                                void act({
                                  type: 'focus.start',
                                  minutes: 5,
                                  mode: 'short_break',
                                  intention: '☕ 5m Short Break · Rest & Stretch',
                                  taskId: taskId || null
                                }, 'Started 5m short break ☕');
                              }}
                            >
                              <Coffee size={13}/> 5m Quick Break
                            </button>

                            <button 
                              type="button" 
                              className="secondary-pill-btn btn-sm"
                              title="Take a 20-minute long recovery break away from screens"
                              onClick={() => {
                                const taskId = completedSession.taskId;
                                setCompletedSession(null);
                                void act({
                                  type: 'focus.start',
                                  minutes: 20,
                                  mode: 'long_break',
                                  intention: '🌴 20m Long Break · Walk, hydrate & recharge',
                                  taskId: taskId || null
                                }, 'Started 20m long break 🌴');
                              }}
                            >
                              🌴 20m Long Break
                            </button>

                            {completedSession.taskId && (
                              <button 
                                type="button" 
                                className="btn-pill-subtle btn-sm"
                                onClick={async () => {
                                  const t = state.tasks.find(x => x.id === completedSession.taskId);
                                  if (t && !t.done) {
                                    await act({ type: 'task.toggle', id: t.id, done: true }, `Task "${t.title}" completed!`);
                                  }
                                }}
                              >
                                <Check size={14}/> Complete Task
                              </button>
                            )}

                            <button 
                              type="button" 
                              className="btn-clean-ghost btn-sm" 
                              onClick={() => setCompletedSession(null)}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}

                      <p className="timer-hint">✨ Paused time does not count. 20 focused minutes earns +25 XP and +5 credits.</p>
                    </div>
                  </section>

                  {/* Recorded sessions history */}
                  <div className="focus-history-card">
                    <div className="history-head">
                      <h3>Recent Focus Triumphs 🏆</h3>
                      <span>{state.sessions.length} total sessions</span>
                    </div>

                    {state.sessions.length ? (
                      <>
                        <div className="history-pills-grid">
                          {state.sessions.slice(-6).reverse().map(session => {
                            const isBreak = session.mode === 'short_break' || session.mode === 'long_break';
                            const activeMins = Math.round(session.active_seconds / 60);
                            const timeSpan = formatSessionTimeRange(session.started_utc, session.completed_utc, session.active_seconds);
                            const breakMins = session.break_seconds ? Math.round(session.break_seconds / 60) : 0;

                            return (
                              <article 
                                key={session.id} 
                                className={`history-pill-item ${isBreak ? 'item-break' : 'item-work'}`}
                                onClick={() => setInspectingSession(session)}
                                style={{ cursor: 'pointer' }}
                                title="Click to view full session timing breakdown"
                              >
                                {isBreak ? (
                                  <Coffee size={16} className="text-cyan" />
                                ) : (
                                  <Sparkles size={16} className="text-amber" />
                                )}
                                <div className="history-text">
                                  <strong>
                                    {isBreak
                                      ? `${activeMins || 5}m break`
                                      : `${session.active_seconds < 60 ? `${session.active_seconds}s` : `${activeMins} min`} focused`}
                                    {timeSpan ? ` (${timeSpan})` : ''}
                                  </strong>
                                  <small>
                                    {session.intention || (isBreak ? 'Rest & Hydrate' : 'Focused work')}
                                    {breakMins > 0 ? ` · ☕ ${breakMins}m paused/break` : ''}
                                  </small>
                                </div>
                                <span className="history-date">
                                  {new Date(session.started_utc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </article>
                            );
                          })}
                        </div>

                        {todayBreaks.length > 0 && (
                          <div className="history-breaks-summary-bar">
                            <span className="breaks-bar-title">
                              ☕ <strong>{todayBreakMinutes}m</strong> breaks today ({todayBreaks.length} break{todayBreaks.length === 1 ? '' : 's'}):
                            </span>
                            <div className="breaks-chips-row">
                              {todayBreaks.map(b => (
                                <span key={b.id} className="break-log-chip">
                                  {b.mode === 'long_break' ? '🌴 Long Break' : '☕ Short Break'} · {Math.max(1, Math.round(b.active_seconds / 60 || 5))}m
                                  {b.started_utc ? ` (${formatTime12h(b.started_utc)})` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted">Your completed focus sessions will be recorded here.</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Persistent Music Player: Stays mounted so background audio never stops across tabs */}
          <MusicPlayer activePage={page} onOpenFocus={()=>setPage('Focus')}/>

          <ItemDetailModal
            session={inspectingSession}
            allTasks={state.tasks}
            allSessions={state.sessions}
            onClose={() => setInspectingSession(null)}
            onDeleteSession={(id) => void act({ type: 'session.delete', id }, 'Session removed from history 🗑️')}
          />

          <PomodoroBreakModal
            prompt={breakPrompt}
            onStartBreak={async (breakMode, breakMinutes) => {
              setBreakPrompt(null);
              stopMusicPlayback();
              await act({
                type: 'focus.next_phase',
                actualSeconds: (breakPrompt?.duration || 25) * 60,
                longBreak: breakMode === 'long_break',
                breakMode,
                breakMinutes,
              }, breakMode === 'long_break' ? 'Started 20m Long Break 🌴' : 'Started 5m Short Break ☕');
            }}
            onStartNextWorkSprint={async () => {
              const p = breakPrompt;
              setBreakPrompt(null);
              if (!p) return;
              if (p.mode === 'work') {
                const workMins = p.workDuration || p.duration || 25;
                const nextRound = (p.round || 1) + 1;
                await act({ type: 'focus.finish', actualSeconds: p.duration * 60 });
                await act({
                  type: 'focus.start',
                  minutes: workMins,
                  workDuration: workMins,
                  mode: 'work',
                  round: nextRound,
                  totalRounds: p.totalRounds || 4,
                  intention: p.intention,
                  taskId: p.taskId || null
                }, `Started Round ${nextRound} Focus 🚀`);
              } else {
                stopMusicPlayback();
                await act({ type: 'focus.next_phase', actualSeconds: p.duration * 60 }, 'Break done! Let\'s focus 🚀');
              }
            }}
            onExtendSession={async (addMinutes) => {
              setBreakPrompt(null);
              await act({ type: 'focus.extend', minutes: addMinutes }, `+${addMinutes}m added!`);
              await act({ type: 'focus.resume' });
            }}
            onFinishSession={async () => {
              const p = breakPrompt;
              setBreakPrompt(null);
              if (!p) return;
              if (p.mode !== 'work') stopMusicPlayback();
              await act({ type: 'focus.finish', actualSeconds: p.duration * 60 }, 'Session completed & logged!');
              if (p.mode === 'work') {
                setCompletedSession({
                  id: p.sessionId,
                  intention: p.intention,
                  taskId: p.taskId,
                  activeSeconds: p.duration * 60,
                  duration: p.duration
                });
              }
            }}
            onDismiss={() => setBreakPrompt(null)}
          />

          {/* End-of-Session Review Modal */}
          {reviewingSession && (
            <SessionReviewModal
              session={reviewingSession}
              linkedTask={state.tasks.find(t => t.id === reviewingSession.taskId)}
              linkedCourse={state.courses.find(c => c.id === reviewingSession.courseId)}
              onClose={() => setReviewingSession(null)}
              onSaveReview={async (sessionId, rating, notes, markTaskDone) => {
                await act({
                  type: 'focus.review',
                  sessionId,
                  rating,
                  notes
                }, 'Session review saved! +10 XP 🌟');
                if (markTaskDone && reviewingSession.taskId) {
                  await act({ type: 'task.toggle', id: reviewingSession.taskId }, 'Task marked as done! ✅');
                }
                setReviewingSession(null);
              }}
            />
          )}

          {/* Create Custom Focus Preset Modal */}
          {showPresetModal && (
            <div className="modal-backdrop" onClick={() => setShowPresetModal(false)}>
              <div className="modal-card preset-editor-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '92vw' }}>
                <div className="modal-header">
                  <h3>Create Focus Preset ⏱️</h3>
                  <button type="button" className="btn-clean-ghost" onClick={() => setShowPresetModal(false)}>✕</button>
                </div>
                <p className="page-sub">Configure customized Pomodoro sprint and break intervals.</p>

                <div className="preset-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
                  <label>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Preset Name</span>
                    <input
                      className="modern-input"
                      value={presetNameInput}
                      onChange={e => setPresetNameInput(e.target.value)}
                      placeholder="e.g. Deep Study Sprint"
                    />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Work Sprints (min)</span>
                      <input
                        type="number"
                        min="5"
                        max="180"
                        className="modern-input"
                        value={presetWorkInput}
                        onChange={e => setPresetWorkInput(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Short Break (min)</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        className="modern-input"
                        value={presetBreakInput}
                        onChange={e => setPresetBreakInput(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Long Break (min)</span>
                      <input
                        type="number"
                        min="5"
                        max="90"
                        className="modern-input"
                        value={presetLongBreakInput}
                        onChange={e => setPresetLongBreakInput(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Rounds per Cycle</span>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        className="modern-input"
                        value={presetRoundsInput}
                        onChange={e => setPresetRoundsInput(Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button type="button" className="secondary-pill-btn" onClick={() => setShowPresetModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-pill-btn"
                    onClick={async () => {
                      const p: FocusPreset = {
                        id: 'custom-' + Date.now(),
                        name: presetNameInput.trim() || 'Custom Sprint',
                        workMinutes: Number(presetWorkInput) || 25,
                        breakMinutes: Number(presetBreakInput) || 5,
                        longBreakMinutes: Number(presetLongBreakInput) || 20,
                        totalRounds: Number(presetRoundsInput) || 4,
                        autoAdvance: true,
                        description: `${presetWorkInput}m work · ${presetBreakInput}m break`
                      };
                      await act({ type: 'focus.save_preset', preset: p }, 'Custom preset saved!');
                      setMinutes(p.workMinutes);
                      setShowPresetModal(false);
                    }}
                  >
                    Save & Apply Preset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal / Dialogs */}
          {courseEditor && (
            <CourseEditor 
              course={courseEditor} 
              lessons={state.lessons.filter(l=>l.courseId===courseEditor.id)}
              close={()=>{ setCourseEditor(null); setError(''); }} 
              busy={busy} 
              error={error}
              save={async course=>{
                const ok = await act({type:'course.save',course},'Course saved');
                if(ok) {
                  setCourseEditor(null);
                } else {
                  throw new Error(error || 'Failed to save course. Please check all fields.');
                }
              }}
            />
          )}

          {courseDetail && state.courses.find(c=>c.id===courseDetail) && (
            <CourseDetail
              course={state.courses.find(c=>c.id===courseDetail)!}
              lessons={state.lessons.filter(l=>l.courseId===courseDetail)}
              events={state.lessonEvents.filter(e=>e.courseId===courseDetail)}
              close={()=>setCourseDetail(null)}
              edit={()=>{
                setCourseEditor(state.courses.find(c=>c.id===courseDetail)!);
                setCourseDetail(null);
              }}
              act={act}
              busy={busy}
              openLink={async url=>{
                try{await openExternal(url);}catch(e){setError((e as Error).message);}
              }}
              openNotionLink={handleOpenNotion}
            />
          )}

          {notionPromptCourse && (
            <Modal close={()=>setNotionPromptCourse(null)}>
              <div className="editor-modal-wrap">
                <h3>Notion Notebook</h3>
                <p className="page-sub">Link a dedicated Notion notebook or page for <strong>{notionPromptCourse.title}</strong></p>
                <form onSubmit={async (e:FormEvent)=>{
                  e.preventDefault();
                  const url=notionInputUrl.trim();
                  if(!url)return;
                  const updated: Course={
                    ...notionPromptCourse,
                    notionUrl:url,
                    deadline: typeof notionPromptCourse.deadline === 'string' ? notionPromptCourse.deadline : '',
                    total: Math.max(1, Number(notionPromptCourse.total) || 1),
                    done: Math.max(0, Math.min(Math.max(1, Number(notionPromptCourse.total) || 1), Number(notionPromptCourse.done) || 0)),
                    minutesPerLesson: Math.max(1, Math.min(1440, Number(notionPromptCourse.minutesPerLesson) || 25)),
                    nextUrl: typeof notionPromptCourse.nextUrl === 'string' && notionPromptCourse.nextUrl.trim() ? notionPromptCourse.nextUrl.trim() : null
                  };
                  if(await act({type:'course.save',course:updated},'Notion notebook link saved')){
                    setNotionPromptCourse(null);
                    void openNotion(url);
                  }
                }}>
                  <label className="form-label">
                    Notion Notebook or Page URL
                    <input 
                      autoFocus 
                      required 
                      placeholder="https://notion.so/... or notion://..." 
                      value={notionInputUrl} 
                      onChange={e=>setNotionInputUrl(e.target.value)} 
                      className="modern-input"
                    />
                  </label>
                  {error && (
                    <div className="error-banner" style={{ margin: '8px 0', padding: '8px 12px', fontSize: '12px' }} role="alert">
                      <span>{error}</span>
                    </div>
                  )}
                  <p className="field-hint">
                    Opens directly inside your Notion desktop application without touching Chrome or altering your Windows default browser.
                  </p>
                  <div className="modal-actions-row">
                    <button type="button" className="btn-clean-ghost" onClick={()=>setNotionPromptCourse(null)}>Cancel</button>
                    <button className="primary-pill-btn" type="submit" disabled={!notionInputUrl.trim()||busy}>
                      Save &amp; Open in Notion
                    </button>
                  </div>
                </form>
              </div>
            </Modal>
          )}

          <footer className="modern-footer">
            <span>Metanoia V2 · Focused, playful productivity</span>
            <span className="footer-meta">Local SQLite persistence · Offline-first</span>
          </footer>
        </main>

        {/* Floating Toast Notification */}
        <AnimatePresence>
          {notice && (
            <motion.div 
              className="modern-toast" 
              role="status" 
              initial={{y:35,opacity:0}} 
              animate={{y:0,opacity:1}} 
              exit={{y:35,opacity:0}}
            >
              <CheckCheck size={18} className="text-green"/>
              <span>{notice}</span>
              {undo && (
                <button className="btn-undo-pill" onClick={()=>{void act(undo,'Undone');setUndo(null);}}>
                  Undo
                </button>
              )}
              <button className="icon-btn-ghost-sm" onClick={()=>{setNotice('');setUndo(null);}}>
                <X size={14}/>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task Editor Modal */}
        {editor && (
          <TaskEditor 
            task={editor} 
            close={()=>setEditor(null)} 
            busy={busy} 
            save={async t=>{
              if(await act({type:'task.save',task:t},'Task saved!')) setEditor(null);
            }}
            onDelete={async id=>{
              if(await act({type:'task.delete',id},'Task deleted')) setEditor(null);
            }}
          />
        )}

        {/* Reward Modal */}
        {reward && (
          <Modal close={()=>setReward(null)}>
            <div className="reward-modal-content">
              <Art src={reward.art} className="modal-art"/>
              <span className="reward-item-num">JOY REWARD</span>
              <h2>{reward.title}</h2>
              <p>{reward.description}</p>
              <div className="reward-balance-badge">
                <strong>{reward.cost} credits</strong>
                <small>({state.credits} available)</small>
              </div>
              <button 
                className="primary-pill-btn btn-lg" 
                disabled={busy||state.credits<reward.cost} 
                onClick={()=>{
                  const r=reward;
                  void act({type:'reward.redeem',id:r.id,requestId:crypto.randomUUID()},'Enjoy your little joy! 🎉').then(ok=>{
                    if(ok)setReward(null);
                  });
                }}
              >
                {state.credits<reward.cost ? 'Need more credits' : 'Redeem Reward'}
              </button>
            </div>
          </Modal>
        )}

        {/* Command Palette (Ctrl+K) */}
        {search && (
          <div className="command-palette-backdrop" onMouseDown={()=>setSearch(false)}>
            <div className="command-palette-dialog" role="dialog" aria-modal="true" aria-label="Command Search" onMouseDown={e=>e.stopPropagation()}>
              <div className="command-palette-head">
                <Search size={18} className="text-muted"/>
                <input 
                  autoFocus 
                  placeholder="Jump to a view or search tasks…" 
                  aria-label="Search" 
                  value={query} 
                  onChange={e=>setQuery(e.target.value)}
                />
                <kbd>ESC</kbd>
              </div>

              <div className="command-palette-body">
                <div className="command-group-heading">VIEWS</div>
                {tabs
                  .filter(([t])=>!query||t.toLowerCase().includes(query.toLowerCase()))
                  .map(([t,Icon])=>(
                    <button 
                      key={t} 
                      type="button" 
                      className="command-item-btn" 
                      onClick={()=>{setPage(t);setSearch(false);setQuery('');}}
                    >
                      <Icon size={16}/>
                      <span>{t}</span>
                      <ArrowRight size={14} className="cmd-arrow"/>
                    </button>
                  ))}

                {/* Courses Search in Command Palette */}
                {state.courses.some(course => query && course.title.toLowerCase().includes(query.toLowerCase())) && (
                  <>
                    <div className="command-group-heading">COURSES</div>
                    {state.courses
                      .filter(course => query && course.title.toLowerCase().includes(query.toLowerCase()))
                      .slice(0, 4)
                      .map(course => (
                        <div key={course.id} className="command-task-item">
                          <button 
                            type="button" 
                            className="task-name-btn" 
                            onClick={() => {
                              setSearch(false);
                              setPage('Courses');
                              setCourseDetail(course.id);
                            }}
                          >
                            <span>📚 {course.title}</span>
                            <small>{course.done}/{course.total} lectures · {course.source === 'youtube' ? 'YouTube Course' : course.source === 'local' ? 'Local Folder' : 'Personal'}</small>
                          </button>
                          <button 
                            type="button" 
                            className="task-focus-quick" 
                            onClick={() => {
                              setSearch(false);
                              setPage('Courses');
                              setCourseDetail(course.id);
                            }}
                          >
                            <ArrowRight size={13}/> Open
                          </button>
                        </div>
                      ))}
                  </>
                )}

                {/* Lectures & Videos Search in Command Palette */}
                {state.lessons.some(l => query && l.title.toLowerCase().includes(query.toLowerCase())) && (
                  <>
                    <div className="command-group-heading">LECTURES &amp; VIDEOS</div>
                    {state.lessons
                      .filter(l => query && l.title.toLowerCase().includes(query.toLowerCase()))
                      .slice(0, 5)
                      .map(l => {
                        const course = state.courses.find(c => c.id === l.courseId);
                        return (
                          <div key={l.id} className="command-task-item">
                            <button 
                              type="button" 
                              className="task-name-btn" 
                              onClick={() => {
                                setSearch(false);
                                setPage('Courses');
                                setCourseDetail(l.courseId);
                              }}
                            >
                              <span>{l.completed ? '✔️' : '▶️'} {l.title}</span>
                              <small>{course?.title || 'Course'} · Lecture #{l.position}</small>
                            </button>
                            {l.sourceUrl ? (
                              <button 
                                type="button" 
                                className="task-focus-quick" 
                                onClick={() => {
                                  setSearch(false);
                                  void openExternal(l.sourceUrl!);
                                }}
                              >
                                <Play size={11} fill="currentColor"/> Play
                              </button>
                            ) : (
                              <button 
                                type="button" 
                                className="task-focus-quick" 
                                onClick={() => {
                                  setSearch(false);
                                  setPage('Courses');
                                  setCourseDetail(l.courseId);
                                }}
                              >
                                <ArrowRight size={11}/> View
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </>
                )}

                {/* Tasks Search in Command Palette */}
                {state.tasks.some(t => query && (
                  t.title.toLowerCase().includes(query.toLowerCase()) ||
                  t.category.toLowerCase().includes(query.toLowerCase()) ||
                  (t.goals && t.goals.some(g => g.title.toLowerCase().includes(query.toLowerCase())))
                )) && (
                  <>
                    <div className="command-group-heading">TASKS</div>
                    {state.tasks
                      .filter(t => query && (
                        t.title.toLowerCase().includes(query.toLowerCase()) ||
                        t.category.toLowerCase().includes(query.toLowerCase()) ||
                        (t.goals && t.goals.some(g => g.title.toLowerCase().includes(query.toLowerCase())))
                      ))
                      .slice(0, 8)
                      .map(t => (
                        <div key={t.id} className="command-task-item">
                          <button 
                            type="button" 
                            className="task-name-btn" 
                            onClick={() => { setSearch(false); setEditor(t); }}
                          >
                            <span>{t.done ? '✔️ ' : ''}{t.title}</span>
                            <small>{t.category} · {t.start || 'Any time'}{t.goals?.length ? ` · 🎯 ${t.goals[0].title}` : ''}</small>
                          </button>
                          {!t.done && (
                            <button 
                              type="button" 
                              className="task-focus-quick" 
                              onClick={() => {
                                setSearch(false);
                                setPage('Focus');
                                setFocusIntention(t.title);
                                setFocusTaskId(t.id);
                              }}
                            >
                              <Play size={11} fill="currentColor"/> Focus
                            </button>
                          )}
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

function Modal({children,close}:{children:React.ReactNode;close:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    ref.current?.showModal();
    const prev=document.activeElement as HTMLElement;
    return()=>{prev?.focus();};
  },[]);
  return (
    <dialog ref={ref} className="modal-dialog-modern" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===ref.current)close();}}>
      <div className="modal-card">
        <button className="modal-close-btn" aria-label="Close" onClick={close}><X size={18}/></button>
        {children}
      </div>
    </dialog>
  );
}

function TaskEditor({task,close,save,busy,onDelete}:{task:Task;close:()=>void;save:(t:Task)=>Promise<void>;busy:boolean;onDelete?:(id:string)=>Promise<void>}){
  const [draft,setDraft]=useState(task);
  const update=(p:Partial<Task>)=>setDraft(curr=>{
    const next={...curr,...p};
    if('start' in p||'minutes' in p){
      if(next.start&&next.minutes){
        const [h,m]=next.start.split(':').map(Number);
        const total=h*60+m+next.minutes;
        next.end=total<1440?`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`:'';
      }else if('start' in p&&!next.start){
        next.end='';
      }
    }
    return next;
  });

  return (
    <Modal close={close}>
      <div className="editor-modal-wrap">
        <h3>{task.id ? 'Edit Intention' : 'New Intention'}</h3>
        <p className="page-sub">Plan what you want to achieve today.</p>

        <form onSubmit={(e:FormEvent)=>{e.preventDefault();void save(draft);}}>
          <label className="form-label">
            Intention title
            <input 
              autoFocus 
              required 
              maxLength={2000} 
              placeholder="e.g. Read chapter 4, Build authentication" 
              value={draft.title} 
              onChange={e=>update({title:e.target.value})}
              className="modern-input"
            />
          </label>

          <div className="form-row-2">
            <label className="form-label">
              Date
              <input type="date" value={draft.day} onChange={e=>update({day:e.target.value})} className="modern-input"/>
            </label>
            <label className="form-label">
              Category
              <select value={draft.category} onChange={e=>update({category:e.target.value})} className="modern-select">
                {['study','coding','personal','leisure'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="chip-picker-row">
            <span className="picker-label">Quick duration:</span>
            {[15,25,45,60].map(n=>(
              <button 
                type="button" 
                key={n} 
                className={`picker-pill ${draft.minutes===n?'active':''}`} 
                onClick={()=>update({minutes:n})}
              >
                {n}m
              </button>
            ))}
            <button type="button" className={`picker-pill ${draft.minutes===null?'active':''}`} onClick={()=>update({minutes:null})}>
              None
            </button>
          </div>

          <div className="form-row-2">
            <label className="form-label">
              Start time
              <input type="time" value={draft.start} onChange={e=>update({start:e.target.value})} className="modern-input"/>
            </label>
            <label className="form-label">
              End time
              <input type="time" value={draft.end} onChange={e=>update({end:e.target.value})} className="modern-input"/>
            </label>
          </div>

          {!!draft.goals?.length && (
            <div className="linked-goals-box">
              <span>Linked Notion Goals</span>
              <div className="goals-chips">
                {draft.goals.map(g=><span key={g.id}>{g.title}</span>)}
              </div>
            </div>
          )}

          <div className="modal-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
            {task.id && onDelete ? (
              <button 
                type="button" 
                className="btn-danger-ghost"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#f87171',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                onClick={async () => {
                  if (window.confirm(`Delete intention "${draft.title}"?`)) {
                    await onDelete(task.id);
                  }
                }}
              >
                <Trash2 size={14} /> Delete Intention
              </button>
            ) : <span />}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button type="button" className="btn-clean-ghost" onClick={close}>Cancel</button>
              <button className="primary-pill-btn" disabled={busy||!draft.title.trim()} type="submit">
                {busy ? 'Saving…' : task.id ? 'Save changes' : 'Add to plan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function CourseEditor({
  course,
  lessons = [],
  close,
  save,
  busy,
  error
}: {
  course: Course;
  lessons?: any[];
  close: () => void;
  save: (course: Course) => Promise<void>;
  busy: boolean;
  error?: string;
}){
  const [draft,setDraft]=useState<Course>({...course,minutesPerLesson:course.minutesPerLesson||30});
  const [localError,setLocalError]=useState('');
  const update=(p:Partial<Course>)=>{
    setLocalError('');
    setDraft(curr=>({...curr,...p}));
  };

  // Accurate duration calculation logic
  const hasRealLessons = lessons.length > 0;
  const remainingLessons = lessons.filter(l => !l.completed);
  const knownSeconds = remainingLessons.reduce((sum, l) => sum + (l.durationSeconds || 0), 0);
  const remainingCount = Math.max(0, draft.total - draft.done);

  return (
    <Modal close={close}>
      <div className="editor-modal-wrap">
        <h3>{course.id ? 'Edit Course' : 'Add New Course'}</h3>
        <p className="page-sub">Track lectures, videos, and study commitments.</p>

        <form noValidate onSubmit={async (e:FormEvent)=>{
          e.preventDefault();
          setLocalError('');
          if(!draft.title.trim()){
            setLocalError('Please enter a course title.');
            return;
          }
          const cleanNotion = typeof draft.notionUrl === 'string' ? draft.notionUrl.trim() : null;
          if(cleanNotion && !cleanNotion.startsWith('notion://') && !cleanNotion.startsWith('https://') && !cleanNotion.startsWith('http://')){
            setLocalError('Notion link must start with https:// or notion://');
            return;
          }
          try{
            await save({
              ...draft,
              title: draft.title.trim(),
              deadline: draft.deadline || '',
              total: Math.max(1, Number(draft.total) || 1),
              done: Math.max(0, Math.min(Math.max(1, Number(draft.total) || 1), Number(draft.done) || 0)),
              minutesPerLesson: Math.max(1, Math.min(1440, Number(draft.minutesPerLesson) || 25)),
              nextUrl: typeof draft.nextUrl === 'string' && draft.nextUrl.trim() ? draft.nextUrl.trim() : null,
              notionUrl: cleanNotion || null
            });
          }catch(err){
            setLocalError((err as Error).message || 'Failed to save course.');
          }
        }}>
          <label className="form-label">
            Course title
            <input 
              autoFocus 
              required 
              maxLength={300} 
              value={draft.title} 
              placeholder="What are you studying?" 
              onChange={e=>update({title:e.target.value})}
              className="modern-input"
            />
          </label>

          <div className="form-row-2">
            <label className="form-label">
              Total lessons
              <input type="number" min="1" max="10000" value={draft.total} onChange={e=>update({total:Number(e.target.value)})} className="modern-input"/>
            </label>
            <label className="form-label">
              Lessons completed
              <input type="number" min="0" max={draft.total} value={draft.done} onChange={e=>update({done:Number(e.target.value)})} className="modern-input"/>
            </label>
          </div>

          <div className="form-row-2">
            <label className="form-label">
              Minutes per lesson
              <input type="number" min="1" max="1440" value={draft.minutesPerLesson||''} onChange={e=>update({minutesPerLesson:Number(e.target.value)})} className="modern-input"/>
              {hasRealLessons && (
                <span className="field-hint">Fallback pace ({lessons.length} real video lecture durations are recorded).</span>
              )}
            </label>
            <label className="form-label">
              Target deadline
              <input type="date" value={draft.deadline||''} onChange={e=>update({deadline:e.target.value})} className="modern-input"/>
            </label>
          </div>

          <label className="form-label">
            Next lesson title
            <input value={draft.nextLesson} placeholder="e.g. Chapter 4: Data Models" onChange={e=>update({nextLesson:e.target.value})} className="modern-input"/>
          </label>

          <label className="form-label">
            Resource link (YouTube, Web, or local folder)
            <input 
              type="text" 
              value={draft.nextUrl||''} 
              placeholder="https://… or local folder / file path" 
              onChange={e=>update({nextUrl:e.target.value||null})} 
              className="modern-input"
            />
          </label>

          <label className="form-label">
            Course Notion Notebook link (opens directly in Notion desktop)
            <input 
              type="text" 
              value={draft.notionUrl||''} 
              placeholder="https://www.notion.so/... or notion://..." 
              onChange={e=>update({notionUrl:e.target.value||null})} 
              className="modern-input"
            />
          </label>

          {(localError || error) && (
            <div className="error-banner" style={{ margin: '8px 0', padding: '8px 12px', fontSize: '12px' }} role="alert">
              <span>{localError || error}</span>
            </div>
          )}

          {/* Accurate duration calculation preview */}
          <div className="course-duration-summary-pill">
            <Clock3 size={15}/>
            {hasRealLessons && knownSeconds > 0 ? (
              <span>
                <strong>{remainingCount} lessons remaining</strong> · <strong>{Math.floor(knownSeconds/3600)}h {Math.round((knownSeconds%3600)/60)}m left</strong> at 1× (from actual video lecture durations)
              </span>
            ) : (
              <span>
                <strong>{remainingCount} lessons left</strong> · about <strong>{Math.round(remainingCount * (draft.minutesPerLesson || 30) / 60 * 10) / 10} hours</strong> estimated
              </span>
            )}
          </div>

          <div className="modal-actions-row">
            <button type="button" className="btn-clean-ghost" onClick={close}>Cancel</button>
            <button className="primary-pill-btn" disabled={busy||!draft.title.trim()} type="submit">
              {busy ? 'Saving…' : 'Save Course'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
