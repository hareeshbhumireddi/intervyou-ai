import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import WeeklyCalendar from '../components/WeeklyCalendar';

export default function SchedulePage() {
  return (
    <div className="space-y-8 pb-16">
      {/* Module Header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <CalendarIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="text-blue-600 dark:text-blue-400">Planning & Reminders</span>
                <span aria-hidden="true">·</span>
                <span>15m Browser Alerts</span>
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
                Interview Schedule & Calendar
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                Book mock interview sessions, organize your weekly preparation, and get automated reminders.
              </p>
            </div>
          </div>

          <Link
            to="/setup"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" /> Start Interview Now
          </Link>
        </div>
      </div>

      {/* Full Weekly Scheduling System */}
      <WeeklyCalendar />
    </div>
  );
}
