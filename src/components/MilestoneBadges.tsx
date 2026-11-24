import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import type { InterviewSession, UserProfile } from '../types';

interface MilestoneBadgesProps {
  user: UserProfile;
  sessions: InterviewSession[];
  bestScore: number;
}

type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';
type FilterTab = 'all' | 'unlocked' | 'locked';

interface ComputedBadge {
  id: string;
  title: string;
  requirement: string;
  category: 'Volume' | 'Consistency' | 'Mastery' | 'Readiness';
  tier: BadgeTier;
  emblem: 'spark' | 'stack' | 'trophy' | 'flame' | 'target' | 'crown' | 'resume' | 'compass';
  unlocked: boolean;
  current: number;
  target: number;
  unit: string;
  unlockedAt?: string;
  actionLabel: string;
  actionTo: string;
}

const TIER_STYLES: Record<
  BadgeTier,
  {
    ring: string;
    fill: string;
    accent: string;
    label: string;
  }
> = {
  bronze: {
    ring: 'text-amber-700 dark:text-amber-400',
    fill: 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/60',
    accent: 'bg-amber-600',
    label: 'Bronze',
  },
  silver: {
    ring: 'text-sky-700 dark:text-sky-400',
    fill: 'bg-sky-50 dark:bg-sky-950/35 border-sky-200 dark:border-sky-800/60',
    accent: 'bg-sky-600',
    label: 'Silver',
  },
  gold: {
    ring: 'text-blue-700 dark:text-blue-400',
    fill: 'bg-blue-50 dark:bg-blue-950/35 border-blue-200 dark:border-blue-800/60',
    accent: 'bg-blue-600',
    label: 'Gold',
  },
  platinum: {
    ring: 'text-emerald-700 dark:text-emerald-400',
    fill: 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/60',
    accent: 'bg-emerald-600',
    label: 'Platinum',
  },
};

