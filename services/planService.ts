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
import { Plan } from '../types';

const plansRef = collection(db, 'plans');

function docToPlan(docSnap: any): Plan {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    days: data.days || [],
    userId: data.userId,
    createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() || new Date().toISOString(),
  };
}

export async function getPlans(userId: string): Promise<Plan[]> {
  const q = query(plansRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToPlan);
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const docSnap = await getDoc(doc(plansRef, id));
  if (!docSnap.exists()) return null;
  return docToPlan(docSnap);
}

export async function createPlan(
  userId: string,
  data: Omit<Plan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<Plan> {
  const now = serverTimestamp();
  const docRef = await addDoc(plansRef, {
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

export async function updatePlan(
  id: string,
  data: Partial<Omit<Plan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(doc(plansRef, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlan(id: string): Promise<void> {
  await deleteDoc(doc(plansRef, id));
}
