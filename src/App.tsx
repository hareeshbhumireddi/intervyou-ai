import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Bell,
  Bookmark,
  Briefcase,
  Calendar as CalendarIcon,
  Dumbbell,
  FileText,
  History as HistoryIcon,
  Keyboard,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { AppStateProvider, useAppState } from './hooks/useAppState';
import { checkUpcomingReminders } from './utils/notificationService';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import {
  isEditableTarget,
  isInteractiveSpaceTarget,
  isInterviewRoomPath,
  SUBMIT_INTERVIEW_ANSWER_EVENT,
  TOGGLE_FOCUS_TIMER_EVENT,
  TOGGLE_INTERVIEW_MIC_EVENT,
} from './utils/keyboardShortcuts';

import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/Schedule';
import InterviewSetup from './pages/interviewSetup';
import InterviewRoom from './pages/interview';
import HistoryPage from './pages/History';
import JobNotifications from './pages/JobNotifications';
import MyInterviews from './pages/MyInterviews';
import MyResume from './pages/MyResume';
import PerformanceOverview from './pages/PerformanceOverview';
import PerformanceReport from './pages/Performance';
import Profile from './pages/Profile';
import SavedJobs from './pages/SavedJobs';
import SettingsPage from './pages/Settings';
import Flashcards from './pages/Flashcards';
import PeerPractice from './pages/PeerPractice';
import Login from './pages/Login';
import Landing from './pages/Landing';
import { safeRedirect } from './utils/validation';
import Onboarding from './pages/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import { Alert, FullPageStatus, LinkButton, SimulatedBanner } from './components/ui';

const sidebarLinks: Array<{
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  shortcutLabel?: string;
  ariaKeyshortcuts?: string;
}> = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    shortcutLabel: 'Ctrl+D',
    ariaKeyshortcuts: 'Control+D',
  },
  { label: 'Schedule', path: '/schedule', icon: CalendarIcon },
  { label: 'My Interview', path: '/my-interview', icon: Briefcase },
  { label: 'My Resume', path: '/my-resume', icon: FileText },
  { label: 'Performance', path: '/performance', icon: Activity },
  { label: 'History', path: '/history', icon: HistoryIcon },
  {
    label: 'Practice',
    path: '/setup',
    icon: Dumbbell,
    shortcutLabel: 'Ctrl+I',
    ariaKeyshortcuts: 'Control+I',
  },
  { label: 'Peer Practice', path: '/peer-practice', icon: Users },
  { label: 'Flashcards', path: '/flashcards', icon: Layers },
  { label: 'Job Search', path: '/jobs', icon: Search },
  { label: 'Saved Jobs', path: '/saved-jobs', icon: Bookmark },
  { label: 'Profile', path: '/profile', icon: UserIcon },
  { label: 'Settings', path: '/settings', icon: SettingsIcon },
];

