import type { InterviewSession, UserProfile } from '../types';

const BACKUP_PREFIX = 'intervyou_account_backup_v1:';
const MAX_BACKUP_SESSIONS = 40;

export interface AccountBackupRecord {
  email: string;
  updatedAt: number;
  hasUserEdits: boolean;
  profile: UserProfile;
  sessions: InterviewSession[];
}

type SeedSignature = {
  fullName: string;
  dob: string;
  gender: string;
  mobile: string;
  address: string;
  qualification: string;
  preferredLanguage: string;
  college: string;
  degree: string;
  specialization: string;
  graduationYear: string;
  cgpa: string;
};

const SEED_VARIANTS: Record<string, SeedSignature[]> = {
  'test@example.com': [
    {
      fullName: 'Demo Candidate',
      dob: '1998-05-15',
      gender: 'Male',
      mobile: '9876543210',
      address: 'Hyderabad, India',
      qualification: 'B.Tech Computer Science',
      preferredLanguage: 'English',
      college: 'National Institute of Technology',
      degree: 'B.Tech',
      specialization: 'Computer Science and Engineering',
      graduationYear: '2022',
      cgpa: '8.7',
    },
  ],
  'demo@example.com': [
    {
      fullName: 'Demo Candidate',
      dob: '1998-05-15',
      gender: 'Male',
      mobile: '9876543210',
      address: 'Hyderabad, India',
      qualification: 'B.Tech Computer Science',
      preferredLanguage: 'English',
      college: 'National Institute of Technology',
      degree: 'B.Tech',
      specialization: 'Computer Science and Engineering',
      graduationYear: '2022',
      cgpa: '8.7',
    },
  ],
  'hareeshbhumireddi@gmail.com': [
    {
      fullName: 'Hareesh Bhumireddi',
      dob: '1998-05-15',
      gender: 'Male',
      mobile: '9876543210',
      address: 'Visakhapatnam, Andhra Pradesh',
      qualification: 'B.Tech Computer Science',
      preferredLanguage: 'English',
      college: 'National Institute of Technology',
      degree: 'B.Tech',
      specialization: 'Computer Science and Engineering',
      graduationYear: '2025',
      cgpa: '8.18',
    },
    {
      fullName: 'Hareesh Bhumireddi',
      dob: '1998-05-15',
      gender: 'Male',
      mobile: '9876543210',
      address: 'Hyderabad, India',
      qualification: 'B.Tech Computer Science',
      preferredLanguage: 'English',
      college: 'National Institute of Technology',
      degree: 'B.Tech',
      specialization: 'Computer Science and Engineering',
      graduationYear: '2022',
      cgpa: '8.8',
    },
  ],
};

