import {useState,useMemo} from 'react';
import {motion} from 'motion/react';
import {dayKey,type State} from './domain';

interface Props {
  state: State;
  selectedDay: string;
  onSelectDay?: (day: string) => void;
}

export default function WeeklyPillChart({state, selectedDay, onSelectDay}: Props) {
  const [unit, setUnit] = useState<'hours'|'minutes'>('hours');

  // Compute 7 days of the current week (Monday to Sunday)
  const weekData = useMemo(() => {
    const sel = new Date(selectedDay + 'T12:00:00+05:30');
    const dayOfWeek = (sel.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const monday = new Date(sel);
    monday.setDate(monday.getDate() - dayOfWeek);

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + idx);
      const dateStr = dayKey(d);

      // Calculate total focused seconds + estimated completed task minutes for this day
      const sessions = state.sessions.filter(s => dayKey(new Date(s.started_utc)) === dateStr);
      const sessionSeconds = sessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);
      const tasks = state.tasks.filter(t => t.day === dateStr && t.done);
      const taskMinutes = tasks.reduce((acc, t) => acc + (t.minutes || 0), 0);
      
      const totalMinutes = Math.round(sessionSeconds / 60) + taskMinutes;
      const hours = Math.round((totalMinutes / 60) * 10) / 10;

      return {
        label,
        dateStr,
        hours,
        minutes: totalMinutes,
        isToday: dateStr === dayKey(),
        isSelected: dateStr === selectedDay,
      };
    });
  }, [state.sessions, state.tasks, selectedDay]);

  // Max value to scale pillars (minimum 4h so it looks good even on empty days)
  const maxHours = Math.max(4, ...weekData.map(d => d.hours));

  // Points for SVG wavy line across columns
  const svgWidth = 560;
  const svgHeight = 160;
  const colSpacing = svgWidth / 7;

  const points = weekData.map((d, i) => {
    const x = i * colSpacing + colSpacing / 2;
    // Map hours to y coordinate (higher hours = smaller y)
    const normalized = Math.min(1, Math.max(0.1, d.hours / maxHours));
    const y = svgHeight - normalized * (svgHeight - 40) - 20;
    return {x, y};
  });

  // Build a smooth cubic bezier SVG path
  const curvePath = useMemo(() => {
    if (points.length < 2) return '';
    let p = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cpX = (curr.x + next.x) / 2;
      p += ` C ${cpX} ${curr.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
    }
    return p;
  }, [points]);

  return (
    <div className="pill-chart-card">
      <div className="pill-chart-head">
        <div>
          <span className="pill-chart-eyebrow">WEEKLY ACTIVITY</span>
          <h3 className="pill-chart-title">Time invested</h3>
        </div>
        <div className="pill-chart-toggle" role="group" aria-label="Time display unit">
          <span className="pill-chart-toggle-label">Track time</span>
          <div className="pill-switch">
            <button
              type="button"
              className={unit === 'hours' ? 'active' : ''}
              onClick={() => setUnit('hours')}
            >
              hours
            </button>
            <button
              type="button"
              className={unit === 'minutes' ? 'active' : ''}
              onClick={() => setUnit('minutes')}
            >
              minutes
            </button>
          </div>
        </div>
      </div>

      <div className="pill-chart-stage">
        {/* SVG Wavy Trend Line */}
        <svg className="pill-chart-curve" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#84CC16" />
            </linearGradient>
          </defs>
          <motion.path
            d={curvePath}
            fill="none"
            stroke="url(#curveGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{pathLength: 0}}
            animate={{pathLength: 1}}
            transition={{duration: 0.8, ease: 'easeOut'}}
          />
        </svg>

        {/* Columns for Mon - Sun */}
        <div className="pill-chart-columns">
          {weekData.map((day, idx) => {
            const pillCount = Math.max(1, Math.min(5, Math.ceil(day.hours / 2) || 1));
            const filledCount = day.hours > 0 ? Math.max(1, Math.min(5, Math.round(day.hours / 1.5))) : 0;
            const displayValue = unit === 'hours' 
              ? `${day.hours}h` 
              : `${day.minutes}m`;

            return (
              <button
                key={day.label}
                type="button"
                className={`pill-col ${day.isSelected ? 'selected' : ''} ${day.isToday ? 'today' : ''}`}
                onClick={() => onSelectDay?.(day.dateStr)}
                title={`${day.label} (${day.dateStr}): ${displayValue}`}
              >
                <span className="pill-day-label">{day.label}</span>

                <div className="pill-stack-wrap">
                  {/* Floating top badge */}
                  <span className={`pill-badge ${day.hours > 0 ? 'filled' : 'empty'}`}>
                    {day.hours > 0 ? displayValue : '—'}
                  </span>

                  {/* Vertical stack of pill capsules */}
                  <div className="pill-capsules">
                    {Array.from({length: 4}, (_, i) => {
                      // Bottom-up filling
                      const isFilled = i < filledCount;
                      return (
                        <span
                          key={i}
                          className={`capsule ${isFilled ? 'filled' : 'ghost'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
