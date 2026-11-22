import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Check, Sparkles, Award, ArrowRight, BookOpen, 
  CheckCircle2, Clock, Coffee, Shield
} from 'lucide-react';
import { type FocusSession, type Task, type Course } from './domain';

interface SessionReviewModalProps {
  session: FocusSession | null;
  linkedTask?: Task | null;
  linkedCourse?: Course | null;
  onSaveReview: (sessionId: string | number, rating: number, notes: string, markTaskDone?: boolean) => void;
  onClose: () => void;
}

export default function SessionReviewModal({
  session,
  linkedTask,
  linkedCourse,
  onSaveReview,
  onClose,
}: SessionReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');
  const [markTaskDone, setMarkTaskDone] = useState<boolean>(Boolean(linkedTask && !linkedTask.done));

  if (!session) return null;
  if (typeof document === 'undefined') return null;

  const focusMins = Math.round(session.active_seconds / 60);
  const pauseMins = session.break_seconds ? Math.round(session.break_seconds / 60) : 0;
  const xpEarned = session.active_seconds >= 1200 ? 25 : 10;
  const creditsEarned = session.active_seconds >= 1200 ? 5 : 0;

  const handleFinish = () => {
    onSaveReview(session.id, rating, notes.trim(), markTaskDone);
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="End of session review">
      <div className="modal-card session-review-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="review-card-header">
          <div className="review-header-badge">
            <Sparkles size={16} className="text-cyan" />
            <span>Session Accomplished</span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close review dialog">
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <div className="review-card-body">
          <h2 className="review-title">
            {session.intention || 'Focused Work Session'}
          </h2>

          {/* Quick Metrics Grid */}
          <div className="review-metrics-grid">
            <div className="review-metric-pill">
              <span className="metric-label">⏱️ Deep Focus</span>
              <strong className="metric-value">{focusMins < 1 ? `${session.active_seconds}s` : `${focusMins}m`}</strong>
            </div>
            {pauseMins > 0 && (
              <div className="review-metric-pill">
                <span className="metric-label">☕ Rest & Pauses</span>
                <strong className="metric-value">{pauseMins}m</strong>
              </div>
            )}
            <div className="review-metric-pill highlight-xp">
              <span className="metric-label">✨ Mastery XP</span>
              <strong className="metric-value">+{xpEarned} XP</strong>
            </div>
            {creditsEarned > 0 && (
              <div className="review-metric-pill highlight-credits">
                <span className="metric-label">💎 Credits</span>
                <strong className="metric-value">+{creditsEarned}</strong>
              </div>
            )}
          </div>

          {/* Flow Quality Rating (Crystal Motif) */}
          <div className="review-section">
            <label className="review-section-label">Flow Quality & Depth</label>
            <div className="crystal-rating-row" role="radiogroup" aria-label="Flow quality rating">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`crystal-btn ${rating >= star ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  aria-label={`${star} crystals out of 5`}
                >
                  <span className="crystal-glyph">💎</span>
                  <span className="crystal-num">{star}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Contextual associations: Linked Task */}
          {linkedTask && (
            <div className="review-association-card">
              <div className="association-info">
                <span className="association-type">Linked Task</span>
                <strong className="association-title">{linkedTask.title}</strong>
              </div>
              <button
                type="button"
                className={`task-complete-toggle-btn ${markTaskDone ? 'is-done' : ''}`}
                onClick={() => setMarkTaskDone(!markTaskDone)}
              >
                <CheckCircle2 size={16} />
                <span>{markTaskDone ? 'Marked Completed' : 'Leave Open'}</span>
              </button>
            </div>
          )}

          {/* Contextual associations: Linked Course */}
          {linkedCourse && (
            <div className="review-association-card course-association">
              <BookOpen size={16} className="text-cyan" />
              <div className="association-info">
                <span className="association-type">Linked Course</span>
                <strong className="association-title">{linkedCourse.title}</strong>
              </div>
              <span className="course-progress-badge">{linkedCourse.done}/{linkedCourse.total} lessons</span>
            </div>
          )}

          {/* Quick reflection note */}
          <div className="review-section">
            <label htmlFor="session-reflection-input" className="review-section-label">
              Takeaway / Reflection <span className="label-sub">(optional)</span>
            </label>
            <input
              id="session-reflection-input"
              type="text"
              className="review-note-input"
              placeholder="e.g. Mastered Section 4 recursion problems..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleFinish();
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="review-card-footer">
          <button type="button" className="btn-clean-ghost" onClick={onClose}>
            Skip Review
          </button>
          <button type="button" className="primary-pill-btn btn-save-review" onClick={handleFinish}>
            <Check size={16} /> Save & Log Progress
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
