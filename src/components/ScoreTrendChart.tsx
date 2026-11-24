import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus, Play, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InterviewSession } from '../types';

export interface HistoryFallbackRecord {
  interviewId: string;
  score: number;
  correct: number;
  incorrect: number;
  totalQuestions: number;
  date: string;
}

interface ScoreTrendChartProps {
  sessions: InterviewSession[];
  historyFallback?: HistoryFallbackRecord[];
}

interface TrendPoint {
  id: string;
  indexLabel: string;
  axisLabel: string;
  fullDate: string;
  role: string;
  sector: string;
  difficulty: string;
  score: number;
  movingAvg: number;
  deltaFromPrev: number | null;
}

export default function ScoreTrendChart({ sessions, historyFallback = [] }: ScoreTrendChartProps) {
  const [showTrendAverage, setShowTrendAverage] = useState(true);
  const [showBenchmark, setShowBenchmark] = useState(true);

  const { chartData, netChange, peakScore, windowAverage } = useMemo(() => {
    const completedSessions = sessions.filter(
      (s) => s.status === 'completed' || Boolean(s.overallReport)
    );

    const byId = new Map<
      string,
      { id: string; date: string; role: string; sector: string; difficulty: string; score: number }
    >();

    for (const h of historyFallback) {
      if (!h?.interviewId) continue;
      byId.set(h.interviewId, {
        id: h.interviewId,
        date: h.date,
        role: 'Mock Interview',
        sector: 'Private',
        difficulty: 'Intermediate',
        score: Math.round(Number(h.score) || 0),
      });
    }

    for (const s of completedSessions) {
      byId.set(s.id, {
        id: s.id,
        date: s.date,
        role: s.role || 'Mock Interview',
        sector: s.sector || 'Private',
        difficulty: s.difficulty || 'Intermediate',
        score: Math.round(Number(s.overallReport?.overallScore) || 0),
      });
    }

    const chronological = Array.from(byId.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);

    const points: TrendPoint[] = chronological.map((item, idx) => {
      const parsedDate = new Date(item.date);
      const shortDate = Number.isNaN(parsedDate.getTime())
        ? `#${idx + 1}`
        : parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const fullDate = Number.isNaN(parsedDate.getTime())
        ? item.date
        : parsedDate.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

      // 3-interview trailing moving average for smooth trend trajectory
      const windowSlice = chronological.slice(Math.max(0, idx - 2), idx + 1);
      const movingAvg = Math.round(
        windowSlice.reduce((sum, entry) => sum + entry.score, 0) / windowSlice.length
      );

      const prevScore = idx > 0 ? chronological[idx - 1].score : null;
      return {
        id: item.id,
        indexLabel: `#${idx + 1}`,
        axisLabel: `${shortDate} (#${idx + 1})`,
        fullDate,
        role: item.role,
        sector: item.sector,
        difficulty: item.difficulty,
        score: item.score,
        movingAvg,
        deltaFromPrev: prevScore !== null ? item.score - prevScore : null,
      };
    });

    const first = points[0]?.score ?? 0;
    const last = points[points.length - 1]?.score ?? 0;
    const change = points.length >= 2 ? last - first : 0;
    const peak = points.length ? Math.max(...points.map((p) => p.score)) : 0;
    const avg = points.length
      ? Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length)
      : 0;

    return {
      chartData: points,
      netChange: change,
      peakScore: peak,
      windowAverage: avg,
    };
  }, [sessions, historyFallback]);

  return (
    <section
      aria-label="Score improvement trend over last 10 interviews"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Score Improvement Trend
            </h2>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Last {chartData.length || 0} of 10 Interviews
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Chronological progression of your interview scores and 3-session rolling trend line.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {chartData.length >= 2 && (
            <div
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold ${
                netChange > 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : netChange < 0
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {netChange > 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : netChange < 0 ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              <span>
                {netChange > 0 ? `+${netChange}%` : `${netChange}%`} net change
              </span>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <span>Avg: <strong className="text-slate-900 dark:text-white">{windowAverage}%</strong></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>Peak: <strong className="text-blue-600 dark:text-blue-400">{peakScore}%</strong></span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowTrendAverage((prev) => !prev)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              showTrendAverage
                ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {showTrendAverage ? 'Hide Trend Avg' : 'Show Trend Avg'}
          </button>

          <button
            type="button"
            onClick={() => setShowBenchmark((prev) => !prev)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              showBenchmark
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {showBenchmark ? 'Hide Target (80%)' : 'Target (80%)'}
          </button>
        </div>
      </div>

      <div className="mt-5 h-80 w-full">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 20, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.45} />
              <XAxis
                dataKey="axisLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                dy={6}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]?.payload as TrendPoint;
                  if (!point) return null;
                  return (
                    <div className="min-w-[210px] rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Interview {point.indexLabel}
                        </span>
                        <span className="text-[11px] text-slate-400">{point.difficulty}</span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {point.role}
                      </p>
                      <p className="text-[11px] text-slate-500">{point.fullDate}</p>

                      <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Session Score:</span>
                          <span className="font-black text-blue-600 dark:text-blue-400">{point.score}%</span>
                        </div>
                        {showTrendAverage && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Rolling Avg:</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">{point.movingAvg}%</span>
                          </div>
                        )}
                        {point.deltaFromPrev !== null && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Vs Previous:</span>
                            <span
                              className={`font-bold ${
                                point.deltaFromPrev > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : point.deltaFromPrev < 0
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {point.deltaFromPrev > 0 ? `+${point.deltaFromPrev}%` : `${point.deltaFromPrev}%`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px', fontWeight: 600 }} iconType="circle" />

              {showBenchmark && (
                <ReferenceLine
                  y={80}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Target 80%',
                    position: 'insideTopRight',
                    fill: '#10b981',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}

              <Line
                type="monotone"
                dataKey="score"
                name="Interview Score (%)"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
              />

              {showTrendAverage && (
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  name="3-Interview Rolling Avg"
                  stroke="#9333ea"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, fill: '#9333ea', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Complete a mock interview to track your score improvement across your last 10 sessions.
            </p>
            <Link
              to="/setup"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> Start Mock Interview
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
