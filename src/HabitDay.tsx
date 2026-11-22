import { useState } from 'react';
import { Check, Sparkles, Settings2, Plus, BookOpen } from 'lucide-react';
import { getHabitDefs, type State, type Action } from './domain';
import HabitModal from './HabitModal';
import ReadingLogModal from './ReadingLogModal';

type Props = {
  habits: State['habits'];
  day: string;
  act: (a: Action, message?: string) => Promise<boolean | undefined>;
  busy: boolean;
  state?: State;
  onManage?: () => void;
  compact?: boolean;
};

export function habitNames(habits: State['habits'], state?: State, day?: string) {
  if (state) {
    const dayOfWeek = day ? new Date(day + 'T12:00:00+05:30').getDay() : null;
    const defs = getHabitDefs(state).filter(h => !h.archived);
    if (dayOfWeek !== null) {
      const scheduled = defs.filter(h => !h.scheduledDays || h.scheduledDays.includes(dayOfWeek));
      if (scheduled.length) return scheduled.map(h => h.name);
    }
    if (defs.length) return defs.map(h => h.name);
  }
  return Object.keys([...habits].sort((a, b) => b.day.localeCompare(a.day))[0]?.checks || {});
}

export default function HabitDay({ habits, day, act, busy, state, onManage, compact }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [activeReadingHabit, setActiveReadingHabit] = useState('Reading');
  const names = habitNames(habits, state, day);
  const record = habits.find(h => h.day === day);
  const done = names.filter(name => record?.checks[name]).length;
  const dayLabel = new Date(day + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const handleOpenManage = () => {
    if (onManage) onManage();
    else setShowModal(true);
  };

  return (
    <>
      <section className={`daily-rituals ${compact ? 'compact-rituals' : ''}`} aria-label={`Habits for ${dayLabel}`}>
        <div className="ritual-heading">
          <div>
            <span className="eyebrow"><Sparkles size={14} className="text-amber"/> DAILY RHYTHM</span>
            <h3>Daily Habits</h3>
          </div>
          <div className="ritual-head-right">
            <strong>{done}<span> / {names.length}</span></strong>
            <button 
              type="button" 
              className="manage-habits-btn" 
              onClick={handleOpenManage}
              title="Manage habits & scheduled days"
            >
              <Settings2 size={13}/>
              <span>Manage</span>
            </button>
          </div>
        </div>

        <div className="ritual-progress" role="progressbar" aria-label="Daily habit progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={names.length}>
          <i style={{ width: `${names.length ? (done / names.length) * 100 : 0}%` }}/>
        </div>

        {!compact && (
          <p className="ritual-prompt">
            {done === names.length && names.length
              ? '🎉 All habits checked for today!'
              : done
              ? 'Keep the momentum going!'
              : 'Tap any habit to complete it today.'}
          </p>
        )}

        <div className="ritual-list">
          {names.map((name, index) => {
            const checked = !!record?.checks[name];
            const isReading = name.toLowerCase().includes('read');

            return (
              <button 
                key={name} 
                type="button"
                className={'ritual-item ' + (checked ? 'ritual-done' : '') + (isReading ? ' ritual-reading-item' : '')} 
                role="checkbox" 
                aria-checked={checked} 
                aria-label={`${name}, ${checked ? 'done' : 'not done'} on ${dayLabel}`} 
                disabled={busy} 
                onClick={() => {
                  if (isReading) {
                    setActiveReadingHabit(name);
                    setShowReadingModal(true);
                  } else {
                    void act({ type: 'habit.set', day, name, done: !checked }, 'Habit check-in saved');
                  }
                }}
              >
                <span className="ritual-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="ritual-name">
                  {name}
                  {isReading && (
                    <span className="reading-habit-tag" title="Click to search Notion Library & log pages">
                      <BookOpen size={11} />
                      <span>Library</span>
                    </span>
                  )}
                </span>
                <span
                  className="ritual-check"
                  onClick={(e) => {
                    e.stopPropagation();
                    void act({ type: 'habit.set', day, name, done: !checked }, 'Habit check-in saved');
                  }}
                  title={checked ? 'Mark not done' : 'Mark done'}
                >
                  {checked && <Check size={16} strokeWidth={2.8}/>}
                </span>
              </button>
            );
          })}
        </div>

        {!names.length && (
          <div className="empty-habits-box">
            <p className="ritual-prompt">No habits scheduled for today.</p>
            <button type="button" className="primary-pill-btn btn-sm" onClick={handleOpenManage}>
              <Plus size={13}/> Add a Habit
            </button>
          </div>
        )}
      </section>

      {showModal && state && (
        <HabitModal
          state={state}
          act={act}
          busy={busy}
          onClose={() => setShowModal(false)}
        />
      )}

      {showReadingModal && (
        <ReadingLogModal
          isOpen={showReadingModal}
          onClose={() => setShowReadingModal(false)}
          day={day}
          act={act}
          initialHabitName={activeReadingHabit}
        />
      )}
    </>
  );
}
