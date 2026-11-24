import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Search, 
  Filter, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  Bookmark, 
  BookmarkCheck,
  Share2,
  Building2,
  GraduationCap,
  Clock,
  Zap,
  Globe,
  Star,
  PlayCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  Tag,
  Compass,
  RefreshCw,
  Radio,
  Layers,
  DollarSign,
  BarChart2,
  Award,
  ChevronRight,
  Info,
  Send
} from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { JobApplication, JobNotification, InterviewSession, SavedJob } from '../types';
import { api } from '../utils/api';
import { getCompanyLogo } from '../utils/assets';
import { 
  buildLinkedInSearchUrl, 
  buildNaukriSearchUrl, 
  buildGoogleJobsUrl 
} from '../utils/jobSources';
import { getJobSalaryEstimate } from '../utils/salaryDataset';
import { getSuggestedJobs, JobMatchResult } from '../utils/jobRecommender';
import SalaryEstimatorModal from '../components/SalaryEstimatorModal';
import QuickApplyModal from '../components/QuickApplyModal';
import { JOB_INDUSTRIES, LiveJobSearchResponse, isActiveJob } from '../services/jobLiveService';
import {
  deleteSavedJobFromFirestore,
  loadApplicationsFromFirestore,
  loadSavedJobsFromFirestore,
  saveApplicationToFirestore,
  saveSavedJobToFirestore,
} from '../services/firestoreService';

type PlatformFilter = 'All' | 'LinkedIn' | 'Naukri' | 'Government';
type JobTypeFilter = 'All' | 'Full-time' | 'Internship';

function formatLocalDate(dateStr?: string): string {
  if (!dateStr) return 'Open Until Filled';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString();
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? dateStr : parsed.toLocaleDateString();
}

