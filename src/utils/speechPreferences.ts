export interface VoicePreferences {
  voiceURI: string;
  rate: number;
  pitch: number;
}

export const VOICE_PREFS_STORAGE_KEY = 'intervyou_ai_voice_prefs';
export const VOICE_PREFS_EVENT = 'intervyou-voice-prefs-changed';

export const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  voiceURI: '',
  rate: 1,
  pitch: 1,
};

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function getVoicePreferences(): VoicePreferences {
  if (typeof window === 'undefined') return DEFAULT_VOICE_PREFERENCES;
  try {
    const raw = localStorage.getItem(VOICE_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<VoicePreferences>;
    return {
      voiceURI: typeof parsed.voiceURI === 'string' ? parsed.voiceURI : '',
      rate:
        typeof parsed.rate === 'number' && parsed.rate >= 0.7 && parsed.rate <= 1.5
          ? parsed.rate
          : 1,
      pitch:
        typeof parsed.pitch === 'number' && parsed.pitch >= 0.8 && parsed.pitch <= 1.3
          ? parsed.pitch
          : 1,
    };
  } catch {
    return DEFAULT_VOICE_PREFERENCES;
  }
}

export function saveVoicePreferences(next: Partial<VoicePreferences>): VoicePreferences {
  const current = getVoicePreferences();
  const merged: VoicePreferences = {
    voiceURI: next.voiceURI !== undefined ? String(next.voiceURI) : current.voiceURI,
    rate:
      typeof next.rate === 'number'
        ? Math.max(0.7, Math.min(1.5, Number(next.rate)))
        : current.rate,
    pitch:
      typeof next.pitch === 'number'
        ? Math.max(0.8, Math.min(1.3, Number(next.pitch)))
        : current.pitch,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(VOICE_PREFS_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent(VOICE_PREFS_EVENT, { detail: merged }));
    } catch {
      // ignore quota errors
    }
  }

  return merged;
}

export function getSortedBrowserVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  const available = window.speechSynthesis.getVoices();
  if (!available.length) return [];

  return [...available].sort((a, b) => {
    const aEn = a.lang.toLowerCase().startsWith('en') ? 0 : 1;
    const bEn = b.lang.toLowerCase().startsWith('en') ? 0 : 1;
    if (aEn !== bEn) return aEn - bEn;

    const aNatural = a.name.includes('Natural') || a.name.includes('Google') ? 0 : 1;
    const bNatural = b.name.includes('Natural') || b.name.includes('Google') ? 0 : 1;
    if (aNatural !== bNatural) return aNatural - bNatural;

    return a.name.localeCompare(b.name);
  });
}

export function findPreferredVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI?: string
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  const targetURI = preferredURI ?? getVoicePreferences().voiceURI;
  if (targetURI) {
    const exact = voices.find((v) => v.voiceURI === targetURI);
    if (exact) return exact;
  }
  return (
    voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
    ) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
    voices[0]
  );
}
