import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebRtcService, PROTOCOL_VERSION, type P2PMessage } from './webrtcService';

describe('WebRtcService', () => {
  let mockNavigator: any;

  class MockRTCPeerConnection {
    signalingState: RTCSignalingState = 'stable';
    iceConnectionState: RTCIceConnectionState = 'new';
    connectionState: RTCPeerConnectionState = 'new';
    remoteDescription: RTCSessionDescriptionInit | null = null;
    localDescription: RTCSessionDescriptionInit | null = null;

    onicecandidate: ((ev: any) => any) | null = null;
    oniceconnectionstatechange: ((ev: any) => any) | null = null;
    ondatachannel: ((ev: any) => any) | null = null;
    ontrack: ((ev: any) => any) | null = null;

    createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'fake-offer-sdp' }));
    createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'fake-answer-sdp' }));
    setLocalDescription = vi.fn(async (desc: any) => {
      this.localDescription = desc;
      this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
    });
    setRemoteDescription = vi.fn(async (desc: any) => {
      this.remoteDescription = desc;
      this.signalingState = desc.type === 'offer' ? 'have-remote-offer' : 'stable';
    });
    addIceCandidate = vi.fn(async (candidate: any) => {});
    addTransceiver = vi.fn((kind: string, init?: any) => {
      const sender = {
        track: null as any,
        replaceTrack: vi.fn(async (t: any) => { sender.track = t; })
      };
      return {
        sender,
        receiver: {},
        direction: init?.direction || 'sendrecv'
      };
    });
    getSenders = vi.fn(() => []);
    addTrack = vi.fn((track: any) => {
      return { track, replaceTrack: vi.fn(async (t: any) => {}) };
    });
    createDataChannel = vi.fn((label: string, init?: any) => {
      return {
        label,
        readyState: 'open',
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null
      };
    });
    close = vi.fn(() => {
      this.signalingState = 'closed';
      this.iceConnectionState = 'closed';
      this.connectionState = 'closed';
    });
  }

  beforeEach(() => {
    (globalThis as any).RTCPeerConnection = MockRTCPeerConnection;

    (globalThis as any).RTCSessionDescription = class {
      type: string;
      sdp: string;
      constructor(desc: any) {
        this.type = desc.type;
        this.sdp = desc.sdp;
      }
    };

    (globalThis as any).RTCIceCandidate = class {
      candidate: string;
      sdpMid?: string;
      sdpMLineIndex?: number;
      constructor(c: any) {
        this.candidate = c.candidate;
        this.sdpMid = c.sdpMid;
        this.sdpMLineIndex = c.sdpMLineIndex;
      }
    };

    mockNavigator = {
      mediaDevices: {
        getUserMedia: vi.fn()
      }
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Section A: WebRTC Connection Lifecycle
  // =========================================================================
  describe('A. WebRTC Connection Lifecycle', () => {
    it('A1: Initial peer connection is created successfully', () => {
      const onSignal = vi.fn();
      const onData = vi.fn();
      const onStateChange = vi.fn();
      const service = new WebRtcService(onSignal, onData, onStateChange);

      service.initializePeerConnection();
      const pc = service.getPeerConnection();
      expect(pc).toBeTruthy();
      expect(service.getConnectionEpoch()).toBe(1);
    });

    it('A2: Calling initialization multiple times does not create duplicate connections', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const firstPc = service.getPeerConnection();

      // Spy on close to verify it's NOT closed during idempotent re-initialization
      const closeSpy = vi.spyOn(firstPc!, 'close');

      service.initializePeerConnection();
      const secondPc = service.getPeerConnection();

      expect(secondPc).toBe(firstPc);
      expect(closeSpy).not.toHaveBeenCalled();
      expect(service.getConnectionEpoch()).toBe(1);
    });

    it('A3: Duplicate offer creation is prevented', async () => {
      const onSignal = vi.fn();
      const service = new WebRtcService(onSignal, vi.fn(), vi.fn());
      service.initializePeerConnection();
      const pc: any = service.getPeerConnection();

      let offerCount = 0;
      pc.createOffer = vi.fn(async () => {
        offerCount++;
        return { type: 'offer', sdp: 'fake-offer-sdp' };
      });
      pc.setLocalDescription = vi.fn(async (desc: any) => {
        pc.signalingState = 'have-local-offer';
      });

      // Call createOffer twice concurrently
      const p1 = service.createOffer();
      const p2 = service.createOffer();
      await Promise.all([p1, p2]);

      expect(offerCount).toBe(1);
      expect(onSignal).toHaveBeenCalledTimes(1);
      expect(onSignal).toHaveBeenCalledWith('offer', expect.stringContaining('fake-offer-sdp'));
    });

    it('A4: Both players successfully complete offer/answer negotiation', async () => {
      let signalFromA: { type: string; payload: string } | null = null;
      let signalFromB: { type: string; payload: string } | null = null;

      const serviceA = new WebRtcService(
        (type, payload) => { signalFromA = { type, payload }; },
        vi.fn(),
        vi.fn()
      );
      const serviceB = new WebRtcService(
        (type, payload) => { signalFromB = { type, payload }; },
        vi.fn(),
        vi.fn()
      );

      serviceA.initializePeerConnection();
      serviceB.initializePeerConnection();

      const pcA: any = serviceA.getPeerConnection();
      const pcB: any = serviceB.getPeerConnection();

      pcA.createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'sdp-offer-A' }));
      pcB.createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'sdp-answer-B' }));

      // Step 1: A creates offer
      await serviceA.createOffer();
      expect(signalFromA).not.toBeNull();
      expect(signalFromA!.type).toBe('offer');

      // Step 2: B receives offer from A
      await serviceB.handleSignal(signalFromA!.type, signalFromA!.payload);
      expect(signalFromB).not.toBeNull();
      expect(signalFromB!.type).toBe('answer');

      // Step 3: A receives answer from B
      await serviceA.handleSignal(signalFromB!.type, signalFromB!.payload);
      expect(pcA.setRemoteDescription).toHaveBeenCalled();
    });

    it('A5: ICE candidates received before remote description are queued', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const pc: any = service.getPeerConnection();
      const addedCandidates: any[] = [];
      pc.addIceCandidate = vi.fn(async (c: any) => addedCandidates.push(c));
      pc.remoteDescription = null;

      // Remote description is not set yet
      await service.handleSignal('candidate', JSON.stringify({ candidate: 'cand-1', sdpMid: '0', sdpMLineIndex: 0 }));

      expect(addedCandidates.length).toBe(0);
      expect(service.getQueuedCandidatesCount()).toBe(1);
    });

    it('A6: Queued candidates are applied after remote description', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const pc: any = service.getPeerConnection();
      const addedCandidates: any[] = [];
      pc.addIceCandidate = vi.fn(async (c: any) => addedCandidates.push(c));

      await service.handleSignal('candidate', JSON.stringify({ candidate: 'cand-early', sdpMid: '0', sdpMLineIndex: 0 }));
      expect(service.getQueuedCandidatesCount()).toBe(1);

      // Offer arrives, sets remote description and drains queue
      await service.handleSignal('offer', JSON.stringify({ type: 'offer', sdp: 'sdp-offer' }));
      expect(addedCandidates.length).toBe(1);
      expect(service.getQueuedCandidatesCount()).toBe(0);
    });

    it('A7: Stale candidates from an old connection are discarded', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const pc: any = service.getPeerConnection();
      const addedCandidates: any[] = [];
      pc.addIceCandidate = vi.fn(async (c: any) => addedCandidates.push(c));
      pc.remoteDescription = { type: 'offer', sdp: 'test' };

      // Candidate with older epoch
      const staleCandidatePayload = JSON.stringify({
        epoch: 0,
        candidate: { candidate: 'stale-cand', sdpMid: '0', sdpMLineIndex: 0 }
      });

      await service.handleSignal('candidate', staleCandidatePayload);
      expect(addedCandidates.length).toBe(0);
      expect(service.getQueuedCandidatesCount()).toBe(0);
    });

    it('A8: SignalR reconnect does not create multiple active peer connections', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const initialPc = service.getPeerConnection();

      // Simulate SignalR reconnect triggering ensurePeerConnection
      service.ensurePeerConnection(false);
      expect(service.getPeerConnection()).toBe(initialPc);
      expect(service.getConnectionEpoch()).toBe(1);
    });

    it('A9: Failed peer connection can recover through a controlled recreation flow', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const initialPc = service.getPeerConnection();
      const initialEpoch = service.getConnectionEpoch();

      await service.restartConnection(false);

      const newPc = service.getPeerConnection();
      expect(newPc).not.toBe(initialPc);
      expect(service.getConnectionEpoch()).toBe(initialEpoch + 1);
    });
  });

  // =========================================================================
  // Section B: Microphone Lifecycle
  // =========================================================================
  describe('B. Microphone Lifecycle', () => {
    it('B1: First voice activation requests microphone permission', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();

      const mockTrack = { id: 'track-1', kind: 'audio', readyState: 'live', enabled: false, stop: vi.fn(), addEventListener: vi.fn() };
      const mockStream = {
        getAudioTracks: () => [mockTrack],
        getTracks: () => [mockTrack]
      };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce(mockStream);

      const result = await service.enableMicrophone();
      expect(result).toBe(true);
      expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
      expect(mockTrack.enabled).toBe(false); // starts muted until PTT pressed
    });

    it('B2: Repeated activation reuses the existing live stream', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();

      const mockTrack = { id: 'track-live', kind: 'audio', readyState: 'live', enabled: false, stop: vi.fn(), addEventListener: vi.fn() };
      const mockStream = {
        getAudioTracks: () => [mockTrack],
        getTracks: () => [mockTrack]
      };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream);

      await service.enableMicrophone();
      expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

      // Second activation while track is still live
      await service.enableMicrophone();
      expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1); // Not called again!
    });

    it('B3: Ended microphone track triggers recovery callback and fetches fresh stream on next activation', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();

      let endedListener: (() => void) | null = null;
      const track1 = {
        id: 'track-1',
        kind: 'audio',
        readyState: 'live',
        enabled: false,
        stop: vi.fn(),
        set onended(fn: any) { endedListener = fn; }
      };
      const stream1 = {
        getAudioTracks: () => [track1],
        getTracks: () => [track1]
      };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce(stream1);

      const trackEndedCb = vi.fn();
      service.setOnLocalTrackEnded(trackEndedCb);

      await service.enableMicrophone();

      // Trigger track ended (e.g. mic unplugged)
      track1.readyState = 'ended';
      if (endedListener) (endedListener as any)();
      expect(trackEndedCb).toHaveBeenCalledTimes(1);

      // Now re-activating voice should request a new stream
      const track2 = {
        id: 'track-2',
        kind: 'audio',
        readyState: 'live',
        enabled: false,
        stop: vi.fn(),
        set onended(fn: any) {}
      };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce({
        getAudioTracks: () => [track2],
        getTracks: () => [track2]
      });

      await service.enableMicrophone();
      expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    });

    it('B4: Microphone permission denial produces a useful error', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      const deniedErr = new Error('Permission denied');
      deniedErr.name = 'NotAllowedError';
      mockNavigator.mediaDevices.getUserMedia.mockRejectedValueOnce(deniedErr);

      await expect(service.enableMicrophone()).rejects.toThrow('Microphone permission denied.');
    });

    it('B5: Leaving voice stops all local tracks', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();

      const stopSpy = vi.fn();
      const mockTrack = { id: 'track-stop', kind: 'audio', readyState: 'live', enabled: false, stop: stopSpy };
      const mockStream = {
        getAudioTracks: () => [mockTrack],
        getTracks: () => [mockTrack]
      };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce(mockStream);

      await service.enableMicrophone();
      service.closeAudio();

      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(service.getLocalAudioStream()).toBeNull();
    });

    it('B6: Rejoining voice obtains a fresh stream', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();

      const track1 = { id: 't1', readyState: 'live', stop: vi.fn() };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce({
        getAudioTracks: () => [track1],
        getTracks: () => [track1]
      });
      await service.enableMicrophone();

      service.closeAudio();

      const track2 = { id: 't2', readyState: 'live', stop: vi.fn() };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce({
        getAudioTracks: () => [track2],
        getTracks: () => [track2]
      });
      await service.enableMicrophone();

      expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
      expect(service.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('t2');
    });

    it('B7: Existing audio sender receives the replacement track without unnecessary renegotiation', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();

      const replaceTrackSpy = vi.fn().mockResolvedValue(undefined);
      (service as any).audioSender = { replaceTrack: replaceTrackSpy };

      const track = { id: 'replacement-track', readyState: 'live', enabled: false, stop: vi.fn() };
      mockNavigator.mediaDevices.getUserMedia.mockResolvedValueOnce({
        getAudioTracks: () => [track],
        getTracks: () => [track]
      });

      await service.enableMicrophone();
      expect(replaceTrackSpy).toHaveBeenCalledWith(track);
    });
  });

  // =========================================================================
  // Section D: Voice Status and Remote Playback
  // =========================================================================
  describe('D. Voice Status and Remote Playback', () => {
    it('D1: Speaking status is transmitted when the data channel is open', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      const mockChannel: any = {
        readyState: 'open',
        send: vi.fn()
      };
      (service as any).dataChannel = mockChannel;

      const track = { enabled: false };
      (service as any).localAudioStream = { getAudioTracks: () => [track] };

      service.setPushToTalk(true, 'Alice');
      expect(mockChannel.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(mockChannel.send.mock.calls[0][0]);
      expect(sent.type).toBe('voice-status');
      expect(sent.payload.speaking).toBe(true);
    });

    it('D2: Data channel unavailable does not break actual audio transmission', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      // No data channel open
      (service as any).dataChannel = null;

      const track = { enabled: false };
      (service as any).localAudioStream = { getAudioTracks: () => [track] };

      // Should not throw, and track should be enabled
      expect(() => service.setPushToTalk(true, 'Alice')).not.toThrow();
      expect(track.enabled).toBe(true);

      service.setPushToTalk(false, 'Alice');
      expect(track.enabled).toBe(false);
    });

    it('D3: Opponent speaking indicator updates correctly', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      const voiceStatusCb = vi.fn();
      service.setOnVoiceStatus(voiceStatusCb);

      const mockChannel: any = { readyState: 'open', send: vi.fn() };
      (service as any).setDataChannel(mockChannel);

      const msg = {
        id: 'msg-voice-1',
        version: PROTOCOL_VERSION,
        type: 'voice-status',
        sender: 'Bob',
        payload: { speaking: true, voiceActive: true },
        timestamp: Date.now()
      };

      mockChannel.onmessage({ data: JSON.stringify(msg) });
      expect(voiceStatusCb).toHaveBeenCalledWith('Bob', { speaking: true, voiceActive: true });
    });

    it('D4: Opponent speaking indicator resets on disconnect', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      const voiceStatusCb = vi.fn();
      service.setOnVoiceStatus(voiceStatusCb);

      // Simulate connection closed / reset
      service.resetOpponentVoiceStatus();
      expect(voiceStatusCb).toHaveBeenCalledWith('Opponent', { speaking: false, voiceActive: false });
    });

    it('D5: Remote audio attaches correctly when tracks arrive', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const pc: any = service.getPeerConnection();

      const mockRemoteTrack = { kind: 'audio', id: 'remote-t1', enabled: true, onunmute: null, onended: null };
      const mockStream = { id: 'remote-stream', getTracks: () => [mockRemoteTrack] };

      const onRemoteStreamCb = vi.fn();
      service.setOnRemoteStream(onRemoteStreamCb);

      pc.ontrack({
        track: mockRemoteTrack,
        streams: [mockStream]
      });

      expect(service.getRemoteAudioStream()).toBeTruthy();
      expect(onRemoteStreamCb).toHaveBeenCalledWith(mockStream);
    });

    it('D6: Remote audio playback retries after user interaction', async () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      const mockAudioEl: any = {
        srcObject: {},
        play: vi.fn().mockRejectedValueOnce(Object.assign(new Error('Autoplay blocked'), { name: 'NotAllowedError' }))
      };
      service.setAudioElement(mockAudioEl);

      service.playRemoteAudio();
      // Allow the rejected promise to settle
      await Promise.resolve();
      await Promise.resolve();

      expect(service.isAudioPlaybackPending()).toBe(true);

      // User interacts: unlockAudio is called
      mockAudioEl.play.mockResolvedValueOnce(undefined);
      service.unlockAudio();
      expect(mockAudioEl.play).toHaveBeenCalledTimes(2);
    });

    it('D7: Muting the opponent suppresses playback without affecting incoming tracks', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      const mockAudioEl: any = { muted: false, srcObject: {} };
      service.setAudioElement(mockAudioEl);

      service.muteOpponent(true);
      expect(mockAudioEl.muted).toBe(true);
      expect(service.isOpponentMuted()).toBe(true);

      service.muteOpponent(false);
      expect(mockAudioEl.muted).toBe(false);
      expect(service.isOpponentMuted()).toBe(false);
    });

    it('D8: Remote track ending is handled correctly', () => {
      const service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
      service.initializePeerConnection();
      const pc: any = service.getPeerConnection();

      let endedListener: any = null;
      const mockRemoteTrack = {
        kind: 'audio',
        id: 'remote-t1',
        enabled: true,
        onunmute: null,
        set onended(fn: any) { endedListener = fn; }
      };

      const voiceStatusCb = vi.fn();
      service.setOnVoiceStatus(voiceStatusCb);

      pc.ontrack({
        track: mockRemoteTrack,
        streams: [{ getTracks: () => [mockRemoteTrack] }]
      });

      // Simulate remote track ending
      if (endedListener) endedListener();
      expect(voiceStatusCb).toHaveBeenCalledWith('Opponent', { speaking: false, voiceActive: false });
    });
  });

  describe('Autoplay Recovery, Unified Voice Status, and ICE Configuration', () => {
    describe('ICE Configuration Handling', () => {
      it('returns default STUN servers when no config is provided', () => {
        const servers = WebRtcService.parseIceServers();
        expect(servers).toEqual([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]);
      });

      it('parses valid JSON array of RTCIceServer objects', () => {
        const custom = '[{"urls":["stun:stun.custom.com:3478"]}]';
        const servers = WebRtcService.parseIceServers(custom);
        expect(servers).toEqual([{ urls: ['stun:stun.custom.com:3478'] }]);
      });

      it('warns and returns defaults on invalid JSON string', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const servers = WebRtcService.parseIceServers('invalid-json{{{');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[WebRTC Diagnostic] Failed to parse VITE_ICE_SERVERS:'),
          expect.any(Error)
        );
        expect(servers).toEqual([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]);
      });

      it('warns and returns defaults when JSON is not an array', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const servers = WebRtcService.parseIceServers('{"urls":"stun:something"}');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[WebRTC Diagnostic] VITE_ICE_SERVERS must be a JSON array of RTCIceServer objects.')
        );
        expect(servers).toEqual([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]);
      });

      it('warns and returns defaults when array items lack urls property', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const servers = WebRtcService.parseIceServers('[{"username":"alice"}]');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[WebRTC Diagnostic] Invalid RTCIceServer in VITE_ICE_SERVERS: missing "urls".')
        );
        expect(servers).toEqual([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]);
      });
    });

    describe('Autoplay Recovery', () => {
      let service: WebRtcService;
      let mockAudioEl: any;

      beforeEach(() => {
        service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
        mockAudioEl = {
          play: vi.fn().mockRejectedValue(Object.assign(new Error('Autoplay blocked'), { name: 'NotAllowedError' })),
          pause: vi.fn(),
          srcObject: { getTracks: () => [] },
          muted: false,
          volume: 1.0
        };
        service.setAudioElement(mockAudioEl);
      });

      it('notifies onAutoplayBlocked(true) and registers interaction listeners when play() rejects with NotAllowedError', async () => {
        const autoplaySpy = vi.fn();
        service.setOnAutoplayBlocked(autoplaySpy);

        service.playRemoteAudio();
        await Promise.resolve(); // flush microtasks
        await Promise.resolve();

        expect(service.isAudioPlaybackPending()).toBe(true);
        expect(autoplaySpy).toHaveBeenCalledWith(true);
      });

      it('retries playback synchronously on window user gesture (pointerdown) and clears blocked state on success', async () => {
        const autoplaySpy = vi.fn();
        service.setOnAutoplayBlocked(autoplaySpy);

        // First play is blocked
        service.playRemoteAudio();
        await Promise.resolve();
        await Promise.resolve();
        expect(autoplaySpy).toHaveBeenCalledWith(true);

        // Now user performs pointerdown, play succeeds
        mockAudioEl.play.mockResolvedValueOnce(undefined);
        window.dispatchEvent(new Event('pointerdown'));
        await Promise.resolve();
        await Promise.resolve();

        expect(mockAudioEl.play).toHaveBeenCalledTimes(2);
        expect(service.isAudioPlaybackPending()).toBe(false);
        expect(autoplaySpy).toHaveBeenCalledWith(false);

        // Subsequent gestures should NOT trigger additional play calls because listeners were removed
        window.dispatchEvent(new Event('pointerdown'));
        expect(mockAudioEl.play).toHaveBeenCalledTimes(2);
      });

      it('retries playback synchronously on window user gesture (keydown) and clears blocked state on success', async () => {
        const autoplaySpy = vi.fn();
        service.setOnAutoplayBlocked(autoplaySpy);

        service.playRemoteAudio();
        await Promise.resolve();
        await Promise.resolve();

        mockAudioEl.play.mockResolvedValueOnce(undefined);
        window.dispatchEvent(new Event('keydown'));
        await Promise.resolve();
        await Promise.resolve();

        expect(service.isAudioPlaybackPending()).toBe(false);
        expect(autoplaySpy).toHaveBeenCalledWith(false);
      });

      it('does not crash if user interaction happens before remote audio arrives', () => {
        const emptyService = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
        // No audio element or srcObject set yet
        expect(() => {
          emptyService.unlockAudio();
          window.dispatchEvent(new Event('pointerdown'));
        }).not.toThrow();
      });

      it('cleans up interaction listeners when service is closed', async () => {
        service.playRemoteAudio();
        await Promise.resolve();
        await Promise.resolve();

        // Close service
        service.close();

        // Subsequent gestures should not attempt play
        mockAudioEl.play.mockClear();
        window.dispatchEvent(new Event('pointerdown'));
        expect(mockAudioEl.play).not.toHaveBeenCalled();
      });
    });

    describe('Unified Voice Status Handling', () => {
      let service: WebRtcService;

      beforeEach(() => {
        vi.useFakeTimers();
        service = new WebRtcService(vi.fn(), vi.fn(), vi.fn());
        service.initializePeerConnection();
      });

      afterEach(() => {
        vi.useRealTimers();
        service.close();
      });

      it('processes voice status from DataChannel without attempting playback from network callback', () => {
        const mockAudioEl: any = {
          play: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn(),
          srcObject: { getTracks: () => [] }
        };
        service.setAudioElement(mockAudioEl);

        const voiceStatusSpy = vi.fn();
        service.setOnVoiceStatus(voiceStatusSpy);

        const dc: any = (service as any).dataChannel || { onmessage: null };
        // Simulate DataChannel receiving voice-status
        service.handleVoiceStatus('Alice', { speaking: true, voiceActive: true });

        expect(voiceStatusSpy).toHaveBeenCalledWith('Alice', { speaking: true, voiceActive: true });
        // Network callback must NOT trigger audio playback!
        expect(mockAudioEl.play).not.toHaveBeenCalled();
      });

      it('processes voice status from SignalR and runs opponent speaking watchdog', () => {
        const voiceStatusSpy = vi.fn();
        service.setOnVoiceStatus(voiceStatusSpy);

        // Opponent starts speaking via SignalR
        service.handleVoiceStatus('Bob', { speaking: true, voiceActive: true });
        expect(voiceStatusSpy).toHaveBeenCalledWith('Bob', { speaking: true, voiceActive: true });

        // Fast-forward 15 seconds watchdog
        vi.advanceTimersByTime(15000);
        expect(voiceStatusSpy).toHaveBeenLastCalledWith('Bob', { speaking: false, voiceActive: true });
      });

      it('discards voice status with a stale epoch', () => {
        const voiceStatusSpy = vi.fn();
        service.setOnVoiceStatus(voiceStatusSpy);

        // Remote epoch established at 2
        (service as any).remoteEpoch = 2;
        // Stale epoch (e.g. from previous connection)
        service.handleVoiceStatus('Bob', { speaking: true, voiceActive: true }, 1);

        expect(voiceStatusSpy).not.toHaveBeenCalled();
      });

      it('accepts voice status matching current epoch', () => {
        const voiceStatusSpy = vi.fn();
        service.setOnVoiceStatus(voiceStatusSpy);

        (service as any).remoteEpoch = 2;
        service.handleVoiceStatus('Bob', { speaking: true, voiceActive: true }, 2);

        expect(voiceStatusSpy).toHaveBeenCalledWith('Bob', { speaking: true, voiceActive: true });
      });

      it('resets opponent voice status on disconnect or connection close', () => {
        const voiceStatusSpy = vi.fn();
        service.setOnVoiceStatus(voiceStatusSpy);

        service.handleVoiceStatus('Bob', { speaking: true, voiceActive: true });
        service.resetOpponentVoiceStatus();

        expect(voiceStatusSpy).toHaveBeenLastCalledWith('Opponent', { speaking: false, voiceActive: false });
      });
    });
  });
});
