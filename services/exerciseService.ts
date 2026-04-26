import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Exercise } from '../types';
import { defaultExercises } from '../utils/seedData';

const exercisesRef = collection(db, 'exercises');

function docToExercise(docSnap: any): Exercise {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    muscleGroup: data.muscleGroup,
    equipment: data.equipment,
    instructions: data.instructions,
    userId: data.userId || null,
    createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
  };
}

export async function seedDefaultExercises(): Promise<void> {
  const snapshot = await getDocs(exercisesRef);
  if (!snapshot.empty) return;

  const batch = defaultExercises.map((ex) =>
    addDoc(exercisesRef, {
      ...ex,
      userId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await Promise.all(batch);
}

export async function getExercises(userId: string): Promise<Exercise[]> {
  await seedDefaultExercises();
  const [userSnap, defaultSnap] = await Promise.all([
    getDocs(query(exercisesRef, where('userId', '==', userId))),
    getDocs(query(exercisesRef, where('userId', '==', null))),
  ]);
  const userExercises = userSnap.docs.map(docToExercise);
  const defaultExercises = defaultSnap.docs.map(docToExercise);
  return [...defaultExercises, ...userExercises];
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const docSnap = await getDoc(doc(exercisesRef, id));
  if (!docSnap.exists()) return null;
  return docToExercise(docSnap);
}

export async function createExercise(
  userId: string,
  data: Omit<Exercise, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Exercise> {
  const now = serverTimestamp();
  const docRef = await addDoc(exercisesRef, {
    ...data,
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: docRef.id,
    ...data,
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateExercise(
  id: string,
  data: Partial<Omit<Exercise, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(exercisesRef, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExercise(id: string): Promise<void> {
  await deleteDoc(doc(exercisesRef, id));
}
