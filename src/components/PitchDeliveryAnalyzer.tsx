import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Gauge, Mic, MicOff, RotateCcw, Waves } from 'lucide-react';

import { VoiceInputTelemetry } from '../types';

export type PitchAnalyzerTelemetry = Omit<VoiceInputTelemetry, 'inputMode'>;

interface PitchDeliveryAnalyzerProps {
  questionKey: string;
  transcript: string;
  interimWordCount?: number;
  isRecording: boolean;
  isMicOn: boolean;
  onTelemetryChange?: (telemetry: PitchAnalyzerTelemetry) => void;
}

interface PitchSample {
  hz: number;
  timestamp: number;
}

type PaceStatus = 'idle' | 'slow' | 'balanced' | 'fast';
type ToneStatus = 'idle' | 'warming' | 'monotone' | 'expressive';

const MIN_SPEECH_HZ = 75;
const MAX_SPEECH_HZ = 340;
const HISTORY_WINDOW_MS = 14000;
const FAST_WPM_THRESHOLD = 168;
const SLOW_WPM_THRESHOLD = 95;
const MONOTONE_STD_HZ = 9.5;

/**
 * Time-domain normalized autocorrelation fundamental frequency (F0) estimator.
 * Returns pitch in Hz when a voiced speech frame is detected, or null for silence/unvoiced noise.
 */
