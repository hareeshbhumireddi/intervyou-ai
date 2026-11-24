import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  History, 
  TrendingUp, 
  Award, 
  ChevronRight,
  Clock,
  Briefcase,
  MapPin,
  ExternalLink,
  Calendar,
  Sparkles,
  Flame,
  LayoutGrid
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppState } from '../hooks/useAppState';
import { api } from '../utils/api';
import { isActiveJob } from '../services/jobLiveService';
import { JobNotification } from '../types';
import QuickInterviewTips from '../components/QuickInterviewTips';
import WeeklyGoalRing from '../components/WeeklyGoalRing';
import UpcomingScheduleWidget from '../components/UpcomingScheduleWidget';
import InterviewReadinessWidget from '../components/InterviewReadinessWidget';
import GoalSettingPanel from '../components/GoalSettingPanel';
import MilestoneBadges from '../components/MilestoneBadges';
import DailyInterviewTipToast from '../components/DailyInterviewTipToast';

const STAT_COLOR_STYLES: Record<string, { bg: string; text: string }> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-600 dark:text-purple-400',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-600 dark:text-green-400',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400',
  },
};

export default function Dashboard() {
  const { user, sessions, notifications } = useAppState();
  const [liveJobs, setLiveJobs] = useState<JobNotification[]>([]);

  useEffect(() => {
    let active = true;
    api.searchLiveJobs({ limit: 5 })
      .then((res) => {
        if (active && res.jobs?.length > 0) {
          setLiveJobs(res.jobs.filter(isActiveJob).slice(0, 5));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const displayedJobs = liveJobs.length > 0 ? liveJobs : notifications.filter(isActiveJob).slice(0, 5);

  // Accurate dynamic data calculations directly from user sessions
  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' || Boolean(s.overallReport)
  );

  const totalInterviews = completedSessions.length;
  const avgScore = totalInterviews > 0
    ? Math.round(
        completedSessions.reduce(
          (sum, s) => sum + (s.overallReport?.overallScore || 0),
          0
        ) / totalInterviews
      )
    : user.stats?.avgScore || 0;

  const bestScore = totalInterviews > 0
    ? Math.max(
        ...completedSessions.map((s) => s.overallReport?.overallScore || 0)
      )
    : user.stats?.bestScore || 0;

  // Real chart data from completed interviews
  const data = completedSessions
    .slice(0, 7)
    .reverse()
    .map((s, i) => ({
      name: `Session ${i + 1}`,
      score: s.overallReport?.overallScore || 0,
      role: s.role,
    }));

  const stats = [
    { label: 'Interviews Taken', value: totalInterviews, icon: History, color: 'blue' },
    { label: 'Average Score', value: `${avgScore}%`, icon: TrendingUp, color: 'purple' },
    { label: 'Personal Best', value: `${bestScore}%`, icon: Award, color: 'green' },
    { 
      label: 'Practice Streak', 
      value: totalInterviews > 0 ? `${Math.min(totalInterviews, 7)} Days` : 'Ready', 
      icon: Flame, 
      color: 'orange' 
    },
  ];

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Welcome back, {user.fullName || 'Candidate'}! 👋
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track your weekly consistency, upcoming schedule, and personalized coaching insights.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/schedule"
            className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-5 py-3 rounded-2xl font-bold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm"
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Interview Calendar</span>
          </Link>
          <Link
            to="/setup"
            aria-keyshortcuts="Control+I"
            title="Start Practice (Ctrl+I)"
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Start Practice</span>
            <kbd className="hidden sm:inline-flex items-center rounded-md border border-white/25 bg-white/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white/95">
              Ctrl+I
            </kbd>
          </Link>
        </div>
      </div>

      {/* Top 4 Key Metric Cards (Including Visual Progress Ring Widget) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.slice(0, 3).map((stat, i) => {
          const colorStyle = STAT_COLOR_STYLES[stat.color] || STAT_COLOR_STYLES.blue;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <div className={`w-12 h-12 rounded-2xl ${colorStyle.bg} flex items-center justify-center mb-4`}>
                <stat.icon className={`w-6 h-6 ${colorStyle.text}`} />
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{stat.value}</p>
            </motion.div>
          );
        })}

        {/* 4th Stat Card: Visual Weekly Goal Progress Ring */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center"
        >
          <WeeklyGoalRing sessions={sessions} variant="stat-widget" />
        </motion.div>
      </div>

      {/* Dynamic Interview Readiness Score Widget */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
      >
        <InterviewReadinessWidget user={user} sessions={sessions} />
      </motion.div>

      {/* Goal Setting & Target Milestones */}
      <GoalSettingPanel
        sessions={sessions}
        avgScore={avgScore}
        bestScore={bestScore}
      />

      {/* Milestone Badges */}
      <MilestoneBadges
        user={user}
        sessions={sessions}
        bestScore={bestScore}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODULAR CARD GRID: UPCOMING SCHEDULE | QUICK TIPS | WEEKLY PROGRESS */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4" aria-label="Core Practice Modules">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/20">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Daily Practice Modules
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Card-based modular overview
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Module 1: Upcoming Schedule */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="h-full"
          >
            <UpcomingScheduleWidget />
          </motion.div>

          {/* Module 2: Quick Tips */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="h-full"
          >
            <QuickInterviewTips variant="card" />
          </motion.div>

          {/* Module 3: Weekly Progress */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="h-full"
          >
            <WeeklyGoalRing sessions={sessions} variant="card" />
          </motion.div>
        </div>
      </section>

      {/* Main Insights & Real-Time Openings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Score Trend Chart (2 Cols) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Score Trend</h2>
              <p className="text-xs text-slate-500">Evaluation scores across completed mock interviews</p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
              <div className="w-3 h-3 bg-blue-600 rounded-full" />
              <span>Score %</span>
            </div>
          </div>
          <div className="h-[280px] w-full">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#2563EB', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <TrendingUp className="w-12 h-12 mb-2 opacity-20" />
                <p className="text-sm">Complete your first mock interview to see real trend data</p>
                <Link to="/setup" className="mt-3 text-xs font-bold text-blue-600 hover:underline">
                  Start interview →
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Side: Real-Time Job Search Feed */}
        <div className="space-y-6">
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold flex items-center space-x-2 text-slate-900 dark:text-white">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span>Live Job Search</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">LinkedIn & Naukri connected</p>
                </div>
                <Link to="/jobs" className="text-xs font-bold text-blue-600 hover:underline">
                  Explore All →
                </Link>
              </div>

              <div className="space-y-3">
                {displayedJobs.map((job) => (
                  <div key={job.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group hover:border-blue-200 transition-all">
                    <div className="flex justify-between items-start mb-1.5">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate pr-2">{job.title}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {job.platform === 'LinkedIn' && (
                          <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-blue-100 text-[#0A66C2] dark:bg-blue-950 dark:text-blue-300">
                            LinkedIn
                          </span>
                        )}
                        {job.platform === 'Naukri' && (
                          <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-sky-100 text-[#0050B3] dark:bg-sky-950 dark:text-sky-300">
                            Naukri
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${job.sector === 'Private' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-purple-100 text-purple-600'}`}>
                          {job.sector}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                        {job.location.split(',')[0]}
                      </span>
                      <a
                        href={job.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Apply for ${job.title} at ${job.company}`}
                        className="text-blue-600 font-bold flex items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <span>Apply</span>
                        <ExternalLink className="w-2.5 h-2.5 ml-1" />
                      </a>
                    </div>
                  </div>
                ))}
                {displayedJobs.length === 0 && <p className="text-slate-400 text-xs italic text-center py-4">No live jobs fetched yet</p>}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <Link
                to="/jobs"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 transition"
              >
                <span>Browse All Openings</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Interview Activity Table */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Interview Activity</h2>
            <p className="text-xs text-slate-500">Past evaluated mock sessions</p>
          </div>
          <Link to="/history" className="text-blue-600 font-bold text-xs hover:underline">
            View All History →
          </Link>
        </div>
        <div className="space-y-3">
          {completedSessions.length > 0 ? (
            completedSessions.slice(0, 3).map((session, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="flex items-center space-x-4">
                  <div className="w-11 h-11 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{session.role}</h4>
                    <p className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        session.sector === 'Government' 
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      }`}>
                        {session.sector}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-base font-black text-blue-600 dark:text-blue-400">
                      {session.overallReport?.overallScore || 0}%
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{session.difficulty}</p>
                  </div>
                  <Link 
                    to={`/report/${session.id}`} 
                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"
                    title="View Detailed Evaluation Report"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-slate-400">
              <p className="text-sm">No evaluated interviews yet. Complete your first practice session!</p>
              <Link to="/setup" className="mt-3 inline-block font-bold text-xs text-blue-600 hover:underline">
                Take a Mock Interview Now →
              </Link>
            </div>
          )}
        </div>
      </div>

      <DailyInterviewTipToast userIdentifier={user.email || user.fullName} />
    </div>
  );
}
