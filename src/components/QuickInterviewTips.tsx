import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Shuffle, Copy, Check, ArrowRight, Sparkles, MessageSquareQuote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface InterviewTip {
  id: string;
  category: string;
  title: string;
  insight: string;
  examplePhrase: string;
  actionableStep: string;
}

export const INTERVIEW_TIPS: InterviewTip[] = [
  {
    id: 'star-method',
    category: 'Behavioral Strategy',
    title: 'The STAR+L Framework for Behavioral Questions',
    insight:
      'Structure every story using Situation, Task, Action, Result — plus Learning. High-scoring candidates always finish by reflecting on what the experience taught them and how it informed subsequent projects.',
    examplePhrase:
      '“That experience taught me to decouple background jobs early, which later prevented latency spikes during our next major release.”',
    actionableStep: 'Keep the Situation and Task brief (20%), spend 60% on your specific Actions, and 20% on measurable Results.',
  },
  {
    id: 'unknown-questions',
    category: 'Handling Difficult Questions',
    title: 'The "I Don’t Know" Pivot Method',
    insight:
      'Never guess blindly or freeze. Acknowledge the boundary of your knowledge, outline how you would investigate, and reason through first principles from related concepts you know.',
    examplePhrase:
      '“I haven’t configured Kafka clustering in production yet, but based on pub/sub architectures and message queue brokers like RabbitMQ, here is how I would design the retry queue...”',
    actionableStep: 'Demonstrate your troubleshooting trajectory and curiosity rather than pretending to know an unfamiliar tool.',
  },
  {
    id: 'tell-me-about-yourself',
    category: 'First Impressions',
    title: 'The Present-Past-Future Formula for Introductions',
    insight:
      'When asked "Tell me about yourself", avoid reciting your resume chronologically. Spend 20 seconds on your current technical focus, 30 seconds on standout achievements, and 20 seconds on why this exact role is your logical next step.',
    examplePhrase:
      '“Currently, I focus on building reliable full-stack applications with Python and React. Most recently, I optimized API pipelines... and I’m eager to bring that scalability focus to your team.”',
    actionableStep: 'Keep your answer strictly under 75 seconds to maintain high conversational engagement.',
  },
  {
    id: 'think-out-loud',
    category: 'Technical & System Design',
    title: 'Narrate Your Thought Process Before Writing Code',
    insight:
      'In technical interviews, interviewers evaluate your reasoning trajectory over immediate syntax perfection. Clarify ambiguous requirements, state edge cases, and compare time/space trade-offs out loud.',
    examplePhrase:
      '“Before diving into the implementation, let’s clarify the input scale. If the array contains negative numbers, the greedy approach fails, so an O(N) hash map is safer here.”',
    actionableStep: 'Ask at least two clarifying questions before writing the first line of code or drawing a block diagram.',
  },
  {
    id: 'reverse-questions',
    category: 'Closing Strong',
    title: 'Ask High-Impact Reverse Questions',
    insight:
      'Generic questions like "What is the culture like?" leave a forgettable impression. Ask questions that show you are already mentally diagnosing their engineering and business challenges.',
    examplePhrase:
      '“What is the most significant technical debt or architectural bottleneck the engineering team tackled this past quarter, and how did you prioritize it?”',
    actionableStep: 'Prepare 3 specific questions tailored to the company’s recent tech blog posts or public engineering initiatives.',
  },
  {
    id: 'power-pause',
    category: 'Executive Presence & Vocal Delivery',
    title: 'The Two-Second Power Pause',
    insight:
      'Answering instantly often leads to filler words like "um" and disjointed thoughts. Taking a deliberate 2-second pause makes you sound composed, measured, and senior.',
    examplePhrase:
      '“That is a great question. Let me break down the two primary trade-offs we evaluated...”',
    actionableStep: 'Take a deep breath and smile slightly before beginning your response to reset your pacing.',
  },
  {
    id: 'quantify-metrics',
    category: 'Impact & Storytelling',
    title: 'Anchor Every Achievement to a Tangible Metric',
    insight:
      'Vague claims like "I improved speed" are easily discounted by evaluators. Pair technical actions with specific percentages, latencies, user volumes, or hours saved.',
    examplePhrase:
      '“We noticed query bottlenecks during peak traffic, so I indexed the lookup tables and added caching, reducing P95 latency from 820ms to 140ms.”',
    actionableStep: 'If exact metrics were not recorded, estimate conservatively using volume or scale (e.g., "across 15+ microservices").',
  },
  {
    id: 'connect-to-business',
    category: 'Business Alignment',
    title: 'Bridge Technical Decisions to Business Value',
    insight:
      'Engineers who understand the bottom line stand out dramatically. Always connect refactoring, testing, and architecture back to customer retention, operational cost, or developer velocity.',
    examplePhrase:
      '“Automating our integration test suite cut deployment verification time from 40 minutes to 6 minutes, allowing the product team to ship urgent bug fixes on the same day.”',
    actionableStep: 'Ask yourself "So what?" for every technical bullet point until you arrive at a business outcome.',
  },
  {
    id: 'government-board',
    category: 'Government & Administrative Interviews',
    title: 'Demonstrate Impartiality & Procedural Integrity',
    insight:
      'In public sector and government board interviews, panel members look for adherence to administrative rules, constitutional ethics, and balanced judgment over informal risk-taking.',
    examplePhrase:
      '“In public administration, my highest priority is maintaining strict compliance with official statutory guidelines while ensuring transparency and timely service delivery to citizens.”',
    actionableStep: 'Emphasize structured consensus, stakeholder consultations, and institutional documentation.',
  },
  {
    id: 'salary-anchoring',
    category: 'Negotiation Strategy',
    title: 'Anchor Early Compensation Conversations to Market Data',
    insight:
      'When asked about salary expectations early in the process, avoid pinning yourself to a rigid single number. Anchor your range to validated market benchmarks and scope of impact.',
    examplePhrase:
      '“Based on current market benchmarks for full-stack developers with my expertise in scalable web systems, I am targeting a range of [X to Y], though total growth and team impact are my priority.”',
    actionableStep: 'Research salary ranges on multiple compensation databases before the first phone screen.',
  },
];

