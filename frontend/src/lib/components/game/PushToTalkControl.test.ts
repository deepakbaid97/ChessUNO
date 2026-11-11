import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PushToTalkControl from './PushToTalkControl.svelte';
import { voiceStore } from '../../stores/voiceStore';

describe('PushToTalkControl', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => [{ enabled: false, stop: vi.fn() }],
          getTracks: () => [{ enabled: false, stop: vi.fn() }]
        })
      },
      writable: true,
      configurable: true
    });
    voiceStore.reset();
    voiceStore.setSupported(true);
  });

  it('renders Join Voice button when voice is inactive', async () => {
    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const joinBtn = getByTestId('btn-enable-voice');
    expect(joinBtn).toBeTruthy();
    expect(joinBtn.textContent).toContain('Join Voice');

    const enableVoiceSpy = vi.fn();
    component.$on('enableVoice', enableVoiceSpy);

    await fireEvent.click(joinBtn);
    expect(enableVoiceSpy).toHaveBeenCalledTimes(1);
  });

  it('renders PTT button when voice is enabled and handles mouse/touch hold', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const pttBtn = getByTestId('btn-push-to-talk');
    expect(pttBtn.textContent).toContain('Push to Talk');

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);
    component.$on('pushToTalkEnd', endSpy);

    // Press down
    await fireEvent.mouseDown(pttBtn);
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(true);

    // Release
    await fireEvent.mouseUp(pttBtn);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('handles keyboard shortcuts (KeyV and Space)', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const pttBtn = getByTestId('btn-push-to-talk');
    const startSpy = vi.fn();
    const endSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);
    component.$on('pushToTalkEnd', endSpy);

    // Press V key
    await fireEvent.keyDown(window, { code: 'KeyV', key: 'v' });
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(true);

    // Release V key
    await fireEvent.keyUp(window, { code: 'KeyV', key: 'v' });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('dispatches toggleMuteOpponent and leaveVoice events', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const muteSpy = vi.fn();
    const leaveSpy = vi.fn();
    component.$on('toggleMuteOpponent', muteSpy);
    component.$on('leaveVoice', leaveSpy);

    const muteBtn = getByTestId('btn-mute-opponent');
    await fireEvent.click(muteBtn);
    expect(muteSpy).toHaveBeenCalledTimes(1);

    const leaveBtn = getByTestId('btn-leave-voice');
    await fireEvent.click(leaveBtn);
    expect(leaveSpy).toHaveBeenCalledTimes(1);
  });
});
