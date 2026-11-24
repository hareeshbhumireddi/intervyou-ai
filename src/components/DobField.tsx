import React, { useId, useMemo, useRef, useState, useEffect } from 'react';
import { AlertCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DobFieldProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (e: { target: { value: string } }) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DobField({
  label = 'Date of birth',
  value,
  onChange,
  onBlur,
  error,
  hint,
  required,
  id: customId,
}: DobFieldProps) {
  const generated = useId();
  const id = customId || generated;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Parse YYYY-MM-DD
  const parsed = useMemo(() => {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split('-');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: m, day: d, dateStr: value };
      }
    }
    return null;
  }, [value]);

  // Calendar navigation state (defaults to year 2000 for realistic young adult DOB)
  const [viewYear, setViewYear] = useState(() => parsed?.year || 2000);
  const [viewMonth, setViewMonth] = useState(() => (parsed ? parsed.month : 0));

  // Sync view when value changes
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [parsed]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onBlur]);

  // Generate Year Options (1950 to 14 years before current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 14; y >= 1950; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Calendar Day Grid Computation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Blank cells before month starts
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: 0, dateStr: '', isCurrentMonth: false });
    }

    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      days.push({
        day: d,
        dateStr: `${viewYear}-${mStr}-${dStr}`,
        isCurrentMonth: true,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const handleSelectDay = (dateStr: string) => {
    onChange({ target: { value: dateStr } });
    setIsOpen(false);
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ target: { value: e.target.value } });
  };

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Formatted display text (e.g. "15 May 2000" or raw value)
  const displayLabel = useMemo(() => {
    if (!parsed) return '';
    const mName = MONTH_NAMES[parsed.month] || '';
    return `${parsed.day} ${mName} ${parsed.year}`;
  }, [parsed]);

  return (
    <div ref={containerRef} className="space-y-1.5 w-full relative">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange({ target: { value: '' } })}
            className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
          >
            Clear
          </button>
        )}
      </div>

      {/* Single-Line Interactive Date of Birth Row */}
      <div className="relative">
        <button
          type="button"
          id={id}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm font-medium transition hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:bg-slate-900 cursor-pointer shadow-xs ${
            error
              ? 'border-red-500 text-red-900 dark:text-red-300'
              : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
          }`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <span className={displayLabel ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-400 font-normal'}>
            {displayLabel ? `${displayLabel} (${value})` : 'Select date of birth (Click to open calendar)'}
          </span>
          <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
            <CalendarIcon className="h-4 w-4" />
          </span>
        </button>

        {/* In-DOM Interactive Calendar Popover - Works 100% inside iframes */}
        {isOpen && (
          <div
            role="dialog"
            aria-label="Calendar date picker"
            className="absolute left-0 top-full z-50 mt-2 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Popover Header: Month & Year Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2">
                {/* Month Dropdown */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                  aria-label="Select month"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 outline-none"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                  aria-label="Select year"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 outline-none"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 pt-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 pt-1.5">
              {calendarDays.map((item, idx) => {
                if (!item.isCurrentMonth) {
                  return <div key={`empty-${idx}`} className="h-8 w-8" />;
                }
                const isSelected = value === item.dateStr;
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => handleSelectDay(item.dateStr)}
                    className={`flex h-8 w-8 mx-auto items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 font-bold text-white shadow-md shadow-blue-500/30'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400'
                    }`}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>

            {/* Direct manual date input fallback for typing */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Or type:</span>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={value || ''}
                  onChange={handleManualInput}
                  className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-bold text-blue-600 hover:underline dark:text-blue-400"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Click the field to open the calendar and choose your date of birth.
        </p>
      )}
    </div>
  );
}
