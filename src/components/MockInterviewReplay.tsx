import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Headphones,
  Keyboard,
  Mic,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  AlertTriangle,
} from 'lucide-react';
import { InterviewSession } from '../types';
import { api } from '../utils/api';
import {
  getLocalAudioReplay,
  listLocalAudioReplaysForInterview,
  StoredAudioReplay,
} from '../utils/audioReplayStorage';
import { analyzeAnswerSentimentClient } from '../utils/sentimentAnalyzer';
import { getToneAccent } from './ToneSentimentWidget';

interface MockInterviewReplayProps {
  session: InterviewSession;
}

interface InlineQuestionReplayProps {
  interviewId: string;
  questionId: string;
  questionNumber: number;
  hasServerAudio?: boolean;
  recordedDurationSec?: number;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

const FILLER_MULTIWORD_REGEX = /\b(i think maybe|i'm not sure|not really sure|i guess|i suppose|sort of|kind of|you know)\b/gi;
const FILLER_SINGLE_WORDS = new Set([
  'um', 'uh', 'uhh', 'er', 'erm', 'ah', 'like', 'basically',
  'actually', 'honestly', 'literally', 'maybe', 'perhaps',
]);
const ASSERTIVE_WORDS = new Set([
  'spearheaded', 'architected', 'executed', 'delivered', 'optimized',
  'accelerated', 'engineered', 'resolved', 'achieved', 'led',
  'designed', 'built', 'implemented', 'specifically', 'measured',
  'reduced', 'improved', 'scaled', 'decided', 'owned', 'launched',
]);

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface AnalyzedToken {
  text: string;
  wordIndex: number;
  isWord: boolean;
  kind: 'filler' | 'assertive' | 'normal';
}

function analyzeTranscriptTokens(transcript: string): {
  tokens: AnalyzedToken[];
  totalWords: number;
  fillerCounts: Array<{ term: string; count: number }>;
  totalFillers: number;
} {
  const clean = (transcript || '').trim();
  if (!clean || clean === 'SKIPPED') {
    return { tokens: [], totalWords: 0, fillerCounts: [], totalFillers: 0 };
  }

  // Mark character ranges matching multi-word filler phrases first
  const multiRanges: Array<{ start: number; end: number; phrase: string }> = [];
  let match: RegExpExecArray | null;
  const multiRegex = new RegExp(FILLER_MULTIWORD_REGEX.source, 'gi');
  while ((match = multiRegex.exec(clean)) !== null) {
    multiRanges.push({
      start: match.index,
      end: match.index + match[0].length,
      phrase: match[0].toLowerCase(),
    });
  }

  const parts = clean.split(/(\s+)/);
  const tokens: AnalyzedToken[] = [];
  const countsMap = new Map<string, number>();
  let cursor = 0;
  let wordIndex = 0;

  for (const part of parts) {
    const start = cursor;
    const end = cursor + part.length;
    cursor = end;

    if (!part) continue;
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, wordIndex: -1, isWord: false, kind: 'normal' });
      continue;
    }

    const normalized = part.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '');
    const inMultiRange = multiRanges.some((r) => start >= r.start && end <= r.end);
    let kind: AnalyzedToken['kind'] = 'normal';

    if (inMultiRange || (normalized && FILLER_SINGLE_WORDS.has(normalized))) {
      kind = 'filler';
      const label = normalized || part.toLowerCase();
      countsMap.set(label, (countsMap.get(label) || 0) + 1);
    } else if (normalized && ASSERTIVE_WORDS.has(normalized)) {
      kind = 'assertive';
    }

    tokens.push({
      text: part,
      wordIndex,
      isWord: true,
      kind,
    });
    wordIndex += 1;
  }

  const fillerCounts = Array.from(countsMap.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count);

  const totalFillers = fillerCounts.reduce((acc, item) => acc + item.count, 0);
  return { tokens, totalWords: wordIndex, fillerCounts, totalFillers };
}

