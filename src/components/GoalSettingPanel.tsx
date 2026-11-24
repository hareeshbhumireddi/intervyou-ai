import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Flag,
  Minus,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { Alert, Button } from './ui';
import {
  createUserGoal,
  deleteUserGoal,
  subscribeUserGoals,
  updateUserGoal,
} from '../services/goalsService';
import type { GoalMetricType, InterviewSession, PracticeGoal } from '../types';

interface GoalSettingPanelProps {
  sessions: InterviewSession[];
  avgScore: number;
  bestScore: number;
}

const GOAL_TEMPLATES: {
  label: string;
  title: string;
  metricType: GoalMetricType;
  targetValue: number;
  unitLabel: string;
}[] = [
  {
    label: '10 Mock Interviews',
    title: '10 mock interviews completed',
    metricType: 'interviews_completed',
    targetValue: 10,
    unitLabel: 'interviews',
  },
  {
    label: '85% Avg Score',
    title: 'Reach 85% average interview score',
    metricType: 'average_score',
    targetValue: 85,
    unitLabel: '%',
  },
  {
    label: '90% Peak Score',
    title: 'Score 90%+ in a single mock session',
    metricType: 'best_score',
    targetValue: 90,
    unitLabel: '%',
  },
  {
    label: '20 Flashcard Drills',
    title: 'Complete 20 spaced-repetition flashcard reviews',
    metricType: 'custom',
    targetValue: 20,
    unitLabel: 'drills',
  },
];

const METRIC_LABELS: Record<GoalMetricType, string> = {
  interviews_completed: 'Auto-tracked · Completed interviews',
  average_score: 'Auto-tracked · Average score %',
  best_score: 'Auto-tracked · Best score %',
  custom: 'Manual milestone tracker',
};

function getLocalStorageKey(email?: string): string {
  const clean = (email || 'default').trim().toLowerCase();
  return `intervyou_goals_${clean}`;
}

