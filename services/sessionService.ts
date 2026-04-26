import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { WorkoutSession } from '../types';

const sessionsRef = collection(db, 'sessions');

function docToSession(docSnap: any): WorkoutSession {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    workoutId: data.workoutId,
    workoutName: data.workoutName,
    exercises: data.exercises || [],
    startTime: data.startTime?.toDate?.().toISOString() || data.startTime,
    endTime: data.endTime?.toDate?.().toISOString() || data.endTime,
    durationSeconds: data.durationSeconds || 0,
    totalVolume: data.totalVolume || 0,
    userId: data.userId,
    createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
  };
}

export async function getSessions(userId: string): Promise<WorkoutSession[]> {
  const q = query(sessionsRef, where('userId', '==', userId), orderBy('startTime', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToSession);
}

export async function getSessionsPaginated(
  userId: string,
  pageSize: number = 10,
  lastDoc?: DocumentSnapshot
): Promise<{ sessions: WorkoutSession[]; lastDoc: DocumentSnapshot | null }> {
  let q;
  if (lastDoc) {
    q = query(
      sessionsRef,
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      startAfter(lastDoc),
      limit(pageSize)
    );
  } else {
    q = query(
      sessionsRef,
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      limit(pageSize)
    );
  }
  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(docToSession);
  const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { sessions, lastDoc: newLastDoc };
}

export async function getSessionById(id: string): Promise<WorkoutSession | null> {
  const docSnap = await getDoc(doc(sessionsRef, id));
  if (!docSnap.exists()) return null;
  return docToSession(docSnap);
}

export async function createSession(
  userId: string,
  data: Omit<WorkoutSession, 'id' | 'userId' | 'createdAt'>
): Promise<WorkoutSession> {
  const docRef = await addDoc(sessionsRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
  });
  return {
    id: docRef.id,
    ...data,
    userId,
    createdAt: new Date().toISOString(),
  };
}

export interface LastPerformance {
  weight: number;
  reps: number;
}

export async function getLastPerformance(
  userId: string,
  exerciseId: string
): Promise<LastPerformance | null> {
  const q = query(
    sessionsRef,
    where('userId', '==', userId),
    where('exercises', '!=', []),
    orderBy('startTime', 'desc'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(docToSession);

  for (const session of sessions) {
    const ex = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) {
      const completedSets = ex.sets.filter((s) => s.completed);
      if (completedSets.length > 0) {
        const lastSet = completedSets[completedSets.length - 1];
        return { weight: lastSet.weight, reps: lastSet.reps };
      }
    }
  }
  return null;
}