function SidebarLinks({ onNavigate }: { onNavigate: () => void }) {
  const location = useLocation();

  return (
    <nav className="space-y-1.5" aria-label="Main navigation">
      {sidebarLinks.map(({ label, path, icon: Icon, shortcutLabel, ariaKeyshortcuts }) => {
        const selected = location.pathname === path
          || (path === '/performance' && (location.pathname.startsWith('/performance/') || location.pathname.startsWith('/report/')))
          || (path === '/setup' && ['/setup', '/room', '/practice'].includes(location.pathname))
          || (path === '/my-interview' && location.pathname.startsWith('/interview/'));

        return (
          <Link
            key={path}
            to={path}
            onClick={onNavigate}
            aria-current={selected ? 'page' : undefined}
            aria-keyshortcuts={ariaKeyshortcuts}
            title={shortcutLabel ? `${label} (${shortcutLabel})` : label}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${selected
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
            {shortcutLabel && (
              <kbd className="hidden md:inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {shortcutLabel}
              </kbd>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  onLogout,
  onOpenShortcuts,
}: {
  onLogout: () => void;
  onOpenShortcuts: () => void;
}) {
  const { user } = useAppState();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [user.avatarUrl]);

  const initials = (user.fullName || user.email || 'C')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
      <Link to="/profile" className="mb-3 flex items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
        {user.avatarUrl && !imgFailed ? (
          <img
            key={user.avatarUrl}
            src={user.avatarUrl}
            alt={user.fullName || 'Candidate'}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-9 w-9 shrink-0 rounded-xl object-cover ring-2 ring-slate-200 dark:ring-slate-700"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-xs font-bold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{user.fullName || 'Candidate'}</span>
          <span className="block truncate text-xs text-slate-500">{user.email}</span>
        </div>
      </Link>
      <button
        type="button"
        onClick={onOpenShortcuts}
        aria-keyshortcuts="?"
        className="mb-1 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
      >
        <span className="flex items-center gap-3">
          <Keyboard className="h-5 w-5" aria-hidden="true" />
          <span>Shortcuts</span>
        </span>
        <kbd className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          ?
        </kbd>
      </button>
      <button
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-300 cursor-pointer"
      >
        <LogOut className="h-5 w-5" />
        Sign out
      </button>
    </div>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const { logoutAll, aiMode } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();

  // Global background check for scheduled 15-minute mock interview reminders
  useEffect(() => {
    const checkSchedule = () => {
      try {
        const raw = localStorage.getItem('intervyou_scheduled_sessions');
        if (!raw) return;
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          checkUpcomingReminders(list, () => {
            // Native notification and audio chime are triggered by checkUpcomingReminders
          });
        }
      } catch {
        // ignore
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 25000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss brief keyboard shortcut confirmation toast
  useEffect(() => {
    if (!shortcutFeedback) return;
    const timeout = window.setTimeout(() => setShortcutFeedback(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [shortcutFeedback]);

  // Global keyboard shortcuts (Ctrl+I, Ctrl+D, ?, Esc, and Interview Room Space/M/Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      const keyLower = event.key.toLowerCase();
      const hasPrimaryMod = (event.ctrlKey || event.metaKey) && !event.altKey;
      const inInterviewRoom = isInterviewRoomPath(location.pathname);

      // Ctrl+I / Cmd+I -> Start Interview (/setup)
      if (hasPrimaryMod && !event.shiftKey && keyLower === 'i') {
        event.preventDefault();
        setIsShortcutsModalOpen(false);
        setMobileOpen(false);
        if (location.pathname !== '/setup') {
          navigate('/setup');
        }
        setShortcutFeedback('Start Interview (Ctrl+I)');
        return;
      }

      // Ctrl+D / Cmd+D -> Dashboard (/dashboard)
      if (hasPrimaryMod && !event.shiftKey && keyLower === 'd') {
        event.preventDefault();
        setIsShortcutsModalOpen(false);
        setMobileOpen(false);
        if (location.pathname !== '/dashboard') {
          navigate('/dashboard');
        }
        setShortcutFeedback('Dashboard (Ctrl+D)');
        return;
      }

      // Ctrl+Enter / Cmd+Enter inside Interview Room -> Submit Answer
      if (hasPrimaryMod && !event.shiftKey && event.key === 'Enter' && inInterviewRoom && !isShortcutsModalOpen) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(SUBMIT_INTERVIEW_ANSWER_EVENT));
        return;
      }

      // Escape closes the keyboard shortcuts modal
      if (event.key === 'Escape' && isShortcutsModalOpen) {
        event.preventDefault();
        setIsShortcutsModalOpen(false);
        return;
      }

      // '?' outside editable fields toggles the shortcuts guide
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key === '?' &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Interview Room-only shortcuts (never fire while shortcuts modal is open)
      if (!inInterviewRoom || isShortcutsModalOpen) return;

      // Space -> Pause / Resume Focus Timer when not typing or activating a focused button
      if (
        (event.code === 'Space' || event.key === ' ') &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isInteractiveSpaceTarget(event.target)
      ) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(TOGGLE_FOCUS_TIMER_EVENT));
        setShortcutFeedback('Focus Timer toggled (Space)');
        return;
      }

      // M -> Toggle Interview Room voice recording outside editable fields
      if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        keyLower === 'm' &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(TOGGLE_INTERVIEW_MIC_EVENT));
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [location.pathname, navigate, isShortcutsModalOpen]);

  const handleLogout = async () => {
    try {
      await logoutAll();
    } finally {
      // Replace (not push) so the signed-in page does not stay in the history
      // for the Back button to return to.
      navigate('/login', { replace: true });
    }
  };

  const brand = (
    <Link to="/dashboard" className="flex items-center gap-3 px-2 py-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-lg font-black text-white shadow-md shadow-blue-500/20">I</span>
      <span className="text-lg font-extrabold text-slate-900 dark:text-white">Intervyou</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900 md:flex">
        {brand}
        <div className="my-5 h-px bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 overflow-y-auto">
          <SidebarLinks onNavigate={() => undefined} />
        </div>
        <SidebarFooter
          onLogout={handleLogout}
          onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        />
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        {brand}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Menu className="h-6 w-6" />
        </button>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/50" />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="absolute inset-y-0 left-0 flex w-[min(19rem,85vw)] flex-col border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                {brand}
                <button onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="my-5 h-px bg-slate-200 dark:bg-slate-800" />
              <div className="flex-1 overflow-y-auto">
                <SidebarLinks onNavigate={() => setMobileOpen(false)} />
              </div>
              <SidebarFooter
                onLogout={handleLogout}
                onOpenShortcuts={() => {
                  setMobileOpen(false);
                  setIsShortcutsModalOpen(true);
                }}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-h-screen px-4 pb-8 pt-20 sm:px-6 md:ml-64 md:px-8 md:pt-8">
        <div className="mx-auto max-w-7xl">
          {aiMode === 'mock' && <SimulatedBanner className="mb-6" />}
          {aiMode === 'unconfigured' && (
            <div className="mb-6"><Alert tone="info">AI interview generation is not configured on this server (no Gemini API key). You can still browse your account, history and reports.</Alert></div>
          )}
          {children}
        </div>
      </main>

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <AnimatePresence>
        {shortcutFeedback && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
          >
            {shortcutFeedback}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady, isProfileLoading, user } = useAppState();
  const location = useLocation();

  // Wait for auth and initial profile hydration before rendering protected pages
  // so a refresh or login redirect never flashes empty placeholder fields.
  if (!authReady) return <FullPageStatus>Checking your session…</FullPageStatus>;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (isProfileLoading && !user.email) {
    return <FullPageStatus>Loading your profile…</FullPageStatus>;
  }
  return <>{children}</>;
}

/** Login/registration are for signed-out visitors; signed-in users go to the dashboard. */
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAppState();
  const location = useLocation();
  if (!authReady) return <FullPageStatus>Checking your session…</FullPageStatus>;
  if (isAuthenticated) {
    // Right after sign-in this guard re-renders first, so it must honour the
    // page the visitor originally asked for (validated against open redirects).
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={safeRedirect(from)} replace />;
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">The page you are looking for does not exist.</p>
      <div className="mt-6"><LinkButton to="/dashboard">Back to dashboard</LinkButton></div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<PublicOnlyRoute><Onboarding /></PublicOnlyRoute>} />
            <Route path="/register" element={<Navigate to="/onboarding" replace />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Routes>
                    <Route path="/*" element={
                      <AuthenticatedLayout>
                        <ErrorBoundary>
                          <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/schedule" element={<SchedulePage />} />
                            <Route path="/my-interview" element={<MyInterviews />} />
                            <Route path="/my-resume" element={<MyResume />} />
                            <Route path="/performance" element={<PerformanceOverview />} />
                            <Route path="/performance/:id" element={<PerformanceReport />} />
                            <Route path="/report/:id" element={<PerformanceReport />} />
                            <Route path="/setup" element={<InterviewSetup />} />
                            <Route path="/peer-practice" element={<PeerPractice />} />
                            <Route path="/flashcards" element={<Flashcards />} />
                            <Route path="/practice" element={<Navigate to="/setup" replace />} />
                            <Route path="/room" element={<InterviewRoom />} />
                            <Route path="/interview/:id" element={<InterviewRoom />} />
                            <Route path="/history" element={<HistoryPage />} />
                            <Route path="/jobs" element={<JobNotifications />} />
                            <Route path="/saved-jobs" element={<SavedJobs />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </ErrorBoundary>
                      </AuthenticatedLayout>
                    } />
                  </Routes>
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AppStateProvider>
    </ThemeProvider>
  );
}
