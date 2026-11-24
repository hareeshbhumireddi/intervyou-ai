import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, FileText, Menu, MessageSquare, Mic, Sparkles, Target, X } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { Brand, LinkButton, buttonClass } from '../components/ui';

const NAV = [
  { label: 'Home', href: '#top' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
];

// Only capabilities that exist in the app today.
const FEATURES = [
  { icon: MessageSquare, title: 'Mock interviews', body: 'Practise one question at a time for the role and difficulty you choose, in Government or Private sector tracks.' },
  { icon: Target, title: 'Technical & HR preparation', body: 'Role-specific, behavioural and situational questions generated for your target position.' },
  { icon: Sparkles, title: 'AI feedback', body: 'Every answer is scored with strengths, weaknesses and an improved sample answer.' },
  { icon: FileText, title: 'Resume-based questions', body: 'Upload your resume and get questions drawn from your own experience.' },
  { icon: Mic, title: 'Voice practice', body: 'Hear questions read aloud and answer by speaking in English, Hindi or Telugu (browser support varies).' },
  { icon: BarChart3, title: 'Performance tracking', body: 'Saved reports, interview history and score trends built from your real sessions.' },
];

const STEPS = [
  { title: 'Create your account', body: 'Register once with your details and sign in any time.' },
  { title: 'Set up an interview', body: 'Pick a role, difficulty and number of questions, optionally with your resume.' },
  { title: 'Answer and get feedback', body: 'Type or speak each answer and see feedback straight away.' },
  { title: 'Review your report', body: 'See your score, skill gaps and next steps, and compare sessions over time.' },
];

export default function Landing() {
  const { isAuthenticated, authReady } = useAppState();
  const [open, setOpen] = useState(false);

  // The page is rendered by React after load, so the browser's own #hash scroll has
  // already run and found nothing. Scroll to the section once it exists so deep
  // links and refreshes on /#features keep working.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  const actions = !authReady ? null : isAuthenticated ? (
    <LinkButton to="/dashboard">Go to dashboard</LinkButton>
  ) : (
    <>
      <Link to="/login" className={buttonClass('ghost')}>Login</Link>
      <LinkButton to="/onboarding">Get Started</LinkButton>
    </>
  );

  return (
    <div id="top" className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">{item.label}</a>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex" data-testid="header-actions">{actions}</div>
          <button type="button" className="rounded-lg p-2 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div id="mobile-menu" className="border-t border-slate-200 px-4 py-4 dark:border-slate-800 md:hidden">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {NAV.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800">{item.label}</a>)}
            </nav>
            <div className="mt-3 flex flex-col gap-2 [&>a]:w-full">{actions}</div>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-100">AI interview preparation</p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Practise real interviews. Get honest feedback. Improve every round.</h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">Intervyou AI runs role-specific mock interviews, scores every answer and keeps a report of your progress, so you walk into the real interview prepared.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {authReady && isAuthenticated ? (
                <>
                  <LinkButton to="/setup" className="px-6 py-3 text-base">Continue practising</LinkButton>
                  <LinkButton to="/dashboard" variant="secondary" className="px-6 py-3 text-base">Dashboard</LinkButton>
                </>
              ) : (
                <>
                  <LinkButton to="/onboarding" className="px-6 py-3 text-base">Start practising</LinkButton>
                  <LinkButton to="/login" variant="secondary" className="px-6 py-3 text-base">Sign in</LinkButton>
                  <a href="#features" className={buttonClass('ghost') + ' px-6 py-3 text-base'}>Explore features</a>
                </>
              )}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold">Everything you need to prepare</h2>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">Built around the way people actually prepare: practise, get feedback, review, repeat.</p>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-100"><Icon className="h-5 w-5" aria-hidden /></span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold">How it works</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-bold text-white" aria-hidden>{i + 1}</span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {!(authReady && isAuthenticated) && (
          <section className="bg-brand-600 py-14 text-white">
            <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
              <h2 className="text-2xl font-bold sm:text-3xl">Ready for your next interview?</h2>
              <div className="flex gap-3">
                <Link to="/onboarding" className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">Create free account</Link>
                <Link to="/login" className="rounded-lg border border-white/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Login</Link>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Intervyou AI</span>
          <span>AI interview preparation platform</span>
        </div>
      </footer>
    </div>
  );
}
