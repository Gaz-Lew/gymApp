const COMPOUND_KEYWORDS = [
  'squat', 'deadlift', 'bench', 'press', 'row', 'pull-up', 'pullup',
  'dip', 'clean', 'snatch', 'thruster', 'burpee', 'lunge',
];

const ISOLATION_KEYWORDS = [
  'curl', 'extension', 'fly', 'raise', 'shrug', 'crunch',
  'kickback', 'concentration', 'lateral', 'front raise',
];

export type DifficultyClass = 'compound' | 'isolation' | 'hybrid';

export function classifyExercise(name: string, muscleGroup: string): DifficultyClass {
  const lower = name.toLowerCase();

  const compoundScore = COMPOUND_KEYWORDS.filter((k) => lower.includes(k)).length;
  const isolationScore = ISOLATION_KEYWORDS.filter((k) => lower.includes(k)).length;

  if (compoundScore > 0 && isolationScore === 0) return 'compound';
  if (isolationScore > 0 && compoundScore === 0) return 'isolation';

  // Fallback: multi-joint muscle groups tend to be compound
  const compoundMuscles = ['legs', 'back', 'chest'];
  const isolationMuscles = ['biceps', 'triceps', 'calves', 'rear delt'];

  const mg = muscleGroup.toLowerCase();
  if (compoundMuscles.some((m) => mg.includes(m))) return 'compound';
  if (isolationMuscles.some((m) => mg.includes(m))) return 'isolation';

  return 'hybrid';
}

export function getDifficultyMultiplier(difficulty: DifficultyClass): number {
  if (difficulty === 'compound') return 0.85; // slower progression
  if (difficulty === 'isolation') return 1.15; // faster progression
  return 1.0;
}
