import {
  AnswerSentimentAnalysis,
  EmotionalToneLabel,
  EvaluationResult,
  InterviewSession,
  SessionSentimentAnalysis,
  SessionSentimentTrajectoryPoint,
  ToneScoreBreakdown,
  VoiceInputTelemetry,
} from '../types';

const ASSERTIVE_TERMS = [
  'spearheaded', 'architected', 'executed', 'delivered', 'optimized',
  'accelerated', 'engineered', 'resolved', 'achieved', 'led',
  'designed', 'built', 'implemented', 'specifically', 'measured',
  'reduced', 'improved', 'scaled', 'decided', 'owned', 'launched',
];

const PROFESSIONAL_TERMS = [
  'stakeholder', 'architecture', 'trade-off', 'tradeoff', 'requirements',
  'latency', 'scalability', 'testing', 'reliability', 'security',
  'documentation', 'workflow', 'collaboration', 'metrics', 'impact',
  'methodology', 'alignment', 'benchmark', 'deployment', 'roadmap',
];

const ENTHUSIASTIC_TERMS = [
  'excited', 'passionate', 'enjoyed', 'love', 'proud', 'eager',
  'fascinating', 'thrilled', 'energized', 'motivated', 'collaborated',
  'partnered', 'mentored', 'opportunity', 'growth',
];

const HESITANT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bi guess\b/gi, label: 'I guess' },
  { pattern: /\bi think maybe\b/gi, label: 'I think maybe' },
  { pattern: /\bi'?m not sure\b/gi, label: "I'm not sure" },
  { pattern: /\bnot really sure\b/gi, label: 'not really sure' },
  { pattern: /\bsort of\b/gi, label: 'sort of' },
  { pattern: /\bkind of\b/gi, label: 'kind of' },
  { pattern: /\bi suppose\b/gi, label: 'I suppose' },
  { pattern: /\bmaybe\b/gi, label: 'maybe' },
  { pattern: /\bperhaps\b/gi, label: 'perhaps' },
  { pattern: /\bprobably\b/gi, label: 'probably' },
  { pattern: /\b(um+|uh+|erm+)\b/gi, label: 'vocal filler (um/uh)' },
  { pattern: /\byou know\b/gi, label: 'you know' },
  { pattern: /\bbasically\b/gi, label: 'basically' },
  { pattern: /\bhonestly\b/gi, label: 'honestly' },
];

