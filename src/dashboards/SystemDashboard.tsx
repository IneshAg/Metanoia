import { useState, useMemo } from 'react';
import { 
  Play, Plus, Check, Clock3, AlertTriangle, Shield, Zap, Flame, 
  ChevronDown, ChevronRight, RotateCw, Archive, BookOpen, Layers
} from 'lucide-react';
import { dayKey, shiftDay, type State, type Action, type Task, type Course } from '../domain';
import WeeklyPillChart from '../WeeklyPillChart';
import MetricSwitcher from '../MetricSwitcher';
import { openExternal } from '../external';

interface Props {
  state: State;
  day: string;
  setDay: (s: string) => void;
  busy: boolean;
  act: (a: Action, m?: string) => Promise<boolean | undefined>;
  onEdit: (t: Task) => void;
  onNew: (d?: string, s?: string) => void;
  onToggle: (t: Task) => void;
  navigate: (p: string) => void;
  minutes: number;
  setMinutes: (n: number) => void;
  startFocus: (title: string, taskId?: string | null) => Promise<void>;
  onOpenCourseDetail?: (id: string) => void;
  onOpenNotion?: (course: Course) => void;
}

export default function SystemDashboard({
  state, day, setDay, busy, act, onEdit, onNew, onToggle, navigate, minutes, setMinutes, startFocus, onOpenCourseDetail, onOpenNotion
}: Props) {
  const [showOverdue, setShowOverdue] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const today = dayKey();

  // Compute Hunter Rank from total XP
  const hunterRank = useMemo(() => {
    const xp = state.xp || 0;
    if (xp < 1000) return { rank: 'E-RANK', title: 'Novice Hunter', color: '#94a3b8' };
    if (xp < 3000) return { rank: 'D-RANK', title: 'Awakened Striker', color: '#38bdf8' };
    if (xp < 7000) return { rank: 'C-RANK', title: 'Dungeon Raider', color: '#34d399' };
    if (xp < 15000) return { rank: 'B-RANK', title: 'Elite Vanguard', color: '#a78bfa' };
    if (xp < 30000) return { rank: 'A-RANK', title: 'Raid Commander', color: '#f59e0b' };
    return { rank: 'S-RANK', title: 'Shadow Monarch', color: '#00f0ff' };
  }, [state.xp]);

  // Tasks for current selected day
  const tasks = useMemo(() => 
    state.tasks.filter(t => t.day === day).sort((a, b) => (a.start || '99').localeCompare(b.start || '99')),
    [state.tasks, day]
  );
  const completedCount = tasks.filter(t => t.done).length;
  const next = tasks.find(t => !t.done);

  // Planned load vs Daily Capacity (Fatigue Gauge)
  const planned = tasks.reduce((acc, t) => acc + (t.minutes || 0), 0);
  const dailyCapacity = state.settings.dailyCapacityMinutes || 360;
  const fatiguePct = Math.min(100, Math.round((planned / dailyCapacity) * 100));

  // Overdue incomplete quests
  const overdueTasks = useMemo(() => 
    state.tasks.filter(t => !t.done && t.day && t.day < day),
    [state.tasks, day]
  );

  // Active courses
  const courses = state.courses.filter(c => c.done < c.total);
  const primaryCourse = courses[0] || null;
  const primaryLesson = primaryCourse ? state.lessons.find(l => l.courseId === primaryCourse.id && !l.completed) : null;

  // Active habits for day
  const habitRecord = state.habits.find(h => h.day === day);
  const habitNames = Object.keys(habitRecord?.checks || (state.habits[0]?.checks || {}));
  const habitsDone = habitNames.filter(name => habitRecord?.checks[name]).length;

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
    }, `Enrolled quest: "${title}"`);
    setQuickTitle('');
  };

  const handleBulkMoveToToday = async () => {
    for (const t of overdueTasks) {
      await act({ type: 'task.save', task: { ...t, day } });
    }
  };

  return (
    <div className="system-dashboard-wrap">
      {/* Reticle corner helpers */}
      <div className="panel-corner tl"/>
      <div className="panel-corner tr"/>
      <div className="panel-corner bl"/>
      <div className="panel-corner br"/>

      {/* 1. TOP HUNTER STATUS TELEMETRY HUD */}
      <section className="system-hud-bar">
        <div className="hud-identity">
          <div className="hud-status-indicator">
            <span className="hud-pulse-dot"/>
            <span className="hud-player-tag">[HUNTER PROTOCOL: ACTIVE]</span>
          </div>
          <h2 className="hud-player-name">INESH <span className="hud-title-badge">{hunterRank.title}</span></h2>
        </div>

        <div className="hud-stats-grid">
          <div className="hud-stat-cell">
            <span className="stat-label">HUNTER RANK</span>
            <strong style={{ color: hunterRank.color }}>{hunterRank.rank}</strong>
            <small>LVL {Math.floor(state.xp / 500) + 1}</small>
          </div>

          <div className="hud-stat-cell">
            <span className="stat-label">SYSTEM XP</span>
            <strong className="text-cyan">{state.xp.toLocaleString()}</strong>
            <small>{state.credits} Joy Credits</small>
          </div>

          <div className="hud-stat-cell fatigue-cell">
            <div className="fatigue-label-row">
              <span className="stat-label">FATIGUE</span>
              <strong>{fatiguePct}% ({planned}m / {dailyCapacity}m)</strong>
            </div>
            <div className="fatigue-track">
              <div 
                className={`fatigue-fill ${fatiguePct > 90 ? 'fatigue-critical' : ''}`}
                style={{ width: `${fatiguePct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. SYSTEM ALERT BANNER */}
      <div className="system-emergency-banner">
        <div className="system-alert-left">
          <Zap size={16} className="text-cyan pulse-glow"/>
          <span>[SYSTEM ANNOUNCEMENT: DAILY QUEST LOG READY — COMPLETE OBJECTIVES BEFORE MIDNIGHT]</span>
        </div>
        <span className="hud-timestamp">SYNC: {new Date().toLocaleTimeString()}</span>
      </div>

      {/* 3. MAIN DUAL-COLUMN SYSTEM GRID */}
      <div className="system-main-grid">
        {/* Left Column: Quest Log */}
        <div className="system-quest-col">
          {/* Primary Quest Objective Card */}
          <div className="system-window primary-quest-window">
            <div className="panel-corner tl"/><div className="panel-corner tr"/>
            <div className="panel-corner bl"/><div className="panel-corner br"/>

            <div className="window-header">
              <span className="window-kicker">✦ CURRENT QUEST TARGET</span>
              <span className="quest-reward-pill">+25 XP · +5 CREDITS</span>
            </div>

            <h3 className="primary-quest-title">
              {state.focus ? `[RAID IN PROGRESS: ${state.focus.intention}]` : (next?.title || '[ALL OBJECTIVES COMPLETED]')}
            </h3>
            <p className="primary-quest-meta">
              {next ? `CATEGORY: ${next.category.toUpperCase()} · ESTIMATE: ${next.minutes || 25} MIN · STATUS: ACTIVE` : 'No open quests remaining today. Enroll a new quest below.'}
            </p>

            <div className="primary-quest-actions">
              <div className="duration-selector-hud">
                {[15, 25, 45, 60].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`hud-duration-btn ${minutes === m ? 'active' : ''}`}
                    disabled={!!state.focus}
                    onClick={() => setMinutes(m)}
                  >
                    {m}M
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn-dungeon-raid"
                disabled={busy}
                onClick={() => void startFocus(next?.title || 'System Focus', next?.id || null)}
              >
                <Play size={15} fill="currentColor"/> {state.focus ? 'RETURN TO RAID' : `INITIATE RAID (${minutes}M)`}
              </button>
            </div>
          </div>

          {/* Overdue / Penalty Warning Drawer */}
          {overdueTasks.length > 0 && (
            <div className="system-window penalty-alert-window">
              <div className="panel-corner tl"/><div className="panel-corner tr"/>
              <div className="panel-corner bl"/><div className="panel-corner br"/>

              <div className="penalty-header" onClick={() => setShowOverdue(!showOverdue)}>
                <div className="penalty-title">
                  <AlertTriangle size={16} className="text-amber"/>
                  <strong>[WARNING: {overdueTasks.length} INCOMPLETE QUESTS DETECTED]</strong>
                </div>
                <div className="penalty-actions" onClick={e => e.stopPropagation()}>
                  <button type="button" className="btn-hud-subtle" onClick={handleBulkMoveToToday}>
                    <RotateCw size={12}/> TRANSFER ALL TO TODAY
                  </button>
                  <button type="button" className="icon-btn-ghost text-cyan" onClick={() => setShowOverdue(!showOverdue)}>
                    {showOverdue ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                  </button>
                </div>
              </div>

              {showOverdue && (
                <div className="penalty-tasks-list">
                  {overdueTasks.map(t => (
                    <div key={t.id} className="penalty-task-item">
                      <button className="system-check-box" role="checkbox" aria-checked={false} onClick={() => onToggle(t)}/>
                      <span className="penalty-item-title">{t.title}</span>
                      <span className="penalty-date">{t.day}</span>
                      <button 
                        type="button" 
                        className="btn-hud-mini" 
                        onClick={() => void act({ type: 'task.save', task: { ...t, day } }, 'Moved quest to today')}
                      >
                        RETRY TODAY
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Daily Quests List Window */}
          <div className="system-window quests-list-window">
            <div className="panel-corner tl"/><div className="panel-corner tr"/>
            <div className="panel-corner bl"/><div className="panel-corner br"/>

            <div className="window-header">
              <div>
                <span className="window-kicker">QUEST LOG</span>
                <h4>DAILY QUESTS ({completedCount} / {tasks.length} CLEARED)</h4>
              </div>
              <button type="button" className="btn-hud-mini" onClick={() => onNew(day)}>
                <Plus size={13}/> ENROLL QUEST
              </button>
            </div>

            {/* Quick Quest Input Form */}
            <form onSubmit={handleQuickAdd} className="system-quick-add-form">
              <input 
                type="text" 
                placeholder="[+] Input new quest parameters and press Enter…"
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                className="system-hud-input"
              />
              <button type="submit" className="system-quick-submit" disabled={!quickTitle.trim()}>
                <Plus size={14}/>
              </button>
            </form>

            <div className="system-tasks-stream">
              {tasks.length > 0 ? (
                tasks.map((t, idx) => (
                  <div key={t.id} className={`system-quest-row ${t.done ? 'quest-cleared' : ''}`}>
                    <button 
                      className={`system-check-box ${t.done ? 'checked' : ''}`}
                      role="checkbox"
                      aria-checked={t.done}
                      onClick={() => onToggle(t)}
                    >
                      {t.done && <Check size={12} strokeWidth={3}/>}
                    </button>

                    <div className="quest-row-body" onClick={() => onEdit(t)}>
                      <div className="quest-label-row">
                        <span className="quest-index">#{String(idx + 1).padStart(2, '0')}</span>
                        <strong className="quest-title">{t.title}</strong>
                        {t.done && <span className="cleared-tag">[CLEARED]</span>}
                      </div>
                      <div className="quest-meta-row">
                        <span className="quest-cat-tag">CAT: {t.category.toUpperCase()}</span>
                        {t.minutes && <span className="quest-min-tag">{t.minutes}M</span>}
                        <span className="quest-xp-reward">+10 XP</span>
                      </div>
                    </div>

                    {!t.done && (
                      <button 
                        type="button" 
                        className="btn-raid-sm" 
                        title="Enter Raid on this quest"
                        onClick={() => void startFocus(t.title, t.id)}
                      >
                        <Play size={11} fill="currentColor"/> RAID
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-system-state">
                  <Shield size={28} className="text-cyan"/>
                  <p>[NO PENDING QUESTS FOR TODAY'S CYCLE]</p>
                  <button type="button" className="btn-dungeon-raid btn-sm" onClick={() => onNew(day)}>
                    <Plus size={13}/> ENROLL FIRST QUEST
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Conditioning Protocol & Skill Tomes */}
        <div className="system-side-col">
          {/* Conditioning Protocol Window (Habits) */}
          <div className="system-window conditioning-window">
            <div className="panel-corner tl"/><div className="panel-corner tr"/>
            <div className="panel-corner bl"/><div className="panel-corner br"/>

            <div className="window-header">
              <div>
                <span className="window-kicker">✦ REPETITION PROTOCOL</span>
                <h4>DAILY CONDITIONING</h4>
              </div>
              <span className="conditioning-counter">{habitsDone} / {habitNames.length} CLEARED</span>
            </div>

            <div className="conditioning-list">
              {habitNames.map((name, i) => {
                const isDone = !!habitRecord?.checks[name];
                return (
                  <button
                    key={name}
                    type="button"
                    className={`conditioning-row ${isDone ? 'done' : ''}`}
                    onClick={() => void act({ type: 'habit.set', day, name, done: !isDone }, 'Conditioning checked')}
                  >
                    <span className="routine-num">0{i + 1}</span>
                    <span className="routine-name">{name}</span>
                    <span className={`routine-status-box ${isDone ? 'checked' : ''}`}>
                      {isDone ? <Check size={13} strokeWidth={3}/> : '○'}
                    </span>
                  </button>
                );
              })}
              {!habitNames.length && (
                <p className="text-muted">[NO CONDITIONING ROUTINES REGISTERED]</p>
              )}
            </div>
          </div>

          {/* Skill Tomes (Courses) */}
          <div className="system-window skill-tomes-window">
            <div className="panel-corner tl"/><div className="panel-corner tr"/>
            <div className="panel-corner bl"/><div className="panel-corner br"/>

            <div className="window-header">
              <div>
                <span className="window-kicker">✦ HUNTER INTEL</span>
                <h4>ACTIVE SKILL TOME</h4>
              </div>
              <button type="button" className="btn-link text-cyan" onClick={() => navigate('Courses')}>
                ALL TOMES →
              </button>
            </div>

            {primaryCourse ? (
              <div 
                className="skill-tome-card"
                onClick={() => {
                  if (onOpenCourseDetail) onOpenCourseDetail(primaryCourse.id);
                  else navigate('Courses');
                }}
              >
                <div className="tome-header-row">
                  <BookOpen size={16} className="text-cyan"/>
                  <strong>{primaryCourse.title}</strong>
                  <span className="tome-progress-pill">{primaryCourse.done} / {primaryCourse.total}</span>
                </div>

                <div className="tome-meter">
                  <div 
                    className="tome-fill" 
                    style={{ width: `${Math.round((primaryCourse.done / Math.max(1, primaryCourse.total)) * 100)}%` }}
                  />
                </div>

                <div className="next-lecture-box">
                  <span className="lecture-kicker">UP NEXT FOR MASTERY:</span>
                  <p>{primaryLesson?.title || primaryCourse.nextLesson || 'All skills unlocked'}</p>
                </div>

                <button 
                  type="button" 
                  className="btn-dungeon-raid btn-sm"
                  onClick={e => {
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
                  <Play size={12} fill="currentColor"/> RESUME STUDY
                </button>
              </div>
            ) : (
              <p className="text-muted">[NO ACTIVE SKILL TOMES]</p>
            )}
          </div>
        </div>
      </div>

      {/* 4. BOTTOM TELEMETRY SUMMARY */}
      <section className="system-window telemetry-summary-deck">
        <div className="panel-corner tl"/><div className="panel-corner tr"/>
        <div className="panel-corner bl"/><div className="panel-corner br"/>

        <div className="window-header">
          <div>
            <span className="window-kicker">TELEMETRY</span>
            <h4>HUNTER COMBAT LOG &amp; SEVEN-DAY METRICS</h4>
          </div>
          <button type="button" className="btn-link text-cyan" onClick={() => navigate('Reflect')}>
            FULL ANALYSIS MATRIX →
          </button>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-chart-cell">
            <WeeklyPillChart state={state} selectedDay={day} onSelectDay={setDay}/>
          </div>
          <div className="telemetry-metrics-cell">
            <MetricSwitcher state={state} day={day}/>
          </div>
        </div>
      </section>
    </div>
  );
}
