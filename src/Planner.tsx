import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Edit2, X, Check, Eye } from 'lucide-react';
import FullCalendar, { type CalendarRef } from '@fullcalendar/react';
import dayGrid from '@fullcalendar/react/daygrid';
import timeGrid from '@fullcalendar/react/timegrid';
import interaction from '@fullcalendar/react/interaction';
import monarch from '@fullcalendar/react/themes/monarch';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/monarch/theme.css';
import HabitDay from './HabitDay';
import HabitWeek from './HabitWeek';
import { habitSummary } from './Today';
import { dayKey, type State, type Action, type Task, type FocusSession } from './domain';
import ItemDetailModal from './ItemDetailModal';

const colors: Record<string, string> = {
  study: '#8572aa',
  coding: '#428783',
  personal: '#bc715b',
  leisure: '#758c55',
};

export default function Planner({
  state,
  day,
  setDay,
  act,
  busy,
  tasks,
  onEdit,
  onNew,
  save,
}: {
  state: State;
  day: string;
  setDay: (d: string) => void;
  act: (a: Action, m?: string) => Promise<boolean | undefined>;
  busy: boolean;
  tasks: Task[];
  onEdit: (t: Task) => void;
  onNew: (day: string, start?: string) => void;
  save: (t: Task) => Promise<boolean>;
}) {
  const ref = useRef<CalendarRef>(null);
  const [view, setView] = useState('dayGridMonth');
  const [title, setTitle] = useState('');
  const [habitView, setHabitView] = useState<'day' | 'week'>('day');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inspectingSession, setInspectingSession] = useState<FocusSession | null>(null);
  const [inspectingTask, setInspectingTask] = useState<Task | null>(null);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  // Keyboard shortcut listener: Delete or Backspace to delete selected task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
          return;
        }
        if (selectedTaskId) {
          e.preventDefault();
          const targetTask = tasks.find((t) => t.id === selectedTaskId);
          void act({ type: 'task.delete', id: selectedTaskId }, `Deleted "${targetTask?.title || 'task'}"`);
          setSelectedTaskId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedTaskId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, tasks, act]);

  const events = useMemo(() => {
    const taskEvents = tasks
      .filter((t) => t.day)
      .map((t) => {
        const isSelected = t.id === selectedTaskId;
        return {
          id: t.id,
          title: t.title,
          start: t.day + (t.start ? 'T' + t.start : ''),
          end: t.end ? t.day + 'T' + t.end : undefined,
          allDay: !t.start,
          backgroundColor: colors[t.category] || colors.personal,
          borderColor: isSelected ? 'var(--teal, #6366f1)' : 'transparent',
          classNames: [
            ...(t.done ? ['task-complete'] : []),
            ...(isSelected ? ['planner-event-selected'] : []),
          ],
        };
      });

    const sessionEvents = (state.sessions || [])
      .filter((s) => s.started_utc)
      .map((s) => {
        const isBreak = s.mode === 'short_break' || s.mode === 'long_break';
        const activeMins = Math.round(s.active_seconds / 60);
        const spanMins = s.completed_utc
          ? Math.round((new Date(s.completed_utc).getTime() - new Date(s.started_utc).getTime()) / 60000)
          : activeMins;
        const pauseMins = s.break_seconds ? Math.round(s.break_seconds / 60) : Math.max(0, spanMins - activeMins);
        const pauseLabel = !isBreak && pauseMins >= 2 ? ` · ${pauseMins}m paused` : '';
        const title = (isBreak ? (s.mode === 'long_break' ? '🌴 ' : '☕ ') : '🔥 ') +
          (s.intention || (isBreak ? 'Break' : 'Focus Session')) +
          ` (${activeMins < 1 ? `${s.active_seconds}s` : `${activeMins}m`}${pauseLabel})`;
        const start = s.started_utc;
        const end = s.completed_utc || new Date(new Date(s.started_utc).getTime() + s.active_seconds * 1000).toISOString();

        return {
          id: 'session-' + s.id,
          title,
          start,
          end,
          allDay: false,
          backgroundColor: isBreak ? '#0ea5e9' : '#f59e0b',
          borderColor: 'transparent',
          classNames: ['planner-session-event', isBreak ? 'session-event-break' : 'session-event-focus'],
        };
      });

    return [...taskEvents, ...sessionEvents];
  }, [tasks, selectedTaskId, state.sessions]);

  return (
    <>
      <div className="planner-layout">
        <section className="calendar-paper">
          <div className="calendar-toolbar">
            <div>
              <button
                className="icon-button"
                aria-label="Previous period"
                onClick={() => ref.current?.getApi().prev()}
              >
                <ChevronLeft />
              </button>
              <button
                className="icon-button"
                aria-label="Next period"
                onClick={() => ref.current?.getApi().next()}
              >
                <ChevronRight />
              </button>
              <h2>{title}</h2>
              <button
                onClick={() => {
                  setDay(dayKey());
                  ref.current?.getApi().today();
                }}
              >
                Today
              </button>
            </div>
            <div className="segments">
              {[
                ['Day', 'timeGridDay'],
                ['Week', 'timeGridWeek'],
                ['Month', 'dayGridMonth'],
              ].map(([name, key]) => (
                <button
                  key={key}
                  aria-pressed={view === key}
                  onClick={() => {
                    setView(key);
                    ref.current?.getApi().changeView(key, day);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Task Action Bar */}
          {selectedTask && (
            <div className="planner-selected-bar">
              <div className="selected-bar-left">
                <span
                  className="selected-bar-tag"
                  style={{ background: colors[selectedTask.category] || colors.personal }}
                />
                <div className="selected-bar-text">
                  <span className="selected-bar-title">{selectedTask.title}</span>
                  {selectedTask.start && (
                    <span className="selected-bar-meta">
                      {selectedTask.start}
                      {selectedTask.end ? ` – ${selectedTask.end}` : ''}
                    </span>
                  )}
                </div>
                <span className="selected-bar-hint">
                  Press <kbd>Del</kbd> to delete
                </span>
              </div>
              <div className="selected-bar-actions">
                <button
                  type="button"
                  className="btn-bar-action btn-bar-details"
                  onClick={() => setInspectingTask(selectedTask)}
                  title="View full task details"
                >
                  <Eye size={13} /> Details
                </button>
                <button
                  type="button"
                  className="btn-bar-action btn-bar-edit"
                  onClick={() => onEdit(selectedTask)}
                  title="Edit task"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  type="button"
                  className="btn-bar-action btn-bar-delete"
                  onClick={async () => {
                    await act({ type: 'task.delete', id: selectedTask.id }, `Deleted "${selectedTask.title}"`);
                    setSelectedTaskId(null);
                  }}
                  title="Delete task (or press Delete key)"
                >
                  <Trash2 size={13} /> Delete
                </button>
                <button
                  type="button"
                  className="btn-bar-close"
                  onClick={() => setSelectedTaskId(null)}
                  title="Deselect (Esc)"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <FullCalendar
            ref={ref}
            plugins={[monarch, dayGrid, timeGrid, interaction]}
            initialView="dayGridMonth"
            initialDate={day}
            headerToolbar={false}
            firstDay={1}
            height={580}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime="08:00:00"
            allDaySlot={true}
            nowIndicator={true}
            editable={true}
            selectable={true}
            events={events}
            datesSet={(info) => {
              setTitle(info.view.title);
              if (info.view.type === 'timeGridDay') setDay(dayKey(info.view.currentStart));
            }}
            dayCellTopContent={(info) => {
              const d = dayKey(info.date);
              const h = habitSummary(state, d);
              return (
                <div
                  className={`cal-day-cell-top ${d === day ? 'is-selected-day' : ''} ${
                    d === dayKey() ? 'is-today-day' : ''
                  }`}
                >
                  <span className="cal-day-number">{info.dayNumberText}</span>
                  {h.total > 0 && h.done > 0 ? (
                    <span
                      className={`cal-habits-badge ${h.done === h.total ? 'all-done' : ''}`}
                      title={`${h.done} of ${h.total} habits completed`}
                    >
                      {h.done === h.total && <Check size={10} strokeWidth={3} />}
                      <span>
                        {h.done}/{h.total}
                      </span>
                    </span>
                  ) : null}
                </div>
              );
            }}
            dateClick={(info) => {
              setSelectedTaskId(null);
              setDay(info.dateStr.slice(0, 10));
              if (!info.allDay) onNew(info.dateStr.slice(0, 10), info.dateStr.slice(11, 16));
            }}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              if (info.event.id.startsWith('session-')) {
                const rawId = info.event.id.replace('session-', '');
                const session = (state.sessions || []).find((s) => String(s.id) === rawId);
                if (session) {
                  setInspectingSession(session);
                  return;
                }
              }
              const t = tasks.find((item) => item.id === info.event.id);
              if (!t) return;
              setSelectedTaskId(t.id);
              setInspectingTask(t);
            }}
            eventDrop={(info) => {
              const t = tasks.find((item) => item.id === info.event.id);
              if (t)
                void save({
                  ...t,
                  day: info.event.startStr.slice(0, 10),
                  start: info.event.allDay ? '' : info.event.startStr.slice(11, 16),
                  end: info.event.allDay ? '' : info.event.endStr.slice(11, 16),
                }).then((ok) => {
                  if (!ok) info.revert();
                });
            }}
            eventResize={(info) => {
              const t = tasks.find((item) => item.id === info.event.id);
              if (t)
                void save({
                  ...t,
                  end: info.event.endStr.slice(11, 16),
                }).then((ok) => {
                  if (!ok) info.revert();
                });
            }}
          />
        </section>

        <section className="calendar-checkin">
          <div className="habit-view-switch" role="group" aria-label="Habit view">
            <button aria-pressed={habitView === 'day'} onClick={() => setHabitView('day')}>
              Day
            </button>
            <button aria-pressed={habitView === 'week'} onClick={() => setHabitView('week')}>
              Week
            </button>
          </div>
          <div className="section-title">
            <div>
              <p className="eyebrow">SELECTED DAY</p>
              <h2>
                {new Date(day + 'T12:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h2>
            </div>
            <button onClick={() => onNew(day)}>+ Add intention</button>
          </div>
          {habitView === 'day' ? (
            <HabitDay compact habits={state.habits} day={day} act={act} busy={busy} state={state} />
          ) : (
            <HabitWeek
              compact
              habits={state.habits}
              day={day}
              setDay={setDay}
              act={act}
              busy={busy}
              state={state}
            />
          )}
        </section>
      </div>

      <ItemDetailModal
        session={inspectingSession}
        task={inspectingTask}
        allTasks={tasks}
        allSessions={state.sessions}
        onClose={() => {
          setInspectingSession(null);
          setInspectingTask(null);
        }}
        onEditTask={(t) => {
          setInspectingTask(null);
          onEdit(t);
        }}
        onToggleTask={async (t) => {
          const nextDone = !t.done;
          await act({ type: 'task.toggle', id: t.id, done: nextDone }, nextDone ? `Completed "${t.title}"` : `Reopened "${t.title}"`);
          setInspectingTask((prev) => (prev ? { ...prev, done: nextDone } : null));
        }}
        onDeleteTask={async (id) => {
          const t = tasks.find((x) => x.id === id);
          await act({ type: 'task.delete', id }, `Deleted "${t?.title || 'task'}"`);
          setInspectingTask(null);
          setSelectedTaskId(null);
        }}
        onSelectTask={(t) => {
          setInspectingSession(null);
          setInspectingTask(t);
        }}
      />
    </>
  );
}
