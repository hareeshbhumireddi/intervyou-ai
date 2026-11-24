import { useEffect, useMemo, useState } from 'react';
import { Activity, Award, BarChart3, Check, CheckCircle2, ChevronRight, Download, FileSpreadsheet, Target, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { api } from '../utils/api';
import { exportPerformanceOverviewCsv } from '../utils/exportCsv';
import { exportPerformanceOverviewPdf, exportSessionReportPdf } from '../utils/exportPdf';
import ActivityHeatmap from '../components/ActivityHeatmap';
import PerformanceAudioPlayer, { AudioSection } from '../components/PerformanceAudioPlayer';
import ScoreTrendChart from '../components/ScoreTrendChart';
import SkillProgressionRadar from '../components/SkillProgressionRadar';
import SkillTopicHeatmap from '../components/SkillTopicHeatmap';

export default function PerformanceOverview() {
  const { sessions, user } = useAppState();
  const [performance, setPerformance] = useState<Awaited<ReturnType<typeof api.performance>>['performance'] | null>(null);
  const [error, setError] = useState('');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'downloaded'>('idle');
  const [csvStatus, setCsvStatus] = useState<'idle' | 'downloaded'>('idle');

  useEffect(() => {
    let isActive = true;
    api.performance()
      .then(({ performance: result }) => { if (isActive) setPerformance(result); })
      .catch((loadError) => { if (isActive) setError(loadError instanceof Error ? loadError.message : 'Could not load performance data.'); });
    return () => { isActive = false; };
  }, [sessions.length]);

  const effectivePerformance = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed' || Boolean(s.overallReport));
    if (performance && performance.totalInterviews >= completed.length) {
      return performance;
    }

    const totalInterviews = completed.length;
    const scores = completed.map((s) => Number(s.overallReport?.overallScore) || 0);
    const averageScore = totalInterviews
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalInterviews)
      : performance?.averageScore ?? 0;
    const bestScore = totalInterviews ? Math.max(...scores) : performance?.bestScore ?? 0;

    let correctAnswers = 0;
    let incorrectAnswers = 0;
    const history = [...completed]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((s) => {
        const totalQuestions = s.questions?.length || 0;
        const evalList = Object.values(s.evaluations || {});
        const correct = evalList.filter((ev) => (ev?.score || 0) >= 60).length;
        const incorrect = Math.max(0, totalQuestions - correct);
        correctAnswers += correct;
        incorrectAnswers += incorrect;
        return {
          interviewId: s.id,
          score: Number(s.overallReport?.overallScore) || 0,
          correct,
          incorrect,
          totalQuestions,
          date: s.date,
        };
      });

    return {
      totalInterviews,
      averageScore,
      bestScore,
      correctAnswers,
      incorrectAnswers,
      history,
    };
  }, [performance, sessions]);

  const handleDownloadOverviewPdf = () => {
    try {
      exportPerformanceOverviewPdf({
        user,
        sessions,
        performance: effectivePerformance,
      });
      setPdfStatus('downloaded');
      setTimeout(() => setPdfStatus('idle'), 2500);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : 'Could not generate PDF report.');
    }
  };

  const handleDownloadReportCsv = () => {
    try {
      exportPerformanceOverviewCsv({
        candidateName: user?.fullName || 'Candidate',
        sessions,
        history: effectivePerformance?.history || [],
      });
      setCsvStatus('downloaded');
      setTimeout(() => setCsvStatus('idle'), 2500);
    } catch (csvError) {
      setError(csvError instanceof Error ? csvError.message : 'Could not generate CSV report.');
    }
  };

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const overviewAudioSections = useMemo<AudioSection[]>(() => {
    const total = effectivePerformance?.totalInterviews ?? 0;
    const avg = effectivePerformance?.averageScore ?? 0;
    const best = effectivePerformance?.bestScore ?? 0;
    const correct = effectivePerformance?.correctAnswers ?? 0;
    const incorrect = effectivePerformance?.incorrectAnswers ?? 0;
    const history = effectivePerformance?.history || [];

    if (!total) {
      return [
        {
          id: 'overview',
          label: 'Overall Summary',
          text: 'You have not completed any mock interviews yet. Start a mock interview to generate your performance metrics and personalized audio feedback.',
        },
      ];
    }

    const recentTen = [...history]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10);
    let trendSentence = '';
    if (recentTen.length >= 2) {
      const delta = recentTen[recentTen.length - 1].score - recentTen[0].score;
      if (delta > 0) {
        trendSentence = `Across your last ${recentTen.length} interviews, your score improved by ${delta} percentage points.`;
      } else if (delta < 0) {
        trendSentence = `Across your last ${recentTen.length} interviews, your score shifted by ${delta} percentage points.`;
      } else {
        trendSentence = `Across your last ${recentTen.length} interviews, your score remained steady at ${recentTen[recentTen.length - 1].score} percent.`;
      }
    }

    const recentRecap = [...history]
      .reverse()
      .slice(0, 5)
      .map((item) => {
        const matched = sessionMap.get(item.interviewId);
        const roleLabel = matched?.role || 'Mock Interview';
        const dateLabel = new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return `${roleLabel} on ${dateLabel}: ${item.score} percent with ${item.correct} of ${item.totalQuestions} strong responses`;
      })
      .join('. ');

    return [
      {
        id: 'overview',
        label: 'Overall Summary',
        text: `Overall interview performance summary for ${user?.fullName || 'Candidate'}. You have completed ${total} mock ${total === 1 ? 'interview' : 'interviews'}, with an average score of ${avg} percent and a personal best of ${best} percent. You recorded ${correct} strong answers and ${incorrect} answers needing improvement. ${trendSentence}`,
      },
      {
        id: 'recent',
        label: 'Recent Interviews',
        text: recentRecap ? `Recent sessions: ${recentRecap}.` : 'No recent session breakdown available.',
      },
    ];
  }, [effectivePerformance, sessionMap, user?.fullName]);

  const stats = [
    { label: 'Sessions completed', value: effectivePerformance?.totalInterviews ?? 0, icon: Activity },
    { label: 'Average score', value: `${effectivePerformance?.averageScore ?? 0}%`, icon: BarChart3 },
    { label: 'Personal best', value: `${effectivePerformance?.bestScore ?? 0}%`, icon: Award },
    { label: 'Correct answers', value: effectivePerformance?.correctAnswers ?? 0, icon: CheckCircle2 },
    { label: 'Incorrect answers', value: effectivePerformance?.incorrectAnswers ?? 0, icon: XCircle },
    { label: 'Practice goal', value: `${Math.min(sessions.length, 5)}/5`, icon: Target },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Progress overview</p>
          <h1 className="mt-1 text-3xl font-bold">Performance</h1>
          <p className="mt-2 text-sm text-slate-500">Track your interview practice scores and improvement.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadReportCsv}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-xs transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Export interview history and performance metrics as a spreadsheet CSV file"
          >
            {csvStatus === 'downloaded' ? (
              <>
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>CSV Downloaded</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>Download Report CSV</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadOverviewPdf}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer"
            title="Download summary document of your overall interview performance"
          >
            {pdfStatus === 'downloaded' ? (
              <>
                <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
                <span>PDF Downloaded</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <p className="mt-4 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </article>
        ))}
      </section>

      {/* Web Speech API Audio Overview */}
      <PerformanceAudioPlayer
        title="Listen to Performance Summary"
        subtitle="Hear your cumulative scores, score trend, and latest session highlights using the browser Web Speech API."
        sections={overviewAudioSections}
      />

      {/* Visual Trend Line Chart (Last 10 Interviews) */}
      <ScoreTrendChart sessions={sessions} historyFallback={effectivePerformance?.history} />

      {/* Multidimensional Skill Progression Radar Chart */}
      <SkillProgressionRadar sessions={sessions} />

      {/* D3 Topic Mastery Heatmap */}
      <SkillTopicHeatmap sessions={sessions} />

      {/* Weekly Activity Heatmap */}
      <ActivityHeatmap sessions={sessions} />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="font-semibold">Recent interview results</h2></div>
        {effectivePerformance?.history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Correct</th>
                  <th className="px-5 py-3 font-semibold">Incorrect</th>
                  <th className="px-5 py-3 font-semibold">Questions</th>
                  <th className="px-5 py-3 text-right font-semibold">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...effectivePerformance.history].reverse().slice(0, 10).map((record) => {
                  const matchedSession = sessionMap.get(record.interviewId);
                  return (
                    <tr key={record.interviewId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                        {matchedSession?.role || 'Mock Interview'}
                      </td>
                      <td className="px-5 py-3 font-semibold">{record.score}%</td>
                      <td className="px-5 py-3">{record.correct}</td>
                      <td className="px-5 py-3">{record.incorrect}</td>
                      <td className="px-5 py-3">{record.totalQuestions}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {matchedSession && (
                            <button
                              type="button"
                              onClick={() => exportSessionReportPdf(matchedSession, user?.fullName || 'Candidate', user?.email || '')}
                              aria-label={`Download PDF report for ${matchedSession.role}`}
                              title="Download PDF"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            to={`/performance/${record.interviewId}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 transition-colors"
                          >
                            View <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-sm text-slate-500">{performance ? 'No completed interviews yet.' : 'Loading performance history...'}</p>
        )}
      </section>
    </div>
  );
}