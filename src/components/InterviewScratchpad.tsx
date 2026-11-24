import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  GripHorizontal,
  Minimize2,
  NotebookPen,
  Trash2,
} from 'lucide-react';

interface InterviewScratchpadProps {
  sessionKey: string;
}

interface ScratchpadState {
  notes: string;
  isOpen: boolean;
  width: number;
  height: number;
  left: number | null;
  top: number | null;
}

const MIN_WIDTH = 260;
const MIN_HEIGHT = 210;
const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 290;

const QUICK_PROMPTS = [
  { label: '+ STAR', text: '• S/T: \n• Action: \n• Result: ' },
  { label: '+ Metric', text: '• Metric / Impact: ' },
  { label: '+ Trade-off', text: '• Trade-off: ' },
  { label: '+ Edge Case', text: '• Edge case: ' },
] as const;

function getStorageKey(sessionKey: string): string {
  return `intervyou_scratchpad_${sessionKey || 'active'}`;
}

function getDefaultPosition(width: number, height: number): { left: number; top: number } {
  if (typeof window === 'undefined') return { left: 24, top: 80 };
  return {
    left: Math.max(12, window.innerWidth - width - 24),
    top: Math.max(76, window.innerHeight - height - 24),
  };
}

function loadScratchpadState(sessionKey: string): ScratchpadState {
  const defaults: ScratchpadState = {
    notes: '',
    isOpen: true,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    left: null,
    top: null,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = sessionStorage.getItem(getStorageKey(sessionKey));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ScratchpadState>;
    return {
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      isOpen: typeof parsed.isOpen === 'boolean' ? parsed.isOpen : true,
      width:
        typeof parsed.width === 'number'
          ? Math.max(MIN_WIDTH, Math.min(640, parsed.width))
          : DEFAULT_WIDTH,
      height:
        typeof parsed.height === 'number'
          ? Math.max(MIN_HEIGHT, Math.min(580, parsed.height))
          : DEFAULT_HEIGHT,
      left: typeof parsed.left === 'number' ? parsed.left : null,
      top: typeof parsed.top === 'number' ? parsed.top : null,
    };
  } catch {
    return defaults;
  }
}

