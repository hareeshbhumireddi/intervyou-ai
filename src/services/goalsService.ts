import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { sanitizeDocId } from './firestoreService';
import type { GoalMetricType, PracticeGoal } from '../types';

function clipStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function clampNum(val: unknown, min: number, max: number): number {
  const num = Number(val);
  if (Number.isNaN(num)) return min;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function toEpochMs(val: any): number {
  if (!val) return 0;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = Date.parse(String(val));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toIsoString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
  return '';
}

function mapGoal(data: Record<string, any>): PracticeGoal {
  const metricType: GoalMetricType =
    data.metricType === 'interviews_completed' ||
    data.metricType === 'average_score' ||
    data.metricType === 'best_score'
      ? data.metricType
      : 'custom';

  return {
    id: String(data.id || ''),
    userId: String(data.userId || ''),
    title: String(data.title || 'Practice Milestone'),
    metricType,
    unitLabel: String(data.unitLabel || 'interviews'),
    targetValue: clampNum(data.targetValue ?? 10, 1, 10000),
    currentValue: clampNum(data.currentValue ?? 0, 0, 10000),
    targetDate: typeof data.targetDate === 'string' ? data.targetDate : '',
    status: data.status === 'completed' ? 'completed' : 'active',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export interface CreateGoalInput {
  title: string;
  metricType: GoalMetricType;
  unitLabel: string;
  targetValue: number;
  currentValue?: number;
  targetDate?: string;
}

export function subscribeUserGoals(
  uid: string,
  onData: (goals: PracticeGoal[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}/goals`;
  const q = query(collection(db, 'users', safeUid, 'goals'), where('userId', '==', safeUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ data: d.data() as Record<string, any>, ms: toEpochMs(d.data()?.createdAt) }))
        .sort((a, b) => b.ms - a.ms)
        .map((item) => mapGoal(item.data));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createUserGoal(
  uid: string,
  input: CreateGoalInput
): Promise<PracticeGoal> {
  const safeUid = sanitizeDocId(uid);
  const goalId = sanitizeDocId(`goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `users/${safeUid}/goals/${goalId}`;

  const targetValue = clampNum(input.targetValue, 1, 10000);
  const currentValue = clampNum(input.currentValue ?? 0, 0, 10000);
  const status: 'active' | 'completed' = currentValue >= targetValue ? 'completed' : 'active';

  const payload = {
    id: goalId,
    userId: safeUid,
    title: clipStr(input.title || 'Practice Milestone', 140) || 'Practice Milestone',
    metricType: input.metricType,
    unitLabel: clipStr(input.unitLabel || 'interviews', 32) || 'interviews',
    targetValue,
    currentValue,
    targetDate: clipStr(input.targetDate || '', 20),
    status,
  };

  try {
    await setDoc(doc(db, 'users', safeUid, 'goals', goalId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserGoal(
  uid: string,
  goalId: string,
  patch: Partial<Pick<PracticeGoal, 'title' | 'metricType' | 'unitLabel' | 'targetValue' | 'currentValue' | 'targetDate' | 'status'>>
): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const safeGoalId = sanitizeDocId(goalId);
  const path = `users/${safeUid}/goals/${safeGoalId}`;

  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.title !== undefined) {
    updatePayload.title = clipStr(patch.title, 140) || 'Practice Milestone';
  }
  if (patch.metricType !== undefined) {
    updatePayload.metricType = patch.metricType;
  }
  if (patch.unitLabel !== undefined) {
    updatePayload.unitLabel = clipStr(patch.unitLabel, 32) || 'interviews';
  }
  if (patch.targetValue !== undefined) {
    updatePayload.targetValue = clampNum(patch.targetValue, 1, 10000);
  }
  if (patch.currentValue !== undefined) {
    updatePayload.currentValue = clampNum(patch.currentValue, 0, 10000);
  }
  if (patch.targetDate !== undefined) {
    updatePayload.targetDate = clipStr(patch.targetDate, 20);
  }
  if (patch.status !== undefined) {
    updatePayload.status = patch.status === 'completed' ? 'completed' : 'active';
  }

  try {
    await updateDoc(doc(db, 'users', safeUid, 'goals', safeGoalId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserGoal(uid: string, goalId: string): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const safeGoalId = sanitizeDocId(goalId);
  const path = `users/${safeUid}/goals/${safeGoalId}`;

  try {
    await deleteDoc(doc(db, 'users', safeUid, 'goals', safeGoalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
