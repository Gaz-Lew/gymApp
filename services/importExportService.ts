import { AppData, Exercise, Workout, Plan, WorkoutSession } from '../types';

function isValidString(val: unknown): val is string {
  return typeof val === 'string' && val.length > 0;
}

function isValidNumber(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val);
}

function isValidOptionalString(val: unknown): boolean {
  return val === null || val === undefined || typeof val === 'string';
}

function validateExercise(ex: unknown): ex is Exercise {
  if (!ex || typeof ex !== 'object') return false;
  const e = ex as Record<string, unknown>;
  return (
    isValidString(e.id) &&
    isValidString(e.name) &&
    isValidString(e.muscleGroup) &&
    isValidString(e.equipment) &&
    isValidString(e.instructions) &&
    isValidOptionalString(e.userId) &&
    isValidOptionalString(e.createdAt) &&
    isValidOptionalString(e.updatedAt)
  );
}

function validateWorkoutExercise(ex: unknown): boolean {
  if (!ex || typeof ex !== 'object') return false;
  const e = ex as Record<string, unknown>;
  return (
    isValidString(e.exerciseId) &&
    isValidString(e.exerciseName) &&
    isValidNumber(e.sets) &&
    isValidNumber(e.reps) &&
    isValidNumber(e.weight) &&
    isValidNumber(e.restSeconds)
  );
}

function validateWorkout(w: unknown): w is Workout {
  if (!w || typeof w !== 'object') return false;
  const wo = w as Record<string, unknown>;
  return (
    isValidString(wo.id) &&
    isValidString(wo.name) &&
    typeof wo.description === 'string' &&
    Array.isArray(wo.exercises) &&
    wo.exercises.every(validateWorkoutExercise) &&
    isValidString(wo.userId) &&
    isValidOptionalString(wo.createdAt) &&
    isValidOptionalString(wo.updatedAt)
  );
}

function validatePlanDay(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const day = d as Record<string, unknown>;
  return (
    isValidString(day.day) &&
    isValidOptionalString(day.workoutId) &&
    isValidOptionalString(day.workoutName)
  );
}

function validatePlan(p: unknown): p is Plan {
  if (!p || typeof p !== 'object') return false;
  const pl = p as Record<string, unknown>;
  return (
    isValidString(pl.id) &&
    isValidString(pl.name) &&
    Array.isArray(pl.days) &&
    pl.days.every(validatePlanDay) &&
    isValidString(pl.userId) &&
    isValidOptionalString(pl.createdAt) &&
    isValidOptionalString(pl.updatedAt)
  );
}

function validateSessionSet(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const set = s as Record<string, unknown>;
  return (
    isValidNumber(set.setNumber) &&
    isValidNumber(set.reps) &&
    isValidNumber(set.weight) &&
    typeof set.completed === 'boolean'
  );
}

function validateSessionExercise(ex: unknown): boolean {
  if (!ex || typeof ex !== 'object') return false;
  const e = ex as Record<string, unknown>;
  return (
    isValidString(e.exerciseId) &&
    isValidString(e.exerciseName) &&
    isValidNumber(e.targetSets) &&
    isValidNumber(e.targetReps) &&
    isValidNumber(e.targetWeight) &&
    Array.isArray(e.sets) &&
    e.sets.every(validateSessionSet)
  );
}

function validateSession(s: unknown): s is WorkoutSession {
  if (!s || typeof s !== 'object') return false;
  const se = s as Record<string, unknown>;
  return (
    isValidString(se.id) &&
    isValidString(se.workoutId) &&
    isValidString(se.workoutName) &&
    Array.isArray(se.exercises) &&
    se.exercises.every(validateSessionExercise) &&
    isValidString(se.startTime) &&
    isValidOptionalString(se.endTime) &&
    isValidNumber(se.durationSeconds) &&
    isValidNumber(se.totalVolume) &&
    isValidString(se.userId) &&
    isValidOptionalString(se.createdAt)
  );
}

export function validateAppDataStrict(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be an object'] };
  }

  const d = data as Record<string, unknown>;

  if (!Array.isArray(d.exercises)) {
    errors.push('exercises must be an array');
  } else {
    d.exercises.forEach((ex, i) => {
      if (!validateExercise(ex)) errors.push(`exercises[${i}] is invalid`);
    });
  }

  if (!Array.isArray(d.workouts)) {
    errors.push('workouts must be an array');
  } else {
    d.workouts.forEach((w, i) => {
      if (!validateWorkout(w)) errors.push(`workouts[${i}] is invalid`);
    });
  }

  if (!Array.isArray(d.plans)) {
    errors.push('plans must be an array');
  } else {
    d.plans.forEach((p, i) => {
      if (!validatePlan(p)) errors.push(`plans[${i}] is invalid`);
    });
  }

  if (!Array.isArray(d.sessions)) {
    errors.push('sessions must be an array');
  } else {
    d.sessions.forEach((s, i) => {
      if (!validateSession(s)) errors.push(`sessions[${i}] is invalid`);
    });
  }

  return { valid: errors.length === 0, errors };
}

export function checkDuplicateIds(data: AppData): string[] {
  const allIds = new Set<string>();
  const duplicates: string[] = [];

  const check = (id: string, context: string) => {
    if (allIds.has(id)) {
      duplicates.push(`Duplicate ID "${id}" found in ${context}`);
    } else {
      allIds.add(id);
    }
  };

  data.exercises.forEach((e) => check(e.id, 'exercises'));
  data.workouts.forEach((w) => check(w.id, 'workouts'));
  data.plans.forEach((p) => check(p.id, 'plans'));
  data.sessions.forEach((s) => check(s.id, 'sessions'));

  return duplicates;
}

export function exportToJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadJSON(data: AppData, filename = 'fittrack-backup.json'): void {
  const json = exportToJSON(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromJSON(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        const validation = validateAppDataStrict(data);
        if (!validation.valid) {
          reject(new Error(`Validation failed:\n${validation.errors.join('\n')}`));
          return;
        }
        const appData = data as AppData;
        const duplicates = checkDuplicateIds(appData);
        if (duplicates.length > 0) {
          reject(new Error(`Duplicate IDs found:\n${duplicates.join('\n')}`));
          return;
        }
        resolve(appData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function mergeAppData(existing: AppData, incoming: AppData): AppData {
  const existingExerciseIds = new Set(existing.exercises.map((e) => e.id));
  const existingWorkoutIds = new Set(existing.workouts.map((w) => w.id));
  const existingPlanIds = new Set(existing.plans.map((p) => p.id));
  const existingSessionIds = new Set(existing.sessions.map((s) => s.id));

  return {
    exercises: [
      ...existing.exercises,
      ...incoming.exercises.filter((e) => !existingExerciseIds.has(e.id)),
    ],
    workouts: [
      ...existing.workouts,
      ...incoming.workouts.filter((w) => !existingWorkoutIds.has(w.id)),
    ],
    plans: [
      ...existing.plans,
      ...incoming.plans.filter((p) => !existingPlanIds.has(p.id)),
    ],
    sessions: [
      ...existing.sessions,
      ...incoming.sessions.filter((s) => !existingSessionIds.has(s.id)),
    ],
  };
}
