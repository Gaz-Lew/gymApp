import { WorkoutSession, ExerciseProfile, UserProfile } from '../types';
import { DifficultyClass, getDifficultyMultiplier } from './exerciseClassifier';

/* -----------------------------
   TYPES
----------------------------- */

export type ProgressionSet = {
  weight: number;
  reps: number;
  completed: boolean;
};

export type ProgressionSession = {
  date: string;
  sets: ProgressionSet[];
};

export type PersonalityMode = 'conservative' | 'balanced' | 'aggressive';

export type SuggestionState =
  | 'progressing'
  | 'stalled'
  | 'regressing'
  | 'new'
  | 'repeat'
  | 'bad_day'
  | 'deload';

export type ProgressionSuggestion = {
  suggestedWeight: number;
  suggestedReps: number;
  state: SuggestionState;
  confidence: number;
  reason: string;
  readiness: number;
  successProbability: number;
  metrics: {
    e1RM: number;
    volume: number;
    trend: number;
    volatility: number;
    avgVolume: number;
    performanceReadiness: number;
    fatigueLoad: number;
    rollingBaseline: number;
    systemAggressiveness: number;
    dataConfidence: number;
    finalConfidence: number;
  };
};

export interface WeeklyInsight {
  exerciseId: string;
  exerciseName: string;
  weightChange: number;
  volumeChangePercent: number;
  trendDirection: 'up' | 'down' | 'flat';
  fatigueSignal: 'rising' | 'stable' | 'fresh';
  message: string;
}

export interface WeeklySummary {
  totalWorkouts: number;
  totalVolume: number;
  volumeChangePercent: number;
  avgDuration: number;
  globalFatigue: number;
  systemConfidence: number;
  mesocycleWeek: number;
  mesocyclePhase: 'accumulation' | 'intensification' | 'realization' | 'deload';
  insights: WeeklyInsight[];
  topMessage: string;
  nextWeekGuidance: string;
}

const REP_RANGE_SPREAD = 4;

/* -----------------------------
   PERSONALITY MODES
----------------------------- */

const MODE_CONFIG: Record<
  PersonalityMode,
  { incrementMultiplier: number; fatigueThreshold: number; deloadWeek: number; restPreference: number }
> = {
  conservative: { incrementMultiplier: 0.6, fatigueThreshold: 0.75, deloadWeek: 3, restPreference: 1.2 },
  balanced: { incrementMultiplier: 1.0, fatigueThreshold: 0.9, deloadWeek: 4, restPreference: 1.0 },
  aggressive: { incrementMultiplier: 1.4, fatigueThreshold: 1.05, deloadWeek: 5, restPreference: 0.85 },
};

export function getModeConfig(mode: PersonalityMode) {
  return MODE_CONFIG[mode];
}

/* -----------------------------
   CORE METRICS
----------------------------- */

function estimate1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

function getBestSet(session: ProgressionSession): ProgressionSet | null {
  const completed = session.sets.filter((s) => s.completed);
  if (!completed.length) return null;
  return completed.reduce((best, current) => {
    const bestScore = estimate1RM(best.weight, best.reps);
    const currentScore = estimate1RM(current.weight, current.reps);
    return currentScore > bestScore ? current : best;
  });
}

function getSession1RM(session: ProgressionSession): number {
  const best = getBestSet(session);
  if (!best) return 0;
  return estimate1RM(best.weight, best.reps);
}

function getSessionVolume(session: ProgressionSession): number {
  return session.sets.reduce((sum, s) => {
    if (!s.completed) return sum;
    return sum + s.weight * s.reps;
  }, 0);
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  const mean = avg(values);
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length || 1);
  return Math.sqrt(variance);
}

