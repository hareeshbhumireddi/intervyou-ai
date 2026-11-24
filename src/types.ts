export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type Sector = 'Government' | 'Private';

export type ResumeFileMetadata = {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
};

export type JobAlertSubscription = {
  enabled: boolean;
  frequency: 'instant' | 'daily' | 'weekly';
  email: string;
  matchedSkills: string[];
  updatedAt: string;
};

export type WorkExperience = {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  source?: 'linkedin' | 'manual';
};

export type LinkedInProfileConnection = {
  connected: boolean;
  memberId?: string;
  profileUrl?: string;
  headline?: string;
  fullName?: string;
  email?: string;
  pictureUrl?: string;
  importedCount?: number;
  lastSyncedAt?: string;
  importMethod?: 'oauth' | 'pdf' | 'csv' | 'text';
};

export type UserProfile = {
  fullName: string;
  dob: string;
  gender: string;
  email: string;
  mobile: string;
  address: string;
  qualification: string;
  preferredLanguage: string;
  education: {
    degree: string;
    college: string;
    specialization: string;
    graduationYear: string;
    cgpa: string;
  };
  skills: string[];
  certificates: { title: string; provider: string; date: string }[];
  workHistory?: WorkExperience[];
  linkedinProfile?: LinkedInProfileConnection;
  resumeUrl?: string;
  resumeFile?: ResumeFileMetadata;
  avatarUrl?: string;
  resumeText?: string;
  jobAlertSubscription?: JobAlertSubscription;
  stats: {
    totalInterviews: number;
    avgScore: number;
    bestScore: number;
  };
  isCompleted?: boolean;
  profileUpdatedAt?: string;
};

export type JobRole = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

export type Question = {
  id: string;
  question: string;
  category: string;
};

export type InterviewSession = {
  round?: string | null;
  roundLabel?: string | null;
  id: string;
  role: string;
  interviewType?: string;
  status?: 'active' | 'completed';
  sector: Sector;
  difficulty: Difficulty;
  date: string;
  questions: Question[];
  answers: Record<string, string>;
  evaluations: Record<string, EvaluationResult>;
  overallReport?: FinalReport;
  examName?: string;
  department?: string;
  preferredLanguage?: string;
  duration?: string;
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  category?: string;
  experience?: string;
  qualification?: string;
};

export type EmotionalToneLabel =
  | 'Confident'
  | 'Professional'
  | 'Composed'
  | 'Enthusiastic'
  | 'Hesitant'
  | 'Uncertain';

export type VoiceInputTelemetry = {
  inputMode: 'voice' | 'mixed' | 'text';
  avgWpm?: number;
  avgPitchHz?: number;
  pitchStdDevHz?: number;
  vocalVariety?: 'expressive' | 'monotone' | 'steady';
  voicedFrames?: number;
  speakingDurationSec?: number;
};

export type ToneScoreBreakdown = {
  confident: number;
  professional: number;
  composed: number;
  enthusiastic: number;
  hesitant: number;
};

export type AnswerSentimentAnalysis = {
  primaryTone: EmotionalToneLabel;
  secondaryTone?: EmotionalToneLabel;
  confidenceScore: number;
  toneScores: ToneScoreBreakdown;
  hesitationMarkers: string[];
  confidentMarkers: string[];
  rationale: string;
  voiceMetrics?: VoiceInputTelemetry;
};

export type SessionSentimentTrajectoryPoint = {
  questionNumber: number;
  questionId: string;
  category: string;
  primaryTone: EmotionalToneLabel;
  secondaryTone?: EmotionalToneLabel;
  confidenceScore: number;
  professionalismScore: number;
  hesitationScore: number;
  inputMode: 'voice' | 'mixed' | 'text';
  avgWpm?: number;
  vocalVariety?: string;
  rationale: string;
};

export type SessionSentimentAnalysis = {
  dominantTone: EmotionalToneLabel;
  emotionalArcSummary: string;
  voiceInputCoverage: number;
  overallToneScores: ToneScoreBreakdown;
  toneDistribution: Array<{
    tone: EmotionalToneLabel;
    count: number;
    percentage: number;
  }>;
  trajectory: SessionSentimentTrajectoryPoint[];
  aiPowered?: boolean;
};