export function normalizeEmailKey(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

export function parseTimestampMs(iso?: string | null): number {
  if (!iso || typeof iso !== 'string') return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export function isSeedDefaultFieldValue(
  email: string | undefined,
  field: keyof SeedSignature,
  value: string | undefined
): boolean {
  const key = normalizeEmailKey(email);
  const variants = SEED_VARIANTS[key];
  if (!variants || !value) return false;
  const trimmed = String(value).trim();
  return variants.some((sig) => sig[field] === trimmed);
}

/**
 * Returns true if the core personal & academic fields of a known seed account
 * still hold their original placeholder seed values (even if avatar/resume were added).
 */
export function hasUneditedSeedFields(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  const key = normalizeEmailKey(profile.email);
  const variants = SEED_VARIANTS[key];
  if (!variants) return false;
  return variants.some(
    (sig) =>
      (profile.dob || '') === sig.dob &&
      (profile.mobile || '') === sig.mobile &&
      (profile.education?.college || '') === sig.college &&
      (profile.address || '') === sig.address
  );
}

/**
 * Returns true if the given profile matches a hardcoded server.ts seed account
 * without any user-saved timestamp, avatar, resume, or work history edits.
 */
export function isSeedProfileSnapshot(profile?: UserProfile | null): boolean {
  if (!profile) return true;
  if (profile.profileUpdatedAt) return false;
  if (profile.avatarUrl && profile.avatarUrl.startsWith('data:image/')) return false;
  if (profile.resumeText && profile.resumeText.trim().length > 0) return false;
  if (Array.isArray(profile.workHistory) && profile.workHistory.length > 0) return false;
  if (profile.linkedinProfile?.connected) return false;

  const key = normalizeEmailKey(profile.email);
  const variants = SEED_VARIANTS[key];
  if (!variants) return false;

  return variants.some(
    (sig) =>
      (profile.fullName || '') === sig.fullName &&
      (profile.dob || '') === sig.dob &&
      (profile.gender || '') === sig.gender &&
      (profile.mobile || '') === sig.mobile &&
      (profile.address || '') === sig.address &&
      (profile.qualification || '') === sig.qualification &&
      (profile.preferredLanguage || '') === sig.preferredLanguage &&
      (profile.education?.college || '') === sig.college &&
      (profile.education?.degree || '') === sig.degree &&
      (profile.education?.specialization || '') === sig.specialization &&
      (profile.education?.graduationYear || '') === sig.graduationYear &&
      (profile.education?.cgpa || '') === sig.cgpa
  );
}

export function readAccountBackup(email?: string | null): AccountBackupRecord | null {
  if (typeof window === 'undefined') return null;
  const key = normalizeEmailKey(email);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(`${BACKUP_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountBackupRecord;
    if (!parsed || normalizeEmailKey(parsed.email) !== key) {
      return null;
    }
    return {
      email: key,
      updatedAt: Number(parsed.updatedAt) || 0,
      hasUserEdits: Boolean(parsed.hasUserEdits),
      profile: parsed.profile,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return null;
  }
}

export function saveAccountBackup(
  email: string | undefined | null,
  patch: {
    profile?: UserProfile;
    sessions?: InterviewSession[];
    markEdited?: boolean;
  }
): void {
  if (typeof window === 'undefined') return;
  const key = normalizeEmailKey(email || patch.profile?.email);
  if (!key) return;

  const existing = readAccountBackup(key);
  const nextProfile = patch.profile || existing?.profile;
  if (!nextProfile) return;

  const nextSessions = (patch.sessions !== undefined ? patch.sessions : existing?.sessions || []).slice(
    0,
    MAX_BACKUP_SESSIONS
  );

  const isPureSeed = !patch.markEdited && !existing?.hasUserEdits && isSeedProfileSnapshot(nextProfile) && nextSessions.length === 0;
  if (isPureSeed) {
    return;
  }

  const record: AccountBackupRecord = {
    email: key,
    updatedAt: Date.now(),
    hasUserEdits: Boolean(patch.markEdited || existing?.hasUserEdits || !isSeedProfileSnapshot(nextProfile) || nextSessions.length > 0),
    profile: nextProfile,
    sessions: nextSessions,
  };

  try {
    localStorage.setItem(`${BACKUP_PREFIX}${key}`, JSON.stringify(record));
  } catch {
    // If localStorage quota is tight (e.g. many large sessions), drop older session payloads first
    // so the user's edited profile, avatar, and latest sessions are always preserved.
    try {
      const compactSessions = nextSessions.slice(0, 10);
      localStorage.setItem(
        `${BACKUP_PREFIX}${key}`,
        JSON.stringify({ ...record, sessions: compactSessions })
      );
    } catch {
      try {
        localStorage.setItem(
          `${BACKUP_PREFIX}${key}`,
          JSON.stringify({ ...record, sessions: [] })
        );
      } catch {
        // Ignore storage errors in private browsing modes
      }
    }
  }
}

function stableProfileDigest(p: UserProfile): string {
  return JSON.stringify({
    fullName: p.fullName || '',
    dob: p.dob || '',
    gender: p.gender || '',
    email: normalizeEmailKey(p.email),
    mobile: p.mobile || '',
    address: p.address || '',
    qualification: p.qualification || '',
    preferredLanguage: p.preferredLanguage || '',
    education: {
      degree: p.education?.degree || '',
      college: p.education?.college || '',
      specialization: p.education?.specialization || '',
      graduationYear: p.education?.graduationYear || '',
      cgpa: p.education?.cgpa || '',
    },
    skills: p.skills || [],
    certificates: p.certificates || [],
    workHistory: p.workHistory || [],
    linkedinProfile: p.linkedinProfile || null,
    avatarUrl: p.avatarUrl || '',
    resumeText: p.resumeText || '',
    resumeFile: p.resumeFile || null,
    jobAlertSubscription: p.jobAlertSubscription || null,
  });
}

export function profilesDiffer(a?: UserProfile | null, b?: UserProfile | null): boolean {
  if (!a || !b) return true;
  return stableProfileDigest(a) !== stableProfileDigest(b);
}

/**
 * Merges a server-returned UserProfile with the user's account-scoped local backup.
 * When the backend container restarts and instance/db.json resets to hardcoded seed
 * defaults, the user's real edited name, phone, DOB, college, avatar, resume, and
 * skills are automatically restored and flagged for re-sync to the backend.
 */
export function reconcileProfileWithBackup(
  serverProfile: UserProfile,
  backup: AccountBackupRecord | null
): { profile: UserProfile; needsServerSync: boolean } {
  if (!backup || !backup.profile) {
    return { profile: serverProfile, needsServerSync: false };
  }
  if (normalizeEmailKey(serverProfile.email) !== normalizeEmailKey(backup.email)) {
    return { profile: serverProfile, needsServerSync: false };
  }

  const b = backup.profile;
  const serverLooksResetSeed = isSeedProfileSnapshot(serverProfile);
  const serverMs = parseTimestampMs(serverProfile.profileUpdatedAt);
  const backupMs = parseTimestampMs(b.profileUpdatedAt);
  const serverHasSeedPersonal = hasUneditedSeedFields(serverProfile);
  const backupHasSeedPersonal = hasUneditedSeedFields(b);

  // Restore local backup as primary when:
  // 1) Server reset to seed defaults while backup has user edits,
  // 2) Local backup has a strictly newer explicit edit timestamp than server, or
  // 3) Server still holds untouched placeholder seed personal/college fields while backup has edited personal fields.
  const backupShouldWin =
    (serverLooksResetSeed && backup.hasUserEdits) ||
    (backupMs > serverMs && !isSeedProfileSnapshot(b)) ||
    (serverHasSeedPersonal && !backupHasSeedPersonal && backup.hasUserEdits && serverMs === 0);

  if (backupShouldWin) {
    const recoveredAvatar =
      b.avatarUrl?.startsWith('data:image/')
        ? b.avatarUrl
        : b.avatarUrl || serverProfile.avatarUrl || '';
    const restored: UserProfile = {
      ...serverProfile,
      ...b,
      email: serverProfile.email || b.email,
      avatarUrl: recoveredAvatar,
      resumeText:
        (b.resumeText?.length || 0) >= (serverProfile.resumeText?.length || 0)
          ? b.resumeText
          : serverProfile.resumeText,
      resumeFile: b.resumeFile || serverProfile.resumeFile,
      skills: b.skills?.length ? b.skills : serverProfile.skills || [],
      certificates: b.certificates?.length ? b.certificates : serverProfile.certificates || [],
      workHistory:
        (b.workHistory?.length || 0) >= (serverProfile.workHistory?.length || 0)
          ? b.workHistory
          : serverProfile.workHistory || [],
      linkedinProfile: b.linkedinProfile || serverProfile.linkedinProfile,
      jobAlertSubscription: b.jobAlertSubscription || serverProfile.jobAlertSubscription,
      education: {
        degree: b.education?.degree ?? serverProfile.education?.degree ?? '',
        college: b.education?.college ?? serverProfile.education?.college ?? '',
        specialization: b.education?.specialization ?? serverProfile.education?.specialization ?? '',
        graduationYear: b.education?.graduationYear ?? serverProfile.education?.graduationYear ?? '',
        cgpa: b.education?.cgpa ?? serverProfile.education?.cgpa ?? '',
      },
      stats:
        (b.stats?.totalInterviews || 0) >= (serverProfile.stats?.totalInterviews || 0)
          ? b.stats
          : serverProfile.stats,
      profileUpdatedAt: b.profileUpdatedAt || serverProfile.profileUpdatedAt || new Date().toISOString(),
    };
    return {
      profile: restored,
      needsServerSync: profilesDiffer(serverProfile, restored),
    };
  }

  // Otherwise, recover only genuinely missing fields (e.g., lost custom avatar or resumeText)
  const recoveredAvatar =
    !serverProfile.avatarUrl && b.avatarUrl
      ? b.avatarUrl
      : serverProfile.avatarUrl && !serverProfile.avatarUrl.startsWith('data:image/') && b.avatarUrl?.startsWith('data:image/')
      ? b.avatarUrl
      : serverProfile.avatarUrl;

  const merged: UserProfile = {
    ...serverProfile,
    fullName: serverProfile.fullName || b.fullName,
    dob: serverProfile.dob || b.dob,
    gender: serverProfile.gender || b.gender,
    mobile: serverProfile.mobile || b.mobile,
    address: serverProfile.address || b.address,
    qualification: serverProfile.qualification || b.qualification,
    preferredLanguage: serverProfile.preferredLanguage || b.preferredLanguage,
    avatarUrl: recoveredAvatar || '',
    resumeText:
      (serverProfile.resumeText?.length || 0) >= (b.resumeText?.length || 0)
        ? serverProfile.resumeText
        : b.resumeText,
    resumeFile: serverProfile.resumeFile || b.resumeFile,
    skills: serverProfile.skills?.length ? serverProfile.skills : b.skills || [],
    certificates: serverProfile.certificates?.length ? serverProfile.certificates : b.certificates || [],
    workHistory:
      (serverProfile.workHistory?.length || 0) >= (b.workHistory?.length || 0)
        ? serverProfile.workHistory
        : b.workHistory || [],
    linkedinProfile: serverProfile.linkedinProfile || b.linkedinProfile,
    jobAlertSubscription: serverProfile.jobAlertSubscription || b.jobAlertSubscription,
    education: {
      degree: serverProfile.education?.degree || b.education?.degree || '',
      college: serverProfile.education?.college || b.education?.college || '',
      specialization: serverProfile.education?.specialization || b.education?.specialization || '',
      graduationYear: serverProfile.education?.graduationYear || b.education?.graduationYear || '',
      cgpa: serverProfile.education?.cgpa || b.education?.cgpa || '',
    },
    stats:
      (serverProfile.stats?.totalInterviews || 0) >= (b.stats?.totalInterviews || 0)
        ? serverProfile.stats
        : b.stats,
  };

  return {
    profile: merged,
    needsServerSync: profilesDiffer(serverProfile, merged),
  };
}
