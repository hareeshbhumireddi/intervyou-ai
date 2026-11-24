export type FlashcardCategory =
  | 'Behavioral'
  | 'Data Structures & Algorithms'
  | 'System Design'
  | 'Frontend & Web';

export type FlashcardDifficulty = 'Core' | 'Intermediate' | 'Advanced';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  category: FlashcardCategory;
  difficulty: FlashcardDifficulty;
  question: string;
  hint: string;
  answer: string;
  keyPoints: string[];
  isCustom?: boolean;
}

export interface CardScheduleState {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  lastRating?: ReviewRating;
  totalReviews: number;
}

export type FlashcardProgressMap = Record<string, CardScheduleState>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function createInitialSchedule(now = Date.now()): CardScheduleState {
  return {
    repetitions: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    nextReviewAt: now,
    totalReviews: 0,
  };
}

/**
 * SM-2 spaced repetition interval computation tailored for interview flashcards.
 * - again: resets repetitions so card is re-queued immediately in the active session
 * - hard: modest step with reduced ease factor
 * - good: standard SM-2 progression (1d -> 6d -> interval * ease)
 * - easy: accelerated progression with ease bonus
 */
export function computeNextSchedule(
  prev: CardScheduleState | undefined,
  rating: ReviewRating,
  now = Date.now()
): CardScheduleState {
  const current = prev || createInitialSchedule(now);
  let { repetitions, intervalDays, easeFactor, totalReviews } = current;

  const qualityMap: Record<ReviewRating, number> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
  };
  const q = qualityMap[rating];

  if (rating === 'again') {
    repetitions = 0;
    intervalDays = 0;
  } else {
    if (repetitions === 0) {
      intervalDays = rating === 'easy' ? 3 : 1;
    } else if (repetitions === 1) {
      intervalDays = rating === 'hard' ? 3 : rating === 'easy' ? 8 : 6;
    } else {
      const multiplier = rating === 'hard' ? 1.2 : rating === 'easy' ? easeFactor * 1.3 : easeFactor;
      intervalDays = Math.max(1, Math.round(intervalDays * multiplier));
    }
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    Number((easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2))
  );

  return {
    repetitions,
    intervalDays,
    easeFactor,
    nextReviewAt: rating === 'again' ? now : now + intervalDays * DAY_MS,
    lastReviewedAt: now,
    lastRating: rating,
    totalReviews: totalReviews + 1,
  };
}

