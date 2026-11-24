import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Lightbulb, X } from 'lucide-react';

interface DailyTip {
  id: string;
  focus: string;
  title: string;
  tip: string;
}

const DAILY_TIPS: DailyTip[] = [
  {
    id: 'star-result-first',
    focus: 'Behavioral',
    title: 'Lead with the outcome, then walk backward',
    tip: 'State the measurable result of your project in the first 15 seconds before unpacking technical details so interviewers immediately grasp your impact.',
  },
  {
    id: 'power-pause',
    focus: 'Vocal Delivery',
    title: 'Use a deliberate two-second pause',
    tip: 'Pause for two seconds after hearing a tough question to organize two key points in your head and eliminate filler words.',
  },
  {
    id: 'clarify-constraints',
    focus: 'Technical',
    title: 'Clarify scale before writing a single line',
    tip: 'Ask about expected input size, latency goals, and edge cases up front—interviewers treat structured scoping as a senior engineering signal.',
  },
  {
    id: 'quantify-claims',
    focus: 'Storytelling',
    title: 'Replace adjectives with numbers',
    tip: 'Swap vague phrases like "significantly faster" for concrete metrics such as "cut API p95 latency from 620ms to 140ms".',
  },
  {
    id: 'tradeoff-framing',
    focus: 'System Design',
    title: 'Name what you gave up',
    tip: 'Every architecture decision has a downside. Explicitly stating why you rejected an alternative proves practical production judgment.',
  },
  {
    id: 'concise-intro',
    focus: 'First Impressions',
    title: 'Keep your intro under 75 seconds',
    tip: 'Use Present-Past-Future: what you build today, one standout milestone, and why this exact team is your next step.',
  },
  {
    id: 'postmortem-ownership',
    focus: 'Leadership',
    title: 'Own failures without defensiveness',
    tip: 'When discussing a past mistake, spend 20% on what broke and 80% on the systemic safeguard you put in place afterward.',
  },
  {
    id: 'test-happy-edge',
    focus: 'Coding',
    title: 'Dry-run an empty and duplicate case',
    tip: 'Before saying "I am done," trace your code aloud with an empty input and a boundary value to catch off-by-one bugs early.',
  },
  {
    id: 'reverse-questions',
    focus: 'Closing Strong',
    title: 'Ask diagnostic questions at the end',
    tip: 'Ask what technical bottleneck the team is tackling this quarter—it shifts the conversation from candidate screening to peer problem-solving.',
  },
  {
    id: 'business-tie-in',
    focus: 'Product Sense',
    title: 'Connect engineering work to user value',
    tip: 'Tie refactors, tests, and observability improvements back to customer trust, conversion, or faster team release cycles.',
  },
  {
    id: 'i-dont-know-pivot',
    focus: 'Adaptability',
    title: 'Pivot cleanly from unfamiliar topics',
    tip: 'If you do not know a specific tool, state what you have used that solves a similar class of problem and how you would reason from first principles.',
  },
  {
    id: 'vocal-emphasis',
    focus: 'Communication',
    title: 'Slow down on key numbers and decisions',
    tip: 'Slightly lowering your pace and stressing key action verbs helps panels retain the core takeaway of longer answers.',
  },
  {
    id: 'STAR-learning',
    focus: 'Reflection',
    title: 'Close behavioral stories with what changed',
    tip: 'End every STAR story with a one-sentence lesson learned and how you applied that habit to your next project.',
  },
  {
    id: 'collaborative-pronouns',
    focus: 'Teamwork',
    title: 'Balance "we" context with "I" ownership',
    tip: 'Briefly credit the team for context, then clearly state the exact design, code, or decision that you personally drove.',
  },
];

export const DAILY_TIP_SESSION_KEY = 'intervyou_daily_tip_dismissed_session';
export const DAILY_TIP_DAY_KEY = 'intervyou_daily_tip_hidden_date';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDailyTipForToday(): DailyTip {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diffDays = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return DAILY_TIPS[Math.abs(diffDays) % DAILY_TIPS.length];
}

interface DailyInterviewTipToastProps {
  userIdentifier?: string;
}

export default function DailyInterviewTipToast({ userIdentifier }: DailyInterviewTipToastProps) {
  const [visible, setVisible] = useState(false);
  const dailyTip = useMemo(() => getDailyTipForToday(), []);
  const today = useMemo(() => getTodayDateString(), []);

  useEffect(() => {
    try {
      const dismissedSession = sessionStorage.getItem(DAILY_TIP_SESSION_KEY);
      const hiddenDate = localStorage.getItem(DAILY_TIP_DAY_KEY);
      if (dismissedSession === '1' || hiddenDate === today) {
        return;
      }
    } catch {
      // ignore storage errors and still show tip
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [today, userIdentifier]);

  const handleDismissSession = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DAILY_TIP_SESSION_KEY, '1');
    } catch {
      // ignore storage quota errors
    }
  };

  const handleHideForToday = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DAILY_TIP_SESSION_KEY, '1');
      localStorage.setItem(DAILY_TIP_DAY_KEY, today);
    } catch {
      // ignore storage quota errors
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          role="status"
          aria-live="polite"
          aria-label="Daily interview tip"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-5 right-5 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Lightbulb className="h-4.5 w-4.5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    Daily Interview Tip
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{dailyTip.focus}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDismissSession}
                  aria-label="Dismiss daily interview tip"
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <h3 className="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-white">
                {dailyTip.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {dailyTip.tip}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleHideForToday}
                  className="whitespace-nowrap shrink-0 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Hide for today
                </button>
                <div className="flex items-center gap-2">
                  <Link
                    to="/setup"
                    onClick={handleDismissSession}
                    className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    <span>Practice</span>
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={handleDismissSession}
                    className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
