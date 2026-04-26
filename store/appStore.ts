import { create } from 'zustand';
import { Exercise, Workout, Plan, WorkoutSession, SessionExercise } from '../types';

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

interface ActiveWorkoutState {
  workoutId: string;
  workoutName: string;
  exercises: SessionExercise[];
  startTime: string;
  durationSeconds: number;
}

interface AppState {
  exercises: Exercise[];
  workouts: Workout[];
  plans: Plan[];
  sessions: WorkoutSession[];
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  pendingOperations: PendingOperation[];
  lastSyncAt: string | null;
  setExercises: (exercises: Exercise[]) => void;
  setWorkouts: (workouts: Workout[]) => void;
  setPlans: (plans: Plan[]) => void;
  setSessions: (sessions: WorkoutSession[]) => void;
  addExercise: (exercise: Exercise) => void;
  updateExerciseLocal: (exercise: Exercise) => void;
  removeExercise: (id: string) => void;
  addWorkout: (workout: Workout) => void;
  updateWorkoutLocal: (workout: Workout) => void;
  removeWorkout: (id: string) => void;
  addPlan: (plan: Plan) => void;
  updatePlanLocal: (plan: Plan) => void;
  removePlan: (id: string) => void;
  addSession: (session: WorkoutSession) => void;
  appendSessions: (sessions: WorkoutSession[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setOffline: (offline: boolean) => void;
  addPendingOperation: (op: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>) => void;
  removePendingOperation: (id: string) => void;
  incrementRetry: (id: string) => void;
  setLastSyncAt: (time: string) => void;
  reset: () => void;
}

const initialState = {
  exercises: [],
  workouts: [],
  plans: [],
  sessions: [],
  loading: false,
  error: null,
  isOffline: false,
  pendingOperations: [],
  lastSyncAt: null,
};

const ACTIVE_WORKOUT_KEY = 'fittrack_active_workout';

export const useAppStore = create<AppState>((set) => ({
  ...initialState,
  setExercises: (exercises) => set({ exercises }),
  setWorkouts: (workouts) => set({ workouts }),
  setPlans: (plans) => set({ plans }),
  setSessions: (sessions) => set({ sessions }),
  addExercise: (exercise) =>
    set((state) => ({ exercises: [...state.exercises, exercise] })),
  updateExerciseLocal: (exercise) =>
    set((state) => ({
      exercises: state.exercises.map((e) => (e.id === exercise.id ? exercise : e)),
    })),
  removeExercise: (id) =>
    set((state) => ({
      exercises: state.exercises.filter((e) => e.id !== id),
    })),
  addWorkout: (workout) =>
    set((state) => ({ workouts: [...state.workouts, workout] })),
  updateWorkoutLocal: (workout) =>
    set((state) => ({
      workouts: state.workouts.map((w) => (w.id === workout.id ? workout : w)),
    })),
  removeWorkout: (id) =>
    set((state) => ({
      workouts: state.workouts.filter((w) => w.id !== id),
    })),
  addPlan: (plan) =>
    set((state) => ({ plans: [...state.plans, plan] })),
  updatePlanLocal: (plan) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === plan.id ? plan : p)),
    })),
  removePlan: (id) =>
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
    })),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  appendSessions: (newSessions) =>
    set((state) => ({
      sessions: [...state.sessions, ...newSessions],
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setOffline: (offline) => set({ isOffline: offline }),
  addPendingOperation: (op) =>
    set((state) => ({
      pendingOperations: [
        ...state.pendingOperations,
        {
          ...op,
          id: `${op.collection}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          retryCount: 0,
        },
      ],
    })),
  removePendingOperation: (id) =>
    set((state) => ({
      pendingOperations: state.pendingOperations.filter((op) => op.id !== id),
    })),
  incrementRetry: (id) =>
    set((state) => ({
      pendingOperations: state.pendingOperations.map((op) =>
        op.id === id ? { ...op, retryCount: op.retryCount + 1 } : op
      ),
    })),
  setLastSyncAt: (time) => set({ lastSyncAt: time }),
  reset: () => set(initialState),
}));

// Active workout localStorage persistence (outside Zustand to avoid serialization issues)
export function saveActiveWorkout(state: ActiveWorkoutState): void {
  try {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function loadActiveWorkout(): ActiveWorkoutState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.workoutId || !parsed.startTime) return null;
    return parsed as ActiveWorkoutState;
  } catch {
    return null;
  }
}

export function clearActiveWorkout(): void {
  try {
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  } catch {
    // Ignore
  }
}
