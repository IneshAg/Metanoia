import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen, Search, X, Check, Loader2, Sparkles, ExternalLink,
  ChevronRight, Award, BookmarkCheck, ArrowRight, BookMarked,
  Info, RefreshCw
} from 'lucide-react';
import {
  searchBooksInNotion,
  updateBookProgressInNotion,
  type NotionBook,
  LIBRARY_DB_ID,
} from './notionSync';
import { openExternal } from './external';
import type { Action } from './domain';

interface ReadingLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: string;
  act: (action: Action, message?: string) => Promise<boolean | undefined | void>;
  initialHabitName?: string;
}

export default function ReadingLogModal({
  isOpen,
  onClose,
  day,
  act,
  initialHabitName = 'Reading',
}: ReadingLogModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [books, setBooks] = useState<NotionBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<NotionBook | null>(null);
  const [newPage, setNewPage] = useState<number>(0);
  const [showInspector, setShowInspector] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial books (Currently Reading / In progress) when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSuccessMessage('');
    setErrorMessage('');
    setQuery('');

    let isMounted = true;
    setLoading(true);

    searchBooksInNotion('')
      .then((results) => {
        if (!isMounted) return;
        setBooks(results);

        // Preselect either remembered book or first reading book
        const lastBookId = localStorage.getItem('metanoia-last-book-id');
        const remembered = results.find((b) => b.id === lastBookId);
        const currentlyReading = results.find((b) => b.status === 'Reading');
        const initial = remembered || currentlyReading || results[0] || null;

        setSelectedBook(initial);
        if (initial) {
          setNewPage(initial.currentPage || 0);
        }
      })
      .catch((err) => {
        if (isMounted) setErrorMessage('Could not load books from Notion Library.');
        console.error(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle Search Input debounced
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      searchBooksInNotion(val)
        .then((results) => {
          setBooks(results);
          // If searching and selected book is not in results, select the first match
          if (val.trim() && results.length > 0) {
            setSelectedBook(results[0]);
            setNewPage(results[0].currentPage || 0);
          }
        })
        .catch((err) => {
          console.error(err);
          setErrorMessage('Search error querying Notion.');
        })
        .finally(() => setLoading(false));
    }, 350);
  };

  const handleSelectBook = (book: NotionBook) => {
    setSelectedBook(book);
    setNewPage(book.currentPage || 0);
    setSuccessMessage('');
  };

  const applyIncrement = (inc: number) => {
    if (!selectedBook) return;
    const base = newPage > 0 ? newPage : (selectedBook.currentPage || 0);
    const target = base + inc;
    const max = selectedBook.totalPages > 0 ? selectedBook.totalPages : 9999;
    setNewPage(Math.min(target, max));
  };

  const handleFinishBook = () => {
    if (!selectedBook) return;
    const total = selectedBook.totalPages > 0 ? selectedBook.totalPages : (selectedBook.currentPage || 1);
    setNewPage(total);
  };

  // Save Progress & Sync to Notion + Check Habit
  const handleSaveAndSync = async () => {
    if (!selectedBook) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const isFinishing = Boolean(
        (selectedBook.totalPages > 0 && newPage >= selectedBook.totalPages) ||
        selectedBook.status === 'Read'
      );

      // 1. Sync to Notion Library Database
      const updated = await updateBookProgressInNotion(selectedBook.id, newPage, {
        markFinished: isFinishing,
        totalPages: selectedBook.totalPages,
      });

      if (!updated) {
        throw new Error('Notion update request failed');
      }

      // Remember last read book ID locally
      try {
        localStorage.setItem('metanoia-last-book-id', selectedBook.id);
      } catch {}

      // 2. Mark Habit as completed for today
      await act(
        { type: 'habit.set', day, name: initialHabitName, done: true },
        `Reading logged: "${selectedBook.title}" (Page ${newPage})`
      );

      setSuccessMessage(`✅ Page ${newPage} saved to Notion & ${initialHabitName} checked!`);

      // Update local selected book state
      setSelectedBook({
        ...selectedBook,
        currentPage: newPage,
        status: isFinishing ? 'Read' : 'Reading',
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setErrorMessage('Could not update Notion. Please check your network connection.');
    } finally {
      setSaving(false);
    }
  };

  // Quick bypass: mark habit without logging pages
  const handleMarkHabitOnly = async () => {
    await act(
      { type: 'habit.set', day, name: initialHabitName, done: true },
      `${initialHabitName} checked for today!`
    );
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const currentOriginalPage = selectedBook?.currentPage || 0;
  const pagesReadToday = Math.max(0, newPage - currentOriginalPage);
  const totalPages = selectedBook?.totalPages || 0;
  const progressPercent = totalPages > 0 ? Math.min(100, Math.round((newPage / totalPages) * 100)) : 0;

  return createPortal(
    <div className="reading-modal-backdrop" onClick={onClose}>
      <div
        className="reading-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-modal-title"
      >
        {/* Header */}
        <div className="reading-modal-header">
          <div className="reading-modal-title-wrap">
            <span className="reading-badge-live">
              <span className="live-dot-pulse" />
              Notion Connected
            </span>
            <h2 id="reading-modal-title">
              <BookOpen size={20} className="text-amber" />
              <span>Log Reading · Library</span>
            </h2>
          </div>
          <button
            type="button"
            className="reading-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Search Input */}
        <div className="reading-search-bar">
          <Search size={16} className="text-muted search-icon" />
          <input
            type="text"
            className="reading-search-input"
            placeholder="Search 900+ books in Notion by title (e.g. Red Rising, Habit)..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
          {loading && <Loader2 size={16} className="spin text-blue loading-indicator" />}
          {query && !loading && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => handleQueryChange('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status / Feedback Alerts */}
        {errorMessage && (
          <div className="reading-alert alert-error" role="alert">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="reading-alert alert-success" role="status">
            {successMessage}
          </div>
        )}

        {/* Main Content Layout: Active Book + Search Results */}
        <div className="reading-modal-body">
          {/* Active Book Highlight */}
          {selectedBook ? (
            <div className="reading-active-book-card">
              <div className="reading-book-top-row">
                <div className="reading-book-info">
                  <div className="reading-status-chip-row">
                    <span className={`book-status-pill status-${selectedBook.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedBook.status === 'Reading' && '📖 Reading'}
                      {selectedBook.status === 'Read' && '✅ Finished'}
                      {selectedBook.status === 'To read' && '⏳ To Read'}
                      {!['Reading', 'Read', 'To read'].includes(selectedBook.status) && selectedBook.status}
                    </span>
                    {totalPages > 0 && (
                      <span className="book-pct-badge">{progressPercent}% complete</span>
                    )}
                  </div>
                  <h3 className="reading-book-title">{selectedBook.title}</h3>
                  {selectedBook.summary && (
                    <p className="reading-book-summary">{selectedBook.summary}</p>
                  )}
                </div>

                {selectedBook.notionUrl && (
                  <button
                    type="button"
                    className="reading-notion-link-btn"
                    onClick={() => void openExternal(selectedBook.notionUrl!)}
                    title="Open book in Notion desktop/web"
                  >
                    <span>Notion</span>
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div className="reading-progress-track">
                <div
                  className="reading-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Page Tracker Control */}
              <div className="reading-page-control-box">
                <div className="reading-page-input-row">
                  <div className="reading-input-wrap">
                    <label htmlFor="reading-page-input">Page Reached:</label>
                    <div className="reading-input-inner">
                      <input
                        id="reading-page-input"
                        type="number"
                        min="0"
                        max={totalPages || 9999}
                        value={newPage}
                        onChange={(e) => setNewPage(parseInt(e.target.value, 10) || 0)}
                        className="reading-page-number-input"
                      />
                      {totalPages > 0 && (
                        <span className="reading-total-pages-label">/ {totalPages}</span>
                      )}
                    </div>
                  </div>

                  {pagesReadToday > 0 && (
                    <div className="reading-diff-chip">
                      <Sparkles size={13} className="text-amber" />
                      <strong>+{pagesReadToday} pages read today!</strong>
                    </div>
                  )}
                </div>

                {/* Quick Increment Buttons */}
                <div className="reading-increments-row">
                  <span className="stepper-label">Quick adds:</span>
                  <button type="button" className="stepper-btn" onClick={() => applyIncrement(5)}>
                    +5
                  </button>
                  <button type="button" className="stepper-btn" onClick={() => applyIncrement(10)}>
                    +10
                  </button>
                  <button type="button" className="stepper-btn" onClick={() => applyIncrement(25)}>
                    +25
                  </button>
                  <button type="button" className="stepper-btn" onClick={() => applyIncrement(50)}>
                    +50
                  </button>
                  <button
                    type="button"
                    className="stepper-btn finish-btn"
                    onClick={handleFinishBook}
                    title="Mark entire book complete"
                  >
                    <Award size={13} />
                    <span>Finished</span>
                  </button>
                </div>
              </div>

              {/* Notion DB Live Schema Inspector Toggle */}
              <div className="reading-inspector-toggle-row">
                <button
                  type="button"
                  className="btn-inspect-notion"
                  onClick={() => setShowInspector(!showInspector)}
                >
                  <Info size={13} />
                  <span>{showInspector ? 'Hide Notion DB Properties' : 'Inspect Notion DB Properties'}</span>
                </button>
              </div>

              {showInspector && (
                <div className="reading-inspector-panel">
                  <div className="inspector-grid">
                    <div className="inspector-item">
                      <span className="label">Notion Page ID:</span>
                      <code>{selectedBook.id}</code>
                    </div>
                    <div className="inspector-item">
                      <span className="label">Database:</span>
                      <span>Library (<code>{LIBRARY_DB_ID}</code>)</span>
                    </div>
                    <div className="inspector-item">
                      <span className="label">Title Property:</span>
                      <strong>{selectedBook.title}</strong>
                    </div>
                    <div className="inspector-item">
                      <span className="label">Pages - Where are you at:</span>
                      <code>{selectedBook.currentPage}</code> (updating to <code>{newPage}</code>)
                    </div>
                    <div className="inspector-item">
                      <span className="label">Pages - Total:</span>
                      <code>{selectedBook.totalPages || 'Not set'}</code>
                    </div>
                    <div className="inspector-item">
                      <span className="label">Reading - Status:</span>
                      <span className="badge">{selectedBook.status}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="reading-empty-prompt">
              <BookOpen size={28} className="text-muted" style={{ opacity: 0.7 }} />
              {loading ? (
                <p>Searching your 900+ Notion books in Library…</p>
              ) : (
                <>
                  <p><strong>No book selected yet.</strong> Select a book from your Library below or search above.</p>
                  <div className="manual-quick-log-row">
                    <button
                      type="button"
                      className="primary-pill-btn btn-sm"
                      onClick={handleMarkHabitOnly}
                    >
                      <BookmarkCheck size={13} /> Quick Check Read Today (+XP)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Book List / Shelf */}
          <div className="reading-shelf-section">
            <div className="shelf-header">
              <span className="shelf-title">
                {query.trim()
                  ? `Search Results in Notion (${books.length})`
                  : 'Currently Reading & Recent Reads in Notion'}
              </span>
              <small className="shelf-sub">Click any book to select</small>
            </div>

            <div className="reading-books-list">
              {books.map((b) => {
                const isSelected = selectedBook?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`reading-book-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectBook(b)}
                  >
                    <BookMarked size={16} className={isSelected ? 'text-blue' : 'text-muted'} />
                    <div className="book-item-info">
                      <strong className="book-item-title">{b.title}</strong>
                      <span className="book-item-meta">
                        {b.status} · Page {b.currentPage || 0}
                        {b.totalPages > 0 ? ` / ${b.totalPages}` : ''}
                      </span>
                    </div>
                    {isSelected && <Check size={16} className="text-emerald check-icon" />}
                  </button>
                );
              })}

              {!loading && books.length === 0 && (
                <div className="no-books-found">
                  <p>No books found in Notion matching "{query}".</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="reading-modal-footer">
          <button
            type="button"
            className="btn-mark-habit-only"
            onClick={handleMarkHabitOnly}
            title="Check the habit without changing page counts in Notion"
          >
            <BookmarkCheck size={14} />
            <span>Check Read Today without logging pages</span>
          </button>

          <div className="footer-right-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-save-sync"
              onClick={handleSaveAndSync}
              disabled={!selectedBook || saving}
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>Syncing to Notion…</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Save &amp; Sync to Notion</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
