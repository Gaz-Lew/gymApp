import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { getSessions } from '../services/sessionService';
import { getWorkouts } from '../services/workoutService';
import { getPlans } from '../services/planService';
import { getExercises } from '../services/exerciseService';
import { subscribeToOfflineChanges } from '../services/offlineManager';
import { getRecommendations } from '../services/recommendationService';
import { getStreakInfo } from '../services/analyticsService';
import {
  Dumbbell,
  CalendarDays,
  TrendingUp,
  Clock,
  Flame,
  ChevronRight,
  Play,
  Zap,
  RotateCcw,
  WifiOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO, startOfWeek, isSameWeek } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    sessions,
    workouts,
    plans,
    exercises,
    setSessions,
    setWorkouts,
    setPlans,
    setExercises,
    setLoading,
    loading,
    isOffline,
    setOffline,
  } = useAppStore();
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeToOfflineChanges(setOffline);
    return unsub;
  }, [setOffline]);

  useEffect(() => {
    if (!user || dataLoaded) return;
    const load = async () => {
      setLoading(true);
      try {
        const [s, w, p, e] = await Promise.all([
          getSessions(user.uid),
          getWorkouts(user.uid),
          getPlans(user.uid),
          getExercises(user.uid),
        ]);
        setSessions(s);
        setWorkouts(w);
        setPlans(p);
        setExercises(e);
        setDataLoaded(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, dataLoaded, setSessions, setWorkouts, setPlans, setExercises, setLoading]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekSessions = sessions.filter((s) =>
      isSameWeek(parseISO(s.startTime), weekStart, { weekStartsOn: 1 })
    );
    const totalVolume = thisWeekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const totalDuration = thisWeekSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const totalWorkouts = sessions.length;
    const streak = getStreakInfo(sessions);
    return {
      thisWeekCount: thisWeekSessions.length,
      totalVolume,
      totalDuration,
      totalWorkouts,
      currentStreak: streak.currentStreak,
    };
  }, [sessions]);

  const recommendations = useMemo(() => {
    const todayName = format(new Date(), 'EEEE');
    const todayPlanWorkoutId = plans[0]?.days.find((d) => d.day === todayName)?.workoutId;
    return getRecommendations(sessions, exercises, workouts, todayPlanWorkoutId);
  }, [sessions, exercises, workouts, plans]);

  const lastSession = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions[0];
  }, [sessions]);

  const todayName = format(new Date(), 'EEEE');
  const todayPlan = plans[0]?.days.find((d) => d.day === todayName);

  const handleResumeWorkout = useCallback(() => {
    if (lastSession?.workoutId) {
      navigate(`/active/${lastSession.workoutId}`);
    }
  }, [lastSession, navigate]);

  if (loading && sessions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Offline Banner */}
      {isOffline && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Changes will sync when you reconnect.</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Hello, {user?.displayName || 'Athlete'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>
        {stats.currentStreak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
            <Flame className="h-3.5 w-3.5" />
            {stats.currentStreak} day streak
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Flame className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.thisWeekCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">This Week</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalVolume.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Volume (kg)</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {Math.round(stats.totalDuration / 60)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Minutes</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Dumbbell className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalWorkouts}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Workouts</p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recommendations</h2>
          <div className="space-y-2">
            {recommendations.slice(0, 2).map((rec, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                  rec.type === 'planned'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : rec.type === 'rest'
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {rec.type === 'planned' ? <Play className="h-5 w-5" /> : rec.type === 'rest' ? <Zap className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{rec.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rec.description}</p>
                </div>
                {rec.workoutId && (
                  <Link
                    to={`/active/${rec.workoutId}`}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Workout */}
      {todayPlan?.workoutId ? (
        <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-lg dark:bg-emerald-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-100">Today's Workout</p>
              <p className="text-xl font-bold">{todayPlan.workoutName}</p>
            </div>
            <Link
              to={`/active/${todayPlan.workoutId}`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-600 shadow-md hover:bg-emerald-50"
            >
              <Play className="h-5 w-5 fill-current" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No workout planned</p>
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Rest day or check your planner</p>
            </div>
            <Link
              to="/planner"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300"
            >
              <CalendarDays className="h-5 w-5" />
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/workouts"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Dumbbell className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Workouts</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{workouts.length} templates</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
          </Link>
          <Link
            to="/planner"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <CalendarDays className="h-5 w-5 text-slate-700 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Planner</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{plans.length} plans</p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Resume Last Workout */}
      {lastSession && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Continue Training</h2>
          <button
            onClick={handleResumeWorkout}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <RotateCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Resume {lastSession.workoutName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Last session: {format(parseISO(lastSession.startTime), 'MMM d')} · {lastSession.totalVolume.toLocaleString()} kg
              </p>
            </div>
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Sessions</h2>
          <Link to="/history" className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400">
            View all
          </Link>
        </div>
        {sessions.slice(0, 5).length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">No workouts yet. Start your first session!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{session.workoutName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {format(parseISO(session.startTime), 'MMM d, yyyy')} · {Math.round(session.durationSeconds / 60)} min ·{' '}
                    {session.totalVolume.toLocaleString()} kg
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
