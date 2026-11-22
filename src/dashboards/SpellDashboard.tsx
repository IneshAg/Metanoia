import { useState, useMemo } from 'react';
import { 
  Play, Plus, Check, Clock3, AlertTriangle, 
  ChevronDown, ChevronRight, RotateCw, BookOpen, Sparkles
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

export default function SpellDashboard({
  state, day, setDay, busy, act, onEdit, onNew, onToggle, navigate, minutes, setMinutes, startFocus, onOpenCourseDetail, onOpenNotion
}: Props) {
  const [showOverdue, setShowOverdue] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const today = dayKey();

  // Spell Rank & Soul Cores calculation from XP
  const spellStatus = useMemo(() => {
    const xp = state.xp || 0;
    let rank = 'DORMANT';
    let cores = 1;
    let coreName = 'Soul Core';
    if (xp >= 1000) { rank = 'AWAKENED'; cores = 2; coreName = 'Monster Core'; }
    if (xp >= 3500) { rank = 'ASCENDED'; cores = 3; coreName = 'Demon Core'; }
    if (xp >= 8000) { rank = 'TRANSCENDENT'; cores = 4; coreName = 'Devil Core'; }
    if (xp >= 16000) { rank = 'SUPREME'; cores = 5; coreName = 'Tyrant Core'; }
    if (xp >= 30000) { rank = 'SACRED'; cores = 6; coreName = 'Terror Core'; }
    if (xp >= 50000) { rank = 'DIVINE'; cores = 7; coreName = 'Titan Core'; }
    return { rank, cores, coreName };
  }, [state.xp]);

  // Tasks for day
  const tasks = useMemo(() => 
    state.tasks.filter(t => t.day === day).sort((a, b) => (a.start || '99').localeCompare(b.start || '99')),
    [state.tasks, day]
  );
  const completedCount = tasks.filter(t => t.done).length;
  const next = tasks.find(t => !t.done);

  // Overdue trials
  const overdueTasks = useMemo(() => 
    state.tasks.filter(t => !t.done && t.day && t.day < day),
    [state.tasks, day]
  );

  // Active courses
  const courses = state.courses.filter(c => c.done < c.total);
  const primaryCourse = courses[0] || null;
  const primaryLesson = primaryCourse ? state.lessons.find(l => l.courseId === primaryCourse.id && !l.completed) : null;

  // Active habits (Sanity Anchors)
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
    }, `Weaved trial: "${title}"`);
    setQuickTitle('');
  };

  const handleBulkMoveToToday = async () => {
    for (const t of overdueTasks) {
      await act({ type: 'task.save', task: { ...t, day } });
    }
  };

  return (
    <div className="spell-dashboard-wrap">
      {/* Decorative ambient runic background watermarks */}
      <span className="spell-watermark-rune rune-tl">ᛋ</span>
      <span className="spell-watermark-rune rune-tr">ᛟ</span>
      <span className="spell-watermark-rune rune-br">ᛗ</span>

      {/* 1. NIGHTMARE SPELL APPRAISAL HEADER */}
      <section className="spell-appraisal-panel">
        <div className="spell-sigil-header">
          <span className="spell-whisper-kicker">ᛋ THE NIGHTMARE SPELL ᛋ</span>
          <h2 className="spell-true-name">
            TRUE NAME: <span>LOST FROM LIGHT</span>
          </h2>
          <p className="spell-flaw-tag">FLAW: [BOUND TO TRUTH &amp; PERSISTENCE]</p>
        </div>

        <div className="spell-attributes-grid">
          <div className="spell-attr-item">
            <span className="attr-label">SPELL RANK</span>
            <strong className="text-gold">{spellStatus.rank}</strong>
            <small>{spellStatus.coreName}</small>
          </div>

          <div className="spell-attr-item">
            <span className="attr-label">SHADOW FRAGMENTS</span>
            <strong className="text-bright-gold">{state.xp.toLocaleString()}</strong>
            <small>Soul Essence</small>
          </div>

          <div className="spell-attr-item">
            <span className="attr-label">SOUL SHARDS</span>
            <strong className="text-purple">{state.credits}</strong>
            <small>Available Memories</small>
          </div>

          <div className="spell-attr-item cores-item">
            <span className="attr-label">SOUL CORES ({spellStatus.cores} / 7)</span>
            <div className="soul-cores-chain">
              {Array.from({ length: 7 }).map((_, i) => (
                <span 
                  key={i} 
                  className={`core-diamond ${i < spellStatus.cores ? 'core-ignited' : 'core-dormant'}`}
                  title={`Soul Core ${i + 1}`}
                >
                  ◈
                </span>
              ))}
            </div>
            <small>{spellStatus.rank} Progression</small>
          </div>
        </div>
      </section>

      {/* 2. SPELL WHISPER ALERT */}
      <div className="spell-whisper-banner">
        <Sparkles size={15} className="text-gold"/>
        <span>[THE SPELL WHISPERS: A NEW TRIAL AWAKENS. MAINTAIN SANITY THROUGH YOUR ANCHORS.]</span>
      </div>

      {/* 3. DUAL COLUMN SPELL INTERFACE */}
      <div className="spell-main-grid">
        {/* Left Column: Trials & Memories */}
        <div className="spell-trials-col">
          {/* Active Trial Focus Card */}
          <div className="spell-glass-card active-trial-card">
            <div className="spell-card-head">
              <span className="spell-kicker">ᚱ CURRENT DESTINED TRIAL</span>
              <span className="spell-shard-pill">◈ +25 SHADOW ESSENCE</span>
            </div>

            <h3 className="active-trial-title">
              {state.focus ? `[MEDITATING UPON: ${state.focus.intention}]` : (next?.title || '✦ ALL TRIALS FULFILLED')}
            </h3>
            <p className="active-trial-sub">
              {next ? `RANK: TRANSCENDENT · ${next.category.toUpperCase()} · ${next.minutes || 25} MIN PLANNED` : 'Your soul is at peace. No unweaved trials remain for today.'}
            </p>

            <div className="active-trial-actions">
              <div className="spell-durations-row">
                {[15, 25, 45, 60].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`spell-duration-btn ${minutes === m ? 'active' : ''}`}
                    disabled={!!state.focus}
                    onClick={() => setMinutes(m)}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="btn-spell-meditation"
                disabled={busy}
                onClick={() => void startFocus(next?.title || 'Soul Meditation', next?.id || null)}
              >
                <Play size={14} fill="currentColor"/> {state.focus ? 'RETURN TO MEDITATION' : `ENTER SOUL MEDITATION (${minutes}M)`}
              </button>
            </div>
          </div>

          {/* Overdue Trials Drawer */}
          {overdueTasks.length > 0 && (
            <div className="spell-glass-card overdue-spell-card">
              <div className="overdue-spell-header" onClick={() => setShowOverdue(!showOverdue)}>
                <div className="overdue-spell-title">
                  <AlertTriangle size={15} className="text-gold"/>
                  <strong>⚠️ {overdueTasks.length} UNFINISHED ECHOES FROM THE PAST</strong>
                </div>
                <div className="overdue-spell-actions" onClick={e => e.stopPropagation()}>
                  <button type="button" className="btn-spell-subtle" onClick={handleBulkMoveToToday}>
                    <RotateCw size={12}/> BIND TO PRESENT
                  </button>
                  <button type="button" className="icon-btn-ghost text-gold" onClick={() => setShowOverdue(!showOverdue)}>
                    {showOverdue ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                  </button>
                </div>
              </div>

              {showOverdue && (
                <div className="overdue-spell-list">
                  {overdueTasks.map(t => (
                    <div key={t.id} className="overdue-spell-row">
                      <span className="spell-rune-bullet">ᚱ</span>
                      <span className="overdue-row-title">{t.title}</span>
                      <span className="overdue-row-date">{t.day}</span>
                      <button 
                        type="button" 
                        className="btn-spell-mini"
                        onClick={() => void act({ type: 'task.save', task: { ...t, day } }, 'Trial bound to today')}
                      >
                        DO TODAY
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Destined Deeds (Today's Tasks) */}
          <div className="spell-glass-card trials-list-card">
            <div className="spell-card-head">
              <div>
                <span className="spell-kicker">ᛈ DESTINED DEEDS</span>
                <h4>TODAY'S TRIALS ({completedCount} / {tasks.length} WEAVED)</h4>
              </div>
              <button type="button" className="btn-spell-mini" onClick={() => onNew(day)}>
                <Plus size={13}/> NEW TRIAL
              </button>
            </div>

            {/* Quick Weave Trial Form */}
            <form onSubmit={handleQuickAdd} className="quick-weave-form">
              <input 
                type="text" 
                placeholder="ᛈ Weave a new trial and press Enter…"
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                className="spell-input-line"
              />
              <button type="submit" className="spell-quick-submit" disabled={!quickTitle.trim()}>
                <Plus size={14}/>
              </button>
            </form>

            <div className="trials-stream">
              {tasks.length > 0 ? (
                tasks.map((t, idx) => (
                  <div key={t.id} className={`spell-trial-row ${t.done ? 'trial-weaved' : ''}`}>
                    <button 
                      className={`spell-check-diamond ${t.done ? 'checked' : ''}`}
                      role="checkbox"
                      aria-checked={t.done}
                      onClick={() => onToggle(t)}
                    >
                      {t.done ? '◈' : '◇'}
                    </button>

                    <div className="trial-row-body" onClick={() => onEdit(t)}>
                      <div className="trial-name-row">
                        <span className="trial-rune">ᚱ</span>
                        <strong className="trial-title">{t.title}</strong>
                        {t.done && <span className="weaved-badge">WEAVED</span>}
                      </div>
                      <div className="trial-sub-row">
                        <span>{t.category.toUpperCase()}</span>
                        {t.minutes && <span>· {t.minutes}M</span>}
                        <span className="text-gold">· +10 ESSENCE</span>
                      </div>
                    </div>

                    {!t.done && (
                      <button 
                        type="button" 
                        className="btn-meditate-mini" 
                        title="Enter soul meditation on this trial"
                        onClick={() => void startFocus(t.title, t.id)}
                      >
                        <Play size={11} fill="currentColor"/> MEDITATE
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-spell-state">
                  <span className="empty-spell-rune">ᛟ</span>
                  <p>Your thread in the tapestry is still. Weave a trial to begin.</p>
                  <button type="button" className="btn-spell-meditation btn-sm" onClick={() => onNew(day)}>
                    <Plus size={13}/> WEAVE FIRST TRIAL
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Anchors (Habits) & Memories in Weaving (Courses) */}
        <div className="spell-side-col">
          {/* Sanity Anchors (Habits) */}
          <div className="spell-glass-card anchors-card">
            <div className="spell-card-head">
              <div>
                <span className="spell-kicker">ᛗ SANITY ANCHORS</span>
                <h4>DAILY FLAWS &amp; RHYTHMS</h4>
              </div>
              <span className="anchors-counter text-gold">{habitsDone} / {habitNames.length} EMBEDDED</span>
            </div>

            <div className="anchors-list">
              {habitNames.map(name => {
                const isChecked = !!habitRecord?.checks[name];
                return (
                  <button
                    key={name}
                    type="button"
                    className={`anchor-item-row ${isChecked ? 'anchored' : ''}`}
                    onClick={() => void act({ type: 'habit.set', day, name, done: !isChecked }, 'Anchor affirmed')}
                  >
                    <span className="anchor-sigil">ᛋ</span>
                    <span className="anchor-name">{name}</span>
                    <span className="anchor-status">{isChecked ? '◈ ANCHORED' : '◇ UNSET'}</span>
                  </button>
                );
              })}
              {!habitNames.length && (
                <p className="text-muted">No anchors established.</p>
              )}
            </div>
          </div>

          {/* Memories in Weaving (Courses) */}
          <div className="spell-glass-card memories-card">
            <div className="spell-card-head">
              <div>
                <span className="spell-kicker">ᛟ MEMORIES IN WEAVING</span>
                <h4>ACTIVE WEFT TOME</h4>
              </div>
              <button type="button" className="btn-link text-gold" onClick={() => navigate('Courses')}>
                ALL MEMORIES →
              </button>
            </div>

            {primaryCourse ? (
              <div 
                className="memory-tome-box"
                onClick={() => {
                  if (onOpenCourseDetail) onOpenCourseDetail(primaryCourse.id);
                  else navigate('Courses');
                }}
              >
                <div className="memory-title-row">
                  <BookOpen size={16} className="text-gold"/>
                  <strong>{primaryCourse.title}</strong>
                  <span className="memory-count-pill">{primaryCourse.done} / {primaryCourse.total}</span>
                </div>

                <div className="memory-rune-meter">
                  <div 
                    className="memory-meter-fill" 
                    style={{ width: `${Math.round((primaryCourse.done / Math.max(1, primaryCourse.total)) * 100)}%` }}
                  />
                </div>

                <div className="memory-next-lecture">
                  <span className="weft-label">NEXT WEFT:</span>
                  <p>{primaryLesson?.title || primaryCourse.nextLesson || 'All runes absorbed'}</p>
                </div>

                <button 
                  type="button" 
                  className="btn-spell-meditation btn-sm"
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
                  <Play size={12} fill="currentColor"/> WEAVE NEXT LECTURE
                </button>
              </div>
            ) : (
              <p className="text-muted">No active memory tomes.</p>
            )}
          </div>
        </div>
      </div>

      {/* 4. BOTTOM WEAVING LOG & SEVEN-DAY ACCUMULATION */}
      <section className="spell-glass-card spell-seven-day-deck">
        <div className="spell-card-head">
          <div>
            <span className="spell-kicker">ᛏ SOUL ACCUMULATION</span>
            <h4>SEVEN-DAY TAPESTRY &amp; MEMORY LOG</h4>
          </div>
          <button type="button" className="btn-link text-gold" onClick={() => navigate('Reflect')}>
            DEEP SPELL REFLECTIONS →
          </button>
        </div>

        <div className="spell-telemetry-grid">
          <div className="spell-chart-cell">
            <WeeklyPillChart state={state} selectedDay={day} onSelectDay={setDay}/>
          </div>
          <div className="spell-metrics-cell">
            <MetricSwitcher state={state} day={day}/>
          </div>
        </div>
      </section>
    </div>
  );
}
