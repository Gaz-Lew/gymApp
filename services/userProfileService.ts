import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

const usersRef = (userId: string) => doc(db, 'users', userId);

export const DEFAULT_PROFILE: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'createdAt'> = {
  strengthLevel: 'beginner',
  recoveryRate: 1.0,
  preferredIntensity: 'moderate',
  consistencyScore: 0.5,
  baselineVolume: 0,
  baselineLastUpdated: new Date().toISOString(),
  progressionAggressiveness: 1.0,
};

function docToProfile(docSnap: any): UserProfile {
  const data = docSnap.data();
  return {
    uid: docSnap.id,
    email: data.email || '',
    displayName: data.displayName || '',
    createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    strengthLevel: data.strengthLevel || 'beginner',
    recoveryRate: data.recoveryRate ?? 1.0,
    preferredIntensity: data.preferredIntensity || 'moderate',
    consistencyScore: data.consistencyScore ?? 0.5,
    baselineVolume: data.baselineVolume ?? 0,
    baselineLastUpdated: data.baselineLastUpdated?.toDate?.().toISOString() || new Date().toISOString(),
    progressionAggressiveness: data.progressionAggressiveness ?? 1.0,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docSnap = await getDoc(usersRef(userId));
  if (!docSnap.exists()) return null;
  return docToProfile(docSnap);
}

export async function createUserProfile(
  userId: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid: userId,
    email,
    displayName,
    createdAt: now,
    ...DEFAULT_PROFILE,
  };
  await setDoc(usersRef(userId), {
    ...profile,
    createdAt: serverTimestamp(),
    baselineLastUpdated: serverTimestamp(),
  });
  return profile;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'uid' | 'email' | 'createdAt'>>
): Promise<void> {
  await updateDoc(usersRef(userId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function updateBaselineVolume(
  userId: string,
  baselineVolume: number
): Promise<void> {
  await updateDoc(usersRef(userId), {
    baselineVolume,
    baselineLastUpdated: serverTimestamp(),
  });
}

export async function updateProgressionAggressiveness(
  userId: string,
  aggressiveness: number
): Promise<void> {
  const clamped = Math.max(0.5, Math.min(1.5, aggressiveness));
  await updateDoc(usersRef(userId), {
    progressionAggressiveness: Math.round(clamped * 100) / 100,
  });
}

export async function updateConsistencyScore(
  userId: string,
  completed: number,
  planned: number
): Promise<void> {
  const score = planned > 0 ? Math.round((completed / planned) * 100) / 100 : 0.5;
  await updateDoc(usersRef(userId), {
    consistencyScore: score,
  });
}

export function calculateRecoveryRate(
  successRate: number,
  fatigueLoad: number
): number {
  let rate = 1.0;
  if (successRate > 0.8) rate += 0.1;
  if (successRate < 0.5) rate -= 0.15;
  if (fatigueLoad > 1.2) rate -= 0.1;
  if (fatigueLoad < 0.9) rate += 0.05;
  return Math.max(0.8, Math.min(1.2, Math.round(rate * 100) / 100));
}

export function calculateStrengthLevel(
  totalSessions: number,
  avgVolume: number
): UserProfile['strengthLevel'] {
  if (totalSessions < 20 || avgVolume < 5000) return 'beginner';
  if (totalSessions < 100 || avgVolume < 15000) return 'intermediate';
  return 'advanced';
}
