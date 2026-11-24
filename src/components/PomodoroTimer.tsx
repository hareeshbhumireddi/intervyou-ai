import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Clock, Sparkles, CheckCircle2, Coffee, BookOpen, Volume2 } from 'lucide-react';
import { playNotificationChime, sendBrowserNotification } from '../utils/notificationService';

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

const MODE_CONFIG: Record<PomodoroMode, { label: string; duration: number; color: string; icon: typeof Clock }> = {
  focus: { label: 'Study Focus', duration: 25 * 60, color: 'text-blue-600 dark:text-blue-400', icon: BookOpen },
  shortBreak: { label: 'Short Break', duration: 5 * 60, color: 'text-emerald-600 dark:text-emerald-400', icon: Coffee },
  longBreak: { label: 'Long Break', duration: 15 * 60, color: 'text-purple-600 dark:text-purple-400', icon: Sparkles },
};

export default function PomodoroTimer() {
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [timeLeft, setTimeLeft] = useState(MODE_CONFIG.focus.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [focusTopic, setFocusTopic] = useState('Interview Prep & Concepts');
  const [isEditingTopic, setIsEditingTopic] = useState(false);

  // Keep ref to avoid stale closure in timer
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Change mode
  const switchMode = (newMode: PomodoroMode) => {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(MODE_CONFIG[newMode].duration);
  };

  // Timer countdown
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          playNotificationChime();

          if (mode === 'focus') {
            setCompletedSessions((c) => c + 1);
            const nextMode = (completedSessions + 1) % 4 === 0 ? 'longBreak' : 'shortBreak';
            sendBrowserNotification('25m Study Sprint Complete! 🎉', {
              body: `Great job on ${focusTopic}! Time for a ${nextMode === 'longBreak' ? '15-minute long' : '5-minute'} break.`,
            });
            switchMode(nextMode);
          } else {
            sendBrowserNotification('Break Finished! 🔔', {
              body: 'Ready for another 25-minute interview preparation sprint?',
            });
            switchMode('focus');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, mode, completedSessions, focusTopic]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(MODE_CONFIG[mode].duration);
  };

  const skipInterval = () => {
    setIsRunning(false);
    if (mode === 'focus') {
      switchMode('shortBreak');
    } else {
      switchMode('focus');
    }
  };

  // Time calculations
  const totalDuration = MODE_CONFIG[mode].duration;
  const progressPercent = Math.min(100, Math.max(0, Math.round(((totalDuration - timeLeft) / totalDuration) * 100)));
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // SVG Progress Ring Geometry
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - (totalDuration - timeLeft) / totalDuration);

  const ringStroke =
    mode === 'focus'
      ? 'stroke-blue-600 dark:stroke-blue-500'
      : mode === 'shortBreak'
      ? 'stroke-emerald-500 dark:stroke-emerald-400'
      : 'stroke-purple-600 dark:stroke-purple-400';

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
              Pomodoro Study Focus Timer
            </h3>
            <p className="text-xs text-slate-500">
              Structure your interview prep into focused 25-minute sprints with planned recovery intervals.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['focus', 'shortBreak', 'longBreak'] as PomodoroMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === m
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {MODE_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
        {/* SVG Circular Countdown Ring */}
        <div className="relative h-40 w-40 shrink-0" role="timer" aria-live="polite">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              strokeWidth="10"
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-300 ease-linear ${ringStroke}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              {formattedTime}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {MODE_CONFIG[mode].label}
            </span>
          </div>
        </div>

        {/* Controls & Focus Context */}
        <div className="flex-1 space-y-4 text-center sm:text-left">
          {/* Current Focus Topic */}
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Current Study Target:
              </span>
              <button
                onClick={() => setIsEditingTopic(!isEditingTopic)}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                {isEditingTopic ? 'Done' : 'Edit'}
              </button>
            </div>
            {isEditingTopic ? (
              <input
                type="text"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTopic(false)}
                className="mt-1 w-full max-w-sm rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            ) : (
              <p className="mt-1 font-bold text-slate-800 dark:text-slate-200 text-sm">
                "{focusTopic}"
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <button
              onClick={toggleTimer}
              className={`inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold text-white shadow-md transition ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="h-4 w-4" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" /> Start Focus
                </>
              )}
            </button>

            <button
              onClick={resetTimer}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Reset current interval"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>

            <button
              onClick={skipInterval}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Skip to next interval"
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip
            </button>
          </div>

          {/* Interval Progress Dots */}
          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-slate-500">
            <span>Interval Cycle:</span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((idx) => {
                const isComplete = idx < completedSessions % 4;
                const isCurrent = idx === completedSessions % 4;
                return (
                  <span
                    key={idx}
                    className={`h-3 w-3 rounded-full transition ${
                      isComplete
                        ? 'bg-blue-600'
                        : isCurrent && isRunning
                        ? 'bg-blue-400 animate-pulse'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    title={`Interval ${idx + 1}`}
                  />
                );
              })}
            </div>
            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
              ({completedSessions} completed)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
