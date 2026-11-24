import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Volume2,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap,
  Clock,
  ThumbsUp,
  BarChart2,
  Lightbulb,
  TrendingUp,
  Keyboard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { EmotionalToneLabel, EvaluationResult, InterviewSession } from '../types';
import {
  analyzeAnswerSentimentClient,
  deriveSessionSentimentAnalysis,
} from '../utils/sentimentAnalyzer';

interface ToneSentimentWidgetProps {
  session: InterviewSession;
}

interface SentimentBreakdown {
  positive: number;
  objective: number;
  hesitant: number;
}

interface CommunicationStyleTrait {
  name: string;
  score: number;
  description: string;
  color: string;
  badge: string;
}

interface ToneAnalysisData {
  verbalConfidenceScore: number;
  dominantTone: EmotionalToneLabel;
  confidenceRating: string;
  sentimentDistribution: SentimentBreakdown;
  communicationStyles: CommunicationStyleTrait[];
  fillerWordCount: number;
  fillerWordDensity: number;
  avgWpm: number;
  hasCapturedWpm: boolean;
  vocalVarietyLabel: string;
  pacingAssessment: {
    status: 'Optimal' | 'Fast' | 'Deliberate';
    label: string;
    description: string;
  };
  powerPhrases: { text: string; category: string; impact: string }[];
  hesitationFlags: {
    original: string;
    issue: string;
    betterAlternative: string;
    questionNum: number;
  }[];
  coachingTips: {
    title: string;
    action: string;
  }[];
}

const POWER_VERBS = [
  'spearheaded', 'architected', 'executed', 'delivered', 'optimized',
  'accelerated', 'engineered', 'resolved', 'achieved', 'mentored',
  'transformed', 'implemented', 'designed', 'built', 'led',
  'championed', 'formulated', 'streamlined', 'maximized', 'orchestrated',
];

