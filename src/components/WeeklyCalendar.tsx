import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  SlotInfo,
  ToolbarProps,
  View,
  Views,
} from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay, addMinutes } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Play,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Bell,
  BellRing,
  Volume2,
} from 'lucide-react';
import { Difficulty, Sector } from '../types';
import {
  getNotificationPermission,
  requestNotificationPermission,
  isNotificationSupported,
  checkUpcomingReminders,
  playNotificationChime,
  sendBrowserNotification,
} from '../utils/notificationService';

export interface ScheduledInterview {
  id: string;
  role: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // e.g. "10:30 AM" or "16:00"
  sector: Sector;
  difficulty: Difficulty;
  notes?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt: string;
}

interface CalendarSessionEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  session: ScheduledInterview;
}

const STORAGE_KEY_SCHEDULE = 'intervyou_scheduled_sessions';

const POPULAR_ROLES = [
  'Python Developer',
  'Full Stack Developer',
  'Java Spring Boot Engineer',
  'System Design & Architecture',
  'HR & Behavioral Round',
  'Data Structures & Algorithms',
  'Frontend Engineer (React/TS)',
  'AI / ML Engineer',
];

const TIME_SLOTS = [
  '09:00 AM',
  '10:30 AM',
  '12:00 PM',
  '02:00 PM',
  '04:30 PM',
  '07:00 PM',
  '08:30 PM',
];

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
});

function formatLocalIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseSessionStart(dateStr: string, timeStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = (Number(monthStr) || 1) - 1;
  const day = Number(dayStr) || 1;

  let hours = 10;
  let minutes = 0;

  const amPmMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    let h = Number(amPmMatch[1]);
    const m = Number(amPmMatch[2]);
    const period = amPmMatch[3].toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    hours = h;
    minutes = m;
  } else {
    const twentyFourMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFourMatch) {
      hours = Number(twentyFourMatch[1]);
      minutes = Number(twentyFourMatch[2]);
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

function getInitialSessions(): ScheduledInterview[] {
  const saved = localStorage.getItem(STORAGE_KEY_SCHEDULE);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // fallback
    }
  }

  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const inThreeDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
  const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);

  const initial: ScheduledInterview[] = [
    {
      id: 'session-sample-1',
      role: 'Python Developer',
      date: formatLocalIsoDate(tomorrow),
      time: '10:30 AM',
      sector: 'Private',
      difficulty: 'Intermediate',
      notes: 'Focus on FastAPI, SQL indexing, and the STAR technique.',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'session-sample-2',
      role: 'System Design & Architecture',
      date: formatLocalIsoDate(inThreeDays),
      time: '04:00 PM',
      sector: 'Private',
      difficulty: 'Advanced',
      notes: 'Prepare microservices caching, load balancing, and database normalization.',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'session-sample-3',
      role: 'HR & Behavioral Round',
      date: formatLocalIsoDate(nextWeek),
      time: '02:00 PM',
      sector: 'Private',
      difficulty: 'Beginner',
      notes: 'Practice concise leadership and conflict-resolution stories.',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    },
  ];

  localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(initial));
  return initial;
}

const VIEW_LABELS: Array<{ key: View; label: string }> = [
  { key: Views.MONTH, label: 'Month' },
  { key: Views.WEEK, label: 'Week' },
  { key: Views.DAY, label: 'Day' },
  { key: Views.AGENDA, label: 'Agenda' },
];