export default function GoalSettingPanel({
  sessions,
  avgScore,
  bestScore,
}: GoalSettingPanelProps) {
  const { user, firebaseUid } = useAppState();

  const [goals, setGoals] = useState<PracticeGoal[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Composer / Edit form state
  const [titleInput, setTitleInput] = useState('');
  const [metricInput, setMetricInput] = useState<GoalMetricType>('interviews_completed');
  const [targetInput, setTargetInput] = useState<string>('10');
  const [unitInput, setUnitInput] = useState<string>('interviews');
  const [dateInput, setDateInput] = useState<string>('');

  const localKey = useMemo(() => getLocalStorageKey(user.email), [user.email]);

  const completedInterviewsCount = useMemo(
    () =>
      sessions.filter((s) => s.status === 'completed' || Boolean(s.overallReport)).length,
    [sessions]
  );

  // Subscribe to Firestore goals when Firebase Auth is active; fallback to localStorage otherwise
  useEffect(() => {
    if (!firebaseUid) {
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setGoals(parsed);
            return;
          }
        }
      } catch {
        // ignore corrupted cache
      }
      setGoals([]);
      return;
    }

    const unsub = subscribeUserGoals(
      firebaseUid,
      (cloudGoals) => setGoals(cloudGoals),
      (err) => setErrorMsg(err.message)
    );
    return () => unsub();
  }, [firebaseUid, localKey]);

  const persistLocalGoals = (next: PracticeGoal[]) => {
    setGoals(next);
    try {
      localStorage.setItem(localKey, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  // Compute live numeric value for any goal
  const resolveProgress = (goal: PracticeGoal) => {
    let liveValue = goal.currentValue;
    if (goal.metricType === 'interviews_completed') {
      liveValue = completedInterviewsCount;
    } else if (goal.metricType === 'average_score') {
      liveValue = avgScore;
    } else if (goal.metricType === 'best_score') {
      liveValue = bestScore;
    }
    const target = Math.max(1, goal.targetValue);
    const pct = Math.min(100, Math.round((liveValue / target) * 100));
    const isCompleted = goal.status === 'completed' || liveValue >= target;
    return {
      liveValue,
      target,
      pct,
      isCompleted,
      remaining: Math.max(0, target - liveValue),
    };
  };

  const enrichedGoals = useMemo(
    () =>
      goals.map((g) => ({
        goal: g,
        progress: resolveProgress(g),
      })),
    [goals, completedInterviewsCount, avgScore, bestScore]
  );

  const visibleGoals = useMemo(() => {
    if (filterStatus === 'active') {
      return enrichedGoals.filter((item) => !item.progress.isCompleted);
    }
    if (filterStatus === 'completed') {
      return enrichedGoals.filter((item) => item.progress.isCompleted);
    }
    return enrichedGoals;
  }, [enrichedGoals, filterStatus]);

  const completedCount = enrichedGoals.filter((item) => item.progress.isCompleted).length;
  const activeCount = enrichedGoals.length - completedCount;

  const openCreateForm = () => {
    setEditingGoalId(null);
    setTitleInput('');
    setMetricInput('interviews_completed');
    setTargetInput('10');
    setUnitInput('interviews');
    setDateInput('');
    setErrorMsg(null);
    setIsComposerOpen(true);
  };

  const openEditForm = (goal: PracticeGoal) => {
    setEditingGoalId(goal.id);
    setTitleInput(goal.title);
    setMetricInput(goal.metricType);
    setTargetInput(String(goal.targetValue));
    setUnitInput(goal.unitLabel);
    setDateInput(goal.targetDate || '');
    setErrorMsg(null);
    setIsComposerOpen(true);
  };

  const applyTemplate = (tpl: (typeof GOAL_TEMPLATES)[number]) => {
    setTitleInput(tpl.title);
    setMetricInput(tpl.metricType);
    setTargetInput(String(tpl.targetValue));
    setUnitInput(tpl.unitLabel);
  };

  const handleMetricTypeChange = (nextMetric: GoalMetricType) => {
    setMetricInput(nextMetric);
    if (nextMetric === 'interviews_completed') {
      setUnitInput('interviews');
      if (targetInput === '85' || targetInput === '90') setTargetInput('10');
    } else if (nextMetric === 'average_score' || nextMetric === 'best_score') {
      setUnitInput('%');
      if (Number(targetInput) < 40 || Number(targetInput) > 100) setTargetInput('85');
    } else {
      if (unitInput === '%' || unitInput === 'interviews') setUnitInput('tasks');
    }
  };

  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = titleInput.trim();
    const numericTarget = Math.max(1, Math.min(10000, Math.round(Number(targetInput) || 1)));
    const cleanUnit = unitInput.trim() || 'steps';
    if (!cleanTitle) {
      setErrorMsg('Please enter a clear goal title.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const autoCurrent =
        metricInput === 'interviews_completed'
          ? completedInterviewsCount
          : metricInput === 'average_score'
          ? avgScore
          : metricInput === 'best_score'
          ? bestScore
          : undefined;

      if (editingGoalId) {
        const existingGoal = goals.find((g) => g.id === editingGoalId);
        const currVal = autoCurrent ?? existingGoal?.currentValue ?? 0;
        const nextStatus: 'active' | 'completed' = currVal >= numericTarget ? 'completed' : 'active';

        if (firebaseUid) {
          await updateUserGoal(firebaseUid, editingGoalId, {
            title: cleanTitle,
            metricType: metricInput,
            unitLabel: cleanUnit,
            targetValue: numericTarget,
            currentValue: currVal,
            targetDate: dateInput,
            status: nextStatus,
          });
        } else {
          persistLocalGoals(
            goals.map((g) =>
              g.id === editingGoalId
                ? {
                    ...g,
                    title: cleanTitle,
                    metricType: metricInput,
                    unitLabel: cleanUnit,
                    targetValue: numericTarget,
                    currentValue: currVal,
                    targetDate: dateInput,
                    status: nextStatus,
                    updatedAt: new Date().toISOString(),
                  }
                : g
            )
          );
        }
      } else {
        const initialVal = autoCurrent ?? 0;
        if (firebaseUid) {
          await createUserGoal(firebaseUid, {
            title: cleanTitle,
            metricType: metricInput,
            unitLabel: cleanUnit,
            targetValue: numericTarget,
            currentValue: initialVal,
            targetDate: dateInput,
          });
        } else {
          const newGoal: PracticeGoal = {
            id: `goal_${Date.now()}`,
            userId: user.email || 'local',
            title: cleanTitle,
            metricType: metricInput,
            unitLabel: cleanUnit,
            targetValue: numericTarget,
            currentValue: initialVal,
            targetDate: dateInput,
            status: initialVal >= numericTarget ? 'completed' : 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          persistLocalGoals([newGoal, ...goals]);
        }
      }

      setIsComposerOpen(false);
      setEditingGoalId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save milestone.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustCustomProgress = async (goal: PracticeGoal, delta: number) => {
    const nextValue = Math.max(0, Math.min(10000, goal.currentValue + delta));
    const nextStatus: 'active' | 'completed' =
      nextValue >= goal.targetValue ? 'completed' : 'active';
    setBusyId(goal.id);
    setErrorMsg(null);
    try {
      if (firebaseUid) {
        await updateUserGoal(firebaseUid, goal.id, {
          currentValue: nextValue,
          status: nextStatus,
        });
      } else {
        persistLocalGoals(
          goals.map((g) =>
            g.id === goal.id
              ? { ...g, currentValue: nextValue, status: nextStatus, updatedAt: new Date().toISOString() }
              : g
          )
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not update milestone progress.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setBusyId(goalId);
    setErrorMsg(null);
    try {
      if (firebaseUid) {
        await deleteUserGoal(firebaseUid, goalId);
      } else {
        persistLocalGoals(goals.filter((g) => g.id !== goalId));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not delete milestone.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-labelledby="goal-setting-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Flag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>Milestones</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{activeCount} active</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{completedCount} completed</span>
          </div>
          <h2
            id="goal-setting-heading"
            className="mt-1 text-xl font-bold text-slate-900 dark:text-white"
          >
            Interview Preparation Goals
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Define target milestones and track automatic or manual progress directly on your dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {goals.length > 0 && (
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(['all', 'active', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterStatus(tab)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    filterStatus === tab
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={openCreateForm}
            className="px-3.5 py-2 text-xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Goal
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4">
          <Alert tone="error">{errorMsg}</Alert>
        </div>
      )}

      {/* Inline Goal Composer / Editor */}
      {isComposerOpen && (
        <form
          onSubmit={handleSubmitGoal}
          className="mt-5 space-y-4 border-b border-slate-100 pb-6 dark:border-slate-800"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingGoalId ? 'Update Milestone' : 'Create New Milestone'}
            </h3>
            <button
              type="button"
              onClick={() => setIsComposerOpen(false)}
              aria-label="Close goal form"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!editingGoalId && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Quick presets:
              </span>
              {GOAL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Milestone Title
              </label>
              <input
                type="text"
                required
                maxLength={140}
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. 10 mock interviews completed"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Progress Tracking
              </label>
              <select
                value={metricInput}
                onChange={(e) => handleMetricTypeChange(e.target.value as GoalMetricType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="interviews_completed">Mock Interviews Completed</option>
                <option value="average_score">Average Score (%)</option>
                <option value="best_score">Personal Best Score (%)</option>
                <option value="custom">Custom Manual Counter</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:col-span-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10000}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm tabular-nums text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Unit
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Date
              </label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm tabular-nums text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsComposerOpen(false)}
              className="text-xs whitespace-nowrap"
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="text-xs whitespace-nowrap">
              {editingGoalId ? 'Save Changes' : 'Create Milestone'}
            </Button>
          </div>
        </form>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No preparation milestones defined yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            Set a concrete target like completing 10 mock interviews or reaching an 85% average score to keep your preparation focused.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {GOAL_TEMPLATES.slice(0, 2).map((tpl) => (
              <Button
                key={tpl.label}
                type="button"
                variant="secondary"
                onClick={async () => {
                  setSaving(true);
                  const autoVal =
                    tpl.metricType === 'interviews_completed'
                      ? completedInterviewsCount
                      : tpl.metricType === 'average_score'
                      ? avgScore
                      : bestScore;
                  try {
                    if (firebaseUid) {
                      await createUserGoal(firebaseUid, {
                        title: tpl.title,
                        metricType: tpl.metricType,
                        unitLabel: tpl.unitLabel,
                        targetValue: tpl.targetValue,
                        currentValue: autoVal,
                      });
                    } else {
                      persistLocalGoals([
                        {
                          id: `goal_${Date.now()}`,
                          userId: user.email || 'local',
                          title: tpl.title,
                          metricType: tpl.metricType,
                          unitLabel: tpl.unitLabel,
                          targetValue: tpl.targetValue,
                          currentValue: autoVal,
                          status: autoVal >= tpl.targetValue ? 'completed' : 'active',
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      ]);
                    }
                  } catch (err: any) {
                    setErrorMsg(err?.message || 'Could not create goal.');
                  } finally {
                    setSaving(false);
                  }
                }}
                loading={saving}
                className="text-xs whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Set Goal: {tpl.title}
              </Button>
            ))}
          </div>
        </div>
      ) : visibleGoals.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No {filterStatus} goals right now.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {visibleGoals.map(({ goal, progress }) => (
            <div key={goal.id} className="py-4 first:pt-2 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {goal.title}
                    </h3>
                    {progress.isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Achieved
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        In Progress
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {METRIC_LABELS[goal.metricType]}
                    {goal.targetDate ? (
                      <>
                        {' · '}Target by{' '}
                        <span className="tabular-nums font-medium">
                          {new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString()}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>

                {/* Right Controls & Numeric Readout */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {progress.liveValue} / {progress.target} {goal.unitLabel}
                    </span>
                    <span className="ml-2 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                      ({progress.pct}%)
                    </span>
                  </div>

                  {goal.metricType === 'custom' && (
                    <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={busyId === goal.id || goal.currentValue <= 0}
                        onClick={() => handleAdjustCustomProgress(goal, -1)}
                        aria-label={`Decrease progress for ${goal.title}`}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === goal.id}
                        onClick={() => handleAdjustCustomProgress(goal, 1)}
                        aria-label={`Increase progress for ${goal.title}`}
                        className="border-l border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditForm(goal)}
                      aria-label={`Edit ${goal.title}`}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === goal.id}
                      onClick={() => handleDeleteGoal(goal.id)}
                      aria-label={`Delete ${goal.title}`}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2.5 flex items-center gap-3">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.target}
                  aria-valuenow={Math.min(progress.liveValue, progress.target)}
                  aria-label={`${goal.title} progress`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progress.isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>

                {!progress.isCompleted && goal.metricType !== 'custom' && (
                  <Link
                    to="/setup"
                    className="whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {progress.remaining} {goal.unitLabel} left →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
