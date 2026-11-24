import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react';
import {
  VOICE_PREFS_EVENT,
  VoicePreferences,
  findPreferredVoice,
  getSortedBrowserVoices,
  getVoicePreferences,
  isSpeechSynthesisSupported,
  saveVoicePreferences,
} from '../utils/speechPreferences';

export interface AudioSection {
  id: string;
  label: string;
  text: string;
}

interface PerformanceAudioPlayerProps {
  title?: string;
  subtitle?: string;
  sections: AudioSection[];
  compact?: boolean;
}

type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'completed';

const SPEED_OPTIONS = [0.9, 1, 1.15, 1.25] as const;

/**
 * Splits long speech text into natural sentence chunks so browser speechSynthesis
 * engines (notably Chromium) do not silently drop long utterances.
 */
function splitIntoChunks(text: string, maxLength = 210): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const chunks: string[] = [];
  let current = '';

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;

    if ((current ? `${current} ${sentence}` : sentence).length <= maxLength) {
      current = current ? `${current} ${sentence}` : sentence;
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLength) {
        current = sentence;
      } else {
        // Fallback split on commas or words for very long single sentences
        const words = sentence.split(' ');
        let buffer = '';
        for (const word of words) {
          if ((buffer ? `${buffer} ${word}` : word).length <= maxLength) {
            buffer = buffer ? `${buffer} ${word}` : word;
          } else {
            if (buffer) chunks.push(buffer);
            buffer = word;
          }
        }
        current = buffer;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export default function PerformanceAudioPlayer({
  title = 'Audio Performance Feedback',
  subtitle = 'Listen to a spoken walkthrough of your interview results using your browser Web Speech API.',
  sections,
  compact = false,
}: PerformanceAudioPlayerProps) {
  const isSupported = isSpeechSynthesisSupported();
  const initialPrefs = useMemo(() => getVoicePreferences(), []);

  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || 'all');
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [rate, setRate] = useState<number>(initialPrefs.rate);
  const [pitch, setPitch] = useState<number>(initialPrefs.pitch);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(initialPrefs.voiceURI);
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [speechError, setSpeechError] = useState<string>('');

  // Used to ignore stale `onend` / `onerror` callbacks after user cancels or switches sections
  const playbackRunIdRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);

  // Keep selectedSectionId valid when props change
  useEffect(() => {
    if (sections.length && !sections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const activeSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) || sections[0],
    [sections, selectedSectionId]
  );

  // Load browser speech synthesis voices & sync saved preferences from Settings
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const sorted = getSortedBrowserVoices();
      if (!sorted.length) return;
      setVoices(sorted);

      const savedPrefs = getVoicePreferences();
      const matched = findPreferredVoice(sorted, savedPrefs.voiceURI);
      setSelectedVoiceURI((prev) => {
        if (savedPrefs.voiceURI && sorted.some((v) => v.voiceURI === savedPrefs.voiceURI)) {
          return savedPrefs.voiceURI;
        }
        if (prev && sorted.some((v) => v.voiceURI === prev)) return prev;
        return matched?.voiceURI || '';
      });
    };

    const handlePrefsChange = (event: Event) => {
      const detail = (event as CustomEvent<VoicePreferences>).detail;
      if (!detail) return;
      setRate(detail.rate);
      setPitch(detail.pitch);
      const sorted = getSortedBrowserVoices();
      const matched = findPreferredVoice(sorted, detail.voiceURI);
      setSelectedVoiceURI(matched?.voiceURI || detail.voiceURI || '');
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    window.addEventListener(VOICE_PREFS_EVENT, handlePrefsChange);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
      window.removeEventListener(VOICE_PREFS_EVENT, handlePrefsChange);
    };
  }, [isSupported]);

  const stopSpeech = useCallback(() => {
    playbackRunIdRef.current += 1;
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    setChunkProgress({ current: 0, total: 0 });
    setStatus('idle');
  }, [isSupported]);

  // Cancel speech cleanly when component unmounts
  useEffect(() => {
    return () => {
      playbackRunIdRef.current += 1;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakChunkAt = useCallback(
    (index: number, runId: number, speechRate: number, speechPitch: number, voiceURI: string) => {
      if (!isSupported) return;
      if (runId !== playbackRunIdRef.current) return;

      const chunks = chunksRef.current;
      if (index >= chunks.length) {
        setStatus('completed');
        setChunkProgress({ current: chunks.length, total: chunks.length });
        return;
      }

      chunkIndexRef.current = index;
      setChunkProgress({ current: index + 1, total: chunks.length });

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      const chosenVoice = findPreferredVoice(voices, voiceURI);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang;
      }

      utterance.onend = () => {
        if (runId !== playbackRunIdRef.current) return;
        speakChunkAt(index + 1, runId, speechRate, speechPitch, voiceURI);
      };

      utterance.onerror = (event) => {
        if (runId !== playbackRunIdRef.current) return;
        if (event.error === 'interrupted' || event.error === 'canceled') {
          setStatus('idle');
          setChunkProgress({ current: 0, total: 0 });
          return;
        }
        setSpeechError('Audio playback could not continue in this browser.');
        setStatus('idle');
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, voices]
  );

  const startPlayback = useCallback(
    (customRate = rate, customPitch = pitch, customVoiceURI = selectedVoiceURI) => {
      if (!isSupported || !activeSection?.text.trim()) return;

      setSpeechError('');
      playbackRunIdRef.current += 1;
      const runId = playbackRunIdRef.current;
      window.speechSynthesis.cancel();

      const chunks = splitIntoChunks(activeSection.text);
      if (!chunks.length) return;

      chunksRef.current = chunks;
      chunkIndexRef.current = 0;
      setStatus('playing');
      setChunkProgress({ current: 1, total: chunks.length });

      speakChunkAt(0, runId, customRate, customPitch, customVoiceURI);
    },
    [activeSection, isSupported, pitch, rate, selectedVoiceURI, speakChunkAt]
  );

  const handlePlayPause = () => {
    if (!isSupported) return;

    if (status === 'playing') {
      window.speechSynthesis.pause();
      setStatus('paused');
      return;
    }

    if (status === 'paused') {
      window.speechSynthesis.resume();
      setStatus('playing');
      return;
    }

    startPlayback();
  };

  const handleSpeedChange = (nextRate: number) => {
    setRate(nextRate);
    saveVoicePreferences({ rate: nextRate });
    if (status === 'playing' || status === 'paused') {
      // Restart from current chunk at the updated rate
      if (!isSupported) return;
      playbackRunIdRef.current += 1;
      const runId = playbackRunIdRef.current;
      const resumeIndex = chunkIndexRef.current;
      window.speechSynthesis.cancel();
      setStatus('playing');
      speakChunkAt(resumeIndex, runId, nextRate, pitch, selectedVoiceURI);
    }
  };

  const handleVoiceChange = (nextVoiceURI: string) => {
    setSelectedVoiceURI(nextVoiceURI);
    saveVoicePreferences({ voiceURI: nextVoiceURI });
    if (status === 'playing' || status === 'paused') {
      if (!isSupported) return;
      playbackRunIdRef.current += 1;
      const runId = playbackRunIdRef.current;
      const resumeIndex = chunkIndexRef.current;
      window.speechSynthesis.cancel();
      setStatus('playing');
      speakChunkAt(resumeIndex, runId, rate, pitch, nextVoiceURI);
    }
  };

  const handleSectionSelect = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    if (status === 'playing' || status === 'paused') {
      stopSpeech();
    } else if (status === 'completed') {
      setStatus('idle');
      setChunkProgress({ current: 0, total: 0 });
    }
  };

  if (!isSupported) {
    return (
      <section
        aria-label={title}
        className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        <div className="flex items-center gap-2.5">
          <VolumeX className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>Audio playback via Web Speech API is not supported in this browser.</p>
        </div>
      </section>
    );
  }

  const progressPercent =
    chunkProgress.total > 0 ? Math.round((chunkProgress.current / chunkProgress.total) * 100) : 0;

  return (
    <section
      aria-label={title}
      className={`rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            <span className="text-xs text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
              {status === 'playing'
                ? `Speaking (${chunkProgress.current}/${chunkProgress.total})`
                : status === 'paused'
                ? `Paused (${chunkProgress.current}/${chunkProgress.total})`
                : status === 'completed'
                ? 'Finished'
                : 'Ready to listen'}
            </span>
          </div>
          {!compact && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>

        {/* Playback Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!activeSection?.text.trim()}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {status === 'playing' ? (
              <>
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : status === 'paused' ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Resume</span>
              </>
            ) : status === 'completed' ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Replay</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Listen Summary</span>
              </>
            )}
          </button>

          {(status === 'playing' || status === 'paused') && (
            <button
              type="button"
              onClick={stopSpeech}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Stop</span>
            </button>
          )}

          {/* Speed selector */}
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Playback speed">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleSpeedChange(option)}
                className={`whitespace-nowrap shrink-0 rounded-md px-2 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                  rate === option
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {option}x
              </button>
            ))}
          </div>

          {voices.length > 0 && (
            <select
              aria-label="Select speech voice"
              value={selectedVoiceURI}
              onChange={(event) => handleVoiceChange(event.target.value)}
              className="max-w-[200px] truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Section Filter Tabs when multiple sections exist */}
      {sections.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSectionSelect(section.id)}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedSectionId === section.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      )}

      {/* Progress Bar when active/completed */}
      {chunkProgress.total > 0 && (
        <div className="mt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label="Audio playback progress"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {speechError && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {speechError}
        </p>
      )}
    </section>
  );
}
