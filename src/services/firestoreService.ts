import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  InterviewSession,
  JobApplication,
  SavedJob,
  UserProfile,
} from '../types';
import {
  hasUneditedSeedFields,
  isSeedProfileSnapshot,
  parseTimestampMs,
  profilesDiffer,
} from '../utils/accountBackup';

const profileWriteQueues = new Map<string, Promise<unknown>>();
const interviewWriteQueues = new Map<string, Promise<unknown>>();

function enqueueProfileWrite<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const prev = profileWriteQueues.get(uid) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  profileWriteQueues.set(uid, next);
  return next.finally(() => {
    if (profileWriteQueues.get(uid) === next) {
      profileWriteQueues.delete(uid);
    }
  });
}

function enqueueInterviewWrite<T>(uid: string, docId: string, task: () => Promise<T>): Promise<T> {
  const key = `${uid}:${docId}`;
  const prev = interviewWriteQueues.get(key) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  interviewWriteQueues.set(key, next);
  return next.finally(() => {
    if (interviewWriteQueues.get(key) === next) {
      interviewWriteQueues.delete(key);
    }
  });
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  fullName: '',
  dob: '',
  gender: '',
  email: '',
  mobile: '',
  address: '',
  qualification: '',
  preferredLanguage: '',
  education: {
    degree: '',
    college: '',
    specialization: '',
    graduationYear: '',
    cgpa: '',
  },
  skills: [],
  certificates: [],
  workHistory: [],
  stats: {
    totalInterviews: 0,
    avgScore: 0,
    bestScore: 0,
  },
  isCompleted: false,
};

export function sanitizeDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned || `doc_${Date.now()}`;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function clipStr(val: unknown, maxLen: number): string {
  return String(val ?? '').slice(0, maxLen);
}

export function extractReadableFirestoreError(error: unknown, fallback = 'Cloud sync failed.'): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // not a JSON-wrapped FirestoreErrorInfo
  }
  return raw;
}

/**
 * Always normalizes onto DEFAULT_USER_PROFILE so previous signed-in users'
 * avatarUrl, resumeText, or skills can NEVER bleed across account switches.
 */
export function normalizeUserProfile(raw?: Partial<UserProfile> | null): UserProfile {
  const src = raw || {};
  return {
    fullName: src.fullName || '',
    dob: src.dob || '',
    gender: src.gender || '',
    email: src.email || '',
    mobile: src.mobile || '',
    address: src.address || '',
    qualification: src.qualification || '',
    preferredLanguage: src.preferredLanguage || '',
    education: {
      degree: src.education?.degree || '',
      college: src.education?.college || '',
      specialization: src.education?.specialization || '',
      graduationYear: src.education?.graduationYear || '',
      cgpa: src.education?.cgpa || '',
    },
    skills: Array.isArray(src.skills) ? src.skills.filter(Boolean).slice(0, 30) : [],
    certificates: Array.isArray(src.certificates) ? src.certificates.slice(0, 20) : [],
    workHistory: Array.isArray(src.workHistory)
      ? src.workHistory
          .filter((item) => item && (item.title || item.company))
          .slice(0, 25)
          .map((item, idx) => ({
            id: clipStr(item.id || `work-${idx + 1}`, 80),
            title: clipStr(item.title || 'Role', 140),
            company: clipStr(item.company || 'Organization', 140),
            location: item.location ? clipStr(item.location, 140) : undefined,
            startDate: clipStr(item.startDate || '', 40),
            endDate: item.endDate ? clipStr(item.endDate, 40) : undefined,
            current: Boolean(item.current),
            description: item.description ? clipStr(item.description, 1000) : undefined,
            source: item.source === 'linkedin' ? ('linkedin' as const) : ('manual' as const),
          }))
      : [],
    linkedinProfile: src.linkedinProfile
      ? {
          connected: Boolean(src.linkedinProfile.connected),
          memberId: src.linkedinProfile.memberId ? clipStr(src.linkedinProfile.memberId, 128) : undefined,
          profileUrl: src.linkedinProfile.profileUrl ? clipStr(src.linkedinProfile.profileUrl, 300) : undefined,
          headline: src.linkedinProfile.headline ? clipStr(src.linkedinProfile.headline, 240) : undefined,
          fullName: src.linkedinProfile.fullName ? clipStr(src.linkedinProfile.fullName, 120) : undefined,
          email: src.linkedinProfile.email ? clipStr(src.linkedinProfile.email, 160) : undefined,
          pictureUrl: src.linkedinProfile.pictureUrl ? clipStr(src.linkedinProfile.pictureUrl, 600) : undefined,
          importedCount: typeof src.linkedinProfile.importedCount === 'number' ? src.linkedinProfile.importedCount : undefined,
          lastSyncedAt: src.linkedinProfile.lastSyncedAt ? clipStr(src.linkedinProfile.lastSyncedAt, 60) : undefined,
          importMethod: src.linkedinProfile.importMethod,
        }
      : undefined,
    resumeUrl: src.resumeUrl,
    resumeFile: src.resumeFile,
    avatarUrl: src.avatarUrl || '',
    resumeText: src.resumeText || '',
    jobAlertSubscription: src.jobAlertSubscription,
    stats: {
      totalInterviews: Number(src.stats?.totalInterviews) || 0,
      avgScore: Number(src.stats?.avgScore) || 0,
      bestScore: Number(src.stats?.bestScore) || 0,
    },
    isCompleted: Boolean(src.isCompleted),
    ...(src.profileUpdatedAt ? { profileUpdatedAt: String(src.profileUpdatedAt) } : {}),
  };
}

