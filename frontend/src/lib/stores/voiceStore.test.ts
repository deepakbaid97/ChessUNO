import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { voiceStore } from './voiceStore';

describe('voiceStore', () => {
  it('manages state transitions correctly', () => {
    voiceStore.reset();
    let state = get(voiceStore);
    expect(state.isVoiceEnabled).toBe(false);
    expect(state.isMicActive).toBe(false);
    expect(state.isPushToTalkActive).toBe(false);

    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);
    state = get(voiceStore);
    expect(state.isVoiceEnabled).toBe(true);
    expect(state.isMicActive).toBe(true);

    voiceStore.setPushToTalkActive(true);
    expect(get(voiceStore).isPushToTalkActive).toBe(true);

    voiceStore.setPushToTalkActive(false);
    expect(get(voiceStore).isPushToTalkActive).toBe(false);

    voiceStore.setOpponentSpeaking(true);
    expect(get(voiceStore).isOpponentSpeaking).toBe(true);

    voiceStore.toggleOpponentMuted();
    expect(get(voiceStore).isOpponentMuted).toBe(true);

    voiceStore.reset();
    state = get(voiceStore);
    expect(state.isVoiceEnabled).toBe(false);
    expect(state.isOpponentMuted).toBe(false);
    expect(state.isOpponentSpeaking).toBe(false);
  });
});

