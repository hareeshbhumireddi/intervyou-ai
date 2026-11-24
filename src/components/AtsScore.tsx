import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Lightbulb, Loader2, ScanSearch, XCircle } from 'lucide-react';
import { ApiError, api } from '../utils/api';
import type { AtsResult } from '../utils/api';
import { Alert, Button, Card, TextAreaField, TextField } from './ui';

const tone = (score: number) => (score >= 80 ? 'text-green-600' : score >= 65 ? 'text-blue-600' : score >= 50 ? 'text-amber-600' : 'text-red-600');
const barTone = (ratio: number) => (ratio >= 0.8 ? 'bg-green-500' : ratio >= 0.55 ? 'bg-blue-500' : ratio >= 0.35 ? 'bg-amber-500' : 'bg-red-500');

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative h-36 w-36 shrink-0" role="img" aria-label={`ATS score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
          className={`transition-all ${score >= 80 ? 'stroke-green-500' : score >= 65 ? 'stroke-blue-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500'}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span data-testid="ats-score" className={`text-4xl font-extrabold ${tone(score)}`}>{score}</span>
        <span className="text-xs text-slate-500">out of 100</span>
      </div>
    </div>
  );
}

export default function AtsScore({
  hasResume,
  resumeText,
  initialRole,
}: {
  hasResume: boolean;
  resumeText?: string;
  initialRole?: string;
}) {
  const [role, setRole] = useState(initialRole || 'Python Developer');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<AtsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasTriggeredInitial, setHasTriggeredInitial] = useState(false);

  const analyse = async (targetRole = role, targetJd = jobDescription, customText = resumeText) => {
    setLoading(true);
    setError('');
    try {
      const { ats } = await api.analyzeResume({
        role: targetRole.trim(),
        jobDescription: targetJd.trim(),
        text: customText?.trim() || undefined,
      });
      setResult(ats);
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'The resume could not be analysed.');
    } finally {
      setLoading(false);
    }
  };

  // Automatically trigger accurate ATS scoring if resume is present
  useEffect(() => {
    if (hasResume && !hasTriggeredInitial && !result && !loading) {
      setHasTriggeredInitial(true);
      void analyse(role, jobDescription, resumeText);
    }
  }, [hasResume, hasTriggeredInitial, result, loading, role, jobDescription, resumeText]);

  return (
    <Card className="space-y-6" >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><ScanSearch className="h-5 w-5 text-blue-600" aria-hidden /> ATS score</h2>
          <p className="mt-1 text-sm text-slate-500">
            See how well your resume is likely to pass automated screening. Paste a job description to measure keyword match against that specific role.
          </p>
        </div>
        <a
          href="#ats-optimization-guide"
          className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          <BookOpen className="h-4 w-4" /> Optimization Guide
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Target role (optional)" placeholder="e.g. Backend Developer" value={role} onChange={(e) => setRole(e.target.value)} hint="Used when no job description is pasted." />
        <TextAreaField label="Job description (optional)" placeholder="Paste the job posting here for a precise keyword match" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} maxLength={10000} />
      </div>

      {!hasResume && <Alert tone="info">Upload your resume above to get your ATS score.</Alert>}
      <div>
        <Button onClick={() => { void analyse(role, jobDescription, resumeText); }} loading={loading} disabled={!hasResume}>{loading ? 'Analysing…' : result ? 'Analyse again' : 'Analyse my resume'}</Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}

      {loading && !result && <div role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your resume…</div>}

      {result && (
        <div className="space-y-8" data-testid="ats-result">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ScoreRing score={result.score} />
            <div>
              <p className={`text-2xl font-bold ${tone(result.score)}`}>{result.grade}</p>
              <p className="mt-1 text-sm text-slate-500">{result.stats.words} words · {result.stats.bullets} bullet points · keywords matched against {result.keywordSource}.</p>
              <p className="mt-2 text-xs text-slate-500">{result.disclaimer}</p>
            </div>
          </div>

          <section aria-label="Score breakdown" className="space-y-4">
            <h3 className="font-semibold">How your score is made up</h3>
            {result.breakdown.map((c) => (
              <div key={c.name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular-nums text-slate-500">{c.earned}/{c.weight}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuemin={0} aria-valuemax={c.weight} aria-valuenow={c.earned} aria-label={c.name}>
                  <div className={`h-full rounded-full ${barTone(c.earned / c.weight)}`} style={{ width: `${(c.earned / c.weight) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{c.note}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section aria-label="Matched keywords">
              <h3 className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> Keywords found ({result.matchedKeywords.length})</h3>
              <ul className="flex flex-wrap gap-2">
                {result.matchedKeywords.length ? result.matchedKeywords.map((k) => <li key={k} className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">{k}</li>) : <li className="text-sm text-slate-500">None found.</li>}
              </ul>
            </section>
            <section aria-label="Missing keywords">
              <h3 className="mb-2 flex items-center gap-2 font-semibold"><XCircle className="h-4 w-4 text-red-600" aria-hidden /> Keywords missing ({result.missingKeywords.length})</h3>
              <ul className="flex flex-wrap gap-2">
                {result.missingKeywords.length ? result.missingKeywords.map((k) => <li key={k} className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{k}</li>) : <li className="text-sm text-slate-500">Nothing missing.</li>}
              </ul>
              {result.missingKeywords.length > 0 && <p className="mt-2 text-xs text-slate-500">Only add a keyword if it is true for you.</p>}
            </section>
          </div>

          {result.suggestions.length > 0 && (
            <section aria-label="How to improve">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> How to improve</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
                {result.suggestions.map((s) => <li key={s}>{s}</li>)}
              </ol>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <a
                  href="#ats-optimization-guide"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Consult the ATS Optimization Guide below for detailed formulas, pitfalls, and action verbs →
                </a>
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
