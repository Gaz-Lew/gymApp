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
import { Workout } from '../types';

const workoutsRef = collection(db, 'workouts');

function docToWorkout(docSnap: any): Workout {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description,
    exercises: data.exercises || [],
    userId: data.userId,
    createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
  };
}

export async function getWorkouts(userId: string): Promise<Workout[]> {
  const q = query(workoutsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToWorkout);
}

export async function getWorkoutById(id: string): Promise<Workout | null> {
  const docSnap = await getDoc(doc(workoutsRef, id));
  if (!docSnap.exists()) return null;
  return docToWorkout(docSnap);
}

export async function createWorkout(
  userId: string,
  data: Omit<Workout, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Workout> {
  const now = serverTimestamp();
  const docRef = await addDoc(workoutsRef, {
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

export async function updateWorkout(
  id: string,
  data: Partial<Omit<Workout, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(workoutsRef, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWorkout(id: string): Promise<void> {
  await deleteDoc(doc(workoutsRef, id));
}