export type AudioReplayMetadata = {
  hasAudio: boolean;
  mimeType: string;
  durationSec: number;
  chunkCount?: number;
  recordedAt: string;
};

export type EvaluationResult = {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  improvedAnswer: string;
  metrics: {
    technicalAccuracy: number;
    communication: number;
    confidence: number;
    relevance: number;
    grammar?: number;
    pronunciation?: number;
    fluency?: number;
  };
  missingPoints?: string[];
  isRelevant?: boolean;
  idealAnswer?: string;
  suggestions?: string[];
  sentiment?: AnswerSentimentAnalysis;
  audioReplay?: AudioReplayMetadata;
};

export type FinalReport = {
  overallScore: number;
  result: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
  summary: string;
  keyTakeaways: string[];
  careerAdvice: string;
  skillGapAnalysis: Record<string, number>;
  nextSteps: string[];
  detailedMetrics?: {
    eyeContact: number;
    timeManagement: number;
    problemSolving: number;
    logicalThinking: number;
    professionalism: number;
    listeningSkills: number;
    grammar: number;
    pronunciation: number;
    fluency: number;
    accuracy: number;
    relevance: number;
    technicalKnowledge: number;
    communication: number;
    confidence: number;
  };
  sentimentAnalysis?: SessionSentimentAnalysis;
};

export type JobNotification = {
  id: string;
  company: string;
  title: string;
  sector: 'Private' | 'Government';
  category: string;
  industry?: string;
  jobType?: 'Full-time' | 'Internship' | 'Contract' | 'Part-time';
  location: string;
  qualification: string;
  experience: string;
  salary?: string;
  lastDate: string;
  releaseDate: string;
  applyLink: string;
  officialWebsite: string;
  status: 'New' | 'Closing Soon' | 'Closed';
  isFeatured?: boolean;
  description?: string;
  platform?: 'LinkedIn' | 'Naukri' | 'Direct';
  skills?: string[];
};

export type NotificationState = {
  notifications: JobNotification[];
  bookmarkedIds: string[];
  readIds: string[];
};

export type SavedJob = {
  id: number;
  jobId?: string;
  title: string;
  company: string;
  location: string;
  applyLink: string;
  savedAt: string;
};

export type JobApplication = {
  id: number;
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  platform?: string;
  applyLink: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  resumeName: string;
  availability: string;
  expectedSalary: string;
  intentSummary: string;
  matchedSkills: string[];
  appliedAt: string;
  status: 'Submitted' | 'In Review';
};

export type PeerRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export type PeerProfile = {
  uid: string;
  displayName: string;
  targetRole: string;
  sector: Sector;
  difficulty: Difficulty;
  isAvailable: boolean;
  skills: string[];
  bio?: string;
  experienceLevel?: string;
  preferredLanguage?: string;
  avatarInitials?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PeerRequest = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  receiverRole: string;
  participantIds: [string, string];
  topic: string;
  sector: Sector;
  difficulty: Difficulty;
  message?: string;
  scheduledTime?: string;
  status: PeerRequestStatus;
  sessionId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PeerSession = {
  id: string;
  requestId: string;
  hostId: string;
  hostName: string;
  guestId: string;
  guestName: string;
  participantIds: [string, string];
  interviewerId: string;
  topic: string;
  currentQuestion: string;
  currentCategory?: string;
  sharedNotes?: string;
  status: 'active' | 'completed';
  createdAt?: string;
  updatedAt?: string;
};

export type PeerMessage = {
  id: string;
  sessionId: string;
  participantIds: [string, string];
  senderId: string;
  senderName: string;
  senderRole: 'Interviewer' | 'Candidate';
  type: 'chat' | 'question' | 'feedback';
  text: string;
  score?: number;
  createdAt?: string;
};

export type GoalMetricType =
  | 'interviews_completed'
  | 'average_score'
  | 'best_score'
  | 'custom';

export type PracticeGoal = {
  id: string;
  userId: string;
  title: string;
  metricType: GoalMetricType;
  unitLabel: string;
  targetValue: number;
  currentValue: number;
  targetDate?: string;
  status: 'active' | 'completed';
  createdAt?: string;
  updatedAt?: string;
};