export const MockQuestionAudioInline: React.FC<InlineQuestionReplayProps> = ({
  interviewId,
  questionId,
  questionNumber,
  hasServerAudio,
  recordedDurationSec,
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recordedDurationSec || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      const local = await getLocalAudioReplay(interviewId, questionId);
      if (!active) return;
      if (local?.blob) {
        const url = URL.createObjectURL(local.blob);
        objectUrlRef.current = url;
        setAudioUrl(url);
        if (local.durationSec) setDuration(local.durationSec);
        return;
      }
      if (hasServerAudio) {
        setIsLoading(true);
        try {
          const blob = await api.fetchQuestionAudioBlob(interviewId, questionId);
          if (!active) return;
          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          setAudioUrl(url);
        } catch {
          if (active) setUnavailable(true);
        } finally {
          if (active) setIsLoading(false);
        }
      }
    };
    void loadInitial();

    return () => {
      active = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [interviewId, questionId, hasServerAudio]);

  if (!audioUrl && !isLoading && (!hasServerAudio || unavailable)) {
    return null;
  }

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.playbackRate = playbackRate;
      void el.play().catch(() => undefined);
    }
  };

  const handleSpeedCycle = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate as (typeof SPEED_OPTIONS)[number]);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/40 px-3.5 py-2.5 flex flex-wrap items-center gap-3">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
        />
      )}

      <button
        type="button"
        disabled={isLoading || !audioUrl}
        onClick={togglePlay}
        aria-label={isPlaying ? `Pause your Q${questionNumber} audio replay` : `Play your Q${questionNumber} audio replay`}
        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />}
        <span>{isLoading ? 'Loading audio...' : isPlaying ? 'Pause Replay' : 'Play My Answer'}</span>
      </button>

      <input
        type="range"
        min={0}
        max={Math.max(1, duration || 1)}
        step={0.1}
        value={Math.min(currentTime, Math.max(1, duration || 1))}
        onChange={(e) => {
          const t = Number(e.target.value);
          setCurrentTime(t);
          if (audioRef.current) audioRef.current.currentTime = t;
        }}
        aria-label={`Seek Q${questionNumber} audio recording`}
        className="flex-1 min-w-[110px] accent-blue-600 cursor-pointer h-1.5"
      />

      <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
        {formatClock(currentTime)} / {formatClock(duration)}
      </span>

      <button
        type="button"
        onClick={handleSpeedCycle}
        aria-label={`Change playback speed (currently ${playbackRate}x)`}
        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

