import { WorkoutSession, Exercise } from '../types';
import { parseISO, startOfWeek, isSameWeek, subWeeks, format } from 'date-fns';

export interface VolumeTrend {
  label: string;
  volume: number;
  workouts: number;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxReps: number;
  prDate: string;
}

export interface MuscleGroupStat {
  muscleGroup: string;
  count: number;
  percentage: number;
  totalVolume: number;
}

export interface VolumePoint {
  date: string;
  volume: number;
}

export function calculateVolumePerSession(session: WorkoutSession): number {
  return session.exercises.reduce((total, ex) => {
    return total + ex.sets.filter((s) => s.completed).reduce((sum, s) => sum + s.reps * s.weight, 0);
  }, 0);
}

export function getWeeklyVolumeTrends(sessions: WorkoutSession[], weeksBack = 8): VolumeTrend[] {
  const now = new Date();
  return Array.from({ length: weeksBack }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(now, weeksBack - 1 - i), { weekStartsOn: 1 });
    const weekSessions = sessions.filter((s) =>
      isSameWeek(parseISO(s.startTime), weekStart, { weekStartsOn: 1 })
    );
    const volume = weekSessions.reduce((sum, s) => sum + calculateVolumePerSession(s), 0);
    return {
      label: format(weekStart, 'MMM d'),
      volume,
      workouts: weekSessions.length,
    };
  });
}

export function getPersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const existing = records.get(ex.exerciseId);
        if (!existing) {
          records.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            maxWeight: set.weight,
            maxReps: set.reps,
            prDate: session.startTime,
          });
        } else {
          if (set.weight > existing.maxWeight) {
            existing.maxWeight = set.weight;
            existing.prDate = session.startTime;
          }
          if (set.reps > existing.maxReps) {
            existing.maxReps = set.reps;
          }
        }
      }
    }
  }

  return Array.from(records.values()).sort((a, b) => b.maxWeight - a.maxWeight);
}

export function getMuscleGroupDistribution(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): MuscleGroupStat[] {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const stats = new Map<string, { count: number; volume: number }>();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const exercise = exerciseMap.get(ex.exerciseId);
      if (!exercise) continue;
      const muscleGroup = exercise.muscleGroup;
      const current = stats.get(muscleGroup) || { count: 0, volume: 0 };
      const exVolume = ex.sets
        .filter((s) => s.completed)
        .reduce((sum, s) => sum + s.reps * s.weight, 0);
      stats.set(muscleGroup, {
        count: current.count + 1,
        volume: current.volume + exVolume,
      });
    }
  }

  const total = Array.from(stats.values()).reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return [];

  return Array.from(stats.entries())
    .map(([muscleGroup, data]) => ({
      muscleGroup,
      count: data.count,
      percentage: Math.round((data.count / total) * 100),
      totalVolume: data.volume,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getVolumeOverTime(sessions: WorkoutSession[]): VolumePoint[] {
  const sorted = [...sessions].sort(
    (a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
  );
  return sorted.map((s) => ({
    date: format(parseISO(s.startTime), 'MMM d'),
    volume: calculateVolumePerSession(s),
  }));
}

export function getStreakInfo(sessions: WorkoutSession[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const sorted = [...sessions].sort(
    (a, b) => parseISO(b.startTime).getTime() - parseISO(a.startTime).getTime()
  );

  const workoutDates = sorted.map((s) => {
    const d = parseISO(s.startTime);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  });
  const uniqueDates = [...new Set(workoutDates)];

  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (uniqueDates[0] === today.getTime() || uniqueDates[0] === yesterday.getTime()) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      prev.setDate(prev.getDate() - 1);
      if (prev.getTime() === curr.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  let longestStreak = 0;
  let tempStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    prev.setDate(prev.getDate() - 1);
    if (prev.getTime() === curr.getTime()) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
}

export function getLastTrainedMuscleGroups(
  sessions: WorkoutSession[],
  exercises: Exercise[]
): Map<string, Date> {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const lastTrained = new Map<string, Date>();

  const sorted = [...sessions].sort(
    (a, b) => parseISO(b.startTime).getTime() - parseISO(a.startTime).getTime()
  );

  for (const session of sorted) {
    for (const ex of session.exercises) {
      const exercise = exerciseMap.get(ex.exerciseId);
      if (!exercise) continue;
      const muscleGroup = exercise.muscleGroup;
      if (!lastTrained.has(muscleGroup)) {
        lastTrained.set(muscleGroup, parseISO(session.startTime));
      }
    }
  }

  return lastTrained;
}