function clampScore(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function analyzeAnswerSentimentClient(
  answerText: string,
  evalResult?: EvaluationResult,
  voiceMetrics?: VoiceInputTelemetry
): AnswerSentimentAnalysis {
  if (evalResult?.sentiment) {
    return {
      ...evalResult.sentiment,
      voiceMetrics: evalResult.sentiment.voiceMetrics || voiceMetrics,
    };
  }

  const clean = (answerText || '').trim();
  const lower = clean.toLowerCase();
  const words = lower.match(/\b[a-z']+\b/g) || [];
  const wordCount = Math.max(1, words.length);

  const hesitationMarkers: string[] = [];
  let hesitationHits = 0;
  for (const { pattern, label } of HESITANT_PATTERNS) {
    const matches = clean.match(pattern);
    if (matches && matches.length > 0) {
      hesitationHits += matches.length;
      if (!hesitationMarkers.includes(label)) {
        hesitationMarkers.push(label);
      }
    }
  }

  const confidentMarkers = ASSERTIVE_TERMS.filter((term) => lower.includes(term)).slice(0, 5);
  const professionalHits = PROFESSIONAL_TERMS.filter((term) => lower.includes(term)).length;
  const enthusiasticHits = ENTHUSIASTIC_TERMS.filter((term) => lower.includes(term)).length;

  const baseConfidence = evalResult?.metrics?.confidence ?? (wordCount >= 35 ? 74 : wordCount >= 15 ? 64 : 50);
  const baseCommunication = evalResult?.metrics?.communication ?? 72;

  const wpmBoost =
    voiceMetrics?.avgWpm && voiceMetrics.avgWpm >= 115 && voiceMetrics.avgWpm <= 165
      ? 6
      : voiceMetrics?.avgWpm && voiceMetrics.avgWpm > 175
      ? -4
      : 0;

  const pitchBoost =
    voiceMetrics?.vocalVariety === 'expressive'
      ? 8
      : voiceMetrics?.vocalVariety === 'monotone'
      ? -6
      : 0;

  const hedgePenalty = Math.min(34, hesitationHits * 8);
  const assertiveBoost = Math.min(20, confidentMarkers.length * 6);

  const confident = clampScore(baseConfidence + assertiveBoost - hedgePenalty * 0.75 + wpmBoost + pitchBoost * 0.4, 22, 98);
  const professional = clampScore(baseCommunication * 0.7 + professionalHits * 5 + (wordCount >= 25 ? 16 : 6) - hesitationHits * 3, 35, 98);
  const hesitant = clampScore(12 + hesitationHits * 11 + (wordCount < 14 ? 16 : 0) + (voiceMetrics?.vocalVariety === 'monotone' ? 6 : 0) - assertiveBoost * 0.4, 5, 92);
  const enthusiastic = clampScore(52 + enthusiasticHits * 9 + (voiceMetrics?.vocalVariety === 'expressive' ? 14 : 0) - hesitationHits * 4, 24, 96);
  const composed = clampScore(76 + wpmBoost - Math.max(0, hesitationHits - 1) * 6 - (voiceMetrics?.avgWpm && voiceMetrics.avgWpm > 178 ? 10 : 0), 30, 96);

  const toneScores: ToneScoreBreakdown = {
    confident,
    professional,
    composed,
    enthusiastic,
    hesitant,
  };

  const candidates: Array<{ tone: EmotionalToneLabel; score: number }> = [
    { tone: 'Confident', score: confident },
    { tone: 'Professional', score: professional },
    { tone: 'Composed', score: composed },
    { tone: 'Enthusiastic', score: enthusiastic },
    { tone: 'Hesitant', score: hesitant + (hesitationHits >= 3 ? 25 : 0) },
    { tone: 'Uncertain', score: wordCount < 12 && hesitationHits >= 2 ? 82 : hesitant * 0.85 },
  ];

  candidates.sort((a, b) => b.score - a.score);
  const primaryTone = candidates[0].tone;
  const secondaryTone = candidates[1]?.tone !== primaryTone ? candidates[1]?.tone : undefined;

  const rationaleParts: string[] = [];
  if (confidentMarkers.length > 0) {
    rationaleParts.push(`Direct action framing ("${confidentMarkers.slice(0, 2).join('", "')}")`);
  }
  if (hesitationMarkers.length > 0) {
    rationaleParts.push(`hedging cues (${hesitationMarkers.slice(0, 2).join(', ')})`);
  }
  if (voiceMetrics?.avgWpm) {
    rationaleParts.push(`spoken at ${voiceMetrics.avgWpm} WPM${voiceMetrics.vocalVariety ? ` with ${voiceMetrics.vocalVariety} pitch` : ''}`);
  }
  if (rationaleParts.length === 0) {
    rationaleParts.push(
      primaryTone === 'Professional'
        ? 'Structured, objective phrasing with steady delivery.'
        : 'Clear response reflecting measured interview composure.'
    );
  }

  return {
    primaryTone,
    secondaryTone,
    confidenceScore: confident,
    toneScores,
    hesitationMarkers,
    confidentMarkers,
    rationale: rationaleParts.join('; ').replace(/^\w/, (c) => c.toUpperCase()) + '.',
    voiceMetrics,
  };
}

export function deriveSessionSentimentAnalysis(session: InterviewSession): SessionSentimentAnalysis {
  const existing = session.overallReport?.sentimentAnalysis;
  const questions = session.questions || [];
  const answers = session.answers || {};
  const evaluations = session.evaluations || {};

  if (existing && Array.isArray(existing.trajectory) && existing.trajectory.length > 0) {
    return existing;
  }

  const trajectory: SessionSentimentTrajectoryPoint[] = [];
  const distributionMap = new Map<EmotionalToneLabel, number>();
  let voiceCount = 0;

  let sumConfident = 0;
  let sumProfessional = 0;
  let sumComposed = 0;
  let sumEnthusiastic = 0;
  let sumHesitant = 0;

  questions.forEach((q, idx) => {
    const rawAnswer = answers[q.id];
    if (!rawAnswer || rawAnswer === 'SKIPPED') return;

    const evalRes = evaluations[q.id];
    const sentiment = analyzeAnswerSentimentClient(rawAnswer, evalRes, evalRes?.sentiment?.voiceMetrics);
    const inputMode = sentiment.voiceMetrics?.inputMode || 'text';
    if (inputMode === 'voice' || inputMode === 'mixed') {
      voiceCount += 1;
    }

    distributionMap.set(sentiment.primaryTone, (distributionMap.get(sentiment.primaryTone) || 0) + 1);
    sumConfident += sentiment.toneScores.confident;
    sumProfessional += sentiment.toneScores.professional;
    sumComposed += sentiment.toneScores.composed;
    sumEnthusiastic += sentiment.toneScores.enthusiastic;
    sumHesitant += sentiment.toneScores.hesitant;

    trajectory.push({
      questionNumber: idx + 1,
      questionId: q.id,
      category: q.category || 'General',
      primaryTone: sentiment.primaryTone,
      secondaryTone: sentiment.secondaryTone,
      confidenceScore: sentiment.toneScores.confident,
      professionalismScore: sentiment.toneScores.professional,
      hesitationScore: sentiment.toneScores.hesitant,
      inputMode,
      avgWpm: sentiment.voiceMetrics?.avgWpm,
      vocalVariety: sentiment.voiceMetrics?.vocalVariety,
      rationale: sentiment.rationale,
    });
  });

  const count = Math.max(1, trajectory.length);
  const overallToneScores: ToneScoreBreakdown = {
    confident: Math.round(sumConfident / count) || 72,
    professional: Math.round(sumProfessional / count) || 78,
    composed: Math.round(sumComposed / count) || 75,
    enthusiastic: Math.round(sumEnthusiastic / count) || 68,
    hesitant: Math.round(sumHesitant / count) || 14,
  };

  const toneDistribution = Array.from(distributionMap.entries())
    .map(([tone, toneCount]) => ({
      tone,
      count: toneCount,
      percentage: Math.round((toneCount / count) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const dominantTone: EmotionalToneLabel =
    toneDistribution[0]?.tone ||
    (overallToneScores.confident >= overallToneScores.professional ? 'Confident' : 'Professional');

  let emotionalArcSummary = 'Steady professional composure maintained across responses.';
  if (trajectory.length >= 2) {
    const first = trajectory[0];
    const last = trajectory[trajectory.length - 1];
    const deltaConf = last.confidenceScore - first.confidenceScore;
    if (deltaConf >= 8) {
      emotionalArcSummary = `Opened ${first.primaryTone.toLowerCase()} in Q${first.questionNumber} and built noticeable vocal conviction toward a ${last.primaryTone.toLowerCase()} finish in Q${last.questionNumber} (+${deltaConf}% confidence shift).`;
    } else if (deltaConf <= -8) {
      emotionalArcSummary = `Started ${first.primaryTone.toLowerCase()} in Q${first.questionNumber}, with mild hesitation appearing by Q${last.questionNumber} (${deltaConf}% confidence shift). Pausing before complex trade-offs will preserve authority.`;
    } else {
      emotionalArcSummary = `Sustained a ${dominantTone.toLowerCase()} emotional baseline from Q${first.questionNumber} through Q${last.questionNumber}, demonstrating consistent interview poise.`;
    }
  } else if (trajectory.length === 1) {
    emotionalArcSummary = `Delivered a ${trajectory[0].primaryTone.toLowerCase()} response (${trajectory[0].confidenceScore}% confidence) in ${trajectory[0].category}.`;
  }

  return {
    dominantTone,
    emotionalArcSummary,
    voiceInputCoverage: trajectory.length > 0 ? Math.round((voiceCount / trajectory.length) * 100) : 0,
    overallToneScores,
    toneDistribution,
    trajectory,
    aiPowered: false,
  };
}
