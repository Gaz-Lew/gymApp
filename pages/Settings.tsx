import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { useNavigate } from 'react-router-dom';
import { downloadJSON, importFromJSON, mergeAppData } from '../services/importExportService';
import {
  createExercise,
  deleteExercise,
} from '../services/exerciseService';
import {
  createWorkout,
  deleteWorkout,
} from '../services/workoutService';
import {
  createPlan,
  deletePlan,
} from '../services/planService';
import {
  createSession,
} from '../services/sessionService';
import {
  LogOut,
  Download,
  Upload,
  Moon,
  Sun,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';

export default function Settings() {
  const { user, logout } = useAuth();
  const { exercises, workouts, plans, sessions, reset, setExercises, setWorkouts, setPlans, setSessions } = useAppStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const handleLogout = async () => {
    await logout();
    reset();
    navigate('/login');
  };

  const handleExport = () => {
    downloadJSON({ exercises, workouts, plans, sessions });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    setImportMsg('');
    try {
      const data = await importFromJSON(file);

      let merged = data;
      if (importMode === 'merge') {
        merged = mergeAppData(
          { exercises, workouts, plans, sessions },
          data
        );
      }

      // Clear existing user data if replacing
      if (importMode === 'replace') {
        for (const ex of exercises.filter((x) => x.userId === user.uid)) {
          await deleteExercise(ex.id);
        }
        for (const w of workouts) {
          await deleteWorkout(w.id);
        }
        for (const p of plans) {
          await deletePlan(p.id);
        }
      }

      // Import new data
      const newExercises = [];
      for (const ex of merged.exercises) {
        if (ex.userId === null) continue;
        const existing = exercises.find((e) => e.id === ex.id);
        if (existing) {
          newExercises.push(existing);
          continue;
        }
        const created = await createExercise(user.uid, {
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          equipment: ex.equipment,
          instructions: ex.instructions,
        });
        newExercises.push(created);
      }

      const workoutIdMap: Record<string, string> = {};
      const newWorkouts = [];
      for (const w of merged.workouts) {
        const existing = workouts.find((wo) => wo.id === w.id);
        if (existing) {
          newWorkouts.push(existing);
          workoutIdMap[w.id] = w.id;
          continue;
        }
        const created = await createWorkout(user.uid, {
          name: w.name,
          description: w.description,
          exercises: w.exercises,
        });
        workoutIdMap[w.id] = created.id;
        newWorkouts.push(created);
      }

      const newPlans = [];
      for (const p of merged.plans) {
        const existing = plans.find((pl) => pl.id === p.id);
        if (existing) {
          newPlans.push(existing);
          continue;
        }
        const created = await createPlan(user.uid, {
          name: p.name,
          days: p.days.map((d) => ({
            day: d.day,
            workoutId: d.workoutId ? workoutIdMap[d.workoutId] || null : null,
            workoutName: d.workoutName,
          })),
        });
        newPlans.push(created);
      }

      const newSessions = [];
      for (const s of merged.sessions) {
        const existing = sessions.find((se) => se.id === s.id);
        if (existing) {
          newSessions.push(existing);
          continue;
        }
        const created = await createSession(user.uid, {
          workoutId: workoutIdMap[s.workoutId] || s.workoutId,
          workoutName: s.workoutName,
          exercises: s.exercises,
          startTime: s.startTime,
          endTime: s.endTime,
          durationSeconds: s.durationSeconds,
          totalVolume: s.totalVolume,
        });
        newSessions.push(created);
      }

      setExercises(newExercises);
      setWorkouts(newWorkouts);
      setPlans(newPlans);
      setSessions(newSessions);
      setImportMsg(`Import successful! ${importMode === 'merge' ? 'Merged' : 'Replaced'} data.`);
      setTimeout(() => setImportMsg(''), 3000);
    } catch (err: any) {
      setImportMsg(err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Account
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{user?.displayName || 'User'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? (
              <Moon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            ) : (
              <Sun className="h-5 w-5 text-amber-500" />
            )}
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {darkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              darkMode ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                darkMode ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
              style={{ transform: darkMode ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Data
        </h2>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Export Data</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Download all your data as JSON</p>
            </div>
          </button>

          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 disabled:opacity-60 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              {importing ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              ) : (
                <Upload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Import Data</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Restore from a JSON backup file</p>
              </div>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setImportMode('replace')}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                importMode === 'replace'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              Replace All
            </button>
            <button
              onClick={() => setImportMode('merge')}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                importMode === 'merge'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              Merge (Skip Duplicates)
            </button>
          </div>

          {importMsg && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                importMsg.includes('successful')
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
              }`}
            >
              {importMsg.includes('successful') ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {importMsg}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          About
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          FitTrack Pro v1.0
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Built with React, TypeScript, Tailwind CSS & Firebase.
        </p>
      </div>
    </div>
  );
}
