import { AudioReplayMetadata, InterviewSession, JobAlertSubscription, JobApplication, JobNotification, SavedJob, UserProfile, VoiceInputTelemetry } from '../types';
import type { LiveJobSearchParams, LiveJobSearchResponse } from '../services/jobLiveService';

const configuredBase = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
const API_BASE = (configuredBase || '/api').replace(/\/$/, '');

export const AUTH_EXPIRED_EVENT = 'intervyou:auth-expired';

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;

  constructor(message: string, status: number, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const TOKEN_STORAGE_KEY = 'intervyou_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Could not connect to the application server. Check that the backend is running.', 0);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A 401 from a protected endpoint means the session ended (expired, revoked or
    // signed out elsewhere); tell the app so it can return to the login screen.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      setStoredToken(null);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(payload.error || `Request failed (${response.status}).`, response.status, payload.code, payload.fields);
  }
  return payload as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Could not connect to the application server. Check that the backend is running.', 0);
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      setStoredToken(null);
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error || `Request failed (${response.status}).`, response.status);
  }
  return response.blob();
}

export type PublicConfig = {
  aiMode: 'mock' | 'gemini' | 'unconfigured';
  languages: string[];
  degrees: string[];
  genders: string[];
  graduationYear: { min: number; max: number };
};

export type AtsResult = {
  score: number;
  grade: string;
  breakdown: { name: string; weight: number; earned: number; note: string }[];
  keywordSource: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionsFound: string[];
  sectionsMissing: string[];
  suggestions: string[];
  stats: { words: number; bullets: number; lines: number };
  disclaimer: string;
};

export type ResumeStrengthResult = {
  score: number;
  tier: 'Elite' | 'Strong' | 'Competitive' | 'Needs Polish';
  industry: string;
  targetRole: string;
  summary: string;
  keywordCoverage: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    status: 'Strong' | 'Moderate' | 'Needs Work';
    insight: string;
  }>;
  suggestions: Array<{
    priority: 'High' | 'Medium' | 'Quick Win';
    title: string;
    detail: string;
    exampleRewrite?: string;
  }>;
  aiPowered: boolean;
};