export default function JobNotifications() {
  const { user, firebaseUid, sessions, bookmarkedIds, toggleBookmark, readIds, markAsRead, addSession } = useAppState();
  const navigate = useNavigate();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('All');
  const [sectorFilter, setSectorFilter] = useState<'All' | 'Private' | 'Government'>('All');
  const [industryFilter, setIndustryFilter] = useState<string>('All');
  const [jobTypeFilter, setJobTypeFilter] = useState<JobTypeFilter>('All');
  const [experienceFilter, setExperienceFilter] = useState<string>('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [quickApplyJob, setQuickApplyJob] = useState<JobNotification | null>(null);
  const [copiedAlert, setCopiedAlert] = useState<string | null>(null);

  // Live Service Layer State
  const [liveJobs, setLiveJobs] = useState<JobNotification[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveMetadata, setLiveMetadata] = useState<LiveJobSearchResponse | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Salary Estimator Modal State
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [salaryEstimatorProps, setSalaryEstimatorProps] = useState({
    role: 'Full Stack Engineer',
    location: 'Bengaluru',
    experience: '2-5 Years',
  });

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch saved jobs and submitted Quick Apply applications on mount (merged with Firestore)
  useEffect(() => {
    let isActive = true;
    const loadSavedAndApps = async () => {
      try {
        const [{ savedJobs: serverSaved }, cloudSaved] = await Promise.all([
          api.savedJobs().catch(() => ({ savedJobs: [] as SavedJob[] })),
          firebaseUid ? loadSavedJobsFromFirestore(firebaseUid).catch(() => [] as SavedJob[]) : Promise.resolve([] as SavedJob[]),
        ]);
        if (!isActive) return;
        const savedMap = new Map<string, SavedJob>();
        [...cloudSaved, ...serverSaved].forEach((item) => {
          const key = item.jobId || `${item.title}::${item.company}`;
          if (!savedMap.has(key)) savedMap.set(key, item);
        });
        setSavedJobs(Array.from(savedMap.values()));
      } catch (error) {
        if (isActive) setActionError(error instanceof Error ? error.message : 'Could not load saved jobs.');
      }

      try {
        const [{ applications: serverApps }, cloudApps] = await Promise.all([
          api.applications().catch(() => ({ applications: [] as JobApplication[] })),
          firebaseUid ? loadApplicationsFromFirestore(firebaseUid).catch(() => [] as JobApplication[]) : Promise.resolve([] as JobApplication[]),
        ]);
        if (!isActive) return;
        const appMap = new Map<string, JobApplication>();
        [...cloudApps, ...serverApps].forEach((item) => {
          const key = item.jobId || `${item.jobTitle}::${item.company}`;
          if (!appMap.has(key)) appMap.set(key, item);
        });
        setApplications(Array.from(appMap.values()));
      } catch {
        // ignore secondary load errors
      }
    };
    void loadSavedAndApps();
    return () => { isActive = false; };
  }, [firebaseUid]);

  /**
   * Primary service layer fetcher to query LinkedIn and Naukri APIs
   */
  const fetchLiveJobsFromService = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingLive(true);
    }
    setActionError('');

    try {
      const response = await api.searchLiveJobs({
        query: searchQuery.trim(),
        location: locationQuery.trim(),
        platform: platformFilter,
        experience: experienceFilter,
        industry: industryFilter,
        jobType: jobTypeFilter,
        refresh: isRefresh,
        limit: 50,
      });

      setLiveJobs(response.jobs);
      setLiveMetadata(response);
      setLastSyncTime(new Date(response.syncedAt || Date.now()));
    } catch (err) {
      console.error('Error fetching live jobs:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to query live job search services.');
    } finally {
      setIsLoadingLive(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, locationQuery, platformFilter, experienceFilter, industryFilter, jobTypeFilter]);

  // Debounced live fetch when user types query or filters change
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      void fetchLiveJobsFromService(false);
    }, 350);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [fetchLiveJobsFromService]);

  const popularLocations = ['All India', 'Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi NCR', 'Remote'];

  const trendingSearches = [
    { role: 'React Developer', loc: 'Bengaluru' },
    { role: 'Java Cloud & Microservices', loc: 'Hyderabad' },
    { role: 'Full Stack Engineer', loc: 'Pune' },
    { role: 'Data Scientist', loc: 'Bengaluru' },
    { role: 'DevOps & SRE', loc: 'Remote' },
    { role: 'Scientist / Engineer SC', loc: 'Bengaluru' },
    { role: 'Probationary Officer (PO)', loc: 'All India' }
  ];

  // Ensure expired or closed jobs are never shown
  const activeLiveJobs = useMemo(() => {
    return liveJobs.filter(isActiveJob);
  }, [liveJobs]);

  // Client-side instant filter refinement for sector, industry, jobType, and location
  const displayJobs = useMemo(() => {
    return activeLiveJobs.filter((j) => {
      if (sectorFilter !== 'All' && j.sector !== sectorFilter) return false;
      if (industryFilter !== 'All') {
        const jobInd = (j.industry || j.category || '').toLowerCase();
        if (jobInd !== industryFilter.toLowerCase() && !jobInd.includes(industryFilter.toLowerCase())) {
          return false;
        }
      }
      if (jobTypeFilter !== 'All') {
        const jt = j.jobType || (/\bintern/i.test(j.title) ? 'Internship' : 'Full-time');
        if (jt.toLowerCase() !== jobTypeFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [activeLiveJobs, sectorFilter, industryFilter, jobTypeFilter]);

  // Dynamic counts for platform tabs
  const platformCounts = useMemo(() => {
    return {
      all: activeLiveJobs.length,
      linkedIn: activeLiveJobs.filter(j => j.platform === 'LinkedIn').length,
      naukri: activeLiveJobs.filter(j => j.platform === 'Naukri').length,
      govt: activeLiveJobs.filter(j => j.sector === 'Government' || j.platform === 'Direct').length,
    };
  }, [activeLiveJobs]);

  // Ranked 'Suggested for You' jobs using candidate profile and mock interview history
  const suggestedRoles = useMemo<JobMatchResult[]>(() => {
    return getSuggestedJobs(activeLiveJobs, user, sessions, 3);
  }, [activeLiveJobs, user, sessions]);

  const handleOpenSalaryEstimator = (role = 'Full Stack Engineer', location = 'Bengaluru', experience = '2-5 Years') => {
    setSalaryEstimatorProps({ role, location, experience });
    setSalaryModalOpen(true);
  };

  const handlePractice = async (job: JobNotification) => {
    setIsPreparing(true);
    setActionError('');
    markAsRead(job.id);
    try {
      const { interview } = await api.startInterview({
        role: job.title,
        sector: job.sector,
        difficulty: 'Intermediate',
        preferredLanguage: 'English',
        numQuestions: 5,
        jobId: job.id,
        companyName: job.company,
        category: job.category,
        experience: job.experience,
        qualification: job.qualification,
      });
      addSession(interview as InterviewSession);
      navigate(`/interview/${interview.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not prepare this interview. Please try again.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleBookmark = async (job: JobNotification) => {
    setActionError('');
    const existing = savedJobs.find((saved) => saved.jobId === job.id || (saved.title === job.title && saved.company === job.company));
    try {
      if (existing) {
        await api.deleteSavedJob(existing.id).catch(() => undefined);
        if (firebaseUid) {
          void deleteSavedJobFromFirestore(firebaseUid, existing.id).catch(() => undefined);
        }
        setSavedJobs((current) => current.filter((saved) => saved.id !== existing.id));
        if (bookmarkedIds.includes(job.id)) toggleBookmark(job.id);
      } else {
        const { savedJob } = await api.saveJob(job);
        if (firebaseUid) {
          void saveSavedJobToFirestore(firebaseUid, savedJob).catch(() => undefined);
        }
        setSavedJobs((current) => [savedJob, ...current]);
        if (!bookmarkedIds.includes(job.id)) toggleBookmark(job.id);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update saved jobs.');
    }
  };

  const isJobSaved = (job: JobNotification) => 
    savedJobs.some((saved) => saved.jobId === job.id || (saved.title === job.title && saved.company === job.company));

  const getJobApplication = (job: JobNotification) =>
    applications.find((app) => app.jobId === job.id || (app.jobTitle === job.title && app.company === job.company));

  const handleQuickApplySubmitted = (application: JobApplication) => {
    setApplications((prev) => {
      const filtered = prev.filter((a) => a.id !== application.id && a.jobId !== application.jobId);
      return [application, ...filtered];
    });
    if (firebaseUid) {
      void saveApplicationToFirestore(firebaseUid, application).catch(() => undefined);
    }
  };

  const handleShare = (job: JobNotification) => {
    const jobUrl = job.applyLink || window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `${job.title} at ${job.company}`,
        text: `Check out this opening for ${job.title} at ${job.company} (${job.location}):`,
        url: jobUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(jobUrl);
      setCopiedAlert(job.id);
      setTimeout(() => setCopiedAlert(null), 3000);
    }
  };

  const currentLinkedInUrl = useMemo(() => {
    return buildLinkedInSearchUrl(searchQuery || 'Software Engineer', locationQuery || 'India');
  }, [searchQuery, locationQuery]);

  const currentNaukriUrl = useMemo(() => {
    return buildNaukriSearchUrl(searchQuery || 'software-engineer', locationQuery || 'india');
  }, [searchQuery, locationQuery]);

  const currentGoogleJobsUrl = useMemo(() => {
    return buildGoogleJobsUrl(searchQuery || 'software', locationQuery || 'India');
  }, [searchQuery, locationQuery]);

  if (isPreparing) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center p-8 space-y-8">
        <div className="relative">
          <motion.div 
            className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/40"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Loader2 className="w-16 h-16 text-white animate-spin" />
          </motion.div>
          <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-20 animate-pulse -z-10" />
        </div>
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Tailoring Mock Interview Questions...
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Analyzing live job expectations, company tech stacks, and industry questions to generate an interview experience matched to this opening.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-24">
      {actionError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* Hero Header with Live Service Indicators & Salary Estimator Action */}
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 sm:p-10 text-white shadow-2xl border border-blue-900/40">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Live API Status Indicator */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-bold text-blue-300 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live API Service Layer Active</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-400">LinkedIn & Naukri APIs Connected</span>
            </div>

            {/* Salary Estimator Quick Button & Force Refresh */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <button
                onClick={() => handleOpenSalaryEstimator(searchQuery || 'Full Stack Engineer', locationQuery || 'Bengaluru')}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-3.5 py-1.5 font-bold text-white shadow-md shadow-emerald-900/30 transition-all hover:scale-105 active:scale-95"
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>Salary Estimator</span>
              </button>

              <span className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-sm text-slate-300">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>{liveMetadata?.source === 'cached' ? 'Fast Cache' : 'Live Sync'}</span>
                <span className="text-slate-400">
                  ({lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              </span>

              <button
                onClick={() => void fetchLiveJobsFromService(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 font-bold text-white shadow-sm transition-all disabled:opacity-50"
                title="Force refresh live postings from LinkedIn and Naukri APIs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          <div className="max-w-2xl space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Real-Time Job Search <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                & Expected Salary Estimator
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Explore live openings across LinkedIn & Naukri, inspect public benchmark salary distributions by city and experience, and get personalized role suggestions based on your practice history.
            </p>
          </div>

          {/* Search Inputs Bar */}
          <div className="rounded-3xl bg-white/10 p-3 backdrop-blur-md border border-white/15 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              <div className="md:col-span-5 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Role, skills, or company (e.g. React, Java, SDE)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 pl-11 pr-4 py-3.5 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-4 relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Location (e.g. Bengaluru, Remote, Pune)..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 pl-11 pr-4 py-3.5 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-400 transition-all dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-black transition-all ${
                    isFilterOpen 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'bg-white/15 text-white hover:bg-white/25 backdrop-blur-md border border-white/20'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </button>
                {(searchQuery || locationQuery || platformFilter !== 'All' || sectorFilter !== 'All' || industryFilter !== 'All' || jobTypeFilter !== 'All' || experienceFilter !== 'All') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setLocationQuery('');
                      setPlatformFilter('All');
                      setSectorFilter('All');
                      setIndustryFilter('All');
                      setJobTypeFilter('All');
                      setExperienceFilter('All');
                    }}
                    title="Reset all filters"
                    className="rounded-2xl bg-white/10 px-3.5 py-3.5 text-xs font-bold text-slate-300 hover:bg-white/20 transition-all"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Quick Location Pills */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 text-xs">
              <span className="text-slate-400 font-bold whitespace-nowrap pl-2">Popular Cities:</span>
              {popularLocations.map((loc) => {
                const isActive = (loc === 'All India' && !locationQuery) || locationQuery.toLowerCase() === loc.toLowerCase();
                return (
                  <button
                    key={loc}
                    onClick={() => setLocationQuery(loc === 'All India' ? '' : loc)}
                    className={`whitespace-nowrap rounded-xl px-3 py-1 font-bold transition-all ${
                      isActive 
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-Time Live Launchers for LinkedIn & Naukri */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-sky-300">
                    Direct Live Search Connectors
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Execute live search query for <strong className="text-slate-200">"{searchQuery || 'Software Engineer'}"</strong> in <strong className="text-slate-200">"{locationQuery || 'India'}"</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* LinkedIn Live Connector */}
                <a
                  href={currentLinkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0A66C2] hover:bg-[#084e96] text-white px-4 py-2.5 text-xs font-black shadow-lg shadow-blue-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.81a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26Z"/>
                  </svg>
                  <span>Search Live on LinkedIn</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-80" />
                </a>

                {/* Naukri.com Live Connector */}
                <a
                  href={currentNaukriUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0050B3] hover:bg-[#003d8a] text-white px-4 py-2.5 text-xs font-black shadow-lg shadow-blue-950/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded bg-white text-[#0050B3] font-black text-[10px] leading-none">
                    N
                  </div>
                  <span>Search Live on Naukri</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-80" />
                </a>

                {/* Google Jobs Live Connector */}
                <a
                  href={currentGoogleJobsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 text-xs font-bold border border-white/15 transition-all"
                >
                  <Globe className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Google Jobs</span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ⭐ 'SUGGESTED FOR YOU' SECTION (RANKED BY SKILLS & HISTORY)   */}
      {/* ------------------------------------------------------------- */}
      {!isLoadingLive && suggestedRoles.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/20">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Suggested for You
                </h2>
                <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-xs">
                  AI Profile Match
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked automatically using your mock interview history ({sessions.length} sessions) and declared technical skills profile
              </p>
            </div>

            <div className="text-xs font-bold text-slate-400">
              Matched for <strong className="text-slate-700 dark:text-slate-200">{user.fullName || 'Candidate'}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {suggestedRoles.map(({ job, matchScore, primaryReason, matchedSkills }) => {
              const salaryBenchmark = getJobSalaryEstimate(job);
              const isSaved = isJobSaved(job);

              return (
                <motion.div
                  key={`suggested-${job.id}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border-2 border-blue-500/30 bg-gradient-to-b from-blue-50/50 via-white to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 p-6 shadow-md hover:shadow-xl hover:border-blue-500/60 transition-all flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Match Score Badge */}
                  <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{matchScore}% Profile Match</span>
                    </span>

                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-[#0A66C2] dark:bg-blue-950 dark:text-blue-300">
                      {job.platform || 'Verified'}
                    </span>
                  </div>

                  <div className="pt-4 space-y-3.5 flex-1">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-xl border border-slate-100 bg-white p-1 dark:border-slate-800 dark:bg-slate-800 overflow-hidden shadow-xs">
                        <img
                          src={getCompanyLogo(job.company, job.sector)}
                          alt={job.company}
                          referrerPolicy="no-referrer"
                          className="h-full w-full rounded-lg object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                          {job.title}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                          {job.company} • {job.location.split(',')[0]}
                        </p>
                      </div>
                    </div>

                    {/* Recommendation Reason Pill */}
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 p-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                      <span>{primaryReason}</span>
                    </div>

                    {/* Salary Benchmark Pill with Click to Open Estimator */}
                    <button
                      onClick={() => handleOpenSalaryEstimator(job.title, job.location, job.experience)}
                      className="w-full text-left rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 p-2.5 transition flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Market Benchmark
                        </p>
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {salaryBenchmark.formattedRange}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        <span>Details</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </button>

                    {/* Matched Skills */}
                    {matchedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {matchedSkills.slice(0, 3).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/40 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300"
                          >
                            ✓ {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setQuickApplyJob(job)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                          getJobApplication(job)
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/20 hover:scale-[1.02]'
                        }`}
                      >
                        {getJobApplication(job) ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Applied</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5" />
                            <span>Quick Apply</span>
                          </>
                        )}
                      </button>

                      <a
                        href={job.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Apply for ${job.title} at ${job.company} on ${job.platform || 'Official Portal'}`}
                        className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-black flex items-center justify-center gap-1 transition-all"
                      >
                        <span>{job.platform === 'LinkedIn' ? 'LinkedIn' : job.platform === 'Naukri' ? 'Naukri' : 'Portal'}</span>
                        <ExternalLink className="h-3 w-3 opacity-75" />
                      </a>

                      <button
                        onClick={() => void handleBookmark(job)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isSaved 
                            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40' 
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600'
                        }`}
                        aria-label={isSaved ? 'Remove from saved' : 'Save job'}
                      >
                        {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </button>
                    </div>

                    <button
                      onClick={() => handlePractice(job)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>Practice Interview</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trending Search Chips */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span>Trending Live Queries</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {trendingSearches.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSearchQuery(item.role);
                setLocationQuery(item.loc === 'All India' ? '' : item.loc);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-slate-800"
            >
              <span>{item.role}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 dark:text-slate-400">{item.loc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible Advanced Filters */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Sector</label>
                <div className="flex gap-2">
                  {(['All', 'Private', 'Government'] as const).map(s => (
                    <button 
                      key={s}
                      onClick={() => setSectorFilter(s)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                        sectorFilter === s 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Experience Level</label>
                <select 
                  value={experienceFilter}
                  onChange={(e) => setExperienceFilter(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="All">All Experience Levels</option>
                  <option value="Freshers">Freshers / Entry Level</option>
                  <option value="1-3">1-3 Years</option>
                  <option value="2-5">2-5 Years</option>
                  <option value="3-6">3-6 Years</option>
                  <option value="6-10">6-10 Years (Senior / Lead)</option>
                </select>
              </div>

              <div className="space-y-2 flex flex-col justify-end">
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setLocationQuery('');
                    setPlatformFilter('All');
                    setSectorFilter('All');
                    setIndustryFilter('All');
                    setJobTypeFilter('All');
                    setExperienceFilter('All');
                  }}
                  className="w-full py-2.5 px-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Platform Filter Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* All */}
          <button
            onClick={() => setPlatformFilter('All')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              platformFilter === 'All'
                ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>All Platforms</span>
            <span className="rounded-full bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 text-[10px]">
              {platformCounts.all}
            </span>
          </button>

          {/* LinkedIn */}
          <button
            onClick={() => setPlatformFilter('LinkedIn')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              platformFilter === 'LinkedIn'
                ? 'bg-[#0A66C2] text-white shadow-lg shadow-blue-600/30'
                : 'bg-white text-slate-600 hover:bg-blue-50 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-[#0A66C2]'
            }`}
          >
            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.81a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26Z"/>
            </svg>
            <span>LinkedIn API</span>
            <span className="rounded-full bg-blue-100 text-[#0A66C2] dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px]">
              {platformCounts.linkedIn}
            </span>
          </button>

          {/* Naukri */}
          <button
            onClick={() => setPlatformFilter('Naukri')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              platformFilter === 'Naukri'
                ? 'bg-[#0050B3] text-white shadow-lg shadow-blue-800/30'
                : 'bg-white text-slate-600 hover:bg-blue-50 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-[#0050B3]'
            }`}
          >
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-current text-[8px] font-black leading-none">
              <span className={platformFilter === 'Naukri' ? 'text-[#0050B3]' : 'text-white'}>N</span>
            </div>
            <span>Naukri API</span>
            <span className="rounded-full bg-blue-100 text-[#0050B3] dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px]">
              {platformCounts.naukri}
            </span>
          </button>

          {/* Govt & PSU */}
          <button
            onClick={() => setPlatformFilter('Government')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              platformFilter === 'Government'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white text-slate-600 hover:bg-purple-50 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-purple-600'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Govt & PSU</span>
            <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-[10px]">
              {platformCounts.govt}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Layers className="h-3.5 w-3.5 text-blue-500" />
          <span>
            {isLoadingLive ? 'Querying APIs...' : `Showing ${displayJobs.length} ongoing listings`}
          </span>
        </div>
      </div>

      {/* Dedicated Filter Bar: Industry | Job Type (Full-time / Internship) | Location */}
      <div
        role="region"
        aria-label="Job listings filter bar"
        className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Industry Filter */}
          <div className="md:col-span-4 space-y-1.5">
            <label
              htmlFor="job-industry-filter"
              className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Industry</span>
            </label>
            <select
              id="job-industry-filter"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="All">All Industries</option>
              {JOB_INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Job Type Filter (Full-time / Internship) */}
          <div className="md:col-span-4 space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Briefcase className="h-3.5 w-3.5 text-purple-600" />
              <span>Job Type</span>
            </span>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
              {(['All', 'Full-time', 'Internship'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setJobTypeFilter(type)}
                  className={`rounded-xl py-2 px-2 text-xs font-black transition-all cursor-pointer ${
                    jobTypeFilter === type
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {type === 'All' ? 'All Types' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Location Filter */}
          <div className="md:col-span-4 space-y-1.5">
            <label
              htmlFor="job-location-filter"
              className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>Location</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                id="job-location-filter"
                value={
                  !locationQuery
                    ? 'All'
                    : ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi NCR', 'Chennai', 'Remote', 'All India'].includes(locationQuery)
                    ? locationQuery
                    : 'Custom'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'All' || val === 'All India') setLocationQuery('');
                  else if (val !== 'Custom') setLocationQuery(val);
                }}
                className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="All">All Locations (India & Remote)</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Pune">Pune</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Chennai">Chennai</option>
                <option value="Remote">Remote</option>
                <option value="All India">All India (Govt / Pan-India)</option>
                {locationQuery &&
                  !['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi NCR', 'Chennai', 'Remote', 'All India'].includes(locationQuery) && (
                    <option value="Custom">{locationQuery}</option>
                  )}
              </select>

              {(industryFilter !== 'All' || jobTypeFilter !== 'All' || locationQuery || sectorFilter !== 'All' || platformFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setIndustryFilter('All');
                    setJobTypeFilter('All');
                    setLocationQuery('');
                    setSectorFilter('All');
                    setPlatformFilter('All');
                    setExperienceFilter('All');
                    setSearchQuery('');
                  }}
                  className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Share / Copy Toast Notification */}
      {copiedAlert && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl dark:bg-white dark:text-slate-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Job link copied to clipboard!</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoadingLive ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((sk) => (
            <div 
              key={sk}
              className="p-6 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              </div>
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-xl" />
              <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : (
        /* Main Live Job Cards Grid with Salary Estimator integration */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayJobs.map((job) => {
            const isSaved = isJobSaved(job);
            const platform = job.platform || (job.sector === 'Government' ? 'Direct' : 'LinkedIn');
            const salaryBenchmark = getJobSalaryEstimate(job);

            return (
              <motion.div 
                layout
                key={job.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => markAsRead(job.id)}
                className="group p-6 sm:p-7 rounded-[32px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 dark:hover:border-slate-700 transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {job.isFeatured && (
                  <div className="absolute top-5 right-5" title="Featured Live Opening">
                    <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  </div>
                )}
                
                <div className="space-y-4">
                  {/* Header: Logo, Company & Platform Pill */}
                  <div className="flex items-start gap-3.5">
                    <div className="h-13 w-13 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-800 overflow-hidden mt-0.5 shadow-sm">
                      <img
                        src={getCompanyLogo(job.company, job.sector)}
                        alt={`${job.company} logo`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-xl object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Platform Tag */}
                        {platform === 'LinkedIn' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0A66C2] dark:text-blue-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                            <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 24 24">
                              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.81a1.63 1.63 0 1 0 0 3.26 1.63 1.63 0 0 0 0-3.26Z"/>
                            </svg>
                            LinkedIn
                          </span>
                        )}
                        {platform === 'Naukri' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-[#0050B3] dark:text-sky-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                            <span className="h-2.5 w-2.5 rounded bg-[#0050B3] text-white flex items-center justify-center text-[7px] font-bold">N</span>
                            Naukri
                          </span>
                        )}
                        {platform === 'Direct' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                            <Globe className="h-2.5 w-2.5" />
                            Official
                          </span>
                        )}

                        {job.jobType && (
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            job.jobType === 'Internship'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {job.jobType}
                          </span>
                        )}

                        {(job.industry || job.category) && (
                          <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 text-[10px] font-bold">
                            {job.industry || job.category}
                          </span>
                        )}

                        {job.status === 'New' && (
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            Live
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black group-hover:text-blue-600 transition-colors leading-snug line-clamp-2">
                        {job.title}
                      </h3>

                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{job.company}</span>
                      </p>
                    </div>
                  </div>

                  {/* Location & Salary pills */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Location</p>
                      <p className="font-bold flex items-center gap-1 truncate text-slate-800 dark:text-slate-200">
                        <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </p>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Compensation</p>
                      <p className="font-bold flex items-center gap-1 truncate text-slate-800 dark:text-slate-200">
                        <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">{job.salary || 'Competitive'}</span>
                      </p>
                    </div>
                  </div>

                  {/* 💰 Salary Estimator Benchmark Tag on Card */}
                  <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>Public Salary Dataset Est.</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSalaryEstimator(job.title, job.location, job.experience);
                        }}
                        className="text-[10px] font-black underline hover:text-emerald-900 dark:hover:text-emerald-200"
                      >
                        Insights →
                      </button>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {salaryBenchmark.formattedRange}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Median: {salaryBenchmark.formattedMedian}
                      </span>
                    </div>
                  </div>

                  {/* Key Skills Tags */}
                  {job.skills && job.skills.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <Tag className="w-3 h-3" />
                        <span>Key Skills Required</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {job.skills.slice(0, 4).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                            +{job.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Details list */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span><strong className="text-slate-800 dark:text-slate-200">Exp:</strong> {job.experience}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate"><strong className="text-slate-800 dark:text-slate-200">Qual:</strong> {job.qualification}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span><strong className="text-slate-800 dark:text-slate-200">Valid Through:</strong> {formatLocalDate(job.lastDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-6 space-y-2.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(job.id);
                        setQuickApplyJob(job);
                      }}
                      className={`flex-1 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        getJobApplication(job)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                    >
                      {getJobApplication(job) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Applied</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Quick Apply</span>
                        </>
                      )}
                    </button>

                    <a 
                      href={job.applyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`Apply for ${job.title} at ${job.company} on ${platform === 'LinkedIn' ? 'LinkedIn' : platform === 'Naukri' ? 'Naukri' : 'Official Portal'}`}
                      className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-black text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      <span>{platform === 'LinkedIn' ? 'LinkedIn' : platform === 'Naukri' ? 'Naukri' : 'Portal'}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleBookmark(job);
                      }}
                      aria-label={isSaved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                      className={`p-3 rounded-2xl border transition-all ${
                        isSaved 
                          ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600'
                      }`}
                    >
                      {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(job);
                      }}
                      aria-label={`Share ${job.title}`}
                      className="p-3 rounded-2xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition-all"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePractice(job);
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Prepare Mock Interview</span>
                  </button>
                </div>
              </motion.div>
            );
          })}

          {displayJobs.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-6 rounded-[36px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8">
              <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto text-blue-600">
                <Search className="w-10 h-10" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">No matching live jobs found</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  We queried LinkedIn and Naukri APIs for "{searchQuery}". You can execute this query live directly on the web portals below!
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={currentLinkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0A66C2] px-5 py-3 text-xs font-black text-white shadow-lg"
                >
                  <span>Search "{searchQuery || 'Jobs'}" on LinkedIn</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={currentNaukriUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0050B3] px-5 py-3 text-xs font-black text-white shadow-lg"
                >
                  <span>Search on Naukri.com</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setLocationQuery('');
                    setPlatformFilter('All');
                    setSectorFilter('All');
                    setIndustryFilter('All');
                    setJobTypeFilter('All');
                    setExperienceFilter('All');
                  }}
                  className="rounded-2xl border border-slate-300 dark:border-slate-700 px-5 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salary Estimator Interactive Modal */}
      <SalaryEstimatorModal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        initialRole={salaryEstimatorProps.role}
        initialLocation={salaryEstimatorProps.location}
        initialExperience={salaryEstimatorProps.experience}
      />

      {/* Quick Apply Resume-Auto-Populated Application Intent Modal */}
      <QuickApplyModal
        job={quickApplyJob}
        user={user}
        existingApplication={quickApplyJob ? getJobApplication(quickApplyJob) : undefined}
        onClose={() => setQuickApplyJob(null)}
        onSubmitted={handleQuickApplySubmitted}
        onPracticeInterview={handlePractice}
      />
    </div>
  );
}
