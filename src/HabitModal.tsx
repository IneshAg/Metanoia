import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Archive, Check, RotateCcw, Calendar } from 'lucide-react';
import { getHabitDefs, type State, type Action, type HabitDef } from './domain';

const WEEKDAYS = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 0, label: 'S' },
];

export default function HabitModal({
  state,
  act,
  busy,
  onClose
}: {
  state: State;
  act: (action: Action, message?: string) => Promise<boolean | undefined>;
  busy: boolean;
  onClose: () => void;
}) {
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [editingHabit, setEditingHabit] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const defs = getHabitDefs(state);
  const activeHabits = defs.filter(h => !h.archived);
  const archivedHabits = defs.filter(h => h.archived);

  const toggleDay = (d: number) => {
    setSelectedDays(prev => 
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newHabitName.trim();
    if (!name) {
      setError('Please enter a habit name.');
      return;
    }
    setError('');
    const ok = await act({
      type: 'habit.add',
      name,
      scheduledDays: selectedDays.length ? selectedDays : [0, 1, 2, 3, 4, 5, 6]
    }, `Added habit "${name}"`);
    if (ok) {
      setNewHabitName('');
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const handleSaveRename = async (oldName: string) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingHabit(null);
      return;
    }
    setError('');
    const ok = await act({
      type: 'habit.rename',
      oldName,
      newName: trimmed
    }, `Renamed habit to "${trimmed}"`);
    if (ok) {
      setEditingHabit(null);
    }
  };

  const handleArchive = async (name: string) => {
    setError('');
    await act({ type: 'habit.archive', name }, `Archived habit "${name}"`);
  };

  const handleRestore = async (name: string) => {
    setError('');
    await act({ type: 'habit.restore', name }, `Restored habit "${name}"`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card habit-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h3>Manage Daily Habits</h3>
            <p className="page-sub">Define recurring rhythms, schedule weekdays, and archive past routines without losing history.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18}/>
          </button>
        </div>

        {/* Add Habit Form */}
        <form onSubmit={handleAddHabit} className="add-habit-deck">
          <div className="add-habit-input-row">
            <input 
              type="text" 
              placeholder="e.g. Morning Walk, Read 20 pages, Hydrate…"
              value={newHabitName}
              onChange={e => setNewHabitName(e.target.value)}
              className="modern-input"
              maxLength={80}
            />
            <button 
              type="submit" 
              className="primary-pill-btn" 
              disabled={busy || !newHabitName.trim()}
            >
              <Plus size={15}/> Add Habit
            </button>
          </div>

          <div className="habit-weekday-picker">
            <span className="weekday-picker-label"><Calendar size={13}/> Active days:</span>
            <div className="weekday-pill-group">
              {WEEKDAYS.map(({ day, label }) => {
                const active = selectedDays.includes(day);
                return (
                  <button 
                    key={day} 
                    type="button" 
                    className={`weekday-pill ${active ? 'active' : ''}`}
                    onClick={() => toggleDay(day)}
                    title={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {error && <p className="form-error">{error}</p>}

        {/* Active Habits List */}
        <div className="habits-list-section">
          <h4>Active Habits ({activeHabits.length})</h4>
          {activeHabits.length ? (
            <div className="habit-manager-list">
              {activeHabits.map((habit, index) => (
                <div key={habit.id || habit.name} className="habit-manager-row">
                  <span className="habit-row-index">{String(index + 1).padStart(2, '0')}</span>
                  
                  {editingHabit === habit.name ? (
                    <div className="habit-row-edit-wrap">
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)}
                        className="modern-input input-sm"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') void handleSaveRename(habit.name);
                          if (e.key === 'Escape') setEditingHabit(null);
                        }}
                      />
                      <button 
                        type="button" 
                        className="btn-pill-save" 
                        onClick={() => void handleSaveRename(habit.name)}
                      >
                        <Check size={14}/> Save
                      </button>
                      <button 
                        type="button" 
                        className="btn-clean-ghost" 
                        onClick={() => setEditingHabit(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="habit-row-details">
                      <strong className="habit-row-name">{habit.name}</strong>
                      <span className="habit-row-days">
                        {habit.scheduledDays && habit.scheduledDays.length < 7
                          ? habit.scheduledDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')
                          : 'Every day'}
                      </span>
                    </div>
                  )}

                  <div className="habit-row-actions">
                    {editingHabit !== habit.name && (
                      <button 
                        type="button" 
                        className="icon-btn-ghost" 
                        title="Rename habit"
                        onClick={() => {
                          setEditingHabit(habit.name);
                          setEditName(habit.name);
                        }}
                      >
                        <Edit2 size={14}/>
                      </button>
                    )}
                    <button 
                      type="button" 
                      className="icon-btn-ghost text-muted" 
                      title="Archive habit"
                      onClick={() => void handleArchive(habit.name)}
                    >
                      <Archive size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted empty-state-note">No active habits yet. Add a tiny routine above to get started!</p>
          )}
        </div>

        {/* Archived Habits Section */}
        {archivedHabits.length > 0 && (
          <div className="habits-list-section archived-habits-section">
            <h4>Archived Habits ({archivedHabits.length})</h4>
            <div className="habit-manager-list archived-list">
              {archivedHabits.map(habit => (
                <div key={habit.id || habit.name} className="habit-manager-row habit-archived-row">
                  <span className="habit-row-name text-muted">{habit.name}</span>
                  <button 
                    type="button" 
                    className="btn-pill-restore"
                    onClick={() => void handleRestore(habit.name)}
                    title="Restore habit to active routines"
                  >
                    <RotateCcw size={12}/> Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions-row">
          <button type="button" className="primary-pill-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
