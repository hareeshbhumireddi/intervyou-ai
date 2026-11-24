import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Target,
  Layers,
  Sparkles,
  ArrowRight,
  ListChecks,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

interface AtsOptimizationGuideProps {
  resumeText?: string;
  hasResume?: boolean;
}

interface Pitfall {
  id: string;
  title: string;
  category: 'layout' | 'content' | 'keywords' | 'formatting';
  severity: 'Critical' | 'High' | 'Moderate';
  issue: string;
  atsImpact: string;
  solution: string;
  badExample: string;
  goodExample: string;
}

interface ActionVerbCategory {
  category: string;
  verbs: string[];
}

const COMMON_PITFALLS: Pitfall[] = [
  {
    id: 'tables-columns',
    title: 'Multi-Column Tables & Text Boxes',
    category: 'layout',
    severity: 'Critical',
    issue: 'Using side-by-side columns, tables, or floating text boxes to fit more content.',
    atsImpact:
      'Parsers read horizontally across the page. Two-column layouts cause text from Column A to merge with Column B, producing gibberish sentences that fail keyword indexing.',
    solution:
      'Use a strict single-column layout with standard top-to-bottom reading order. Indent sub-items rather than splitting columns.',
    badExample: '| Skills: Python, SQL | Experience: Google | (columns merge in ATS)',
    goodExample: 'Technical Skills\n• Languages: Python, SQL, JavaScript\n\nExperience\n• Software Engineer — Google',
  },
  {
    id: 'creative-headers',
    title: 'Creative or Non-Standard Section Titles',
    category: 'layout',
    severity: 'Critical',
    issue: 'Using decorative headings like "Where I’ve Been", "My Journey", "What I Do Best", or "Toolbox".',
    atsImpact:
      'ATS algorithms use regex pattern matching to categorize sections. Unrecognized headers cause entire sections of experience and skills to be completely discarded.',
    solution:
      'Stick to industry-standard headings: "Professional Summary", "Technical Skills", "Work Experience" (or "Internship Experience"), "Key Projects", "Education", "Certifications".',
    badExample: '### My Journey\nTrigint Solutions — Junior Developer',
    goodExample: '### Internship Experience\nTrigint Solutions — Junior AI Developer',
  },
  {
    id: 'missing-metrics',
    title: 'Duty-Based Bullets Without Measurable Metrics',
    category: 'content',
    severity: 'High',
    issue: 'Listing generic responsibilities ("Worked on backend APIs", "Responsible for testing") with zero quantifiable outcomes.',
    atsImpact:
      'Modern ATS platforms and recruiter review algorithms rank candidate bullets based on impact density and number detection. Resumes lacking numbers fall into the lowest score bracket.',
    solution:
      'Apply Google’s XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]". Include percentages, latency drops, user counts, or time saved.',
    badExample: '• Worked on improving API response times and resolved database bugs.',
    goodExample: '• Optimized PostgreSQL queries and caching layers, decreasing API response latency by 35% across 20+ endpoints.',
  },
  {
    id: 'keyword-stuffing',
    title: 'Keyword Stuffing & Hidden White Text',
    category: 'keywords',
    severity: 'Critical',
    issue: 'Dumping huge blocks of repeated buzzwords, or hiding keywords in 1pt white font in headers/footers.',
    atsImpact:
      'Modern ATS parsers (Workday, Lever, Greenhouse) detect keyword frequency anomalies and unformatted token clusters, triggering automatic spam/fraud rejection flags.',
    solution:
      'Integrate keywords naturally into your Technical Skills list and validate each one inside a bullet point showing real application.',
    badExample: 'python python python react react api sql docker kubernetes aws microservices (invisible or comma soup)',
    goodExample: '• Built responsive data dashboards using React, TypeScript, and Tailwind CSS connected to Python FastAPI microservices.',
  },
  {
    id: 'skills-graphic-bars',
    title: 'Graphic Skill Ratings & Progress Bars',
    category: 'formatting',
    severity: 'High',
    issue: 'Using graphic stars, rating bars (e.g., "Python: 4/5 stars"), or visual icons for proficiency.',
    atsImpact:
      'Parsers cannot read raster images or CSS progress bars. The skill name might parse without proficiency, or get dropped entirely as an unreadable glyph.',
    solution:
      'Group skills by category into plain text lines (e.g. Languages, Frameworks, Tools) or indicate standard tiers: Proficient, Familiar.',
    badExample: 'Python: ★★★★☆ | Docker: ★★★☆☆ | SQL: ★★★★★',
    goodExample: '• Programming Languages: Python, Java, SQL, JavaScript, TypeScript\n• Frameworks: Spring Boot, Express.js, React',
  },
  {
    id: 'unparseable-formats',
    title: 'Image-Based PDFs & Canvas Scans',
    category: 'formatting',
    severity: 'Critical',
    issue: 'Exporting resumes as flattened canvas graphics from tools like Photoshop, Canva, or screenshot PDFs.',
    atsImpact:
      'If you cannot highlight and copy text with your mouse cursor, the ATS cannot extract words either. The parser records 0 words and automatically marks the resume as blank.',
    solution:
      'Always export directly from Google Docs, Word, or LaTeX as a text-selectable PDF or .docx. Always test by copying text from the final PDF.',
    badExample: 'Scanned image PDF or Canva graphic without an embedded font/text layer.',
    goodExample: 'Vector text PDF created in Google Docs or Microsoft Word with selectable text.',
  },
  {
    id: 'missing-contact-links',
    title: 'Missing or Malformed Contact Links',
    category: 'content',
    severity: 'Moderate',
    issue: 'Providing only raw names without live LinkedIn, GitHub, or portfolio URLs, or burying links in complex header shapes.',
    atsImpact:
      'Recruiters filter candidate databases by profile link presence. Missing GitHub/portfolio reduces technical verification trust.',
    solution:
      'Place phone number, professional email, location (City, State), and full hyperlinked URLs (linkedin.com/in/... and github.com/...) in the header line.',
    badExample: 'Contact: Reach me on LinkedIn or DM on Twitter.',
    goodExample: 'hareesh@example.com · +91 93909 54971 · linkedin.com/in/username · github.com/username',
  },
];

