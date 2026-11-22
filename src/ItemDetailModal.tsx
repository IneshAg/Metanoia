import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Flame, Coffee, Clock, Calendar, CheckCircle2, Circle, 
  Edit2, Trash2, Zap, Award, Sparkles, Check, ArrowRight
} from 'lucide-react';
import { formatTime12h, formatSessionTimeRange, type FocusSession, type Task } from './domain';

interface ItemDetailModalProps {
  session?: FocusSession | null;
  task?: Task | null;
  allTasks?: Task[];
  allSessions?: FocusSession[];
  onClose: () => void;
  onEditTask?: (t: Task) => void;
  onToggleTask?: (t: Task) => void;
  onDeleteTask?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onSelectTask?: (t: Task) => void;
}

export default function ItemDetailModal({
  session,
  task,
  allTasks = [],
  allSessions = [],
  onClose,
  onEditTask,
  onToggleTask,
  onDeleteTask,
  onDeleteSession,
  onSelectTask,
}: ItemDetailModalProps) {
  useEffect(() => {
    if (!session && !task) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, task, onClose]);

  if (!session && !task) return null;
  if (typeof document === 'undefined') return null;

  // Session details calculation
  if (session) {
    const isBreak = session.mode === 'short_break' || session.mode === 'long_break';
    const isLongBreak = session.mode === 'long_break';
    const activeMins = Math.round(session.active_seconds / 60);
    const activeSecRemainder = session.active_seconds % 60;
    
    // Wall clock span
    const startMs = new Date(session.started_utc).getTime();
    const endMs = session.completed_utc
      ? new Date(session.completed_utc).getTime()
      : startMs + session.active_seconds * 1000;
    const totalClockSecs = Math.max(session.active_seconds, Math.round((endMs - startMs) / 1000));
    const totalClockMins = Math.round(totalClockSecs / 60);

    const pauseSecs = session.break_seconds ?? Math.max(0, totalClockSecs - session.active_seconds);
    const pauseMins = Math.round(pauseSecs / 60);

    const timeRangeStr = formatSessionTimeRange(session.started_utc, session.completed_utc, session.active_seconds);
    const startDateFormatted = new Date(session.started_utc).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const linkedTask = session.taskId ? allTasks.find(t => t.id === session.taskId) : null;
    const earnedCredits = (!isBreak && session.active_seconds >= 1200);

    const focusRatio = totalClockSecs > 0
      ? Math.min(100, Math.round((session.active_seconds / totalClockSecs) * 100))
      : 100;

    return createPortal(
      <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Session details">
        <div className="modal-card item-detail-modal" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="item-detail-header">
            <div className="item-detail-title-group">
              <span className={`detail-type-badge ${isBreak ? 'badge-break' : 'badge-focus'}`}>
                {isBreak ? (isLongBreak ? '🌴 Long Break' : '☕ Short Break') : '🔥 Focus Session'}
              </span>
              <span className="detail-status-pill">
                <Check size={12} strokeWidth={2.5} /> Completed
              </span>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {/* Session Intention */}
          <div className="item-detail-body">
            <h3 className="detail-main-title">
              {session.intention || (isBreak ? 'Recharge & Rest' : 'Focused Flow Session')}
            </h3>

            {linkedTask && (
              <div 
                className="detail-linked-task-card"
                onClick={() => onSelectTask && onSelectTask(linkedTask)}
                title="Click to view linked task details"
              >
                <span className="task-link-label">Quest Task:</span>
                <strong className="task-link-title">{linkedTask.title}</strong>
                <ArrowRight size={13} className="task-link-arrow" />
              </div>
            )}

            {/* Timing Banner */}
            <div className="detail-timing-banner">
              <div className="timing-banner-row">
                <div className="timing-col">
                  <span className="timing-label">Date</span>
                  <strong className="timing-val">{startDateFormatted}</strong>
                </div>
                <div className="timing-col">
                  <span className="timing-label">Time Window</span>
                  <strong className="timing-val text-accent">{timeRangeStr || formatTime12h(session.started_utc)}</strong>
                </div>
              </div>
            </div>

            {/* High-Impact Stat Grid */}
            <div className="item-detail-metric-grid">
              <div className="detail-metric-card metric-active">
                <div className="metric-header">
                  <Clock size={14} className="metric-icon" />
                  <span className="metric-caption">{isBreak ? 'Rest Time' : 'Focused Work'}</span>
                </div>
                <strong className="metric-number">
                  {activeMins < 1 ? `${session.active_seconds}s` : `${activeMins}m ${activeSecRemainder > 0 ? `${activeSecRemainder}s` : ''}`}
                </strong>
                <span className="metric-sub">Pure uninterrupted time</span>
              </div>

              <div className="detail-metric-card metric-pause">
                <div className="metric-header">
                  <Coffee size={14} className="metric-icon" />
                  <span className="metric-caption">Paused Time</span>
                </div>
                <strong className="metric-number">
                  {pauseMins > 0 ? `${pauseMins}m` : (pauseSecs > 0 ? `${pauseSecs}s` : '0m')}
                </strong>
                <span className="metric-sub">Pauses during session</span>
              </div>

              <div className="detail-metric-card metric-span">
                <div className="metric-header">
                  <Calendar size={14} className="metric-icon" />
                  <span className="metric-caption">Total Clock Span</span>
                </div>
                <strong className="metric-number">
                  {totalClockMins < 60 ? `${totalClockMins}m` : `${Math.floor(totalClockMins / 60)}h ${totalClockMins % 60}m`}
                </strong>
                <span className="metric-sub">Start to completion</span>
              </div>

              <div className="detail-metric-card metric-ratio">
                <div className="metric-header">
                  <Zap size={14} className="metric-icon" />
                  <span className="metric-caption">Flow Ratio</span>
                </div>
                <strong className="metric-number">{focusRatio}%</strong>
                <span className="metric-sub">Focus vs pause</span>
              </div>
            </div>

            {/* Rewards Callout */}
            {earnedCredits && (
              <div className="detail-rewards-card">
                <Sparkles size={16} className="text-amber" />
                <div className="rewards-text">
                  <strong>Session Rewards Earned</strong>
                  <p>+25 XP · +5 Focus Credits awarded for deep work</p>
                </div>
                <span className="rewards-badge">✓ Awarded</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="item-detail-footer">
            {onDeleteSession && (
              <button
                type="button"
                className="btn-bar-action btn-bar-delete"
                onClick={() => {
                  if (confirm('Delete this session from history? Today focus minutes and rewards will update accordingly.')) {
                    onDeleteSession(String(session.id));
                    onClose();
                  }
                }}
              >
                <Trash2 size={13} /> Delete Session
              </button>
            )}
            <button type="button" className="btn-clean-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Task details calculation
  if (task) {
    const isDone = !!task.done;
    const taskSessions = allSessions.filter(s => s.taskId === task.id);
    const totalFocusSecs = taskSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
    const totalFocusMins = Math.round(totalFocusSecs / 60);

    return createPortal(
      <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Task details">
        <div className="modal-card item-detail-modal" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="item-detail-header">
            <div className="item-detail-title-group">
              <span className={`detail-category-badge category-${task.category}`}>
                {task.category.toUpperCase()}
              </span>
              <span className={`detail-status-pill ${isDone ? 'status-done' : 'status-pending'}`}>
                {isDone ? <Check size={12} strokeWidth={2.5} /> : <Clock size={12} />}
                {isDone ? 'Completed' : 'To Do'}
              </span>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>

          {/* Task Info */}
          <div className="item-detail-body">
            <h3 className={`detail-main-title ${isDone ? 'task-done-title' : ''}`}>
              {task.title}
            </h3>

            {/* Timing Banner */}
            <div className="detail-timing-banner">
              <div className="timing-banner-row">
                <div className="timing-col">
                  <span className="timing-label">Scheduled Date</span>
                  <strong className="timing-val">{task.day || 'Unscheduled'}</strong>
                </div>
                <div className="timing-col">
                  <span className="timing-label">Scheduled Time</span>
                  <strong className="timing-val text-accent">
                    {task.start ? `${task.start}${task.end ? ` – ${task.end}` : ''}` : 'Anytime (All Day)'}
                  </strong>
                </div>
                {task.minutes && (
                  <div className="timing-col">
                    <span className="timing-label">Estimate</span>
                    <strong className="timing-val">{task.minutes}m</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Focus Time for this task */}
            {taskSessions.length > 0 && (
              <div className="detail-task-focus-summary">
                <div className="focus-summary-header">
                  <Flame size={15} className="text-amber" />
                  <strong>Focus Dedicated: {totalFocusMins}m across {taskSessions.length} session{taskSessions.length === 1 ? '' : 's'}</strong>
                </div>
                <div className="focus-summary-pills">
                  {taskSessions.map(s => {
                    const mins = Math.round(s.active_seconds / 60);
                    return (
                      <span key={s.id} className="task-session-chip">
                        ⏱️ {mins < 1 ? `${s.active_seconds}s` : `${mins}m`} ({formatTime12h(s.started_utc)})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Goals / Sub-items */}
            {task.goals && task.goals.length > 0 && (
              <div className="detail-subgoals-section">
                <span className="subgoals-title">Sub-goals & Outcomes:</span>
                <div className="subgoals-list">
                  {task.goals.map((g, i) => (
                    <div key={i} className="subgoal-item">
                      <CheckCircle2 size={13} className="text-accent" />
                      <span>{g.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="item-detail-footer">
            <div className="footer-left-actions">
              {onToggleTask && (
                <button
                  type="button"
                  className={`btn-bar-action ${isDone ? 'btn-reopen' : 'btn-complete'}`}
                  onClick={() => onToggleTask(task)}
                >
                  {isDone ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                  {isDone ? 'Reopen Task' : 'Mark Completed'}
                </button>
              )}
              {onEditTask && (
                <button
                  type="button"
                  className="btn-bar-action btn-bar-edit"
                  onClick={() => {
                    onClose();
                    onEditTask(task);
                  }}
                >
                  <Edit2 size={13} /> Edit
                </button>
              )}
              {onDeleteTask && (
                <button
                  type="button"
                  className="btn-bar-action btn-bar-delete"
                  onClick={() => {
                    onClose();
                    onDeleteTask(task.id);
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
            <button type="button" className="btn-clean-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return null;
}