function CalendarToolbar({
  label,
  view,
  onNavigate,
  onView,
}: ToolbarProps<CalendarSessionEvent, object>) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white cursor-pointer"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('TODAY')}
            className="whitespace-nowrap px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-200 dark:hover:text-white cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white cursor-pointer"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">{label}</h3>
      </div>

      <div
        className="inline-flex items-center gap-1 self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:self-auto"
        role="group"
        aria-label="Calendar view mode"
      >
        {VIEW_LABELS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onView(item.key)}
            className={`whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              view === item.key
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WeeklyCalendar() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ScheduledInterview[]>(getInitialSessions);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [calendarView, setCalendarView] = useState<View>(Views.MONTH);
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  // Schedule Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState(TIME_SLOTS[1]);
  const [formRole, setFormRole] = useState(POPULAR_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [formSector, setFormSector] = useState<Sector>('Private');
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>('Intermediate');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Selected Event Inspector Modal State
  const [inspectedSession, setInspectedSession] = useState<ScheduledInterview | null>(null);

  // Notification Reminder State
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission
  );
  const [activeAlert, setActiveAlert] = useState<{
    session: ScheduledInterview;
    minutesLeft: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(sessions));
  }, [sessions]);

  // Periodic 15-Minute Reminder Checker
  useEffect(() => {
    const runCheck = () => {
      checkUpcomingReminders(sessions, (triggeredSession, minutesLeft) => {
        setActiveAlert({
          session: triggeredSession as ScheduledInterview,
          minutesLeft,
        });
      });
    };

    runCheck();
    const interval = setInterval(runCheck, 15000);
    return () => clearInterval(interval);
  }, [sessions]);

  const handleToggleNotifications = async () => {
    if (!isNotificationSupported()) {
      setToastMessage('Browser notifications are not supported in this browser. In-app alerts remain active.');
      setTimeout(() => setToastMessage(''), 4000);
      return;
    }

    const res = await requestNotificationPermission();
    setPermission(res);

    if (res === 'granted') {
      sendBrowserNotification('Interview Reminders Active', {
        body: 'You will receive desktop notifications 15 minutes before all scheduled mock interviews.',
      });
      playNotificationChime();
      setToastMessage('Browser reminders active. We will notify you 15m before each session.');
    } else if (res === 'denied') {
      setToastMessage('Browser notifications were blocked. In-app reminder alerts remain active.');
    }
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleTestReminder = () => {
    playNotificationChime();

    const mockSession: ScheduledInterview = {
      id: `test-${Date.now()}`,
      role: 'Python Developer (Mock Trial)',
      date: formatLocalIsoDate(new Date()),
      time: 'In 15 Minutes',
      sector: 'Private',
      difficulty: 'Intermediate',
      notes: 'Review STAR method and FastAPI microservices architecture.',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };

    sendBrowserNotification('Mock Interview in 15 Minutes (Reminder Test)', {
      body: 'Your scheduled session for Python Developer starts in 15 minutes. Prepare your notes and setup.',
    });

    setActiveAlert({
      session: mockSession,
      minutesLeft: 15,
    });

    setToastMessage('Test reminder triggered: audio chime played and 15m reminder alert shown.');
    setTimeout(() => setToastMessage(''), 4000);
  };

  const selectedDateStr = useMemo(() => formatLocalIsoDate(selectedDate), [selectedDate]);

  const visibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (s.status === 'cancelled') return false;
      if (statusFilter === 'upcoming') return s.status === 'upcoming';
      if (statusFilter === 'completed') return s.status === 'completed';
      return true;
    });
  }, [sessions, statusFilter]);

  const calendarEvents = useMemo<CalendarSessionEvent[]>(() => {
    return visibleSessions.map((session) => {
      const start = parseSessionStart(session.date, session.time);
      const end = addMinutes(start, 45);
      return {
        id: session.id,
        title: `${session.time} · ${session.role}`,
        start,
        end,
        session,
      };
    });
  }, [visibleSessions]);

  const selectedDaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.date === selectedDateStr && s.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [sessions, selectedDateStr]);

  const handleOpenScheduleModal = useCallback(
    (dateStr?: string, timeStr?: string) => {
      setFormDate(dateStr || selectedDateStr);
      setFormTime(timeStr || TIME_SLOTS[1]);
      setFormRole(POPULAR_ROLES[0]);
      setCustomRole('');
      setFormSector('Private');
      setFormDifficulty('Intermediate');
      setFormNotes('');
      setFormError('');
      setIsModalOpen(true);
    },
    [selectedDateStr]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      const clickedDate = slotInfo.start;
      setSelectedDate(clickedDate);
      const isoDate = formatLocalIsoDate(clickedDate);

      // In Week/Day views, use the clicked time slot directly
      const isTimeSlotClick = calendarView === Views.WEEK || calendarView === Views.DAY;
      const formattedSlotTime = isTimeSlotClick ? format(clickedDate, 'hh:mm a') : TIME_SLOTS[1];
      handleOpenScheduleModal(isoDate, formattedSlotTime);
    },
    [calendarView, handleOpenScheduleModal]
  );

  const handleSelectEvent = useCallback((event: CalendarSessionEvent) => {
    setSelectedDate(event.start);
    setInspectedSession(event.session);
  }, []);

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRole = formRole === 'Other' ? customRole.trim() : formRole;
    if (!finalRole) {
      setFormError('Please choose or enter an interview role.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }

    const newSession: ScheduledInterview = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: finalRole,
      date: formDate,
      time: formTime,
      sector: formSector,
      difficulty: formDifficulty,
      notes: formNotes.trim(),
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };

    const targetDate = parseSessionStart(formDate, formTime);
    setSelectedDate(targetDate);
    setCalendarDate(targetDate);
    setSessions((prev) => [...prev, newSession]);
    setIsModalOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setInspectedSession((current) => (current?.id === id ? null : current));
  };

  const handleToggleCompleted = (id: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'completed' ? 'upcoming' : 'completed' } : s
      )
    );
    setInspectedSession((current) =>
      current?.id === id
        ? { ...current, status: current.status === 'completed' ? 'upcoming' : 'completed' }
        : current
    );
  };

  const handleLaunchSession = (session: ScheduledInterview) => {
    navigate('/setup', {
      state: {
        sector: session.sector,
        role: session.role,
        difficulty: session.difficulty,
      },
    });
  };

  const eventPropGetter = useCallback((event: CalendarSessionEvent) => {
    const { difficulty, status } = event.session;
    if (status === 'completed') {
      return {
        style: {
          backgroundColor: '#64748b',
          color: '#ffffff',
          opacity: 0.85,
        },
      };
    }
    if (difficulty === 'Beginner') {
      return {
        style: {
          backgroundColor: '#059669',
          color: '#ffffff',
        },
      };
    }
    if (difficulty === 'Advanced') {
      return {
        style: {
          backgroundColor: '#7c3aed',
          color: '#ffffff',
        },
      };
    }
    return {
      style: {
        backgroundColor: '#2563eb',
        color: '#ffffff',
      },
    };
  }, []);

  const timeSlotOptions = useMemo(() => {
    if (!formTime || TIME_SLOTS.includes(formTime)) return TIME_SLOTS;
    return [formTime, ...TIME_SLOTS];
  }, [formTime]);

  return (
    <section
      aria-labelledby="weekly-calendar-heading"
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8"
    >
      {/* 15-Minute Reminder Alert Banner */}
      {activeAlert && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs dark:border-amber-700/60 dark:bg-amber-950/40">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Mock Interview in{' '}
                    {activeAlert.minutesLeft === 0
                      ? 'less than a minute'
                      : `${activeAlert.minutesLeft} Minutes`}
                  </h3>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    ({activeAlert.session.time})
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                  <strong>{activeAlert.session.role}</strong> · {activeAlert.session.sector} Sector (
                  {activeAlert.session.difficulty})
                </p>
                {activeAlert.session.notes && (
                  <p className="mt-0.5 text-xs italic text-amber-700/90 dark:text-amber-400">
                    "{activeAlert.session.notes}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => handleLaunchSession(activeAlert.session)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Launch Mock Interview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAlert(null)}
                className="rounded-xl border border-amber-200 bg-white/80 p-2 text-xs font-semibold text-amber-800 hover:bg-white dark:border-amber-800 dark:bg-slate-900 dark:text-amber-300 cursor-pointer"
                aria-label="Dismiss reminder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-2.5 text-xs font-semibold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-blue-600 hover:text-blue-800 cursor-pointer"
            aria-label="Dismiss notification toast"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <CalendarIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id="weekly-calendar-heading" className="text-xl font-bold text-slate-900 dark:text-white">
              Mock Interview Calendar
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click any date or time slot to schedule a session, or click a scheduled event to view details and launch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleNotifications}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
              permission === 'granted'
                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/80 dark:bg-emerald-950/30 dark:text-emerald-300'
                : permission === 'denied'
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {permission === 'granted' ? (
              <>
                <BellRing className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>15m Reminders On</span>
              </>
            ) : (
              <>
                <Bell className="h-3.5 w-3.5 text-slate-500" />
                <span>Enable 15m Reminders</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleTestReminder}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            title="Test the 15-minute reminder notification and audio chime"
          >
            <Volume2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Test</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenScheduleModal()}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Session</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Difficulty Key */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 self-start rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              { id: 'all', label: 'All Sessions' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === item.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" aria-hidden="true" />
            Beginner
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" aria-hidden="true" />
            Intermediate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-violet-600" aria-hidden="true" />
            Advanced
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-slate-500" aria-hidden="true" />
            Completed
          </span>
        </div>
      </div>

      {/* Interactive React Big Calendar */}
      <div className="min-h-[560px] w-full">
        <BigCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          view={calendarView}
          onView={setCalendarView}
          date={calendarDate}
          onNavigate={(nextDate) => {
            setCalendarDate(nextDate);
            setSelectedDate(nextDate);
          }}
          selectable
          popup
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          components={{ toolbar: CalendarToolbar }}
          style={{ height: 560 }}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          step={30}
          timeslots={2}
          min={new Date(2026, 0, 1, 7, 0)}
          max={new Date(2026, 0, 1, 22, 0)}
        />
      </div>

      {/* Selected Day's Sessions & Detail Panel */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 dark:border-slate-800/80 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Scheduled for{' '}
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              }).format(selectedDate)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleOpenScheduleModal(selectedDateStr)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Book time slot
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {selectedDaySessions.length > 0 ? (
            selectedDaySessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {session.role}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                      <Clock className="h-3.5 w-3.5" /> {session.time}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-xs font-medium text-slate-500">
                      {session.sector} Sector ({session.difficulty})
                    </span>
                    {session.status === 'completed' && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Completed
                        </span>
                      </>
                    )}
                  </div>
                  {session.notes && (
                    <p className="text-xs italic text-slate-600 dark:text-slate-400">
                      "{session.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleCompleted(session.id)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {session.status === 'completed' ? 'Reopen' : 'Mark Done'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunchSession(session)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Launch Interview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(session.id)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                    aria-label={`Cancel ${session.role} session`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CalendarIcon className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs text-slate-500">No mock interview sessions booked for this day.</p>
              <button
                type="button"
                onClick={() => handleOpenScheduleModal(selectedDateStr)}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                + Schedule a session now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clicked Calendar Event Quick Inspector Modal */}
      {inspectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onClick={() => setInspectedSession(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspected-session-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {inspectedSession.status === 'completed' ? 'Completed Session' : 'Scheduled Mock Session'}
                </p>
                <h3 id="inspected-session-title" className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
                  {inspectedSession.role}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedSession(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
                aria-label="Close session details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Date & Time</dt>
                <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {inspectedSession.date} · {inspectedSession.time}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Track</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {inspectedSession.sector} · {inspectedSession.difficulty}
                </dd>
              </div>
              {inspectedSession.notes && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  {inspectedSession.notes}
                </div>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDeleteSession(inspectedSession.id)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cancel Session
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleCompleted(inspectedSession.id)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {inspectedSession.status === 'completed' ? 'Mark Upcoming' : 'Mark Completed'}
                </button>
                <button
                  type="button"
                  onClick={() => handleLaunchSession(inspectedSession)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-current" /> Launch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Session Modal Dialog */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <CalendarIcon className="h-4 w-4" />
                </span>
                <h3 id="schedule-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Schedule Mock Interview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
                aria-label="Close schedule modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="mt-4 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Date & Time Picker */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((offset) => {
                      const d = new Date();
                      d.setDate(d.getDate() + offset);
                      const iso = formatLocalIsoDate(d);
                      const label =
                        offset === 0
                          ? 'Today'
                          : offset === 1
                          ? 'Tomorrow'
                          : d.toLocaleDateString(undefined, { weekday: 'short' });
                      const isSelected = formDate === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setFormDate(iso)}
                          className={`cursor-pointer rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Time Slot
                  </label>
                  <select
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {timeSlotOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Target Role / Topic
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {POPULAR_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Other">Custom Role / Topic...</option>
                </select>

                {formRole === 'Other' && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom role or topic"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                )}
              </div>

              {/* Sector & Difficulty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Sector
                  </label>
                  <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
                    {(['Private', 'Government'] as Sector[]).map((sec) => (
                      <button
                        type="button"
                        key={sec}
                        onClick={() => setFormSector(sec)}
                        className={`flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-bold transition ${
                          formSector === sec
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Difficulty
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as Difficulty)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Prep Notes */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Preparation Notes / Key Focus (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focus on STAR method, Python generators, database indexing"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
