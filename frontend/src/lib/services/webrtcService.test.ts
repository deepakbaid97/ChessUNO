import { describe, it, expect, vi } from 'vitest';
import { WebRtcService, type P2PMessage } from './webrtcService';

describe('WebRtcService', () => {
  it('instantiates and provides typed send methods', () => {
    const onSignal = vi.fn();
    const onData = vi.fn();
    const onStateChange = vi.fn();

    const service = new WebRtcService(onSignal, onData, onStateChange);
    expect(service).toBeTruthy();

    // sendData returns false when channel is not open (safe fallback)
    expect(service.sendData('test')).toBe(false);
    expect(service.sendPing('Alice')).toBe(false);
    expect(service.sendCursor('Alice', 100, 200)).toBe(false);
    expect(service.sendChat('Alice', 'Hello!')).toBe(false);
  });

  it('closes peer connection cleanly', () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    service.close();
    expect(service.sendData('after close')).toBe(false);
  });
});

