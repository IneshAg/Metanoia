import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Coffee, Zap, Flame, Clock, Sparkles, Check, 
  ArrowRight, X, Play, RotateCcw, Plus, Award
} from 'lucide-react';

export interface BreakPromptData {
  sessionId: string;
  mode: 'work' | 'short_break' | 'long_break';
  round: number;
  totalRounds: number;
  duration: number;
  workDuration: number;
  intention: string;
  taskId: string | null;
}

interface PomodoroBreakModalProps {
  prompt: BreakPromptData | null;
  onStartBreak: (breakMode: 'short_break' | 'long_break', minutes: number) => void;
  onExtendSession: (addMinutes: number) => void;
  onStartNextWorkSprint: () => void;
  onFinishSession: () => void;
  onDismiss: () => void;
}

export default function PomodoroBreakModal({
  prompt,
  onStartBreak,
  onExtendSession,
  onStartNextWorkSprint,
  onFinishSession,
  onDismiss,
}: PomodoroBreakModalProps) {
  useEffect(() => {
    if (!prompt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt, onDismiss]);

  if (!prompt) return null;
  if (typeof document === 'undefined') return null;

  const isWork = (prompt.mode || 'work') === 'work';
  const round = prompt.round || 1;
  const totalRounds = prompt.totalRounds || 4;
  const isFinalRound = isWork && (round % totalRounds === 0);
  const nextRound = prompt.mode === 'long_break' ? 1 : round + 1;
  const workMins = prompt.workDuration || (isWork ? prompt.duration : 25);
  const defaultShortBreak = workMins === 50 ? 10 : 5;
  const defaultLongBreak = workMins === 20 ? 20 : 25;

  return createPortal(
    <div className="modal-backdrop pomodoro-alert-backdrop" onClick={onDismiss} role="dialog" aria-modal="true" aria-label="Pomodoro Break Reminder">
      <div className="modal-card pomodoro-break-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="pomo-prompt-header">
          <div className="pomo-prompt-badge-row">
            <span className={`pomo-prompt-badge ${isWork ? 'badge-work-done' : 'badge-break-done'}`}>
              {isWork ? (
                <>
                  <Flame size={14} className="text-amber" />
                  <span>Sprint Complete · Round {round} of {totalRounds}</span>
                </>
              ) : (
                <>
                  <Coffee size={14} className="text-blue" />
                  <span>Break Complete · Recharged!</span>
                </>
              )}
            </span>
            <span className="pomo-prompt-pills-tag">
              {isWork ? (isFinalRound ? '🌴 Long Break Milestone' : '☕ Recovery Needed') : '🚀 Ready for Next Sprint'}
            </span>
          </div>
          <button 
            type="button" 
            className="icon-button" 
            onClick={onDismiss} 
            title="Dismiss dialog (timer stays paused)"
            aria-label="Dismiss alert"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Body */}
        <div className="pomo-prompt-body">
          <h2 className="pomo-prompt-title">
            {isWork ? (
              <>
                <span>Done focusing on </span>
                <span className="pomo-title-highlight">{prompt.intention}</span>
                <span className="pomo-duration-tag">({prompt.duration}m focused)</span>
              </>
            ) : (
              <>
                <span>Rest period complete </span>
                <span className="pomo-duration-tag">({prompt.duration}m break)</span>
              </>
            )}
          </h2>

          <div className="pomo-advice-box">
            {isWork ? (
              <>
                <p className="pomo-advice-text">
                  <strong>Francesco Cirillo's Golden Rule:</strong> The human brain cannot maintain high-grade focus continuously. 
                  Short recovery breaks are not a pause from productivity—they protect your attention span from burning out.
                </p>
                <div className="pomo-stat-chips-row">
                  <span className="pomo-chip">⏱️ <strong>{prompt.duration}m</strong> deep work recorded</span>
                  <span className="pomo-chip">✨ <strong>+25 XP</strong> awarded</span>
                  {prompt.duration >= 20 && <span className="pomo-chip">💎 <strong>+5 Focus Credits</strong></span>}
                </div>
              </>
            ) : (
              <p className="pomo-advice-text">
                Your recovery buffer is finished! Your eyes and mental bandwidth have reset. 
                Ready to dive into <strong>Round {nextRound}</strong>?
              </p>
            )}
          </div>

          {/* Primary Recommended Action Card */}
          <div className="pomo-primary-action-wrap">
            {isWork ? (
              isFinalRound ? (
                <button
                  type="button"
                  className="pomo-action-btn pomo-btn-long-break"
                  onClick={() => onStartBreak('long_break', defaultLongBreak)}
                >
                  <div className="pomo-btn-icon-wrap">
                    <Sparkles size={24} />
                  </div>
                  <div className="pomo-btn-text-wrap">
                    <span className="pomo-btn-main">🌴 Start {defaultLongBreak}m Rejuvenation Break</span>
                    <span className="pomo-btn-sub">4 rounds completed! Walk, hydrate, and step away from screens</span>
                  </div>
                  <ArrowRight size={20} className="pomo-btn-arrow" />
                </button>
              ) : (
                <button
                  type="button"
                  className="pomo-action-btn pomo-btn-short-break"
                  onClick={() => onStartBreak('short_break', defaultShortBreak)}
                >
                  <div className="pomo-btn-icon-wrap">
                    <Coffee size={24} />
                  </div>
                  <div className="pomo-btn-text-wrap">
                    <span className="pomo-btn-main">☕ Start {defaultShortBreak}m Short Break (Recommended)</span>
                    <span className="pomo-btn-sub">Stand up, stretch, grab water · Clock automatically times 5 minutes</span>
                  </div>
                  <ArrowRight size={20} className="pomo-btn-arrow" />
                </button>
              )
            ) : (
              <button
                type="button"
                className="pomo-action-btn pomo-btn-next-sprint"
                onClick={onStartNextWorkSprint}
              >
                <div className="pomo-btn-icon-wrap">
                  <Flame size={24} />
                </div>
                <div className="pomo-btn-text-wrap">
                  <span className="pomo-btn-main">🚀 Launch Round {nextRound} Focus ({workMins}m Sprint)</span>
                  <span className="pomo-btn-sub">Dive back into {prompt.intention}</span>
                </div>
                <ArrowRight size={20} className="pomo-btn-arrow" />
              </button>
            )}
          </div>

          {/* Secondary Flexible Actions */}
          <div className="pomo-secondary-deck">
            <span className="pomo-secondary-label">Alternative options:</span>
            <div className="pomo-secondary-btns-row">
              {isWork ? (
                <>
                  {!isFinalRound && (
                    <button
                      type="button"
                      className="pomo-sub-btn"
                      onClick={() => onStartBreak('long_break', 20)}
                      title="Need more time to step away? Take 20m long break now"
                    >
                      <Sparkles size={14} className="text-amber" />
                      <span>🌴 Take 20m Long Break</span>
                    </button>
                  )}
                  {isFinalRound && (
                    <button
                      type="button"
                      className="pomo-sub-btn"
                      onClick={() => onStartBreak('short_break', 5)}
                      title="Take a quick 5-minute break instead"
                    >
                      <Coffee size={14} className="text-blue" />
                      <span>☕ 5m Quick Break</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="pomo-sub-btn"
                    onClick={() => onExtendSession(5)}
                    title="In the zone? Add 5 minutes to wrap up"
                  >
                    <Plus size={14} />
                    <span>In flow? +5m</span>
                  </button>
                  <button
                    type="button"
                    className="pomo-sub-btn"
                    onClick={() => onExtendSession(10)}
                    title="Extend session by 10 minutes"
                  >
                    <Plus size={14} />
                    <span>+10m</span>
                  </button>
                  <button
                    type="button"
                    className="pomo-sub-btn"
                    onClick={onStartNextWorkSprint}
                    title="Skip break and jump straight into next round"
                  >
                    <Flame size={14} className="text-amber" />
                    <span>Skip Break · Round {nextRound}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pomo-sub-btn"
                    onClick={() => onExtendSession(2)}
                    title="Add 2 more minutes to this break"
                  >
                    <Plus size={14} />
                    <span>+2m More Break</span>
                  </button>
                  <button
                    type="button"
                    className="pomo-sub-btn"
                    onClick={() => onExtendSession(5)}
                    title="Add 5 more minutes to this break"
                  >
                    <Plus size={14} />
                    <span>+5m More Break</span>
                  </button>
                </>
              )}

              <button
                type="button"
                className="pomo-sub-btn btn-finish-session"
                onClick={onFinishSession}
                title="Finish session and save progress"
              >
                <Check size={14} />
                <span>✓ Finish Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
