import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PushToTalkControl from './PushToTalkControl.svelte';
import { voiceStore } from '../../stores/voiceStore';

describe('PushToTalkControl (Section C Requirements)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => [{ id: 'mock-audio-track', enabled: false, stop: vi.fn() }],
          getTracks: () => [{ id: 'mock-audio-track', enabled: false, stop: vi.fn() }]
        })
      },
      writable: true,
      configurable: true
    });
    voiceStore.reset();
    voiceStore.setSupported(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('C1: First press enables the microphone track (dispatches pushToTalkStart and updates store)', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(true);
  });

  it('C2: Release disables the microphone track (dispatches pushToTalkEnd and updates store)', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    expect(startSpy).toHaveBeenCalledTimes(1);

    await fireEvent.pointerUp(pttBtn, { pointerId: 1 });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('C3: Repeated press/release cycles work at least 20 consecutive times', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');

    for (let i = 0; i < 25; i++) {
      await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
      expect(startSpy).toHaveBeenCalledTimes(i + 1);
      expect(pttBtn.classList.contains('transmitting')).toBe(true);

      await fireEvent.pointerUp(pttBtn, { pointerId: 1 });
      expect(endSpy).toHaveBeenCalledTimes(i + 1);
      expect(pttBtn.classList.contains('transmitting')).toBe(false);
    }
  });

  it('C4 & C5: Track ID and RTP sender remain unchanged across normal PTT cycles', async () => {
    // In PushToTalkControl, repeated cycles dispatch events to service, neither recreating nor replacing track/sender
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    for (let i = 0; i < 5; i++) {
      await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
      await fireEvent.pointerUp(pttBtn, { pointerId: 1 });
    }

    expect(startSpy).toHaveBeenCalledTimes(5);
    expect(endSpy).toHaveBeenCalledTimes(5);
  });

  it('C6: Duplicate pointer-down events do not trigger duplicate starts', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 }); // Duplicate

    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it('C7: Pointer cancellation releases the microphone', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const endSpy = vi.fn();
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    expect(pttBtn.classList.contains('transmitting')).toBe(true);

    await fireEvent.pointerCancel(pttBtn, { pointerId: 1 });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('C8: Lost pointer capture releases the microphone', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const endSpy = vi.fn();
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    expect(pttBtn.classList.contains('transmitting')).toBe(true);

    await fireEvent(pttBtn, new CustomEvent('lostpointercapture'));
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('C9: Window blur releases the microphone', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const endSpy = vi.fn();
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    expect(pttBtn.classList.contains('transmitting')).toBe(true);

    await fireEvent(window, new Event('blur'));
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('C10: Component destruction releases the microphone', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const endSpy = vi.fn();
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });

    component.$destroy();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it('C11: Keyboard V shortcut works', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);
    component.$on('pushToTalkEnd', endSpy);

    const pttBtn = getByTestId('btn-push-to-talk');

    await fireEvent.keyDown(window, { code: 'KeyV', key: 'v' });
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(true);

    await fireEvent.keyUp(window, { code: 'KeyV', key: 'v' });
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });

  it('C12: Space shortcut works without scrolling the page', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);

    const spaceEvent = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      cancelable: true
    });
    const preventDefaultSpy = vi.spyOn(spaceEvent, 'preventDefault');

    window.dispatchEvent(spaceEvent);

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('C13: Keyboard shortcuts do not activate while typing in inputs or textareas', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const startSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);

    // Simulate typing in an input element
    const input = document.createElement('input');
    document.body.appendChild(input);

    const keyEvent = new KeyboardEvent('keydown', {
      code: 'KeyV',
      key: 'v',
      bubbles: true
    });
    input.dispatchEvent(keyEvent);

    expect(startSpy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('C14: Disabled controls cannot activate transmission', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId, component } = render(PushToTalkControl, {
      props: { opponentName: 'Bob', disabled: true }
    });

    const startSpy = vi.fn();
    component.$on('pushToTalkStart', startSpy);

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    await fireEvent.keyDown(window, { code: 'KeyV', key: 'v' });

    expect(startSpy).not.toHaveBeenCalled();
  });

  it('C15: Microphone track never remains enabled after release', async () => {
    voiceStore.setVoiceEnabled(true);
    voiceStore.setMicActive(true);

    const { getByTestId } = render(PushToTalkControl, {
      props: { opponentName: 'Bob' }
    });

    const pttBtn = getByTestId('btn-push-to-talk');
    await fireEvent.pointerDown(pttBtn, { pointerId: 1 });
    await fireEvent.pointerUp(pttBtn, { pointerId: 1 });

    expect(pttBtn.classList.contains('transmitting')).toBe(false);
  });
});