export interface QuickInterviewTipsProps {
  variant?: 'card' | 'full';
}

export default function QuickInterviewTips({ variant = 'full' }: QuickInterviewTipsProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Pick a new random tip on each session / page visit
    const randomIndex = Math.floor(Math.random() * INTERVIEW_TIPS.length);
    setCurrentTipIndex(randomIndex);
  }, []);

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % INTERVIEW_TIPS.length);
    setCopied(false);
  };

  const currentTip = INTERVIEW_TIPS[currentTipIndex] || INTERVIEW_TIPS[0];

  const handleCopyPhrase = () => {
    void navigator.clipboard.writeText(currentTip.examplePhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'card') {
    return (
      <section
        aria-labelledby="quick-tips-card-heading"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between h-full sm:p-7"
      >
        <div>
          {/* Card Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 id="quick-tips-card-heading" className="text-base font-bold text-slate-900 dark:text-white">
                  Quick Tips
                </h3>
                <p className="text-xs text-slate-500">{currentTip.category}</p>
              </div>
            </div>

            <button
              onClick={handleNextTip}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Next coaching tip"
            >
              <Shuffle className="h-3 w-3 text-slate-500" />
              <span>Next</span>
            </button>
          </div>

          {/* Card Animated Tip Body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTip.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="mt-4 space-y-3"
            >
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {currentTip.title}
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                  {currentTip.insight}
                </p>
              </div>

              {/* Script Box */}
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 p-3 dark:border-blue-900/40 dark:from-blue-950/20 dark:to-slate-900">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    <MessageSquareQuote className="h-3.5 w-3.5" />
                    Recommended Script
                  </span>
                  <button
                    onClick={handleCopyPhrase}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs italic text-slate-800 dark:text-slate-200 line-clamp-2">
                  {currentTip.examplePhrase}
                </p>
              </div>

              {/* Actionable Rule */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                <strong className="text-slate-800 dark:text-slate-200">Rule:</strong> {currentTip.actionableStep}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Card Footer Link */}
        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Tip {currentTipIndex + 1} of {INTERVIEW_TIPS.length}</span>
          <Link
            to="/setup"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Practice with AI</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="quick-tips-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      {/* Header with Title, Category, and Shuffle Control */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="quick-tips-heading" className="text-xl font-bold text-slate-900 dark:text-white">
              Quick Interview Tip
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Daily Coaching Advice</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{currentTip.category}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Tip {currentTipIndex + 1} of {INTERVIEW_TIPS.length}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNextTip}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            title="Show another tip"
          >
            <Shuffle className="h-3.5 w-3.5 text-slate-500" />
            <span>Next Tip</span>
          </button>
          <Link
            to="/setup"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Practice with AI</span>
          </Link>
        </div>
      </div>

      {/* Dynamic Animated Content Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTip.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="mt-5 space-y-4"
        >
          {/* Tip Title & Explanation */}
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
              {currentTip.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {currentTip.insight}
            </p>
          </div>

          {/* Actionable Step Pill/Highlight */}
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Actionable rule:
            </span>
            <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
              {currentTip.actionableStep}
            </p>
          </div>

          {/* Example Phrase / Conversational Script Box */}
          <div className="relative rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/60 p-4 dark:border-blue-900/40 dark:from-blue-950/20 dark:via-indigo-950/15 dark:to-slate-900">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                <MessageSquareQuote className="h-4 w-4" />
                Script to Use in Your Interview
              </span>
              <button
                onClick={handleCopyPhrase}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 transition"
                title="Copy script to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy script</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs font-medium italic text-slate-800 dark:text-slate-200 leading-relaxed">
              {currentTip.examplePhrase}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
