import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { WorkoutOutcome, WorkoutSession, SessionSet, ExerciseProfile } from '../types';

const outcomesRef = collection(db, 'outcomes');

function docToOutcome(docSnap: any): WorkoutOutcome {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    exerciseId: data.exerciseId,
    exerciseName: data.exerciseName,
    sessionId: data.sessionId,
    success: data.success,
    partialSuccess: data.partialSuccess ?? (data.success ? 1 : 0),
    targetWeight: data.targetWeight,
    targetReps: data.targetReps,
    achievedWeight: data.achievedWeight,
    achievedReps: data.achievedReps,
    timestamp: data.timestamp?.toDate?.().toISOString() || data.timestamp,
  };
}

function getBestCompletedSet(sets: SessionSet[]): SessionSet | null {
  const completed = sets.filter((s) => s.completed);
  if (completed.length === 0) return null;
  return completed.reduce((best, s) =>
    s.weight * s.reps > best.weight * best.reps ? s : best
  );
}

/* -----------------------------
   PARTIAL SUCCESS SCORING
----------------------------- */

function calculatePartialSuccess(
  targetWeight: number,
  targetReps: number,
  achievedWeight: number,
  achievedReps: number
): number {
  if (achievedWeight >= targetWeight && achievedReps >= targetReps) return 1;

  const weightRatio = targetWeight > 0 ? achievedWeight / targetWeight : 0;
  const repsRatio = targetReps > 0 ? achievedReps / targetReps : 0;

  // Weighted: 60% weight, 40% reps
  const raw = weightRatio * 0.6 + repsRatio * 0.4;
  return Math.max(0, Math.min(0.99, Math.round(raw * 100) / 100));
}

/* -----------------------------
   RECORD OUTCOMES
----------------------------- */

export async function recordWorkoutOutcomes(
  userId: string,
  session: WorkoutSession
): Promise<void> {
  const promises = session.exercises.map(async (ex) => {
    const bestSet = getBestCompletedSet(ex.sets);
    if (!bestSet) return;

    const targetSet = ex.sets[0];
    const targetWeight = targetSet?.weight || 0;
    const targetReps = targetSet?.reps || 0;
    const achievedWeight = bestSet.weight;
    const achievedReps = bestSet.reps;

    const success = achievedWeight >= targetWeight && achievedReps >= targetReps;
    const partialSuccess = calculatePartialSuccess(
      targetWeight,
      targetReps,
      achievedWeight,
      achievedReps
    );

    await addDoc(outcomesRef, {
      userId,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      sessionId: session.id,
      success,
      partialSuccess,
      targetWeight,
      targetReps,
      achievedWeight,
      achievedReps,
      timestamp: serverTimestamp(),
    });
  });

  await Promise.all(promises);
}

/* -----------------------------
   QUERY OUTCOMES
----------------------------- */

export async function getOutcomesForExercise(
  userId: string,
  exerciseId: string,
  limitCount: number = 20
): Promise<WorkoutOutcome[]> {
  const q = query(
    outcomesRef,
    where('userId', '==', userId),
    where('exerciseId', '==', exerciseId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToOutcome);
}

export async function getAllOutcomes(
  userId: string,
  limitCount: number = 100
): Promise<WorkoutOutcome[]> {
  const q = query(
    outcomesRef,
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToOutcome);
}

/* -----------------------------
   SUCCESS RATE (WITH PARTIAL)
----------------------------- */

export function calculateSuccessRate(outcomes: WorkoutOutcome[]): number {
  if (outcomes.length === 0) return 0.5;
  const successes = outcomes.filter((o) => o.success).length;
  return Math.round((successes / outcomes.length) * 100) / 100;
}

export function calculateWeightedSuccessRate(outcomes: WorkoutOutcome[]): number {
  if (outcomes.length === 0) return 0.5;
  const total = outcomes.reduce((sum, o) => sum + (o.partialSuccess ?? (o.success ? 1 : 0)), 0);
  return Math.round((total / outcomes.length) * 100) / 100;
}

/* -----------------------------
   EXERCISE PROFILE
----------------------------- */

export function calculateExerciseProfile(
  outcomes: WorkoutOutcome[]
): { avgTrend: number; volatility: number; successRate: number; totalAttempts: number } {
  if (outcomes.length < 2) {
    return {
      avgTrend: 0,
      volatility: 0,
      successRate: calculateWeightedSuccessRate(outcomes),
      totalAttempts: outcomes.length,
    };
  }

  const chronological = [...outcomes].reverse();
  const scores = chronological.map((o) => o.achievedWeight * o.achievedReps);

  // Trend: simple slope over last 5
  const recent = scores.slice(-5);
  const n = recent.length;
  let trend = 0;
  if (n >= 2) {
    const first = recent[0];
    const last = recent[n - 1];
    trend = Math.round(((last - first) / Math.max(1, first)) * 100) / 100;
  }

  // Volatility: coefficient of variation
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return {
    avgTrend: trend,
    volatility: Math.round(cv * 100) / 100,
    successRate: calculateWeightedSuccessRate(outcomes),
    totalAttempts: outcomes.length,
  };
}

/* -----------------------------
   LEARNING COOLDOWN
----------------------------- */

const LEARNING_COOLDOWN_SESSIONS = 3;

export function shouldUpdateLearning(
  exerciseProfile: ExerciseProfile | null
): boolean {
  if (!exerciseProfile) return true;
  return exerciseProfile.sessionsSinceUpdate >= LEARNING_COOLDOWN_SESSIONS;
}

/* -----------------------------
   SMOOTHED AGGRESSIVENESS
----------------------------- */

export function calculateSmoothedAggressiveness(
  current: number,
  target: number,
  alpha: number = 0.3
): number {
  // Exponential smoothing: blend current with target
  const smoothed = current * (1 - alpha) + target * alpha;
  return Math.round(smoothed * 100) / 100;
}

/* -----------------------------
   AGGRESSIVENESS ADJUSTMENT
----------------------------- */

export function shouldAdjustAggressiveness(
  outcomes: WorkoutOutcome[]
): { adjust: boolean; newAggressiveness: number; reason: string } {
  if (outcomes.length < 6) {
    return { adjust: false, newAggressiveness: 1.0, reason: 'Not enough data' };
  }

  const rate = calculateWeightedSuccessRate(outcomes);

  if (rate < 0.6) {
    return {
      adjust: true,
      newAggressiveness: 0.9,
      reason: `Weighted success ${Math.round(rate * 100)}% — reducing aggressiveness`,
    };
  }

  if (rate > 0.8) {
    return {
      adjust: true,
      newAggressiveness: 1.1,
      reason: `Weighted success ${Math.round(rate * 100)}% — increasing aggressiveness`,
    };
  }

  return { adjust: false, newAggressiveness: 1.0, reason: 'Success rate in optimal range' };
}

/* -----------------------------
   MODIFIER CAPS
----------------------------- */

export function capModifier(
  value: number,
  min: number = 0.5,
  max: number = 1.5
): number {
  return Math.max(min, Math.min(max, Math.round(value * 100) / 100));
}

export function capStackedModifiers(
  modifiers: number[],
  floor: number = 0.4,
  ceiling: number = 1.6
): number {
  const product = modifiers.reduce((a, b) => a * b, 1);
  return Math.max(floor, Math.min(ceiling, Math.round(product * 100) / 100));
}
