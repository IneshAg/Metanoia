import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Play, Pause, CheckCircle2, ArrowUpRight, Clock, Sparkles, Coffee, Zap } from 'lucide-react';
import type { State, Action } from './domain';
import { stopMusicPlayback } from './MusicPlayer';

interface SettleInPillProps {
  state: State;
  remaining: number;
  act: (action: Action, message?: string) => Promise<boolean | undefined | void>;
  setPage: (page: string) => void;
  defaultMinutes?: number;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export default function SettleInPill({
  state,
  remaining,
  act,
  setPage,
  defaultMinutes = 25,
  isOpen,
  onToggle,
}: SettleInPillProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const setOpen = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(open) : val;
    if (isControlled) {
      onToggle?.(nextVal);
    } else {
      setInternalOpen(nextVal);
    }
  };

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isRunning = Boolean(state.focus?.runningSince);
  const hasFocus = Boolean(state.focus);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySessions = (state.sessions || []).filter(s => String(s.started_utc || '').startsWith(todayStr));
  const todayFocusSessions = todaySessions.filter(s => s.mode === 'work' || !s.mode);
  const todayBreaks = todaySessions.filter(s => s.mode === 'short_break' || s.mode === 'long_break');
  const todayMinutes = Math.round(todayFocusSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0) / 60);
  const todayBreakMinutes = Math.round(todayBreaks.reduce((acc, s) => acc + (s.active_seconds || 0), 0) / 60) +
    Math.round(todayFocusSessions.reduce((acc, s) => acc + (s.break_seconds || 0), 0) / 60);

  const now = Date.now();
  const elapsedSeconds = state.focus
    ? state.focus.elapsed + (state.focus.runningSince ? Math.max(0, Math.floor((now - state.focus.runningSince) / 1000)) : 0)
    : 0;
  const targetSeconds = (state.focus?.duration || defaultMinutes) * 60;
  const isOvertime = Boolean(state.focus && elapsedSeconds >= targetSeconds);
  const overtimeSeconds = isOvertime ? elapsedSeconds - targetSeconds : 0;
  const countdownSeconds = Math.max(0, targetSeconds - elapsedSeconds);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open]);

  const startSession = async (mins: number, mode?: 'work' | 'short_break' | 'long_break') => {
    const linkedTask = state.tasks.find((t) => t.id === selectedTaskId);
    const intention = mode === 'long_break' ? '🌴 Long Rejuvenation Break' : (linkedTask?.title || 'Deep focus flow');
    await act(
      {
        type: 'focus.start',
        minutes: mins,
        mode: mode || 'work',
        intention,
        taskId: selectedTaskId || null,
      },
      mode === 'long_break' ? '🌴 Long Break started (20 min)!' : `Focus session started (${mins} min)!`
    );
    setOpen(false);
  };

  const togglePause = async () => {
    if (!state.focus) return;
    await act(
      { type: isRunning ? 'focus.pause' : 'focus.resume' },
      isRunning ? 'Focus paused' : 'Focus resumed'
    );
  };

  const finishSession = async () => {
    if (state.focus?.mode !== 'work') {
      stopMusicPlayback();
    }
    await act({ type: 'focus.finish', actualSeconds: elapsedSeconds }, 'Focus session completed!');
    setOpen(false);
  };

  return (
    <div
      className="settle-in-container"
      ref={containerRef}
    >
      <button
        type="button"
        className={`focus-status-pill interactive-settle-pill ${isRunning ? 'focus-active-pulse' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title={hasFocus ? 'Manage active focus session' : 'Quick launch focus session'}
        aria-expanded={open}
      >
        <span className={isRunning ? 'live-dot-pulse' : 'quiet-dot-subtle'} />
        <span>
          {hasFocus
            ? (state.focus?.mode === 'short_break'
                ? (isOvertime
                    ? `☕ +${Math.floor(overtimeSeconds / 60)}:${String(overtimeSeconds % 60).padStart(2, '0')}`
                    : `☕ Break ${Math.floor(countdownSeconds / 60)}:${String(countdownSeconds % 60).padStart(2, '0')}`)
                : state.focus?.mode === 'long_break'
                  ? (isOvertime
                      ? `🌴 +${Math.floor(overtimeSeconds / 60)}:${String(overtimeSeconds % 60).padStart(2, '0')}`
                      : `🌴 Break ${Math.floor(countdownSeconds / 60)}:${String(countdownSeconds % 60).padStart(2, '0')}`)
                  : (isOvertime
                      ? `🔥 +${Math.floor(overtimeSeconds / 60)}:${String(overtimeSeconds % 60).padStart(2, '0')} · Flow`
                      : `🔥 ${Math.floor(countdownSeconds / 60)}:${String(countdownSeconds % 60).padStart(2, '0')} · R${state.focus?.round || 1}`))
            : '⚡ Settle In'}
        </span>
        <ChevronDown
          size={13}
          className={`settle-chevron ${open ? 'rotated' : ''}`}
        />
      </button>

      {open && (
        <div
          className="settle-in-popover"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!hasFocus ? (
            /* Idle: Quick Launch Mode */
            <div className="settle-popover-content">
              <div className="settle-popover-head">
                <div className="settle-head-title">
                  <Sparkles size={15} className="text-amber" />
                  <strong>Settle In · Focus Flow</strong>
                </div>
                <small>
                  {todayMinutes > 0 || todayBreakMinutes > 0
                    ? `🔥 ${Math.floor(todayMinutes / 60) > 0 ? `${Math.floor(todayMinutes / 60)}h ` : ''}${todayMinutes % 60}m focused · ☕ ${todayBreakMinutes}m breaks`
                    : 'Select a sprint to enter deep work'}
                </small>
              </div>

              {/* Task Selector (Optional) */}
              {state.tasks.some((t) => !t.done) && (
                <div className="settle-task-select-wrap">
                  <label htmlFor="settle-task-picker">Attach Task (Optional):</label>
                  <select
                    id="settle-task-picker"
                    className="settle-task-select"
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <option value="">✨ Open Focus (No Task)</option>
                    {state.tasks
                      .filter((t) => !t.done)
                      .slice(0, 30)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Quick Preset Buttons */}
              <div className="settle-presets-grid">
                {[
                  { mins: 20, label: '20/5 Sprint', icon: '⚡' },
                  { mins: 25, label: 'Pomodoro', icon: '🍅' },
                  { mins: 50, label: '50/10 Flow', icon: '🌊' },
                  { mins: 20, label: 'Long Break', icon: '🌴', mode: 'long_break' as const },
                  { mins: 60, label: 'Power Hour', icon: '🚀' },
                ].map(({ mins, label, icon, mode }) => (
                  <button
                    key={`${mins}-${label}`}
                    type="button"
                    className="settle-preset-btn"
                    onClick={() => void startSession(mins, mode)}
                  >
                    <span className="preset-icon">{icon}</span>
                    <div className="preset-text">
                      <strong>{mins} min</strong>
                      <small>{label}</small>
                    </div>
                  </button>
                ))}
              </div>

              {/* Lounge Shortcut */}
              <button
                type="button"
                className="settle-lounge-link-btn"
                onClick={() => {
                  setPage('Focus');
                  setOpen(false);
                }}
              >
                <span>🎧 Open Focus Lounge & Music</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          ) : (
            /* Active Focus Session Control */
            <div className="settle-popover-content">
              <div className="settle-popover-head">
                <div className="settle-head-title">
                  <span className={isRunning ? 'live-dot-pulse' : 'quiet-dot-subtle'} />
                  <strong>
                    {state.focus?.mode === 'short_break'
                      ? '☕ Short Break'
                      : state.focus?.mode === 'long_break'
                        ? '🌴 Long Break'
                        : `🔥 Round ${state.focus?.round || 1} of ${state.focus?.totalRounds || 4}`}
                  </strong>
                </div>
                <small className="truncate-text">
                  {state.focus?.intention || 'Focused work'}
                </small>
              </div>

              <div className="settle-active-timer-display">
                <Clock size={18} className="text-muted" />
                <span className={`timer-digits ${isOvertime ? 'text-emerald' : ''}`}>
                  {isOvertime ? '+' : ''}
                  {Math.floor((isOvertime ? overtimeSeconds : countdownSeconds) / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {String((isOvertime ? overtimeSeconds : countdownSeconds) % 60).padStart(2, '0')}
                </span>
                <span className={`timer-status-badge ${isOvertime ? 'badge-emerald' : ''}`}>
                  {isOvertime ? 'IN FLOW' : (isRunning ? 'RUNNING' : 'PAUSED')}
                </span>
              </div>

              <div className="settle-active-actions-row">
                <button
                  type="button"
                  className={`settle-action-pill ${isRunning ? 'btn-pause' : 'btn-resume'}`}
                  onClick={() => void togglePause()}
                >
                  {isRunning ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isRunning ? 'Pause' : 'Resume'}</span>
                </button>
                <button
                  type="button"
                  className="settle-action-pill btn-next-phase"
                  title={state.focus?.mode === 'work' ? 'Complete work and start break' : 'Complete break and start next focus round'}
                  onClick={async () => {
                    if (state.focus?.mode !== 'work') {
                      stopMusicPlayback();
                    }
                    await act(
                      { type: 'focus.next_phase', actualSeconds: elapsedSeconds },
                      state.focus?.mode === 'work' ? 'Switched to Break ☕' : 'Started Next Round 🚀'
                    );
                  }}
                >
                  {state.focus?.mode === 'work' ? <Coffee size={14} /> : <Zap size={14} />}
                  <span>{state.focus?.mode === 'work' ? 'Break' : 'Next'}</span>
                </button>
                {state.focus?.mode === 'work' && (
                  <button
                    type="button"
                    className="settle-action-pill btn-long-break"
                    title="Take a 20-minute Long Break now"
                    onClick={async () => {
                      stopMusicPlayback();
                      await act(
                        { type: 'focus.next_phase', actualSeconds: elapsedSeconds, longBreak: true, breakMinutes: 20 },
                        'Switched to 20m Long Break 🌴'
                      );
                    }}
                  >
                    <span>🌴 Long Break</span>
                  </button>
                )}
                <button
                  type="button"
                  className="settle-action-pill btn-extend"
                  title="Add 5 more minutes"
                  onClick={async () => {
                    await act({ type: 'focus.extend', minutes: 5 }, '+5 min added!');
                  }}
                >
                  <span>+5m</span>
                </button>
                <button
                  type="button"
                  className="settle-action-pill btn-extend"
                  title="Chain 30 more minutes onto this session"
                  onClick={async () => {
                    await act({ type: 'focus.extend', minutes: 30 }, '+30 min chained!');
                  }}
                >
                  <span>+30m</span>
                </button>
                <button
                  type="button"
                  className="settle-action-pill btn-finish"
                  onClick={() => void finishSession()}
                >
                  <CheckCircle2 size={14} />
                  <span>Finish</span>
                </button>
              </div>

              <button
                type="button"
                className="settle-lounge-link-btn"
                onClick={() => {
                  setPage('Focus');
                  setOpen(false);
                }}
              >
                <span>🎧 Open Focus Lounge & Music</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
