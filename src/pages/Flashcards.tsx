import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  Layers,
  Plus,
  RotateCcw,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import {
  BUILTIN_FLASHCARDS,
  computeNextSchedule,
  Flashcard,
  FlashcardCategory,
  FlashcardDifficulty,
  FlashcardProgressMap,
  formatIntervalLabel,
  getMasteryStage,
  ReviewRating,
} from '../utils/spacedRepetition';

type StudyViewMode = 'due' | 'cram' | 'deck';
type CategoryFilter = 'All' | FlashcardCategory;

const CATEGORIES: CategoryFilter[] = [
  'All',
  'Behavioral',
  'Data Structures & Algorithms',
  'System Design',
  'Frontend & Web',
];

const RATING_OPTIONS: Array<{
  id: ReviewRating;
  label: string;
  shortcut: string;
  styleClass: string;
}> = [
  {
    id: 'again',
    label: 'Again',
    shortcut: '1',
    styleClass:
      'border-red-200 bg-red-50/70 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60',
  },
  {
    id: 'hard',
    label: 'Hard',
    shortcut: '2',
    styleClass:
      'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/60',
  },
  {
    id: 'good',
    label: 'Good',
    shortcut: '3',
    styleClass:
      'border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/60',
  },
  {
    id: 'easy',
    label: 'Easy',
    shortcut: '4',
    styleClass:
      'border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/60',
  },
];

function startOfTodayMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function formatDueDate(nextReviewAt: number, now: number): string {
  if (nextReviewAt <= now) return 'Due now';
  const diffDays = Math.max(1, Math.ceil((nextReviewAt - now) / (24 * 60 * 60 * 1000)));
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

export default function Flashcards() {
  const { user } = useAppState();
  const storageSuffix = (user.email || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const progressStorageKey = `intervyou_flashcards_progress_${storageSuffix}`;
  const customCardsStorageKey = `intervyou_flashcards_custom_${storageSuffix}`;

  const [progress, setProgress] = useState<FlashcardProgressMap>({});
  const [customCards, setCustomCards] = useState<Flashcard[]>([]);
  const [viewMode, setViewMode] = useState<StudyViewMode>('due');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [requeuedIds, setRequeuedIds] = useState<string[]>([]);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Add Custom Card Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<FlashcardCategory>('Behavioral');
  const [newDifficulty, setNewDifficulty] = useState<FlashcardDifficulty>('Intermediate');
  const [newQuestion, setNewQuestion] = useState('');
  const [newHint, setNewHint] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [formError, setFormError] = useState('');

  // Load persisted progress & custom cards per user
  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(progressStorageKey);
      setProgress(savedProgress ? (JSON.parse(savedProgress) as FlashcardProgressMap) : {});
    } catch {
      setProgress({});
    }
    try {
      const savedCustom = localStorage.getItem(customCardsStorageKey);
      setCustomCards(savedCustom ? (JSON.parse(savedCustom) as Flashcard[]) : []);
    } catch {
      setCustomCards([]);
    }
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setRequeuedIds([]);
  }, [progressStorageKey, customCardsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify(progress));
    } catch {
      // ignore quota errors
    }
  }, [progress, progressStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(customCardsStorageKey, JSON.stringify(customCards));
    } catch {
      // ignore quota errors
    }
  }, [customCards, customCardsStorageKey]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const allCards = useMemo(() => [...BUILTIN_FLASHCARDS, ...customCards], [customCards]);

  const now = Date.now();
  const todayStart = startOfTodayMs();

  const stats = useMemo(() => {
    let dueCount = 0;
    let masteredCount = 0;
    let reviewedToday = 0;
    let goodOrEasyCount = 0;
    let totalRatedCount = 0;

    for (const card of allCards) {
      const sched = progress[card.id];
      if (!sched || sched.nextReviewAt <= now) {
        dueCount += 1;
      }
      if (getMasteryStage(sched) === 'Mastered') {
        masteredCount += 1;
      }
      if (sched?.lastReviewedAt && sched.lastReviewedAt >= todayStart) {
        reviewedToday += 1;
      }
      if (sched?.lastRating) {
        totalRatedCount += 1;
        if (sched.lastRating === 'good' || sched.lastRating === 'easy') {
          goodOrEasyCount += 1;
        }
      }
    }

    const retentionRate =
      totalRatedCount > 0 ? Math.round((goodOrEasyCount / totalRatedCount) * 100) : 100;

    return {
      dueCount,
      masteredCount,
      reviewedToday,
      retentionRate,
      totalCards: allCards.length,
    };
  }, [allCards, progress, now, todayStart]);

  const filteredCards = useMemo(() => {
    const byCategory =
      categoryFilter === 'All'
        ? allCards
        : allCards.filter((card) => card.category === categoryFilter);

    if (viewMode === 'cram' || viewMode === 'deck') {
      return byCategory;
    }

    // Due mode: cards due now, ordered with unseen/overdue first and requeued ("Again") cards at end
    const requeuedSet = new Set(requeuedIds);
    const dueCards = byCategory.filter((card) => {
      const sched = progress[card.id];
      return !sched || sched.nextReviewAt <= Date.now() || requeuedSet.has(card.id);
    });

    return dueCards.sort((a, b) => {
      const aRequeued = requeuedSet.has(a.id) ? 1 : 0;
      const bRequeued = requeuedSet.has(b.id) ? 1 : 0;
      if (aRequeued !== bRequeued) return aRequeued - bRequeued;
      const aNext = progress[a.id]?.nextReviewAt ?? 0;
      const bNext = progress[b.id]?.nextReviewAt ?? 0;
      return aNext - bNext;
    });
  }, [allCards, categoryFilter, progress, requeuedIds, viewMode]);

  // Keep currentIndex bounded
  useEffect(() => {
    if (filteredCards.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= filteredCards.length) {
      setCurrentIndex(0);
    }
  }, [filteredCards.length, currentIndex]);

  const activeCard = filteredCards[currentIndex] || null;
  const activeSchedule = activeCard ? progress[activeCard.id] : undefined;

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const handleToggleSpeech = useCallback(() => {
    if (
      !activeCard ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }

    if (isSpeaking) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = isFlipped
      ? `${activeCard.answer} Key points: ${activeCard.keyPoints.join('. ')}`
      : activeCard.question;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [activeCard, isFlipped, isSpeaking, stopSpeech]);

  const handleRateCard = useCallback(
    (rating: ReviewRating) => {
      if (!activeCard) return;
      stopSpeech();

      const updatedSchedule = computeNextSchedule(progress[activeCard.id], rating);
      setProgress((prev) => ({
        ...prev,
        [activeCard.id]: updatedSchedule,
      }));
      setSessionReviewed((prev) => prev + 1);

      if (rating === 'again') {
        setRequeuedIds((prev) => [...prev.filter((id) => id !== activeCard.id), activeCard.id]);
      } else {
        setRequeuedIds((prev) => prev.filter((id) => id !== activeCard.id));
      }

      setIsFlipped(false);
      setShowHint(false);

      if (viewMode === 'cram' && filteredCards.length > 0) {
        setCurrentIndex((prev) => (prev + 1) % filteredCards.length);
      } else {
        setCurrentIndex(0);
      }
    },
    [activeCard, filteredCards.length, progress, stopSpeech, viewMode]
  );

  // Keyboard shortcuts during study
  useEffect(() => {
    if (viewMode === 'deck' || isAddModalOpen || !activeCard) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        stopSpeech();
        setIsFlipped((prev) => !prev);
      } else if (event.key.toLowerCase() === 'h' && !isFlipped) {
        event.preventDefault();
        setShowHint((prev) => !prev);
      } else if (isFlipped) {
        if (event.key === '1') handleRateCard('again');
        if (event.key === '2') handleRateCard('hard');
        if (event.key === '3') handleRateCard('good');
        if (event.key === '4') handleRateCard('easy');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCard, handleRateCard, isAddModalOpen, isFlipped, stopSpeech, viewMode]);

  const handleAddCustomCard = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQ = newQuestion.trim();
    const trimmedA = newAnswer.trim();

    if (!trimmedQ || !trimmedA) {
      setFormError('Please provide both a question prompt and a model answer.');
      return;
    }

    const parsedPoints = newKeyPoint
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const card: Flashcard = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: newCategory,
      difficulty: newDifficulty,
      question: trimmedQ,
      hint: newHint.trim() || 'Structure your answer clearly with concrete examples and trade-offs.',
      answer: trimmedA,
      keyPoints: parsedPoints.length
        ? parsedPoints
        : ['Clear structure and terminology', 'Concrete example or measurable trade-off'],
      isCustom: true,
    };

    setCustomCards((prev) => [card, ...prev]);
    setNewQuestion('');
    setNewHint('');
    setNewAnswer('');
    setNewKeyPoint('');
    setFormError('');
    setIsAddModalOpen(false);
    setCategoryFilter('All');
    setViewMode('due');
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleDeleteCustomCard = (cardId: string) => {
    setCustomCards((prev) => prev.filter((c) => c.id !== cardId));
    setProgress((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
  };

  const handleResetAllProgress = () => {
    if (!window.confirm('Reset spaced-repetition review history for all flashcards?')) return;
    stopSpeech();
    setProgress({});
    setRequeuedIds([]);
    setSessionReviewed(0);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            Active recall &amp; spaced repetition
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Interview Flashcards
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Test your recall on technical and behavioral prompts using SM-2 spaced repetition intervals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetAllProgress}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Progress</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Custom Card</span>
          </button>
        </div>
      </header>

      {/* Compact Metrics Strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Flashcard study metrics">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Due for review</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {stats.dueCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Mastered cards</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.masteredCount}
            <span className="ml-1 text-xs font-normal text-slate-400">/ {stats.totalCards}</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reviewed today</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.reviewedToday}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recall accuracy</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.retentionRate}%
          </p>
        </div>
      </section>

      {/* Study Mode & Category Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'due', label: 'Due Review' },
              { id: 'cram', label: 'All Cards' },
              { id: 'deck', label: 'Manage Deck' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                stopSpeech();
                setViewMode(mode.id);
                setCurrentIndex(0);
                setIsFlipped(false);
                setShowHint(false);
              }}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === mode.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                stopSpeech();
                setCategoryFilter(category);
                setCurrentIndex(0);
                setIsFlipped(false);
                setShowHint(false);
              }}
              className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                categoryFilter === category
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {category === 'Data Structures & Algorithms' ? 'DSA' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Deck Manager OR Active Flashcard Stage */}
      {viewMode === 'deck' ? (
        <section
          aria-label="Flashcard deck overview"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Deck Schedule ({filteredCards.length} cards)
              </h2>
            </div>
            <span className="text-xs text-slate-500">SM-2 intervals update as you review</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Prompt</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Stage</th>
                  <th className="px-5 py-3 font-semibold">Next Review</th>
                  <th className="px-5 py-3 text-right font-semibold">Reviews</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCards.map((card, idx) => {
                  const sched = progress[card.id];
                  const stage = getMasteryStage(sched);
                  const nextText = sched ? formatDueDate(sched.nextReviewAt, Date.now()) : 'Due now';
                  return (
                    <tr key={card.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="max-w-md px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <p className="line-clamp-2">{card.question}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {card.category}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold">
                        <span
                          className={
                            stage === 'Mastered'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : stage === 'Learning'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {stage}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        {nextText}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-xs tabular-nums text-slate-600 dark:text-slate-300">
                        {sched?.totalReviews ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setViewMode('cram');
                              setCurrentIndex(idx);
                              setIsFlipped(false);
                              setShowHint(false);
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                          >
                            Study
                          </button>
                          {card.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomCard(card.id)}
                              aria-label="Delete custom flashcard"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : activeCard ? (
        <section aria-label="Active flashcard" className="space-y-4">
          {/* Queue Position Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold tabular-nums">
              Card {currentIndex + 1} of {filteredCards.length} in{' '}
              {viewMode === 'due' ? 'Due Queue' : 'Practice Deck'}
              {sessionReviewed > 0 ? ` · ${sessionReviewed} rated this session` : ''}
            </span>
            <span className="hidden sm:inline">
              Shortcuts: Space to flip · H for hint · 1–4 to rate
            </span>
          </div>

          {/* Interactive Flashcard */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            {/* Unboxed Metadata Line */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {activeCard.category}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeCard.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span>Stage: {getMasteryStage(activeSchedule)}</span>
                {activeCard.isCustom && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Custom card</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {speechSupported && (
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <span>{isSpeaking ? 'Stop Audio' : 'Read Aloud'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    stopSpeech();
                    setIsFlipped((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isFlipped ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Show Prompt</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reveal Answer</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card Face Content */}
            {!isFlipped ? (
              <div className="py-8 sm:py-12">
                <h2 className="text-xl font-bold leading-snug text-slate-900 dark:text-white sm:text-2xl">
                  {activeCard.question}
                </h2>

                {showHint && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-white">Hint: </span>
                    {activeCard.hint}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <span>Reveal Model Answer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Question</p>
                  <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    {activeCard.question}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Model Answer
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {activeCard.answer}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    What interviewers listen for
                  </p>
                  <ul className="mt-2 space-y-2">
                    {activeCard.keyPoints.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Spaced-Repetition Rating Controls */}
                <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                  <p className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    How well did you recall this answer? Choose your next review interval:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {RATING_OPTIONS.map((option) => {
                      const preview = computeNextSchedule(activeSchedule, option.id);
                      const intervalLabel = formatIntervalLabel(preview.intervalDays, option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleRateCard(option.id)}
                          className={`flex flex-col items-center justify-center rounded-xl border px-3 py-3 text-center transition-colors cursor-pointer ${option.styleClass}`}
                        >
                          <span className="text-sm font-bold">
                            {option.label}
                          </span>
                          <span className="mt-0.5 text-xs font-medium tabular-nums opacity-85">
                            {intervalLabel} · Key {option.shortcut}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Empty / Queue Complete State */
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
            All due cards reviewed
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
            You have completed every scheduled card in{' '}
            {categoryFilter === 'All' ? 'all categories' : categoryFilter}. Switch to All Cards to keep
            practicing or add a custom question.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('cram');
                setCurrentIndex(0);
                setIsFlipped(false);
              }}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer"
            >
              Practice All Cards
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              Add Custom Card
            </button>
          </div>
        </section>
      )}

      {/* Add Custom Flashcard Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-flashcard-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h2 id="add-flashcard-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Add Custom Flashcard
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomCard} className="mt-4 space-y-4">
              {formError && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {formError}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value as FlashcardCategory)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Behavioral">Behavioral</option>
                    <option value="Data Structures & Algorithms">Data Structures &amp; Algorithms</option>
                    <option value="System Design">System Design</option>
                    <option value="Frontend & Web">Frontend &amp; Web</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Difficulty
                  </label>
                  <select
                    value={newDifficulty}
                    onChange={(event) => setNewDifficulty(event.target.value as FlashcardDifficulty)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Core">Core</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Interview Question
                </label>
                <textarea
                  rows={2}
                  required
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  placeholder="e.g. How does optimistic UI locking handle concurrent edits?"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hint (optional)
                </label>
                <input
                  type="text"
                  value={newHint}
                  onChange={(event) => setNewHint(event.target.value)}
                  placeholder="e.g. Mention version numbers / ETags and rollback on 409 Conflict"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Model Answer
                </label>
                <textarea
                  rows={3}
                  required
                  value={newAnswer}
                  onChange={(event) => setNewAnswer(event.target.value)}
                  placeholder="Write a clear, concise answer to test yourself against..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Key Takeaways (one per line, optional)
                </label>
                <textarea
                  rows={2}
                  value={newKeyPoint}
                  onChange={(event) => setNewKeyPoint(event.target.value)}
                  placeholder="Explain version check on write&#10;Describe graceful conflict merge UX"
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  Save Flashcard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
