import {
  collection,
  doc,
  getDoc,
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
import type {
  Difficulty,
  PeerMessage,
  PeerProfile,
  PeerRequest,
  PeerSession,
  Sector,
} from '../types';

function clipStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function toIsoTimestamp(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val?.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return '';
}

function toEpochMs(val: any): number {
  if (!val) return 0;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const parsed = Date.parse(String(val));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function computeInitials(name: string): string {
  const parts = String(name || 'Peer')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PR';
  return parts
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function mapPeerProfile(data: Record<string, any>): PeerProfile {
  return {
    uid: String(data.uid || ''),
    displayName: String(data.displayName || 'Peer Candidate'),
    targetRole: String(data.targetRole || 'Software Engineer'),
    sector: data.sector === 'Government' ? 'Government' : 'Private',
    difficulty:
      data.difficulty === 'Beginner' || data.difficulty === 'Advanced'
        ? data.difficulty
        : 'Intermediate',
    isAvailable: Boolean(data.isAvailable),
    skills: Array.isArray(data.skills) ? data.skills.map(String).slice(0, 15) : [],
    bio: typeof data.bio === 'string' ? data.bio : '',
    experienceLevel: typeof data.experienceLevel === 'string' ? data.experienceLevel : '',
    preferredLanguage: typeof data.preferredLanguage === 'string' ? data.preferredLanguage : 'English',
    avatarInitials: typeof data.avatarInitials === 'string' ? data.avatarInitials : computeInitials(data.displayName),
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
  };
}

function mapPeerRequest(data: Record<string, any>): PeerRequest {
  const senderId = String(data.senderId || '');
  const receiverId = String(data.receiverId || '');
  const participantIds: [string, string] =
    Array.isArray(data.participantIds) && data.participantIds.length === 2
      ? [String(data.participantIds[0]), String(data.participantIds[1])]
      : [senderId, receiverId];

  return {
    id: String(data.id || ''),
    senderId,
    senderName: String(data.senderName || 'Candidate'),
    senderRole: String(data.senderRole || 'Interview Prep'),
    receiverId,
    receiverName: String(data.receiverName || 'Peer'),
    receiverRole: String(data.receiverRole || 'Interview Prep'),
    participantIds,
    topic: String(data.topic || 'General Mock Interview'),
    sector: data.sector === 'Government' ? 'Government' : 'Private',
    difficulty:
      data.difficulty === 'Beginner' || data.difficulty === 'Advanced'
        ? data.difficulty
        : 'Intermediate',
    message: typeof data.message === 'string' ? data.message : '',
    scheduledTime: typeof data.scheduledTime === 'string' ? data.scheduledTime : '',
    status: data.status || 'pending',
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
  };
}

function mapPeerSession(data: Record<string, any>): PeerSession {
  const hostId = String(data.hostId || '');
  const guestId = String(data.guestId || '');
  const participantIds: [string, string] =
    Array.isArray(data.participantIds) && data.participantIds.length === 2
      ? [String(data.participantIds[0]), String(data.participantIds[1])]
      : [hostId, guestId];

  return {
    id: String(data.id || ''),
    requestId: String(data.requestId || ''),
    hostId,
    hostName: String(data.hostName || 'Host'),
    guestId,
    guestName: String(data.guestName || 'Guest'),
    participantIds,
    interviewerId: String(data.interviewerId || hostId),
    topic: String(data.topic || 'Peer Mock Interview'),
    currentQuestion: String(data.currentQuestion || 'Introduce yourself and walk through a project you led recently.'),
    currentCategory: typeof data.currentCategory === 'string' ? data.currentCategory : 'Warm-up',
    sharedNotes: typeof data.sharedNotes === 'string' ? data.sharedNotes : '',
    status: data.status === 'completed' ? 'completed' : 'active',
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
  };
}

function mapPeerMessage(data: Record<string, any>): PeerMessage {
  const participantIds: [string, string] =
    Array.isArray(data.participantIds) && data.participantIds.length === 2
      ? [String(data.participantIds[0]), String(data.participantIds[1])]
      : ['', ''];

  return {
    id: String(data.id || ''),
    sessionId: String(data.sessionId || ''),
    participantIds,
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || 'Peer'),
    senderRole: data.senderRole === 'Interviewer' ? 'Interviewer' : 'Candidate',
    type:
      data.type === 'question' || data.type === 'feedback'
        ? data.type
        : 'chat',
    text: String(data.text || ''),
    score: typeof data.score === 'number' ? data.score : undefined,
    createdAt: toIsoTimestamp(data.createdAt),
  };
}

function reportSnapshotError(error: unknown, op: OperationType, path: string, onError?: (err: Error) => void) {
  try {
    handleFirestoreError(error, op, path);
  } catch (wrapped) {
    if (onError) {
      onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  }
}

export interface UpsertPeerProfileInput {
  displayName: string;
  targetRole: string;
  sector: Sector;
  difficulty: Difficulty;
  isAvailable: boolean;
  skills: string[];
  bio?: string;
  experienceLevel?: string;
  preferredLanguage?: string;
}

export async function upsertPeerProfile(
  uid: string,
  input: UpsertPeerProfileInput
): Promise<PeerProfile> {
  const safeUid = sanitizeDocId(uid);
  const path = `peerProfiles/${safeUid}`;
  const ref = doc(db, 'peerProfiles', safeUid);

  const displayName = clipStr(input.displayName || 'Candidate', 80) || 'Candidate';
  const targetRole = clipStr(input.targetRole || 'Software Engineer', 120) || 'Software Engineer';
  const sector: Sector = input.sector === 'Government' ? 'Government' : 'Private';
  const difficulty: Difficulty =
    input.difficulty === 'Beginner' || input.difficulty === 'Advanced'
      ? input.difficulty
      : 'Intermediate';
  const skills = (input.skills || [])
    .map((s) => clipStr(s, 40))
    .filter(Boolean)
    .slice(0, 15);
  const bio = clipStr(input.bio || '', 400);
  const experienceLevel = clipStr(input.experienceLevel || 'Fresher / Early Career', 60);
  const preferredLanguage = clipStr(input.preferredLanguage || 'English', 40);
  const avatarInitials = computeInitials(displayName);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        uid: safeUid,
        displayName,
        targetRole,
        sector,
        difficulty,
        isAvailable: Boolean(input.isAvailable),
        skills,
        bio,
        experienceLevel,
        preferredLanguage,
        avatarInitials,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        targetRole,
        sector,
        difficulty,
        isAvailable: Boolean(input.isAvailable),
        skills,
        bio,
        experienceLevel,
        preferredLanguage,
        avatarInitials,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      uid: safeUid,
      displayName,
      targetRole,
      sector,
      difficulty,
      isAvailable: Boolean(input.isAvailable),
      skills,
      bio,
      experienceLevel,
      preferredLanguage,
      avatarInitials,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeMyPeerProfile(
  uid: string,
  onData: (profile: PeerProfile | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const safeUid = sanitizeDocId(uid);
  const path = `peerProfiles/${safeUid}`;
  return onSnapshot(
    doc(db, 'peerProfiles', safeUid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapPeerProfile(snap.data() as Record<string, any>));
    },
    (error) => reportSnapshotError(error, OperationType.GET, path, onError)
  );
}

export function subscribeAvailablePeers(
  currentUid: string,
  onData: (peers: PeerProfile[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const safeUid = sanitizeDocId(currentUid);
  const q = query(collection(db, 'peerProfiles'), where('isAvailable', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ data: d.data() as Record<string, any>, ms: toEpochMs(d.data()?.updatedAt) }))
        .filter((item) => String(item.data.uid || '') !== safeUid)
        .sort((a, b) => b.ms - a.ms)
        .map((item) => mapPeerProfile(item.data));
      onData(list);
    },
    (error) => reportSnapshotError(error, OperationType.LIST, 'peerProfiles', onError)
  );
}

export interface SendPeerRequestInput {
  senderId: string;
  senderName: string;
  senderRole: string;
  receiver: PeerProfile;
  topic: string;
  sector: Sector;
  difficulty: Difficulty;
  message?: string;
  scheduledTime?: string;
}

export async function sendPeerRequest(input: SendPeerRequestInput): Promise<PeerRequest> {
  const senderId = sanitizeDocId(input.senderId);
  const receiverId = sanitizeDocId(input.receiver.uid);
  if (senderId === receiverId) {
    throw new Error('Cannot send a practice request to yourself.');
  }

  const requestId = sanitizeDocId(`pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `peerRequests/${requestId}`;

  const payload = {
    id: requestId,
    senderId,
    senderName: clipStr(input.senderName || 'Candidate', 80) || 'Candidate',
    senderRole: clipStr(input.senderRole || 'Mock Practice Partner', 120) || 'Mock Practice Partner',
    receiverId,
    receiverName: clipStr(input.receiver.displayName || 'Peer', 80) || 'Peer',
    receiverRole: clipStr(input.receiver.targetRole || 'Mock Practice Partner', 120) || 'Mock Practice Partner',
    participantIds: [senderId, receiverId] as [string, string],
    topic: clipStr(input.topic || 'Live Mock Interview Practice', 160) || 'Live Mock Interview Practice',
    sector: input.sector === 'Government' ? ('Government' as Sector) : ('Private' as Sector),
    difficulty:
      input.difficulty === 'Beginner' || input.difficulty === 'Advanced'
        ? input.difficulty
        : ('Intermediate' as Difficulty),
    message: clipStr(input.message || '', 500),
    scheduledTime: clipStr(input.scheduledTime || 'Ready Now', 60),
    status: 'pending' as const,
  };

  try {
    await setDoc(doc(db, 'peerRequests', requestId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeMyPeerRequests(
  uid: string,
  onData: (requests: PeerRequest[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const safeUid = sanitizeDocId(uid);
  const q = query(
    collection(db, 'peerRequests'),
    where('participantIds', 'array-contains', safeUid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ data: d.data() as Record<string, any>, ms: toEpochMs(d.data()?.updatedAt || d.data()?.createdAt) }))
        .sort((a, b) => b.ms - a.ms)
        .map((item) => mapPeerRequest(item.data));
      onData(list);
    },
    (error) => reportSnapshotError(error, OperationType.LIST, 'peerRequests', onError)
  );
}

export async function ensurePeerSessionForRequest(req: PeerRequest): Promise<PeerSession> {
  const sessionId = sanitizeDocId(req.sessionId || req.id);
  const sessionPath = `peerSessions/${sessionId}`;
  const sessionRef = doc(db, 'peerSessions', sessionId);

  try {
    const existing = await getDoc(sessionRef);
    if (existing.exists()) {
      return mapPeerSession(existing.data() as Record<string, any>);
    }

    const defaultQuestion = `Walk me through your background for ${clipStr(req.topic, 80)} and share one impactful project or challenge you solved.`;
    const payload = {
      id: sessionId,
      requestId: sanitizeDocId(req.id),
      hostId: sanitizeDocId(req.senderId),
      hostName: clipStr(req.senderName, 80) || 'Host',
      guestId: sanitizeDocId(req.receiverId),
      guestName: clipStr(req.receiverName, 80) || 'Guest',
      participantIds: [sanitizeDocId(req.senderId), sanitizeDocId(req.receiverId)] as [string, string],
      interviewerId: sanitizeDocId(req.receiverId),
      topic: clipStr(req.topic, 160) || 'Peer Practice',
      currentQuestion: defaultQuestion,
      currentCategory: 'Warm-up',
      sharedNotes: '',
      status: 'active' as const,
    };

    await setDoc(sessionRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionPath);
  }
}

export async function acceptPeerRequest(req: PeerRequest): Promise<string> {
  const reqId = sanitizeDocId(req.id);
  const sessionId = sanitizeDocId(req.id);
  const reqPath = `peerRequests/${reqId}`;

  try {
    await updateDoc(doc(db, 'peerRequests', reqId), {
      status: 'accepted',
      sessionId,
      updatedAt: serverTimestamp(),
    });

    await ensurePeerSessionForRequest({
      ...req,
      status: 'accepted',
      sessionId,
    });

    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }
}

export async function declinePeerRequest(requestId: string): Promise<void> {
  const safeId = sanitizeDocId(requestId);
  const path = `peerRequests/${safeId}`;
  try {
    await updateDoc(doc(db, 'peerRequests', safeId), {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelPeerRequest(requestId: string): Promise<void> {
  const safeId = sanitizeDocId(requestId);
  const path = `peerRequests/${safeId}`;
  try {
    await updateDoc(doc(db, 'peerRequests', safeId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function completePeerPractice(req: PeerRequest): Promise<void> {
  const safeReqId = sanitizeDocId(req.id);
  const reqPath = `peerRequests/${safeReqId}`;

  try {
    await updateDoc(doc(db, 'peerRequests', safeReqId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });

    const sessionId = sanitizeDocId(req.sessionId || req.id);
    const sessionRef = doc(db, 'peerSessions', sessionId);
    const snap = await getDoc(sessionRef);
    if (snap.exists() && snap.data()?.status === 'active') {
      await updateDoc(sessionRef, {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }
}

export function subscribePeerSession(
  sessionId: string,
  onData: (session: PeerSession | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const safeId = sanitizeDocId(sessionId);
  const path = `peerSessions/${safeId}`;
  return onSnapshot(
    doc(db, 'peerSessions', safeId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapPeerSession(snap.data() as Record<string, any>));
    },
    (error) => reportSnapshotError(error, OperationType.GET, path, onError)
  );
}

export function subscribePeerMessages(
  sessionId: string,
  currentUid: string,
  onData: (messages: PeerMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const safeSessionId = sanitizeDocId(sessionId);
  const safeUid = sanitizeDocId(currentUid);
  const path = `peerSessions/${safeSessionId}/messages`;

  const q = query(
    collection(db, 'peerSessions', safeSessionId, 'messages'),
    where('participantIds', 'array-contains', safeUid)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ data: d.data() as Record<string, any>, ms: toEpochMs(d.data()?.createdAt) }))
        .sort((a, b) => a.ms - b.ms)
        .map((item) => mapPeerMessage(item.data));
      onData(list);
    },
    (error) => reportSnapshotError(error, OperationType.LIST, path, onError)
  );
}

export async function updatePeerSessionState(
  sessionId: string,
  patch: Partial<Pick<PeerSession, 'interviewerId' | 'currentQuestion' | 'currentCategory' | 'sharedNotes' | 'status'>>
): Promise<void> {
  const safeId = sanitizeDocId(sessionId);
  const path = `peerSessions/${safeId}`;
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.interviewerId !== undefined) {
    updatePayload.interviewerId = sanitizeDocId(patch.interviewerId);
  }
  if (patch.currentQuestion !== undefined) {
    updatePayload.currentQuestion = clipStr(patch.currentQuestion, 600) || 'Practice Prompt';
  }
  if (patch.currentCategory !== undefined) {
    updatePayload.currentCategory = clipStr(patch.currentCategory, 80);
  }
  if (patch.sharedNotes !== undefined) {
    updatePayload.sharedNotes = String(patch.sharedNotes).slice(0, 4000);
  }
  if (patch.status !== undefined) {
    updatePayload.status = patch.status === 'completed' ? 'completed' : 'active';
  }

  try {
    await updateDoc(doc(db, 'peerSessions', safeId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sendPeerMessage(
  session: PeerSession,
  senderUid: string,
  senderName: string,
  senderRole: 'Interviewer' | 'Candidate',
  type: 'chat' | 'question' | 'feedback',
  text: string,
  score?: number
): Promise<void> {
  const safeSessionId = sanitizeDocId(session.id);
  const msgId = sanitizeDocId(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `peerSessions/${safeSessionId}/messages/${msgId}`;

  const cleanText = clipStr(text, 2000);
  if (!cleanText) return;

  const payload: Record<string, unknown> = {
    id: msgId,
    sessionId: safeSessionId,
    participantIds: session.participantIds,
    senderId: sanitizeDocId(senderUid),
    senderName: clipStr(senderName || 'Peer', 80) || 'Peer',
    senderRole,
    type,
    text: cleanText,
    createdAt: serverTimestamp(),
  };

  if (typeof score === 'number' && !Number.isNaN(score)) {
    payload.score = Math.max(0, Math.min(100, Math.round(score)));
  }

  try {
    await setDoc(doc(db, 'peerSessions', safeSessionId, 'messages', msgId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