export default function InterviewScratchpad({ sessionKey }: InterviewScratchpadProps) {
  const [state, setState] = useState<ScratchpadState>(() => loadScratchpadState(sessionKey));
  const [copied, setCopied] = useState(false);

  const dragOriginRef = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reload if interview sessionKey updates after initial creation
  useEffect(() => {
    setState((prev) => {
      const stored = loadScratchpadState(sessionKey);
      // Preserve in-progress notes if transitioning from temporary draft key to server session id
      if (!stored.notes && prev.notes) {
        return { ...prev };
      }
      return stored;
    });
  }, [sessionKey]);

  // Persist scratchpad notes, open state, position & dimensions during the session
  useEffect(() => {
    try {
      sessionStorage.setItem(getStorageKey(sessionKey), JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [sessionKey, state]);

  // Resolve and clamp position within viewport bounds
  const resolvedRect = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        width: state.width,
        height: state.height,
        left: 24,
        top: 80,
      };
    }

    const maxW = Math.max(MIN_WIDTH, Math.min(640, window.innerWidth - 24));
    const maxH = Math.max(MIN_HEIGHT, Math.min(580, window.innerHeight - 24));
    const width = Math.min(state.width, maxW);
    const height = Math.min(state.height, maxH);

    const fallback = getDefaultPosition(width, height);
    const rawLeft = state.left ?? fallback.left;
    const rawTop = state.top ?? fallback.top;

    return {
      width,
      height,
      left: Math.max(12, Math.min(window.innerWidth - width - 12, rawLeft)),
      top: Math.max(12, Math.min(window.innerHeight - height - 12, rawTop)),
    };
  }, [state.height, state.left, state.top, state.width]);

  // Keep panel clamped if browser window resizes
  useEffect(() => {
    const handleWindowResize = () => {
      setState((prev) => {
        if (prev.left === null && prev.top === null) return prev;
        const maxLeft = Math.max(12, window.innerWidth - prev.width - 12);
        const maxTop = Math.max(12, window.innerHeight - prev.height - 12);
        const clampedLeft = Math.max(12, Math.min(maxLeft, prev.left ?? maxLeft));
        const clampedTop = Math.max(12, Math.min(maxTop, prev.top ?? maxTop));
        if (clampedLeft === prev.left && clampedTop === prev.top) return prev;
        return { ...prev, left: clampedLeft, top: clampedTop };
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const origin = dragOriginRef.current;
    if (!origin) return;

    const dx = event.clientX - origin.startX;
    const dy = event.clientY - origin.startY;

    if (origin.mode === 'move') {
      const maxLeft = Math.max(12, window.innerWidth - origin.startWidth - 12);
      const maxTop = Math.max(12, window.innerHeight - origin.startHeight - 12);
      const nextLeft = Math.max(12, Math.min(maxLeft, origin.startLeft + dx));
      const nextTop = Math.max(12, Math.min(maxTop, origin.startTop + dy));
      setState((prev) => ({ ...prev, left: nextLeft, top: nextTop }));
    } else {
      const maxWidth = Math.max(MIN_WIDTH, Math.min(640, window.innerWidth - origin.startLeft - 12));
      const maxHeight = Math.max(MIN_HEIGHT, Math.min(580, window.innerHeight - origin.startTop - 12));
      const nextWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, origin.startWidth + dx));
      const nextHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, origin.startHeight + dy));
      setState((prev) => ({ ...prev, width: nextWidth, height: nextHeight }));
    }
  }, []);

  const stopDragging = useCallback(() => {
    dragOriginRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }, [handlePointerMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [handlePointerMove, stopDragging]);

  const startDrag = (mode: 'move' | 'resize', event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragOriginRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: resolvedRect.left,
      startTop: resolvedRect.top,
      startWidth: resolvedRect.width,
      startHeight: resolvedRect.height,
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
  };

  const wordCount = useMemo(() => {
    const trimmed = state.notes.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [state.notes]);

  const handleInsertSnippet = (snippetText: string) => {
    setState((prev) => {
      const prefix = prev.notes && !prev.notes.endsWith('\n') ? '\n' : '';
      return { ...prev, notes: `${prev.notes}${prefix}${snippetText}` };
    });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleCopyNotes = () => {
    if (!state.notes.trim()) return;
    void navigator.clipboard.writeText(state.notes);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!state.isOpen) {
    return (
      <button
        type="button"
        onClick={() => setState((prev) => ({ ...prev, isOpen: true }))}
        aria-label="Open interview scratchpad"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-lg shadow-slate-900/10 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      >
        <NotebookPen className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span>Scratchpad</span>
        {wordCount > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {wordCount}w
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <section
      aria-label="Interview scratchpad"
      style={{
        left: `${resolvedRect.left}px`,
        top: `${resolvedRect.top}px`,
        width: `${resolvedRect.width}px`,
        height: `${resolvedRect.height}px`,
      }}
      className="fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50"
    >
      {/* Draggable Title Bar */}
      <div
        onPointerDown={(e) => startDrag('move', e)}
        className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 select-none active:cursor-grabbing dark:border-slate-800 dark:bg-slate-950/60"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <NotebookPen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
            Interview Scratchpad
          </h3>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleCopyNotes}
            disabled={!state.notes.trim()}
            aria-label="Copy scratchpad notes"
            title="Copy notes"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, notes: '' }))}
            disabled={!state.notes.trim()}
            aria-label="Clear scratchpad notes"
            title="Clear notes"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, isOpen: false }))}
            aria-label="Minimize interview scratchpad"
            title="Minimize scratchpad"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Quick Keyword / Structure Snippets */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-100 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleInsertSnippet(item.text)}
            className="whitespace-nowrap shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Editable Notes Area */}
      <textarea
        ref={textareaRef}
        aria-label="Interview scratchpad notes"
        value={state.notes}
        onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="Jot down keywords, STAR bullet points, metrics, or edge cases while answering..."
        className="flex-1 resize-none bg-white px-3.5 py-3 text-xs sm:text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      {/* Footer & Bottom-Right Resize Grip */}
      <div className="relative flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3.5 py-1.5 pr-7 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
        <span className="truncate">Persists for this session</span>
        <span className="tabular-nums font-medium">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>

        {/* Interactive Corner Resize Handle */}
        <div
          role="separator"
          aria-label="Resize interview scratchpad"
          title="Drag corner to resize"
          onPointerDown={(e) => startDrag('resize', e)}
          className="absolute right-0 bottom-0 flex h-6 w-6 cursor-nwse-resize items-end justify-end p-1.5 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 touch-none"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none"
          >
            <path
              d="M9 1L1 9M9 5L5 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
