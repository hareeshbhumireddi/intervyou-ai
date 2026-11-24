import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Target, CheckCircle2, Flame, ArrowUpRight, Plus, SlidersHorizontal, Check } from 'lucide-react';
import { InterviewSession } from '../types';

interface WeeklyGoalRingProps {
  sessions: InterviewSession[];
  defaultGoal?: number;
  variant?: 'card' | 'stat-widget';
}

const STORAGE_KEY_GOAL = 'intervyou_weekly_goal';

export function getWeeklyProgress(sessions: InterviewSession[], targetGoal: number) {
  const now = new Date();
  
  // Calculate Monday of current week
  const day = now.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // Sunday of current week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Filter sessions in current calendar week
  const completedThisWeek = sessions.filter((s) => {
    const d = new Date(s.date);
    if (isNaN(d.getTime())) return false;
    const inWeek = d >= monday && d <= sunday;
    const isCompleted = s.status ? s.status === 'completed' : true;
    return inWeek && isCompleted;
  }).length;

  const percentage = Math.min(Math.round((completedThisWeek / targetGoal) * 100), 100);
  const remaining = Math.max(targetGoal - completedThisWeek, 0);
  const daysLeft = 7 - (day === 0 ? 7 : day);

  // Daily activity status for Monday through Sunday
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    const dStr = d.toISOString().split('T')[0];
    const isToday = d.toDateString() === now.toDateString();
    const hasPracticed = sessions.some((s) => {
      const isCompleted = s.status ? s.status === 'completed' : true;
      return isCompleted && s.date && s.date.startsWith(dStr);
    });
    return {
      label: dayLabels[offset],
      isToday,
      hasPracticed,
    };
  });

  return {
    completedThisWeek,
    targetGoal,
    percentage,
    remaining,
    daysLeft,
    weekDays,
    isGoalAchieved: completedThisWeek >= targetGoal,
  };
}

export default function WeeklyGoalRing({
  sessions,
  defaultGoal = 5,
  variant = 'card',
}: WeeklyGoalRingProps) {
  const [goal, setGoal] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GOAL);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 20) return parsed;
    }
    return defaultGoal;
  });

  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const stats = useMemo(() => getWeeklyProgress(sessions, goal), [sessions, goal]);

  const handleGoalChange = (newGoal: number) => {
    setGoal(newGoal);
    localStorage.setItem(STORAGE_KEY_GOAL, newGoal.toString());
    setIsEditingGoal(false);
  };

  // Ring geometry
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - stats.percentage / 100);

  const ringColor = stats.isGoalAchieved
    ? 'stroke-emerald-500'
    : stats.percentage >= 60
    ? 'stroke-blue-600'
    : stats.percentage >= 30
    ? 'stroke-indigo-500'
    : 'stroke-sky-500';

  if (variant === 'stat-widget') {
    return (
      <div className="flex items-center justify-between gap-3 h-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Weekly Goal</span>
            {stats.isGoalAchieved ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Met
              </span>
            ) : (
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {stats.remaining} to go
              </span>
            )}
          </div>
          <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
            {stats.completedThisWeek} <span className="text-xs font-bold text-slate-400">/ {stats.targetGoal}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {stats.isGoalAchieved ? 'Target completed!' : `${stats.daysLeft} days remaining`}
          </p>
        </div>

        {/* Compact Visual Progress Ring */}
        <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`Weekly mock interview progress: ${stats.percentage}%`}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="9"
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`transition-all duration-700 ease-out ${ringColor}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white">
              {stats.percentage}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 flex flex-col justify-between h-full">
      <div>
        {/* Card Header with Goal Adjuster */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 shadow-xs">
              <Target className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Weekly Progress</h2>
                {stats.isGoalAchieved && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Goal Reached
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Weekly interview goal tracker</p>
            </div>
          </div>

          {/* Goal adjuster toggle */}
          <div className="relative">
            <button
              onClick={() => setIsEditingGoal(!isEditingGoal)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              title="Adjust weekly target interviews"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Goal: {stats.targetGoal}</span>
            </button>

            {isEditingGoal && (
              <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Interviews per week:</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[3, 5, 7, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleGoalChange(num)}
                      className={`rounded-xl py-1.5 text-xs font-bold transition ${
                        stats.targetGoal === num
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Visual Progress Ring & Stats Section */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-5">
            {/* Large SVG Circular Progress Ring */}
            <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Weekly progress: ${stats.percentage}%, ${stats.completedThisWeek} of ${stats.targetGoal} completed`}>
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  strokeWidth="8.5"
                  className="stroke-slate-100 dark:stroke-slate-800"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  strokeWidth="8.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={`transition-all duration-700 ease-out ${ringColor}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white leading-tight">
                  {stats.percentage}%
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-400">
                  {stats.completedThisWeek}/{stats.targetGoal}
                </span>
              </div>
            </div>

            {/* Motivational Text & Remaining Count */}
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-base font-black text-slate-900 dark:text-white block">
                {stats.completedThisWeek} of {stats.targetGoal} Completed
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                {stats.isGoalAchieved ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    🎉 Outstanding! You reached your goal of {stats.targetGoal} mock interviews this week.
                  </span>
                ) : stats.completedThisWeek > 0 ? (
                  <span>
                    Complete <strong className="text-slate-900 dark:text-white">{stats.remaining} more</strong> session{stats.remaining > 1 ? 's' : ''} to achieve your goal.
                  </span>
                ) : (
                  <span>Take your first mock interview this week to start filling the progress ring.</span>
                )}
              </p>
            </div>
          </div>

          {/* Day of Week Consistency Track (M T W T F S S) */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold">This Week's Activity:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {stats.daysLeft} days left
              </span>
            </div>

            <div className="flex items-center justify-between gap-1 pt-0.5">
              {stats.weekDays.map((d, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      d.hasPracticed
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : d.isToday
                        ? 'border-2 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                        : 'bg-slate-200/70 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    }`}
                    title={d.hasPracticed ? 'Mock interview completed' : d.isToday ? 'Today' : undefined}
                  >
                    {d.hasPracticed ? <Check className="h-3.5 w-3.5" /> : d.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400 font-medium">
          Goal: {stats.targetGoal} interviews / week
        </span>
        <Link
          to="/setup"
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <span>Start Interview</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
