/**
 * Browser Notification Service for Scheduled Mock Interviews
 * Manages notification permissions, datetime parsing, 15-minute countdown checks,
 * native Web Notification triggering, and fallback audio chimes.
 */

export interface ScheduledSessionLike {
  id: string;
  role: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "10:30 AM" or "14:00"
  sector?: string;
  difficulty?: string;
  notes?: string;
  status?: string;
}

const STORAGE_NOTIFIED_KEY = 'intervyou_notified_sessions';

/**
 * Safely parse a date string (YYYY-MM-DD) and time string (e.g. "10:30 AM" or "16:00")
 * into a local Date object.
 */
export function parseSessionDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;

  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;

    let hours = 0;
    let minutes = 0;

    // Check for 12-hour format with AM/PM (e.g. "10:30 AM", "02:15 PM")
    const ampmMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (ampmMatch) {
      hours = parseInt(ampmMatch[1], 10);
      minutes = parseInt(ampmMatch[2], 10);
      const ampm = (ampmMatch[3] || '').toUpperCase();

      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      // Try 24-hour format "HH:MM"
      const parts = timeStr.trim().split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        hours = parts[0];
        minutes = parts[1];
      }
    }

    const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Check if the browser supports the Notification API.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Current permission status ('granted', 'denied', 'default', or 'unsupported').
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return Notification.permission;
  }
}

/**
 * Play a pleasant two-tone reminder chime using Web Audio API
 * (ensures candidates hear the reminder even if visual notifications are minimized).
 */
export function playNotificationChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Non-critical audio error, silently ignore
  }
}

/**
 * Send a native browser notification.
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn('Could not display native notification:', err);
    return null;
  }
}

/**
 * Send a desktop notification via the Web Notifications API when the Interview Room
 * focus timer enters the final 30 seconds (or expires).
 */
export function sendFocusTimerNotification(
  secondsRemaining: number,
  contextLabel?: string
): Notification | null {
  const isTimeUp = secondsRemaining <= 0;
  const title = isTimeUp
    ? 'Focus Timer Ended — Time Up'
    : `${secondsRemaining} Seconds Remaining — Wrap Up`;
  const body = isTimeUp
    ? `${contextLabel ? `${contextLabel}: ` : ''}Your question time limit has finished. Wrap up or submit your response.`
    : `${contextLabel ? `${contextLabel}: ` : ''}You have reached the final ${secondsRemaining} seconds for this question. Summarize your key points now.`;

  return sendBrowserNotification(title, {
    body,
    tag: 'intervyou-focus-timer-alert',
    silent: false,
  });
}

/**
 * Get the set of session IDs that have already been notified for their 15-minute reminder.
 */
export function getNotifiedSessionIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_NOTIFIED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Mark a session ID as notified.
 */
export function markSessionAsNotified(sessionId: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getNotifiedSessionIds();
    current.add(sessionId);
    localStorage.setItem(STORAGE_NOTIFIED_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

/**
 * Check a list of scheduled sessions and trigger reminders for any sessions
 * starting within 15 minutes (between 0 and 15 minutes away).
 */
export function checkUpcomingReminders(
  sessions: ScheduledSessionLike[],
  onTrigger: (session: ScheduledSessionLike, minutesRemaining: number) => void
) {
  const now = Date.now();
  const notified = getNotifiedSessionIds();

  for (const session of sessions) {
    if (session.status === 'cancelled' || session.status === 'completed') {
      continue;
    }

    if (notified.has(session.id)) {
      continue;
    }

    const sessionDateTime = parseSessionDateTime(session.date, session.time);
    if (!sessionDateTime) continue;

    const diffMs = sessionDateTime.getTime() - now;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    // Reminder threshold: 15 minutes before the session (0 <= diffMinutes <= 15)
    if (diffMinutes >= 0 && diffMinutes <= 15) {
      markSessionAsNotified(session.id);
      playNotificationChime();

      // Trigger native browser notification
      sendBrowserNotification(`Mock Interview in ${diffMinutes === 0 ? 'less than a minute' : `${diffMinutes} mins`}: ${session.role}`, {
        body: `Your scheduled session for ${session.role} begins at ${session.time}. Click to review your preparation notes and setup.`,
        tag: `interview-reminder-${session.id}`,
      });

      // Call in-app callback
      onTrigger(session, diffMinutes);
    }
  }
}
