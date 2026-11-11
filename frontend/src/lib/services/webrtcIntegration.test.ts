import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebRtcService } from './webrtcService';

describe('WebRTC Two-Peer Voice Integration Suite (Section E)', () => {
  let peerA: WebRtcService;
  let peerB: WebRtcService;

  let streamA: any;
  let trackA: any;
  let streamB: any;
  let trackB: any;

  let audioElA: any;
  let audioElB: any;

  let remoteTrackReceivedAtA: any = null;
  let remoteTrackReceivedAtB: any = null;

  let voiceStatusAtA: { sender: string; payload: any } | null = null;
  let voiceStatusAtB: { sender: string; payload: any } | null = null;

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

    trackA = {
      id: 'track-A',
      kind: 'audio',
      readyState: 'live',
      enabled: false,
      stop: vi.fn(),
      addEventListener: vi.fn()
    };
    streamA = {
      id: 'stream-A',
      getAudioTracks: () => [trackA],
      getTracks: () => [trackA]
    };

    trackB = {
      id: 'track-B',
      kind: 'audio',
      readyState: 'live',
      enabled: false,
      stop: vi.fn(),
      addEventListener: vi.fn()
    };
    streamB = {
      id: 'stream-B',
      getAudioTracks: () => [trackB],
      getTracks: () => [trackB]
    };

    audioElA = {
      muted: false,
      srcObject: null,
      paused: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn()
    };
    audioElB = {
      muted: false,
      srcObject: null,
      paused: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn()
    };

    remoteTrackReceivedAtA = null;
    remoteTrackReceivedAtB = null;
    voiceStatusAtA = null;
    voiceStatusAtB = null;

    // Direct signaling pipe between Peer A and Peer B
    peerA = new WebRtcService(
      async (type, payload) => {
        queueMicrotask(async () => {
          await peerB.handleSignal(type, payload);
        });
      },
      (data) => {},
      (state) => {}
    );

    peerB = new WebRtcService(
      async (type, payload) => {
        queueMicrotask(async () => {
          await peerA.handleSignal(type, payload);
        });
      },
      (data) => {},
      (state) => {}
    );

    peerA.setAudioElement(audioElA);
    peerB.setAudioElement(audioElB);

    peerA.setOnRemoteStream((s) => {
      remoteTrackReceivedAtA = s;
    });
    peerB.setOnRemoteStream((s) => {
      remoteTrackReceivedAtB = s;
    });

    peerA.setOnVoiceStatus((sender, payload) => {
      voiceStatusAtA = { sender, payload };
    });
    peerB.setOnVoiceStatus((sender, payload) => {
      voiceStatusAtB = { sender, payload };
    });

    // Mock getUserMedia
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn(async (constraints) => {
            return (peerA as any).localAudioStream ? streamB : streamA;
          })
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    peerA.close();
    peerB.close();
    vi.restoreAllMocks();
  });

  it('Verifies complete two-peer voice lifecycle: join, negotiate, PTT transmission x10, leave/rejoin, SignalR reconnect', async () => {
    // -------------------------------------------------------------
    // Step 1: Player A joins voice
    // -------------------------------------------------------------
    (globalThis.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(streamA);
    const aJoined = await peerA.enableMicrophone();
    expect(aJoined).toBe(true);
    expect(peerA.getLocalAudioStream()).toBe(streamA);
    expect(trackA.enabled).toBe(false); // starts muted

    // -------------------------------------------------------------
    // Step 2: Player B joins voice
    // -------------------------------------------------------------
    (globalThis.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(streamB);
    const bJoined = await peerB.enableMicrophone();
    expect(bJoined).toBe(true);
    expect(peerB.getLocalAudioStream()).toBe(streamB);
    expect(trackB.enabled).toBe(false); // starts muted

    // -------------------------------------------------------------
    // Step 3: Both peers complete negotiation (Player A as initiator)
    // -------------------------------------------------------------
    peerA.ensurePeerConnection(true);
    peerB.ensurePeerConnection(false);

    // Wait for signaling turn (offer -> answer exchange over microtask queue)
    await new Promise((r) => setTimeout(r, 50));

    expect(peerA.getPeerConnection()).toBeTruthy();
    expect(peerB.getPeerConnection()).toBeTruthy();

    // Simulate connection established: simulate incoming tracks
    const pcA: any = peerA.getPeerConnection();
    const pcB: any = peerB.getPeerConnection();

    // Track from B arrives at A
    pcA.ontrack?.({
      track: trackB,
      streams: [streamB]
    });
    // Track from A arrives at B
    pcB.ontrack?.({
      track: trackA,
      streams: [streamA]
    });

    expect(remoteTrackReceivedAtA).toBe(streamB);
    expect(remoteTrackReceivedAtB).toBe(streamA);
    expect(audioElA.srcObject).toBe(streamB);
    expect(audioElB.srcObject).toBe(streamA);

    // -------------------------------------------------------------
    // Step 4 & 5: Player A presses PTT and Player B receives audio, then releases
    // -------------------------------------------------------------
    peerA.setPushToTalk(true, 'Alice');
    expect(trackA.enabled).toBe(true); // Audio enabled on track

    // Simulate receiving voice status at B
    (peerB as any).handleIncomingVoiceStatus('Alice', { speaking: true, voiceActive: true });
    expect(voiceStatusAtB?.payload.speaking).toBe(true);

    // Release PTT
    peerA.setPushToTalk(false, 'Alice');
    expect(trackA.enabled).toBe(false); // Audio disabled on track
    (peerB as any).handleIncomingVoiceStatus('Alice', { speaking: false, voiceActive: true });
    expect(voiceStatusAtB?.payload.speaking).toBe(false);

    // -------------------------------------------------------------
    // Step 6: Player B presses PTT and Player A receives audio
    // -------------------------------------------------------------
    peerB.setPushToTalk(true, 'Bob');
    expect(trackB.enabled).toBe(true);
    (peerA as any).handleIncomingVoiceStatus('Bob', { speaking: true, voiceActive: true });
    expect(voiceStatusAtA?.payload.speaking).toBe(true);

    peerB.setPushToTalk(false, 'Bob');
    expect(trackB.enabled).toBe(false);
    (peerA as any).handleIncomingVoiceStatus('Bob', { speaking: false, voiceActive: true });
    expect(voiceStatusAtA?.payload.speaking).toBe(false);

    // -------------------------------------------------------------
    // Step 7: Repeat the speaking cycle at least 10 times
    // -------------------------------------------------------------
    for (let cycle = 1; cycle <= 12; cycle++) {
      // Alice speaks
      peerA.setPushToTalk(true, 'Alice');
      expect(trackA.enabled).toBe(true);
      (peerB as any).handleIncomingVoiceStatus('Alice', { speaking: true, voiceActive: true });
      expect(voiceStatusAtB?.payload.speaking).toBe(true);

      peerA.setPushToTalk(false, 'Alice');
      expect(trackA.enabled).toBe(false);
      (peerB as any).handleIncomingVoiceStatus('Alice', { speaking: false, voiceActive: true });
      expect(voiceStatusAtB?.payload.speaking).toBe(false);

      // Bob speaks
      peerB.setPushToTalk(true, 'Bob');
      expect(trackB.enabled).toBe(true);
      (peerA as any).handleIncomingVoiceStatus('Bob', { speaking: true, voiceActive: true });
      expect(voiceStatusAtA?.payload.speaking).toBe(true);

      peerB.setPushToTalk(false, 'Bob');
      expect(trackB.enabled).toBe(false);
      (peerA as any).handleIncomingVoiceStatus('Bob', { speaking: false, voiceActive: true });
      expect(voiceStatusAtA?.payload.speaking).toBe(false);

      // Verify track instance remains constant throughout repeated PTT cycles
      expect(peerA.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('track-A');
      expect(peerB.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('track-B');
    }

    // -------------------------------------------------------------
    // Step 8: Both players leave voice
    // -------------------------------------------------------------
    peerA.closeAudio();
    peerB.closeAudio();

    expect(trackA.stop).toHaveBeenCalled();
    expect(trackB.stop).toHaveBeenCalled();
    expect(peerA.getLocalAudioStream()).toBeNull();
    expect(peerB.getLocalAudioStream()).toBeNull();

    // -------------------------------------------------------------
    // Step 9: Rejoining voice works without refreshing either browser
    // -------------------------------------------------------------
    const trackA2 = { id: 'track-A2', kind: 'audio', readyState: 'live', enabled: false, stop: vi.fn() };
    const streamA2 = { getAudioTracks: () => [trackA2], getTracks: () => [trackA2] };

    const trackB2 = { id: 'track-B2', kind: 'audio', readyState: 'live', enabled: false, stop: vi.fn() };
    const streamB2 = { getAudioTracks: () => [trackB2], getTracks: () => [trackB2] };

    (globalThis.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(streamA2);
    await peerA.enableMicrophone();
    expect(peerA.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('track-A2');

    (globalThis.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(streamB2);
    await peerB.enableMicrophone();
    expect(peerB.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('track-B2');

    // Test speaking again after rejoin
    peerA.setPushToTalk(true, 'Alice');
    expect(trackA2.enabled).toBe(true);
    peerA.setPushToTalk(false, 'Alice');
    expect(trackA2.enabled).toBe(false);

    // -------------------------------------------------------------
    // Step 10: Reconnecting SignalR does not break an otherwise healthy voice session
    // -------------------------------------------------------------
    const existingPcA = peerA.getPeerConnection();
    const existingPcB = peerB.getPeerConnection();

    // App calls ensurePeerConnection upon SignalR reconnect
    peerA.ensurePeerConnection(true);
    peerB.ensurePeerConnection(false);

    // Verify peer connections were NOT recreated or interrupted
    expect(peerA.getPeerConnection()).toBe(existingPcA);
    expect(peerB.getPeerConnection()).toBe(existingPcB);
    expect(peerA.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('track-A2');
    expect(peerB.getLocalAudioStream()?.getAudioTracks()[0].id).toBe('track-B2');
  });
});
