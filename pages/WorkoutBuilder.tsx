import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { getWorkouts, createWorkout, updateWorkout, deleteWorkout } from '../services/workoutService';
import { getExercises } from '../services/exerciseService';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  X,
} from 'lucide-react';
import { Workout, WorkoutExercise, Exercise } from '../types';

export default function WorkoutBuilder() {
  const { user } = useAuth();
  const { workouts, exercises, setWorkouts, setExercises, addWorkout, updateWorkoutLocal, removeWorkout, loading, setLoading } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    exercises: [] as WorkoutExercise[],
  });

  useEffect(() => {
    if (!user) return;
    if (workouts.length === 0) {
      setLoading(true);
      getWorkouts(user.uid)
        .then(setWorkouts)
        .finally(() => setLoading(false));
    }
    if (exercises.length === 0) {
      getExercises(user.uid).then(setExercises);
    }
  }, [user, workouts.length, exercises.length, setWorkouts, setExercises, setLoading]);

  const openAdd = () => {
    setEditingWorkout(null);
    setForm({ name: '', description: '', exercises: [] });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (w: Workout) => {
    setEditingWorkout(w);
    setForm({ name: w.name, description: w.description, exercises: [...w.exercises] });
    setFormError('');
    setModalOpen(true);
  };

  const addExerciseToForm = (exercise: Exercise) => {
    const newEx: WorkoutExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: 3,
      reps: 10,
      weight: 0,
      restSeconds: 60,
    };
    setForm((prev) => ({ ...prev, exercises: [...prev.exercises, newEx] }));
  };

  const updateFormExercise = (index: number, field: keyof WorkoutExercise, value: number | string) => {
    setForm((prev) => {
      const updated = [...prev.exercises];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, exercises: updated };
    });
  };

  const removeFormExercise = (index: number) => {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      setFormError('Workout name is required');
      return;
    }
    if (form.exercises.length === 0) {
      setFormError('Add at least one exercise');
      return;
    }
    setSaving(true);
    try {
      if (editingWorkout) {
        await updateWorkout(editingWorkout.id, form);
        updateWorkoutLocal({ ...editingWorkout, ...form });
      } else {
        const created = await createWorkout(user.uid, form);
        addWorkout(created);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkout(id);
      removeWorkout(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workout Builder</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Workout</span>
        </button>
      </div>

      {loading && workouts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
          <Dumbbell className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No workouts yet. Create your first template!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="rounded-2xl bg-white shadow-sm dark:bg-slate-900"
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{w.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {w.exercises.length} exercises · {w.description || 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/active/${w.id}`}
                    className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    <Play className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => openEdit(w)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmId(w.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {expandedId === w.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {expandedId === w.id && (
                <div className="border-t border-slate-100 px-4 pb-4 dark:border-slate-800">
                  <div className="mt-3 space-y-2">
                    {w.exercises.map((ex, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800"
                      >
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{ex.exerciseName}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {ex.sets} sets × {ex.reps} reps · {ex.weight > 0 ? `${ex.weight}kg` : 'BW'} · {ex.restSeconds}s rest
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWorkout ? 'Edit Workout' : 'New Workout'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {formError}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="e.g. Push Day A"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Exercises</label>
            {form.exercises.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">No exercises added yet.</p>
            )}
            <div className="space-y-2">
              {form.exercises.map((ex, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{ex.exerciseName}</span>
                    <button
                      type="button"
                      onClick={() => removeFormExercise(idx)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Sets</label>
                      <input
                        type="number"
                        min={1}
                        value={ex.sets}
                        onChange={(e) => updateFormExercise(idx, 'sets', parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Reps</label>
                      <input
                        type="number"
                        min={1}
                        value={ex.reps}
                        onChange={(e) => updateFormExercise(idx, 'reps', parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Weight</label>
                      <input
                        type="number"
                        min={0}
                        value={ex.weight}
                        onChange={(e) => updateFormExercise(idx, 'weight', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Rest (s)</label>
                      <input
                        type="number"
                        min={0}
                        value={ex.restSeconds}
                        onChange={(e) => updateFormExercise(idx, 'restSeconds', parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Add Exercise</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => addExerciseToForm(ex)}
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingWorkout ? 'Save Changes' : 'Create Workout'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && handleDelete(confirmId)}
        title="Delete Workout"
        message="Are you sure you want to delete this workout template?"
      />
    </div>
  );
}
