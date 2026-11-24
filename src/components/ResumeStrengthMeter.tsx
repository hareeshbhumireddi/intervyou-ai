import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ApiError, ResumeStrengthResult, api } from '../utils/api';
import { Alert, Button, Card, SelectField, TextField } from './ui';

const INDUSTRIES = [
  'Software Engineering',
  'Data Science & AI',
  'Cloud & DevOps',
  'Product & FinTech',
  'Core / Government Engineering',
  'Cybersecurity & Networking',
] as const;

interface ResumeStrengthMeterProps {
  hasResume: boolean;
  isLoadingResume?: boolean;
  resumeText?: string;
  userSkills?: string[];
  initialIndustry?: string;
  initialRole?: string;
}

function getTierStyles(score: number) {
  if (score >= 85) {
    return {
      text: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
      ring: 'ring-emerald-500',
      bar: 'bg-emerald-500',
    };
  }
  if (score >= 70) {
    return {
      text: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
      ring: 'ring-blue-500',
      bar: 'bg-blue-500',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
      ring: 'ring-amber-500',
      bar: 'bg-amber-500',
    };
  }
  return {
    text: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
    ring: 'ring-red-500',
    bar: 'bg-red-500',
  };
}

function getPriorityStyle(priority: 'High' | 'Medium' | 'Quick Win') {
  if (priority === 'High') {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30';
  }
  if (priority === 'Quick Win') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30';
}

