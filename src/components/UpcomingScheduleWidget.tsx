import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronRight, Plus, Briefcase, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScheduledInterview } from './WeeklyCalendar';

const STORAGE_KEY_SCHEDULE = 'intervyou_scheduled_sessions';

export default function UpcomingScheduleWidget() {
  const [scheduled, setScheduled] = useState<ScheduledInterview[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SCHEDULE);
      if (stored) {
        const parsed = JSON.parse(stored) as ScheduledInterview[];
        const now = new Date();
        // Filter upcoming only and sort by date/time
        const upcoming = parsed.filter((s) => {
          if (s.status !== 'upcoming') return false;
          const sessionDate = new Date(`${s.date}T${s.time ? '12:00:00' : '00:00:00'}`);
          return sessionDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }).sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime());

        setScheduled(upcoming);
      }
    } catch {
      setScheduled([]);
    }
  }, []);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <CalendarIcon className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upcoming Schedule
                </h3>
                {scheduled.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {scheduled.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Calendar reminders & slots</p>
            </div>
          </div>

          <Link
            to="/schedule"
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            <span>Calendar</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {scheduled.length > 0 ? (
            scheduled.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs dark:bg-slate-800 text-blue-600">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.role}
                    </h4>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                        <Clock className="h-3 w-3" />
                        {item.time || '10:00 AM'}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(item.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                          item.sector === 'Government'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}
                      >
                        {item.sector}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to="/setup"
                  state={{ role: { title: item.role }, sector: item.sector, difficulty: item.difficulty }}
                  className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                >
                  Launch
                </Link>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
              <CalendarIcon className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                No sessions scheduled for this week
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Book a date and time to keep your interview preparation consistent.
              </p>
              <Link
                to="/schedule"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Schedule in Calendar
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
          <Bell className="h-3 w-3 text-blue-500" />
          15-min alerts enabled
        </span>
        <Link
          to="/schedule"
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Book Slot →
        </Link>
      </div>
    </div>
  );
}
