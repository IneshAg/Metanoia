import React, { useEffect, useState } from 'react';
import { Play, Pause, Coffee, SkipForward, X, Maximize2, Minimize2 } from 'lucide-react';
import { load, send } from './api';
import { activeSeconds, type State } from './domain';
import { invoke } from '@tauri-apps/api/core';

export default function FloatingTimerApp() {
  const [state, setState] = useState<State | null>(null);
  const [isMiniPill, setIsMiniPill] = useState<boolean>(() => {
    return localStorage.getItem('metanoia-floating-pill') === 'true';
  });
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  // Poll state from SQLite and tick timer
  useEffect(() => {
    let mounted = true;
    const fetchState = async () => {
      try {
        const s = await load();
        if (mounted) setState(s);
      } catch (e) {
        console.warn('Floating timer load error:', e);
      }
    };

    fetchState();
    const pollInterval = window.setInterval(fetchState, 1500);
    const tickInterval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, []);

  // Update window size when switching modes
  useEffect(() => {
    localStorage.setItem('metanoia-floating-pill', String(isMiniPill));
    try {
      if (isMiniPill) {
        invoke('set_floating_timer_size', { width: 140.0, height: 44.0 }).catch(() => {});
      } else {
        invoke('set_floating_timer_size', { width: 210.0, height: 56.0 }).catch(() => {});
      }
    } catch {}
  }, [isMiniPill]);

  const act = async (action: any) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await send(action);
      setState(next);
    } catch (err) {
      console.error('Floating timer action error:', err);
    } finally {
      setBusy(false);
    }
  };

  const closeOverlay = () => {
    try {
      localStorage.setItem('metanoia-floating-visible', 'false');
      invoke('hide_floating_timer').catch(() => {});
    } catch {}
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only drag when clicking background or non-button elements
    if ((e.target as HTMLElement).closest('button, input, select, a')) return;
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().startDragging();
    } catch (err) {
      console.warn('startDragging error:', err);
    }
  };

  const focus = state?.focus;
  const isBreak = focus?.mode === 'short_break' || focus?.mode === 'long_break';
  const targetSeconds = (focus?.duration || 25) * 60;
  const elapsedSeconds = focus ? activeSeconds(focus, now) : 0;
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);
  const isOvertime = elapsedSeconds >= targetSeconds && !isBreak;
  const isRunning = Boolean(focus?.runningSince);

  const displayMins = isOvertime
    ? Math.floor((elapsedSeconds - targetSeconds) / 60)
    : Math.floor(remainingSeconds / 60);
  const displaySecs = isOvertime
    ? Math.floor((elapsedSeconds - targetSeconds) % 60)
    : Math.floor(remainingSeconds % 60);
  const timeFormatted = `${isOvertime ? '+' : ''}${String(displayMins).padStart(2, '0')}:${String(displaySecs).padStart(2, '0')}`;

  const progressPercent = targetSeconds > 0
    ? Math.min(100, Math.max(0, Math.round((elapsedSeconds / targetSeconds) * 100)))
    : 0;

  if (isMiniPill) {
    return (
      <div
        className="floating-widget-root floating-widget-mini"
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
      >
        <div className="floating-content-row" data-tauri-drag-region>
          <span className="floating-mode-indicator" data-tauri-drag-region>
            {isBreak ? '☕' : '⚡'}
          </span>
          <span className={`floating-time-text ${isOvertime ? 'time-overtime' : ''}`} data-tauri-drag-region>
            {focus ? timeFormatted : '25:00'}
          </span>
          {focus && (
            <button
              type="button"
              className="floating-btn-primary"
              disabled={busy}
              title={isRunning ? 'Pause' : 'Resume'}
              onClick={(e) => {
                e.stopPropagation();
                void act({ type: isRunning ? 'focus.pause' : 'focus.resume' });
              }}
            >
              {isRunning ? (
                <Pause size={13} fill="#ffffff" stroke="#ffffff" />
              ) : (
                <Play size={13} fill="#ffffff" stroke="#ffffff" style={{ marginLeft: 1 }} />
              )}
            </button>
          )}
          <button
            type="button"
            className="floating-btn-subtle"
            title="Expand to compact bar"
            onClick={(e) => {
              e.stopPropagation();
              setIsMiniPill(false);
            }}
          >
            <Maximize2 size={12} color="#94a3b8" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="floating-widget-root"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
    >
      <div className="floating-content-row" data-tauri-drag-region>
        {/* Left: Mode Indicator & Large Time */}
        <div className="floating-time-group" data-tauri-drag-region>
          <span
            className={`floating-mode-indicator ${isBreak ? 'indicator-break' : 'indicator-work'}`}
            data-tauri-drag-region
            title={isBreak ? 'Break time' : 'Focus time'}
          >
            {isBreak ? '☕' : '⚡'}
          </span>
          <span
            className={`floating-time-text ${isOvertime ? 'time-overtime' : ''}`}
            data-tauri-drag-region
            title={isRunning ? 'Focus running' : 'Paused'}
          >
            {focus ? timeFormatted : '25:00'}
          </span>
        </div>

        {/* Right: Icon-only buttons (NO text, high readability) */}
        <div className="floating-actions-group">
          {focus ? (
            <>
              {/* Play / Pause Button */}
              <button
                type="button"
                className="floating-btn-primary"
                disabled={busy}
                title={isRunning ? 'Pause Focus' : 'Resume Focus'}
                onClick={() => void act({ type: isRunning ? 'focus.pause' : 'focus.resume' })}
              >
                {isRunning ? (
                  <Pause size={15} fill="#ffffff" stroke="#ffffff" />
                ) : (
                  <Play size={15} fill="#ffffff" stroke="#ffffff" style={{ marginLeft: 2 }} />
                )}
              </button>

              {/* Take Break or Skip Break Button */}
              {!isBreak ? (
                <button
                  type="button"
                  className="floating-btn-secondary"
                  disabled={busy}
                  title="Take 5m Break"
                  onClick={() => void act({ type: 'focus.early_break', breakMinutes: 5 })}
                >
                  <Coffee size={14} color="#e2e8f0" strokeWidth={2.2} />
                </button>
              ) : (
                <button
                  type="button"
                  className="floating-btn-secondary"
                  disabled={busy}
                  title="Skip Break and Return to Focus"
                  onClick={() => void act({ type: 'focus.skip_break' })}
                >
                  <SkipForward size={14} color="#e2e8f0" strokeWidth={2.2} />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="floating-btn-primary"
              disabled={busy}
              title="Start 25m Focus"
              onClick={() => void act({ type: 'focus.start', minutes: 25, workDuration: 25, round: 1, mode: 'work' })}
            >
              <Play size={15} fill="#ffffff" stroke="#ffffff" style={{ marginLeft: 2 }} />
            </button>
          )}

          {/* Minimize to micro pill */}
          <button
            type="button"
            className="floating-btn-subtle"
            title="Minimize to Pill"
            onClick={() => setIsMiniPill(true)}
          >
            <Minimize2 size={12} color="#94a3b8" />
          </button>

          {/* Close Overlay */}
          <button
            type="button"
            className="floating-btn-close"
            title="Hide Floating Timer"
            onClick={closeOverlay}
          >
            <X size={13} color="#94a3b8" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Micro progress line at bottom */}
      <div className="floating-micro-track" data-tauri-drag-region>
        <div
          className={`floating-micro-bar ${isBreak ? 'bar-break' : 'bar-work'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
