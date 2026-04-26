import { AppData, Exercise, Workout, Plan, WorkoutSession } from '../types';

export function validateAppData(data: unknown): data is AppData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.exercises)) return false;
  if (!Array.isArray(d.workouts)) return false;
  if (!Array.isArray(d.plans)) return false;
  if (!Array.isArray(d.sessions)) return false;
  return true;
}

export function validateExercise(ex: unknown): ex is Exercise {
  if (!ex || typeof ex !== 'object') return false;
  const e = ex as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.name === 'string' &&
    typeof e.muscleGroup === 'string' &&
    typeof e.equipment === 'string' &&
    typeof e.instructions === 'string'
  );
}

export function validateWorkout(w: unknown): w is Workout {
  if (!w || typeof w !== 'object') return false;
  const wo = w as Record<string, unknown>;
  return (
    typeof wo.id === 'string' &&
    typeof wo.name === 'string' &&
    Array.isArray(wo.exercises)
  );
}

export function validatePlan(p: unknown): p is Plan {
  if (!p || typeof p !== 'object') return false;
  const pl = p as Record<string, unknown>;
  return (
    typeof pl.id === 'string' &&
    typeof pl.name === 'string' &&
    Array.isArray(pl.days)
  );
}

export function validateSession(s: unknown): s is WorkoutSession {
  if (!s || typeof s !== 'object') return false;
  const se = s as Record<string, unknown>;
  return (
    typeof se.id === 'string' &&
    typeof se.workoutId === 'string' &&
    typeof se.workoutName === 'string' &&
    Array.isArray(se.exercises)
  );
}