const ACTION_VERBS: ActionVerbCategory[] = [
  {
    category: 'Architected & Built',
    verbs: ['Architected', 'Engineered', 'Developed', 'Constructed', 'Implemented', 'Designed', 'Synthesized', 'Deployed', 'Configured'],
  },
  {
    category: 'Optimized & Scaled',
    verbs: ['Accelerated', 'Streamlined', 'Decreased', 'Maximized', 'Refactored', 'Enhanced', 'Consolidated', 'Automated', 'Standardized'],
  },
  {
    category: 'Tested & Maintained',
    verbs: ['Audited', 'Debugged', 'Validated', 'Verified', 'Troubleshot', 'Monitored', 'Secured', 'Documented', 'Overhauled'],
  },
  {
    category: 'Led & Collaborated',
    verbs: ['Spearheaded', 'Coordinated', 'Mentored', 'Championed', 'Orchestrated', 'Delivered', 'Partnered', 'Facilitated'],
  },
];

const BULLET_EXAMPLES = [
  {
    role: 'Full Stack & Backend Developer',
    before: 'Worked on database queries and improved website speed for customers.',
    after:
      'Architected 8 normalized PostgreSQL tables with 20+ stored procedures and triggers, cutting data query latency by 42% and eliminating timeout bottlenecks.',
    breakdown: 'Specifies exact scale (8 tables, 20+ stored procedures), metric (42% latency cut), and business outcome (eliminated timeouts).',
  },
  {
    role: 'AI / ML Engineer',
    before: 'Used machine learning models to help classify documents and images.',
    after:
      'Integrated Google Gemini and TensorFlow OCR pipelines to automate invoice parsing, achieving 94% classification accuracy across 5,000+ monthly documents.',
    breakdown: 'Highlights precise tech stack (Gemini, TensorFlow), accuracy benchmark (94%), and operational volume (5,000+ docs/mo).',
  },
  {
    role: 'Junior / College Student Project',
    before: 'Created a college management portal with login and database for class project.',
    after:
      'Built full-stack College Management Portal using React, TypeScript, and Spring Boot with role-based access control (RBAC) supporting 3 distinct user roles.',
    breakdown: 'Demonstrates security architecture (RBAC) and clean tech stack instead of vague student phrasing.',
  },
];