function detectFundamentalPitch(buffer: Float32Array, sampleRate: number): number | null {
  const size = buffer.length;
  let rmsSum = 0;
  for (let i = 0; i < size; i += 1) {
    const val = buffer[i];
    rmsSum += val * val;
  }
  const rms = Math.sqrt(rmsSum / size);
  if (rms < 0.014) return null;

  const minLag = Math.floor(sampleRate / MAX_SPEECH_HZ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_SPEECH_HZ), Math.floor(size / 2));
  if (maxLag <= minLag) return null;

  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let numerator = 0;
    let normA = 0;
    let normB = 0;
    const limit = size - lag;

    for (let i = 0; i < limit; i += 1) {
      const a = buffer[i];
      const b = buffer[i + lag];
      numerator += a * b;
      normA += a * a;
      normB += b * b;
    }

    const denom = Math.sqrt(normA * normB);
    const correlation = denom > 0 ? numerator / denom : 0;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestCorrelation < 0.72 || bestLag <= 0) return null;

  const hz = sampleRate / bestLag;
  if (hz < MIN_SPEECH_HZ || hz > MAX_SPEECH_HZ) return null;
  return hz;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function PitchDeliveryAnalyzer({
  questionKey,
  transcript,
  interimWordCount = 0,
  isRecording,
  isMicOn,
  onTelemetryChange,
}: PitchDeliveryAnalyzerProps) {
  const [manualMonitor, setManualMonitor] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [currentHz, setCurrentHz] = useState<number | null>(null);
  const [pitchSamples, setPitchSamples] = useState<PitchSample[]>([]);
  const [wpm, setWpm] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplesRef = useRef<PitchSample[]>([]);
  const cumulativePitchHzRef = useRef<number[]>([]);
  const cumulativeWpmRef = useRef<number[]>([]);
  const wordEventsRef = useRef<Array<{ timestamp: number; deltaWords: number }>>([]);
  const prevTotalWordsRef = useRef<number>(0);
  const speechStartedAtRef = useRef<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSampleTimeRef = useRef<number>(0);

  const isMonitoringWanted = (isRecording || manualMonitor) && isMicOn;

  const emitTelemetry = useCallback(() => {
    if (!onTelemetryChange) return;
    const hzList = cumulativePitchHzRef.current;
    const wpmList = cumulativeWpmRef.current;

    let avgPitchHz: number | undefined;
    let pitchStdDevHz: number | undefined;
    let vocalVariety: 'expressive' | 'monotone' | 'steady' | undefined;

    if (hzList.length >= 4) {
      const avg = hzList.reduce((acc, h) => acc + h, 0) / hzList.length;
      const variance = hzList.reduce((acc, h) => acc + (h - avg) * (h - avg), 0) / hzList.length;
      const stdDev = Math.sqrt(variance);
      avgPitchHz = Math.round(avg);
      pitchStdDevHz = Math.round(stdDev * 10) / 10;
      if (hzList.length >= 14) {
        vocalVariety = stdDev < MONOTONE_STD_HZ ? 'monotone' : stdDev >= 16 ? 'expressive' : 'steady';
      }
    }

    const avgWpm =
      wpmList.length > 0
        ? Math.round(wpmList.reduce((acc, val) => acc + val, 0) / wpmList.length)
        : undefined;

    const speakingDurationSec = speechStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - speechStartedAtRef.current) / 1000))
      : undefined;

    onTelemetryChange({
      avgWpm,
      avgPitchHz,
      pitchStdDevHz,
      vocalVariety,
      voicedFrames: hzList.length,
      speakingDurationSec,
    });
  }, [onTelemetryChange]);

  const resetMetrics = useCallback(() => {
    samplesRef.current = [];
    cumulativePitchHzRef.current = [];
    cumulativeWpmRef.current = [];
    wordEventsRef.current = [];
    prevTotalWordsRef.current = countWords(transcript) + interimWordCount;
    speechStartedAtRef.current = null;
    setPitchSamples([]);
    setCurrentHz(null);
    setWpm(0);
    setMicError(null);
    emitTelemetry();
  }, [emitTelemetry, interimWordCount, transcript]);

  // Reset metrics cleanly when switching questions
  useEffect(() => {
    samplesRef.current = [];
    cumulativePitchHzRef.current = [];
    cumulativeWpmRef.current = [];
    wordEventsRef.current = [];
    prevTotalWordsRef.current = 0;
    speechStartedAtRef.current = null;
    setPitchSamples([]);
    setCurrentHz(null);
    setWpm(0);
    setMicError(null);
    emitTelemetry();
  }, [questionKey, emitTelemetry]);

  // Track speaking pace (rolling WPM over recent 20s window or active speaking span)
  useEffect(() => {
    const totalWords = countWords(transcript) + interimWordCount;
    const now = Date.now();

    if (totalWords < prevTotalWordsRef.current) {
      // Transcript cleared or reset
      prevTotalWordsRef.current = totalWords;
      wordEventsRef.current = [];
      speechStartedAtRef.current = totalWords > 0 ? now : null;
      if (totalWords === 0) setWpm(0);
      return;
    }

    const delta = totalWords - prevTotalWordsRef.current;
    if (delta > 0) {
      if (!speechStartedAtRef.current) {
        speechStartedAtRef.current = now - 1500;
      }
      wordEventsRef.current.push({ timestamp: now, deltaWords: delta });
      prevTotalWordsRef.current = totalWords;
    }

    const windowMs = 20000;
    wordEventsRef.current = wordEventsRef.current.filter((e) => now - e.timestamp <= windowMs);

    if (wordEventsRef.current.length > 0 && totalWords >= 4) {
      const recentWords = wordEventsRef.current.reduce((acc, item) => acc + item.deltaWords, 0);
      const oldest = wordEventsRef.current[0].timestamp;
      const spanSeconds = Math.max(4, (now - oldest) / 1000);
      const computedWpm = Math.min(260, Math.max(0, Math.round((recentWords / spanSeconds) * 60)));
      setWpm(computedWpm);
      if (computedWpm > 0 && isMonitoringWanted) {
        cumulativeWpmRef.current.push(computedWpm);
      }
      emitTelemetry();
    }
  }, [transcript, interimWordCount, isMonitoringWanted, emitTelemetry]);

  // Refresh WPM decay if user pauses speaking for several seconds
  useEffect(() => {
    if (!isRecording && wpm === 0) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      wordEventsRef.current = wordEventsRef.current.filter((e) => now - e.timestamp <= 20000);
      if (!wordEventsRef.current.length) {
        setWpm(0);
        return;
      }
      const recentWords = wordEventsRef.current.reduce((acc, item) => acc + item.deltaWords, 0);
      const oldest = wordEventsRef.current[0].timestamp;
      const spanSeconds = Math.max(4, (now - oldest) / 1000);
      setWpm(Math.min(260, Math.max(0, Math.round((recentWords / spanSeconds) * 60))));
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isRecording, wpm]);

  // Manage live Web Audio API microphone stream and pitch analysis loop
  useEffect(() => {
    if (!isMonitoringWanted) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      setCurrentHz(null);
      return;
    }

    let cancelled = false;

    const startAudioAnalysis = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof AudioContext === 'undefined'
      ) {
        setMicError('Live microphone pitch sensing is not available in this browser.');
        return;
      }

      try {
        setMicError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.2;
        source.connect(analyser);

        streamRef.current = stream;
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const buffer = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (cancelled || !analyserRef.current || !audioCtxRef.current) return;
          const now = performance.now();

          if (now - lastSampleTimeRef.current >= 75) {
            lastSampleTimeRef.current = now;
            analyserRef.current.getFloatTimeDomainData(buffer);
            const detected = detectFundamentalPitch(buffer, audioCtxRef.current.sampleRate);

            const wallNow = Date.now();
            const recent = samplesRef.current.filter((s) => wallNow - s.timestamp <= HISTORY_WINDOW_MS);

            if (detected !== null) {
              // Mild smoothing against previous voiced reading within 350ms
              const lastSample = recent[recent.length - 1];
              const smoothed =
                lastSample && wallNow - lastSample.timestamp < 350
                  ? lastSample.hz * 0.35 + detected * 0.65
                  : detected;

              recent.push({ hz: smoothed, timestamp: wallNow });
              cumulativePitchHzRef.current.push(smoothed);
              samplesRef.current = recent;
              setCurrentHz(smoothed);
              setPitchSamples([...recent]);
              if (cumulativePitchHzRef.current.length % 5 === 0) {
                emitTelemetry();
              }
            } else {
              samplesRef.current = recent;
              setCurrentHz(null);
              setPitchSamples([...recent]);
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setMicError('Allow microphone access to visualize live pitch variation.');
          setManualMonitor(false);
        }
      }
    };

    void startAudioAnalysis();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isMonitoringWanted]);

  // Compute pitch variation & status
  const pitchStats = useMemo(() => {
    if (pitchSamples.length === 0) {
      return {
        avgHz: 0,
        stdDevHz: 0,
        toneStatus: 'idle' as ToneStatus,
      };
    }

    const avg = pitchSamples.reduce((acc, s) => acc + s.hz, 0) / pitchSamples.length;
    const variance =
      pitchSamples.reduce((acc, s) => acc + (s.hz - avg) * (s.hz - avg), 0) / pitchSamples.length;
    const stdDevHz = Math.sqrt(variance);

    let toneStatus: ToneStatus = 'warming';
    if (pitchSamples.length >= 14) {
      toneStatus = stdDevHz < MONOTONE_STD_HZ ? 'monotone' : 'expressive';
    }

    return {
      avgHz: avg,
      stdDevHz,
      toneStatus,
    };
  }, [pitchSamples]);

  const paceStatus: PaceStatus = useMemo(() => {
    if (wpm === 0) return 'idle';
    if (wpm > FAST_WPM_THRESHOLD) return 'fast';
    if (wpm < SLOW_WPM_THRESHOLD) return 'slow';
    return 'balanced';
  }, [wpm]);

  // Draw crisp pitch contour graph on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(200, Math.round(rect.width));
    const height = Math.max(76, Math.round(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const isDark = document.documentElement.classList.contains('dark');
    const padTop = 10;
    const padBottom = 10;
    const plotHeight = height - padTop - padBottom;

    // Subtle baseline & expressive pitch target band
    const bandTop = padTop + plotHeight * 0.28;
    const bandHeight = plotHeight * 0.44;
    ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.04)';
    ctx.fillRect(0, bandTop, width, bandHeight);

    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, padTop + plotHeight * 0.5);
    ctx.lineTo(width, padTop + plotHeight * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    if (pitchSamples.length >= 2) {
      const now = Date.now();
      const centerHz = pitchStats.avgHz || 165;
      const minBound = Math.max(MIN_SPEECH_HZ, centerHz - 65);
      const maxBound = Math.min(MAX_SPEECH_HZ, centerHz + 65);
      const range = Math.max(40, maxBound - minBound);

      const strokeColor =
        pitchStats.toneStatus === 'monotone' || paceStatus === 'fast'
          ? '#D97706'
          : '#2563EB';
      const fillColor =
        pitchStats.toneStatus === 'monotone' || paceStatus === 'fast'
          ? isDark
            ? 'rgba(217, 119, 6, 0.16)'
            : 'rgba(217, 119, 6, 0.10)'
          : isDark
          ? 'rgba(37, 99, 235, 0.20)'
          : 'rgba(37, 99, 235, 0.10)';

      const points = pitchSamples.map((sample) => {
        const x = ((sample.timestamp - (now - HISTORY_WINDOW_MS)) / HISTORY_WINDOW_MS) * width;
        const normalized = Math.max(0, Math.min(1, (sample.hz - minBound) / range));
        const y = padTop + (1 - normalized) * plotHeight;
        return { x, y, timestamp: sample.timestamp };
      });

      // Draw continuous segments (break stroke across pauses > 900ms)
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let segmentStart = 0;
      for (let i = 0; i < points.length; i += 1) {
        const isLast = i === points.length - 1;
        const hasGap = !isLast && points[i + 1].timestamp - points[i].timestamp > 900;

        if (isLast || hasGap) {
          const seg = points.slice(segmentStart, i + 1);
          if (seg.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(seg[0].x, seg[0].y);
            for (let j = 1; j < seg.length; j += 1) {
              ctx.lineTo(seg[j].x, seg[j].y);
            }
            ctx.stroke();

            // Subtle area fill under segment
            ctx.lineTo(seg[seg.length - 1].x, height);
            ctx.lineTo(seg[0].x, height);
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
          } else if (seg.length === 1) {
            ctx.beginPath();
            ctx.arc(seg[0].x, seg[0].y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.fill();
          }
          segmentStart = i + 1;
        }
      }

      // Latest active point indicator
      const latest = points[points.length - 1];
      if (latest && now - latest.timestamp < 500) {
        ctx.beginPath();
        ctx.arc(latest.x, latest.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
      }
    }

    ctx.restore();
  }, [pitchSamples, pitchStats.avgHz, pitchStats.toneStatus, paceStatus]);

  // Determine subtle delivery cue message & styling
  const cue = useMemo(() => {
    if (!isMicOn) {
      return {
        tone: 'neutral' as const,
        text: 'Microphone is muted. Unmute to monitor live vocal delivery.',
      };
    }
    if (paceStatus === 'fast' && pitchStats.toneStatus === 'monotone') {
      return {
        tone: 'amber' as const,
        text: `Speaking fast (${wpm} WPM) with flat tone — slow down and stress key results.`,
      };
    }
    if (paceStatus === 'fast') {
      return {
        tone: 'amber' as const,
        text: `Pace is brisk (${wpm} WPM). Pause briefly between ideas to sound composed.`,
      };
    }
    if (pitchStats.toneStatus === 'monotone') {
      return {
        tone: 'amber' as const,
        text: 'Pitch range is narrow. Vary vocal emphasis on metrics and outcomes.',
      };
    }
    if (paceStatus === 'slow') {
      return {
        tone: 'neutral' as const,
        text: `Measured pace (${wpm} WPM) — keep sentences crisp and forward-moving.`,
      };
    }
    if (pitchStats.toneStatus === 'expressive' || paceStatus === 'balanced') {
      return {
        tone: 'emerald' as const,
        text: 'Balanced pace and natural vocal variety — steady delivery.',
      };
    }
    if (isMonitoringWanted) {
      return {
        tone: 'neutral' as const,
        text: 'Listening for speech — speak a sentence to calibrate pitch & pace.',
      };
    }
    return {
      tone: 'neutral' as const,
      text: 'Auto-starts when recording, or toggle Monitor to test vocal delivery.',
    };
  }, [isMicOn, isMonitoringWanted, paceStatus, pitchStats.toneStatus, wpm]);

  const paceLabel =
    paceStatus === 'fast'
      ? 'Too Fast'
      : paceStatus === 'slow'
      ? 'Measured'
      : paceStatus === 'balanced'
      ? 'Balanced'
      : 'Waiting';

  const paceLabelColor =
    paceStatus === 'fast'
      ? 'text-amber-600 dark:text-amber-400'
      : paceStatus === 'balanced'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-500 dark:text-slate-400';

  const toneLabel =
    pitchStats.toneStatus === 'monotone'
      ? 'Monotone'
      : pitchStats.toneStatus === 'expressive'
      ? 'Expressive'
      : pitchStats.toneStatus === 'warming'
      ? 'Calibrating'
      : 'Idle';

  const toneLabelColor =
    pitchStats.toneStatus === 'monotone'
      ? 'text-amber-600 dark:text-amber-400'
      : pitchStats.toneStatus === 'expressive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-500 dark:text-slate-400';

  return (
    <section
      aria-label="Visual vocal pitch and pace analyzer"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Waves className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Voice Delivery Analyzer
              </h3>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {isMonitoringWanted ? 'Live' : 'Standby'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time pitch inflection &amp; speaking pace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isRecording && (
            <button
              type="button"
              disabled={!isMicOn}
              onClick={() => setManualMonitor((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                manualMonitor && isMicOn
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {manualMonitor && isMicOn ? (
                <>
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Monitoring</span>
                </>
              ) : (
                <>
                  <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Monitor Mic</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={resetMetrics}
            aria-label="Reset vocal delivery analyzer"
            title="Recalibrate vocal metrics"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Live Pitch Contour Canvas */}
      <div className="mt-3 relative rounded-xl border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60 overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-label="Live vocal pitch contour chart"
          className="block h-[84px] w-full"
        />
        <div className="pointer-events-none absolute top-1.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
          <span>Pitch contour (Hz)</span>
          <span className="tabular-nums">
            {currentHz !== null ? `${Math.round(currentHz)} Hz` : pitchStats.avgHz > 0 ? `Avg ${Math.round(pitchStats.avgHz)} Hz` : '— Hz'}
          </span>
        </div>
      </div>

      {/* Pace & Inflection Readouts */}
      <div className="mt-3 grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
        <div className="pr-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Gauge className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Speaking Pace</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {wpm > 0 ? `${wpm} WPM` : '— WPM'}
            </span>
            <span className={`text-xs font-semibold ${paceLabelColor}`}>{paceLabel}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">Target 120–160 WPM</p>
        </div>

        <div className="pl-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Activity className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>Vocal Variety</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {pitchSamples.length >= 4 ? `±${Math.round(pitchStats.stdDevHz)} Hz` : '— Hz'}
            </span>
            <span className={`text-xs font-semibold ${toneLabelColor}`}>{toneLabel}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
            {pitchSamples.length >= 14 ? `${pitchSamples.length} voiced frames` : 'Needs ~2s speech'}
          </p>
        </div>
      </div>

      {/* Subtle Delivery Cue Strip */}
      {micError ? (
        <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {micError}
        </p>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
            cue.tone === 'amber'
              ? 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
              : cue.tone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300'
          }`}
        >
          {cue.text}
        </div>
      )}
    </section>
  );
}
