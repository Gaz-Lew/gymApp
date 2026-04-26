import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { getSessionsPaginated } from '../services/sessionService';
import { getExercises } from '../services/exerciseService';
import {
  getWeeklyVolumeTrends,
  getPersonalRecords,
  getMuscleGroupDistribution,
  getVolumeOverTime,
  getStreakInfo,
} from '../services/analyticsService';
import { format, parseISO, startOfWeek, isSameWeek, subWeeks } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Calendar,
  Clock,
  TrendingUp,
  Dumbbell,
  Loader2,
  Trophy,
  ChevronDown,
  Flame,
} from 'lucide-react';
import type { DocumentSnapshot } from 'firebase/firestore';

const MUSCLE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export default function History() {
  const { user } = useAuth();
  const { sessions, exercises, setSessions, setExercises, appendSessions, loading, setLoading } = useAppStore();
  const [pageSize] = useState(10);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!user || dataLoaded) return;
    const load = async () => {
      setLoading(true);
      try {
        const [s, e] = await Promise.all([
          getSessionsPaginated(user.uid, pageSize),
          getExercises(user.uid),
        ]);
        setSessions(s.sessions);
        setExercises(e);
        setLastDoc(s.lastDoc);
        setHasMore(s.sessions.length === pageSize);
        setDataLoaded(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, dataLoaded, pageSize, setSessions, setExercises, setLoading]);

  const loadMore = useCallback(async () => {
    if (!user || !hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const result = await getSessionsPaginated(user.uid, pageSize, lastDoc);
      appendSessions(result.sessions);
      setLastDoc(result.lastDoc);
      setHasMore(result.sessions.length === pageSize);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }, [user, hasMore, loadingMore, lastDoc, pageSize, appendSessions]);

  const stats = useMemo(() => {
    const now = new Date();
    const weeks = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekSessions = sessions.filter((s) =>
        isSameWeek(parseISO(s.startTime), weekStart, { weekStartsOn: 1 })
      );
      const volume = weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
      const duration = weekSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      return {
        label: format(weekStart, 'MMM d'),
        workouts: weekSessions.length,
        volume,
        duration: Math.round(duration / 60),
      };
    }).reverse();

    const totalVolume = sessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const totalDuration = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const avgVolume = sessions.length > 0 ? Math.round(totalVolume / sessions.length) : 0;
    const streak = getStreakInfo(sessions);

    return { weeks, totalVolume, totalDuration, avgVolume, streak };
  }, [sessions]);

  const personalRecords = useMemo(() => getPersonalRecords(sessions), [sessions]);
  const muscleDistribution = useMemo(
    () => getMuscleGroupDistribution(sessions, exercises),
    [sessions, exercises]
  );
  const volumeTrends = useMemo(() => getWeeklyVolumeTrends(sessions, 8), [sessions]);
  const volumeOverTime = useMemo(() => getVolumeOverTime(sessions), [sessions]);

  if (loading && sessions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">History & Progress</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Dumbbell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{sessions.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Workouts</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalVolume.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Volume (kg)</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {Math.round(stats.totalDuration / 60)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Minutes</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.avgVolume.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Volume</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.streak.currentStreak}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Day Streak</p>
        </div>
      </div>

      {/* Volume Over Time Line Chart */}
      {volumeOverTime.length > 1 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Volume Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weekly Volume Bar Chart */}
      {sessions.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Weekly Volume (kg)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="volume" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Muscle Group Distribution */}
      {muscleDistribution.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Muscle Group Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={muscleDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="muscleGroup"
                >
                  {muscleDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={MUSCLE_COLORS[index % MUSCLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value, name, props: any) => [
                    `${value} (${props?.payload?.percentage}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {muscleDistribution.map((item, index) => (
              <div key={item.muscleGroup} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: MUSCLE_COLORS[index % MUSCLE_COLORS.length] }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {item.muscleGroup} ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personal Records */}
      {personalRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Personal Records</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {personalRecords.slice(0, 6).map((pr) => (
              <div
                key={pr.exerciseId}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{pr.exerciseName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {pr.maxWeight > 0 ? `${pr.maxWeight}kg` : 'BW'} × {pr.maxReps} reps
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Sessions with Pagination */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">All Sessions</h2>
        {sessions.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No workout sessions yet.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{session.workoutName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(parseISO(session.startTime), 'EEEE, MMMM do, yyyy')} ·{' '}
                        {Math.round(session.durationSeconds / 60)} minutes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {session.totalVolume.toLocaleString()} kg
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {session.exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0)} sets
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {session.exercises.map((ex) => (
                      <span
                        key={ex.exerciseId}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {ex.exerciseName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Load More
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
