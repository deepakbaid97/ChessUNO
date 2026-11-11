import { writable } from 'svelte/store';

export interface VoiceState {
  isSupported: boolean;
  isVoiceEnabled: boolean;
  isMicActive: boolean;
  isPushToTalkActive: boolean;
  isOpponentSpeaking: boolean;
  isOpponentVoiceActive: boolean;
  isOpponentMuted: boolean;
  isAutoplayBlocked: boolean;
  error: string | null;
}

export function createVoiceStore() {
  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

  const initialState: VoiceState = {
    isSupported,
    isVoiceEnabled: false,
    isMicActive: false,
    isPushToTalkActive: false,
    isOpponentSpeaking: false,
    isOpponentVoiceActive: false,
    isOpponentMuted: false,
    isAutoplayBlocked: false,
    error: null
  };

  const { subscribe, set, update } = writable<VoiceState>(initialState);

  return {
    subscribe,
    set,
    update,
    setVoiceEnabled: (enabled: boolean) => update(s => ({ ...s, isVoiceEnabled: enabled })),
    setSupported: (supported: boolean) => update(s => ({ ...s, isSupported: supported })),
    setMicActive: (active: boolean) => update(s => ({ ...s, isMicActive: active, error: active ? null : s.error })),
    setPushToTalkActive: (active: boolean) => update(s => ({ ...s, isPushToTalkActive: active })),
    setOpponentSpeaking: (speaking: boolean) => update(s => ({ ...s, isOpponentSpeaking: speaking })),
    setOpponentVoiceActive: (active: boolean) => update(s => ({ ...s, isOpponentVoiceActive: active })),
    toggleOpponentMuted: () => update(s => ({ ...s, isOpponentMuted: !s.isOpponentMuted })),
    setOpponentMuted: (muted: boolean) => update(s => ({ ...s, isOpponentMuted: muted })),
    setAutoplayBlocked: (blocked: boolean) => update(s => ({ ...s, isAutoplayBlocked: blocked })),
    setError: (error: string | null) => update(s => ({ ...s, error })),
    reset: () => update(() => ({
      isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia,
      isVoiceEnabled: false,
      isMicActive: false,
      isPushToTalkActive: false,
      isOpponentSpeaking: false,
      isOpponentVoiceActive: false,
      isOpponentMuted: false,
      isAutoplayBlocked: false,
      error: null
    }))
  };
}

export const voiceStore = createVoiceStore();
