export const TOGGLE_FOCUS_TIMER_EVENT = 'intervyou:toggle-focus-timer';
export const TOGGLE_INTERVIEW_MIC_EVENT = 'intervyou:toggle-interview-mic';
export const SUBMIT_INTERVIEW_ANSWER_EVENT = 'intervyou:submit-interview-answer';

export interface ShortcutDefinition {
  id: string;
  keys: string[];
  label: string;
  description: string;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutDefinition[];
}

export const KEYBOARD_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global Navigation',
    items: [
      {
        id: 'start-interview',
        keys: ['Ctrl', 'I'],
        label: 'Start Interview',
        description: 'Open interview setup from anywhere in the app',
      },
      {
        id: 'go-dashboard',
        keys: ['Ctrl', 'D'],
        label: 'Dashboard',
        description: 'Jump directly back to your main dashboard',
      },
      {
        id: 'toggle-help',
        keys: ['?'],
        label: 'Keyboard Shortcuts',
        description: 'Show or hide this keyboard shortcuts reference',
      },
      {
        id: 'close-modal',
        keys: ['Esc'],
        label: 'Close Dialog',
        description: 'Dismiss the active shortcuts guide',
      },
    ],
  },
  {
    title: 'Interview Room',
    items: [
      {
        id: 'pause-timer',
        keys: ['Space'],
        label: 'Pause / Resume Timer',
        description: 'Toggle the question Focus Timer outside text fields',
      },
      {
        id: 'toggle-mic',
        keys: ['M'],
        label: 'Toggle Recording',
        description: 'Start or stop voice capture outside text fields',
      },
      {
        id: 'submit-answer',
        keys: ['Ctrl', 'Enter'],
        label: 'Submit Answer',
        description: 'Evaluate your current response and advance',
      },
    ],
  },
];

export function isInterviewRoomPath(pathname: string): boolean {
  return /^\/(room|interview(\/|$))/.test(pathname);
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) {
    return true;
  }
  return target instanceof HTMLElement && target.isContentEditable;
}

export function isInteractiveSpaceTarget(target: EventTarget | null): boolean {
  if (isEditableTarget(target)) return true;
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a[href], summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], [role="menuitem"]'
    )
  );
}