function getTrend(values: number[]): number {
  if (values.length < 3) return 0;
  const recent = values.slice(-5);
  const n = recent.length;
  const avgX = (n - 1) / 2;
  const avgY = avg(recent);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - avgX) * (recent[i] - avgY);
    denominator += (i - avgX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/* -----------------------------
   RECENCY WEIGHTING
----------------------------- */

function getRecencyWeightedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  let weightedSum = 0;
  let weightSum = 0;

  for (let i = 0; i < values.length; i++) {
    // More recent = higher weight (linear ramp)
    const weight = (i + 1) / values.length;
    weightedSum += values[i] * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? weightedSum / weightSum : 0;
}

/* -----------------------------
   ROLLING BASELINE
----------------------------- */

function getRollingBaseline(volumes: number[]): number {
  if (volumes.length === 0) return 0;
  const window = Math.min(volumes.length, 6);
  return getRecencyWeightedAverage(volumes.slice(-window));
}

/* -----------------------------
   READINESS (SPLIT)
----------------------------- */

function getPerformanceReadiness(history: ProgressionSession[]): number {
  if (history.length < 2) return 1;
  const e1RMs = history.map(getSession1RM).filter((v) => v > 0);
  if (e1RMs.length < 2) return 1;
  const last = e1RMs[e1RMs.length - 1];
  const baseline = getRecencyWeightedAverage(e1RMs.slice(0, -1));
  if (baseline === 0) return 1;
  return Math.max(0.7, Math.min(1.15, Math.round((last / baseline) * 100) / 100));
}

function getFatigueLoad(history: ProgressionSession[]): number {
  if (history.length < 2) return 1;
  const volumes = history.map(getSessionVolume);
  const last = volumes[volumes.length - 1];
  const baseline = getRecencyWeightedAverage(volumes.slice(0, -1));
  if (baseline === 0) return 1;
  return Math.max(0.6, Math.min(1.4, Math.round((last / baseline) * 100) / 100));
}

function combineReadiness(performanceReadiness: number, fatigueLoad: number): number {
  const raw = 0.6 * performanceReadiness + 0.4 * (1 / fatigueLoad);
  return Math.max(0.85, Math.min(1.08, Math.round(raw * 100) / 100));
}

/* -----------------------------
   GLOBAL FATIGUE
----------------------------- */

export function getGlobalFatigue(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 1;
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekVolume = sessions
    .filter((s) => new Date(s.startTime) >= oneWeekAgo)
    .reduce((sum, s) => sum + s.totalVolume, 0);

  const firstSession = new Date(sessions[sessions.length - 1].startTime);
  const totalWeeks = Math.max(1, Math.ceil((now.getTime() - firstSession.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const totalVolume = sessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const baseline = totalVolume / totalWeeks;

  return baseline > 0 ? Math.round((thisWeekVolume / baseline) * 100) / 100 : 1;
}

/* -----------------------------
   MESOCYCLE
----------------------------- */

export function getMesocycleWeek(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 1;
  const firstSession = new Date(sessions[sessions.length - 1].startTime);
  const now = new Date();
  const weeksDiff = Math.floor((now.getTime() - firstSession.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return (weeksDiff % 4) + 1;
}

export function getMesocyclePhase(week: number, mode: PersonalityMode): WeeklySummary['mesocyclePhase'] {
  const deloadWeek = MODE_CONFIG[mode].deloadWeek;
  if (week === deloadWeek || week === 4) return 'deload';
  if (week === 1) return 'accumulation';
  if (week === 2) return 'intensification';
  return 'realization';
}

/* -----------------------------
   SUCCESS PROBABILITY
----------------------------- */

function getSuccessProbability(
  trend: number,
  volatility: number,
  fatigueLoad: number,
  globalFatigue: number,
  exerciseSuccessRate: number,
  consistencyScore: number
): number {
  let prob = 0.72;

  if (trend > 0.5) prob += 0.08;
  else if (trend > 0) prob += 0.04;
  else if (trend < -0.5) prob -= 0.12;
  else if (trend < 0) prob -= 0.06;

  prob -= Math.min(0.15, volatility / 80);

  if (fatigueLoad > 1.2) prob -= 0.06;
  if (fatigueLoad > 1.35) prob -= 0.06;

  if (globalFatigue > 1.1) prob -= 0.05;
  if (globalFatigue > 1.3) prob -= 0.08;

  if (exerciseSuccessRate > 0.8) prob += 0.05;
  else if (exerciseSuccessRate < 0.5) prob -= 0.08;

  if (consistencyScore < 0.5) prob -= 0.06;
  else if (consistencyScore > 0.8) prob += 0.03;

  return Math.max(0.25, Math.min(0.95, Math.round(prob * 100) / 100));
}

/* -----------------------------
   DATA VOLUME CONFIDENCE
----------------------------- */

function getDataVolumeConfidence(totalSessions: number): number {
  return Math.min(1, Math.round((totalSessions / 20) * 100) / 100);
}

/* -----------------------------
   SYSTEM GUARDRAIL
----------------------------- */

function applyGuardrail(
  suggestedWeight: number,
  successProbability: number,
  baseIncrement: number
): { weight: number; guardrailApplied: boolean; reason: string } {
  if (successProbability < 0.5) {
    return {
      weight: Math.max(0, Math.round((suggestedWeight - baseIncrement) * 10) / 10),
      guardrailApplied: true,
      reason: 'Low success probability — reduced by one increment',
    };
  }
  return { weight: suggestedWeight, guardrailApplied: false, reason: '' };
}

/* -----------------------------
   DETECTION
----------------------------- */

function detectBadDay(history: ProgressionSession[], trend: number): boolean {
  if (history.length < 3 || trend <= 0) return false;
  const e1RMs = history.map(getSession1RM).filter((v) => v > 0);
  if (e1RMs.length < 3) return false;
  const last = e1RMs[e1RMs.length - 1];
  const baseline = getRecencyWeightedAverage(e1RMs.slice(0, -1));
  return last < baseline * 0.85 && trend > 0;
}

function detectRepeatedFailure(history: ProgressionSession[]): boolean {
  if (history.length < 2) return false;
  return history.slice(-2).every((s) => !getBestSet(s));
}

function detectPlateau(history: ProgressionSession[], trend: number): boolean {
  return history.length >= 4 && trend <= 0;
}

/* -----------------------------
   PROGRESSION SPEED
----------------------------- */

function getProgressionSpeed(
  history: ProgressionSession[],
  mode: PersonalityMode,
  userProfile: UserProfile | null,
  exerciseProfile: ExerciseProfile | null,
  difficultyClass: DifficultyClass
): number {
  let base = MODE_CONFIG[mode].incrementMultiplier;

  if (userProfile) {
    base *= userProfile.progressionAggressiveness;
  }

  if (exerciseProfile) {
    if (exerciseProfile.volatility > 0.2) base *= 0.85;
    if (exerciseProfile.successRate < 0.5) base *= 0.8;
    if (exerciseProfile.successRate > 0.85) base *= 1.1;
  }

  if (userProfile && userProfile.consistencyScore < 0.5) {
    base *= 0.85;
  }

  // Exercise difficulty class
  base *= getDifficultyMultiplier(difficultyClass);

  // Volume-based fatigue
  if (history.length < 2) return Math.max(0.3, Math.min(2.0, base));

  const volumes = history.map(getSessionVolume);
  const last = volumes[volumes.length - 1];
  const baseline = getRecencyWeightedAverage(volumes.slice(0, -1));
  if (baseline === 0) return Math.max(0.3, Math.min(2.0, base));

  const ratio = last / baseline;
  if (ratio > 1.2) base *= 0.6;
  else if (ratio < 0.8) base *= 1.3;

  return Math.max(0.3, Math.min(2.0, Math.round(base * 100) / 100));
}

/* -----------------------------
   WEIGHT INCREMENT
----------------------------- */

export function getWeightIncrement(weight: number): number {
  if (weight < 50) return 1.25;
  if (weight < 100) return 2.5;
  return 5;
}

/* -----------------------------
   CONFIDENCE
----------------------------- */

function getConfidence(history: ProgressionSession[], volatility: number): number {
  if (history.length < 2) return 0.3;
  if (history.length < 4) return 0.5;

  const penalty = Math.min(volatility / 20, 0.3);
  return Math.max(0, Math.min(1, 0.85 - penalty));
}

/* -----------------------------
   MAIN ENGINE
----------------------------- */

export function getProgressionSuggestion(
  history: ProgressionSession[],
  templateReps: number,
  globalFatigue: number = 1,
  mode: PersonalityMode = 'balanced',
  userProfile: UserProfile | null = null,
  exerciseProfile: ExerciseProfile | null = null,
  difficultyClass: DifficultyClass = 'hybrid'
): ProgressionSuggestion {
  const totalSessions = history.length;
  const dataConfidence = getDataVolumeConfidence(totalSessions);

  if (!history.length) {
    return {
      suggestedWeight: 0,
      suggestedReps: templateReps,
      state: 'new',
      confidence: 0,
      reason: 'No history available',
      readiness: 1,
      successProbability: 0.5,
      metrics: {
        e1RM: 0, volume: 0, trend: 0, volatility: 0, avgVolume: 0,
        performanceReadiness: 1, fatigueLoad: 1,
        rollingBaseline: 0,
        systemAggressiveness: userProfile?.progressionAggressiveness ?? 1.0,
        dataConfidence: 0,
        finalConfidence: 0,
      },
    };
  }

  const last = history[history.length - 1];
  const best = getBestSet(last);

  if (!best) {
    return {
      suggestedWeight: 0,
      suggestedReps: templateReps,
      state: 'repeat',
      confidence: 0.2,
      reason: 'No completed sets in last session',
      readiness: 1,
      successProbability: 0.3,
      metrics: {
        e1RM: 0, volume: 0, trend: 0, volatility: 0, avgVolume: 0,
        performanceReadiness: 1, fatigueLoad: 1,
        rollingBaseline: 0,
        systemAggressiveness: userProfile?.progressionAggressiveness ?? 1.0,
        dataConfidence,
        finalConfidence: Math.round(0.2 * dataConfidence * 100) / 100,
      },
    };
  }

  const lower = templateReps;
  const upper = templateReps + REP_RANGE_SPREAD;

  const e1RMs = history.map(getSession1RM);
  const volumes = history.map(getSessionVolume);

  const trend = getTrend(e1RMs);
  const volatility = stdDev(e1RMs.slice(-5));
  const perfReadiness = getPerformanceReadiness(history);
  const fatigueLoad = getFatigueLoad(history);
  const readiness = combineReadiness(perfReadiness, fatigueLoad);
  const speed = getProgressionSpeed(history, mode, userProfile, exerciseProfile, difficultyClass);
  const avgVolume = getRecencyWeightedAverage(volumes.slice(0, -1));
  const rollingBaseline = getRollingBaseline(volumes);
  const baseConfidence = getConfidence(history, volatility);
  const finalConfidence = Math.round(baseConfidence * dataConfidence * 100) / 100;

  const exerciseSuccessRate = exerciseProfile?.successRate ?? 0.5;
  const consistencyScore = userProfile?.consistencyScore ?? 0.5;
  const successProb = getSuccessProbability(trend, volatility, fatigueLoad, globalFatigue, exerciseSuccessRate, consistencyScore);

  const baseIncrement = getWeightIncrement(best.weight);
  const increment = Math.round(baseIncrement * speed * 10) / 10;

  // Apply recovery rate
  const recoveryRate = userProfile?.recoveryRate ?? 1.0;
  const adjustedIncrement = Math.round(increment * recoveryRate * 10) / 10;

  let state: SuggestionState = 'progressing';
  let suggestedWeight = best.weight;
  let suggestedReps = best.reps;
  let reason = '';

  const config = MODE_CONFIG[mode];

  // Global fatigue override
  if (globalFatigue > config.fatigueThreshold) {
    const deloadWeight = Math.round(best.weight * 0.9 * 10) / 10;
    const guardrail = applyGuardrail(deloadWeight, 0.5, baseIncrement);
    return {
      suggestedWeight: guardrail.weight,
      suggestedReps: lower,
      state: 'deload',
      confidence: finalConfidence,
      reason: guardrail.guardrailApplied ? `${guardrail.reason} — System fatigue high` : 'System fatigue high — deload required',
      readiness,
      successProbability: 0.5,
      metrics: {
        e1RM: e1RMs[e1RMs.length - 1],
        volume: volumes[volumes.length - 1],
        trend, volatility, avgVolume,
        performanceReadiness: perfReadiness,
        fatigueLoad,
        rollingBaseline,
        systemAggressiveness: userProfile?.progressionAggressiveness ?? 1.0,
        dataConfidence,
        finalConfidence,
      },
    };
  }

  // Bad day
  if (detectBadDay(history, trend)) {
    state = 'bad_day';
    suggestedWeight = best.weight;
    suggestedReps = best.reps;
    reason = 'Off day detected — repeat weight, fatigue may be a factor';
  }
  // Repeated failure
  else if (detectRepeatedFailure(history)) {
    state = 'regressing';
    suggestedWeight = Math.max(0, Math.round((best.weight - adjustedIncrement) * 10) / 10);
    suggestedReps = lower;
    reason = 'Repeated failures — reduce load and rebuild';
  }
  // Plateau
  else if (detectPlateau(history, trend)) {
    state = 'stalled';
    suggestedWeight = Math.round(best.weight * 0.9 * 10) / 10;
    suggestedReps = lower;
    reason = 'Plateau detected — deload 10% and work back up';
  }
  // Below range
  else if (best.reps < lower) {
    state = 'repeat';
    suggestedWeight = best.weight;
    suggestedReps = lower;
    reason = 'Below target reps — repeat weight, aim for clean form';
  }
  // In range
  else if (best.reps < upper) {
    state = 'progressing';
    suggestedWeight = best.weight;
    suggestedReps = best.reps + 1;
    reason =
      speed > config.incrementMultiplier
        ? 'Fresh — push for extra rep'
        : speed < config.incrementMultiplier
        ? 'High fatigue — micro-progress'
        : 'In range — add 1 rep, keep weight';
  }
  // At cap
  else {
    state = 'progressing';
    suggestedWeight = Math.round((best.weight + adjustedIncrement) * 10) / 10;
    suggestedReps = lower;
    reason = `Hit ${upper} reps — bump weight +${adjustedIncrement}kg, reset to ${lower} reps`;
  }

  // Apply readiness modifier (capped)
  const finalWeight = Math.round(suggestedWeight * readiness * 10) / 10;

  // Apply guardrail if success probability is low
  const guardrail = applyGuardrail(finalWeight, successProb, baseIncrement);

  return {
    suggestedWeight: guardrail.weight,
    suggestedReps,
    state,
    confidence: finalConfidence,
    reason: guardrail.guardrailApplied ? `${guardrail.reason} — ${reason}` : reason,
    readiness,
    successProbability: successProb,
    metrics: {
      e1RM: e1RMs[e1RMs.length - 1],
      volume: volumes[volumes.length - 1],
      trend,
      volatility,
      avgVolume,
      performanceReadiness: perfReadiness,
      fatigueLoad,
      rollingBaseline,
      systemAggressiveness: userProfile?.progressionAggressiveness ?? 1.0,
      dataConfidence,
      finalConfidence,
    },
  };
}

/* -----------------------------
   HISTORY BUILDER
----------------------------- */

export function buildExerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string
): ProgressionSession[] {
  const history: ProgressionSession[] = [];
  const chronological = [...sessions].reverse();

  for (const session of chronological) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    history.push({
      date: session.startTime,
      sets: ex.sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
      })),
    });
  }

  return history;
}

/* -----------------------------
   WEEKLY SUMMARY
----------------------------- */

export function getWeeklySummary(
  sessions: WorkoutSession[],
  exercises: { id: string; name: string }[],
  mode: PersonalityMode = 'balanced',
  userProfile: UserProfile | null = null
): WeeklySummary {
  if (sessions.length === 0) {
    return {
      totalWorkouts: 0,
      totalVolume: 0,
      volumeChangePercent: 0,
      avgDuration: 0,
      globalFatigue: 1,
      systemConfidence: 0.5,
      mesocycleWeek: 1,
      mesocyclePhase: 'accumulation',
      insights: [],
      topMessage: 'Start training to see your weekly summary',
      nextWeekGuidance: 'Begin with template weights and build a baseline',
    };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeekSessions = sessions.filter((s) => new Date(s.startTime) >= oneWeekAgo);
  const lastWeekSessions = sessions.filter(
    (s) => new Date(s.startTime) >= twoWeeksAgo && new Date(s.startTime) < oneWeekAgo
  );

  const thisWeekVolume = thisWeekSessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const lastWeekVolume = lastWeekSessions.reduce((sum, s) => sum + s.totalVolume, 0);
  const volumeChangePercent =
    lastWeekVolume > 0
      ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100)
      : 0;

  const avgDuration =
    thisWeekSessions.length > 0
      ? Math.round(
          thisWeekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) /
            thisWeekSessions.length /
            60
        )
      : 0;

  const globalFatigue = getGlobalFatigue(sessions);
  const mesocycleWeek = getMesocycleWeek(sessions);
  const mesocyclePhase = getMesocyclePhase(mesocycleWeek, mode);
  const config = MODE_CONFIG[mode];

  const systemConfidence =
    sessions.length > 20 && (userProfile?.consistencyScore ?? 0) > 0.6
      ? 0.9
      : sessions.length > 10
      ? 0.7
      : 0.5;

  const insights: WeeklyInsight[] = [];

  for (const ex of exercises) {
    const thisWeekEx = thisWeekSessions.flatMap((s) =>
      s.exercises.filter((e) => e.exerciseId === ex.id)
    );
    const lastWeekEx = lastWeekSessions.flatMap((s) =>
      s.exercises.filter((e) => e.exerciseId === ex.id)
    );

    if (thisWeekEx.length === 0) continue;

    const thisBest = Math.max(
      ...thisWeekEx.flatMap((e) => e.sets.filter((s) => s.completed).map((s) => s.weight)),
      0
    );
    const lastBest =
      lastWeekEx.length > 0
        ? Math.max(
            ...lastWeekEx.flatMap((e) => e.sets.filter((s) => s.completed).map((s) => s.weight)),
            0
          )
        : 0;

    const thisVol = thisWeekEx.reduce(
      (sum, e) =>
        sum + e.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0),
      0
    );
    const lastVol = lastWeekEx.reduce(
      (sum, e) =>
        sum + e.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0),
      0
    );

    const weightChange = lastBest > 0 ? Math.round((thisBest - lastBest) * 10) / 10 : 0;
    const volChange = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : 0;

    const thisWeekExVolumes = thisWeekEx.map((e) =>
      e.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0)
    );
    const avgExVol =
      thisWeekExVolumes.reduce((a, b) => a + b, 0) / Math.max(1, thisWeekExVolumes.length);
    const lastExVol = thisWeekExVolumes[thisWeekExVolumes.length - 1];
    const fatigueSignal: WeeklyInsight['fatigueSignal'] =
      lastExVol < avgExVol * 0.85
        ? 'rising'
        : lastExVol > avgExVol * 1.15
        ? 'fresh'
        : 'stable';

    const trendDirection: WeeklyInsight['trendDirection'] =
      weightChange > 0 ? 'up' : weightChange < 0 ? 'down' : 'flat';

    let message = '';
    if (weightChange > 0) message = `+${weightChange}kg this week`;
    else if (weightChange < 0) message = `${weightChange}kg — deload or recovery`;
    else if (volChange > 10) message = `Volume up ${volChange}%`;
    else if (volChange < -10) message = `Volume down ${Math.abs(volChange)}%`;
    else message = 'Holding steady';

    insights.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      weightChange,
      volumeChangePercent: volChange,
      trendDirection,
      fatigueSignal,
      message,
    });
  }

  insights.sort((a, b) => Math.abs(b.weightChange) - Math.abs(a.weightChange));

  const risingFatigue = insights.filter((i) => i.fatigueSignal === 'rising').length;
  const totalInsights = insights.length;
  let topMessage = '';

  if (mesocyclePhase === 'deload') {
    topMessage = `Week ${mesocycleWeek} — Deload. Reduce volume, maintain intensity.`;
  } else if (globalFatigue > config.fatigueThreshold) {
    topMessage = 'System fatigue high — consider reducing volume this week';
  } else if (volumeChangePercent > 20) {
    topMessage = `Volume up ${volumeChangePercent}% — great week!`;
  } else if (volumeChangePercent < -20) {
    topMessage = `Volume down ${Math.abs(volumeChangePercent)}% — recovery or deload?`;
  } else if (risingFatigue >= Math.ceil(totalInsights / 2) && totalInsights > 0) {
    topMessage = 'Fatigue rising across exercises — monitor recovery';
  } else if (insights.some((i) => i.weightChange > 0)) {
    const best = insights.find((i) => i.weightChange > 0);
    topMessage = `Strong week — ${best?.exerciseName} up +${best?.weightChange}kg`;
  } else {
    topMessage = 'Steady week — consistency builds progress';
  }

  let nextWeekGuidance = '';
  if (mesocyclePhase === 'deload') {
    nextWeekGuidance = 'Deload week — reduce volume 20-30%, maintain intensity, focus on recovery';
  } else if (globalFatigue > config.fatigueThreshold) {
    nextWeekGuidance = 'Reduce volume by 15%, maintain intensity, add rest days';
  } else if (globalFatigue < 0.7) {
    nextWeekGuidance = 'Well recovered — push for progressive overload on all lifts';
  } else if (insights.some((i) => i.trendDirection === 'up')) {
    const upExercises = insights.filter((i) => i.trendDirection === 'up');
    if (upExercises.length === 1) {
      nextWeekGuidance = `Increase load on ${upExercises[0].exerciseName}, maintain others`;
    } else {
      nextWeekGuidance = 'Continue progressive overload — multiple lifts trending up';
    }
  } else {
    nextWeekGuidance = 'Maintain current progression — monitor fatigue signals';
  }

  return {
    totalWorkouts: thisWeekSessions.length,
    totalVolume: thisWeekVolume,
    volumeChangePercent,
    avgDuration,
    globalFatigue,
    systemConfidence,
    mesocycleWeek,
    mesocyclePhase,
    insights: insights.slice(0, 5),
    topMessage,
    nextWeekGuidance,
  };
}

/* -----------------------------
   PERSONALITY MODE PERSISTENCE
----------------------------- */

const MODE_KEY = 'fittrack_personality_mode';

export function getStoredPersonalityMode(): PersonalityMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'conservative' || stored === 'balanced' || stored === 'aggressive') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'balanced';
}

export function storePersonalityMode(mode: PersonalityMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore
  }
}
