import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Lightbulb,
  X,
} from 'lucide-react';
import { ResumeFileMetadata } from '../types';

interface QuickResumeTipsProps {
  isOpen: boolean;
  onClose: () => void;
  resumeText: string;
  resumeFile: ResumeFileMetadata | null;
  hasResume: boolean;
  onJumpToEditor?: () => void;
}

type TipCategory = 'all' | 'formatting' | 'keywords' | 'impact' | 'sections';

interface ResumeTip {
  id: string;
  category: Exclude<TipCategory, 'all'>;
  title: string;
  summary: string;
  avoid: string;
  recommended: string;
  copySnippet?: string;
  copyLabel?: string;
}

const ATS_TIPS: ResumeTip[] = [
  {
    id: 'single-column-layout',
    category: 'formatting',
    title: 'Use a clean single-column layout',
    summary:
      'ATS parsers scan documents strictly left-to-right, top-to-bottom. Multi-column tables, floating text boxes, and sidebar graphics frequently scramble reading order.',
    avoid: 'Two-column Canva templates, nested Word tables, or floating skill sidebars.',
    recommended: 'Standard top-to-bottom single-column flow with clear horizontal spacing.',
  },
  {
    id: 'selectable-file-format',
    category: 'formatting',
    title: 'Export as text-selectable PDF or DOCX',
    summary:
      'Image scans and flattened design exports contain zero extractable characters. Always verify you can highlight and copy every word before uploading.',
    avoid: 'Scanned PDFs, Photoshop/Canva raster exports, or legacy .doc formats.',
    recommended: 'Text-based .pdf or .docx generated directly from Google Docs, Word, or LaTeX.',
  },
  {
    id: 'standard-headings',
    category: 'sections',
    title: 'Stick to standard section headings',
    summary:
      'Automated parsers rely on predictable section titles to map your background into database fields. Creative headings can cause whole blocks of experience to be skipped.',
    avoid: '"My Career Story", "Where I Shine", or "Toolkit".',
    recommended: '"Professional Summary", "Technical Skills", "Work Experience", "Projects", "Education".',
    copySnippet:
      'PROFESSIONAL SUMMARY\n\nTECHNICAL SKILLS\n\nWORK EXPERIENCE\n\nPROJECTS\n\nEDUCATION',
    copyLabel: 'Copy standard headings',
  },
  {
    id: 'mirror-jd-keywords',
    category: 'keywords',
    title: 'Mirror exact keywords from the job post',
    summary:
      'Match both spelled-out terms and common acronyms from the target posting inside your skills and experience bullets rather than burying them in a disconnected tag block.',
    avoid: 'Listing only "CI/CD" or repeating buzzwords without context.',
    recommended: 'Write "CI/CD pipelines (GitHub Actions, Docker)" inside an actual project bullet.',
  },
  {
    id: 'xyz-quantified-bullets',
    category: 'impact',
    title: 'Lead bullets with action verbs and numbers',
    summary:
      'Rankings reward concrete outcomes over passive duties. Pair a strong past-tense verb with scale, latency, revenue, or percentage metrics.',
    avoid: '"Responsible for helping improve backend API performance."',
    recommended:
      '"Refactored PostgreSQL indexes and Redis caching, cutting p95 API latency by 38% across 120k daily requests."',
    copySnippet:
      '• [Action Verb] [System / Feature], resulting in [X% / $Y / N time saved] by implementing [Specific Tech Stack].',
    copyLabel: 'Copy XYZ bullet template',
  },
  {
    id: 'plain-text-symbols',
    category: 'formatting',
    title: 'Avoid skill bars, stars, and custom icons',
    summary:
      'Visual progress meters, star ratings, and icon fonts translate into broken characters or blank strings inside Workday, Greenhouse, and Taleo parsers.',
    avoid: 'Python ★★★★☆  |  React [■■■■□]  |  ☎ +1-555-0100',
    recommended: 'Languages: Python (Proficient), TypeScript (Proficient), SQL (Intermediate)',
  },
  {
    id: 'header-contact-hygiene',
    category: 'sections',
    title: 'Keep contact links in the main body, not headers',
    summary:
      'Some older ATS extractors skip content placed inside Word document header/footer regions. Keep your name, email, phone, and links in the top body block.',
    avoid: 'Placing email and phone inside a page header box or image banner.',
    recommended: 'City, State · email@domain.com · +1 (555) 010-2345 · linkedin.com/in/name · github.com/name',
    copySnippet:
      'Full Name\nCity, Country · email@example.com · +1 555-010-2345 · linkedin.com/in/username · github.com/username',
    copyLabel: 'Copy header format',
  },
  {
    id: 'consistent-dates',
    category: 'keywords',
    title: 'Use consistent Month YYYY date formats',
    summary:
      'Years-of-experience calculators parse date ranges automatically. Mixing seasons, abbreviations, or missing end dates lowers calculated tenure.',
    avoid: '"Summer 23 - Now" or "05/22 – Current"',
    recommended: '"May 2022 – Present" or "05/2022 – Present" consistently across every role.',
  },
];

const CATEGORY_TABS: Array<{ id: TipCategory; label: string }> = [
  { id: 'all', label: 'All Tips' },
  { id: 'formatting', label: 'Formatting' },
  { id: 'keywords', label: 'Keywords' },
  { id: 'impact', label: 'Impact' },
  { id: 'sections', label: 'Sections' },
];

