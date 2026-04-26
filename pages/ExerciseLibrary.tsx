import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { getExercises, createExercise, updateExercise, deleteExercise } from '../services/exerciseService';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Search, Plus, Filter, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Exercise } from '../types';

const muscleGroups = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Hamstrings', 'Quadriceps', 'Calves', 'Glutes'];
const equipmentTypes = ['All', 'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Box', 'Pull-Up Bar'];

export default function ExerciseLibrary() {
  const { user } = useAuth();
  const { exercises, workouts, setExercises, addExercise, updateExerciseLocal, removeExercise, loading, setLoading } = useAppStore();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [equipmentFilter, setEquipmentFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    instructions: '',
  });

  useEffect(() => {
    if (!user) return;
    if (exercises.length === 0) {
      setLoading(true);
      getExercises(user.uid)
        .then(setExercises)
        .finally(() => setLoading(false));
    }
  }, [user, exercises.length, setExercises, setLoading]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = muscleFilter === 'All' || ex.muscleGroup === muscleFilter;
      const matchesEquipment = equipmentFilter === 'All' || ex.equipment === equipmentFilter;
      return matchesSearch && matchesMuscle && matchesEquipment;
    });
  }, [exercises, search, muscleFilter, equipmentFilter]);

  const openAdd = () => {
    setEditingExercise(null);
    setForm({ name: '', muscleGroup: 'Chest', equipment: 'Barbell', instructions: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (ex: Exercise) => {
    setEditingExercise(ex);
    setForm({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      equipment: ex.equipment,
      instructions: ex.instructions,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingExercise) {
        await updateExercise(editingExercise.id, form);
        updateExerciseLocal({ ...editingExercise, ...form });
      } else {
        const created = await createExercise(user.uid, form);
        addExercise(created);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isExerciseUsed = (id: string): boolean => {
    return workouts.some((w) => w.exercises.some((ex) => ex.exerciseId === id));
  };

  const handleDelete = async (id: string) => {
    if (isExerciseUsed(id)) {
      setFormError('Cannot delete: this exercise is used in one or more workouts.');
      return;
    }
    try {
      await deleteExercise(id);
      removeExercise(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Exercise Library</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Exercise</span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-emerald-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            showFilters
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filter</span>
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <select
            value={muscleFilter}
            onChange={(e) => setMuscleFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {muscleGroups.map((g) => (
              <option key={g} value={g}>
                {g === 'All' ? 'All Muscles' : g}
              </option>
            ))}
          </select>
          <select
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {equipmentTypes.map((eq) => (
              <option key={eq} value={eq}>
                {eq === 'All' ? 'All Equipment' : eq}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && exercises.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">No exercises found.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              className="rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{ex.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {ex.muscleGroup}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {ex.equipment}
                    </span>
                  </div>
                </div>
                {ex.userId && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(ex)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmId(ex.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-3">
                {ex.instructions}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingExercise ? 'Edit Exercise' : 'Add Exercise'}>
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
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Muscle Group</label>
              <select
                value={form.muscleGroup}
                onChange={(e) => setForm({ ...form, muscleGroup: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {muscleGroups.filter((g) => g !== 'All').map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Equipment</label>
              <select
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {equipmentTypes.filter((e) => e !== 'All').map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Instructions</label>
            <textarea
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingExercise ? 'Save Changes' : 'Add Exercise'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && handleDelete(confirmId)}
        title="Delete Exercise"
        message="Are you sure you want to delete this exercise? This action cannot be undone."
      />
    </div>
  );
}
