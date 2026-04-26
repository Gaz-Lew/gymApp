import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppStore, saveActiveWorkout, loadActiveWorkout, clearActiveWorkout } from '../store/appStore';
import { getWorkoutById } from '../services/workoutService';
import { createSession, getLastPerformance } from '../services/sessionService';
import {
  getProgressionSuggestion,
  getWeightIncrement,
  buildExerciseHistory,
  getWeeklySummary,
  getGlobalFatigue,
  getMesocycleWeek,
  getMesocyclePhase,
  getStoredPersonalityMode,
  storePersonalityMode,
  ProgressionSuggestion,
  WeeklySummary,
  PersonalityMode,
} from '../services/progressionService';
import { classifyExercise } from '../services/exerciseClassifier';
import {
  getCoachFeedback,
  getConfidenceColor,
  getStateColor,
  getReadinessColor,
  getSuccessProbabilityColor,
  getSuccessProbabilityTextColor,
  getModeLabel,
  getModeDescription,
} from '../services/coachFeedback';
import Timer, { TimerRef } from '../components/Timer';
import Toast from '../components/Toast';
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  Save,
  Loader2,
  Trophy,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  Timer as TimerIcon,
  TrendingUp,
  AlertTriangle,
  ArrowDown,
  Activity,
  BarChart3,
  Shield,
  Zap,
  Target,
} from 'lucide-react';
import { Workout, SessionExercise, WorkoutSession } from '../types';

