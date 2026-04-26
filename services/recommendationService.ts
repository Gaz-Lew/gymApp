import { WorkoutSession, Exercise, Workout, WorkoutExercise } from '../types';
import { getLastTrainedMuscleGroups } from './analyticsService';
import { differenceInDays, parseISO } from 'date-fns';

const MUSCLE_CATEGORIES: Record<string, string> = {
  Chest: 'push',
  Shoulders: 'push',
  Triceps: 'push',
  Back: 'pull',
  Biceps: 'pull',
  RearDelt: 'pull',
  Legs: 'legs',
  Quadriceps: 'legs',
  Hamstrings: 'legs',
  Glutes: 'legs',
  Calves: 'legs',
  Core: 'core',
  Arms: 'arms',
};

function getCategory(muscleGroup: string): string {
  return MUSCLE_CATEGORIES[muscleGroup] || 'other';
}

export interface WorkoutRecommendation {
  type: 'planned' | 'muscle_group' | 'category_balance' | 'rest';
  title: string;
  description: string;
  workoutId?: string;
  workoutName?: string;
  muscleGroups?: string[];
  priority: number;
}

export function getRecommendations(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  workouts: Workout[],
  todayPlanWorkoutId?: string | null
): WorkoutRecommendation[] {
  const recommendations: WorkoutRecommendation[] = [];

  // Priority 1: Today's planned workout
  if (todayPlanWorkoutId) {
    const plannedWorkout = workouts.find((w) => w.id === todayPlanWorkoutId);
    if (plannedWorkout) {
      recommendations.push({
        type: 'planned',
        title: 'Scheduled Workout',
        description: `Your plan calls for ${plannedWorkout.name} today.`,
        workoutId: plannedWorkout.id,
        workoutName: plannedWorkout.name,
        priority: 1,
      });
    }
  }

  const lastTrained = getLastTrainedMuscleGroups(sessions, exercises);
  const now = new Date();

  // Priority 2: Muscle groups not trained in 3+ days
  const neglectedMuscles: string[] = [];
  for (const [muscleGroup, lastDate] of lastTrained.entries()) {
    const daysSince = differenceInDays(now, lastDate);
    if (daysSince >= 3) {
      neglectedMuscles.push(muscleGroup);
    }
  }

  if (neglectedMuscles.length > 0) {
    recommendations.push({
      type: 'muscle_group',
      title: 'Time to Train',
      description: `You haven't trained ${neglectedMuscles.slice(0, 2).join(', ')} in 3+ days.`,
      muscleGroups: neglectedMuscles,
      priority: 2,
    });
  }

  // Priority 3: Category balance (push/pull/legs)
  const categoryCounts: Record<string, number> = { push: 0, pull: 0, legs: 0, core: 0, arms: 0, other: 0 };
  for (const [muscleGroup] of lastTrained.entries()) {
    const cat = getCategory(muscleGroup);
    categoryCounts[cat]++;
  }

  const minCategory = Object.entries(categoryCounts).reduce((min, [cat, count]) =>
    count < min.count ? { cat, count } : min
  , { cat: 'legs', count: Infinity });

  if (minCategory.count < 2) {
    const targetMuscles = exercises
      .filter((e) => getCategory(e.muscleGroup) === minCategory.cat)
      .map((e) => e.muscleGroup);
    const uniqueMuscles = [...new Set(targetMuscles)].slice(0, 3);

    recommendations.push({
      type: 'category_balance',
      title: 'Balance Your Training',
      description: `Focus on ${minCategory.cat} movements to balance your routine.`,
      muscleGroups: uniqueMuscles,
      priority: 3,
    });
  }

  // Priority 4: Rest day suggestion if trained yesterday hard
  if (sessions.length > 0) {
    const lastSession = sessions.sort(
      (a, b) => parseISO(b.startTime).getTime() - parseISO(a.startTime).getTime()
    )[0];
    const daysSinceLast = differenceInDays(now, parseISO(lastSession.startTime));
    if (daysSinceLast === 0 && lastSession.exercises.length >= 5) {
      recommendations.push({
        type: 'rest',
        title: 'Consider Recovery',
        description: 'You had a big session today. Light cardio or rest is fine.',
        priority: 4,
      });
    }
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

export function generateAutoWorkout(
  targetMuscleGroups: string[],
  exercises: Exercise[]
): WorkoutExercise[] {
  const selectedExercises = exercises.filter((e) =>
    targetMuscleGroups.some((mg) =>
      e.muscleGroup.toLowerCase().includes(mg.toLowerCase()) ||
      mg.toLowerCase().includes(e.muscleGroup.toLowerCase())
    )
  );

  // Pick 4-6 exercises, prioritizing compound movements
  const compoundKeywords = ['squat', 'deadlift', 'press', 'bench', 'row', 'pull', 'dip'];
  const sorted = [...selectedExercises].sort((a, b) => {
    const aIsCompound = compoundKeywords.some((k) => a.name.toLowerCase().includes(k));
    const bIsCompound = compoundKeywords.some((k) => b.name.toLowerCase().includes(k));
    return Number(bIsCompound) - Number(aIsCompound);
  });

  const picked = sorted.slice(0, Math.min(6, sorted.length));

  return picked.map((ex) => ({
    exerciseId: ex.id,
    exerciseName: ex.name,
    sets: 3,
    reps: 10,
    weight: 0,
    restSeconds: 90,
  }));
}

export function getConsecutiveDayWarning(
  sessions: WorkoutSession[],
  targetWorkout: Workout,
  exercises: Exercise[]
): string | null {
  if (sessions.length === 0) return null;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdaySessions = sessions.filter((s) => {
    const d = parseISO(s.startTime);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  });

  if (yesterdaySessions.length === 0) return null;

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const yesterdayMuscles = new Set<string>();

  for (const s of yesterdaySessions) {
    for (const ex of s.exercises) {
      const exercise = exerciseMap.get(ex.exerciseId);
      if (exercise) yesterdayMuscles.add(exercise.muscleGroup);
    }
  }

  const todayMuscles = new Set<string>();
  for (const ex of targetWorkout.exercises) {
    const exercise = exerciseMap.get(ex.exerciseId);
    if (exercise) todayMuscles.add(exercise.muscleGroup);
  }

  const overlap = [...todayMuscles].filter((m) => yesterdayMuscles.has(m));
  if (overlap.length > 0) {
    return `You trained ${overlap.join(', ')} yesterday. Consider a different focus for recovery.`;
  }

  return null;
}
