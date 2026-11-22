/**
 * Focus V2 Gamification System
 * Video-game inspired progression with Crystal & Astral motifs (No fire branding).
 */

import { type State, type FocusSession, dayKey } from './domain';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  creditsReward: number;
  unlockedAt?: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_flow',
    title: 'First Spark',
    description: 'Completed your very first focus sprint.',
    icon: '💎',
    xpReward: 50,
    creditsReward: 10,
  },
  {
    id: 'deep_diver',
    title: 'Deep Diver',
    description: 'Completed an unbroken 60-minute Deep Focus session.',
    icon: '⚡',
    xpReward: 100,
    creditsReward: 20,
  },
  {
    id: 'marathon_scholar',
    title: 'Marathon Scholar',
    description: 'Completed an intensive 120-minute Extended Focus block.',
    icon: '🌌',
    xpReward: 250,
    creditsReward: 50,
  },
  {
    id: 'pomo_master',
    title: 'Pomodoro Grandmaster',
    description: 'Completed a full 4-round Pomodoro cycle with recovery breaks.',
    icon: '🍅',
    xpReward: 150,
    creditsReward: 30,
  },
  {
    id: 'shield_bearer',
    title: 'Aegis Guardian',
    description: 'Acquired or held an active Streak Shield.',
    icon: '🛡️',
    xpReward: 75,
    creditsReward: 15,
  },
  {
    id: 'astral_week',
    title: 'Astral Week',
    description: 'Maintained a 7-day continuous study rhythm.',
    icon: '⭐',
    xpReward: 300,
    creditsReward: 60,
  },
  {
    id: 'flow_centurion',
    title: 'Flow Centurion',
    description: 'Logged 100+ active focus minutes in a single day.',
    icon: '👑',
    xpReward: 120,
    creditsReward: 25,
  },
];

export interface StudyRank {
  name: string;
  level: number;
  minXp: number;
  badge: string;
  titleColor: string;
}

export const STUDY_RANKS: StudyRank[] = [
  { name: 'Apprentice Scholar', level: 1, minXp: 0, badge: '🌱', titleColor: '#10b981' },
  { name: 'Focus Adept', level: 2, minXp: 300, badge: '💎', titleColor: '#06b6d4' },
  { name: 'Chrono Knight', level: 3, minXp: 1000, badge: '⚡', titleColor: '#8b5cf6' },
  { name: 'Master of Flow', level: 4, minXp: 2500, badge: '⭐', titleColor: '#f59e0b' },
  { name: 'Astral Archmage', level: 5, minXp: 5000, badge: '🌌', titleColor: '#ec4899' },
];

export function getRank(xp: number): StudyRank {
  for (let i = STUDY_RANKS.length - 1; i >= 0; i--) {
    if (xp >= STUDY_RANKS[i].minXp) return STUDY_RANKS[i];
  }
  return STUDY_RANKS[0];
}

/**
 * Calculates current streak in days based on completed sessions or tasks,
 * using crystal branding instead of fire.
 */
export function calculateStreak(sessions: FocusSession[], todayStr = dayKey(new Date())): {
  streakDays: number;
  isActiveToday: boolean;
  activeDates: Set<string>;
} {
  const activeDates = new Set<string>();
  for (const s of sessions) {
    if (s.state === 'complete' && s.started_utc && (s.active_seconds || 0) >= 300) {
      try {
        const d = dayKey(new Date(s.started_utc));
        activeDates.add(d);
      } catch {}
    }
  }

  const isActiveToday = activeDates.has(todayStr);

  let streakDays = 0;
  const cur = new Date();
  if (!isActiveToday) {
    // If not active yet today, check yesterday
    cur.setDate(cur.getDate() - 1);
  }

  while (true) {
    const k = dayKey(cur);
    if (activeDates.has(k)) {
      streakDays++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  return { streakDays, isActiveToday, activeDates };
}