export function formatIntervalLabel(intervalDays: number, rating?: ReviewRating): string {
  if (rating === 'again' || intervalDays <= 0) return 'Re-queue';
  if (intervalDays === 1) return '1 day';
  if (intervalDays < 30) return `${intervalDays} days`;
  const months = Math.round(intervalDays / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

export function getMasteryStage(schedule?: CardScheduleState): 'New' | 'Learning' | 'Mastered' {
  if (!schedule || schedule.totalReviews === 0) return 'New';
  if (schedule.intervalDays >= 6 && schedule.repetitions >= 2) return 'Mastered';
  return 'Learning';
}

export const BUILTIN_FLASHCARDS: Flashcard[] = [
  {
    id: 'beh-star-conflict',
    category: 'Behavioral',
    difficulty: 'Core',
    question: 'Tell me about a time you disagreed with a teammate or manager on a technical decision. How did you resolve it?',
    hint: 'Use Situation, Task, Action, Result (STAR) and emphasize data or user impact over ego.',
    answer:
      'Frame the disagreement around shared goals rather than personal preference. Explain how you listened to their reasoning, proposed an objective comparison (e.g., prototype, benchmark, or trade-off matrix), aligned on a path forward, and measured the outcome.',
    keyPoints: [
      'Demonstrates active listening and psychological safety',
      'Shows objective evidence or trade-off analysis used to decide',
      'Ends with a concrete result and what you learned',
    ],
  },
  {
    id: 'beh-failure-ownership',
    category: 'Behavioral',
    difficulty: 'Core',
    question: 'Describe a mistake or production issue you caused. How did you respond and prevent it from happening again?',
    hint: 'Own the mistake directly without blaming others, then highlight systemic safeguards you added.',
    answer:
      'Acknowledge ownership immediately, describe how you mitigated the immediate customer impact, walked through a blameless root-cause analysis, and implemented durable safeguards like automated tests, feature flags, or runbook alerts.',
    keyPoints: [
      'Zero blame-shifting; crisp accountability',
      'Fast incident containment before deep postmortem',
      'Systemic fix (CI check, monitoring, or guardrail)',
    ],
  },
  {
    id: 'beh-tight-deadline',
    category: 'Behavioral',
    difficulty: 'Intermediate',
    question: 'Tell me about a project with an aggressive deadline and changing requirements.',
    hint: 'Focus on ruthless prioritization, stakeholder communication, and negotiating scope vs. quality.',
    answer:
      'Explain how you decomposed the deliverables into must-have MVP milestones versus deferrable scope, surfaced risks early to stakeholders with concrete options, protected core reliability, and delivered the critical path on schedule.',
    keyPoints: [
      'Proactive scope negotiation before missing deadlines',
      'Clear communication of trade-offs to stakeholders',
      'Measurable on-time delivery without cutting safety corners',
    ],
  },
  {
    id: 'beh-ambiguity',
    category: 'Behavioral',
    difficulty: 'Intermediate',
    question: 'How do you approach a problem when requirements are vague or incomplete?',
    hint: 'Talk about discovery questions, quick prototypes, and iterative alignment.',
    answer:
      'Identify who owns the business outcome, list the key assumptions and unknowns, clarify constraints (scale, latency, budget, compliance), validate assumptions early with a lightweight spec or spike, and iterate with rapid feedback loops.',
    keyPoints: [
      'Turns open-ended ambiguity into testable assumptions',
      'Validates early rather than building in isolation',
      'Balances speed with clear written alignment',
    ],
  },
  {
    id: 'beh-mentorship',
    category: 'Behavioral',
    difficulty: 'Advanced',
    question: 'Give an example of how you raised the bar for your team or mentored a peer.',
    hint: 'Highlight leverage: documentation, code reviews, pairing, or tooling that helped everyone move faster.',
    answer:
      'Share a specific story where you noticed recurring friction—such as onboarding gaps or flaky tests—and paired with teammates or built reusable patterns and constructive code-review checklists that measurably improved team velocity or quality.',
    keyPoints: [
      'Multiplier impact beyond individual ticket delivery',
      'Empathetic, actionable feedback style',
      'Quantifiable improvement in quality or onboarding speed',
    ],
  },
  {
    id: 'dsa-hash-table',
    category: 'Data Structures & Algorithms',
    difficulty: 'Core',
    question: 'How does a hash table achieve O(1) average lookup, and what happens when collisions occur?',
    hint: 'Cover hash functions, bucket indexing, separate chaining vs. open addressing, and load factor resizing.',
    answer:
      'A hash function maps keys to array bucket indices in constant time. Collisions occur when distinct keys map to the same index and are resolved via separate chaining (linked lists/trees per bucket) or open addressing (linear/quadratic probing). When the load factor exceeds a threshold (e.g., 0.75), the table resizes and rehashes to avoid O(n) worst-case degradation.',
    keyPoints: [
      'Average O(1) vs worst-case O(n) lookup complexity',
      'Separate chaining vs. open addressing trade-offs',
      'Dynamic resizing triggered by load factor threshold',
    ],
  },
  {
    id: 'dsa-bfs-dfs',
    category: 'Data Structures & Algorithms',
    difficulty: 'Core',
    question: 'When should you choose Breadth-First Search (BFS) over Depth-First Search (DFS)?',
    hint: 'Think shortest path in unweighted graphs vs. backtracking, cycle detection, and memory footprint.',
    answer:
      'Use BFS (queue-based) to find the shortest path in an unweighted graph or process nodes level by level, especially when targets are close to the root. Use DFS (stack/recursion) for topological sorting, cycle detection, exhaustive backtracking, or deep trees where a queue would consume O(width) memory.',
    keyPoints: [
      'BFS guarantees shortest path in unweighted graphs',
      'DFS uses O(height) stack space vs BFS O(width) queue space',
      'DFS pairs naturally with backtracking and cycle checks',
    ],
  },
  {
    id: 'dsa-dp-vs-greedy',
    category: 'Data Structures & Algorithms',
    difficulty: 'Intermediate',
    question: 'What is the difference between Dynamic Programming and a Greedy algorithm?',
    hint: 'Compare overlapping subproblems and exploring all choices vs. making a single locally optimal choice.',
    answer:
      'Both require optimal substructure, but a Greedy algorithm commits to the locally optimal choice at each step without reconsidering previous choices. Dynamic Programming solves overlapping subproblems and caches results (top-down memoization or bottom-up tabulation) when a local choice alone cannot guarantee global optimality.',
    keyPoints: [
      'Greedy makes irrevocable local choices (must prove greedy-choice property)',
      'DP evaluates multiple subproblem branches and caches answers',
      'Classic contrast: Fractional Knapsack (Greedy) vs 0/1 Knapsack (DP)',
    ],
  },
  {
    id: 'dsa-sliding-window',
    category: 'Data Structures & Algorithms',
    difficulty: 'Intermediate',
    question: 'When does the Sliding Window pattern apply, and why does it reduce O(n^2) to O(n)?',
    hint: 'Think contiguous subarrays/substrings with monotonic expansion and shrinking.',
    answer:
      'Sliding Window applies to contiguous subarray or substring problems where a condition holds monotonically as you expand the right pointer and shrink the left pointer. Because each pointer moves forward at most n times across the entire array, total work stays O(n) instead of recomputing overlapping windows.',
    keyPoints: [
      'Works strictly on contiguous ranges (arrays/strings)',
      'Fixed-size window vs variable-size two-pointer window',
      'Each element enters and leaves the window at most once -> O(n)',
    ],
  },
  {
    id: 'dsa-quicksort-mergesort',
    category: 'Data Structures & Algorithms',
    difficulty: 'Core',
    question: 'Compare Quicksort and Mergesort in time complexity, space usage, stability, and real-world use.',
    hint: 'Mention cache locality, in-place partitioning, worst-case O(n^2), and stability.',
    answer:
      'Quicksort sorts in-place (O(log n) stack space) with strong CPU cache locality and O(n log n) average time, though bad pivots give O(n^2) worst case and it is unstable. Mergesort guarantees O(n log n) worst-case time and stability, making it ideal for linked lists or external sorting, at the cost of O(n) extra array space.',
    keyPoints: [
      'Quicksort: in-place, cache-friendly, unstable, randomized pivot avoids worst case',
      'Mergesort: stable, guaranteed O(n log n), O(n) auxiliary space for arrays',
      'Hybrid sorts (Timsort/Introsort) combine strengths in standard libraries',
    ],
  },
  {
    id: 'sys-indexing',
    category: 'System Design',
    difficulty: 'Core',
    question: 'How do database indexes speed up queries, and what are the trade-offs of adding too many indexes?',
    hint: 'Explain B-Tree lookups vs full table scans and the write/storage overhead.',
    answer:
      'An index (typically a B-Tree or B+Tree) keeps sorted key pointers to table rows, turning O(n) full table scans into O(log n) tree traversals. However, every INSERT, UPDATE, or DELETE must update each affected index, increasing write amplification, lock contention, and disk/RAM footprint.',
    keyPoints: [
      'B+Tree structure enables fast equality and range queries',
      'Composite index leftmost-prefix rule matters for query plans',
      'Trade-off: faster reads vs slower writes and extra storage',
    ],
  },
  {
    id: 'sys-caching',
    category: 'System Design',
    difficulty: 'Intermediate',
    question: 'Explain cache-aside vs. write-through caching and how to handle stale data or cache stampedes.',
    hint: 'Mention TTLs, explicit invalidation, request coalescing (singleflight), and jitter.',
    answer:
      'In cache-aside, the app checks the cache first, loads from DB on a miss, and populates the cache; write-through updates cache and DB synchronously together. Prevent stale reads with short TTLs plus explicit invalidation on writes, and mitigate stampedes with distributed locks, request coalescing, and randomized TTL jitter.',
    keyPoints: [
      'Cache-aside: resilient to cache failure, initial cold-miss penalty',
      'Write-through: consistent cache, higher write latency',
      'Stampede protection: singleflight coalescing, jittered TTLs, probabilistic early refresh',
    ],
  },
  {
    id: 'sys-rate-limiter',
    category: 'System Design',
    difficulty: 'Intermediate',
    question: 'Compare Token Bucket and Sliding Window Log rate limiting for a public API gateway.',
    hint: 'Consider burst handling, memory per user, and Redis atomic operations.',
    answer:
      'Token Bucket refills tokens at a steady rate up to a bucket capacity, smoothly allowing controlled traffic bursts while using only two counters per key (count + timestamp). Sliding Window Log stores exact timestamps for zero boundary spikes, offering strict precision at higher memory cost.',
    keyPoints: [
      'Token Bucket: O(1) memory, supports controlled bursts cleanly',
      'Fixed Window suffers from 2x boundary-burst problem',
      'Distributed gateways use Redis Lua scripts for atomic check-and-decrement',
    ],
  },
  {
    id: 'sys-idempotency',
    category: 'System Design',
    difficulty: 'Advanced',
    question: 'How do you make payment or order-creation APIs safely idempotent under network retries?',
    hint: 'Think client-generated Idempotency-Key headers, unique DB constraints, and stored responses.',
    answer:
      'Require clients to send a unique Idempotency-Key per logical operation. Store the key with a status and serialized response inside the same ACID database transaction as the state mutation. On retries, detect the existing key via unique constraint and replay the stored result without executing side effects twice.',
    keyPoints: [
      'Client-supplied UUID Idempotency-Key header',
      'Atomic DB transaction linking key + business record',
      'Handle in-flight concurrent duplicate requests with 409/lock state',
    ],
  },
  {
    id: 'sys-sharding',
    category: 'System Design',
    difficulty: 'Advanced',
    question: 'When should you shard a database, and what challenges does sharding introduce?',
    hint: 'Mention read replicas and vertical scaling first, then shard keys, hot partitions, and cross-shard joins.',
    answer:
      'Exhaust vertical scaling, query tuning, caching, and read replicas before sharding. Horizontal sharding partitions rows across independent nodes by a shard key, introducing cross-shard join complexity, distributed transaction overhead, hot-spot skew on uneven keys, and painful shard rebalancing.',
    keyPoints: [
      'Do vertical scaling, indexing, and read replicas before sharding',
      'Choose a high-cardinality shard key matching common access patterns',
      'Consistent hashing eases node additions/removals',
    ],
  },
  {
    id: 'fe-event-loop',
    category: 'Frontend & Web',
    difficulty: 'Core',
    question: 'Explain the JavaScript Event Loop, focusing on the difference between microtasks and macrotasks.',
    hint: 'Think Call Stack -> all Microtasks (Promise callbacks) -> one Macrotask (setTimeout/I/O) -> render.',
    answer:
      'JavaScript runs synchronous code on a single call stack. When the stack empties, the event loop drains the entire microtask queue (Promise.then, queueMicrotask) before picking the next single macrotask (setTimeout, DOM event) and allowing browser repainting. An infinite microtask loop can starve rendering and timers.',
    keyPoints: [
      'Microtasks run completely before the next macrotask or paint',
      'Promises and MutationObserver schedule microtasks',
      'Long synchronous work or starved microtasks block UI frames',
    ],
  },
  {
    id: 'fe-react-keys',
    category: 'Frontend & Web',
    difficulty: 'Core',
    question: 'Why are array indices discouraged as React `key` props in dynamic lists?',
    hint: 'Consider how React reconciles component state and DOM nodes when items are inserted, deleted, or reordered.',
    answer:
      'React uses `key` to match elements between renders during reconciliation. If you use an array index and items are inserted, deleted, or reordered, keys shift onto different data items—causing React to reuse stale DOM elements and local component state on the wrong row. Always use a stable unique ID.',
    keyPoints: [
      'Keys identify elements across renders, not just suppress warnings',
      'Index keys corrupt input values and animations on reorder/delete',
      'Index keys are only safe for purely static, non-reordered lists',
    ],
  },
  {
    id: 'fe-xss-csrf',
    category: 'Frontend & Web',
    difficulty: 'Intermediate',
    question: 'How do XSS and CSRF attacks differ, and how do modern web apps defend against each?',
    hint: 'XSS injects malicious scripts into your origin; CSRF tricks a browser into sending ambient cookies.',
    answer:
      'XSS executes attacker-controlled JavaScript inside your trusted origin; prevent it with framework auto-escaping, sanitizing HTML, Content Security Policy (CSP), and HttpOnly cookies. CSRF abuses automatic cookie submission from another site; prevent it with SameSite=Lax/Strict cookies, anti-CSRF tokens, and Origin checks.',
    keyPoints: [
      'XSS = script injection; mitigate with escaping, CSP, HttpOnly cookies',
      'CSRF = forged cross-site state-changing request; mitigate with SameSite + tokens',
      'HttpOnly protects tokens from JS reads but does not stop CSRF alone',
    ],
  },
  {
    id: 'fe-debounce-throttle',
    category: 'Frontend & Web',
    difficulty: 'Core',
    question: 'What is the difference between debouncing and throttling, and when would you use each?',
    hint: 'Think search-as-you-type autocomplete vs scroll/resize event handlers.',
    answer:
      'Debouncing delays execution until a quiet period passes with no new triggers—ideal for search inputs or auto-save so only the final pause triggers an API call. Throttling enforces a maximum execution rate (e.g., once every 100ms), ideal for scroll listeners, window resize, or drag tracking.',
    keyPoints: [
      'Debounce: resets timer on every event, fires after inactivity',
      'Throttle: guarantees steady periodic execution during sustained activity',
      'Remember to clean up timers on React component unmount',
    ],
  },
  {
    id: 'fe-web-vitals',
    category: 'Frontend & Web',
    difficulty: 'Intermediate',
    question: 'What are the three Core Web Vitals (LCP, INP, CLS), and how do you optimize them?',
    hint: 'Loading speed (LCP), responsiveness (INP), and visual stability (CLS).',
    answer:
      'LCP (Largest Contentful Paint <= 2.5s) measures main content load—optimize by preloading hero images, reducing TTFB, and trimming render-blocking CSS/JS. INP (Interaction to Next Paint <= 200ms) measures input responsiveness—break up long JS tasks. CLS (<= 0.1) measures layout shifts—reserve explicit image/ad dimensions.',
    keyPoints: [
      'LCP -> hero image priority, CDN/caching, code splitting',
      'INP -> minimize main-thread blocking & heavy re-renders',
      'CLS -> explicit width/height or aspect-ratio containers',
    ],
  },
];