export const api = {
  analyzeResume: (body: { jobDescription?: string; role?: string; text?: string }) =>
    requestJson<{ ats: AtsResult }>('/resumes/ats', { method: 'POST', body: JSON.stringify(body) }),
  analyzeResumeStrength: (body: { industry?: string; targetRole?: string; text?: string }) =>
    requestJson<{ strength: ResumeStrengthResult }>('/resumes/strength', { method: 'POST', body: JSON.stringify(body) }),
  config: () => requestJson<PublicConfig>('/config'),
  register: async (profile: UserProfile, password: string) => {
    const res = await requestJson<{ user: UserProfile; message: string; token?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: profile.email, password, profile }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },
  login: async (email: string, password: string) => {
    const res = await requestJson<{ user: UserProfile; message: string; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },
  firebaseLogin: async (idToken: string) => {
    const res = await requestJson<{ user: UserProfile; message: string; token?: string }>('/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },
  me: () => requestJson<{ user: UserProfile }>('/auth/me'),
  logout: async () => {
    try {
      return await requestJson<{ message: string }>('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },
  updateProfile: (profile: UserProfile) => requestJson<{ user: UserProfile }>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ email: profile.email, profile }),
  }),
  getResume: () => requestJson<{ resume: { name: string; type: string; size: number; uploadedAt: string }; text?: string }>('/resumes'),
  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return requestJson<{ resume: { name: string; type: string; size: number; uploadedAt: string }; message: string; text?: string }>('/resumes', {
      method: 'POST',
      body: formData,
    });
  },
  downloadResume: () => requestBlob('/resumes/file'),
  deleteResume: () => requestJson<{ message: string }>('/resumes', { method: 'DELETE' }),
  startInterview: (details: Record<string, unknown>) => requestJson<{ interview: InterviewSession }>('/interviews', {
    method: 'POST',
    body: JSON.stringify(details),
  }),
  listInterviews: () => requestJson<{ interviews: InterviewSession[] }>('/interviews'),
  syncInterviews: (interviews: InterviewSession[]) =>
    requestJson<{ synced: number; interviews: InterviewSession[] }>('/interviews/sync', {
      method: 'POST',
      body: JSON.stringify({ interviews }),
    }),
  getInterview: (id: string) => requestJson<{ interview: InterviewSession }>(`/interviews/${encodeURIComponent(id)}`),
  interviewQuestions: (id: string) => requestJson<{ questions: InterviewSession['questions'] }>(`/interview/questions?interview_id=${encodeURIComponent(id)}`),
  repeatQuestion: (interviewId: string, questionId: string) => requestJson<{ question: { id: string; question: string; category: string; repeatCount: number } }>(
    `/interviews/${encodeURIComponent(interviewId)}/questions/${encodeURIComponent(questionId)}/repeat`,
    { method: 'POST' },
  ),
  skipQuestion: (interviewId: string, questionId: string) => requestJson<{ answer: { questionId: string; answer: string; evaluation: InterviewSession['evaluations'][string] } }>(
    `/interviews/${encodeURIComponent(interviewId)}/skip`,
    { method: 'POST', body: JSON.stringify({ questionId }) },
  ),
  submitAnswer: (
    interviewId: string,
    questionId: string,
    answer: string,
    voiceMetrics?: VoiceInputTelemetry
  ) => requestJson<{ answer: { questionId: string; answer: string; evaluation: InterviewSession['evaluations'][string] } }>(
    `/interviews/${encodeURIComponent(interviewId)}/answers`,
    { method: 'POST', body: JSON.stringify({ questionId, answer, ...(voiceMetrics ? { voiceMetrics } : {}) }) },
  ),
  completeInterview: (interviewId: string) => requestJson<{ interview: InterviewSession }>(`/interviews/${encodeURIComponent(interviewId)}/complete`, {
    method: 'POST',
  }),
  uploadQuestionAudio: (
    interviewId: string,
    questionId: string,
    audioBlob: Blob,
    durationSec: number,
    chunkCount: number
  ) => {
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    formData.append('audio', audioBlob, `replay-${questionId}.${ext}`);
    formData.append('durationSec', String(Math.max(1, Math.round(durationSec))));
    formData.append('chunkCount', String(Math.max(1, chunkCount)));
    return requestJson<{ audioReplay: AudioReplayMetadata }>(
      `/interviews/${encodeURIComponent(interviewId)}/audio/${encodeURIComponent(questionId)}`,
      { method: 'POST', body: formData }
    );
  },
  fetchQuestionAudioBlob: (interviewId: string, questionId: string) =>
    requestBlob(`/interviews/${encodeURIComponent(interviewId)}/audio/${encodeURIComponent(questionId)}`),
  performance: () => requestJson<{ performance: { totalInterviews: number; averageScore: number; bestScore: number; correctAnswers: number; incorrectAnswers: number; history: Array<{ interviewId: string; score: number; correct: number; incorrect: number; totalQuestions: number; date: string }> } }>('/performance'),
  savedJobs: () => requestJson<{ savedJobs: SavedJob[] }>('/saved-jobs'),
  saveJob: (job: JobNotification) => requestJson<{ savedJob: SavedJob }>('/saved-jobs', {
    method: 'POST',
    body: JSON.stringify({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      applyLink: job.applyLink,
    }),
  }),
  deleteSavedJob: (id: number) => requestJson<{ message: string }>(`/saved-jobs/${id}`, { method: 'DELETE' }),
  searchLiveJobs: (params: LiveJobSearchParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('query', params.query);
    if (params.location) searchParams.set('location', params.location);
    if (params.platform) searchParams.set('platform', params.platform);
    if (params.experience) searchParams.set('experience', params.experience);
    if (params.industry) searchParams.set('industry', params.industry);
    if (params.jobType) searchParams.set('jobType', params.jobType);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.refresh) searchParams.set('refresh', 'true');
    const qs = searchParams.toString();
    return requestJson<LiveJobSearchResponse>(`/jobs/search${qs ? `?${qs}` : ''}`);
  },
  applications: () => requestJson<{ applications: JobApplication[] }>('/applications'),
  quickApply: (payload: Omit<JobApplication, 'id' | 'appliedAt' | 'status'>) =>
    requestJson<{ application: JobApplication }>('/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateJobAlertSubscription: (payload: {
    enabled: boolean;
    frequency?: 'instant' | 'daily' | 'weekly';
    email?: string;
    matchedSkills?: string[];
  }) =>
    requestJson<{
      user: UserProfile;
      subscription: JobAlertSubscription;
      matchedCount: number;
      sampleMatches: Array<{ id: string; title: string; company: string; location: string; platform?: string; matchedSkills: string[] }>;
    }>('/settings/job-alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  linkedinStatus: () =>
    requestJson<{
      oauthConfigured: boolean;
      redirectUri: string;
      connection: UserProfile['linkedinProfile'];
      workHistoryCount: number;
    }>('/integrations/linkedin/status'),
  linkedinAuthUrl: () =>
    requestJson<{ authUrl: string; redirectUri: string }>('/integrations/linkedin/auth-url'),
  importLinkedInWorkHistory: (payload: {
    file?: File;
    rawText?: string;
    profileUrl?: string;
    headline?: string;
    replaceExisting?: boolean;
  }) => {
    if (payload.file) {
      const formData = new FormData();
      formData.append('file', payload.file);
      if (payload.profileUrl) formData.append('profileUrl', payload.profileUrl);
      if (payload.headline) formData.append('headline', payload.headline);
      if (payload.replaceExisting) formData.append('replaceExisting', 'true');
      return requestJson<{
        user: UserProfile;
        importedEntriesCount: number;
        addedEntriesCount: number;
        addedSkillsCount: number;
        workHistory: NonNullable<UserProfile['workHistory']>;
      }>('/integrations/linkedin/import', {
        method: 'POST',
        body: formData,
      });
    }
    return requestJson<{
      user: UserProfile;
      importedEntriesCount: number;
      addedEntriesCount: number;
      addedSkillsCount: number;
      workHistory: NonNullable<UserProfile['workHistory']>;
    }>('/integrations/linkedin/import', {
      method: 'POST',
      body: JSON.stringify({
        rawText: payload.rawText || '',
        profileUrl: payload.profileUrl || '',
        headline: payload.headline || '',
        replaceExisting: Boolean(payload.replaceExisting),
      }),
    });
  },
  disconnectLinkedIn: (clearWorkHistory = false) =>
    requestJson<{ user: UserProfile }>('/integrations/linkedin/disconnect', {
      method: 'POST',
      body: JSON.stringify({ clearWorkHistory }),
    }),
};

