import { useState, useRef, useEffect } from 'react';
import { CloudRain, Sun, Snowflake, Wind, CloudSun, ChevronDown, EyeOff, Check } from 'lucide-react';
import type { WeatherMood } from './domain';

export const WEATHER_DETAILS: Record<WeatherMood, {
  label: string;
  temp: string;
  sub: string;
  icon: typeof CloudSun | typeof EyeOff;
  emoji: string;
  colorClass: string;
}> = {
  rain: {
    label: 'Slow & Calm Rain',
    temp: '18°C',
    sub: 'Slow & Calm Rain',
    icon: CloudRain,
    emoji: '🌧️',
    colorClass: 'weather-icon-rain',
  },
  autumn: {
    label: 'Autumn Fall',
    temp: '16°C',
    sub: 'Autumn Breeze',
    icon: Wind,
    emoji: '🍂',
    colorClass: 'weather-icon-autumn',
  },
  breezy: {
    label: 'Crisp & Focused',
    temp: '24°C',
    sub: 'Crisp & Focused',
    icon: CloudSun,
    emoji: '⛅',
    colorClass: 'weather-icon-breezy',
  },
  sunny: {
    label: 'Sunny Day',
    temp: '27°C',
    sub: 'Warm & Bright',
    icon: Sun,
    emoji: '☀️',
    colorClass: 'weather-icon-sunny',
  },
  snow: {
    label: 'Peaceful Snow',
    temp: '1°C',
    sub: 'Crisp Frost',
    icon: Snowflake,
    emoji: '❄️',
    colorClass: 'weather-icon-snow',
  },
  none: {
    label: 'None / Off',
    temp: 'Off',
    sub: 'Clean & Static',
    icon: EyeOff,
    emoji: '🚫',
    colorClass: 'weather-icon-none',
  },
};

const MOOD_KEYS: WeatherMood[] = ['rain', 'autumn', 'breezy', 'sunny', 'snow', 'none'];

interface WeatherPillProps {
  mood?: WeatherMood;
  onSelectMood: (m: WeatherMood) => void;
  align?: 'left' | 'right';
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export default function WeatherPill({
  mood = 'rain',
  onSelectMood,
  align = 'right',
  isOpen,
  onToggle,
}: WeatherPillProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = isOpen !== undefined;
  const open = isControlled ? isOpen : internalOpen;

  const setOpen = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(open) : val;
    if (isControlled) {
      onToggle?.(nextVal);
    } else {
      setInternalOpen(nextVal);
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);

  const current = WEATHER_DETAILS[mood] || WEATHER_DETAILS.rain;
  const IconComponent = current.icon;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open]);

  const handleSelect = (k: WeatherMood) => {
    onSelectMood(k);
    setOpen(false);
  };

  return (
    <div
      className={`weather-pill-container align-${align}`}
      ref={containerRef}
    >
      <button
        type="button"
        className="hero-weather-pill interactive-weather-pill"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Click to change weather mood & ambient atmosphere"
        aria-expanded={open}
      >
        <IconComponent size={20} className={`weather-icon ${current.colorClass}`} />
        <div className="weather-text-wrap">
          <div className="weather-temp-row">
            <strong>{current.temp}</strong>
            <ChevronDown
              size={12}
              className={`weather-dropdown-arrow ${open ? 'rotated' : ''}`}
            />
          </div>
          <small>{current.sub}</small>
        </div>
      </button>

      {open && (
        <div
          className={`weather-mood-popover popover-${align}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="popover-heading">
            <span>Ambient Atmosphere</span>
            <small>Live background motion & theme</small>
          </div>
          <div className="weather-options-grid">
            {MOOD_KEYS.map((k) => {
              const item = WEATHER_DETAILS[k];
              const OptionIcon = item.icon;
              const isSelected = k === mood;
              return (
                <button
                  key={k}
                  type="button"
                  className={`weather-option-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(k)}
                >
                  <OptionIcon size={16} className={item.colorClass} />
                  <div className="weather-option-text">
                    <strong>
                      {item.emoji} {item.label}
                    </strong>
                    <small>
                      {item.temp} · {item.sub}
                    </small>
                  </div>
                  {isSelected ? (
                    <Check size={14} className="text-emerald" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
