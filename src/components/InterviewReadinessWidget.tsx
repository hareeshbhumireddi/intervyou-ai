import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  FileText,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UserProfile, InterviewSession } from '../types';

interface InterviewReadinessWidgetProps {
  user: UserProfile;
  sessions: InterviewSession[];
}

export interface ReadinessBreakdown {
  overallScore: number;
  tier: {
    label: string;
    color: string;
    badgeBg: string;
    textColor: string;
    gradient: string;
    description: string;
  };
  practiceFrequency: {
    score: number;
    completedThisWeek: number;
    totalCompleted: number;
    label: string;
    weight: number;
  };
  resumeCompleteness: {
    score: number;
    missingItems: string[];
    label: string;
    weight: number;
  };
  performanceTrends: {
    score: number;
    trendDirection: 'up' | 'down' | 'steady' | 'new';
    deltaText: string;
    label: string;
    weight: number;
  };
  nextBestAction: {
    text: string;
    ctaText: string;
    ctaLink: string;
  };
}

export const calculateReadinessScore = (
  user?: UserProfile | null,
  sessions?: InterviewSession[] | null
): ReadinessBreakdown => {
  const safeUser = user || ({} as Partial<UserProfile>);
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const completedSessions = safeSessions.filter(
    (s) => s.status === 'completed' || Boolean(s.overallReport)
  );

  // -------------------------------------------------------------
  // 1. PRACTICE FREQUENCY (Weight: 30%)
  // -------------------------------------------------------------
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sessionsThisWeek = completedSessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return !isNaN(sessionDate.getTime()) && sessionDate >= sevenDaysAgo;
  }).length;

  let practiceScore = 20; // default base for exploring
  if (completedSessions.length >= 5 || sessionsThisWeek >= 3) {
    practiceScore = 100;
  } else if (completedSessions.length >= 3 || sessionsThisWeek >= 2) {
    practiceScore = 85;
  } else if (completedSessions.length >= 2 || sessionsThisWeek >= 1) {
    practiceScore = 65;
  } else if (completedSessions.length === 1) {
    practiceScore = 45;
  }

  const practiceFrequencyLabel =
    sessionsThisWeek >= 3
      ? `${sessionsThisWeek} sessions this week (High consistency)`
      : completedSessions.length > 0
      ? `${completedSessions.length} total sessions completed`
      : 'No mock interviews completed yet';

  // -------------------------------------------------------------
  // 2. RESUME COMPLETENESS (Weight: 35%)
  // -------------------------------------------------------------
  let resumeScore = 0;
  const missingItems: string[] = [];

  // Basic Info (25 pts)
  if (safeUser.fullName && safeUser.email) resumeScore += 15;
  if (safeUser.mobile && safeUser.qualification) resumeScore += 10;
  else missingItems.push('Contact & Qualification');

  // Education (20 pts)
  if (safeUser.education?.degree && safeUser.education?.college) {
    resumeScore += 20;
  } else {
    missingItems.push('Education background');
  }

  // Skills (25 pts)
  const skillsCount = safeUser.skills?.length || 0;
  if (skillsCount >= 5) {
    resumeScore += 25;
  } else if (skillsCount >= 2) {
    resumeScore += 15;
    missingItems.push('Add more skills (target 5+)');
  } else {
    missingItems.push('Add core skills');
  }

  // Certifications (10 pts)
  if (safeUser.certificates && safeUser.certificates.length > 0) {
    resumeScore += 10;
  } else {
    missingItems.push('Certifications');
  }

  // Resume Document / Text Upload (20 pts)
  if (safeUser.resumeFile || safeUser.resumeUrl || safeUser.resumeText) {
    resumeScore += 20;
  } else {
    missingItems.push('Upload resume file');
  }

  resumeScore = Math.min(Math.max(resumeScore, 10), 100);

  // -------------------------------------------------------------
  // 3. PERFORMANCE TRENDS (Weight: 35%)
  // -------------------------------------------------------------
  let performanceScore = 40; // baseline if no data
  let trendDirection: 'up' | 'down' | 'steady' | 'new' = 'new';
  let deltaText = 'Complete a session to establish baseline';

  if (completedSessions.length >= 2) {
    // Sort chronological ascending
    const sorted = [...completedSessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const recentScores = sorted.map((s) => s.overallReport?.overallScore || 70);
    const latestScore = recentScores[recentScores.length - 1];
    const previousScore = recentScores[recentScores.length - 2];
    const avgRecent = Math.round(
      recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length
    );

    const delta = latestScore - previousScore;
    if (delta > 2) {
      trendDirection = 'up';
      deltaText = `+${delta}% vs last interview`;
      performanceScore = Math.min(avgRecent + 5, 98);
    } else if (delta < -3) {
      trendDirection = 'down';
      deltaText = `${delta}% vs last interview`;
      performanceScore = Math.max(avgRecent - 4, 30);
    } else {
      trendDirection = 'steady';
      deltaText = 'Stable performance';
      performanceScore = avgRecent;
    }
  } else if (completedSessions.length === 1) {
    const singleScore = completedSessions[0].overallReport?.overallScore || 70;
    performanceScore = singleScore;
    trendDirection = 'steady';
    deltaText = `Initial score: ${singleScore}%`;
  }

  // -------------------------------------------------------------
  // AGGREGATE WEIGHTED SCORE
  // -------------------------------------------------------------
  const overallScore = Math.round(
    practiceScore * 0.30 + resumeScore * 0.35 + performanceScore * 0.35
  );

  // Determine readiness tier
  let tier: ReadinessBreakdown['tier'];
  if (overallScore >= 85) {
    tier = {
      label: 'Interview Ready (High Confidence)',
      color: 'emerald',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      gradient: 'from-emerald-500 via-teal-500 to-blue-600',
      description: 'Your practice frequency, profile depth, and performance trends indicate strong interview readiness.'
    };
  } else if (overallScore >= 70) {
    tier = {
      label: 'Competitive & Prepared',
      color: 'blue',
      badgeBg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      textColor: 'text-blue-600 dark:text-blue-400',
      gradient: 'from-blue-600 via-indigo-500 to-purple-600',
      description: 'Solid preparation. A few more targeted mock sessions and profile polish will put you in the top candidate tier.'
    };
  } else if (overallScore >= 50) {
    tier = {
      label: 'Building Momentum',
      color: 'amber',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      textColor: 'text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-500 via-orange-500 to-blue-600',
      description: 'You are making progress. Increase practice consistency to build muscle memory and verbal fluency.'
    };
  } else {
    tier = {
      label: 'Needs Preparation',
      color: 'rose',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      textColor: 'text-rose-600 dark:text-rose-400',
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      description: 'Complete your profile and run a diagnostic mock interview to unlock tailored growth recommendations.'
    };
  }

  // Next Best Action recommendation
  let nextBestAction = {
    text: 'Schedule another mock session to push into the top readiness tier.',
    ctaText: 'Practice Now',
    ctaLink: '/setup'
  };

  if (missingItems.length > 0 && resumeScore < 70) {
    nextBestAction = {
      text: `Update your profile (${missingItems[0]}) to boost resume completeness.`,
      ctaText: 'Complete Profile',
      ctaLink: '/profile'
    };
  } else if (completedSessions.length === 0) {
    nextBestAction = {
      text: 'Take your first diagnostic mock interview to benchmark your communication and technical skills.',
      ctaText: 'Start First Mock',
      ctaLink: '/setup'
    };
  } else if (sessionsThisWeek < 2) {
    nextBestAction = {
      text: 'Complete 1 more mock interview this week to maintain peak practice momentum.',
      ctaText: 'Start Mock Interview',
      ctaLink: '/setup'
    };
  }

  return {
    overallScore,
    tier,
    practiceFrequency: {
      score: practiceScore,
      completedThisWeek: sessionsThisWeek,
      totalCompleted: completedSessions.length,
      label: practiceFrequencyLabel,
      weight: 30
    },
    resumeCompleteness: {
      score: resumeScore,
      missingItems,
      label: `${resumeScore}% profile depth`,
      weight: 35
    },
    performanceTrends: {
      score: performanceScore,
      trendDirection,
      deltaText,
      label: deltaText,
      weight: 35
    },
    nextBestAction
  };
};

