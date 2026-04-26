import { ProgressionSuggestion, PersonalityMode, getModeConfig } from './progressionService';

export type CoachTone = 'positive' | 'neutral' | 'warning';

export interface CoachFeedback {
  message: string;
  tone: CoachTone;
  reason: string;
  confidenceLabel: string;
  readinessLabel: string;
  fatigueNote: string;
  successLabel: string;
}

export function getCoachFeedback(
  suggestion: ProgressionSuggestion
): CoachFeedback {
  const { state, confidence, metrics, reason, readiness, successProbability } = suggestion;

  let message = '';
  let tone: CoachTone = 'neutral';

  if (state === 'progressing') {
    message =
      metrics.trend > 0
        ? "You're trending upward. Progress is solid."
        : 'Progressing steadily — keep it consistent.';
    tone = 'positive';
  }

  if (state === 'repeat') {
    message = 'Focus on hitting clean reps before increasing load.';
    tone = 'neutral';
  }

  if (state === 'stalled') {
    message = 'Progress has stalled. A short deload will help recovery.';
    tone = 'warning';
  }

  if (state === 'regressing') {
    message = 'Performance dropped across sessions. Reduce load and rebuild.';
    tone = 'warning';
  }

  if (state === 'bad_day') {
    message = 'Off day — happens to everyone. Stick to the plan next session.';
    tone = 'neutral';
  }

  if (state === 'deload') {
    message = 'System fatigue is high — prioritize recovery this week.';
    tone = 'warning';
  }

  if (state === 'new') {
    message = 'First time — start light and build a baseline.';
    tone = 'neutral';
  }

  if (confidence < 0.4) {
    message += ' Low data confidence — treat as guidance.';
  }

  const readinessLabel =
    readiness >= 1.05
      ? 'Fresh'
      : readiness >= 0.95
      ? 'Normal'
      : readiness >= 0.9
      ? 'Slightly fatigued'
      : 'Fatigued';

  const fatigueNote =
    metrics.volume > metrics.avgVolume * 1.2
      ? 'High volume last session — fatigue likely'
      : metrics.volume < metrics.avgVolume * 0.8
      ? 'Low volume last session — well recovered'
      : 'Volume normal';

  const successLabel =
    successProbability >= 0.8
      ? 'Very likely'
      : successProbability >= 0.6
      ? 'Likely'
      : successProbability >= 0.4
      ? 'Uncertain'
      : 'Unlikely';

  return {
    message,
    tone,
    reason,
    confidenceLabel:
      confidence >= 0.7 ? 'High' : confidence >= 0.4 ? 'Medium' : 'Low',
    readinessLabel,
    fatigueNote,
    successLabel,
  };
}

export function getConfidenceColor(label: string): string {
  if (label === 'High') return 'text-emerald-600 dark:text-emerald-400';
  if (label === 'Medium') return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getStateColor(state: string): string {
  if (state === 'progressing') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-300';
  if (state === 'stalled') return 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-300';
  if (state === 'regressing') return 'bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-300';
  if (state === 'deload') return 'bg-purple-50 text-purple-700 dark:bg-purple-900/10 dark:text-purple-300';
  if (state === 'bad_day') return 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400';
  if (state === 'repeat') return 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400';
  return 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400';
}

export function getReadinessColor(readiness: number): string {
  if (readiness >= 1.05) return 'text-emerald-600 dark:text-emerald-400';
  if (readiness >= 0.95) return 'text-blue-600 dark:text-blue-400';
  if (readiness >= 0.9) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getSuccessProbabilityColor(prob: number): string {
  if (prob >= 0.8) return 'bg-emerald-500';
  if (prob >= 0.6) return 'bg-blue-500';
  if (prob >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getSuccessProbabilityTextColor(prob: number): string {
  if (prob >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
  if (prob >= 0.6) return 'text-blue-600 dark:text-blue-400';
  if (prob >= 0.4) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getModeLabel(mode: PersonalityMode): string {
  if (mode === 'conservative') return 'Conservative';
  if (mode === 'aggressive') return 'Aggressive';
  return 'Balanced';
}

export function getModeDescription(mode: PersonalityMode): string {
  const config = getModeConfig(mode);
  if (mode === 'conservative') return `Smaller jumps (+${config.incrementMultiplier * 2.5}kg), earlier deloads`;
  if (mode === 'aggressive') return `Bigger jumps (+${config.incrementMultiplier * 2.5}kg), push longer`;
  return 'Standard progression, moderate fatigue tolerance';
}
