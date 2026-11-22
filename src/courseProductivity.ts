/**
 * Course Productivity Intelligence
 * 
 * Calculates actual focus time versus unique video content completed,
 * effective processing rate (playback speed & comprehension), and estimated
 * remaining study time without double counting.
 */

import { type State, type Course, type Lesson, type FocusSession } from './domain';

export interface CourseProductivity {
  courseId: string;
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  totalVideoSeconds: number;
  completedVideoSeconds: number;
  remainingVideoSeconds: number;
  focusedSecondsOnCourse: number;
  effectiveProcessingRate: number; // e.g. 1.25 for 1.25x effective speed
  estimatedRemainingStudySeconds: number;
  estimatedRemainingStudyHours: number;
  completionPercentage: number;
}

export function computeCourseProductivity(state: State, courseId: string): CourseProductivity | null {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return null;

  const lessons = state.lessons.filter(l => l.courseId === courseId);
  const totalLessons = lessons.length || course.total || 0;
  const completedLessons = lessons.filter(l => l.completed).length;

  // Video durations
  let totalVideoSeconds = 0;
  let completedVideoSeconds = 0;

  for (const l of lessons) {
    const sec = l.durationSeconds || (course.minutesPerLesson ? course.minutesPerLesson * 60 : 900);
    totalVideoSeconds += sec;
    if (l.completed) {
      completedVideoSeconds += sec;
    }
  }

  const remainingVideoSeconds = Math.max(0, totalVideoSeconds - completedVideoSeconds);

  // Focus time linked to this course
  const courseSessions = (state.sessions || []).filter(
    s => s.courseId === courseId || (s.taskId && state.tasks.find(t => t.id === s.taskId)?.courseId === courseId)
  );

  const focusedSecondsOnCourse = courseSessions.reduce((acc, s) => acc + (s.active_seconds || 0), 0);

  // Calculate effective processing rate
  // If user has focused time, rate = completedVideoSeconds / focusedSecondsOnCourse
  // Otherwise fallback to average playback speed of completed lessons
  let effectiveProcessingRate = 1.0;
  if (focusedSecondsOnCourse > 300 && completedVideoSeconds > 0) {
    const rawRate = completedVideoSeconds / focusedSecondsOnCourse;
    effectiveProcessingRate = Math.max(0.5, Math.min(3.0, Number(rawRate.toFixed(2))));
  } else {
    const completedWithSpeed = lessons.filter(l => l.completed && l.speed);
    if (completedWithSpeed.length > 0) {
      const avgSpeed = completedWithSpeed.reduce((acc, l) => acc + (l.speed || 1), 0) / completedWithSpeed.length;
      effectiveProcessingRate = Number(avgSpeed.toFixed(2));
    }
  }

  const estimatedRemainingStudySeconds = Math.round(remainingVideoSeconds / Math.max(0.2, effectiveProcessingRate));
  const estimatedRemainingStudyHours = Number((estimatedRemainingStudySeconds / 3600).toFixed(1));
  const completionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return {
    courseId: course.id,
    courseTitle: course.title,
    completedLessons,
    totalLessons,
    totalVideoSeconds,
    completedVideoSeconds,
    remainingVideoSeconds,
    focusedSecondsOnCourse,
    effectiveProcessingRate,
    estimatedRemainingStudySeconds,
    estimatedRemainingStudyHours,
    completionPercentage,
  };
}
