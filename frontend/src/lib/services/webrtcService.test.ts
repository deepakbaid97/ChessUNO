import { describe, it, expect, vi } from 'vitest';
import { WebRtcService, PROTOCOL_VERSION, type P2PMessage } from './webrtcService';

describe('WebRtcService', () => {
  it('instantiates and provides typed send methods with fallback', () => {
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

  it('validates protocol messages with ID and version', () => {
    const validMsg: P2PMessage = {
      id: 'msg-123',
      version: PROTOCOL_VERSION,
      type: 'ping',
      sender: 'Alice',
      timestamp: Date.now()
    };
    expect(WebRtcService.isValidMessage(validMsg)).toBe(true);

    const invalidMsg = { type: 'ping', sender: 'Bob' };
    expect(WebRtcService.isValidMessage(invalidMsg)).toBe(false);
  });

  it('queues candidates when remote description is missing and drains upon offer/answer', async () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    
    // Mock RTCPeerConnection
    let remoteDesc: any = null;
    const addedCandidates: any[] = [];
    const mockPc: any = {
      get remoteDescription() { return remoteDesc; },
      addIceCandidate: vi.fn(async (cand) => { addedCandidates.push(cand); }),
      setRemoteDescription: vi.fn(async (desc) => { remoteDesc = desc; }),
      createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'fake-sdp' })),
      setLocalDescription: vi.fn(async () => {})
    };
    (service as any).peerConnection = mockPc;

    // 1. Candidate arrives before remote description
    await service.handleSignal('candidate', JSON.stringify({ candidate: 'cand-1', sdpMid: '0', sdpMLineIndex: 0 }));
    expect(addedCandidates.length).toBe(0);
    expect(service.getQueuedCandidatesCount()).toBe(1);

    // 2. Offer arrives and sets remote description
    await service.handleSignal('offer', JSON.stringify({ type: 'offer', sdp: 'fake-sdp' }));
    
    // 3. Queued candidates are drained
    expect(addedCandidates.length).toBe(1);
    expect(service.getQueuedCandidatesCount()).toBe(0);
  });

  it('closes peer connection cleanly', () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    service.close();
    expect(service.sendData('after close')).toBe(false);
  });
});
