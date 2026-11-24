import { useMemo, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Target, TrendingUp, Award, Play, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InterviewSession } from '../types';

interface SkillProgressionRadarProps {
  sessions: InterviewSession[];
}

interface SkillMetricItem {
  skill: string;
  current: number;
  baseline: number;
  target: number;
  description: string;
  samplesCount: number;
}

export default function SkillProgressionRadar({ sessions }: SkillProgressionRadarProps) {
  const [showBaseline, setShowBaseline] = useState(true);
  const [showTarget, setShowTarget] = useState(true);

  // Compute accurate metrics strictly from real completed session data
  const { radarData, summaryStats, hasCompletedData } = useMemo(() => {
    // Only consider sessions that have an evaluation or report
    const completed = sessions.filter(
      (s) => s.status === 'completed' || Boolean(s.overallReport) || (s.evaluations && Object.keys(s.evaluations).length > 0)
    );

    if (completed.length === 0) {
      return {
        radarData: [] as SkillMetricItem[],
        summaryStats: {
          avgOverall: 0,
          topSkill: 'None yet',
          growthSkill: 'None yet',
          totalSessions: 0,
        },
        hasCompletedData: false,
      };
    }

    // Sort chronologically (oldest to newest)
    const sorted = [...completed].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const initialSession = sorted[0];
    const recentSessions = sorted.slice(-3); // Last 3 sessions for current progression

    // Extract accurate metric from a session
    const extractSessionSkill = (
      s: InterviewSession,
      skillKey: 'tech' | 'comm' | 'problem' | 'conf' | 'rel' | 'prof'
    ): number | null => {
      const evals = Object.values(s.evaluations || {});
      const report = s.overallReport;
      const metrics = report?.detailedMetrics;
      const gaps = report?.skillGapAnalysis;

      switch (skillKey) {
        case 'tech': {
          const scores = evals
            .map((e) => e.metrics?.technicalAccuracy ?? e.score)
            .filter((v): v is number => typeof v === 'number' && v > 0);
          if (scores.length) {
            return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          if (typeof report?.overallScore === 'number') return report.overallScore;
          return null;
        }

        case 'comm': {
          const scores = evals
            .map((e) => e.metrics?.communication ?? e.metrics?.fluency ?? e.score)
            .filter((v): v is number => typeof v === 'number' && v > 0);
          if (scores.length) {
            return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          if (metrics?.listeningSkills) return metrics.listeningSkills;
          if (typeof report?.overallScore === 'number') return report.overallScore;
          return null;
        }

        case 'problem': {
          if (metrics?.problemSolving) return metrics.problemSolving;
          if (metrics?.logicalThinking) return metrics.logicalThinking;
          if (gaps && typeof gaps['Problem Solving'] === 'number') {
            return Math.round(gaps['Problem Solving'] * 10);
          }
          const scores = evals
            .map((e) => e.score)
            .filter((v): v is number => typeof v === 'number' && v > 0);
          if (scores.length) {
            return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          return typeof report?.overallScore === 'number' ? report.overallScore : null;
        }

        case 'conf': {
          const scores = evals
            .map((e) => e.metrics?.confidence ?? e.score)
            .filter((v): v is number => typeof v === 'number' && v > 0);
          if (scores.length) {
            return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          if (metrics?.eyeContact) return metrics.eyeContact;
          return typeof report?.overallScore === 'number' ? report.overallScore : null;
        }

        case 'rel': {
          const scores = evals
            .map((e) => e.metrics?.relevance ?? e.score)
            .filter((v): v is number => typeof v === 'number' && v > 0);
          if (scores.length) {
            return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          return typeof report?.overallScore === 'number' ? report.overallScore : null;
        }

        case 'prof': {
          if (metrics?.professionalism) return metrics.professionalism;
          if (metrics?.timeManagement) return metrics.timeManagement;
          if (metrics?.listeningSkills) return metrics.listeningSkills;
          return typeof report?.overallScore === 'number' ? report.overallScore : null;
        }
      }
    };

    // Calculate actual average for an array of sessions
    const getAverage = (
      sessionsList: InterviewSession[],
      skillKey: 'tech' | 'comm' | 'problem' | 'conf' | 'rel' | 'prof'
    ): { value: number; count: number } => {
      const validValues = sessionsList
        .map((s) => extractSessionSkill(s, skillKey))
        .filter((v): v is number => v !== null && !isNaN(v));

      if (validValues.length === 0) {
        return { value: 0, count: 0 };
      }

      return {
        value: Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length),
        count: validValues.length,
      };
    };

    const isMultiple = sorted.length > 1;

    // Define the 6 skills accurately
    const definitions: {
      key: 'tech' | 'comm' | 'problem' | 'conf' | 'rel' | 'prof';
      skill: string;
      description: string;
    }[] = [
      { key: 'tech', skill: 'Technical Depth', description: 'Core domain accuracy and question correctness' },
      { key: 'comm', skill: 'Communication', description: 'Clarity, articulation, and expressive vocabulary' },
      { key: 'problem', skill: 'Problem Solving', description: 'Structured logic, analytical reasoning, and edge-cases' },
      { key: 'conf', skill: 'Confidence', description: 'Poise, delivery composure, and pace' },
      { key: 'rel', skill: 'Relevance', description: 'Answer precision and addressing the prompt directly' },
      { key: 'prof', skill: 'Professionalism', description: 'Listening skills, time adherence, and manner' },
    ];

    const data: SkillMetricItem[] = definitions.map((def) => {
      const curr = getAverage(recentSessions, def.key);
      const base = isMultiple ? getAverage([initialSession], def.key) : curr;

      return {
        skill: def.skill,
        current: curr.value,
        baseline: base.value,
        target: 85, // Hiring benchmark
        description: def.description,
        samplesCount: curr.count,
      };
    });

    const activeItems = data.filter((d) => d.current > 0);
    const sortedByCurrent = [...activeItems].sort((a, b) => b.current - a.current);
    const topSkillName = sortedByCurrent.length > 0 ? sortedByCurrent[0].skill : 'N/A';

    // Fastest growth skill: largest actual difference between current and baseline
    const sortedByGrowth = [...activeItems].sort(
      (a, b) => (b.current - b.baseline) - (a.current - a.baseline)
    );
    const growthSkillName = sortedByGrowth.length > 0 && isMultiple ? sortedByGrowth[0].skill : topSkillName;

    const avgOverall = activeItems.length > 0
      ? Math.round(activeItems.reduce((acc, d) => acc + d.current, 0) / activeItems.length)
      : 0;

    return {
      radarData: data,
      summaryStats: {
        avgOverall,
        topSkill: topSkillName,
        growthSkill: growthSkillName,
        totalSessions: completed.length,
      },
      hasCompletedData: true,
    };
  }, [sessions]);

  // If candidate has not completed any interviews, show genuine accurate empty state
  if (!hasCompletedData) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <Target className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          No Interview Data Recorded Yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Your skill progression radar will automatically compute accurate metrics across Technical Depth, Communication, Problem Solving, Confidence, Relevance, and Professionalism from your real mock interviews.
        </p>
        <Link
          to="/setup"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          <Play className="h-4 w-4 fill-current" /> Start Mock Interview
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Target className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Accurate Data Analysis
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {summaryStats.totalSessions} Interview{summaryStats.totalSessions === 1 ? '' : 's'} Evaluated
            </span>
          </div>
          <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
            Skill Progression Radar
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Live progression calculated directly from your real responses and evaluation scores.
          </p>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {summaryStats.totalSessions > 1 && (
            <button
              type="button"
              onClick={() => setShowBaseline((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                showBaseline
                  ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              {showBaseline ? 'Hide First Session' : 'Show First Session'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTarget((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              showTarget
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {showTarget ? 'Hide Benchmark' : 'Target (85%)'}
          </button>
        </div>
      </div>

      {/* Main Grid: Radar Chart + Real Breakdown Cards */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        {/* Radar Chart Viewport (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="relative mx-auto h-[360px] w-full max-w-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#cbd5e1" strokeDasharray="3 3" className="dark:stroke-slate-700" />
                <PolarAngleAxis
                  dataKey="skill"
                  tick={{
                    fill: '#475569',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                />

                {showTarget && (
                  <Radar
                    name="Target Benchmark (85%)"
                    dataKey="target"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="#10b981"
                    fillOpacity={0.06}
                  />
                )}

                {showBaseline && summaryStats.totalSessions > 1 && (
                  <Radar
                    name="Initial Session (Baseline)"
                    dataKey="baseline"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fill="#a855f7"
                    fillOpacity={0.2}
                  />
                )}

                <Radar
                  name={summaryStats.totalSessions > 1 ? 'Current Progression' : 'Current Session Score'}
                  dataKey="current"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="#2563eb"
                  fillOpacity={0.4}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload as SkillMetricItem;
                    if (!item) return null;
                    const diff = item.current - item.baseline;
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                        <p className="text-xs font-black text-slate-900 dark:text-white">{item.skill}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{item.description}</p>
                        <div className="mt-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-4 font-bold text-blue-600 dark:text-blue-400">
                            <span>Evaluated Score:</span>
                            <span>{item.current}%</span>
                          </div>
                          {summaryStats.totalSessions > 1 && (
                            <div className="flex items-center justify-between gap-4 text-purple-600 dark:text-purple-400">
                              <span>First Session:</span>
                              <span>{item.baseline}%</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                            <span>Target Goal:</span>
                            <span>{item.target}%</span>
                          </div>
                        </div>
                        {diff > 0 && summaryStats.totalSessions > 1 && (
                          <div className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] font-bold text-emerald-600 dark:border-slate-800">
                            📈 +{diff}% gain from first interview
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontWeight: 600 }}
                  iconType="circle"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Competency Cards & Highlights (5 Cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Quick Highlight Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-blue-50/70 p-4 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                <Award className="h-4 w-4" /> Strongest Competency
              </span>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                {summaryStats.topSkill}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">Based on evaluated answers</p>
            </div>

            <div className="rounded-2xl bg-purple-50/70 p-4 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
              <span className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                <TrendingUp className="h-4 w-4" />
                {summaryStats.totalSessions > 1 ? 'Top Progression' : 'Current Target'}
              </span>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                {summaryStats.growthSkill}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {summaryStats.totalSessions > 1 ? 'Highest net improvement' : 'Aiming for 85% readiness'}
              </p>
            </div>
          </div>

          {/* Real Skill Metrics List */}
          <div className="space-y-2.5">
            {radarData.map((item) => {
              const diff = item.current - item.baseline;
              const isAboveTarget = item.current >= item.target;
              return (
                <div
                  key={item.skill}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.skill}
                      </p>
                      <p className="text-[10px] text-slate-500">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">
                        {item.current > 0 ? `${item.current}%` : 'N/A'}
                      </span>
                      {diff !== 0 && summaryStats.totalSessions > 1 && (
                        <span
                          className={`ml-1.5 text-[10px] font-bold ${
                            diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
                          }`}
                        >
                          {diff > 0 ? `+${diff}%` : `${diff}%`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Accurate Progress Bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAboveTarget
                          ? 'bg-emerald-500'
                          : item.current >= 70
                          ? 'bg-blue-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, item.current))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