function toProfileDocPayload(uid: string, profile: UserProfile) {
  const normalized = normalizeUserProfile(profile);
  const avatarUrl = String(normalized.avatarUrl || '');
  if (avatarUrl.length > 250000) {
    throw new Error('Profile picture exceeds the 250 KB cloud sync limit. Please pick a smaller image.');
  }
  const payload: Record<string, unknown> = {
    uid: sanitizeDocId(uid),
    fullName: clipStr(normalized.fullName || normalized.email.split('@')[0] || 'Candidate', 120),
    email: clipStr(normalized.email, 160),
    dob: clipStr(normalized.dob, 20),
    gender: clipStr(normalized.gender, 32),
    mobile: clipStr(normalized.mobile, 24),
    address: clipStr(normalized.address, 300),
    qualification: clipStr(normalized.qualification, 160),
    preferredLanguage: clipStr(normalized.preferredLanguage, 40),
    avatarUrl,
    resumeText: clipStr(normalized.resumeText, 40000),
    education: stripUndefinedDeep(normalized.education),
    skills: normalized.skills.slice(0, 30).map((s) => clipStr(s, 80)),
    certificates: stripUndefinedDeep(normalized.certificates.slice(0, 20)),
    workHistory: stripUndefinedDeep((normalized.workHistory || []).slice(0, 25)),
    stats: stripUndefinedDeep(normalized.stats),
    isCompleted: Boolean(normalized.isCompleted),
  };

  if (normalized.linkedinProfile) {
    payload.linkedinProfile = stripUndefinedDeep(normalized.linkedinProfile);
  }
  if (normalized.resumeFile) {
    payload.resumeFile = stripUndefinedDeep(normalized.resumeFile);
  }
  if (normalized.jobAlertSubscription) {
    payload.jobAlertSubscription = stripUndefinedDeep(normalized.jobAlertSubscription);
  }
  if (normalized.profileUpdatedAt) {
    payload.profileUpdatedAt = clipStr(normalized.profileUpdatedAt, 60);
  }

  return payload;
}

function docDataToUserProfile(data: Record<string, any>): UserProfile {
  const serverUpdatedIso =
    typeof data.updatedAt?.toDate === 'function'
      ? data.updatedAt.toDate().toISOString()
      : undefined;
  const profileUpdatedAt =
    typeof data.profileUpdatedAt === 'string' && data.profileUpdatedAt.trim()
      ? data.profileUpdatedAt.trim()
      : serverUpdatedIso;

  return normalizeUserProfile({
    fullName: data.fullName || '',
    dob: data.dob || '',
    gender: data.gender || '',
    email: data.email || '',
    mobile: data.mobile || '',
    address: data.address || '',
    qualification: data.qualification || '',
    preferredLanguage: data.preferredLanguage || '',
    avatarUrl: data.avatarUrl || '',
    resumeText: data.resumeText || '',
    resumeFile: data.resumeFile,
    education: data.education,
    skills: data.skills,
    certificates: data.certificates,
    workHistory: data.workHistory,
    linkedinProfile: data.linkedinProfile,
    jobAlertSubscription: data.jobAlertSubscription,
    stats: data.stats,
    isCompleted: data.isCompleted,
    profileUpdatedAt,
  });
}