export default function InterviewReadinessWidget({
  user,
  sessions
}: InterviewReadinessWidgetProps) {
  const readiness = useMemo(
    () => calculateReadinessScore(user, sessions),
    [user, sessions]
  );

  return (
    <div className="p-6 sm:p-8 rounded-[36px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md shadow-slate-200/40 dark:shadow-none space-y-6 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 blur-3xl rounded-full pointer-events-none -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 dark:bg-indigo-500/10 blur-2xl rounded-full pointer-events-none -ml-16 -mb-16" />

      {/* Header with Title and Tier Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800/40">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Predictive Benchmark</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Interview Readiness Score</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Aggregated from your practice frequency, resume profile completeness, and real mock performance trends.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-stretch sm:self-auto justify-between sm:justify-end">
          <span
            className={`px-3.5 py-1.5 rounded-2xl text-xs font-black uppercase tracking-wider border shadow-xs ${readiness.tier.badgeBg}`}
          >
            {readiness.tier.label}
          </span>
          <div className="text-right">
            <div className="flex items-baseline space-x-1">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {readiness.overallScore}
              </span>
              <span className="text-sm font-bold text-slate-400">/100</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Index</p>
          </div>
        </div>
      </div>

      {/* Primary Dynamic Progress Bar */}
      <div className="space-y-2 relative z-10">
        <div className="h-4.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${readiness.overallScore}%` }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className={`h-full rounded-full bg-gradient-to-r ${readiness.tier.gradient} relative overflow-hidden`}
          >
            {/* Shimmer light effect */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2s_infinite]" />
          </motion.div>
        </div>

        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 px-1">
          <span>Starter (0%)</span>
          <span>Developing (50%)</span>
          <span>Competitive (70%)</span>
          <span className="text-slate-600 dark:text-slate-300 font-black">Ready (85%+)</span>
        </div>
      </div>

      {/* 3 Aggregated Data Pillars (Practice Frequency, Resume Completeness, Performance Trends) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 relative z-10">
        {/* Pillar 1: Practice Frequency */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Practice Frequency</span>
            </span>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Weight: {readiness.practiceFrequency.weight}%
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {readiness.practiceFrequency.score}%
            </span>
            <span className="text-[11px] font-bold text-slate-500 truncate max-w-[170px]">
              {readiness.practiceFrequency.completedThisWeek > 0
                ? `${readiness.practiceFrequency.completedThisWeek} this week`
                : `${readiness.practiceFrequency.totalCompleted} total sessions`}
            </span>
          </div>

          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${readiness.practiceFrequency.score}%` }}
              transition={{ duration: 1, delay: 0.1 }}
              className="h-full bg-blue-600 rounded-full"
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {readiness.practiceFrequency.label}
          </p>
        </div>

        {/* Pillar 2: Resume Completeness */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Resume Completeness</span>
            </span>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Weight: {readiness.resumeCompleteness.weight}%
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {readiness.resumeCompleteness.score}%
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {readiness.resumeCompleteness.score >= 80 ? (
                <span className="text-emerald-600 font-black flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Comprehensive</span>
                </span>
              ) : (
                <Link to="/profile" className="text-blue-600 hover:underline flex items-center">
                  <span>Polish Profile</span>
                  <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </Link>
              )}
            </span>
          </div>

          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${readiness.resumeCompleteness.score}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className="h-full bg-purple-600 rounded-full"
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {readiness.resumeCompleteness.missingItems.length > 0
              ? `Missing: ${readiness.resumeCompleteness.missingItems.slice(0, 2).join(', ')}`
              : 'All profile sections and skills fully populated'}
          </p>
        </div>

        {/* Pillar 3: Performance Trends */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Performance Trends</span>
            </span>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Weight: {readiness.performanceTrends.weight}%
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {readiness.performanceTrends.score}%
            </span>
            <span className={`text-[11px] font-bold ${
              readiness.performanceTrends.trendDirection === 'up'
                ? 'text-emerald-600'
                : readiness.performanceTrends.trendDirection === 'down'
                ? 'text-amber-500'
                : 'text-slate-500'
            }`}>
              {readiness.performanceTrends.deltaText}
            </span>
          </div>

          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${readiness.performanceTrends.score}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-emerald-600 rounded-full"
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
            {readiness.performanceTrends.label}
          </p>
        </div>
      </div>

      {/* Actionable Next Best Step Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-500/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Next Recommended Action
            </span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {readiness.nextBestAction.text}
            </p>
          </div>
        </div>

        <Link
          to={readiness.nextBestAction.ctaLink}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-500/20 hover:scale-105 transition-all self-end sm:self-auto flex-shrink-0 cursor-pointer"
        >
          <span>{readiness.nextBestAction.ctaText}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
