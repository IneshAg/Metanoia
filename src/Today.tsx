import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Clock3, List, 
  Plus, Play, Sparkles, CheckCircle2, CloudSun, Coffee, Calendar,
  AlertTriangle, RotateCw, Archive, Layers, Flame
} from 'lucide-react';
import { dayKey, activeSeconds, formatTime12h, formatSessionTimeRange, type State, type Action, type Task, type Course, type WeatherMood, type FocusSession } from './domain';
import HabitDay from './HabitDay';
import MetricSwitcher from './MetricSwitcher';
import WeeklyPillChart from './WeeklyPillChart';
import WeatherPill from './WeatherPill';
import { openExternal } from './external';
import SystemDashboard from './dashboards/SystemDashboard';
import SpellDashboard from './dashboards/SpellDashboard';
import ItemDetailModal from './ItemDetailModal';

export const shiftDay = (day: string, n: number) => {
  const d = new Date(day + 'T12:00:00+05:30');
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
};

export function habitSummary(state: State, day: string) {
  const checks = state.habits.filter(h => h.day === day).flatMap(h => Object.values(h.checks));
  return { total: checks.length, done: checks.filter(Boolean).length };
}

export default function Today({
  state, day, setDay, busy, act, onEdit, onNew, onToggle, navigate, minutes, setMinutes, startFocus, onOpenCourseDetail, onOpenNotion
}: {
  state: State; day: string; setDay: (s: string) => void; busy: boolean;
  act: (a: Action, m?: string) => Promise<boolean | undefined>;
  onEdit: (t: Task) => void; onNew: (d?: string, s?: string) => void;
  onToggle: (t: Task) => void; navigate: (p: string) => void;
  minutes: number; setMinutes: (n: number) => void;
  startFocus: (title: string, taskId?: string | null) => Promise<void>;
  onOpenCourseDetail?: (id: string) => void;
  onOpenNotion?: (course: Course) => void;
}) {
  const currentTheme = state.settings?.theme;
  if (currentTheme === 'system') {
    return (
      <SystemDashboard
        state={state}
        day={day}
        setDay={setDay}
        busy={busy}
        act={act}
        onEdit={onEdit}
        onNew={onNew}
        onToggle={onToggle}
        navigate={navigate}
        minutes={minutes}
        setMinutes={setMinutes}
        startFocus={startFocus}
        onOpenCourseDetail={onOpenCourseDetail}
        onOpenNotion={onOpenNotion}
      />
    );
  }
  if (currentTheme === 'spell') {
    return (
      <SpellDashboard
        state={state}
        day={day}
        setDay={setDay}
        busy={busy}
        act={act}
        onEdit={onEdit}
        onNew={onNew}
        onToggle={onToggle}
        navigate={navigate}
        minutes={minutes}
        setMinutes={setMinutes}
        startFocus={startFocus}
        onOpenCourseDetail={onOpenCourseDetail}
        onOpenNotion={onOpenNotion}
      />
    );
  }

  const [mode, setMode] = useState<'list' | 'timeline'>('list');
  const [todayGoalFilter, setTodayGoalFilter] = useState('all');
  const [showOverdue, setShowOverdue] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [inspectingSession, setInspectingSession] = useState<FocusSession | null>(null);
  const [inspectingTask, setInspectingTask] = useState<Task | null>(null);
  const today = dayKey();

  // Digital clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, Inesh 👋';
    if (hour < 17) return 'Good Afternoon, Inesh 👋';
    return 'Good Evening, Inesh 👋';
  }, []);

  // Filter tasks for selected day
  const allDayTasks = useMemo(() => 
    state.tasks.filter(t => t.day === day).sort((a, b) => (a.start || '99').localeCompare(b.start || '99')),
    [state.tasks, day]
  );

  const availableGoals = useMemo(() => {
    const set = new Set<string>();
    for (const t of allDayTasks) {
      if (t.goals) {
        for (const g of t.goals) {
          if (g.title?.trim()) set.add(g.title.trim());
        }
      }
    }
    return Array.from(set).sort();
  }, [allDayTasks]);

  const tasks = useMemo(() => 
    allDayTasks.filter(t => todayGoalFilter === 'all' || (t.goals && t.goals.some(g => g.title === todayGoalFilter || g.id === todayGoalFilter))),
    [allDayTasks, todayGoalFilter]
  );

  // Overdue / Earlier tasks (scheduled before today that are not done)
  const overdueTasks = useMemo(() => 
    state.tasks.filter(t => !t.done && t.day && t.day < day).sort((a, b) => a.day.localeCompare(b.day)),
    [state.tasks, day]
  );
  const overdueMinutes = overdueTasks.reduce((acc, t) => acc + (t.minutes || 0), 0);

  const [picked, setPicked] = useState('');
  const next = tasks.find(t => t.id === picked && !t.done) || tasks.find(t => !t.done && t.category !== 'leisure') || tasks.find(t => !t.done);
  const complete = tasks.filter(t => t.done).length;

  // Work tasks (study, coding, personal) count towards Daily Load capacity; leisure/breaks are rest time
  const workTasks = tasks.filter(t => t.category !== 'leisure');
  const planned = workTasks.reduce((n, t) => n + (t.minutes || 0), 0);
  const dailyCapacity = state.settings.dailyCapacityMinutes || 360; // 6 hours default
  const capacityPct = Math.round((planned / dailyCapacity) * 100);

  // Active courses
  const courses = state.courses.filter(c => c.done < c.total);
  const primaryCourse = courses[0] || null;
  const primaryLesson = primaryCourse ? state.lessons.find(l => l.courseId === primaryCourse.id && !l.completed) : null;

  // Past 7 days calculations for Progress Summary
  const weeklyStats = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSessions = state.sessions.filter(s => new Date(s.started_utc) >= weekAgo && (s.mode === 'work' || !s.mode));
    const focusedSec = recentSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
    const focusedHours = Math.round((focusedSec / 3600) * 10) / 10;

    const completedTasks = state.tasks.filter(t => t.done && (t.completedAt ? new Date(t.completedAt) >= weekAgo : (t.day && new Date(t.day) >= weekAgo))).length;

    const categories = ['study', 'coding', 'personal', 'leisure'];
    const catStats = categories.map(cat => {
      const catTasks = tasks.filter(t => t.category === cat);
      const done = catTasks.filter(t => t.done).length;
      const total = catTasks.length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return { cat, done, total, pct };
    });

    return { focusedHours, completedTasks, catStats };
  }, [state.sessions, state.tasks, tasks]);

  // Today's completed focus sessions and break sessions
  const todaySessions = useMemo(() => {
    return (state.sessions || []).filter(s => {
      if (!s.started_utc) return false;
      const d = new Date(s.started_utc);
      const sessionDay = d.toLocaleDateString('en-CA');
      return sessionDay === day || String(s.started_utc).startsWith(day);
    });
  }, [state.sessions, day]);

  const todayFocusSessions = useMemo(() => {
    return todaySessions.filter(s => s.mode === 'work' || !s.mode);
  }, [todaySessions]);

  const todayBreakSessions = useMemo(() => {
    return todaySessions.filter(s => s.mode === 'short_break' || s.mode === 'long_break');
  }, [todaySessions]);

  const currentFocusSecs = (state.focus && (state.focus.mode === 'work' || !state.focus.mode))
    ? activeSeconds(state.focus, Date.now())
    : 0;

  const todayFocusMinutes = useMemo(() => {
    const completed = todayFocusSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
    return Math.round((completed + currentFocusSecs) / 60);
  }, [todayFocusSessions, currentFocusSecs]);

  const todayBreakMinutes = useMemo(() => {
    const breakSecs = todayBreakSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
    const pauseSecs = todayFocusSessions.reduce((acc, s) => acc + (s.break_seconds || 0), 0);
    return Math.round((breakSecs + pauseSecs) / 60);
  }, [todayBreakSessions, todayFocusSessions]);

  const timelineItems = useMemo(() => {
    type TimelineItem =
      | { kind: 'task'; task: Task; timeKey: string; sortOrder: number }
      | { kind: 'focus_session'; session: FocusSession; timeKey: string; sortOrder: number }
      | { kind: 'break_session'; session: FocusSession; timeKey: string; sortOrder: number };

    const items: TimelineItem[] = [];

    for (const t of tasks) {
      const timeKey = t.start ? t.start : (t.done ? '99:99' : '50:00');
      items.push({ kind: 'task', task: t, timeKey, sortOrder: t.done ? 2 : 1 });
    }

    for (const s of todaySessions) {
      const d = new Date(s.started_utc);
      const timeKey = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (s.mode === 'short_break' || s.mode === 'long_break') {
        items.push({ kind: 'break_session', session: s, timeKey, sortOrder: 0 });
      } else {
        items.push({ kind: 'focus_session', session: s, timeKey, sortOrder: 0 });
      }
    }

    items.sort((a, b) => {
      if (a.timeKey !== b.timeKey) return a.timeKey.localeCompare(b.timeKey);
      return a.sortOrder - b.sortOrder;
    });

    return items;
  }, [tasks, todaySessions]);

  // Bulk actions for Overdue tasks
  const handleBulkMoveToToday = async () => {
    for (const t of overdueTasks) {
      await act({ type: 'task.save', task: { ...t, day } });
    }
  };

  const handleBulkRescheduleTomorrow = async () => {
    const tomorrow = shiftDay(day, 1);
    for (const t of overdueTasks) {
      await act({ type: 'task.save', task: { ...t, day: tomorrow } });
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    await act({
      type: 'task.save',
      task: {
        id: crypto.randomUUID(),
        title,
        day,
        start: '',
        end: '',
        minutes: 25,
        category: 'study',
        done: false,
        updated: new Date().toISOString()
      }
    }, `Added task "${title}"`);
    setQuickTitle('');
  };

  const handleScheduleBreak = async () => {
    await act({
      type: 'task.save',
      task: {
        id: crypto.randomUUID(),
        title: 'Rest & Recharge ☕',
        day,
        start: '',
        end: '',
        minutes: 20,
        category: 'leisure',
        done: false,
        updated: new Date().toISOString()
      }
    }, 'Scheduled a 20m break');
  };

  const renderTimelineTask = (t: Task) => {
    const isDone = t.done;
    const isNow = !isDone && (state.focus?.taskId === t.id || (!state.focus?.taskId && next?.id === t.id && t.category !== 'leisure'));
    const timeDisplay = t.start || (t.minutes ? `${t.minutes}m` : 'Anytime');

    return (
      <div 
        key={t.id} 
        className={`timeline-entry ${isDone ? 'entry-done' : ''} ${isNow ? 'entry-now' : ''}`}
      >
        {/* Timeline Node Header matching Image 3: Dot + Time on Left, DONE / NOW Badge on Right */}
        <div className="timeline-node-header">
          <div className="timeline-node-left">
            <span className={`timeline-dot ${isDone ? 'dot-done' : isNow ? 'dot-now' : 'dot-upcoming'}`} />
            <span className={`timeline-time-label ${isNow ? 'time-now' : ''}`}>{timeDisplay}</span>
          </div>
          <div className="timeline-node-right">
            {isDone && <span className="timeline-status-badge badge-done">DONE</span>}
            {isNow && <span className="timeline-status-badge badge-now">NOW</span>}
          </div>
        </div>

        {/* Task Card Body */}
        {isNow ? (
          /* Elevated NOW Card (Exact Design from Image 3 with in-card Start Focus) */
          <div className="timeline-now-card" onClick={() => onEdit(t)}>
            <div className="now-card-main-row">
              <button 
                type="button" 
                className="timeline-check-box"
                role="checkbox" 
                aria-checked={false} 
                aria-label={'Complete ' + t.title} 
                disabled={busy} 
                onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                title="Mark complete"
              />
              <div className="now-card-text">
                <strong className="now-card-title">{t.title}</strong>
                <p className="now-card-desc">
                  {t.category ? t.category.toUpperCase() : 'GENERAL'} · {t.minutes ? `${t.minutes}m planned` : '25m'}
                  {t.start ? ` · Starts at ${t.start}` : ''}
                  {t.goals?.length ? ` · 🎯 ${t.goals.map(g => g.title).join(', ')}` : ''}
                </p>
              </div>
            </div>

            {/* In-Card Focus Duration Pills & Start Button */}
            <div className="now-card-focus-bar" onClick={e => e.stopPropagation()}>
              <div className="now-durations-row">
                {[15, 25, 45, 60].map(m => (
                  <button 
                    key={m} 
                    type="button" 
                    className={`now-dur-pill ${minutes === m ? 'active' : ''}`}
                    disabled={!!state.focus}
                    onClick={() => setMinutes(m)}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <button 
                type="button" 
                className="now-focus-btn" 
                disabled={busy} 
                onClick={() => void startFocus(t.title, t.id)}
              >
                <Play size={13} fill="currentColor"/>
                <span>{state.focus ? 'Return to Focus' : 'Start Focus'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Clean row for Done and Upcoming Tasks (Exact Design from Image 3) */
          <div className={`timeline-standard-row ${isDone ? 'row-done' : ''}`} onClick={() => onEdit(t)}>
            <button 
              type="button" 
              className={`timeline-check-box ${isDone ? 'checked' : ''}`}
              role="checkbox" 
              aria-checked={isDone} 
              aria-label={(isDone ? 'Reopen ' : 'Complete ') + t.title} 
              disabled={busy} 
              onClick={(e) => { e.stopPropagation(); onToggle(t); }}
              title={isDone ? 'Reopen task' : 'Mark done'}
            >
              {isDone && <Check size={12} strokeWidth={3}/>}
            </button>
            <div className="timeline-standard-text">
              <span className={`timeline-standard-title ${isDone ? 'title-done' : ''}`}>{t.title}</span>
              {!isDone && (
                <span className="timeline-standard-meta">
                  {t.minutes ? `${t.minutes}m` : ''}
                  {t.category ? ` · ${t.category}` : ''}
                </span>
              )}
            </div>
            {!isDone && (
              <button 
                type="button" 
                className="timeline-row-focus-btn" 
                title="Focus on this task" 
                onClick={(e) => { e.stopPropagation(); void startFocus(t.title, t.id); }}
              >
                <Play size={11} fill="currentColor"/> Focus
              </button>
            )}
            <button 
              type="button"
              className="icon-btn-ghost text-muted" 
              aria-label={'Edit ' + t.title} 
              onClick={(e) => { e.stopPropagation(); onEdit(t); }}
            >
              <ArrowRight size={13}/>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTimelineSession = (s: FocusSession) => {
    const activeMins = Math.round(s.active_seconds / 60);
    const spanMins = s.completed_utc
      ? Math.max(activeMins, Math.round((new Date(s.completed_utc).getTime() - new Date(s.started_utc).getTime()) / 60000))
      : activeMins;
    const breakMins = s.break_seconds ? Math.round(s.break_seconds / 60) : Math.max(0, spanMins - activeMins);
    const timeDisplay = formatSessionTimeRange(s.started_utc, s.completed_utc, s.active_seconds);

    return (
      <div key={'focus-session-' + s.id} className="timeline-entry entry-completed-session">
        <div className="timeline-node-header">
          <div className="timeline-node-left">
            <span className="timeline-dot dot-session-focus">🔥</span>
            <span className="timeline-time-label time-session">{timeDisplay}</span>
          </div>
          <div className="timeline-node-right">
            <span className="timeline-status-badge badge-focus-completed">
              {activeMins < 1 ? `${s.active_seconds}s` : `${activeMins}m`} FOCUSED
            </span>
          </div>
        </div>

        <div 
          className="timeline-session-card" 
          onClick={() => setInspectingSession(s)}
          title="Click to view full session details & timing breakdown"
          role="button"
          tabIndex={0}
        >
          <div className="session-card-main">
            <strong className="session-title">
              {s.intention || 'Focused Flow Session'}
            </strong>
            <div className="session-meta-row">
              <span className="session-stat-chip chip-focus">
                ⏱️ <strong>{activeMins < 1 ? `${s.active_seconds}s` : `${activeMins}m`}</strong> active focus
              </span>
              {breakMins > 0 ? (
                <span className="session-stat-chip chip-break" title="Pauses and breaks taken during this session">
                  ☕ <strong>{breakMins}m</strong> break / paused
                </span>
              ) : null}
              {spanMins > activeMins + 1 ? (
                <span className="session-stat-chip chip-span" title="Total wall-clock time from start to completion">
                  ⏳ <strong>{spanMins}m</strong> total span
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTimelineBreak = (s: FocusSession) => {
    const breakMins = Math.max(1, Math.round(s.active_seconds / 60 || (s.work_duration || 5)));
    const timeDisplay = formatSessionTimeRange(s.started_utc, s.completed_utc, s.active_seconds);
    const isLong = s.mode === 'long_break';

    return (
      <div key={'break-session-' + s.id} className="timeline-entry entry-completed-break">
        <div className="timeline-node-header">
          <div className="timeline-node-left">
            <span className="timeline-dot dot-session-break">{isLong ? '🌴' : '☕'}</span>
            <span className="timeline-time-label time-break">{timeDisplay}</span>
          </div>
          <div className="timeline-node-right">
            <span className="timeline-status-badge badge-break-completed">
              {breakMins}m BREAK
            </span>
          </div>
        </div>

        <div 
          className="timeline-break-card"
          onClick={() => setInspectingSession(s)}
          title="Click to view full break details & timing breakdown"
          role="button"
          tabIndex={0}
        >
          <strong className="break-title">
            {s.intention || (isLong ? '🌴 Long Rejuvenation Break' : '☕ Quick Rest & Hydrate')}
          </strong>
          <span className="break-sub">
            {breakMins}m break taken · Mind & eyes rested
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="playful-dashboard consolidated-dashboard">
      {/* 1. Header: Greeting, Day Selector, Capacity Meter & Quick Actions */}
      <section className="dashboard-hero-card consolidated-hero">
        <div className="hero-left">
          <div className="hero-greeting-line">
            <h1>{greeting}</h1>
            <p>Here is what you planned for today. Small steps bring big calm.</p>
          </div>
          <div className="hero-live-clock">
            <Clock3 size={20}/>
            <span>{timeStr || '10:29 AM'}</span>
          </div>
        </div>

        <div className="hero-right">
          {/* Interactive Weather Pill with Ambient Motion */}
          <WeatherPill 
            mood={state.settings?.weatherMood} 
            onSelectMood={(m: WeatherMood) => {
              try { localStorage.setItem('metanoia-weather-mood', m); } catch {}
              void act({ type: 'settings.update', settings: { weatherMood: m } }, `Weather atmosphere set to ${m}`);
            }} 
            align="left"
          />

          {/* Daily Capacity Pill Gauge */}
          <div className="capacity-pill-box" title={`Planned ${planned}m against ${dailyCapacity}m daily capacity`}>
            <div className="capacity-label-row">
              <span className="capacity-title">Daily Load:</span>
              <strong className={capacityPct > 100 ? 'text-amber' : ''}>{planned}m / {dailyCapacity}m</strong>
            </div>
            <div className="capacity-bar-track">
              <div 
                className={`capacity-bar-fill ${capacityPct > 100 ? 'capacity-overload' : ''}`}
                style={{ width: `${Math.min(100, capacityPct)}%` }}
              />
            </div>
          </div>

          <div className="hero-action-buttons">
            <button type="button" className="secondary-pill-btn" onClick={handleScheduleBreak} title="Add a 20m rest break to your plan">
              <Coffee size={14}/> Schedule a break
            </button>
            <button className="hero-add-btn" onClick={() => onNew(day)}>
              <Plus size={15}/> Add task
            </button>
          </div>
        </div>
      </section>

      {/* 2. Main Two-Column Layout: Left = Section 1 (Today's Plan), Right = Habits + Section 2 (Continue Learning) */}
      <div className="consolidated-main-grid">
        {/* Left Column: Day Schedule (Matches Image 3) */}
        <div className="plan-main-col">
          <div className="day-schedule-card">
            {/* Header: Title, counter, view toggles, add task button */}
            <div className="day-schedule-head">
              <div className="schedule-head-left">
                <Calendar size={18} className="text-accent" />
                <h3>Day Schedule</h3>
                <span className="schedule-counter">{complete} of {tasks.length} done</span>
              </div>
              <div className="schedule-head-right">
                {availableGoals.length > 0 && (
                  <select 
                    className="filter-pill-select" 
                    value={todayGoalFilter} 
                    onChange={e => setTodayGoalFilter(e.target.value)}
                    aria-label="Filter Today's tasks by Goal"
                  >
                    <option value="all">🎯 All Goals</option>
                    {availableGoals.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}
                <button type="button" className="add-task-mini" onClick={() => onNew(day)} title="Add task">
                  <Plus size={16}/>
                </button>
              </div>
            </div>

            {/* Today's Focus & Breaks Stats Banner */}
            {(todayFocusMinutes > 0 || todayBreakMinutes > 0 || todaySessions.length > 0) && (
              <div className="day-schedule-stats-banner">
                <div className="schedule-stat-item">
                  <Sparkles size={14} className="text-amber" />
                  <span>
                    <strong>{todayFocusMinutes >= 60 ? `${Math.floor(todayFocusMinutes / 60)}h ${todayFocusMinutes % 60}m` : `${todayFocusMinutes}m`}</strong> focused ({todayFocusSessions.length + (currentFocusSecs >= 60 ? 1 : 0)} session{(todayFocusSessions.length + (currentFocusSecs >= 60 ? 1 : 0)) === 1 ? '' : 's'})
                  </span>
                </div>
                <div className="schedule-stat-item">
                  <Coffee size={14} className="text-cyan" />
                  <span>
                    <strong>{todayBreakMinutes}m</strong> breaks ({todayBreakSessions.length} break{todayBreakSessions.length === 1 ? '' : 's'})
                  </span>
                </div>
              </div>
            )}

            {/* Earlier Tasks Drawer (if any overdue) */}
            {overdueTasks.length > 0 && (
              <div className="overdue-tasks-card">
                <div className="overdue-card-header" onClick={() => setShowOverdue(!showOverdue)}>
                  <div className="overdue-header-title">
                    <AlertTriangle size={16} className="text-amber"/>
                    <strong>Earlier Tasks ({overdueTasks.length})</strong>
                    <span className="overdue-mins">· {overdueMinutes} min overdue</span>
                  </div>
                  <div className="overdue-header-actions" onClick={e => e.stopPropagation()}>
                    <button 
                      type="button" 
                      className="btn-pill-subtle" 
                      onClick={handleBulkMoveToToday} 
                      title="Move all earlier tasks to Today's plan"
                    >
                      <RotateCw size={12}/> Move all to today
                    </button>
                    <button 
                      type="button" 
                      className="btn-pill-subtle" 
                      onClick={handleBulkRescheduleTomorrow} 
                      title="Reschedule all earlier tasks to Tomorrow"
                    >
                      +1 Day
                    </button>
                    <button 
                      type="button" 
                      className="icon-btn-ghost" 
                      onClick={() => setShowOverdue(!showOverdue)}
                      aria-label="Toggle earlier tasks view"
                    >
                      {showOverdue ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                    </button>
                  </div>
                </div>

                {showOverdue && (
                  <div className="overdue-tasks-list">
                    {overdueTasks.map(t => (
                      <div key={t.id} className="overdue-task-item">
                        <button 
                          className="timeline-check-box" 
                          role="checkbox" 
                          aria-checked={false} 
                          onClick={() => onToggle(t)}
                          title="Mark complete"
                        />
                        <div className="overdue-item-body">
                          <strong>{t.title}</strong>
                          <span className="overdue-date-pill">{t.day} · {t.minutes || 20}m · {t.category}</span>
                        </div>
                        <div className="overdue-item-btns">
                          <button 
                            type="button" 
                            className="btn-do-today-pill" 
                            onClick={() => void act({ type: 'task.save', task: { ...t, day } }, 'Moved to today')}
                          >
                            Do today
                          </button>
                          <button 
                            type="button" 
                            className="btn-pill-ghost-sm" 
                            onClick={() => void act({ type: 'task.save', task: { ...t, day: shiftDay(t.day, 1) } }, 'Rescheduled +1 day')}
                            title="Reschedule +1 day"
                          >
                            +1d
                          </button>
                          <button 
                            type="button" 
                            className="icon-btn-ghost text-muted" 
                            onClick={() => void act({ type: 'task.save', task: { ...t, done: true } }, 'Archived task')}
                            title="Archive task"
                          >
                            <Archive size={13}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick Inline Add Task Input */}
            <form onSubmit={handleQuickAdd} className="quick-task-inline-row">
              <input 
                type="text" 
                placeholder="Type a task and hit Enter to add…"
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                className="quick-inline-input"
              />
              <button 
                type="submit" 
                className="quick-inline-add-btn" 
                disabled={!quickTitle.trim()}
                title="Add task"
              >
                <Plus size={15}/>
              </button>
            </form>

            {/* Vertical Timeline Track matching Image 3 */}
            <div className="day-timeline-stream">
              <div className="timeline-rail-line" />
              {timelineItems.length > 0 ? (
                timelineItems.map(item => {
                  if (item.kind === 'task') return renderTimelineTask(item.task);
                  if (item.kind === 'focus_session') return renderTimelineSession(item.session);
                  return renderTimelineBreak(item.session);
                })
              ) : (
                <div className="empty-timeline-card">
                  <Sparkles size={28} className="text-amber"/>
                  <h4>Your day is open</h4>
                  <p>No tasks scheduled yet for today. Small steps bring big calm.</p>
                  <div className="empty-timeline-actions">
                    <button type="button" className="btn-pill-primary" onClick={() => onNew(day)}>
                      <Plus size={14}/> Plan a task
                    </button>
                    <button 
                      type="button" 
                      className="btn-pill-subtle" 
                      onClick={() => void startFocus('Open Focus Session')}
                    >
                      <Play size={13} fill="currentColor"/> Start Open Focus (25m)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Daily Habits & Section 2 (Continue Learning) */}
        <div className="plan-side-col">
          {/* Daily Habits Checklist */}
          <div className="side-habits-panel">
            <HabitDay habits={state.habits} day={day} act={act} busy={busy} state={state} compact/>
          </div>

          {/* Section 2: Continue Learning Card */}
          <div className="side-learning-card">
            <div className="side-learning-header">
              <span className="eyebrow"><BookOpen size={13}/> CONTINUE LEARNING</span>
              <button type="button" className="btn-link" onClick={() => navigate('Courses')}>
                All courses →
              </button>
            </div>

            {primaryCourse ? (
              <div 
                className="single-course-resume-box clickable-course-card"
                onClick={() => {
                  if (onOpenCourseDetail) onOpenCourseDetail(primaryCourse.id);
                  else navigate('Courses');
                }}
                title={`Click to open lectures for ${primaryCourse.title}`}
              >
                <div className="single-course-title-row">
                  <h4>{primaryCourse.title}</h4>
                  <span className="course-progress-badge">
                    {primaryCourse.done} / {primaryCourse.total}
                  </span>
                </div>

                <div className="meter-capsule">
                  <div 
                    className="meter-fill" 
                    style={{ width: `${Math.round((primaryCourse.done / Math.max(1, primaryCourse.total)) * 100)}%` }}
                  />
                </div>

                <div className="up-next-lesson-info">
                  <span className="up-next-kicker">UP NEXT:</span>
                  <p className="up-next-title">
                    {primaryLesson?.title || primaryCourse.nextLesson || 'Next lesson ready'}
                  </p>
                </div>

                <div className="resume-lesson-row" onClick={e => e.stopPropagation()}>
                  <button 
                    type="button" 
                    className="primary-pill-btn btn-resume-course"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (primaryLesson?.sourceUrl) {
                        void openExternal(primaryLesson.sourceUrl).catch(() => {
                          if (onOpenCourseDetail) onOpenCourseDetail(primaryCourse.id);
                        });
                      } else if (onOpenCourseDetail) {
                        onOpenCourseDetail(primaryCourse.id);
                      } else {
                        navigate('Courses');
                      }
                    }}
                  >
                    <Play size={13} fill="currentColor"/> Resume Lesson
                  </button>
                  {primaryCourse.notionUrl && (
                    <button 
                      type="button" 
                      className="btn-notion-mini-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenNotion) onOpenNotion(primaryCourse);
                      }}
                      title="Open Notion Notebook"
                    >
                      Notion
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-course-side">
                <p className="text-muted">No courses currently active.</p>
                <button type="button" className="btn-pill-subtle" onClick={() => navigate('Courses')}>
                  Browse Courses
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Section 3: Progress Summary (Bottom full-width compact deck) */}
      <section className="dashboard-progress-deck">
        <div className="progress-deck-header">
          <div>
            <span className="eyebrow"><Layers size={13}/> PROGRESS SUMMARY</span>
            <h3>Weekly Activity &amp; Categories</h3>
          </div>
          <div className="progress-deck-links">
            <button type="button" className="btn-link" onClick={() => navigate('Reflect')}>
              Reflect &amp; Full Charts →
            </button>
            <button type="button" className="btn-link" onClick={() => navigate('Rewards')}>
              Rewards &amp; XP ({state.xp.toLocaleString()} XP) →
            </button>
          </div>
        </div>

        <div className="progress-summary-grid">
          {/* Weekly Activity Pill Stack Mini-Chart */}
          <div className="progress-chart-card">
            <WeeklyPillChart state={state} selectedDay={day} onSelectDay={setDay}/>
          </div>

          {/* Category Completion Breakdown */}
          <div className="progress-category-card">
            <div className="card-head-compact">
              <CheckCircle2 size={16} className="text-teal"/>
              <h4>Category Breakdown</h4>
            </div>
            <div className="category-capsule-list">
              {weeklyStats.catStats.map(item => (
                <div key={item.cat} className="category-capsule-item">
                  <div className="capsule-label-row">
                    <span className="cat-name">{item.cat.charAt(0).toUpperCase() + item.cat.slice(1)}</span>
                    <span className="cat-count">{item.done} / {item.total} done</span>
                  </div>
                  <div className="capsule-track">
                    <div 
                      className={`capsule-fill fill-${item.cat}`} 
                      style={{ width: `${item.total ? item.pct : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Metric Switcher */}
          <div className="progress-metrics-card">
            <MetricSwitcher state={state} day={day}/>
          </div>
        </div>
      </section>

      <ItemDetailModal
        session={inspectingSession}
        task={inspectingTask}
        allTasks={state.tasks}
        allSessions={state.sessions}
        onClose={() => {
          setInspectingSession(null);
          setInspectingTask(null);
        }}
        onSelectTask={(t) => {
          setInspectingSession(null);
          setInspectingTask(t);
        }}
        onEditTask={onEdit}
        onToggleTask={onToggle}
        onDeleteTask={async (id) => {
          await act({ type: 'task.delete', id }, 'Task deleted');
          setInspectingTask(null);
        }}
        onDeleteSession={async (id) => {
          await act({ type: 'session.delete', id }, 'Session deleted 🗑️');
          setInspectingSession(null);
        }}
      />
    </div>
  );
}
