import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, type User as FirebaseUser } from 'firebase/auth';
import { UserProfile, InterviewSession, JobNotification } from '../types';
import { ApiError, AUTH_EXPIRED_EVENT, api } from '../utils/api';
import { isActiveJob } from '../services/jobLiveService';
import { auth, googleProvider } from '../firebase';
import {
  DEFAULT_USER_PROFILE,
  ensureUserProfileDoc,
  extractReadableFirestoreError,
  loadInterviewsFromFirestore,
  normalizeUserProfile,
  saveInterviewToFirestore,
  saveProfileActionToFirestore,
  subscribeInterviews,
  subscribeUserProfile,
} from '../services/firestoreService';
import {
  isSeedProfileSnapshot,
  normalizeEmailKey,
  parseTimestampMs,
  profilesDiffer,
  readAccountBackup,
  reconcileProfileWithBackup,
  saveAccountBackup,
} from '../utils/accountBackup';

function daysFromNow(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function getDefaultNotifications(): JobNotification[] {
  return [
    {
      id: '1',
      company: 'Google',
      title: 'Software Engineer III',
      sector: 'Private',
      category: 'Software',
      location: 'Hyderabad, India',
      qualification: 'B.Tech/M.Tech',
      experience: '2-4 Years',
      salary: '25-45 LPA',
      lastDate: daysFromNow(21),
      releaseDate: daysFromNow(-3),
      applyLink: 'https://www.google.com/about/careers/applications/',
      officialWebsite: 'https://www.google.com/about/careers/applications/',
      status: 'New',
      isFeatured: true,
      description: 'Design, develop, test, deploy, maintain and improve software.'
    },
    {
      id: '2',
      company: 'UPSC',
      title: 'Civil Services Examination (Ongoing Cycle)',
      sector: 'Government',
      category: 'UPSC',
      location: 'All India',
      qualification: 'Any Degree',
      experience: 'Freshers',
      salary: '7th Pay Commission',
      lastDate: daysFromNow(18),
      releaseDate: daysFromNow(-5),
      applyLink: 'https://upsconline.gov.in/',
      officialWebsite: 'https://upsc.gov.in',
      status: 'Closing Soon',
      isFeatured: true,
      description: 'Recruitment for IAS, IPS, IFS and other central services.'
    },
    {
      id: '3',
      company: 'Microsoft',
      title: 'Data Analyst Intern',
      sector: 'Private',
      category: 'Internship',
      location: 'Bangalore, India',
      qualification: 'Final Year Student',
      experience: 'Freshers',
      salary: '1.2 Lakhs/Month',
      lastDate: daysFromNow(14),
      releaseDate: daysFromNow(-2),
      applyLink: 'https://careers.microsoft.com',
      officialWebsite: 'https://careers.microsoft.com',
      status: 'New',
      isFeatured: false,
      description: 'Work with data scientists to analyze large data sets.'
    },
    {
      id: '4',
      company: 'SBI',
      title: 'Probationary Officers (PO)',
      sector: 'Government',
      category: 'Banking',
      location: 'All India',
      qualification: 'Graduation in any discipline',
      experience: 'Freshers',
      salary: '8.5 - 13 LPA',
      lastDate: daysFromNow(24),
      releaseDate: daysFromNow(-2),
      applyLink: 'https://sbi.co.in/careers',
      officialWebsite: 'https://sbi.co.in',
      status: 'New',
      isFeatured: true,
      description: 'Recruitment of Probationary Officers in State Bank of India.'
    },
    {
      id: '5',
      company: 'Amazon',
      title: 'SDE-1 (New Grad)',
      sector: 'Private',
      category: 'Software',
      location: 'Bangalore/Hyderabad',
      qualification: 'B.E/B.Tech/CS',
      experience: 'Freshers',
      salary: '18-32 LPA',
      lastDate: daysFromNow(19),
      releaseDate: daysFromNow(-1),
      applyLink: 'https://www.amazon.jobs',
      officialWebsite: 'https://www.amazon.jobs',
      status: 'New',
      isFeatured: true,
      description: 'Solve complex problems and build scalable systems at Amazon.'
    },
    {
      id: '6',
      company: 'SSC',
      title: 'Combined Graduate Level (CGL)',
      sector: 'Government',
      category: 'SSC',
      location: 'All India',
      qualification: 'Bachelor\'s Degree',
      experience: 'Freshers',
      salary: 'Level 4 to Level 8',
      lastDate: daysFromNow(28),
      releaseDate: daysFromNow(-4),
      applyLink: 'https://ssc.gov.in',
      officialWebsite: 'https://ssc.gov.in',
      status: 'New',
      isFeatured: false,
      description: 'Group B and C posts in various Ministries and Departments.'
    },
    {
      id: '7',
      company: 'TCS',
      title: 'Ninja Recruitment (Graduates)',
      sector: 'Private',
      category: 'Software',
      location: 'Pan India',
      qualification: 'B.E/B.Tech/M.E/M.Tech/MCA/M.Sc',
      experience: 'Freshers',
      salary: '3.36 - 3.96 LPA',
      lastDate: daysFromNow(22),
      releaseDate: daysFromNow(-3),
      applyLink: 'https://www.tcs.com/careers',
      officialWebsite: 'https://www.tcs.com/careers',
      status: 'New',
      isFeatured: false,
      description: 'Off-campus hiring for engineering graduates.'
    },
    {
      id: '8',
      company: 'ISRO',
      title: 'Scientist/Engineer \'SC\'',
      sector: 'Government',
      category: 'Scientific',
      location: 'Bangalore/Sriharikota',
      qualification: 'B.E/B.Tech in First Class',
      experience: 'Freshers',
      salary: 'Level 10 Pay Matrix',
      lastDate: daysFromNow(26),
      releaseDate: daysFromNow(-4),
      applyLink: 'https://www.isro.gov.in/Careers.html',
      officialWebsite: 'https://www.isro.gov.in',
      status: 'New',
      isFeatured: true,
      description: 'Join the Indian Space Research Organisation as a Scientist.'
    }
  ];
}

const STORAGE_KEY_USER = 'intervyou_user';
const STORAGE_KEY_SESSIONS = 'intervyou_sessions';
const STORAGE_KEY_NOTIFICATIONS = 'intervyou_notifications';
const STORAGE_KEY_BOOKMARKS = 'intervyou_bookmarks';
const STORAGE_KEY_READ = 'intervyou_read';

function computeStatsFromSessions(list: InterviewSession[]) {
  const completed = list.filter((s) => s.status === 'completed' || Boolean(s.overallReport));
  if (completed.length === 0) {
    return { totalInterviews: 0, avgScore: 0, bestScore: 0 };
  }
  const scores = completed.map((s) => Number(s.overallReport?.overallScore) || 0);
  const sum = scores.reduce((acc, val) => acc + val, 0);
  return {
    totalInterviews: completed.length,
    avgScore: Math.round(sum / completed.length),
    bestScore: Math.max(...scores),
  };
}

export function mergeInterviewLists(primary: InterviewSession[], secondary: InterviewSession[]): InterviewSession[] {
  const byId = new Map<string, InterviewSession>();
  const addOrPick = (candidate: InterviewSession) => {
    if (!candidate?.id) return;
    const existing = byId.get(candidate.id);
    if (!existing) {
      byId.set(candidate.id, candidate);
      return;
    }
    const existingDone = existing.status === 'completed' || Boolean(existing.overallReport);
    const candidateDone = candidate.status === 'completed' || Boolean(candidate.overallReport);
    const existingAnswersCount = Object.keys(existing.answers || {}).length;
    const candidateAnswersCount = Object.keys(candidate.answers || {}).length;

    if ((!existingDone && candidateDone) || (existingDone === candidateDone && candidateAnswersCount > existingAnswersCount)) {
      byId.set(candidate.id, candidate);
    }
  };

  primary.forEach(addOrPick);
  secondary.forEach(addOrPick);

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export type CloudSyncResult = {
  synced: boolean;
  cloudConnected: boolean;
  error?: string;
};

interface AppContextType {
  user: UserProfile;
  setUser: React.Dispatch<React.SetStateAction<UserProfile>>;
  firebaseUid: string | null;
  isAuthenticated: boolean;
  authReady: boolean;
  isProfileLoading: boolean;
  isSyncingProfile: boolean;
  cloudSyncError: string | null;
  serverUnreachable: boolean;
  aiMode: 'mock' | 'gemini' | 'unconfigured' | null;
  setAuthenticated: (authenticated: boolean) => void;
  signInWithGoogle: () => Promise<UserProfile>;
  completeEmailLogin: (serverUser: UserProfile) => Promise<UserProfile>;
  logoutAll: () => Promise<void>;
  syncProfileToCloud: (profile: UserProfile, action: 'profile' | 'resume' | 'jobAlerts' | 'stats' | 'linkedin') => Promise<CloudSyncResult>;
  retryCloudSync: () => Promise<CloudSyncResult>;
  refreshSessions: () => Promise<void>;
  sessions: InterviewSession[];
  addSession: (session: InterviewSession) => Promise<void>;
  updateSession: (session: InterviewSession) => Promise<void>;
  notifications: JobNotification[];
  bookmarkedIds: string[];
  readIds: string[];
  addNotification: (notification: JobNotification) => void;
  updateNotification: (notification: JobNotification) => void;
  deleteNotification: (id: string) => void;
  toggleBookmark: (id: string) => void;
  markAsRead: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticatedState] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseInitResolved, setFirebaseInitResolved] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [aiMode, setAiMode] = useState<'mock' | 'gemini' | 'unconfigured' | null>(null);
  const [user, setUserState] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [sessions, setSessionsState] = useState<InterviewSession[]>([]);
  const userRef = useRef<UserProfile>(DEFAULT_USER_PROFILE);
  const sessionsRef = useRef<InterviewSession[]>([]);
  const syncingSessionsRef = useRef(false);
  const reauthingRef = useRef(false);
  const googleSignInInFlightRef = useRef(false);
  const bootstrapRunIdRef = useRef(0);

  const setUser: React.Dispatch<React.SetStateAction<UserProfile>> = useCallback((action) => {
    setUserState((prev) => {
      const next = typeof action === 'function' ? (action as (p: UserProfile) => UserProfile)(prev) : action;
      userRef.current = next;
      if (next.email) {
        saveAccountBackup(next.email, {
          profile: next,
          markEdited: Boolean(next.profileUpdatedAt || !isSeedProfileSnapshot(next)),
        });
      }
      return next;
    });
  }, []);

  const setSessions: React.Dispatch<React.SetStateAction<InterviewSession[]>> = useCallback((action) => {
    setSessionsState((prev) => {
      const next = typeof action === 'function' ? (action as (p: InterviewSession[]) => InterviewSession[])(prev) : action;
      sessionsRef.current = next;
      if (userRef.current?.email && next.length > 0) {
        saveAccountBackup(userRef.current.email, {
          sessions: next,
          markEdited: true,
        });
      }
      return next;
    });
  }, []);

  const [notifications, setNotifications] = useState<JobNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const active = parsed.filter(isActiveJob);
          if (active.length > 0) return active;
        }
      }
    } catch {
      // ignore corrupted localStorage cache
    }
    return getDefaultNotifications();
  });

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_READ);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch public server AI config
  useEffect(() => {
    let active = true;
    api.config()
      .then((config) => {
        if (active) setAiMode(config.aiMode);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Listen to Firebase Auth state as the primary cloud identity listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setFirebaseInitResolved(true);
    });
    return () => unsubscribe();
  }, []);

  // Reconcile initial session once Firebase Auth resolves or Firebase UID changes
  useEffect(() => {
    if (!firebaseInitResolved) return;
    // When an explicit signInWithGoogle flow is underway, let it own the
    // end-to-end hydration atomically so onAuthStateChanged does not race with it.
    if (googleSignInInFlightRef.current) return;

    let active = true;
    const runId = ++bootstrapRunIdRef.current;
    const isLatestRun = () => active && bootstrapRunIdRef.current === runId;

    const bootstrapSession = async () => {
      setIsProfileLoading(true);
      try {
        if (firebaseUser) {
          // Ensure Express backend session is active (re-exchanges token if server restarted)
          let backendUser: UserProfile | null = null;
          try {
            const meRes = await api.me();
            backendUser = normalizeUserProfile(meRes.user);
            if (
              firebaseUser.email &&
              backendUser.email &&
              normalizeEmailKey(backendUser.email) !== normalizeEmailKey(firebaseUser.email)
            ) {
              const idToken = await firebaseUser.getIdToken();
              const fbLoginRes = await api.firebaseLogin(idToken);
              backendUser = normalizeUserProfile(fbLoginRes.user);
            }
          } catch {
            const idToken = await firebaseUser.getIdToken();
            const fbLoginRes = await api.firebaseLogin(idToken);
            backendUser = normalizeUserProfile(fbLoginRes.user);
          }

          if (!isLatestRun()) return;

          const resolvedEmail = backendUser?.email || firebaseUser.email || '';
          const rawBaseProfile = normalizeUserProfile({
            ...backendUser,
            fullName: backendUser?.fullName || firebaseUser.displayName || '',
            email: resolvedEmail,
            avatarUrl: backendUser?.avatarUrl || firebaseUser.photoURL || '',
            isCompleted: true,
          });

          // Fold in any local edits/avatar saved under the exact same email before Google connected
          const localBackup = readAccountBackup(resolvedEmail);
          const { profile: baseWithBackup } = reconcileProfileWithBackup(rawBaseProfile, localBackup);

          try {
            const cloudProfile = await ensureUserProfileDoc(firebaseUser.uid, baseWithBackup);
            if (!isLatestRun()) return;
            setCloudSyncError(null);
            setUser(cloudProfile);
            saveAccountBackup(cloudProfile.email, {
              profile: cloudProfile,
              markEdited: !isSeedProfileSnapshot(cloudProfile),
            });

            // Sync newer/reconciled cloud profile back to Express backend without overwriting newer backend edits
            const cloudTs = parseTimestampMs(cloudProfile.profileUpdatedAt);
            const backendTs = parseTimestampMs(backendUser?.profileUpdatedAt);
            if (!backendUser || (profilesDiffer(cloudProfile, backendUser) && cloudTs >= backendTs)) {
              void api.updateProfile(cloudProfile).catch(() => undefined);
            }
          } catch (firestoreErr) {
            const readableErr = extractReadableFirestoreError(firestoreErr, 'Could not sync profile from Cloud Firestore.');
            console.warn('Could not sync profile from Firestore, falling back to reconciled profile:', firestoreErr);
            if (isLatestRun()) {
              setCloudSyncError(readableErr);
              setUser(baseWithBackup);
            }
          }

          if (isLatestRun()) {
            setAuthenticatedState(true);
            setServerUnreachable(false);
          }
          return;
        }

        // No Firebase Auth user: check Express session cookie / Bearer token
        const { user: authenticatedUser } = await api.me();
        if (isLatestRun()) {
          const normalized = normalizeUserProfile(authenticatedUser);
          const backup = readAccountBackup(normalized.email);
          const { profile: reconciled, needsServerSync } = reconcileProfileWithBackup(normalized, backup);
          setUser(reconciled);
          setAuthenticatedState(true);
          setServerUnreachable(false);
          setCloudSyncError(null);
          if (needsServerSync) {
            void api.updateProfile(reconciled).catch(() => undefined);
          }
        }
      } catch (error) {
        if (isLatestRun()) {
          setAuthenticatedState(false);
          setUser(DEFAULT_USER_PROFILE);
          setCloudSyncError(null);
          setServerUnreachable(error instanceof ApiError && error.status === 0);
        }
      } finally {
        if (isLatestRun()) {
          setAuthReady(true);
          setIsProfileLoading(false);
        }
      }
    };

    void bootstrapSession();
    return () => {
      active = false;
    };
  }, [firebaseInitResolved, firebaseUser?.uid, setUser]);

  const refreshSessions = useCallback(async () => {
    if (syncingSessionsRef.current) return;
    syncingSessionsRef.current = true;
    try {
      const [{ interviews: serverInterviews }] = await Promise.all([
        api.listInterviews().catch(() => ({ interviews: [] as InterviewSession[] })),
      ]);

      const activeEmail = userRef.current?.email || firebaseUser?.email || '';
      const backupSessions = readAccountBackup(activeEmail)?.sessions || [];
      let merged = mergeInterviewLists(serverInterviews, backupSessions);

      if (firebaseUser) {
        const cloudInterviews = await loadInterviewsFromFirestore(firebaseUser.uid).catch(
          () => [] as InterviewSession[]
        );
        merged = mergeInterviewLists(merged, cloudInterviews);

        // Push any Firestore/backup interviews missing or newly completed from Express server
        const serverMap = new Map(serverInterviews.map((s) => [s.id, s]));
        const needsServerUpdate = merged.filter((s) => {
          const srv = serverMap.get(s.id);
          if (!srv) return true;
          const srvDone = srv.status === 'completed' || Boolean(srv.overallReport);
          const mergedDone = s.status === 'completed' || Boolean(s.overallReport);
          return !srvDone && mergedDone;
        });
        if (needsServerUpdate.length > 0) {
          await api.syncInterviews(needsServerUpdate).catch(() => undefined);
        }

        // Push any Express/backup interviews missing or newly completed from Firestore
        const cloudMap = new Map(cloudInterviews.map((s) => [s.id, s]));
        for (const item of merged) {
          const cloudItem = cloudMap.get(item.id);
          const needsCloudWrite =
            !cloudItem ||
            (cloudItem.status !== 'completed' && (item.status === 'completed' || Boolean(item.overallReport)));
          if (needsCloudWrite) {
            await saveInterviewToFirestore(firebaseUser.uid, item).catch(() => undefined);
          }
        }
      } else {
        // Email/Password session: push any backup interviews missing after server container restart
        const serverMap = new Map(serverInterviews.map((s) => [s.id, s]));
        const needsServerUpdate = merged.filter((s) => {
          const srv = serverMap.get(s.id);
          if (!srv) return true;
          const srvDone = srv.status === 'completed' || Boolean(srv.overallReport);
          const mergedDone = s.status === 'completed' || Boolean(s.overallReport);
          return !srvDone && mergedDone;
        });
        if (needsServerUpdate.length > 0) {
          await api.syncInterviews(needsServerUpdate).catch(() => undefined);
        }
      }

      setSessions(merged);
      const stats = computeStatsFromSessions(merged);
      if (stats.totalInterviews > 0) {
        setUser((current) => ({
          ...current,
          stats,
        }));
      }
    } catch (error: any) {
      if (error?.status === 401 || error?.code === 'unauthorized' || (error instanceof ApiError && error.status === 401)) {
        if (!auth.currentUser) {
          setAuthenticatedState(false);
        }
      } else {
        console.warn('Could not load interview history:', error);
      }
    } finally {
      syncingSessionsRef.current = false;
    }
  }, [firebaseUser, setSessions, setUser]);

  // Attach realtime Firestore listeners when signed in via Firebase Auth
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void refreshSessions();

    if (!firebaseUser) return;

    const unsubProfile = subscribeUserProfile(firebaseUser.uid, (cloudProfile, meta) => {
      if (!meta.hasPendingWrites && !meta.fromCache) {
        setCloudSyncError(null);
      }

      setUser((curr) => {
        const currMs = parseTimestampMs(curr.profileUpdatedAt);
        const cloudMs = parseTimestampMs(cloudProfile.profileUpdatedAt);
        const sameEmail =
          Boolean(curr.email) &&
          normalizeEmailKey(curr.email) === normalizeEmailKey(cloudProfile.email);

        if (sameEmail && currMs > cloudMs && !isSeedProfileSnapshot(curr)) {
          const raisedStats =
            (cloudProfile.stats?.totalInterviews || 0) > (curr.stats?.totalInterviews || 0)
              ? cloudProfile.stats
              : curr.stats;
          return raisedStats === curr.stats ? curr : { ...curr, stats: raisedStats };
        }

        const chosenAvatar = cloudProfile.avatarUrl?.startsWith('data:image/')
          ? cloudProfile.avatarUrl
          : curr.avatarUrl?.startsWith('data:image/')
          ? curr.avatarUrl
          : cloudProfile.avatarUrl || curr.avatarUrl || '';

        const mergedNext: UserProfile = {
          ...cloudProfile,
          avatarUrl: chosenAvatar,
          resumeFile: cloudProfile.resumeFile || curr.resumeFile,
          resumeText:
            cloudProfile.resumeText && cloudProfile.resumeText.length >= (curr.resumeText?.length || 0)
              ? cloudProfile.resumeText
              : curr.resumeText || cloudProfile.resumeText || '',
          profileUpdatedAt: cloudProfile.profileUpdatedAt || curr.profileUpdatedAt || new Date().toISOString(),
          stats:
            (curr.stats?.totalInterviews || 0) > (cloudProfile.stats?.totalInterviews || 0)
              ? curr.stats
              : cloudProfile.stats,
        };

        if (sameEmail && !profilesDiffer(curr, mergedNext) && curr.profileUpdatedAt === mergedNext.profileUpdatedAt) {
          return curr;
        }

        return mergedNext;
      });
    });

    const unsubInterviews = subscribeInterviews(firebaseUser.uid, (cloudList) => {
      const merged = mergeInterviewLists(sessionsRef.current, cloudList);
      setSessions(merged);
      const stats = computeStatsFromSessions(merged);
      if (stats.totalInterviews > 0) {
        setUser((prevUser) => ({
          ...prevUser,
          stats,
        }));
      }
    });

    return () => {
      unsubProfile();
      unsubInterviews();
    };
  }, [authReady, isAuthenticated, firebaseUser?.uid, refreshSessions, setSessions, setUser]);

  const setAuthenticated = useCallback((authenticated: boolean) => {
    setAuthenticatedState(authenticated);
    if (!authenticated) {
      sessionsRef.current = [];
      userRef.current = DEFAULT_USER_PROFILE;
      setSessionsState([]);
      setUserState(DEFAULT_USER_PROFILE);
      setCloudSyncError(null);
      setIsSyncingProfile(false);
      setIsProfileLoading(false);
      setBookmarkedIds([]);
      setReadIds([]);
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      localStorage.removeItem(STORAGE_KEY_BOOKMARKS);
      localStorage.removeItem(STORAGE_KEY_READ);
      localStorage.removeItem('intervyou_token');
      // NOTE: Deliberately preserve per-email intervyou_account_backup_v1:<email> backups
      // so users logging out or hitting a server restart retain their edits & interviews.
      try {
        sessionStorage.removeItem('intervyou_daily_tip_dismissed_session');
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  useEffect(() => {
    const onExpired = () => {
      const fbUser = auth.currentUser;
      if (fbUser && !reauthingRef.current) {
        // Express container may have restarted: transparently re-exchange Firebase ID token
        reauthingRef.current = true;
        fbUser
          .getIdToken(true)
          .then((idToken) => api.firebaseLogin(idToken))
          .then(async () => {
            if (userRef.current?.email) {
              await api.updateProfile(userRef.current).catch(() => undefined);
            }
            if (sessionsRef.current.length > 0) {
              await api.syncInterviews(sessionsRef.current).catch(() => undefined);
            }
          })
          .catch(() => {
            setAuthenticated(false);
          })
          .finally(() => {
            reauthingRef.current = false;
          });
        return;
      }
      if (!fbUser) {
        setAuthenticated(false);
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [setAuthenticated]);

  const signInWithGoogle = useCallback(async (): Promise<UserProfile> => {
    const currentEmailUser = userRef.current?.email ? userRef.current : null;
    const currentLocalSessions = [...sessionsRef.current];

    googleSignInInFlightRef.current = true;
    bootstrapRunIdRef.current += 1;
    setIsProfileLoading(true);
    setCloudSyncError(null);

    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken = await credential.user.getIdToken();
      const res = await api.firebaseLogin(idToken);
      const serverProfile = normalizeUserProfile(res.user);
      const googleEmail = normalizeEmailKey(serverProfile.email || credential.user.email || '');

      // Preserve edits/interviews from active pre-Google session (if same email) or local backup
      const sameEmailCurrent =
        currentEmailUser && normalizeEmailKey(currentEmailUser.email) === googleEmail
          ? currentEmailUser
          : null;
      const backup = readAccountBackup(googleEmail);

      const candidateBase = normalizeUserProfile({
        ...serverProfile,
        ...(sameEmailCurrent || {}),
        fullName:
          sameEmailCurrent?.fullName ||
          serverProfile.fullName ||
          credential.user.displayName ||
          '',
        email: googleEmail || serverProfile.email || credential.user.email || '',
        avatarUrl:
          sameEmailCurrent?.avatarUrl ||
          serverProfile.avatarUrl ||
          credential.user.photoURL ||
          '',
        isCompleted: true,
      });

      const { profile: baseWithBackup } = reconcileProfileWithBackup(candidateBase, backup);

      let finalProfile = baseWithBackup;
      try {
        finalProfile = await ensureUserProfileDoc(credential.user.uid, baseWithBackup);
        setCloudSyncError(null);
        if (profilesDiffer(finalProfile, serverProfile)) {
          const synced = await api.updateProfile(finalProfile).catch(() => null);
          if (synced?.user) {
            finalProfile = normalizeUserProfile({
              ...finalProfile,
              ...synced.user,
              avatarUrl: finalProfile.avatarUrl || synced.user.avatarUrl,
              profileUpdatedAt:
                parseTimestampMs(synced.user.profileUpdatedAt) >= parseTimestampMs(finalProfile.profileUpdatedAt)
                  ? synced.user.profileUpdatedAt
                  : finalProfile.profileUpdatedAt,
            });
          }
        }
      } catch (cloudErr) {
        console.warn('Firestore profile bootstrap warning:', cloudErr);
        setCloudSyncError(extractReadableFirestoreError(cloudErr, 'Could not sync profile with Cloud Firestore.'));
      }

      // Push any local/backup sessions for this email into Firestore so linking Google keeps them
      const candidateSessions = mergeInterviewLists(
        sameEmailCurrent ? currentLocalSessions : [],
        backup?.sessions || []
      );
      if (candidateSessions.length > 0) {
        for (const s of candidateSessions) {
          await saveInterviewToFirestore(credential.user.uid, s).catch(() => undefined);
        }
      }

      setFirebaseUser(credential.user);
      setFirebaseInitResolved(true);
      setUser(finalProfile);
      setAuthenticatedState(true);
      setAuthReady(true);
      setServerUnreachable(false);
      return finalProfile;
    } finally {
      setIsProfileLoading(false);
      googleSignInInFlightRef.current = false;
    }
  }, [setUser]);

  const completeEmailLogin = useCallback(async (rawServerUser: UserProfile): Promise<UserProfile> => {
    setIsProfileLoading(true);
    setCloudSyncError(null);
    try {
      const serverUser = normalizeUserProfile(rawServerUser);
      const cleanEmail = normalizeEmailKey(serverUser.email);
      const backup = readAccountBackup(cleanEmail);
      const { profile: reconciled, needsServerSync } = reconcileProfileWithBackup(serverUser, backup);

      let finalProfile = reconciled;

      if (needsServerSync) {
        const updated = await api.updateProfile(reconciled).catch(() => null);
        if (updated?.user) {
          finalProfile = normalizeUserProfile({
            ...reconciled,
            ...updated.user,
            avatarUrl: reconciled.avatarUrl || updated.user.avatarUrl,
          });
        }
      }

      // If an active Firebase session exists for this exact email, reconcile with Firestore before entering
      const activeFb = auth.currentUser;
      if (activeFb && normalizeEmailKey(activeFb.email) === cleanEmail) {
        try {
          finalProfile = await ensureUserProfileDoc(activeFb.uid, finalProfile);
          if (profilesDiffer(finalProfile, serverUser)) {
            void api.updateProfile(finalProfile).catch(() => undefined);
          }
        } catch (cloudErr) {
          setCloudSyncError(extractReadableFirestoreError(cloudErr, 'Could not reconcile with Cloud Firestore.'));
        }
      }

      if (backup?.sessions?.length) {
        const { interviews: serverInterviews } = await api.listInterviews().catch(() => ({ interviews: [] as InterviewSession[] }));
        const merged = mergeInterviewLists(serverInterviews, backup.sessions);
        const serverMap = new Map(serverInterviews.map((s) => [s.id, s]));
        const missingOrUpdated = merged.filter((s) => {
          const srv = serverMap.get(s.id);
          if (!srv) return true;
          const srvDone = srv.status === 'completed' || Boolean(srv.overallReport);
          const mergedDone = s.status === 'completed' || Boolean(s.overallReport);
          return !srvDone && mergedDone;
        });
        if (missingOrUpdated.length > 0) {
          await api.syncInterviews(missingOrUpdated).catch(() => undefined);
        }
      }

      setUser(finalProfile);
      setAuthenticatedState(true);
      setAuthReady(true);
      setServerUnreachable(false);
      return finalProfile;
    } finally {
      setIsProfileLoading(false);
    }
  }, [setUser]);

  const logoutAll = useCallback(async () => {
    try {
      await Promise.allSettled([api.logout(), firebaseSignOut(auth)]);
    } finally {
      setFirebaseUser(null);
      setAuthenticated(false);
    }
  }, [setAuthenticated]);

  const syncProfileToCloud = useCallback(
    async (
      profile: UserProfile,
      action: 'profile' | 'resume' | 'jobAlerts' | 'stats' | 'linkedin'
    ): Promise<CloudSyncResult> => {
      const normalized = normalizeUserProfile({
        ...profile,
        profileUpdatedAt: profile.profileUpdatedAt || new Date().toISOString(),
      });
      if (normalized.email) {
        saveAccountBackup(normalized.email, { profile: normalized, markEdited: true });
      }
      const activeFb = firebaseUser || auth.currentUser;
      if (!activeFb) {
        setCloudSyncError(null);
        return { synced: false, cloudConnected: false };
      }
      setIsSyncingProfile(true);
      try {
        await saveProfileActionToFirestore(activeFb.uid, normalized, action);
        setCloudSyncError(null);
        return { synced: true, cloudConnected: true };
      } catch (err) {
        const readableMsg = extractReadableFirestoreError(err, 'Cloud sync failed.');
        console.warn('Firestore profile sync failed:', err);
        setCloudSyncError(readableMsg);
        return { synced: false, cloudConnected: true, error: readableMsg };
      } finally {
        setIsSyncingProfile(false);
      }
    },
    [firebaseUser]
  );

  const retryCloudSync = useCallback(async (): Promise<CloudSyncResult> => {
    const current = normalizeUserProfile({
      ...userRef.current,
      profileUpdatedAt: userRef.current.profileUpdatedAt || new Date().toISOString(),
    });
    return syncProfileToCloud(current, 'profile');
  }, [syncProfileToCloud]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_READ, JSON.stringify(readIds));
  }, [readIds]);

  const persistSessionAndStats = useCallback(
    async (session: InterviewSession) => {
      const merged = mergeInterviewLists([session], sessionsRef.current);
      const nextStats = computeStatsFromSessions(merged);

      sessionsRef.current = merged;
      setSessionsState(merged);

      let nextUser = userRef.current;
      if (nextStats.totalInterviews > 0) {
        nextUser = {
          ...userRef.current,
          stats: nextStats,
        };
        userRef.current = nextUser;
        setUserState(nextUser);
      }

      if (nextUser.email) {
        saveAccountBackup(nextUser.email, {
          profile: nextUser,
          sessions: merged,
          markEdited: true,
        });
      }

      const activeFb = firebaseUser || auth.currentUser;
      if (activeFb) {
        await saveInterviewToFirestore(activeFb.uid, session);
        if (nextStats.totalInterviews > 0) {
          await saveProfileActionToFirestore(activeFb.uid, nextUser, 'stats');
        }
      }
    },
    [firebaseUser]
  );

  const addSession = useCallback(
    async (session: InterviewSession) => {
      try {
        await persistSessionAndStats(session);
      } catch (err) {
        console.warn('Failed to persist new interview session to Firestore:', err);
      }
    },
    [persistSessionAndStats]
  );

  const updateSession = useCallback(
    async (updatedSession: InterviewSession) => {
      try {
        await persistSessionAndStats(updatedSession);
      } catch (err) {
        console.warn('Failed to persist updated interview session to Firestore:', err);
      }
    },
    [persistSessionAndStats]
  );

  const addNotification = (notification: JobNotification) => {
    setNotifications((prev) => [notification, ...prev]);
  };

  const updateNotification = (updated: JobNotification) => {
    setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      setReadIds((prev) => [...prev, id]);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        firebaseUid: firebaseUser?.uid || null,
        isAuthenticated,
        authReady,
        isProfileLoading,
        isSyncingProfile,
        cloudSyncError,
        serverUnreachable,
        aiMode,
        setAuthenticated,
        signInWithGoogle,
        completeEmailLogin,
        logoutAll,
        syncProfileToCloud,
        retryCloudSync,
        refreshSessions,
        sessions,
        addSession,
        updateSession,
        notifications,
        bookmarkedIds,
        readIds,
        addNotification,
        updateNotification,
        deleteNotification,
        toggleBookmark,
        markAsRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