const HEDGE_PATTERNS = [
  { regex: /\b(i guess|i think maybe|sort of|kind of|i'm not sure|perhaps|i suppose|might be)\b/gi, label: 'Uncertain hedging' },
  { regex: /\b(um|uh|erm|you know)\b/gi, label: 'Verbal filler' },
  { regex: /\b(basically|honestly|actually|literally)\b/gi, label: 'Crutch adverb' },
];

const COLLABORATIVE_WORDS = ['team', 'cross-functional', 'collaborated', 'partnered', 'stakeholders', 'mentored', 'collective', 'shared'];
const ANALYTICAL_WORDS = ['analyzed', 'metrics', 'data', 'evaluated', 'trade-offs', 'methodology', 'framework', 'tested', 'benchmarked'];

export function getToneAccent(tone: EmotionalToneLabel): {
  dot: string;
  text: string;
  surface: string;
} {
  switch (tone) {
    case 'Confident':
      return {
        dot: 'bg-blue-600',
        text: 'text-blue-600 dark:text-blue-400',
        surface: 'border-blue-200/80 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20',
      };
    case 'Professional':
      return {
        dot: 'bg-indigo-600',
        text: 'text-indigo-600 dark:text-indigo-400',
        surface: 'border-indigo-200/80 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/20',
      };
    case 'Composed':
      return {
        dot: 'bg-emerald-600',
        text: 'text-emerald-600 dark:text-emerald-400',
        surface: 'border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/20',
      };
    case 'Enthusiastic':
      return {
        dot: 'bg-violet-600',
        text: 'text-violet-600 dark:text-violet-400',
        surface: 'border-violet-200/80 dark:border-violet-800/40 bg-violet-50/40 dark:bg-violet-950/20',
      };
    case 'Hesitant':
    case 'Uncertain':
      return {
        dot: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400',
        surface: 'border-amber-200/80 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20',
      };
  }
}

export const ToneSentimentWidget: React.FC<ToneSentimentWidgetProps> = ({ session }) => {
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'timeline' | 'hesitations' | 'styles' | 'coaching'>('timeline');

  const sessionSentiment = useMemo(() => deriveSessionSentimentAnalysis(session), [session]);

  const analysis = useMemo<ToneAnalysisData>(() => {
    const questions = session.questions || [];
    const answers = session.answers || {};
    const evaluations = session.evaluations || {};
    const detailedMetrics = session.overallReport?.detailedMetrics;

    const validAnswersList = questions
      .map((q, idx) => ({
        index: idx + 1,
        question: q,
        answer: answers[q.id] || '',
        eval: evaluations[q.id] as EvaluationResult | undefined,
      }))
      .filter((item) => item.answer && item.answer !== 'SKIPPED');

    const targetAnswers =
      selectedQuestionIndex === 'all'
        ? validAnswersList
        : validAnswersList.filter((item) => item.index === selectedQuestionIndex);

    const fullTranscript = targetAnswers.map((t) => t.answer).join(' ');
    const allWords = fullTranscript.toLowerCase().match(/\b[a-zA-Z']+\b/g) || [];
    const totalWords = Math.max(allWords.length, 1);

    let fillerCount = 0;
    HEDGE_PATTERNS.forEach(({ regex }) => {
      const matches = fullTranscript.match(regex);
      if (matches) fillerCount += matches.length;
    });

    const fillerWordDensity = Math.min(Math.round((fillerCount / totalWords) * 100 * 10) / 10, 25);

    const sentences = fullTranscript
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const detectedPowerPhrases: { text: string; category: string; impact: string }[] = [];
    sentences.forEach((sentence) => {
      const lower = sentence.toLowerCase();
      const matchedVerb = POWER_VERBS.find((verb) => lower.includes(verb));
      if (matchedVerb && detectedPowerPhrases.length < 4) {
        detectedPowerPhrases.push({
          text: sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence,
          category: `Proactive Action (${matchedVerb})`,
          impact: 'Demonstrates ownership and results-oriented conviction',
        });
      }
    });

    if (detectedPowerPhrases.length === 0) {
      detectedPowerPhrases.push({
        text: 'Structured response clearly addressing the core requirements and architectural trade-offs.',
        category: 'Clarity & Structure',
        impact: 'Conveys direct communication and cognitive composure',
      });
    }

    const detectedHesitations: {
      original: string;
      issue: string;
      betterAlternative: string;
      questionNum: number;
    }[] = [];

    targetAnswers.forEach((item) => {
      const itemSentences = item.answer.split(/(?<=[.!?])\s+/);
      itemSentences.forEach((sent) => {
        if (detectedHesitations.length >= 4) return;
        const lower = sent.toLowerCase();

        if (lower.includes('i think maybe') || lower.includes('i guess') || lower.includes('i suppose')) {
          detectedHesitations.push({
            original: `"...${sent.trim()}..."`,
            issue: 'Tentative language weakens perceived conviction.',
            betterAlternative: sent.replace(/i (guess|think maybe|suppose)/gi, 'My assessment indicates that'),
            questionNum: item.index,
          });
        } else if (lower.includes('sort of') || lower.includes('kind of')) {
          detectedHesitations.push({
            original: `"...${sent.trim()}..."`,
            issue: 'Minimizing qualifiers ("sort of", "kind of") dilute technical precision.',
            betterAlternative: sent.replace(/(sort of|kind of)/gi, 'specifically'),
            questionNum: item.index,
          });
        } else if (lower.includes('basically') || lower.includes('honestly')) {
          detectedHesitations.push({
            original: `"...${sent.trim()}..."`,
            issue: 'Crutch adverbs ("basically", "honestly") add verbal friction.',
            betterAlternative: sent.replace(/(basically|honestly)/gi, '').replace(/\s{2,}/g, ' '),
            questionNum: item.index,
          });
        }
      });
    });

    if (detectedHesitations.length === 0) {
      detectedHesitations.push({
        original: 'Clean vocal delivery without overt hedging phrases detected in this sample.',
        issue: 'Pacing discipline',
        betterAlternative: 'Continue using 1–2 second pauses between key architectural points.',
        questionNum: selectedQuestionIndex === 'all' ? 1 : selectedQuestionIndex,
      });
    }

    // Aggregate per-question sentiment from stored evaluations or fallback analyzer
    const answerSentiments = targetAnswers.map((item) =>
      analyzeAnswerSentimentClient(item.answer, item.eval, item.eval?.sentiment?.voiceMetrics)
    );

    const verbalConfidenceScore =
      answerSentiments.length > 0
        ? Math.round(
            answerSentiments.reduce((acc, s) => acc + s.toneScores.confident, 0) /
              answerSentiments.length
          )
        : sessionSentiment.overallToneScores.confident;

    const dominantTone: EmotionalToneLabel =
      selectedQuestionIndex === 'all'
        ? sessionSentiment.dominantTone
        : answerSentiments[0]?.primaryTone || sessionSentiment.dominantTone;

    let confidenceRating = 'Balanced & Steady';
    if (verbalConfidenceScore >= 86) confidenceRating = 'Authoritative';
    else if (verbalConfidenceScore >= 74) confidenceRating = 'Poised';
    else if (verbalConfidenceScore >= 60) confidenceRating = 'Steady';
    else confidenceRating = 'Tentative';

    const avgProf =
      answerSentiments.length > 0
        ? Math.round(
            answerSentiments.reduce((acc, s) => acc + s.toneScores.professional, 0) /
              answerSentiments.length
          )
        : sessionSentiment.overallToneScores.professional;
    const avgHes =
      answerSentiments.length > 0
        ? Math.round(
            answerSentiments.reduce((acc, s) => acc + s.toneScores.hesitant, 0) /
              answerSentiments.length
          )
        : sessionSentiment.overallToneScores.hesitant;

    const totalBucket = Math.max(1, verbalConfidenceScore + avgProf + avgHes);
    const positivePct = Math.round((verbalConfidenceScore / totalBucket) * 100);
    const hesitantPct = Math.max(4, Math.round((avgHes / totalBucket) * 100));
    const objectivePct = Math.max(10, 100 - positivePct - hesitantPct);

    const collaborativeCount = COLLABORATIVE_WORDS.filter((w) =>
      fullTranscript.toLowerCase().includes(w)
    ).length;
    const analyticalCount = ANALYTICAL_WORDS.filter((w) =>
      fullTranscript.toLowerCase().includes(w)
    ).length;

    const communicationStyles: CommunicationStyleTrait[] = [
      {
        name: 'Assertiveness & Conviction',
        score: verbalConfidenceScore,
        description: 'Directness of assertions and ownership without self-discounting.',
        color: 'bg-blue-600',
        badge: verbalConfidenceScore >= 75 ? 'Strong Conviction' : 'Developing',
      },
      {
        name: 'Professional & Analytical Tone',
        score: Math.min(98, Math.round(avgProf * 0.8 + analyticalCount * 3)),
        description: 'Structured, objective reasoning framed around trade-offs and metrics.',
        color: 'bg-indigo-600',
        badge: avgProf >= 75 ? 'High Poise' : 'Steady',
      },
      {
        name: 'Collaborative Alignment',
        score: Math.min(96, Math.round(62 + collaborativeCount * 6 + (detailedMetrics?.professionalism || 12) * 0.2)),
        description: 'Inclusive framing highlighting stakeholder alignment and team empathy.',
        color: 'bg-emerald-600',
        badge: collaborativeCount > 1 ? 'Synergistic' : 'Individual Focus',
      },
      {
        name: 'Vocal Clarity & Fluency',
        score: Math.min(Math.max(Math.round(100 - fillerWordDensity * 2.5), 55), 98),
        description: 'Minimal filler words and smooth syntactic sentence flow.',
        color: 'bg-violet-600',
        badge: fillerWordDensity <= 3 ? 'Crisp & Fluid' : 'Moderate Friction',
      },
    ];

    const capturedWpms = targetAnswers
      .map((t) => t.eval?.sentiment?.voiceMetrics?.avgWpm)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const hasCapturedWpm = capturedWpms.length > 0;
    const avgWpm = hasCapturedWpm
      ? Math.round(capturedWpms.reduce((a, b) => a + b, 0) / capturedWpms.length)
      : Math.min(Math.max(Math.round(125 + (verbalConfidenceScore % 24) + (totalWords % 14)), 118), 166);

    const varieties = targetAnswers
      .map((t) => t.eval?.sentiment?.voiceMetrics?.vocalVariety)
      .filter((v): v is 'expressive' | 'monotone' | 'steady' => Boolean(v));
    const vocalVarietyLabel = varieties.includes('monotone')
      ? 'Monotone cues noted'
      : varieties.includes('expressive')
      ? 'Expressive pitch inflection'
      : varieties.includes('steady')
      ? 'Steady vocal inflection'
      : 'Transcript pacing baseline';

    let pacingAssessment: ToneAnalysisData['pacingAssessment'] = {
      status: 'Optimal',
      label: 'Balanced Cadence',
      description: 'Measured delivery allows interviewers to absorb technical nuance.',
    };
    if (avgWpm > 165) {
      pacingAssessment = {
        status: 'Fast',
        label: 'Rapid Cadence',
        description: 'Pause 1 second after core takeaways to keep delivery composed.',
      };
    } else if (avgWpm < 115) {
      pacingAssessment = {
        status: 'Deliberate',
        label: 'Deliberate Pace',
        description: 'Measured speed; maintain vocal energy on multi-part examples.',
      };
    }

    const coachingTips = [
      avgHes > 22
        ? {
            title: 'Replace Hedging Phrases With Direct Stances',
            action: `Your emotional tone dipped into hesitant phrasing (${avgHes}% hesitation index). Lead with definitive openings like "The primary bottleneck was..." instead of "I guess maybe".`,
          }
        : {
            title: 'Preserve Your Composed Strategic Pause',
            action: 'Use a clean 1.5-second silence instead of filler words ("um", "uh") before answering follow-up probes.',
          },
      varieties.includes('monotone')
        ? {
            title: 'Inject Vocal Contrast on Key Outcomes',
            action: 'Live pitch telemetry flagged narrow pitch variation on parts of the session. Emphasize metrics and action verbs with slight upward/downward vocal inflection.',
          }
        : {
            title: 'Anchor Answers With Ownership Verbs',
            action: 'Pair decisive verbs ("Architected", "Resolved", "Spearheaded") with concrete impact numbers to sustain authoritative delivery.',
          },
      {
        title: 'Finish Sentences With Downward Inflection',
        action: 'Close each STAR summary cleanly ("...reducing p95 latency by 38%.") rather than trailing off with "and yeah, that is basically it."',
      },
      {
        title: 'Keep Technical Trade-Offs Steady Under Pressure',
        action: 'When pivoting to unfamiliar edge cases, state what you know confidently first, then walk through assumptions methodically.',
      },
    ];

    return {
      verbalConfidenceScore,
      dominantTone,
      confidenceRating,
      sentimentDistribution: {
        positive: positivePct,
        objective: objectivePct,
        hesitant: hesitantPct,
      },
      communicationStyles,
      fillerWordCount: fillerCount,
      fillerWordDensity,
      avgWpm,
      hasCapturedWpm,
      vocalVarietyLabel,
      pacingAssessment,
      powerPhrases: detectedPowerPhrases,
      hesitationFlags: detectedHesitations,
      coachingTips,
    };
  }, [session, selectedQuestionIndex, sessionSentiment]);

  const trajectoryChartData = useMemo(() => {
    return sessionSentiment.trajectory.map((pt) => ({
      name: `Q${pt.questionNumber}`,
      Confident: pt.confidenceScore,
      Professional: pt.professionalismScore,
      Hesitant: pt.hesitationScore,
      primaryTone: pt.primaryTone,
    }));
  }, [sessionSentiment.trajectory]);

  const dominantAccent = getToneAccent(analysis.dominantTone);

  return (
    <div className="p-6 sm:p-10 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 relative overflow-hidden">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Voice Input Sentiment &amp; Emotional Tone</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              {sessionSentiment.voiceInputCoverage > 0
                ? `${sessionSentiment.voiceInputCoverage}% Voice Captured`
                : 'Transcript Analysis'}
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
            <Volume2 className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <span>Emotional Tone &amp; Sentiment Analysis</span>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Tracks the emotional tone (confident, professional, composed, hesitant) of your spoken and written responses throughout the session.
          </p>
        </div>

        {/* Question Filter */}
        <div
          role="group"
          aria-label="Filter sentiment analysis by question"
          className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/60"
        >
          <button
            type="button"
            onClick={() => setSelectedQuestionIndex('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedQuestionIndex === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({session.questions.length})
          </button>
          {session.questions.map((q, idx) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedQuestionIndex(idx + 1)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                selectedQuestionIndex === idx + 1
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Emotional Arc Callout */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${dominantAccent.surface}`}>
        <div className="flex items-start gap-3.5 min-w-0">
          <span className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${dominantAccent.dot}`} aria-hidden="true" />
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {selectedQuestionIndex === 'all' ? 'Session Dominant Tone' : `Q${selectedQuestionIndex} Emotional Tone`}
              </span>
              <span className={`text-sm font-black ${dominantAccent.text}`}>
                {analysis.dominantTone}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {selectedQuestionIndex === 'all'
                ? sessionSentiment.emotionalArcSummary
                : sessionSentiment.trajectory.find((t) => t.questionNumber === selectedQuestionIndex)?.rationale ||
                  sessionSentiment.emotionalArcSummary}
            </p>
          </div>
        </div>

        {/* Tone Mix Strip */}
        <div className="flex flex-wrap items-center gap-4 shrink-0 border-t md:border-t-0 md:border-l border-slate-200/80 dark:border-slate-700/60 pt-3 md:pt-0 md:pl-5">
          {sessionSentiment.toneDistribution.slice(0, 3).map((item) => {
            const acc = getToneAccent(item.tone);
            return (
              <div key={item.tone} className="text-left">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${acc.dot}`} aria-hidden="true" />
                  <span>{item.tone}</span>
                </p>
                <p className="text-base font-black tabular-nums text-slate-900 dark:text-white">
                  {item.percentage}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Verbal Confidence */}
        <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>Confident Tone</span>
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {analysis.confidenceRating}
            </span>
          </div>

          <div className="my-4 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {analysis.verbalConfidenceScore}
            </span>
            <span className="text-base font-bold text-slate-400">/100</span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${analysis.verbalConfidenceScore}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conviction &amp; direct framing
            </p>
          </div>
        </div>

        {/* Sentiment Spectrum */}
        <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Tone Spectrum</span>
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {analysis.sentimentDistribution.positive}% Confident
            </span>
          </div>

          <div className="my-4 space-y-2.5">
            <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex gap-0.5 p-0.5">
              <div
                style={{ width: `${analysis.sentimentDistribution.positive}%` }}
                className="h-full bg-emerald-500 rounded-l-full"
                title={`Confident: ${analysis.sentimentDistribution.positive}%`}
              />
              <div
                style={{ width: `${analysis.sentimentDistribution.objective}%` }}
                className="h-full bg-blue-500"
                title={`Professional: ${analysis.sentimentDistribution.objective}%`}
              />
              <div
                style={{ width: `${analysis.sentimentDistribution.hesitant}%` }}
                className="h-full bg-amber-500 rounded-r-full"
                title={`Hesitant: ${analysis.sentimentDistribution.hesitant}%`}
              />
            </div>

            <div className="grid grid-cols-3 gap-1 text-center tabular-nums">
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Confident</p>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{analysis.sentimentDistribution.positive}%</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Professional</p>
                <p className="text-xs font-black text-blue-600 dark:text-blue-400">{analysis.sentimentDistribution.objective}%</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Hesitant</p>
                <p className="text-xs font-black text-amber-600 dark:text-amber-400">{analysis.sentimentDistribution.hesitant}%</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {analysis.sentimentDistribution.hesitant <= 12
              ? 'Minimal hesitation across answers.'
              : 'Mild hesitation on complex prompts.'}
          </p>
        </div>

        {/* Vocal Pacing */}
        <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
              <span>Vocal Pacing</span>
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
              {analysis.pacingAssessment.status}
            </span>
          </div>

          <div className="my-4 flex items-baseline gap-2 tabular-nums">
            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {analysis.avgWpm}
            </span>
            <span className="text-sm font-bold text-slate-400">
              WPM {analysis.hasCapturedWpm ? '· Mic' : '· Est.'}
            </span>
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {analysis.vocalVarietyLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              Target 120–160 WPM
            </p>
          </div>
        </div>

        {/* Hesitation & Filler Density */}
        <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>Filler Density</span>
            </span>
            <span
              className={`text-xs font-bold ${
                analysis.fillerWordDensity <= 3
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {analysis.fillerWordDensity <= 3 ? 'Crisp' : 'Moderate'}
            </span>
          </div>

          <div className="my-4 flex items-baseline gap-2 tabular-nums">
            <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              {analysis.fillerWordDensity}%
            </span>
            <span className="text-xs font-semibold text-slate-400">
              ({analysis.fillerWordCount} markers)
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(analysis.fillerWordDensity * 4, 100)}%` }}
                className={`h-full rounded-full ${
                  analysis.fillerWordDensity <= 3 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {analysis.fillerWordDensity <= 3
                ? 'Few hedging or filler words.'
                : 'Trim hedging phrases for poise.'}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { id: 'timeline', label: 'Emotional Tone Trajectory', icon: TrendingUp },
          { id: 'hesitations', label: 'Hesitation Cues & Rewrites', icon: AlertTriangle, count: analysis.hesitationFlags.length },
          { id: 'styles', label: 'Confident Power Phrases', icon: Zap, count: analysis.powerPhrases.length },
          { id: 'coaching', label: 'Vocal Presence Coaching', icon: Lightbulb },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`pb-3.5 text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" aria-hidden="true" />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="text-xs font-black tabular-nums text-slate-400 dark:text-slate-500">
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* Session Emotional Tone Trajectory Chart */}
            {trajectoryChartData.length > 0 && (
              <div className="p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                      <span>Session Emotional Tone Progression</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Confident, Professional, and Hesitant sentiment scores tracked across each response (Q1–Q{session.questions.length}).
                    </p>
                  </div>
                </div>

                <div className="h-[230px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReLineChart data={trajectoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#CBD5E1" opacity={0.35} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} width={32} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                      <Line type="monotone" dataKey="Confident" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="Professional" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="Hesitant" stroke="#D97706" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>

                {/* Per-Question Emotional Tone Strip */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                  {sessionSentiment.trajectory.map((point) => {
                    const accent = getToneAccent(point.primaryTone);
                    const isFocused = selectedQuestionIndex === point.questionNumber;
                    return (
                      <button
                        key={point.questionId}
                        type="button"
                        onClick={() =>
                          setSelectedQuestionIndex(
                            isFocused ? 'all' : point.questionNumber
                          )
                        }
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          isFocused
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-500/40'
                            : 'border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/70 hover:border-blue-300 dark:hover:border-blue-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                            Q{point.questionNumber} · {point.category}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-black ${accent.text}`}>
                            <span className={`w-2 h-2 rounded-full ${accent.dot}`} aria-hidden="true" />
                            <span>{point.primaryTone}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2.5">
                          {point.rationale}
                        </p>

                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums border-t border-slate-100 dark:border-slate-800 pt-2">
                          <span className="inline-flex items-center gap-1">
                            {point.inputMode === 'voice' || point.inputMode === 'mixed' ? (
                              <>
                                <Mic className="w-3 h-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                <span>{point.inputMode === 'mixed' ? 'Voice + Text' : 'Voice Input'}</span>
                              </>
                            ) : (
                              <>
                                <Keyboard className="w-3 h-3 text-slate-400" aria-hidden="true" />
                                <span>Text Input</span>
                              </>
                            )}
                          </span>
                          <span>
                            {point.avgWpm ? `${point.avgWpm} WPM · ` : ''}
                            {point.confidenceScore}% conf.
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Communication Style Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {analysis.communicationStyles.map((style, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{style.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {style.description}
                      </p>
                    </div>
                    <span className="text-lg font-black tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                      {style.score}%
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${style.score}%` }}
                        className={`h-full rounded-full ${style.color}`}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400">
                      <span>Vocal Sentiment Index</span>
                      <span className="text-slate-700 dark:text-slate-300 font-bold">{style.badge}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex items-start gap-4">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0">
                <ThumbsUp className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-black text-slate-900 dark:text-white">Communication Persona Summary</h5>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {sessionSentiment.emotionalArcSummary} Replacing hedging qualifiers with concise 1-second pauses elevates executive presence cleanly.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'hesitations' && (
          <motion.div
            key="hesitations"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Detected Tentative Language &amp; High-Authority Refinements
            </p>

            <div className="grid grid-cols-1 gap-4">
              {analysis.hesitationFlags.map((flag, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{flag.issue}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                      Question {flag.questionNum}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 space-y-1">
                      <p className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                        Spoken / Drafted
                      </p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 italic">
                        {flag.original}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 space-y-1">
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Confident Alternative</span>
                      </p>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        &quot;{flag.betterAlternative}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'styles' && (
          <motion.div
            key="styles"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Confident &amp; High-Impact Statements Captured From Responses
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.powerPhrases.map((phrase, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    <Zap className="w-4 h-4" aria-hidden="true" />
                    <span>{phrase.category}</span>
                  </div>
                  <blockquote className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed italic border-l-2 border-blue-500 pl-3">
                    &quot;{phrase.text}&quot;
                  </blockquote>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
                    <span>{phrase.impact}</span>
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'coaching' && (
          <motion.div
            key="coaching"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {analysis.coachingTips.map((tip, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs tabular-nums shrink-0">
                    0{idx + 1}
                  </div>
                  <h5 className="text-sm font-black text-slate-900 dark:text-white">
                    {tip.title}
                  </h5>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 pl-11">
                  {tip.action}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ToneSentimentWidget;