export default function QuickResumeTips({
  isOpen,
  onClose,
  resumeText,
  resumeFile,
  hasResume,
  onJumpToEditor,
}: QuickResumeTipsProps) {
  const [activeCategory, setActiveCategory] = useState<TipCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const diagnostics = useMemo(() => {
    const trimmed = resumeText.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(trimmed);
    const hasPhone = /(?<!\d)(\+?\d[\d\s\-()]{8,}\d)(?!\d)/.test(trimmed);
    const hasMetrics = /\b\d+(%|\+|x|ms|s|k|m)?\b/i.test(trimmed);
    const hasCoreSections =
      /(skills|technologies)/i.test(trimmed) &&
      /(experience|projects|internship)/i.test(trimmed) &&
      /(education|degree|university|college)/i.test(trimmed);
    const hasTablePipesOrStars = /[★☆■□◆▪]/.test(trimmed) || /\|.*\|.*\|/.test(trimmed);

    const fileExtension = resumeFile?.name.split('.').pop()?.toLowerCase() || '';
    const fileOk = !resumeFile || ['pdf', 'docx', 'txt'].includes(fileExtension);

    const checks = [
      {
        id: 'file',
        label: 'ATS-friendly file format',
        passed: hasResume && fileOk,
        detail: !hasResume
          ? 'Upload a PDF or DOCX resume'
          : fileOk
          ? `${fileExtension ? fileExtension.toUpperCase() : 'Document'} format ready`
          : 'Legacy .doc may misparse — convert to PDF/DOCX',
      },
      {
        id: 'length',
        label: 'Optimal length (300–850 words)',
        passed: words >= 300 && words <= 850,
        detail:
          words === 0
            ? 'No extracted text found yet'
            : `${words} words detected`,
      },
      {
        id: 'sections',
        label: 'Standard section structure',
        passed: hasCoreSections,
        detail: hasCoreSections
          ? 'Skills, Experience/Projects, and Education detected'
          : 'Add clear Skills, Experience, and Education headings',
      },
      {
        id: 'metrics',
        label: 'Quantified impact & contact info',
        passed: hasMetrics && hasEmail && hasPhone,
        detail:
          hasMetrics && hasEmail && hasPhone
            ? 'Numbers and contact info verified'
            : !hasEmail || !hasPhone
            ? 'Include reachable email and phone in text'
            : 'Add %, latency, or scale numbers to bullets',
      },
      {
        id: 'symbols',
        label: 'Clean plain-text characters',
        passed: Boolean(trimmed) && !hasTablePipesOrStars,
        detail: hasTablePipesOrStars
          ? 'Remove rating stars or multi-column pipe tables'
          : trimmed
          ? 'No problematic rating glyphs detected'
          : 'Waiting for resume text',
      },
    ];

    const passedCount = checks.filter((c) => c.passed).length;
    return { words, checks, passedCount, totalChecks: checks.length };
  }, [resumeText, resumeFile, hasResume]);

  const visibleTips = useMemo(() => {
    if (activeCategory === 'all') return ATS_TIPS;
    return ATS_TIPS.filter((tip) => tip.category === activeCategory);
  }, [activeCategory]);

  const handleCopy = (id: string, text: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-resume-tips-title"
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
              <h2 id="quick-resume-tips-title" className="text-lg font-bold tracking-tight">
                Quick Resume Tips
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Actionable checklist and formatting rules to maximize ATS parsing accuracy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Resume Tips"
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Live Resume Quick Check */}
          <section aria-label="Live ATS quick check" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <h3 className="text-sm font-semibold">Live Resume Check</h3>
              </div>
              <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {diagnostics.passedCount}/{diagnostics.totalChecks} passed
                <span aria-hidden="true"> · </span>
                {diagnostics.words} words
              </span>
            </div>

            <ul className="mt-3 divide-y divide-slate-200/70 dark:divide-slate-800/80">
              {diagnostics.checks.map((check) => (
                <li key={check.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{check.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{check.detail}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold ${
                      check.passed
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {check.passed ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Pass
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Review
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Filter Tabs */}
          <div className="space-y-4">
            <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    activeCategory === tab.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Actionable Tips List */}
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {visibleTips.map((tip, index) => (
                <article key={tip.id} className="space-y-2.5 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      <span className="mr-1.5 font-mono text-xs tabular-nums text-blue-600 dark:text-blue-400">
                        0{index + 1}.
                      </span>
                      {tip.title}
                    </h4>
                    <span className="shrink-0 text-xs capitalize text-slate-400 dark:text-slate-500">
                      {tip.category}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{tip.summary}</p>

                  <div className="grid gap-2 pt-1 text-xs">
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-red-700 dark:text-red-400">Avoid: </span>
                      {tip.avoid}
                    </p>
                    <p className="text-slate-700 dark:text-slate-200">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Do: </span>
                      {tip.recommended}
                    </p>
                  </div>

                  {tip.copySnippet && tip.copyLabel && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(tip.id, tip.copySnippet!)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {copiedId === tip.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            <span>Copied to clipboard</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            <span>{tip.copyLabel}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60 sm:px-6">
          <a
            href="#ats-optimization-guide"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Full ATS Optimization Guide <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          {onJumpToEditor ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onJumpToEditor();
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
            >
              Edit Resume Text
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer"
            >
              Done
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
