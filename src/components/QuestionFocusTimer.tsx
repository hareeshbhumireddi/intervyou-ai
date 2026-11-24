import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';
import {
  getNotificationPermission,
  playNotificationChime,
  requestNotificationPermission,
  sendFocusTimerNotification,
} from '../utils/notificationService';
import { TOGGLE_FOCUS_TIMER_EVENT } from '../utils/keyboardShortcuts';

interface QuestionFocusTimerProps {
  questionKey: string;
  defaultDurationSeconds?: number;
  isExternallyPaused?: boolean;
  contextLabel?: string;
  onTimeExpired?: () => void;
}

interface TimerPreferences {
  enabled: boolean;
  durationSeconds: number;
  soundEnabled: boolean;
  desktopAlertsEnabled: boolean;
  autoAdvance: boolean;
}

const STORAGE_KEY = 'intervyou_question_focus_timer';

const PRESET_DURATIONS = [
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
] as const;

function loadPreferences(defaultDurationSeconds: number): TimerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TimerPreferences>;
      return {
        enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
        durationSeconds:
          typeof parsed.durationSeconds === 'number' && parsed.durationSeconds >= 15
            ? Math.min(1800, parsed.durationSeconds)
            : defaultDurationSeconds,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        desktopAlertsEnabled:
          typeof parsed.desktopAlertsEnabled === 'boolean' ? parsed.desktopAlertsEnabled : true,
        autoAdvance: Boolean(parsed.autoAdvance),
      };
    }
  } catch {
    // fallback to defaults
  }
  return {
    enabled: true,
    durationSeconds: defaultDurationSeconds,
    soundEnabled: true,
    desktopAlertsEnabled: true,
    autoAdvance: false,
  };
}

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function QuestionFocusTimer({
  questionKey,
  defaultDurationSeconds = 120,
  isExternallyPaused = false,
  contextLabel,
  onTimeExpired,
}: QuestionFocusTimerProps) {
  const [prefs, setPrefs] = useState<TimerPreferences>(() =>
    loadPreferences(defaultDurationSeconds)
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(prefs.durationSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(prefs.enabled);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [customMinutes, setCustomMinutes] = useState<string>(
    String(Math.floor(prefs.durationSeconds / 60))
  );
  const [customSeconds, setCustomSeconds] = useState<string>(
    String(prefs.durationSeconds % 60)
  );
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [bannerAlert, setBannerAlert] = useState<string | null>(null);

  const warned30Ref = useRef(false);
  const expiredTriggeredRef = useRef(false);
  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;
  const contextLabelRef = useRef(contextLabel);
  contextLabelRef.current = contextLabel;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore storage quota errors
    }
  }, [prefs]);

  // Reset countdown whenever the interview advances to a new question
  useEffect(() => {
    warned30Ref.current = false;
    expiredTriggeredRef.current = false;
    setBannerAlert(null);
    setSecondsLeft(prefs.durationSeconds);
    setIsRunning(prefs.enabled);
  }, [questionKey, prefs.durationSeconds, prefs.enabled]);

  const toggleShortcutRef = useRef<() => void>(() => {});
  toggleShortcutRef.current = () => {
    if (!prefs.enabled) {
      applyDuration(prefs.durationSeconds);
      return;
    }
    if (secondsLeft <= 0) return;
    setIsRunning((prev) => !prev);
  };

  useEffect(() => {
    const onToggleShortcut = () => {
      toggleShortcutRef.current();
    };
    window.addEventListener(TOGGLE_FOCUS_TIMER_EVENT, onToggleShortcut);
    return () => window.removeEventListener(TOGGLE_FOCUS_TIMER_EVENT, onToggleShortcut);
  }, []);

  // Countdown tick with 30-second Web Notification alert
  useEffect(() => {
    if (!prefs.enabled || !isRunning || isExternallyPaused) return;
    if (secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Math.max(0, prev - 1);

        // Alert cleanly when entering the last 30 seconds
        if (prefs.durationSeconds > 30 && prev > 30 && next <= 30 && !warned30Ref.current) {
          warned30Ref.current = true;
          setBannerAlert('Last 30 seconds remaining — begin wrapping up your answer.');
          if (prefs.soundEnabled) {
            playNotificationChime();
          }
          if (prefs.desktopAlertsEnabled && getNotificationPermission() === 'granted') {
            sendFocusTimerNotification(30, contextLabelRef.current);
          }
        }

        if (next === 0 && !expiredTriggeredRef.current) {
          expiredTriggeredRef.current = true;
          setIsRunning(false);
          setBannerAlert('Time limit reached — wrap up or advance.');
          if (prefs.soundEnabled) {
            playNotificationChime();
          }
          if (prefs.desktopAlertsEnabled && getNotificationPermission() === 'granted') {
            sendFocusTimerNotification(0, contextLabelRef.current);
          }
          if (prefs.autoAdvance && onTimeExpiredRef.current) {
            onTimeExpiredRef.current();
          }
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    prefs.enabled,
    prefs.durationSeconds,
    prefs.soundEnabled,
    prefs.desktopAlertsEnabled,
    prefs.autoAdvance,
    isRunning,
    isExternallyPaused,
    secondsLeft,
  ]);

  const handleToggleDesktopAlerts = async () => {
    if (permission === 'unsupported') return;

    if (permission === 'default') {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === 'granted') {
        setPrefs((prev) => ({ ...prev, desktopAlertsEnabled: true }));
        sendFocusTimerNotification(30, contextLabel || 'Interview Room Test');
      }
      return;
    }

    if (permission === 'granted') {
      setPrefs((prev) => ({ ...prev, desktopAlertsEnabled: !prev.desktopAlertsEnabled }));
    }
  };

  const applyDuration = (totalSecs: number) => {
    const clamped = Math.max(15, Math.min(1800, Math.round(totalSecs)));
    warned30Ref.current = false;
    expiredTriggeredRef.current = false;
    setBannerAlert(null);
    setPrefs((prev) => ({ ...prev, enabled: true, durationSeconds: clamped }));
    setSecondsLeft(clamped);
    setIsRunning(true);
    setCustomMinutes(String(Math.floor(clamped / 60)));
    setCustomSeconds(String(clamped % 60));
  };

  const handleApplyCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const mins = Math.max(0, Number(customMinutes) || 0);
    const secs = Math.max(0, Math.min(59, Number(customSeconds) || 0));
    const total = mins * 60 + secs;
    if (total < 15) return;
    applyDuration(total);
    setIsConfigOpen(false);
  };

  const handleResetQuestionTimer = () => {
    warned30Ref.current = false;
    expiredTriggeredRef.current = false;
    setBannerAlert(null);
    setSecondsLeft(prefs.durationSeconds);
    if (prefs.enabled) setIsRunning(true);
  };

  const ratio =
    prefs.durationSeconds > 0
      ? Math.max(0, Math.min(1, secondsLeft / prefs.durationSeconds))
      : 0;

  const isExpired = prefs.enabled && secondsLeft === 0;
  const isWarning =
    prefs.enabled &&
    secondsLeft > 0 &&
    secondsLeft <= (prefs.durationSeconds > 30 ? 30 : Math.floor(prefs.durationSeconds * 0.4));

  const statusText = !prefs.enabled
    ? 'Timer Off'
    : isExpired
    ? 'Time Up'
    : isExternallyPaused
    ? 'Evaluating'
    : !isRunning
    ? 'Paused'
    : isWarning
    ? 'Last 30s'
    : 'On Pace';

  const statusColorClass = !prefs.enabled
    ? 'text-slate-500 dark:text-slate-400'
    : isExpired
    ? 'text-red-600 dark:text-red-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const barColorClass = !prefs.enabled
    ? 'bg-slate-300 dark:bg-slate-700'
    : isExpired
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-blue-600';

  const desktopAlertsActive =
    permission === 'granted' && prefs.desktopAlertsEnabled;

  return (
    <section
      aria-label="Question focus timer"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-5"
    >
      {/* Top Row: Title, Status, and Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Timer className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Focus Timer</h3>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className={`text-xs font-semibold ${statusColorClass}`}>{statusText}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Per-question pacing limit ({formatSeconds(prefs.durationSeconds)}) · Space to pause
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {permission !== 'unsupported' && (
            <button
              type="button"
              onClick={handleToggleDesktopAlerts}
              disabled={permission === 'denied'}
              aria-label={
                permission === 'default'
                  ? 'Enable desktop 30-second notifications'
                  : desktopAlertsActive
                  ? 'Disable desktop notifications'
                  : 'Enable desktop notifications'
              }
              title={
                permission === 'denied'
                  ? 'Desktop notifications blocked in browser settings'
                  : permission === 'default'
                  ? 'Enable desktop alert at 30 seconds remaining'
                  : desktopAlertsActive
                  ? 'Desktop 30s notification active (click to mute)'
                  : 'Desktop 30s notification muted (click to enable)'
              }
              className={`rounded-lg border p-2 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                desktopAlertsActive
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setPrefs((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
            }
            aria-label={prefs.soundEnabled ? 'Mute sound chimes' : 'Enable sound chimes'}
            title={prefs.soundEnabled ? 'Sound chimes on' : 'Sound chimes muted'}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            {prefs.soundEnabled ? (
              <Bell className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            ) : (
              <BellOff className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsConfigOpen((prev) => !prev)}
            aria-expanded={isConfigOpen}
            aria-label="Configure focus timer"
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              isConfigOpen
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Configure</span>
          </button>
        </div>
      </div>

      {/* Countdown Readout & Play/Pause/Reset */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="timer"
          aria-live="polite"
          className={`text-3xl font-black tracking-tight tabular-nums ${
            !prefs.enabled
              ? 'text-slate-400 dark:text-slate-500'
              : isExpired
              ? 'text-red-600 dark:text-red-400'
              : isWarning
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-900 dark:text-white'
          }`}
        >
          {prefs.enabled ? formatSeconds(secondsLeft) : '--:--'}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {prefs.enabled ? (
            <>
              <button
                type="button"
                onClick={() => setIsRunning((prev) => !prev)}
                disabled={isExpired}
                aria-keyshortcuts="Space"
                title={isRunning ? 'Pause timer (Space)' : 'Resume timer (Space)'}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Resume</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetQuestionTimer}
                aria-label="Reset question timer"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => applyDuration(prefs.durationSeconds)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span>Enable Timer</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={prefs.durationSeconds}
        aria-valuenow={prefs.enabled ? secondsLeft : 0}
        aria-label="Time remaining for current question"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
          style={{ width: `${prefs.enabled ? Math.round(ratio * 100) : 0}%` }}
        />
      </div>

      {/* Quick Presets Strip */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              setBannerAlert(null);
              setPrefs((prev) => ({ ...prev, enabled: false }));
            }}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              !prefs.enabled
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Off
          </button>
          {PRESET_DURATIONS.map((preset) => {
            const active = prefs.enabled && prefs.durationSeconds === preset.seconds;
            return (
              <button
                key={preset.seconds}
                type="button"
                onClick={() => applyDuration(preset.seconds)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Permission Status / Quick Opt-In */}
        {prefs.enabled && permission === 'default' && (
          <button
            type="button"
            onClick={handleToggleDesktopAlerts}
            className="whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
          >
            Enable 30s desktop alerts
          </button>
        )}
        {prefs.enabled && permission === 'granted' && prefs.desktopAlertsEnabled && !bannerAlert && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Desktop alert at 00:30
          </span>
        )}
        {prefs.enabled && permission === 'denied' && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Browser notifications blocked
          </span>
        )}
      </div>

      {/* In-App 30-Second / Expiration Alert Strip */}
      {bannerAlert && prefs.enabled && (
        <div
          role="status"
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${
            isExpired
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
          }`}
        >
          {bannerAlert}
        </div>
      )}

      {/* Expandable Custom Configuration Panel */}
      {isConfigOpen && (
        <form
          onSubmit={handleApplyCustom}
          className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="focus-timer-mins"
                className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Minutes
              </label>
              <input
                id="focus-timer-mins"
                type="number"
                min={0}
                max={30}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm tabular-nums text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="focus-timer-secs"
                className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Seconds
              </label>
              <input
                id="focus-timer-secs"
                type="number"
                min={0}
                max={59}
                value={customSeconds}
                onChange={(e) => setCustomSeconds(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm tabular-nums text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            {permission !== 'unsupported' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.desktopAlertsEnabled && permission !== 'denied'}
                    disabled={permission === 'denied'}
                    onChange={handleToggleDesktopAlerts}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Desktop notification at 30s remaining</span>
                </label>
                {permission === 'granted' && (
                  <button
                    type="button"
                    onClick={() => sendFocusTimerNotification(30, contextLabel || 'Interview Room')}
                    className="whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                  >
                    Test Alert
                  </button>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.autoAdvance}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, autoAdvance: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-submit / advance when time expires</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Min 15s · Max 30m</span>
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
            >
              Apply Limit
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
