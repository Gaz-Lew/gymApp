export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  instructions: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  restSeconds: number;
}

export interface Workout {
  id: string;
  name: string;
  description: string;
  exercises: WorkoutExercise[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDay {
  day: string;
  workoutId: string | null;
  workoutName: string | null;
}

export interface Plan {
  id: string;
  name: string;
  days: PlanDay[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSet {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
  sets: SessionSet[];
}

export interface WorkoutSession {
  id: string;
  workoutId: string;
  workoutName: string;
  exercises: SessionExercise[];
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  totalVolume: number;
  userId: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string;
  strengthLevel: 'beginner' | 'intermediate' | 'advanced';
  recoveryRate: number;
  preferredIntensity: 'low' | 'moderate' | 'high';
  consistencyScore: number;
  baselineVolume: number;
  baselineLastUpdated: string;
  progressionAggressiveness: number;
}

export interface WorkoutOutcome {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  sessionId: string;
  success: boolean;
  partialSuccess: number; // 0–1 score
  targetWeight: number;
  targetReps: number;
  achievedWeight: number;
  achievedReps: number;
  timestamp: string;
}

export interface ExerciseProfile {
  exerciseId: string;
  userId: string;
  difficultyClass: 'compound' | 'isolation' | 'hybrid';
  avgTrend: number;
  volatility: number;
  successRate: number;
  totalAttempts: number;
  smoothedAggressiveness: number;
  sessionsSinceUpdate: number;
  lastLearningUpdate: string;
  lastUpdated: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface AppData {
  exercises: Exercise[];
  workouts: Workout[];
  plans: Plan[];
  sessions: WorkoutSession[];
}