function toLocalDateKey(rawDate: string): string | null {
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDiff(prevKey: string, nextKey: string): number {
  const [py, pm, pd] = prevKey.split('-').map(Number);
  const [ny, nm, nd] = nextKey.split('-').map(Number);
  const a = Date.UTC(py, pm - 1, pd);
  const b = Date.UTC(ny, nm - 1, nd);
  return Math.round((b - a) / 86400000);
}

function computeStreakStats(completedAsc: InterviewSession[]): {
  currentStreak: number;
  longestStreak: number;
  sevenDayReachedAt?: string;
} {
  const uniqueDays: string[] = [];
  const seen = new Set<string>();
  for (const session of completedAsc) {
    const key = toLocalDateKey(session.date);
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueDays.push(key);
    }
  }
  uniqueDays.sort();

  if (uniqueDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longestStreak = 1;
  let running = 1;
  let sevenDayReachedAt: string | undefined;

  for (let i = 1; i < uniqueDays.length; i++) {
    if (dayDiff(uniqueDays[i - 1], uniqueDays[i]) === 1) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
      if (running >= 7 && !sevenDayReachedAt) {
        sevenDayReachedAt = uniqueDays[i];
      }
    } else {
      running = 1;
    }
  }

  // Current streak counts backwards from today or yesterday
  const todayKey = toLocalDateKey(new Date().toISOString())!;
  const lastDay = uniqueDays[uniqueDays.length - 1];
  const gapToToday = dayDiff(lastDay, todayKey);
  let currentStreak = 0;
  if (gapToToday <= 1) {
    currentStreak = 1;
    for (let i = uniqueDays.length - 2; i >= 0; i--) {
      if (dayDiff(uniqueDays[i], uniqueDays[i + 1]) === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak, sevenDayReachedAt };
}

function BadgeEmblem({
  emblem,
  unlocked,
  tier,
}: {
  emblem: ComputedBadge['emblem'];
  unlocked: boolean;
  tier: BadgeTier;
}) {
  const strokeClass = unlocked
    ? TIER_STYLES[tier].ring
    : 'text-slate-400 dark:text-slate-600';

  return (
    <div
      className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-[1.03] ${
        unlocked
          ? TIER_STYLES[tier].fill
          : 'border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/40'
      }`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className={`h-9 w-9 ${strokeClass}`}
      >
        {/* Outer octagonal medal frame */}
        <polygon
          points="16,4 32,4 44,16 44,32 32,44 16,44 4,32 4,16"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity={unlocked ? 0.12 : 0.03}
        />
        {emblem === 'spark' && (
          <path
            d="M24 12L26.8 21.2L36 24L26.8 26.8L24 36L21.2 26.8L12 24L21.2 21.2L24 12Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill={unlocked ? 'currentColor' : 'none'}
            fillOpacity={0.22}
          />
        )}
        {emblem === 'stack' && (
          <>
            <path d="M14 29L24 34L34 29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 24L24 29L34 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 19L24 14L34 19L24 24L14 19Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" fill={unlocked ? 'currentColor' : 'none'} fillOpacity={0.22} />
          </>
        )}
        {emblem === 'trophy' && (
          <>
            <path d="M17 15H31V22C31 25.87 27.87 29 24 29C20.13 29 17 25.87 17 22V15Z" stroke="currentColor" strokeWidth="2.2" fill={unlocked ? 'currentColor' : 'none'} fillOpacity={0.22} />
            <path d="M17 17H13.5C13.5 20.5 15 22.5 17 23M31 17H34.5C34.5 20.5 33 22.5 31 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M24 29V34M19 34H29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {emblem === 'flame' && (
          <path
            d="M25.5 12C25.5 12 32 17.5 32 24.5C32 29.19 28.42 33 24 33C19.58 33 16 29.19 16 24.5C16 21 17.8 18.2 19.5 16.5C19.8 19 21.3 20.2 22.5 20.2C22.2 16.8 23.7 13.8 25.5 12Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill={unlocked ? 'currentColor' : 'none'}
            fillOpacity={0.25}
          />
        )}
        {emblem === 'target' && (
          <>
            <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="2.1" />
            <circle cx="24" cy="24" r="5.5" stroke="currentColor" strokeWidth="2.1" />
            <circle cx="24" cy="24" r="2" fill="currentColor" />
          </>
        )}
        {emblem === 'crown' && (
          <path
            d="M13 31L15.5 18L21 23L24 15L27 23L32.5 18L35 31H13Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill={unlocked ? 'currentColor' : 'none'}
            fillOpacity={0.24}
          />
        )}
        {emblem === 'resume' && (
          <>
            <rect x="16" y="13" width="16" height="22" rx="2.5" stroke="currentColor" strokeWidth="2.1" fill={unlocked ? 'currentColor' : 'none'} fillOpacity={0.14} />
            <path d="M20 20H28M20 24.5H28M20 29H25" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </>
        )}
        {emblem === 'compass' && (
          <>
            <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="2.1" />
            <polygon
              points="28,20 25.5,25.5 20,28 22.5,22.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill={unlocked ? 'currentColor' : 'none'}
              fillOpacity={0.3}
            />
          </>
        )}
      </svg>
      {!unlocked && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <Lock className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

export default function MilestoneBadges({
  user,
  sessions,
  bestScore,
}: MilestoneBadgesProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  const badges = useMemo<ComputedBadge[]>(() => {
    const completedAsc = sessions
      .filter((s) => s.status === 'completed' || Boolean(s.overallReport))
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalCompleted = completedAsc.length;
    const streak = computeStreakStats(completedAsc);

    const uniqueDisciplines = new Set(
      completedAsc
        .map((s) => (s.roundLabel || s.interviewType || s.role || '').trim().toLowerCase())
        .filter(Boolean)
    ).size;

    const first80 = completedAsc.find((s) => (s.overallReport?.overallScore || 0) >= 80);
    const first90 = completedAsc.find((s) => (s.overallReport?.overallScore || 0) >= 90);

    const hasResumeOrWork =
      Boolean(user.resumeText && user.resumeText.trim().length > 40) ||
      Boolean(user.workHistory && user.workHistory.length > 0);
    const hasEnoughSkills = (user.skills?.length || 0) >= 3;
    const readinessSteps = (hasResumeOrWork ? 1 : 0) + (hasEnoughSkills ? 1 : 0);

    return [
      {
        id: 'first-mock',
        title: 'First Step',
        requirement: 'Complete your first evaluated mock interview',
        category: 'Volume',
        tier: 'bronze',
        emblem: 'spark',
        unlocked: totalCompleted >= 1,
        current: Math.min(totalCompleted, 1),
        target: 1,
        unit: 'session',
        unlockedAt: completedAsc[0]?.date,
        actionLabel: 'Take First Interview',
        actionTo: '/setup',
      },
      {
        id: 'five-mocks',
        title: '5 Mock Interviews',
        requirement: 'Complete 5 full mock interview sessions',
        category: 'Volume',
        tier: 'silver',
        emblem: 'stack',
        unlocked: totalCompleted >= 5,
        current: Math.min(totalCompleted, 5),
        target: 5,
        unit: 'sessions',
        unlockedAt: completedAsc[4]?.date,
        actionLabel: 'Practice Next Session',
        actionTo: '/setup',
      },
      {
        id: 'ten-mocks',
        title: '10 Mock Veteran',
        requirement: 'Complete 10 evaluated mock interview sessions',
        category: 'Volume',
        tier: 'gold',
        emblem: 'trophy',
        unlocked: totalCompleted >= 10,
        current: Math.min(totalCompleted, 10),
        target: 10,
        unit: 'sessions',
        unlockedAt: completedAsc[9]?.date,
        actionLabel: 'Start Mock Session',
        actionTo: '/setup',
      },
      {
        id: 'seven-day-streak',
        title: '7-Day Streak',
        requirement: 'Complete practice interviews across 7 consecutive days',
        category: 'Consistency',
        tier: 'platinum',
        emblem: 'flame',
        unlocked: streak.longestStreak >= 7,
        current: Math.min(Math.max(streak.currentStreak, streak.longestStreak), 7),
        target: 7,
        unit: 'days',
        unlockedAt: streak.sevenDayReachedAt,
        actionLabel: 'Keep Streak Going',
        actionTo: '/setup',
      },
      {
        id: 'high-scorer',
        title: 'High Scorer (80%+)',
        requirement: 'Achieve 80% or higher on any evaluated mock interview',
        category: 'Mastery',
        tier: 'silver',
        emblem: 'target',
        unlocked: bestScore >= 80,
        current: Math.min(bestScore, 80),
        target: 80,
        unit: '%',
        unlockedAt: first80?.date,
        actionLabel: 'Aim for 80%',
        actionTo: '/setup',
      },
      {
        id: 'elite-mastery',
        title: 'Peak Mastery (90%+)',
        requirement: 'Score 90% or above in a single evaluated interview',
        category: 'Mastery',
        tier: 'platinum',
        emblem: 'crown',
        unlocked: bestScore >= 90,
        current: Math.min(bestScore, 90),
        target: 90,
        unit: '%',
        unlockedAt: first90?.date,
        actionLabel: 'Challenge Advanced Mode',
        actionTo: '/setup',
      },
      {
        id: 'career-profile',
        title: 'Profile & Resume Ready',
        requirement: 'Add resume or LinkedIn work history plus at least 3 skills',
        category: 'Readiness',
        tier: 'bronze',
        emblem: 'resume',
        unlocked: readinessSteps >= 2,
        current: readinessSteps,
        target: 2,
        unit: 'steps',
        unlockedAt:
          readinessSteps >= 2
            ? user.linkedinProfile?.lastSyncedAt || user.resumeFile?.uploadedAt
            : undefined,
        actionLabel: 'Update Profile & Resume',
        actionTo: '/profile',
      },
      {
        id: 'versatile-rounds',
        title: 'All-Rounder (3+ Tracks)',
        requirement: 'Practice across 3 or more distinct roles or interview rounds',
        category: 'Readiness',
        tier: 'gold',
        emblem: 'compass',
        unlocked: uniqueDisciplines >= 3,
        current: Math.min(uniqueDisciplines, 3),
        target: 3,
        unit: 'tracks',
        unlockedAt: totalCompleted >= 3 ? completedAsc[2]?.date : undefined,
        actionLabel: 'Try Another Round',
        actionTo: '/setup',
      },
    ];
  }, [sessions, user, bestScore]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const lockedCount = badges.length - unlockedCount;

  const visibleBadges = useMemo(() => {
    if (filter === 'unlocked') return badges.filter((b) => b.unlocked);
    if (filter === 'locked') return badges.filter((b) => !b.unlocked);
    return badges;
  }, [badges, filter]);

  const selectedBadge = useMemo(
    () => badges.find((b) => b.id === selectedBadgeId) || null,
    [badges, selectedBadgeId]
  );

  return (
    <section
      aria-labelledby="milestone-badges-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Award className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>Achievements</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {unlockedCount} of {badges.length} unlocked
            </span>
          </div>
          <h2
            id="milestone-badges-heading"
            className="mt-1 text-xl font-bold text-slate-900 dark:text-white"
          >
            Milestone Badges
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Virtual awards earned automatically as you complete practice sessions, build streaks, and raise your scores.
          </p>
        </div>

        {/* Segmented Filter Controls */}
        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 dark:bg-slate-800 sm:self-auto">
          {(
            [
              { key: 'all', label: `All (${badges.length})` },
              { key: 'unlocked', label: `Earned (${unlockedCount})` },
              { key: 'locked', label: `In Progress (${lockedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                filter === tab.key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Badge Grid */}
      {visibleBadges.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {filter === 'unlocked'
              ? 'No badges earned yet'
              : 'You have unlocked every milestone badge'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filter === 'unlocked'
              ? 'Complete your first mock interview or update your resume profile to earn your first badge.'
              : 'All 8 preparation milestones are complete.'}
          </p>
          {filter === 'unlocked' && (
            <Link
              to="/setup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <span>Start Mock Interview</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleBadges.map((badge) => {
            const pct = Math.min(100, Math.round((badge.current / Math.max(1, badge.target)) * 100));
            const isSelected = selectedBadge?.id === badge.id;
            return (
              <button
                key={badge.id}
                type="button"
                onClick={() => setSelectedBadgeId(isSelected ? null : badge.id)}
                aria-expanded={isSelected}
                className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20'
                    : badge.unlocked
                    ? 'border-slate-200 bg-slate-50/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/35 dark:hover:border-slate-700'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <BadgeEmblem
                    emblem={badge.emblem}
                    unlocked={badge.unlocked}
                    tier={badge.tier}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      <span>{badge.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{TIER_STYLES[badge.tier].label}</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {badge.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {badge.requirement}
                    </p>
                  </div>
                </div>

                {/* Progress & Status Footer */}
                <div className="mt-4 space-y-2 border-t border-slate-200/60 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    {badge.unlocked ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Earned
                      </span>
                    ) : (
                      <span className="font-medium text-slate-500 dark:text-slate-400">
                        In Progress
                      </span>
                    )}
                    <span className="font-bold tabular-nums text-slate-800 dark:text-slate-200">
                      {badge.current}/{badge.target} {badge.unit}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={badge.target}
                    aria-valuenow={badge.current}
                    aria-label={`${badge.title} progress`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        badge.unlocked
                          ? 'bg-emerald-500'
                          : TIER_STYLES[badge.tier].accent
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Badge Detail Strip */}
      {selectedBadge && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white">
                {selectedBadge.title}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {selectedBadge.unlocked
                  ? selectedBadge.unlockedAt
                    ? `Unlocked on ${new Date(
                        /^\d{4}-\d{2}-\d{2}$/.test(selectedBadge.unlockedAt)
                          ? `${selectedBadge.unlockedAt}T00:00:00`
                          : selectedBadge.unlockedAt
                      ).toLocaleDateString()}`
                    : 'Unlocked'
                  : `${Math.max(0, selectedBadge.target - selectedBadge.current)} ${selectedBadge.unit} remaining`}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {selectedBadge.requirement}
            </p>
          </div>
          {!selectedBadge.unlocked && (
            <Link
              to={selectedBadge.actionTo}
              className="inline-flex items-center gap-1.5 self-start rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 sm:self-auto"
            >
              <span>{selectedBadge.actionLabel}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
