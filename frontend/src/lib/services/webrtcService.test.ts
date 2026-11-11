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

  it('drains queued candidates upon answer signal', async () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    let remoteDesc: any = null;
    const addedCandidates: any[] = [];
    const mockPc: any = {
      get remoteDescription() { return remoteDesc; },
      addIceCandidate: vi.fn(async (cand) => { addedCandidates.push(cand); }),
      setRemoteDescription: vi.fn(async (desc) => { remoteDesc = desc; })
    };
    (service as any).peerConnection = mockPc;

    await service.handleSignal('candidate', JSON.stringify({ candidate: 'cand-ans', sdpMid: '0', sdpMLineIndex: 0 }));
    expect(service.getQueuedCandidatesCount()).toBe(1);

    await service.handleSignal('answer', JSON.stringify({ type: 'answer', sdp: 'fake-sdp' }));
    expect(addedCandidates.length).toBe(1);
    expect(service.getQueuedCandidatesCount()).toBe(0);
  });

  it('initializePeerConnection closes previous connection before creating new', () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    const closeSpy = vi.spyOn(service, 'close');

    // Simulate existing connection
    (service as any).peerConnection = { close: vi.fn() };
    service.initializePeerConnection();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('validates voice-status protocol message', () => {
    const validVoiceMsg: P2PMessage = {
      id: 'voice-1',
      version: PROTOCOL_VERSION,
      type: 'voice-status',
      sender: 'Alice',
      payload: { speaking: true, voiceActive: true },
      timestamp: Date.now()
    };
    expect(WebRtcService.isValidMessage(validVoiceMsg)).toBe(true);
  });

  it('handles push-to-talk state toggling and track enablement', async () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    const mockTrack = { enabled: false, stop: vi.fn() };
    const mockStream = {
      getAudioTracks: vi.fn(() => [mockTrack]),
      getTracks: vi.fn(() => [mockTrack])
    };

    (service as any).localAudioStream = mockStream;
    const sendTypedSpy = vi.spyOn(service, 'sendTypedMessage').mockReturnValue(true);

    // Press PTT: track enabled becomes true
    const resultActive = service.setPushToTalk(true, 'Alice');
    expect(mockTrack.enabled).toBe(true);
    expect(sendTypedSpy).toHaveBeenCalledWith('voice-status', 'Alice', {
      speaking: true,
      voiceActive: true
    });
    expect(resultActive).toBe(true);

    // Release PTT: track enabled becomes false
    service.setPushToTalk(false, 'Alice');
    expect(mockTrack.enabled).toBe(false);
    expect(sendTypedSpy).toHaveBeenCalledWith('voice-status', 'Alice', {
      speaking: false,
      voiceActive: true
    });
  });

  it('dispatches voice-status callback when received over data channel', () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    const voiceStatusCb = vi.fn();
    service.setOnVoiceStatus(voiceStatusCb);

    // Simulate incoming data channel message
    const mockChannel: any = {};
    (service as any).setDataChannel(mockChannel);

    const payload = {
      id: 'msg-voice-1',
      version: PROTOCOL_VERSION,
      type: 'voice-status',
      sender: 'Bob',
      payload: { speaking: true, voiceActive: true },
      timestamp: Date.now()
    };

    mockChannel.onmessage({ data: JSON.stringify(payload) });
    expect(voiceStatusCb).toHaveBeenCalledWith('Bob', { speaking: true, voiceActive: true });
  });

  it('mutes opponent remote audio', () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    const mockAudio: any = { muted: false };
    (service as any).remoteAudioElement = mockAudio;

    service.muteOpponent(true);
    expect(mockAudio.muted).toBe(true);

    service.muteOpponent(false);
    expect(mockAudio.muted).toBe(false);
  });

  it('closes audio cleanly on closeAudio and close', () => {
    const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
    const stopFn = vi.fn();
    const mockTrack = { stop: stopFn };
    const mockStream = {
      getAudioTracks: vi.fn(() => [mockTrack]),
      getTracks: vi.fn(() => [mockTrack])
    };
    const replaceTrackFn = vi.fn(async () => {});
    const pauseFn = vi.fn();

    (service as any).localAudioStream = mockStream;
    (service as any).audioSender = { replaceTrack: replaceTrackFn };
    (service as any).remoteAudioElement = { pause: pauseFn, srcObject: {} };

    service.closeAudio();
    expect(stopFn).toHaveBeenCalled();
    expect(replaceTrackFn).toHaveBeenCalledWith(null);
    expect(pauseFn).toHaveBeenCalled();
    expect((service as any).localAudioStream).toBeNull();
  });
});
