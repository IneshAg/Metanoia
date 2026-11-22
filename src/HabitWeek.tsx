import { Check, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { shiftDay, dayKey, type State, type Action } from './domain';
import { habitNames } from './HabitDay';

interface HabitWeekProps {
  habits: State['habits'];
  day: string;
  setDay: (day: string) => void;
  act: (a: Action, message?: string) => Promise<boolean | undefined | void>;
  busy: boolean;
  compact?: boolean;
  state?: State;
}

export default function HabitWeek({
  habits,
  day,
  setDay,
  act,
  busy,
  compact = false,
  state,
}: HabitWeekProps) {
  // Start Monday of the chosen day's week
  const dayDate = new Date(day + 'T12:00:00');
  const dayOfWeek = (dayDate.getDay() + 6) % 7; // Monday = 0
  const start = shiftDay(day, -dayOfWeek);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const names = habitNames(habits, state, day);
  const today = dayKey();

  const countForDate = (date: string) => {
    const record = habits.find((h) => h.day === date);
    return names.filter((name) => record?.checks[name]).length;
  };

  const totalPossible = days.length * names.length;
  const totalDone = days.reduce((acc, d) => acc + countForDate(d), 0);
  const pct = totalPossible ? Math.round((totalDone / totalPossible) * 100) : 0;

  // Format week range e.g. "16 Nov – 22 Nov"
  const startD = new Date(days[0] + 'T12:00:00');
  const endD = new Date(days[6] + 'T12:00:00');
  const weekRangeLabel = `${startD.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })} – ${endD.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })}`;

  return (
    <section className="habit-week-wrapper" aria-label="Weekly habit tracker">
      {/* 1. Week Controls & Progress */}
      <div className="habit-week-header-bar">
        <div className="week-nav-controls">
          <button
            type="button"
            className="week-arrow-btn"
            aria-label="Previous habit week"
            onClick={() => setDay(shiftDay(day, -7))}
            title="Previous week"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="week-range-info">
            <span className="week-range-text">{weekRangeLabel}</span>
            <span className="week-stats-pill">
              {totalDone}/{totalPossible} checks ({pct}%)
            </span>
          </div>

          <button
            type="button"
            className="week-arrow-btn"
            aria-label="Next habit week"
            onClick={() => setDay(shiftDay(day, 7))}
            title="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {day !== today && (
          <button
            type="button"
            className="week-today-pill"
            onClick={() => setDay(today)}
            title="Jump to today"
          >
            <Calendar size={12} />
            <span>Today</span>
          </button>
        )}
      </div>

      {/* Week Progress Bar */}
      <div
        className="habit-week-progress-track"
        role="progressbar"
        aria-valuenow={totalDone}
        aria-valuemin={0}
        aria-valuemax={totalPossible}
      >
        <div
          className="habit-week-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 2. Habits Weekly Matrix Table */}
      <div className="habit-week-table-scroll">
        <table className="habit-week-table">
          <thead>
            <tr>
              <th className="th-habit-name">HABIT</th>
              {days.map((dateStr) => {
                const isSelected = dateStr === day;
                const isTodayDate = dateStr === today;
                const dObj = new Date(dateStr + 'T12:00:00');
                const weekdayShort = dObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                });
                const dayNumber = Number(dateStr.slice(8));
                const dayDoneCount = countForDate(dateStr);

                return (
                  <th
                    key={dateStr}
                    className={`th-day-col ${isSelected ? 'col-selected' : ''} ${isTodayDate ? 'col-today' : ''}`}
                    onClick={() => setDay(dateStr)}
                    title={`Select ${weekdayShort}, ${dayNumber}`}
                  >
                    <div className="day-header-pill">
                      <span className="day-header-dow">{weekdayShort}</span>
                      <strong className="day-header-num">{dayNumber}</strong>
                      <small className="day-header-ratio">
                        {dayDoneCount}/{names.length}
                      </small>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {names.map((name, index) => {
              const habitWeekDone = days.filter(
                (d) => !!habits.find((h) => h.day === d)?.checks[name]
              ).length;

              return (
                <tr key={name} className="habit-matrix-row">
                  <td className="td-habit-label" title={name}>
                    <div className="habit-label-content">
                      <span className="habit-num-tag">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="habit-title-text">{name}</span>
                      <span className="habit-week-ratio-tag">
                        {habitWeekDone}/7
                      </span>
                    </div>
                  </td>

                  {days.map((dateStr) => {
                    const isSelected = dateStr === day;
                    const isTodayDate = dateStr === today;
                    const checked = !!habits.find((h) => h.day === dateStr)
                      ?.checks[name];

                    return (
                      <td
                        key={dateStr}
                        className={`td-habit-cell ${isSelected ? 'col-selected' : ''} ${isTodayDate ? 'col-today' : ''}`}
                      >
                        <button
                          type="button"
                          className={`habit-matrix-check-btn ${checked ? 'is-done' : ''}`}
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={`${name} on ${dateStr}: ${checked ? 'done' : 'not done'}`}
                          disabled={busy}
                          onClick={() =>
                            void act(
                              {
                                type: 'habit.set',
                                day: dateStr,
                                name,
                                done: !checked,
                              },
                              'Habit check-in saved'
                            )
                          }
                        >
                          {checked && (
                            <Check
                              size={14}
                              strokeWidth={3}
                              className="check-svg"
                            />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!names.length && (
        <div className="habit-week-empty">
          <p>No habits scheduled for this week.</p>
        </div>
      )}
    </section>
  );
}
