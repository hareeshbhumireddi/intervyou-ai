import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Moon,
  Sun,
  UserRound,
  ShieldCheck,
  BellRing,
  Mail,
  CheckCircle2,
  Sparkles,
  FileText,
  Loader2,
  ArrowUpRight,
  AlertCircle,
  Volume2,
  VolumeX,
  Play,
  Square,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../components/ThemeProvider';
import { useAppState } from '../hooks/useAppState';
import { api } from '../utils/api';
import { ResumeFileMetadata } from '../types';
import {
  DEFAULT_VOICE_PREFERENCES,
  VOICE_PREFS_EVENT,
  VoicePreferences,
  findPreferredVoice,
  getSortedBrowserVoices,
  getVoicePreferences,
  isSpeechSynthesisSupported,
  saveVoicePreferences,
} from '../utils/speechPreferences';

const DETECTABLE_SKILLS = [
  'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 'Java', 'Spring Boot',
  'SQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Machine Learning',
  'Data Science', 'Next.js', 'C++', 'Go', 'DevOps', 'Tailwind CSS', 'System Design',
];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, setUser, syncProfileToCloud } = useAppState();
  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  const [resumeMeta, setResumeMeta] = useState<ResumeFileMetadata | null>(user.resumeFile || null);
  const [resumeText, setResumeText] = useState<string>(user.resumeText || '');

  const existingSub = user.jobAlertSubscription;
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(Boolean(existingSub?.enabled));
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly'>(existingSub?.frequency || 'daily');
  const [alertEmail, setAlertEmail] = useState<string>(existingSub?.email || user.email || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [matchedInfo, setMatchedInfo] = useState<{
    count: number;
    samples: Array<{ id: string; title: string; company: string; location: string; platform?: string; matchedSkills: string[] }>;
  } | null>(null);

  // AI Feedback Voice (Web Speech API) state
  const speechSupported = isSpeechSynthesisSupported();
  const initialVoicePrefs = useMemo(() => getVoicePreferences(), []);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(initialVoicePrefs.voiceURI);
  const [speechRate, setSpeechRate] = useState<number>(initialVoicePrefs.rate);
  const [speechPitch, setSpeechPitch] = useState<number>(initialVoicePrefs.pitch);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [voiceSaveNotice, setVoiceSaveNotice] = useState('');
  const [voicePreviewError, setVoicePreviewError] = useState('');
  const previewRunIdRef = useRef(0);

  useEffect(() => {
    if (!speechSupported) return;

    const loadVoices = () => {
      const sorted = getSortedBrowserVoices();
      if (sorted.length) {
        setAvailableVoices(sorted);
      }
    };

    const handlePrefsSync = (event: Event) => {
      const detail = (event as CustomEvent<VoicePreferences>).detail;
      if (!detail) return;
      setSelectedVoiceURI(detail.voiceURI);
      setSpeechRate(detail.rate);
      setSpeechPitch(detail.pitch);
    };

    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    window.addEventListener(VOICE_PREFS_EVENT, handlePrefsSync);
    return () => {
      previewRunIdRef.current += 1;
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
      window.removeEventListener(VOICE_PREFS_EVENT, handlePrefsSync);
      window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  // Sync local state if user profile finishes loading after mount
  useEffect(() => {
    if (user.jobAlertSubscription) {
      setAlertsEnabled(Boolean(user.jobAlertSubscription.enabled));
      setFrequency(user.jobAlertSubscription.frequency || 'daily');
      setAlertEmail(user.jobAlertSubscription.email || user.email || '');
    } else if (user.email && !alertEmail) {
      setAlertEmail(user.email);
    }
  }, [user.jobAlertSubscription, user.email]);

  // Fetch uploaded resume metadata and extracted text to discover saved resume skills
  useEffect(() => {
    let active = true;
    api.getResume()
      .then((data) => {
        if (!active) return;
        setResumeMeta(data.resume || null);
        if (data.text) {
          setResumeText(data.text);
          setUser((curr) => ({
            ...curr,
            resumeFile: data.resume || curr.resumeFile,
            resumeText: data.text || curr.resumeText,
          }));
        }
      })
      .catch(() => {
        // 404 when no uploaded resume exists yet is handled gracefully
      });
    return () => { active = false; };
  }, [setUser]);

  const savedResumeSkills = useMemo(() => {
    const profileSkills = Array.isArray(user.skills) ? user.skills : [];
    const lowerText = (resumeText || user.resumeText || '').toLowerCase();
    const minedFromResume = DETECTABLE_SKILLS.filter((skill) =>
      lowerText.includes(skill.toLowerCase())
    );
    return Array.from(new Set([...profileSkills, ...minedFromResume])).filter(Boolean);
  }, [user.skills, user.resumeText, resumeText]);

  const persistSubscription = async (
    nextEnabled: boolean,
    nextFrequency: 'instant' | 'daily' | 'weekly',
    nextEmail: string
  ) => {
    setIsSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const response = await api.updateJobAlertSubscription({
        enabled: nextEnabled,
        frequency: nextFrequency,
        email: nextEmail.trim() || user.email,
        matchedSkills: savedResumeSkills,
      });

      const nextUser = {
        ...user,
        jobAlertSubscription: response.subscription,
        profileUpdatedAt: new Date().toISOString(),
      };
      setUser((curr) => ({
        ...curr,
        jobAlertSubscription: response.subscription,
        profileUpdatedAt: nextUser.profileUpdatedAt,
      }));
      await syncProfileToCloud(nextUser, 'jobAlerts');
      setMatchedInfo({
        count: response.matchedCount,
        samples: response.sampleMatches,
      });
      setSaveMessage(
        nextEnabled
          ? `Subscribed! Alerts will be sent to ${response.subscription.email} (${nextFrequency}).`
          : 'Email job alert notifications turned off.'
      );
    } catch (err) {
      // Revert optimistic toggle if save failed
      setAlertsEnabled(!nextEnabled);
      setSaveError(err instanceof Error ? err.message : 'Could not update notification preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAlerts = () => {
    const nextEnabled = !alertsEnabled;
    setAlertsEnabled(nextEnabled);
    void persistSubscription(nextEnabled, frequency, alertEmail);
  };

  const handleFrequencyChange = (nextFreq: 'instant' | 'daily' | 'weekly') => {
    setFrequency(nextFreq);
    if (alertsEnabled) {
      void persistSubscription(true, nextFreq, alertEmail);
    }
  };

  const handleEmailSave = (e: React.FormEvent) => {
    e.preventDefault();
    void persistSubscription(alertsEnabled, frequency, alertEmail);
  };

  const resolvedVoice = useMemo(
    () => findPreferredVoice(availableVoices, selectedVoiceURI),
    [availableVoices, selectedVoiceURI]
  );

  const speakPreviewSample = (voiceURI: string, rate: number, pitch: number) => {
    if (!speechSupported) return;
    setVoicePreviewError('');
    previewRunIdRef.current += 1;
    const runId = previewRunIdRef.current;
    window.speechSynthesis.cancel();

    const sampleText =
      'Great work on this session. Your system architecture explanation scored 88 percent, with strong clarity on API design and data flow.';
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.rate = rate;
    utterance.pitch = pitch;

    const chosen = findPreferredVoice(availableVoices, voiceURI);
    if (chosen) {
      utterance.voice = chosen;
      utterance.lang = chosen.lang;
    }

    utterance.onend = () => {
      if (previewRunIdRef.current === runId) {
        setIsPreviewingVoice(false);
      }
    };
    utterance.onerror = (event) => {
      if (previewRunIdRef.current !== runId) return;
      setIsPreviewingVoice(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setVoicePreviewError('Could not play voice sample in this browser.');
      }
    };

    setIsPreviewingVoice(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceURIChange = (nextURI: string) => {
    setSelectedVoiceURI(nextURI);
    saveVoicePreferences({ voiceURI: nextURI });
    setVoicePreviewError('');
    setVoiceSaveNotice('AI feedback voice saved for performance summaries.');
    if (isPreviewingVoice) {
      speakPreviewSample(nextURI, speechRate, speechPitch);
    }
  };

  const handleSpeechRateChange = (nextRate: number) => {
    setSpeechRate(nextRate);
    saveVoicePreferences({ rate: nextRate });
    setVoiceSaveNotice('Speech playback speed saved.');
    if (isPreviewingVoice) {
      speakPreviewSample(selectedVoiceURI, nextRate, speechPitch);
    }
  };

  const handleSpeechPitchChange = (nextPitch: number) => {
    setSpeechPitch(nextPitch);
    saveVoicePreferences({ pitch: nextPitch });
    setVoiceSaveNotice('Voice pitch saved.');
  };

  const handleToggleVoicePreview = () => {
    if (!speechSupported) return;
    if (isPreviewingVoice) {
      previewRunIdRef.current += 1;
      window.speechSynthesis.cancel();
      setIsPreviewingVoice(false);
      return;
    }
    speakPreviewSample(selectedVoiceURI, speechRate, speechPitch);
  };

  const handleResetVoiceDefaults = () => {
    previewRunIdRef.current += 1;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setIsPreviewingVoice(false);
    setSelectedVoiceURI(DEFAULT_VOICE_PREFERENCES.voiceURI);
    setSpeechRate(DEFAULT_VOICE_PREFERENCES.rate);
    setSpeechPitch(DEFAULT_VOICE_PREFERENCES.pitch);
    saveVoicePreferences(DEFAULT_VOICE_PREFERENCES);
    setVoicePreviewError('');
    setVoiceSaveNotice('Reset AI feedback voice to browser default.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Workspace preferences</p>
        <h1 className="mt-1 text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-slate-500">Manage your appearance, AI feedback voice, job alert subscriptions, and candidate profile.</p>
      </header>

      {/* AI Feedback Voice Configuration (Web Speech API) */}
      <section
        aria-label="AI feedback voice settings"
        className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="rounded-xl p-2.5 shrink-0 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white">
                  AI Feedback Voice (Performance Summary)
                </h2>
                {speechSupported && availableVoices.length > 0 && (
                  <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {availableVoices.length} browser {availableVoices.length === 1 ? 'voice' : 'voices'} available
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose which SpeechSynthesis voice reads your interview performance summaries and per-question feedback aloud.
              </p>
            </div>
          </div>

          {speechSupported && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleVoicePreview}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                  isPreviewingVoice
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isPreviewingVoice ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Stop Sample</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Test Voice</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetVoiceDefaults}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-5 sm:p-6 space-y-4">
          {!speechSupported ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300">
              <VolumeX className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Your browser does not support the Web Speech API (SpeechSynthesis). Try Chrome, Edge, or Safari to configure AI voices.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Browser Voice Select */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="ai-voice-select" className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                    SpeechSynthesis Voice
                  </label>
                  <select
                    id="ai-voice-select"
                    value={selectedVoiceURI}
                    onChange={(e) => handleVoiceURIChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      Auto — Best Available English Voice{resolvedVoice && !selectedVoiceURI ? ` (${resolvedVoice.name})` : ''}
                    </option>
                    {availableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang}){voice.default ? ' — Browser Default' : ''}{voice.localService ? ' • Local' : ' • Online'}
                      </option>
                    ))}
                  </select>
                  {availableVoices.length === 0 && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Loading system speech voices from browser engine…
                    </p>
                  )}
                </div>

                {/* Speed Control */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                    Playback Speed
                  </span>
                  <div
                    role="group"
                    aria-label="Default feedback playback speed"
                    className="grid grid-cols-4 gap-1 rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700"
                  >
                    {([0.9, 1, 1.15, 1.25] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleSpeechRateChange(option)}
                        className={`whitespace-nowrap shrink-0 rounded-lg py-1.5 text-xs font-bold tabular-nums transition-colors cursor-pointer ${
                          speechRate === option
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {option}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pitch Control */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="ai-voice-pitch" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Voice Pitch
                    </label>
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {speechPitch.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                    <span className="text-[11px] font-medium text-slate-400">Deep</span>
                    <input
                      id="ai-voice-pitch"
                      type="range"
                      min={0.85}
                      max={1.2}
                      step={0.05}
                      value={speechPitch}
                      onChange={(e) => handleSpeechPitchChange(parseFloat(e.target.value))}
                      className="flex-1 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-slate-400">Bright</span>
                  </div>
                </div>
              </div>

              {voicePreviewError && (
                <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{voicePreviewError}</span>
                </div>
              )}

              {voiceSaveNotice && !voicePreviewError && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{voiceSaveNotice}</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Job Alert Email Notifications Subscription Section */}
      <section
        aria-label="Job alert email notifications"
        className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className={`rounded-xl p-2.5 shrink-0 ${
              alertsEnabled
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
            }`}>
              <BellRing className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white">
                  Email Job Alerts (Resume Skill Match)
                </h2>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  alertsEnabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {alertsEnabled ? 'Subscribed' : 'Off'}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Receive email notifications whenever new LinkedIn, Naukri, or Govt job postings match your saved resume skills.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={alertsEnabled}
            aria-label="Subscribe to email notifications for matching job postings"
            disabled={isSaving}
            onClick={handleToggleAlerts}
            className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 ${
              alertsEnabled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                alertsEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Status / Error Feedback */}
        {saveError && (
          <div role="alert" className="mx-5 mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {saveMessage && !saveError && (
          <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Expanded Subscription Controls & Resume Skill Preview */}
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Delivery Email */}
            <form onSubmit={handleEmailSave} className="space-y-1.5">
              <label htmlFor="alert-email-input" className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Mail className="h-3.5 w-3.5 text-blue-600" />
                <span>Notification Email Address</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="alert-email-input"
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>
            </form>

            {/* Digest Frequency */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span>Alert Frequency</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700">
                {(['instant', 'daily', 'weekly'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleFrequencyChange(freq)}
                    className={`rounded-lg py-1.5 text-xs font-bold capitalize transition-all cursor-pointer ${
                      frequency === freq
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Saved Resume Skills Monitored */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>
                  Saved Resume Skills Monitored ({savedResumeSkills.length})
                </span>
                {resumeMeta?.name && (
                  <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {resumeMeta.name}
                  </span>
                )}
              </div>
              <Link to="/my-resume" className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
                Manage Resume →
              </Link>
            </div>

            {savedResumeSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {savedResumeSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/40 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No skills detected yet. Upload your resume in <Link to="/my-resume" className="text-blue-600 font-semibold hover:underline">My Resume</Link> or add skills in <Link to="/profile" className="text-blue-600 font-semibold hover:underline">Profile</Link> to improve matching accuracy.
              </p>
            )}
          </div>

          {/* Live Matching Preview when toggled */}
          {matchedInfo && (
            <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {matchedInfo.count} ongoing job postings currently match your resume skills
                </span>
                <Link
                  to="/jobs"
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  <span>View in Job Search</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {matchedInfo.samples.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {matchedInfo.samples.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-3 py-2 text-xs"
                    >
                      <p className="font-bold text-slate-900 dark:text-white truncate">{job.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {job.company} • Matched: {job.matchedSkills.slice(0, 3).join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><ThemeIcon className="h-5 w-5" /></span>
            <div><h2 className="font-semibold">Appearance</h2><p className="mt-1 text-sm text-slate-500">Currently using {theme} mode.</p></div>
          </div>
          <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Change</button>
        </div>
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><UserRound className="h-5 w-5" /></span>
            <div><h2 className="font-semibold">Candidate profile</h2><p className="mt-1 text-sm text-slate-500">{user.email || 'Update your contact and education details.'}</p></div>
          </div>
          <Link to="/profile" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Edit profile</Link>
        </div>
        <div className="flex items-start gap-3 p-5">
          <span className="rounded-lg bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><ShieldCheck className="h-5 w-5" /></span>
          <div><h2 className="font-semibold">Account & preferences</h2><p className="mt-1 text-sm leading-6 text-slate-500">Your profile, interview history, saved jobs, application intents, and email alert subscriptions are persisted to your account.</p></div>
        </div>
      </section>
    </div>
  );
}