export default function ResumeStrengthMeter({
  hasResume,
  isLoadingResume = false,
  resumeText,
  userSkills = [],
  initialIndustry = 'Software Engineering',
  initialRole = '',
}: ResumeStrengthMeterProps) {
  const [industry, setIndustry] = useState<string>(initialIndustry);
  const [targetRole, setTargetRole] = useState<string>(initialRole);
  const [result, setResult] = useState<ResumeStrengthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlightKeyRef = useRef<string | null>(null);
  const completedKeyRef = useRef<string | null>(null);

  const canAnalyze = hasResume || Boolean(resumeText && resumeText.trim().length >= 20) || userSkills.length >= 2;

  const runAnalysis = useCallback(
    async (nextIndustry = industry, nextRole = targetRole, customText = resumeText, force = false) => {
      const requestKey = `${nextIndustry}::${nextRole.trim()}::${customText?.trim().length || 0}::${hasResume}`;
      if (!force && (inFlightKeyRef.current === requestKey || completedKeyRef.current === requestKey)) {
        return;
      }

      inFlightKeyRef.current = requestKey;
      setLoading(true);
      setError('');
      try {
        const { strength } = await api.analyzeResumeStrength({
          industry: nextIndustry,
          targetRole: nextRole.trim() || undefined,
          text: customText && customText.trim().length >= 20 ? customText.trim() : undefined,
        });
        completedKeyRef.current = requestKey;
        setResult(strength);
      } catch (e) {
        setError(e instanceof ApiError || e instanceof Error ? e.message : 'Unable to analyze resume strength.');
      } finally {
        if (inFlightKeyRef.current === requestKey) {
          inFlightKeyRef.current = null;
        }
        setLoading(false);
      }
    },
    [industry, targetRole, resumeText, hasResume]
  );

  useEffect(() => {
    if (!isLoadingResume && canAnalyze && !result && !completedKeyRef.current && !inFlightKeyRef.current) {
      void runAnalysis(industry, targetRole, resumeText, false);
    }
  }, [isLoadingResume, canAnalyze, result, industry, targetRole, resumeText, runAnalysis]);

  const handleIndustryChange = (nextIndustry: string) => {
    setIndustry(nextIndustry);
    if (canAnalyze) {
      void runAnalysis(nextIndustry, targetRole, resumeText, true);
    }
  };

  const clampedScore = result ? Math.min(100, Math.max(0, result.score)) : 0;
  const tierStyles = getTierStyles(clampedScore);

  return (
    <Card className="space-y-6" data-testid="resume-strength-meter">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Gauge className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
              Resume Strength
            </h2>
            {result && (
              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Sparkles className="h-3 w-3" aria-hidden />
                {result.aiPowered ? 'AI Keyword Audit' : 'Industry Benchmark'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Measures your resume against standard industry keywords, quantified impact, and hiring readiness with actionable AI recommendations.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => { void runAnalysis(industry, targetRole, resumeText); }}
          loading={loading}
          disabled={!canAnalyze}
          className="shrink-0"
        >
          {!loading && <RefreshCw className="h-4 w-4" aria-hidden />}
          {loading ? 'Analyzing…' : result ? 'Re-analyze' : 'Analyze Strength'}
        </Button>
      </div>

      {/* Target industry and role controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Industry benchmark"
          value={industry}
          onChange={(e) => handleIndustryChange(e.target.value)}
        >
          {INDUSTRIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Target role (optional)"
          placeholder="e.g. Full Stack Engineer, Data Analyst"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          hint="Press Re-analyze after updating your role or resume text."
        />
      </div>

      {!canAnalyze && (
        <Alert tone="info">
          Upload a resume above or enter resume text so we can benchmark your skills against standard industry keywords.
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {loading && !result && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden />
          Evaluating resume content against {industry} industry standards…
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Primary Visual Meter */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Overall Strength Score
                </p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span
                    data-testid="resume-strength-score"
                    className={`text-4xl font-extrabold tabular-nums ${tierStyles.text}`}
                  >
                    {clampedScore}
                  </span>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/ 100</span>
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-bold ${tierStyles.badge}`}>
                    <Award className="h-3.5 w-3.5" aria-hidden />
                    {result.tier}
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Industry Keyword Coverage</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {result.keywordCoverage}%
                </p>
              </div>
            </div>

            {/* Gradient Meter Bar with Active Indicator */}
            <div className="mt-5">
              <div
                className="relative h-4 w-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-60% to-emerald-500 shadow-inner"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampedScore}
                aria-label="Resume strength meter"
              >
                {/* Unfilled mask on the right so active level reads cleanly */}
                <div
                  className="absolute inset-y-0 right-0 rounded-r-full bg-slate-200/85 transition-all duration-500 dark:bg-slate-800/90"
                  style={{ width: `${100 - clampedScore}%` }}
                />
                {/* Needle / Thumb Marker */}
                <div
                  className={`absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow-md ring-2 transition-all duration-500 dark:border-slate-900 dark:bg-white ${tierStyles.ring}`}
                  style={{ left: `${Math.min(98, Math.max(2, clampedScore))}%` }}
                />
              </div>

              <div className="mt-2.5 grid grid-cols-4 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>Needs Polish (0–49)</span>
                <span className="text-center">Competitive (50–69)</span>
                <span className="text-center">Strong (70–84)</span>
                <span className="text-right">Elite (85–100)</span>
              </div>
            </div>

            {result.summary && (
              <p className="mt-4 border-t border-slate-200/80 pt-3.5 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
                {result.summary}
              </p>
            )}
          </div>

          {/* 4 Strength Dimensions */}
          <section aria-label="Strength dimensions">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
              Category Strength Breakdown
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.dimensions.map((dim) => {
                const pct = Math.min(100, Math.max(0, Math.round((dim.score / (dim.maxScore || 25)) * 100)));
                const dimBarColor =
                  pct >= 76 ? 'bg-emerald-500' : pct >= 52 ? 'bg-blue-500' : 'bg-amber-500';
                return (
                  <div
                    key={dim.key}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{dim.label}</span>
                      <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
                        {dim.score} / {dim.maxScore || 25}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${dimBarColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{dim.insight}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Standard Industry Keywords Audit */}
          <section aria-label="Standard industry keyword match" className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Matched Industry Keywords ({result.matchedKeywords.length})
              </h3>
              {result.matchedKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {result.matchedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No standard {result.industry} keywords detected yet.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                Missing Industry Keywords ({result.missingKeywords.length})
              </h3>
              {result.missingKeywords.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-amber-700/90 dark:text-amber-400/90">
                    Add these only where they accurately reflect your real projects or experience.
                  </p>
                </>
              ) : (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Great coverage — all primary benchmark keywords were found.
                </p>
              )}
            </div>
          </section>

          {/* Actionable Suggestions */}
          {result.suggestions.length > 0 && (
            <section aria-label="Actionable improvement suggestions" className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                Actionable Improvement Plan
              </h3>
              <div className="space-y-3">
                {result.suggestions.map((item, idx) => (
                  <div
                    key={`${item.title}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${getPriorityStyle(item.priority)}`}>
                        {item.priority}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h4>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
                    {item.exampleRewrite && (
                      <div className="mt-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Example bullet: </span>
                        “{item.exampleRewrite}”
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