interface FlashState {
  exIdx: number;
  setIdx: number;
  timestamp: number;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

const PERSONALITY_MODES: PersonalityMode[] = ['conservative', 'balanced', 'aggressive'];

export default function ActiveWorkout() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addSession, sessions, exercises } = useAppStore();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [startTime, setStartTime] = useState(() => new Date().toISOString());
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
  const [activeRestTimer, setActiveRestTimer] = useState<{ exIdx: number; seconds: number } | null>(null);
  const [restOverrides, setRestOverrides] = useState<Record<number, number>>({});
  const [progressions, setProgressions] = useState<Record<number, ProgressionSuggestion>>({});
  const [appliedProgression, setAppliedProgression] = useState<Set<number>>(new Set());
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [showWeeklySummary, setShowWeeklySummary] = useState(true);
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>(getStoredPersonalityMode);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [globalFatigue, setGlobalFatigue] = useState(1);
  const [mesocycleWeek, setMesocycleWeek] = useState(1);
  const timerRefs = useRef<(TimerRef | null)[]>([]);
  const setRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  // Load workout, compute progression, and weekly summary
  useEffect(() => {
    if (!workoutId || !user) return;

    const load = async () => {
      setLoading(true);
      try {
        const mode = getStoredPersonalityMode();
        setPersonalityMode(mode);

        const gf = getGlobalFatigue(sessions);
        setGlobalFatigue(gf);

        const mw = getMesocycleWeek(sessions);
        setMesocycleWeek(mw);

        const summary = getWeeklySummary(
          sessions,
          exercises.map((e) => ({ id: e.id, name: e.name })),
          mode
        );
        setWeeklySummary(summary);

        const saved = loadActiveWorkout();
        if (saved && saved.workoutId === workoutId) {
          setWorkout({
            id: saved.workoutId,
            name: saved.workoutName,
            description: '',
            exercises: [],
            userId: user.uid,
            createdAt: '',
            updatedAt: '',
          });
          setSessionExercises(saved.exercises);
          setStartTime(saved.startTime);
          setSessionDuration(saved.durationSeconds);
          showToast('Workout resumed');
          setLoading(false);
          return;
        }

        const w = await getWorkoutById(workoutId);
        if (!w) {
          setLoading(false);
          return;
        }

        setWorkout(w);
        const start = new Date().toISOString();
        setStartTime(start);

        const exercisesWithProgression = await Promise.all(
          w.exercises.map(async (ex, exIdx) => {
            const history = buildExerciseHistory(sessions, ex.exerciseId);
            const exerciseMeta = exercises.find((e) => e.id === ex.exerciseId);
            const difficultyClass = classifyExercise(ex.exerciseName, exerciseMeta?.muscleGroup || '');
            const prog = getProgressionSuggestion(history, ex.reps, gf, mode, null, null, difficultyClass);
            setProgressions((prev) => ({ ...prev, [exIdx]: prog }));

            let weight: number;
            let reps: number;

            if (prog.confidence >= 0.3 && prog.state !== 'new' && prog.suggestedWeight > 0) {
              weight = prog.suggestedWeight;
              reps = prog.suggestedReps;
            } else {
              const lastPerf = await getLastPerformance(user.uid, ex.exerciseId);
              weight = lastPerf?.weight ?? ex.weight;
              reps = lastPerf?.reps ?? ex.reps;
            }

            return {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              targetSets: ex.sets,
              targetReps: ex.reps,
              targetWeight: ex.weight,
              sets: Array.from({ length: ex.sets }, (_, i) => ({
                setNumber: i + 1,
                reps,
                weight,
                completed: false,
              })),
            };
          })
        );

        setSessionExercises(exercisesWithProgression);
        showToast('Workout started — progression targets loaded');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workoutId, user, sessions, exercises, showToast]);

  // Persist active workout
  useEffect(() => {
    if (!workout || completed || sessionExercises.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveActiveWorkout({
        workoutId: workout.id,
        workoutName: workout.name,
        exercises: sessionExercises,
        startTime,
        durationSeconds: sessionDuration,
      });
    }, 500);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [workout, sessionExercises, startTime, sessionDuration, completed]);

  useEffect(() => {
    if (completed) clearActiveWorkout();
  }, [completed]);

  const handleModeChange = (mode: PersonalityMode) => {
    setPersonalityMode(mode);
    storePersonalityMode(mode);
    setShowModeSelector(false);
    showToast(`Switched to ${getModeLabel(mode)} mode`);
  };

  const applyProgression = useCallback((exIdx: number) => {
    const prog = progressions[exIdx];
    if (!prog || prog.suggestedWeight <= 0) return;
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      ex.sets = ex.sets.map((s) => ({
        ...s,
        weight: prog.suggestedWeight,
        reps: prog.suggestedReps,
      }));
      updated[exIdx] = ex;
      return updated;
    });
    setAppliedProgression((prev) => new Set(prev).add(exIdx));
    showToast(`Applied: ${prog.suggestedWeight}kg × ${prog.suggestedReps} reps`);
  }, [progressions, showToast]);

  const updateSetField = useCallback((exIdx: number, setIdx: number, field: 'reps' | 'weight', value: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      ex.sets = sets;
      updated[exIdx] = ex;
      return updated;
    });
  }, []);

  const adjustWeight = useCallback((exIdx: number, setIdx: number, delta: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      const sets = [...ex.sets];
      const current = sets[setIdx].weight;
      const next = Math.max(0, Math.round((current + delta) * 10) / 10);
      sets[setIdx] = { ...sets[setIdx], weight: next };
      ex.sets = sets;
      updated[exIdx] = ex;
      return updated;
    });
  }, []);

  const completeSet = useCallback((exIdx: number, setIdx: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], completed: true };
      ex.sets = sets;
      updated[exIdx] = ex;
      return updated;
    });
    setFlash({ exIdx, setIdx, timestamp: Date.now() });
    setTimeout(() => setFlash(null), 600);
    const restSeconds = restOverrides[exIdx] ?? workout?.exercises[exIdx]?.restSeconds ?? 60;
    setActiveRestTimer({ exIdx, seconds: restSeconds });
    setTimeout(() => { timerRefs.current[exIdx]?.start(); }, 50);
    setTimeout(() => {
      const nextSetIdx = setIdx + 1;
      const currentEx = sessionExercises[exIdx];
      if (nextSetIdx < currentEx.sets.length) {
        setRefs.current[exIdx]?.[nextSetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const nextExIdx = exIdx + 1;
        if (nextExIdx < sessionExercises.length) {
          setCollapsedExercises((prev) => {
            const next = new Set(prev);
            next.delete(nextExIdx);
            return next;
          });
          setTimeout(() => {
            const firstSet = setRefs.current[nextExIdx]?.[0];
            firstSet?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    }, 300);
  }, [workout, restOverrides, sessionExercises]);

  const uncompleteSet = useCallback((exIdx: number, setIdx: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], completed: false };
      ex.sets = sets;
      updated[exIdx] = ex;
      return updated;
    });
  }, []);

  const addSet = useCallback((exIdx: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets = [
        ...ex.sets,
        {
          setNumber: ex.sets.length + 1,
          reps: lastSet?.reps || ex.targetReps,
          weight: lastSet?.weight || ex.targetWeight,
          completed: false,
        },
      ];
      updated[exIdx] = ex;
      return updated;
    });
  }, []);

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      ex.sets = ex.sets.filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 }));
      updated[exIdx] = ex;
      return updated;
    });
  }, []);

  const markAllComplete = useCallback((exIdx: number) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      const ex = { ...updated[exIdx] };
      ex.sets = ex.sets.map((s) => ({ ...s, completed: true }));
      updated[exIdx] = ex;
      return updated;
    });
    showToast('All sets marked complete');
  }, [showToast]);

  const calculateVolume = useMemo(() => {
    return sessionExercises.reduce((total, ex) => {
      return total + ex.sets.filter((s) => s.completed).reduce((sum, s) => sum + s.reps * s.weight, 0);
    }, 0);
  }, [sessionExercises]);

  const handleFinish = async () => {
    if (!user || !workout) return;
    setSaving(true);
    const totalVolume = calculateVolume;
    const sessionData: Omit<WorkoutSession, 'id' | 'userId' | 'createdAt'> = {
      workoutId: workout.id,
      workoutName: workout.name,
      exercises: sessionExercises,
      startTime,
      endTime: new Date().toISOString(),
      durationSeconds: sessionDuration,
      totalVolume,
    };
    try {
      const created = await createSession(user.uid, sessionData);
      addSession(created);
      setCompleted(true);
      showToast('Workout saved successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to save workout', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleCollapse = (exIdx: number) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exIdx)) next.delete(exIdx);
      else next.add(exIdx);
      return next;
    });
  };

  const completedSets = sessionExercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = sessionExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const allExercisesComplete = sessionExercises.every((ex) => ex.sets.every((s) => s.completed));

  const mesocyclePhase = getMesocyclePhase(mesocycleWeek, personalityMode);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Trophy className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900 dark:text-white">Workout Complete!</h1>
        <p className="mb-6 text-slate-500 dark:text-slate-400">
          Great job finishing <span className="font-semibold text-slate-700 dark:text-slate-300">{workout?.name}</span>
        </p>
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{completedSets}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sets Done</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(sessionDuration / 60)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Minutes</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{calculateVolume.toLocaleString()}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Volume (kg)</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-slate-500 dark:text-slate-400">Workout not found.</p>
        <button
          onClick={() => navigate('/workouts')}
          className="mt-4 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white"
        >
          Go to Workouts
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} />
      ))}

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="text-center">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white">{workout.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {completedSets}/{totalSets} · {calculateVolume.toLocaleString()} kg
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Global Fatigue Badge */}
            <div
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                globalFatigue > 1.1
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  : globalFatigue > 0.9
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
              }`}
            >
              <Activity className="h-3 w-3" />
              {Math.round(globalFatigue * 100)}%
            </div>
            <Timer autoStart onTick={setSessionDuration} compact />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-3 p-4 pb-28">
        {/* Personality Mode + Mesocycle Bar */}
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Week {mesocycleWeek} · {mesocyclePhase.charAt(0).toUpperCase() + mesocyclePhase.slice(1)}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowModeSelector(!showModeSelector)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {personalityMode === 'conservative' ? <Shield className="h-3 w-3" /> : personalityMode === 'aggressive' ? <Zap className="h-3 w-3" /> : <Target className="h-3 w-3" />}
              {getModeLabel(personalityMode)}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showModeSelector && (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl bg-white p-2 shadow-xl dark:bg-slate-800">
                {PERSONALITY_MODES.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeChange(mode)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                      personalityMode === mode
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {mode === 'conservative' ? <Shield className="h-4 w-4" /> : mode === 'aggressive' ? <Zap className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                    <div>
                      <p className="font-semibold">{getModeLabel(mode)}</p>
                      <p className="text-[10px] opacity-70">{getModeDescription(mode)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Weekly Summary Banner */}
        {weeklySummary && showWeeklySummary && (
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">This Week</h2>
              </div>
              <button
                onClick={() => setShowWeeklySummary(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">{weeklySummary.topMessage}</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{weeklySummary.totalWorkouts}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Workouts</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{weeklySummary.totalVolume.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Volume</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800">
                <p className={`text-lg font-bold ${weeklySummary.volumeChangePercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {weeklySummary.volumeChangePercent >= 0 ? '+' : ''}{weeklySummary.volumeChangePercent}%
                </p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">vs Last</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800">
                <p className={`text-lg font-bold ${weeklySummary.globalFatigue > 1.1 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {Math.round(weeklySummary.globalFatigue * 100)}%
                </p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Fatigue</p>
              </div>
            </div>
            {/* Next Week Guidance */}
            <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-900/10">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Next Week</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">{weeklySummary.nextWeekGuidance}</p>
            </div>
            {weeklySummary.insights.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {weeklySummary.insights.slice(0, 3).map((insight) => (
                  <div key={insight.exerciseId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{insight.exerciseName}</span>
                    <div className="flex items-center gap-2">
                      {insight.fatigueSignal === 'rising' && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">Fatigue ↑</span>
                      )}
                      <span className={`text-xs font-semibold ${insight.weightChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : insight.weightChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {insight.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exercises */}
        {sessionExercises.map((ex, exIdx) => {
          const isCollapsed = collapsedExercises.has(exIdx);
          const exCompletedCount = ex.sets.filter((s) => s.completed).length;
          const exAllComplete = exCompletedCount === ex.sets.length;
          const isFlashing = flash?.exIdx === exIdx;
          const prog = progressions[exIdx];
          const feedback = prog ? getCoachFeedback(prog) : null;
          const hasProgression = prog && prog.state !== 'new' && prog.suggestedWeight > 0;
          const isApplied = appliedProgression.has(exIdx);
          const increment = ex.sets[0] ? getWeightIncrement(ex.sets[0].weight) : 2.5;

          return (
            <div
              key={ex.exerciseId}
              className={`rounded-2xl bg-white shadow-sm transition-all dark:bg-slate-900 ${exAllComplete ? 'opacity-80' : ''} ${isFlashing ? 'ring-2 ring-emerald-400' : ''}`}
            >
              {/* Exercise Header */}
              <button onClick={() => toggleCollapse(exIdx)} className="flex w-full items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${exAllComplete ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {exAllComplete ? <Check className="h-5 w-5" /> : <span className="text-sm font-bold">{exIdx + 1}</span>}
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{ex.exerciseName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {exCompletedCount}/{ex.sets.length} sets · Target: {ex.targetSets}×{ex.targetReps}-{ex.targetReps + 4}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!exAllComplete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markAllComplete(exIdx); }}
                      className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300"
                    >
                      All Done
                    </button>
                  )}
                  {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="space-y-2 px-4 pb-4">
                  {/* Progression Banner */}
                  {hasProgression && !exAllComplete && feedback && (
                    <div className={`mb-2 rounded-xl px-3 py-2.5 text-xs ${getStateColor(prog.state)}`}>
                      <div className="flex items-start gap-2">
                        {prog.state === 'stalled' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : prog.state === 'regressing' ? <ArrowDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : prog.state === 'deload' ? <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : prog.state === 'bad_day' ? <Activity className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> : <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            Next: {prog.suggestedWeight}kg × {prog.suggestedReps}
                            <span className={`ml-1.5 ${getConfidenceColor(feedback.confidenceLabel)}`}>({feedback.confidenceLabel})</span>
                          </p>
                          <p className="mt-0.5 truncate opacity-80">{feedback.message}</p>
                          <p className="mt-0.5 truncate opacity-60">{prog.reason}</p>
                          {/* Meta row */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className={`text-[10px] font-medium ${getReadinessColor(prog.readiness)}`}>
                              Readiness: {feedback.readinessLabel}
                            </span>
                            <span className="text-[10px] opacity-60">{feedback.fatigueNote}</span>
                            {/* Success Probability */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] opacity-60">Success:</span>
                              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                  className={`h-full rounded-full ${getSuccessProbabilityColor(prog.successProbability)}`}
                                  style={{ width: `${prog.successProbability * 100}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-semibold ${getSuccessProbabilityTextColor(prog.successProbability)}`}>
                                {Math.round(prog.successProbability * 100)}%
                              </span>
                            </div>
                            {prog.metrics.volatility > 0 && (
                              <span className="text-[10px] opacity-50">Vol: {Math.round(prog.metrics.volatility)}kg</span>
                            )}
                            <span className="text-[10px] opacity-50">
                              Data: {Math.round(prog.metrics.dataConfidence * 100)}%
                            </span>
                          </div>
                        </div>
                        {!isApplied && (
                          <button
                            onClick={() => applyProgression(exIdx)}
                            className="flex-shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-semibold shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rest Timer */}
                  {activeRestTimer?.exIdx === exIdx && !exAllComplete && (
                    <div className="mb-3">
                      <Timer
                        ref={(el) => { timerRefs.current[exIdx] = el; }}
                        mode="countdown"
                        countdownSeconds={activeRestTimer.seconds}
                        compact
                        onCountdownComplete={() => showToast('Rest complete — next set!')}
                      />
                    </div>
                  )}

                  {/* Sets */}
                  {ex.sets.map((set, setIdx) => {
                    const isFlashingSet = flash?.exIdx === exIdx && flash?.setIdx === setIdx;
                    return (
                      <div
                        key={setIdx}
                        ref={(el) => { if (!setRefs.current[exIdx]) setRefs.current[exIdx] = []; setRefs.current[exIdx][setIdx] = el; }}
                        className={`rounded-xl border p-2.5 transition-all ${set.completed ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'} ${isFlashingSet ? 'animate-pulse ring-2 ring-emerald-400' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400">{set.setNumber}</span>
                          <button
                            onClick={() => { if (set.completed) { uncompleteSet(exIdx, setIdx); } else { completeSet(exIdx, setIdx); } }}
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 ${set.completed ? 'bg-emerald-600 text-white dark:bg-emerald-500' : 'bg-white text-slate-400 shadow-sm hover:bg-emerald-50 hover:text-emerald-600 dark:bg-slate-700 dark:text-slate-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400'}`}
                          >
                            {set.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                          </button>
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Reps</label>
                            <input
                              type="number" min={0} value={set.reps} disabled={set.completed}
                              onChange={(e) => updateSetField(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Weight</label>
                            <div className="flex items-center gap-1">
                              <button onClick={() => adjustWeight(exIdx, setIdx, -increment)} disabled={set.completed} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-300 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number" min={0} step={0.5} value={set.weight} disabled={set.completed}
                                onChange={(e) => updateSetField(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-1 py-1.5 text-center text-sm font-semibold disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                              />
                              <button onClick={() => adjustWeight(exIdx, setIdx, increment)} disabled={set.completed} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-300 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {!set.completed && (
                            <button onClick={() => removeSet(exIdx, setIdx)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button onClick={() => addSet(exIdx)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400">
                    <Plus className="h-3.5 w-3.5" />
                    Add Set
                  </button>

                  <div className="flex items-center gap-2 pt-1">
                    <TimerIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Rest:</span>
                    {[30, 60, 90, 120, 180].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setRestOverrides((prev) => ({ ...prev, [exIdx]: sec }))}
                        className={`rounded-md px-2 py-0.5 text-xs ${restOverrides[exIdx] === sec ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
                      >
                        {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Finish Button */}
        <button
          onClick={handleFinish}
          disabled={saving}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold shadow-lg transition-all active:scale-[0.98] ${allExercisesComplete ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600' : 'bg-slate-600 text-white hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600'} disabled:opacity-60`}
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {allExercisesComplete ? 'Finish Workout' : `Finish (${completedSets}/${totalSets} sets)`}
        </button>
      </div>
    </div>
  );
}
