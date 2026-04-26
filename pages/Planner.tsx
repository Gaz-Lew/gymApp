import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { getPlans, createPlan, updatePlan } from '../services/planService';
import { getWorkouts } from '../services/workoutService';
import { getExercises } from '../services/exerciseService';
import { getRecommendations } from '../services/recommendationService';
import { DAYS_OF_WEEK, Plan, PlanDay } from '../types';
import Modal from '../components/Modal';
import { CalendarDays, Plus, Save, Loader2, Check, Lightbulb, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Planner() {
  const { user } = useAuth();
  const { plans, workouts, exercises, sessions, setPlans, setWorkouts, setExercises, addPlan, updatePlanLocal, loading, setLoading } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [planName, setPlanName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [dayAssignments, setDayAssignments] = useState<Record<string, string | null>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!user || dataLoaded) return;
    const load = async () => {
      setLoading(true);
      try {
        const [p, w, e] = await Promise.all([
          getPlans(user.uid),
          getWorkouts(user.uid),
          getExercises(user.uid),
        ]);
        setPlans(p);
        setWorkouts(w);
        setExercises(e);
        setDataLoaded(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, dataLoaded, setPlans, setWorkouts, setExercises, setLoading]);

  const openCreate = () => {
    setPlanName('');
    setDayAssignments(
      DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: null }), {})
    );
    setSelectedPlan(null);
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setPlanName(plan.name);
    const assignments: Record<string, string | null> = {};
    plan.days.forEach((d) => {
      assignments[d.day] = d.workoutId;
    });
    DAYS_OF_WEEK.forEach((day) => {
      if (!(day in assignments)) assignments[day] = null;
    });
    setDayAssignments(assignments);
    setSelectedPlan(plan);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !planName.trim()) return;
    const days: PlanDay[] = DAYS_OF_WEEK.map((day) => {
      const workoutId = dayAssignments[day];
      const workout = workouts.find((w) => w.id === workoutId);
      return {
        day,
        workoutId: workoutId || null,
        workoutName: workout?.name || null,
      };
    });
    setSaving(true);
    try {
      if (selectedPlan) {
        await updatePlan(selectedPlan.id, { name: planName, days });
        updatePlanLocal({ ...selectedPlan, name: planName, days });
      } else {
        const created = await createPlan(user.uid, { name: planName, days });
        addPlan(created);
      }
      setModalOpen(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const activePlan = plans[0];

  const recommendations = useMemo(() => {
    if (!activePlan) return [];
    const emptyDays = activePlan.days.filter((d) => !d.workoutId).map((d) => d.day);
    if (emptyDays.length === 0) return [];

    const recs = getRecommendations(sessions, exercises, workouts);
    return recs.filter((r) => r.type !== 'planned' && r.type !== 'rest').slice(0, 3);
  }, [activePlan, sessions, exercises, workouts]);

  const suggestedWorkoutsForDay = (_dayName: string) => {
    const recs = getRecommendations(sessions, exercises, workouts);
    const muscleRec = recs.find((r) => r.muscleGroups && r.muscleGroups.length > 0);
    if (!muscleRec?.muscleGroups) return [];
    return workouts.filter((w) =>
      w.exercises.some((ex) =>
        muscleRec.muscleGroups!.some((mg) =>
          ex.exerciseName.toLowerCase().includes(mg.toLowerCase()) ||
          exercises.find((e) => e.id === ex.exerciseId)?.muscleGroup === mg
        )
      )
    );
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Weekly Planner</h1>
        <div className="flex items-center gap-2">
          {savedMsg && (
            <span className="flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Plan</span>
          </button>
        </div>
      </div>

      {/* Recommendations for empty days */}
      {recommendations.length > 0 && activePlan && (
        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/10">
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Suggestions</h3>
          </div>
          <div className="space-y-1.5">
            {recommendations.map((rec, idx) => (
              <p key={idx} className="text-xs text-amber-700 dark:text-amber-400">
                {rec.description}
              </p>
            ))}
          </div>
        </div>
      )}

      {loading && plans.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : activePlan ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{activePlan.name}</h2>
            <button
              onClick={() => openEdit(activePlan)}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Edit Plan
            </button>
          </div>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const dayPlan = activePlan.days.find((d) => d.day === day);
              const hasWorkout = !!dayPlan?.workoutId;
              const suggestions = !hasWorkout ? suggestedWorkoutsForDay(day) : [];
              return (
                <div
                  key={day}
                  className={`rounded-2xl p-4 shadow-sm ${
                    hasWorkout
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          hasWorkout
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                        }`}
                      >
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{day}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {dayPlan?.workoutName || 'Rest Day'}
                        </p>
                      </div>
                    </div>
                    {hasWorkout && dayPlan?.workoutId && (
                      <Link
                        to={`/active/${dayPlan.workoutId}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      >
                        <Wand2 className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                  {!hasWorkout && suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
                      {suggestions.slice(0, 3).map((w) => (
                        <Link
                          key={w.id}
                          to={`/active/${w.id}`}
                          className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                        >
                          {w.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No weekly plan yet. Create one to get started!</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={selectedPlan ? 'Edit Plan' : 'New Weekly Plan'}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Plan Name</label>
            <input
              type="text"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="e.g. My Weekly Split"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Assign Workouts</label>
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{day}</span>
                <select
                  value={dayAssignments[day] || ''}
                  onChange={(e) =>
                    setDayAssignments((prev) => ({ ...prev, [day]: e.target.value || null }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">Rest Day</option>
                  {workouts.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !planName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Plan
          </button>
        </div>
      </Modal>
    </div>
  );
}