export const MockInterviewReplay: React.FC<MockInterviewReplayProps> = ({ session }) => {
  const questions = session.questions || [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [localReplays, setLocalReplays] = useState<Record<string, StoredAudioReplay>>({});
  const [serverAudioUrls, setServerAudioUrls] = useState<Record<string, string>>({});
  const [loadingAudioForQ, setLoadingAudioForQ] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioLoadError, setAudioLoadError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  // Load any locally persisted IndexedDB replays for this interview
  useEffect(() => {
    let active = true;
    void listLocalAudioReplaysForInterview(session.id).then((map) => {
      if (!active) return;
      setLocalReplays(map);
      // Select first recorded question by default if Q1 has no audio
      const firstRecordedIndex = questions.findIndex(
        (q) => Boolean(map[q.id]) || Boolean(session.evaluations[q.id]?.audioReplay?.hasAudio)
      );
      if (firstRecordedIndex >= 0) {
        setSelectedIdx(firstRecordedIndex);
      }
    });

    return () => {
      active = false;
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdUrlsRef.current = [];
    };
  }, [session.id, questions, session.evaluations]);

  // Pre-build object URLs for IndexedDB blobs
  const localUrlMap = useMemo(() => {
    const urls: Record<string, string> = {};
    Object.entries(localReplays).forEach(([qId, rec]) => {
      if (rec?.blob) {
        const u = URL.createObjectURL(rec.blob);
        createdUrlsRef.current.push(u);
        urls[qId] = u;
      }
    });
    return urls;
  }, [localReplays]);

  const currentQuestion = questions[selectedIdx];
  const currentQId = currentQuestion?.id || '';
  const currentAnswer = currentQId ? session.answers[currentQId] || '' : '';
  const currentEval = currentQId ? session.evaluations[currentQId] : undefined;
  const serverReplayMeta = currentEval?.audioReplay;
  const localReplayMeta = currentQId ? localReplays[currentQId] : undefined;
  const activeAudioUrl = currentQId
    ? localUrlMap[currentQId] || serverAudioUrls[currentQId] || null
    : null;

  // Lazily fetch audio from backend when user selects a question with server metadata but no local cache
  useEffect(() => {
    if (!currentQId) return;
    if (localUrlMap[currentQId] || serverAudioUrls[currentQId]) {
      setAudioLoadError(null);
      return;
    }
    if (!serverReplayMeta?.hasAudio) {
      setAudioLoadError(null);
      return;
    }

    let active = true;
    setLoadingAudioForQ(currentQId);
    setAudioLoadError(null);

    void api
      .fetchQuestionAudioBlob(session.id, currentQId)
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        createdUrlsRef.current.push(url);
        setServerAudioUrls((prev) => ({ ...prev, [currentQId]: url }));
      })
      .catch(() => {
        if (active) {
          setAudioLoadError('Audio recording for this question is unavailable in storage.');
        }
      })
      .finally(() => {
        if (active) setLoadingAudioForQ(null);
      });

    return () => {
      active = false;
    };
  }, [currentQId, localUrlMap, serverAudioUrls, serverReplayMeta, session.id]);

  // Reset player state when switching questions
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(localReplayMeta?.durationSec || serverReplayMeta?.durationSec || 0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [currentQId, localReplayMeta?.durationSec, serverReplayMeta?.durationSec]);

  const analyzedTranscript = useMemo(
    () => analyzeTranscriptTokens(currentAnswer),
    [currentAnswer]
  );

  const answerSentiment = useMemo(() => {
    if (!currentAnswer || currentAnswer === 'SKIPPED') return null;
    return analyzeAnswerSentimentClient(
      currentAnswer,
      currentEval,
      currentEval?.sentiment?.voiceMetrics
    );
  }, [currentAnswer, currentEval]);

  const activeWordIndex = useMemo(() => {
    if (!isPlaying && currentTime === 0) return -1;
    if (!duration || analyzedTranscript.totalWords === 0) return -1;
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    return Math.min(
      analyzedTranscript.totalWords - 1,
      Math.floor(progress * analyzedTranscript.totalWords)
    );
  }, [isPlaying, currentTime, duration, analyzedTranscript.totalWords]);

  const recordedCount = useMemo(() => {
    return questions.filter(
      (q) => Boolean(localReplays[q.id]) || Boolean(session.evaluations[q.id]?.audioReplay?.hasAudio)
    ).length;
  }, [questions, localReplays, session.evaluations]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !activeAudioUrl) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.playbackRate = playbackRate;
      void el.play().catch(() => setAudioLoadError('Browser blocked playback; click Play again.'));
    }
  }, [activeAudioUrl, isPlaying, playbackRate]);

  const seekBy = (deltaSec: number) => {
    const el = audioRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(duration || el.duration || 0, el.currentTime + deltaSec));
    el.currentTime = target;
    setCurrentTime(target);
  };

  const handleSpeedChange = (nextRate: number) => {
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleDownloadClip = () => {
    if (!activeAudioUrl || !currentQuestion) return;
    const link = document.createElement('a');
    link.href = activeAudioUrl;
    const mime = localReplayMeta?.mimeType || serverReplayMeta?.mimeType || 'audio/webm';
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
    link.download = `interview-q${selectedIdx + 1}-replay.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const toneAccent = answerSentiment ? getToneAccent(answerSentiment.primaryTone) : null;
  const effectiveDuration = Math.max(1, duration || 1);
  const progressPct = Math.min(100, Math.round((currentTime / effectiveDuration) * 100));

  return (
    <section
      aria-label="Mock Interview Audio Replay Studio"
      className="p-6 sm:p-10 rounded-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mock Interview Replay</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              {recordedCount} of {questions.length} recorded
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Volume2 className="w-7 h-7 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <span>Voice Recording &amp; Filler Word Review</span>
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Replay your recorded interview answers alongside annotated transcripts to hear your vocal tone, pacing, and filler word habits firsthand.
          </p>
        </div>

        {/* Question Selector Tabs */}
        <div
          role="tablist"
          aria-label="Select question recording to replay"
          className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-1.5 border border-slate-200/70 dark:border-slate-700/60"
        >
          {questions.map((q, idx) => {
            const hasRec = Boolean(localReplays[q.id]) || Boolean(session.evaluations[q.id]?.audioReplay?.hasAudio);
            const active = selectedIdx === idx;
            return (
              <button
                key={q.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSelectedIdx(idx)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {hasRec ? (
                  <Mic className="w-3 h-3 shrink-0" aria-hidden="true" />
                ) : (
                  <Keyboard className="w-3 h-3 opacity-60 shrink-0" aria-hidden="true" />
                )}
                <span>Q{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Question Prompt & Tone Context */}
      {currentQuestion && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Question {selectedIdx + 1}</span>
            <span aria-hidden="true">·</span>
            <span>{currentQuestion.category}</span>
            {answerSentiment && toneAccent && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${toneAccent.dot}`} aria-hidden="true" />
                  <span>Tone:</span>
                  <span className={toneAccent.text}>{answerSentiment.primaryTone}</span>
                </span>
              </>
            )}
            {answerSentiment?.voiceMetrics?.avgWpm && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{answerSentiment.voiceMetrics.avgWpm} WPM</span>
              </>
            )}
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white leading-snug">
            {currentQuestion.question}
          </p>
        </div>
      )}

      {/* Audio Player Deck */}
      <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-4">
        {activeAudioUrl ? (
          <>
            <audio
              ref={audioRef}
              src={activeAudioUrl}
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDuration(d);
              }}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Primary Transport Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => seekBy(-5)}
                  aria-label="Rewind 5 seconds"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>5s</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause voice replay' : 'Play voice replay'}
                  className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" aria-hidden="true" />
                      <span>Pause Replay</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span>Play Recording</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(5)}
                  aria-label="Skip forward 5 seconds"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>5s</span>
                  <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Speed & Download */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Replay speed"
                  className="flex items-center gap-0.5 rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700"
                >
                  {SPEED_OPTIONS.map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                        playbackRate === spd
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleDownloadClip}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save Clip</span>
                </button>
              </div>
            </div>

            {/* Scrub Bar & Waveform Progress */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300 w-10">
                  {formatClock(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={effectiveDuration}
                  step={0.1}
                  value={Math.min(currentTime, effectiveDuration)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setCurrentTime(next);
                    if (audioRef.current) audioRef.current.currentTime = next;
                  }}
                  aria-label="Audio replay timeline scrubber"
                  className="flex-1 accent-blue-600 cursor-pointer h-2"
                />
                <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400 w-10 text-right">
                  {formatClock(duration)}
                </span>
              </div>

              {/* Clean proportional bar envelope reflecting playback progress */}
              <div className="grid grid-cols-32 gap-1 h-6 items-end pt-1" aria-hidden="true">
                {Array.from({ length: 32 }).map((_, i) => {
                  const barPct = ((i + 1) / 32) * 100;
                  const barHeight = 35 + ((i * 19 + selectedIdx * 13) % 65);
                  const active = barPct <= progressPct;
                  return (
                    <div
                      key={i}
                      style={{ height: `${barHeight}%` }}
                      className={`rounded-full transition-colors duration-150 ${
                        active ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </>
        ) : loadingAudioForQ === currentQId ? (
          <div className="py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            Loading recorded voice chunks for Question {selectedIdx + 1}...
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2.5">
              <Keyboard className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span>
                {audioLoadError ||
                  (currentAnswer === 'SKIPPED'
                    ? 'This question was skipped during the interview.'
                    : 'No microphone audio chunks were recorded for this response — inspect your filler words and phrasing highlight below.')}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
              Turn on the mic in Interview Room to record replay audio
            </span>
          </div>
        )}
      </div>

      {/* Synced Transcript with Filler Word & Assertive Cue Highlighting */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="text-slate-700 dark:text-slate-200">
              Transcript Review ({analyzedTranscript.totalWords} words)
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span className={analyzedTranscript.totalFillers > 0 ? 'text-amber-600 dark:text-amber-400 tabular-nums' : 'text-emerald-600 dark:text-emerald-400'}>
              {analyzedTranscript.totalFillers > 0
                ? `${analyzedTranscript.totalFillers} filler / hedge cue${analyzedTranscript.totalFillers === 1 ? '' : 's'} highlighted`
                : '0 filler words detected'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 dark:bg-amber-900/60 border border-amber-400/60" aria-hidden="true" />
              <span>Filler / Hedge</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 dark:bg-blue-900/60 border border-blue-400/60" aria-hidden="true" />
              <span>Assertive Action</span>
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm leading-7 text-slate-800 dark:text-slate-200">
          {analyzedTranscript.tokens.length > 0 ? (
            analyzedTranscript.tokens.map((tok, i) => {
              if (!tok.isWord) return <React.Fragment key={i}>{tok.text}</React.Fragment>;
              const isSpokenNow = activeWordIndex >= 0 && Math.abs(tok.wordIndex - activeWordIndex) <= 1;

              let tokenClass = 'rounded px-0.5 transition-colors ';
              if (tok.kind === 'filler') {
                tokenClass += 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 underline decoration-amber-500/70 font-semibold';
              } else if (tok.kind === 'assertive') {
                tokenClass += 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 underline decoration-blue-500/60 font-semibold';
              }
              if (isSpokenNow) {
                tokenClass += ' ring-2 ring-blue-500/50';
              }

              return (
                <span key={i} className={tokenClass}>
                  {tok.text}
                </span>
              );
            })
          ) : (
            <span className="text-slate-400 italic">No transcript recorded for this question.</span>
          )}
        </div>

        {/* Specific Filler Breakdown */}
        {analyzedTranscript.fillerCounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            <span className="font-semibold">Repeated fillers to trim:</span>
            <span className="tabular-nums">
              {analyzedTranscript.fillerCounts
                .slice(0, 6)
                .map((item) => `"${item.term}" (${item.count}×)`)
                .join(' · ')}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

export default MockInterviewReplay;