export default function AtsOptimizationGuide({ resumeText = '', hasResume = false }: AtsOptimizationGuideProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'layout' | 'content' | 'keywords' | 'formatting'>('all');
  const [expandedPitfall, setExpandedPitfall] = useState<string | null>(COMMON_PITFALLS[0].id);
  const [copiedVerb, setCopiedVerb] = useState<string | null>(null);

  // Dynamic checks based on user's actual resume text
  const checklist = useMemo(() => {
    const text = resumeText || '';
    const textLower = text.toLowerCase();

    const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text);
    const hasPhone = /(?<!\d)(\+?\d[\d\s\-()]{8,}\d)(?!\d)/.test(text);
    const hasLinks = /(linkedin\.com|github\.com|portfolio|https?:\/\/)/i.test(text);
    const hasNumbers = /\b\d+(%|\+)?\b/.test(text);
    const hasExperience = /(experience|internship|employment|history)/i.test(text);
    const hasSkills = /(skills|technologies|competencies)/i.test(text);
    const hasEducation = /(education|academic|degree|bachelor|master|institute)/i.test(text);
    const hasProjects = /(projects|portfolio)/i.test(text);

    return [
      {
        id: 'contact',
        title: 'Complete Header Contact Details',
        desc: 'Professional email, reachable phone number, and location (City, Country).',
        passed: hasEmail && hasPhone,
        hint: !hasEmail ? 'Add your email address' : !hasPhone ? 'Add your phone number' : 'Contact details detected.',
      },
      {
        id: 'links',
        title: 'Clickable Profile Links',
        desc: 'Include GitHub, LinkedIn, or portfolio URLs to prove hands-on credibility.',
        passed: hasLinks,
        hint: hasLinks ? 'Portfolio / LinkedIn / GitHub links detected.' : 'Add your LinkedIn or GitHub profile link.',
      },
      {
        id: 'standard-headers',
        title: 'Canonical Section Headings',
        desc: 'Sections clearly named "Technical Skills", "Experience", "Projects", "Education".',
        passed: hasSkills && (hasExperience || hasProjects) && hasEducation,
        hint:
          hasSkills && (hasExperience || hasProjects) && hasEducation
            ? 'Standard headings detected.'
            : 'Ensure you have separate Skills, Experience/Projects, and Education headings.',
      },
      {
        id: 'quantified-metrics',
        title: 'Quantified Metrics in Bullets',
        desc: 'Numbers, percentages, timeframes, or scale indicators (e.g. 35%, 10k+, 50ms).',
        passed: hasNumbers,
        hint: hasNumbers
          ? 'Quantified metrics detected in text.'
          : 'Add specific percentages, team sizes, or performance numbers to your bullets.',
      },
      {
        id: 'action-verbs',
        title: 'Strong Action Verbs Lead Bullets',
        desc: 'Start each bullet with past-tense power verbs (Architected, Developed, Reduced).',
        passed: /(developed|architected|built|engineered|implemented|designed|created|optimized|integrated)/i.test(text),
        hint: 'Use strong verbs like Engineered, Spearheaded, Accelerated rather than "Helped" or "Worked on".',
      },
      {
        id: 'clean-layout',
        title: 'Single-Column Text Layout',
        desc: 'No complex tables, multi-column blocks, or embedded icons that confuse parsers.',
        passed: true,
        hint: 'Keep resume in single-column layout for highest parsing fidelity.',
      },
    ];
  }, [resumeText]);

  const passedCount = checklist.filter((item) => item.passed).length;
  const readinessPercent = Math.round((passedCount / checklist.length) * 100);

  const filteredPitfalls = useMemo(() => {
    if (activeTab === 'all') return COMMON_PITFALLS;
    return COMMON_PITFALLS.filter((p) => p.category === activeTab);
  }, [activeTab]);

  const handleCopyVerb = (verb: string) => {
    void navigator.clipboard.writeText(verb);
    setCopiedVerb(verb);
    setTimeout(() => setCopiedVerb(null), 2000);
  };

  return (
    <section className="space-y-6" aria-labelledby="ats-guide-heading">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 id="ats-guide-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
                ATS Optimization Guide
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Master how Applicant Tracking Systems (Workday, Greenhouse, Lever, Taleo) evaluate your resume. Avoid hidden
              filtering traps and structure your achievements for top ranking.
            </p>
          </div>

          {/* Quick Readiness Badge */}
          {hasResume && (
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-xs font-semibold text-slate-500">Resume Compliance</p>
                <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {readinessPercent}% <span className="text-xs font-normal text-slate-500">({passedCount}/{checklist.length} checks)</span>
                </p>
              </div>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${
                  readinessPercent >= 80 ? 'bg-emerald-600' : readinessPercent >= 50 ? 'bg-blue-600' : 'bg-amber-600'
                }`}
              >
                {readinessPercent >= 80 ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Resume Health Checklist */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">ATS Readiness Checklist</h3>
          </div>
          <span className="text-xs text-slate-500">
            {hasResume ? 'Automatically verified against your active resume text' : 'Live guidelines for resume building'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-lg border p-3.5 transition-colors ${
                hasResume && item.passed
                  ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/10'
                  : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h4>
                  {hasResume && (
                    item.passed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    )
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
              <p
                className={`mt-2 text-[11px] font-medium ${
                  hasResume && item.passed
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {item.hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Common Resume Pitfalls Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Critical ATS Pitfalls & How to Avoid Them</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Over 70% of resumes are filtered out due to these easily preventable layout and phrasing mistakes.
            </p>
          </div>

          {/* Category Filter Controls */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'all', label: 'All Pitfalls' },
                { id: 'layout', label: 'Layout' },
                { id: 'content', label: 'Content' },
                { id: 'keywords', label: 'Keywords' },
                { id: 'formatting', label: 'Formatting' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pitfalls Accordion / Cards */}
        <div className="mt-5 space-y-3">
          {filteredPitfalls.map((pitfall) => {
            const isExpanded = expandedPitfall === pitfall.id;
            return (
              <div
                key={pitfall.id}
                className="overflow-hidden rounded-lg border border-slate-200 transition-colors dark:border-slate-800"
              >
                <button
                  onClick={() => setExpandedPitfall(isExpanded ? null : pitfall.id)}
                  className="flex w-full items-center justify-between gap-3 bg-slate-50/70 p-4 text-left transition-colors hover:bg-slate-100/70 dark:bg-slate-900/60 dark:hover:bg-slate-800/60"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold ${
                        pitfall.severity === 'Critical'
                          ? 'text-red-600 dark:text-red-400'
                          : pitfall.severity === 'High'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {pitfall.severity}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{pitfall.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">The Problem</p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{pitfall.issue}</p>
                    </div>

                    <div className="rounded-lg bg-amber-50/60 p-3.5 dark:bg-amber-950/20">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Why ATS Parsers Penalize This</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-900 dark:text-amber-200">{pitfall.atsImpact}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Actionable Solution</p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{pitfall.solution}</p>
                    </div>

                    {/* Side-by-Side Comparison */}
                    <div className="grid gap-3 pt-2 md:grid-cols-2">
                      <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 dark:border-red-950 dark:bg-red-950/10">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> Avoid This
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-red-900 dark:text-red-200">
                          {pitfall.badExample}
                        </pre>
                      </div>

                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 dark:border-emerald-950 dark:bg-emerald-950/10">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> High-Scoring Alternative
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-emerald-900 dark:text-emerald-200">
                          {pitfall.goodExample}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Google XYZ Formula & Bullet Point Transformation */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              The Google XYZ Formula for High ATS Scoring
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Automated parsers rank resumes highest when bullet points pair action verbs with measurable metrics and concrete technology.
          </p>
        </div>

        {/* The Formula Breakdown */}
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <p className="text-center text-sm font-semibold text-indigo-950 dark:text-indigo-200">
            “Accomplished <span className="text-blue-600 dark:text-blue-400">[X]</span>, as measured by{' '}
            <span className="text-emerald-600 dark:text-emerald-400">[Y]</span>, by doing{' '}
            <span className="text-purple-600 dark:text-purple-400">[Z]</span>”
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            <div className="rounded bg-white p-2.5 shadow-sm dark:bg-slate-900">
              <span className="font-bold text-blue-600 dark:text-blue-400">[X] Clear Outcome:</span> What project, feature, or result was delivered?
            </div>
            <div className="rounded bg-white p-2.5 shadow-sm dark:bg-slate-900">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">[Y] Measurable Metric:</span> By how many %, ms latency, or active users?
            </div>
            <div className="rounded bg-white p-2.5 shadow-sm dark:bg-slate-900">
              <span className="font-bold text-purple-600 dark:text-purple-400">[Z] Specific Method:</span> What tools, languages, or architectural patterns?
            </div>
          </div>
        </div>

        {/* Real Transformation Examples */}
        <div className="mt-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500">Real-World Before & After Transformations</p>
          {BULLET_EXAMPLES.map((example, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Role Focus:</span>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{example.role}</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded border border-red-100 bg-red-50/20 p-3 dark:border-red-950/40 dark:bg-red-950/10">
                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">Weak / Generic Bullet (Low Score)</span>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{example.before}</p>
                </div>
                <div className="rounded border border-emerald-100 bg-emerald-50/20 p-3 dark:border-emerald-950/40 dark:bg-emerald-950/10">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">ATS Optimized (High Score)</span>
                  <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">{example.after}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Why it scores higher:</span> {example.breakdown}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* High-Impact Action Verbs Bank */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              High-Impact ATS Action Verbs
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Click any verb to copy it directly to your clipboard for quick insertion into your resume text.
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACTION_VERBS.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500">{group.category}</h4>
              <div className="flex flex-wrap gap-1.5">
                {group.verbs.map((verb) => (
                  <button
                    key={verb}
                    onClick={() => handleCopyVerb(verb)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-950/40"
                    title={`Click to copy "${verb}"`}
                  >
                    {copiedVerb === verb ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-slate-400" />
                    )}
                    {verb}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canonical Headings & Standard Typography Rules */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
          <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Standard ATS Heading Conventions & Formatting Rules
          </h3>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500">Required Standard Headings</h4>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Professional Summary</span>
                <span className="text-slate-500">or Profile / Objective</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Technical Skills</span>
                <span className="text-slate-500">or Core Competencies</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Work Experience</span>
                <span className="text-slate-500">or Internship Experience</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Key Projects</span>
                <span className="text-slate-500">or Academic Projects</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Education</span>
                <span className="text-slate-500">Degree, Major, Institution, Year</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Certifications</span>
                <span className="text-slate-500">or Achievements</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500">Technical Formatting Standards</h4>
            <ul className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>File Type:</strong> PDF or .docx. Always verify text can be selected with mouse cursor.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Font Size & Family:</strong> Standard fonts (Calibri, Arial, Plus Jakarta Sans). Body 10–11pt, Headings 13–15pt.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Length:</strong> 1 full page for early-career/graduates (&lt; 5 years), 2 pages for senior staff.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span><strong>Bullets:</strong> Standard circular bullets (`•`) or hyphens (`-`). Avoid arrow or checkmark emojis.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