/**
 * Ensures /users/{uid} exists and reconciles backend & Firestore state without losing
 * uploaded avatarUrl, resumeText, certificates, skills, or interview stats.
 */
export async function ensureUserProfileDoc(
  uid: string,
  incomingProfile: UserProfile
): Promise<UserProfile> {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}`;
  const docRef = doc(db, 'users', safeUid);

  return enqueueProfileWrite(safeUid, async () => {
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        const payload = toProfileDocPayload(safeUid, incomingProfile);
        await setDoc(docRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return normalizeUserProfile(incomingProfile);
      }

      const stored = docDataToUserProfile(snap.data() as Record<string, any>);
      const inc = normalizeUserProfile(incomingProfile);

      // If incomingProfile is just an unedited server seed reset, NEVER let seed defaults
      // overwrite or backfill into an established Firestore profile.
      const incomingIsPureSeed = isSeedProfileSnapshot(inc);
      if (incomingIsPureSeed) {
        return normalizeUserProfile({
          ...stored,
          email: stored.email || inc.email,
          fullName: stored.fullName || inc.fullName,
          avatarUrl: stored.avatarUrl || inc.avatarUrl,
          stats:
            (stored.stats?.totalInterviews || 0) >= (inc.stats?.totalInterviews || 0)
              ? stored.stats
              : inc.stats,
          isCompleted: true,
        });
      }

      // Compare explicit edit timestamps so newer user edits always win over stale Firestore fields
      const incMs = parseTimestampMs(inc.profileUpdatedAt);
      const storedMs = parseTimestampMs(stored.profileUpdatedAt);
      const storedHasSeedPersonal = hasUneditedSeedFields(stored);
      const incHasSeedPersonal = hasUneditedSeedFields(inc);
      const incomingIsNewer =
        incMs > storedMs ||
        (storedHasSeedPersonal && !incHasSeedPersonal && incMs > 0);

      const primary = incomingIsNewer ? inc : stored;
      const secondary = incomingIsNewer ? stored : inc;

      const primaryIsCustomPhoto = Boolean(primary.avatarUrl?.startsWith('data:image/'));
      const secondaryIsCustomPhoto = Boolean(secondary.avatarUrl?.startsWith('data:image/'));
      const chosenAvatar = primaryIsCustomPhoto
        ? primary.avatarUrl
        : secondaryIsCustomPhoto
        ? secondary.avatarUrl
        : primary.avatarUrl || secondary.avatarUrl || '';

      const latestIso =
        Math.max(incMs, storedMs) > 0
          ? new Date(Math.max(incMs, storedMs)).toISOString()
          : new Date().toISOString();

      const merged = normalizeUserProfile({
        ...secondary,
        ...primary,
        fullName: primary.fullName || secondary.fullName,
        email: primary.email || secondary.email,
        dob: primary.dob || secondary.dob,
        gender: primary.gender || secondary.gender,
        mobile: primary.mobile || secondary.mobile,
        address: primary.address || secondary.address,
        qualification: primary.qualification || secondary.qualification,
        preferredLanguage: primary.preferredLanguage || secondary.preferredLanguage,
        avatarUrl: chosenAvatar,
        resumeText:
          primary.resumeText &&
          (incomingIsNewer || primary.resumeText.length >= (secondary.resumeText?.length || 0))
            ? primary.resumeText
            : secondary.resumeText || primary.resumeText || '',
        resumeFile: primary.resumeFile || secondary.resumeFile,
        skills: primary.skills.length > 0 ? primary.skills : secondary.skills,
        certificates: primary.certificates.length > 0 ? primary.certificates : secondary.certificates,
        workHistory:
          (primary.workHistory?.length || 0) > 0
            ? primary.workHistory
            : secondary.workHistory,
        linkedinProfile: primary.linkedinProfile || secondary.linkedinProfile,
        education: {
          degree: primary.education.degree || secondary.education.degree,
          college: primary.education.college || secondary.education.college,
          specialization: primary.education.specialization || secondary.education.specialization,
          graduationYear: primary.education.graduationYear || secondary.education.graduationYear,
          cgpa: primary.education.cgpa || secondary.education.cgpa,
        },
        jobAlertSubscription: primary.jobAlertSubscription || secondary.jobAlertSubscription,
        stats:
          (stored.stats?.totalInterviews || 0) >= (inc.stats?.totalInterviews || 0)
            ? stored.stats
            : inc.stats,
        isCompleted: true,
        profileUpdatedAt: latestIso,
      });

      // Persist any newer edits or recovered non-seed additions back to Firestore immediately
      // so real-time snapshots do not revert React state to stale Firestore fields.
      if (profilesDiffer(stored, merged) || incomingIsNewer) {
        const patchPayload = toProfileDocPayload(safeUid, merged);
        const updatePatch: Record<string, unknown> = {
          fullName: patchPayload.fullName,
          email: patchPayload.email,
          dob: patchPayload.dob,
          gender: patchPayload.gender,
          mobile: patchPayload.mobile,
          address: patchPayload.address,
          qualification: patchPayload.qualification,
          preferredLanguage: patchPayload.preferredLanguage,
          avatarUrl: patchPayload.avatarUrl,
          resumeText: patchPayload.resumeText,
          education: patchPayload.education,
          skills: patchPayload.skills,
          certificates: patchPayload.certificates,
          workHistory: patchPayload.workHistory,
          stats: patchPayload.stats,
          isCompleted: true,
          profileUpdatedAt: latestIso,
          updatedAt: serverTimestamp(),
        };
        if (patchPayload.linkedinProfile) updatePatch.linkedinProfile = patchPayload.linkedinProfile;
        if (patchPayload.resumeFile) updatePatch.resumeFile = patchPayload.resumeFile;
        if (patchPayload.jobAlertSubscription) updatePatch.jobAlertSubscription = patchPayload.jobAlertSubscription;
        await updateDoc(docRef, updatePatch);
      }

      return merged;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  });
}

export async function saveProfileActionToFirestore(
  uid: string,
  profile: UserProfile,
  action: 'profile' | 'resume' | 'jobAlerts' | 'stats' | 'linkedin'
): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}`;
  const docRef = doc(db, 'users', safeUid);

  return enqueueProfileWrite(safeUid, async () => {
    try {
      const snap = await getDoc(docRef);
      const fullPayload = toProfileDocPayload(safeUid, profile);

      if (!snap.exists()) {
        await setDoc(docRef, {
          ...fullPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const stamp = fullPayload.profileUpdatedAt || new Date().toISOString();

      if (action === 'profile') {
        const updatePayload: Record<string, unknown> = {
          fullName: fullPayload.fullName,
          email: fullPayload.email,
          dob: fullPayload.dob,
          gender: fullPayload.gender,
          mobile: fullPayload.mobile,
          address: fullPayload.address,
          qualification: fullPayload.qualification,
          preferredLanguage: fullPayload.preferredLanguage,
          avatarUrl: fullPayload.avatarUrl,
          education: fullPayload.education,
          skills: fullPayload.skills,
          certificates: fullPayload.certificates,
          workHistory: fullPayload.workHistory,
          isCompleted: true,
          profileUpdatedAt: stamp,
          updatedAt: serverTimestamp(),
        };
        if (fullPayload.resumeText) {
          updatePayload.resumeText = fullPayload.resumeText;
        }
        if (fullPayload.resumeFile) {
          updatePayload.resumeFile = fullPayload.resumeFile;
        }
        if (fullPayload.linkedinProfile) {
          updatePayload.linkedinProfile = fullPayload.linkedinProfile;
        }
        await updateDoc(docRef, updatePayload);
      } else if (action === 'linkedin') {
        const updatePayload: Record<string, unknown> = {
          workHistory: fullPayload.workHistory,
          resumeText: fullPayload.resumeText,
          skills: fullPayload.skills,
          education: fullPayload.education,
          fullName: fullPayload.fullName,
          address: fullPayload.address,
          avatarUrl: fullPayload.avatarUrl,
          isCompleted: true,
          profileUpdatedAt: stamp,
          updatedAt: serverTimestamp(),
        };
        if (fullPayload.linkedinProfile) {
          updatePayload.linkedinProfile = fullPayload.linkedinProfile;
        } else if ((snap.data() as Record<string, any>)?.linkedinProfile) {
          updatePayload.linkedinProfile = deleteField();
        }
        await updateDoc(docRef, updatePayload);
      } else if (action === 'resume') {
        const updatePayload: Record<string, unknown> = {
          resumeText: fullPayload.resumeText,
          profileUpdatedAt: stamp,
          updatedAt: serverTimestamp(),
        };
        if (fullPayload.resumeFile) {
          updatePayload.resumeFile = fullPayload.resumeFile;
        } else if ((snap.data() as Record<string, any>)?.resumeFile) {
          updatePayload.resumeFile = deleteField();
        }
        await updateDoc(docRef, updatePayload);
      } else if (action === 'jobAlerts' && fullPayload.jobAlertSubscription) {
        await updateDoc(docRef, {
          jobAlertSubscription: fullPayload.jobAlertSubscription,
          profileUpdatedAt: stamp,
          updatedAt: serverTimestamp(),
        });
      } else if (action === 'stats') {
        await updateDoc(docRef, {
          stats: fullPayload.stats,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  });
}

export function subscribeUserProfile(
  uid: string,
  onChange: (profile: UserProfile, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void
): () => void {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}`;
  const docRef = doc(db, 'users', safeUid);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onChange(docDataToUserProfile(snapshot.data() as Record<string, any>), {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

function toInterviewDocPayload(uid: string, session: InterviewSession) {
  const safeUid = sanitizeDocId(uid);
  const safeId = sanitizeDocId(session.id);
  const sector = session.sector === 'Government' ? 'Government' : 'Private';
  const difficulty =
    session.difficulty === 'Beginner' || session.difficulty === 'Advanced'
      ? session.difficulty
      : 'Intermediate';
  const status = session.status === 'completed' || session.overallReport ? 'completed' : 'active';

  const payload: Record<string, unknown> = {
    id: safeId,
    userId: safeUid,
    role: clipStr(session.role || 'Software Developer', 160),
    sector,
    difficulty,
    status,
    date: clipStr(session.date || new Date().toISOString(), 60),
    questions: stripUndefinedDeep((session.questions || []).slice(0, 30)),
    answers: stripUndefinedDeep(session.answers || {}),
    evaluations: stripUndefinedDeep(session.evaluations || {}),
  };

  if (session.interviewType) payload.interviewType = clipStr(session.interviewType, 120);
  if (session.round) payload.round = clipStr(session.round, 80);
  if (session.roundLabel) payload.roundLabel = clipStr(session.roundLabel, 120);
  if (session.duration) payload.duration = clipStr(session.duration, 40);
  if (session.overallReport) payload.overallReport = stripUndefinedDeep(session.overallReport);
  if (session.examName) payload.examName = clipStr(session.examName, 160);
  if (session.department) payload.department = clipStr(session.department, 160);
  if (session.preferredLanguage) payload.preferredLanguage = clipStr(session.preferredLanguage, 40);
  if (session.companyName) payload.companyName = clipStr(session.companyName, 160);
  if (session.jobId) payload.jobId = clipStr(session.jobId, 128);

  return payload;
}

function docDataToInterview(data: Record<string, any>): InterviewSession {
  return {
    id: String(data.id || ''),
    role: String(data.role || ''),
    interviewType: data.interviewType,
    round: data.round ?? null,
    roundLabel: data.roundLabel ?? null,
    sector: data.sector === 'Government' ? 'Government' : 'Private',
    difficulty: data.difficulty || 'Intermediate',
    status: data.status === 'completed' ? 'completed' : 'active',
    date: String(data.date || ''),
    duration: data.duration,
    questions: Array.isArray(data.questions) ? data.questions : [],
    answers: data.answers || {},
    evaluations: data.evaluations || {},
    overallReport: data.overallReport,
    examName: data.examName,
    department: data.department,
    preferredLanguage: data.preferredLanguage,
    companyName: data.companyName,
    jobId: data.jobId,
  };
}

export async function saveInterviewToFirestore(
  uid: string,
  session: InterviewSession
): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const safeId = sanitizeDocId(session.id);
  const path = `users/${safeUid}/interviews/${safeId}`;
  const docRef = doc(db, 'users', safeUid, 'interviews', safeId);

  return enqueueInterviewWrite(safeUid, safeId, async () => {
    try {
      const snap = await getDoc(docRef);
      const payload = toInterviewDocPayload(safeUid, session);

      if (!snap.exists()) {
        await setDoc(docRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const existing = snap.data() as Record<string, any>;
      // Respect terminal-state locking: completed interviews are already locked
      if (existing.status === 'completed') {
        return;
      }

      if (payload.status === 'completed' && payload.overallReport) {
        const completionPatch: Record<string, unknown> = {
          answers: payload.answers,
          evaluations: payload.evaluations,
          overallReport: payload.overallReport,
          status: 'completed',
          updatedAt: serverTimestamp(),
        };
        if (payload.duration) {
          completionPatch.duration = payload.duration;
        }
        await updateDoc(docRef, completionPatch);
      } else {
        await updateDoc(docRef, {
          answers: payload.answers,
          evaluations: payload.evaluations,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  });
}

export async function loadInterviewsFromFirestore(uid: string): Promise<InterviewSession[]> {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}/interviews`;

  try {
    const q = query(collection(db, 'users', safeUid, 'interviews'), where('userId', '==', safeUid));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => docDataToInterview(d.data() as Record<string, any>))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeInterviews(
  uid: string,
  onChange: (sessions: InterviewSession[]) => void
): () => void {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}/interviews`;
  const q = query(collection(db, 'users', safeUid, 'interviews'), where('userId', '==', safeUid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => docDataToInterview(d.data() as Record<string, any>))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function loadSavedJobsFromFirestore(uid: string): Promise<SavedJob[]> {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}/savedJobs`;

  try {
    const q = query(collection(db, 'users', safeUid, 'savedJobs'), where('userId', '==', safeUid));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => {
        const data = d.data() as Record<string, any>;
        return {
          id: Number(data.id) || 0,
          jobId: data.jobId,
          title: String(data.title || ''),
          company: String(data.company || ''),
          location: String(data.location || ''),
          applyLink: String(data.applyLink || ''),
          savedAt: String(data.savedAt || ''),
        } satisfies SavedJob;
      })
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveSavedJobToFirestore(uid: string, job: SavedJob): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const docId = sanitizeDocId(String(job.id));
  const path = `users/${safeUid}/savedJobs/${docId}`;
  const docRef = doc(db, 'users', safeUid, 'savedJobs', docId);

  try {
    const snap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      id: Number(job.id),
      userId: safeUid,
      title: clipStr(job.title, 200),
      company: clipStr(job.company, 160),
      location: clipStr(job.location, 160),
      applyLink: clipStr(job.applyLink, 600),
      savedAt: clipStr(job.savedAt || new Date().toISOString(), 60),
    };
    if (job.jobId) {
      payload.jobId = sanitizeDocId(job.jobId);
    }

    if (!snap.exists()) {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        title: payload.title,
        company: payload.company,
        location: payload.location,
        applyLink: payload.applyLink,
        savedAt: payload.savedAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSavedJobFromFirestore(uid: string, jobId: number): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const docId = sanitizeDocId(String(jobId));
  const path = `users/${safeUid}/savedJobs/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'savedJobs', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadApplicationsFromFirestore(uid: string): Promise<JobApplication[]> {
  const safeUid = sanitizeDocId(uid);
  const path = `users/${safeUid}/applications`;

  try {
    const q = query(collection(db, 'users', safeUid, 'applications'), where('userId', '==', safeUid));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => d.data() as JobApplication)
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveApplicationToFirestore(uid: string, application: JobApplication): Promise<void> {
  const safeUid = sanitizeDocId(uid);
  const docId = sanitizeDocId(String(application.id));
  const path = `users/${safeUid}/applications/${docId}`;
  const docRef = doc(db, 'users', safeUid, 'applications', docId);

  try {
    const snap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      id: Number(application.id),
      userId: safeUid,
      jobId: sanitizeDocId(application.jobId),
      jobTitle: clipStr(application.jobTitle, 200),
      company: clipStr(application.company, 160),
      location: clipStr(application.location, 160),
      applyLink: clipStr(application.applyLink, 600),
      candidateName: clipStr(application.candidateName || 'Candidate', 120),
      candidateEmail: clipStr(application.candidateEmail, 160),
      candidatePhone: clipStr(application.candidatePhone, 32),
      resumeName: clipStr(application.resumeName, 200),
      availability: clipStr(application.availability, 60),
      expectedSalary: clipStr(application.expectedSalary, 80),
      intentSummary: clipStr(application.intentSummary || 'Interested in this position.', 2000),
      matchedSkills: (application.matchedSkills || []).slice(0, 20).map((s) => clipStr(s, 60)),
      appliedAt: clipStr(application.appliedAt || new Date().toISOString(), 60),
      status: application.status === 'In Review' ? 'In Review' : 'Submitted',
    };
    if (application.platform) {
      payload.platform = clipStr(application.platform, 40);
    }

    if (!snap.exists()) {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        candidateName: payload.candidateName,
        candidateEmail: payload.candidateEmail,
        candidatePhone: payload.candidatePhone,
        resumeName: payload.resumeName,
        availability: payload.availability,
        expectedSalary: payload.expectedSalary,
        intentSummary: payload.intentSummary,
        matchedSkills: payload.matchedSkills,
        appliedAt: payload.appliedAt,
        status: payload.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
