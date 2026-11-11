export interface RtcConfig {
  iceServers: RTCIceServer[];
}

export const PROTOCOL_VERSION = '1.0';

export type P2PMessageType = 'ping' | 'pong' | 'cursor' | 'chat' | 'voice-status';

export interface VoiceStatusPayload {
  speaking: boolean;
  voiceActive: boolean;
}

export interface P2PMessage<T = any> {
  id: string;
  version: string;
  type: P2PMessageType;
  sender: string;
  payload?: T;
  timestamp: number;
}

interface QueuedCandidate {
  epoch: number;
  candidate: RTCIceCandidateInit;
}

export class WebRtcService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionEpoch: number = 0;
  private remoteEpoch?: number;
  private isMakingOffer: boolean = false;
  private isPolite: boolean = false;
  private pendingCandidates: QueuedCandidate[] = [];
  private connectionTimeoutTimer: any = null;

  // Voice Chat / Audio Properties
  private localAudioStream: MediaStream | null = null;
  private remoteAudioStream: MediaStream | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private audioSender: RTCRtpSender | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private audioPlaybackPending: boolean = false;
  private isOpponentAudioMuted: boolean = false;
  private opponentSpeakingWatchdogTimer: any = null;
  private onAutoplayBlockedCallback?: (blocked: boolean) => void;
  private interactionListenersAttached: boolean = false;
  private boundInteractionHandler = () => this.handleUserGesture();

  private onRemoteStreamCallback?: (stream: MediaStream | null) => void;
  private onVoiceStatusCallback?: (sender: string, payload: VoiceStatusPayload) => void;
  private onLocalTrackEndedCallback?: () => void;
  private onFallbackSignalNeeded?: (signalType: string, payload: string) => void;

  private onSignalNeeded: (signalType: string, payload: string) => void;
  private onDataMessage: (data: string) => void;
  private onConnectionStateChange: (state: RTCIceConnectionState) => void;

  static readonly DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];

  static parseIceServers(rawConfig?: string): RTCIceServer[] {
    if (!rawConfig || typeof rawConfig !== 'string' || !rawConfig.trim()) {
      return [...WebRtcService.DEFAULT_ICE_SERVERS];
    }

    try {
      const parsed = JSON.parse(rawConfig);
      if (!Array.isArray(parsed)) {
        console.warn(
          '[WebRTC Diagnostic] VITE_ICE_SERVERS must be a JSON array of RTCIceServer objects. Falling back to default STUN servers.'
        );
        return [...WebRtcService.DEFAULT_ICE_SERVERS];
      }

      for (const server of parsed) {
        if (!server || typeof server !== 'object' || (!server.urls && !server.url)) {
          console.warn(
            '[WebRTC Diagnostic] Invalid RTCIceServer in VITE_ICE_SERVERS: missing "urls". Falling back to default STUN servers.'
          );
          return [...WebRtcService.DEFAULT_ICE_SERVERS];
        }
      }

      return parsed;
    } catch (err) {
      console.warn('[WebRTC Diagnostic] Failed to parse VITE_ICE_SERVERS:', err);
      return [...WebRtcService.DEFAULT_ICE_SERVERS];
    }
  }

  constructor(
    onSignalNeeded: (signalType: string, payload: string) => void,
    onDataMessage: (data: string) => void,
    onConnectionStateChange: (state: RTCIceConnectionState) => void
  ) {
    this.onSignalNeeded = onSignalNeeded;
    this.onDataMessage = onDataMessage;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  static isValidMessage(obj: any): obj is P2PMessage {
    return (
      obj != null &&
      typeof obj.id === 'string' &&
      obj.version === PROTOCOL_VERSION &&
      typeof obj.type === 'string' &&
      typeof obj.sender === 'string'
    );
  }

  // Diagnostics and State Inspection
  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getConnectionEpoch(): number {
    return this.connectionEpoch;
  }

  getLocalAudioStream(): MediaStream | null {
    return this.localAudioStream;
  }

  getRemoteAudioStream(): MediaStream | null {
    return this.remoteAudioStream;
  }

  isAudioPlaybackPending(): boolean {
    return this.audioPlaybackPending;
  }

  isOpponentMuted(): boolean {
    return this.isOpponentAudioMuted;
  }

  getQueuedCandidatesCount(): number {
    return this.pendingCandidates.length;
  }

  setOnRemoteStream(cb: (stream: MediaStream | null) => void): void {
    this.onRemoteStreamCallback = cb;
  }

  setOnAutoplayBlocked(cb: (blocked: boolean) => void): void {
    this.onAutoplayBlockedCallback = cb;
  }

  setOnVoiceStatus(cb: (sender: string, payload: VoiceStatusPayload) => void): void {
    this.onVoiceStatusCallback = cb;
  }

  setOnLocalTrackEnded(cb: () => void): void {
    this.onLocalTrackEndedCallback = cb;
  }

  setOnFallbackSignalNeeded(cb: (signalType: string, payload: string) => void): void {
    this.onFallbackSignalNeeded = cb;
  }

  setAudioElement(el: HTMLAudioElement | null): void {
    this.remoteAudioElement = el;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.autoplay = true;
      (this.remoteAudioElement as any).playsInline = true;
      this.remoteAudioElement.muted = this.isOpponentAudioMuted;
      if (this.remoteAudioStream) {
        this.remoteAudioElement.srcObject = this.remoteAudioStream;
        this.playRemoteAudio();
      }
    }
  }

  // ==========================================
  // Connection Lifecycle & Negotiation Flow
  // ==========================================

  /**
   * Idempotent peer connection initialization.
   * If an active or connecting peer connection already exists, it is reused.
   */
  initializePeerConnection(config?: RtcConfig): RTCPeerConnection | null {
    if (
      this.peerConnection &&
      this.peerConnection.signalingState !== 'closed' &&
      this.peerConnection.connectionState !== 'closed' &&
      this.peerConnection.iceConnectionState !== 'failed' &&
      this.peerConnection.iceConnectionState !== 'disconnected'
    ) {
      console.log(
        `[WebRTC Diagnostic] initializePeerConnection called but connection is already active (epoch: ${this.connectionEpoch}, signalingState: ${this.peerConnection.signalingState}, iceState: ${this.peerConnection.iceConnectionState}). Reusing existing connection.`
      );
      return this.peerConnection;
    }

    if (this.peerConnection) {
      this.closePeerConnection();
    }

    this.connectionEpoch++;
    console.log(`[WebRTC Diagnostic] Initializing new RTCPeerConnection (epoch: ${this.connectionEpoch})`);

    const defaultIceServers = WebRtcService.parseIceServers((import.meta as any).env?.VITE_ICE_SERVERS);
    const iceConfig: RTCConfiguration = config || { iceServers: defaultIceServers };

    if (typeof RTCPeerConnection !== 'undefined') {
      this.peerConnection = new RTCPeerConnection(iceConfig);

      // If a live local audio track already exists, attach it to the new connection's sender
      if (this.localAudioStream) {
        const audioTracks = this.localAudioStream.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
          this.attachLocalTrackToSender(audioTracks[0]).catch(err => {
            console.warn('[WebRTC Diagnostic] Failed to re-attach existing local track:', err);
          });
        }
      }

      const currentEpoch = this.connectionEpoch;

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`[WebRTC Diagnostic] ICE candidate generated (epoch ${currentEpoch})`);
          this.onSignalNeeded(
            'candidate',
            JSON.stringify({
              epoch: currentEpoch,
              inReplyToEpoch: this.remoteEpoch,
              candidate: event.candidate
            })
          );
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection) {
          const state = this.peerConnection.iceConnectionState;
          console.log(`[WebRTC Diagnostic] ICE connection state changed to: ${state} (epoch ${currentEpoch})`);
          if (state === 'connected' || state === 'completed') {
            this.clearConnectionTimeout();
            this.checkReceiversForRemoteTrack();
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            this.resetOpponentVoiceStatus();
          }
          this.onConnectionStateChange(state);
        }
      };

      this.peerConnection.ondatachannel = (event) => {
        console.log(`[WebRTC Diagnostic] Received remote data channel: ${event.channel.label}`);
        this.setDataChannel(event.channel);
      };

      this.peerConnection.ontrack = (event) => {
        this.attachRemoteTrack(event.track, event.streams);
      };
    }

    this.startConnectionTimeout();
    return this.peerConnection;
  }

  private attachRemoteTrack(track: MediaStreamTrack, streams?: readonly MediaStream[]): void {
    if (track.kind !== 'audio') return;
    if (
      this.remoteAudioStream &&
      this.remoteAudioStream.getAudioTracks().some((t) => t.id === track.id)
    ) {
      return;
    }

    console.log('[WebRTC Diagnostic] Attaching remote audio track:', {
      kind: track.kind,
      id: track.id,
      enabled: track.enabled,
      readyState: track.readyState
    });

    const stream =
      streams && streams.length > 0 && streams[0]
        ? streams[0]
        : typeof MediaStream !== 'undefined'
        ? new MediaStream([track])
        : null;

    if (stream) {
      this.remoteAudioStream = stream;
      this.attachRemoteAudio(stream);
      this.onRemoteStreamCallback?.(stream);
    }

    track.onunmute = () => {
      console.log('[WebRTC Diagnostic] Remote track unmuted, initiating audio playback');
      this.playRemoteAudio();
    };

    track.onmute = () => {
      console.log('[WebRTC Diagnostic] Remote track muted');
      this.resetOpponentVoiceStatus();
    };

    track.onended = () => {
      console.log('[WebRTC Diagnostic] Remote track ended');
      this.remoteAudioStream = null;
      this.resetOpponentVoiceStatus();
      this.onRemoteStreamCallback?.(null);
    };
  }

  private checkReceiversForRemoteTrack(): void {
    if (!this.peerConnection || this.remoteAudioStream) return;
    try {
      if (typeof this.peerConnection.getReceivers === 'function') {
        const receivers = this.peerConnection.getReceivers();
        const audioReceiver = receivers.find((r) => r.track && r.track.kind === 'audio');
        if (audioReceiver && audioReceiver.track) {
          console.log('[WebRTC Diagnostic] Found remote receiver track via getReceivers()');
          this.attachRemoteTrack(audioReceiver.track);
        }
      }
    } catch {}
  }

  /**
   * Centralized idempotent session check.
   * If isInitiator is true and connection is stable without offer in flight, creates offer.
   */
  ensurePeerConnection(isInitiator: boolean = false, config?: RtcConfig): RTCPeerConnection | null {
    this.isPolite = !isInitiator;
    const pc = this.initializePeerConnection(config);

    if (isInitiator && pc && pc.signalingState === 'stable' && !this.isMakingOffer) {
      console.log('[WebRTC Diagnostic] Designated initiator starting negotiation offer');
      this.createOffer().catch(err => {
        console.warn('[WebRTC Diagnostic] createOffer error in ensurePeerConnection:', err);
      });
    }

    return pc;
  }

  /**
   * Controlled connection restart for recovering from failure or reconnecting.
   * Preserves local audio track and sender configuration while refreshing the peer connection.
   */
  async restartConnection(isInitiator: boolean = false, config?: RtcConfig): Promise<void> {
    console.log(`[WebRTC Diagnostic] Controlled connection restart initiated (isInitiator: ${isInitiator})`);
    this.closePeerConnection();
    this.pendingCandidates = [];
    this.ensurePeerConnection(isInitiator, config);
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimeoutTimer = setTimeout(() => {
      if (
        this.peerConnection &&
        this.peerConnection.iceConnectionState !== 'connected' &&
        this.peerConnection.iceConnectionState !== 'completed'
      ) {
        console.warn('[WebRTC Diagnostic] Connection negotiation timed out. Falling back.');
        this.onConnectionStateChange('failed');
      }
    }, 12000);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  async createOffer(): Promise<void> {
    if (!this.peerConnection) return;

    if (this.isMakingOffer) {
      console.warn('[WebRTC Diagnostic] Skipping duplicate createOffer: offer already in progress.');
      return;
    }

    if (this.peerConnection.signalingState !== 'stable') {
      console.warn(
        `[WebRTC Diagnostic] Skipping createOffer: signalingState is ${this.peerConnection.signalingState} (expected stable).`
      );
      return;
    }

    this.isMakingOffer = true;
    console.log(`[WebRTC Diagnostic] Creating offer (epoch: ${this.connectionEpoch})`);

    try {
      // Ensure audio transceiver direction 'sendrecv' exists for offerer
      if (!this.audioTransceiver && typeof this.peerConnection.addTransceiver === 'function') {
        try {
          this.audioTransceiver = this.peerConnection.addTransceiver('audio', {
            direction: 'sendrecv'
          });
          this.audioSender = this.audioTransceiver.sender;
          console.log('[WebRTC Diagnostic] Offerer added audio transceiver direction: sendrecv');
        } catch (err) {
          console.warn('[WebRTC Diagnostic] Audio transceiver setup warning:', err);
        }
      }

      // Ensure local DataChannel exists for initiator
      if (!this.dataChannel || this.dataChannel.readyState === 'closed') {
        const channel = this.peerConnection.createDataChannel('chess-uno-p2p', {
          ordered: true
        });
        this.setDataChannel(channel);
      }

      const offer = await this.peerConnection.createOffer();
      if (!this.peerConnection) return;
      if (this.peerConnection.signalingState !== 'stable') {
        console.warn('[WebRTC Diagnostic] Signaling state changed during createOffer; aborting local description.');
        return;
      }

      await this.peerConnection.setLocalDescription(offer);
      this.onSignalNeeded(
        'offer',
        JSON.stringify({
          epoch: this.connectionEpoch,
          type: offer.type,
          sdp: offer.sdp
        })
      );
    } catch (err) {
      console.error('[WebRTC Diagnostic] createOffer failed:', err);
      throw err;
    } finally {
      this.isMakingOffer = false;
    }
  }

  async handleSignal(signalType: string, payload: string): Promise<void> {
    if (!this.peerConnection) {
      this.initializePeerConnection();
    }
    if (!this.peerConnection) return;

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch (err) {
      console.error('[WebRTC Diagnostic] Failed to parse signaling payload:', err);
      return;
    }

    // Validate epoch matching to discard stale messages from older connection generations
    if (
      signalType === 'answer' &&
      parsed.inReplyToEpoch !== undefined &&
      parsed.inReplyToEpoch < this.connectionEpoch
    ) {
      console.warn(
        `[WebRTC Diagnostic] Discarding answer replying to stale offer epoch ${parsed.inReplyToEpoch} (current: ${this.connectionEpoch})`
      );
      return;
    }

    if (signalType === 'candidate') {
      if (parsed.inReplyToEpoch !== undefined && parsed.inReplyToEpoch < this.connectionEpoch) {
        console.warn(`[WebRTC Diagnostic] Discarding candidate for stale epoch ${parsed.inReplyToEpoch}`);
        return;
      }
      if (
        parsed.inReplyToEpoch === undefined &&
        parsed.epoch !== undefined &&
        parsed.epoch < this.connectionEpoch
      ) {
        console.warn(
          `[WebRTC Diagnostic] Discarding stale candidate from epoch ${parsed.epoch} (current: ${this.connectionEpoch})`
        );
        return;
      }
    }

    const currentEpoch = this.connectionEpoch;

    if (signalType === 'offer') {
      console.log(`[WebRTC Diagnostic] Received offer signal (epoch: ${currentEpoch})`);
      if (parsed.epoch !== undefined) {
        this.remoteEpoch = parsed.epoch;
      }
      const offerData = parsed.sdp ? parsed : (parsed.offer || parsed);
      const desc =
        typeof RTCSessionDescription !== 'undefined'
          ? new RTCSessionDescription(offerData)
          : offerData;

      // Handle offer collision / glare
      const isCollision =
        this.isMakingOffer || this.peerConnection.signalingState !== 'stable';

      if (isCollision) {
        if (!this.isPolite) {
          console.warn('[WebRTC Diagnostic] Impolite peer detected offer collision, ignoring incoming offer.');
          return;
        }
        console.log('[WebRTC Diagnostic] Polite peer detected offer collision, rolling back local description.');
        if (typeof this.peerConnection.setLocalDescription === 'function') {
          try {
            await this.peerConnection.setLocalDescription({ type: 'rollback' } as any);
          } catch {}
        }
      }

      await this.peerConnection.setRemoteDescription(desc);
      if (!this.peerConnection) return;

      // Ensure audio transceiver and sender are bound to the negotiated audio m-line
      if (typeof this.peerConnection.getTransceivers === 'function') {
        const transceivers = this.peerConnection.getTransceivers();
        const audioTr = transceivers.find((t) => t.receiver.track && t.receiver.track.kind === 'audio');
        if (audioTr) {
          this.audioTransceiver = audioTr;
          this.audioSender = audioTr.sender;
          try {
            audioTr.direction = 'sendrecv';
          } catch {}
          console.log('[WebRTC Diagnostic] Associated negotiated audio transceiver (mid:', audioTr.mid, ')');
        }
      }

      this.checkReceiversForRemoteTrack();
      await this.drainPendingCandidates();
      if (!this.peerConnection) return;

      const answer = await this.peerConnection.createAnswer();
      if (!this.peerConnection) return;
      await this.peerConnection.setLocalDescription(answer);

      this.onSignalNeeded(
        'answer',
        JSON.stringify({
          epoch: currentEpoch,
          inReplyToEpoch: parsed.epoch,
          type: answer.type,
          sdp: answer.sdp
        })
      );
    } else if (signalType === 'answer') {
      console.log(`[WebRTC Diagnostic] Received answer signal (epoch: ${currentEpoch})`);
      if (parsed.epoch !== undefined) {
        this.remoteEpoch = parsed.epoch;
      }
      const answerData = parsed.sdp ? parsed : (parsed.answer || parsed);
      const desc =
        typeof RTCSessionDescription !== 'undefined'
          ? new RTCSessionDescription(answerData)
          : answerData;

      if (this.peerConnection.signalingState === 'have-local-offer') {
        await this.peerConnection.setRemoteDescription(desc);
        if (!this.peerConnection) return;
        this.checkReceiversForRemoteTrack();
        await this.drainPendingCandidates();
      } else {
        console.warn(
          `[WebRTC Diagnostic] Received answer but signalingState is ${this.peerConnection.signalingState}, ignoring.`
        );
      }
    } else if (signalType === 'candidate') {
      const candidateData =
        parsed.candidate && typeof parsed.candidate === 'object'
          ? parsed.candidate
          : parsed;

      if (
        !candidateData ||
        (typeof candidateData.candidate !== 'string' && typeof candidateData !== 'string')
      ) {
        return;
      }

      if (
        !this.peerConnection.remoteDescription ||
        !this.peerConnection.remoteDescription.type
      ) {
        // Queue candidates until remote description is set
        console.log(`[WebRTC Diagnostic] Queueing ICE candidate (epoch ${currentEpoch})`);
        this.pendingCandidates.push({
          epoch: currentEpoch,
          candidate: candidateData
        });
      } else {
        await this.addCandidateSafe(candidateData);
      }
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.peerConnection || this.pendingCandidates.length === 0) return;
    const toDrain = [...this.pendingCandidates];
    this.pendingCandidates = [];

    console.log(`[WebRTC Diagnostic] Draining ${toDrain.length} queued ICE candidates`);
    for (const item of toDrain) {
      if (item.epoch === this.connectionEpoch) {
        await this.addCandidateSafe(item.candidate);
      } else {
        console.log(`[WebRTC Diagnostic] Discarded candidate from stale epoch ${item.epoch}`);
      }
    }
  }

  private async addCandidateSafe(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const cand =
        typeof RTCIceCandidate !== 'undefined' ? new RTCIceCandidate(candidate) : candidate;
      await this.peerConnection?.addIceCandidate(cand);
    } catch (err) {
      console.warn('[WebRTC Diagnostic] Safe candidate addition handled warning:', err);
    }
  }

  // ==========================================
  // Data Channel & Voice Status
  // ==========================================

  private setDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => {
      this.clearConnectionTimeout();
      console.log('[WebRTC Diagnostic] DataChannel open and ready');
    };
    this.dataChannel.onerror = (err) => {
      console.warn('[WebRTC Diagnostic] DataChannel error:', err);
    };
    this.dataChannel.onclose = () => {
      console.log('[WebRTC Diagnostic] DataChannel closed');
      this.resetOpponentVoiceStatus();
    };
    this.dataChannel.onmessage = (event) => {
      try {
        const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (parsed && parsed.type === 'voice-status' && parsed.payload) {
          this.handleVoiceStatus(parsed.sender, parsed.payload, parsed.epoch);
        }
      } catch {}
      this.onDataMessage(event.data);
    };
  }

  handleVoiceStatus(sender: string, payload: VoiceStatusPayload, epoch?: number): void {
    if (epoch !== undefined && this.remoteEpoch !== undefined && epoch < this.remoteEpoch) {
      console.log(
        `[WebRTC Diagnostic] Discarded voice-status from stale epoch ${epoch} (remote epoch: ${this.remoteEpoch})`
      );
      return;
    }
    if (epoch !== undefined && (this.remoteEpoch === undefined || epoch > this.remoteEpoch)) {
      this.remoteEpoch = epoch;
    }

    console.log('[WebRTC Diagnostic] Received voice-status message:', { sender, payload, epoch });
    this.onVoiceStatusCallback?.(sender, payload);

    if (this.opponentSpeakingWatchdogTimer) {
      clearTimeout(this.opponentSpeakingWatchdogTimer);
      this.opponentSpeakingWatchdogTimer = null;
    }

    if (payload.speaking) {
      // NOTE: Do NOT call this.playRemoteAudio() from network message! Autoplay policies require genuine user gestures.
      // Watchdog: If speaking=false is lost or sender disconnects, clear after 15 seconds
      this.opponentSpeakingWatchdogTimer = setTimeout(() => {
        console.warn('[WebRTC Diagnostic] Opponent speaking watchdog timeout triggered, clearing speaking indicator.');
        this.onVoiceStatusCallback?.(sender, {
          speaking: false,
          voiceActive: payload.voiceActive
        });
      }, 15000);
    }
  }

  handleIncomingVoiceStatus(sender: string, payload: VoiceStatusPayload, epoch?: number): void {
    this.handleVoiceStatus(sender, payload, epoch);
  }

  resetOpponentVoiceStatus(): void {
    if (this.opponentSpeakingWatchdogTimer) {
      clearTimeout(this.opponentSpeakingWatchdogTimer);
      this.opponentSpeakingWatchdogTimer = null;
    }
    this.onVoiceStatusCallback?.('Opponent', {
      speaking: false,
      voiceActive: false
    });
  }

  sendData(message: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false;
  }

  sendTypedMessage<T = any>(type: P2PMessageType, sender: string, payload?: T): boolean {
    const msg: P2PMessage<T> = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      version: PROTOCOL_VERSION,
      type,
      sender,
      payload,
      timestamp: Date.now()
    };
    return this.sendData(JSON.stringify(msg));
  }

  sendPing(sender: string): boolean {
    return this.sendTypedMessage('ping', sender);
  }

  sendCursor(sender: string, x: number, y: number): boolean {
    return this.sendTypedMessage('cursor', sender, { x, y });
  }

  sendChat(sender: string, text: string): boolean {
    return this.sendTypedMessage('chat', sender, { text });
  }

  // ==========================================
  // Microphone Stream & Track Lifecycle
  // ==========================================

  private async attachLocalTrackToSender(track: MediaStreamTrack): Promise<void> {
    let sender = this.audioSender;
    if (this.peerConnection && typeof this.peerConnection.getTransceivers === 'function') {
      const audioTr = this.peerConnection.getTransceivers().find(
        (t) => t.receiver.track && t.receiver.track.kind === 'audio'
      );
      if (audioTr) {
        this.audioTransceiver = audioTr;
        sender = audioTr.sender;
        this.audioSender = sender;
      }
    }

    if (!sender) {
      sender =
        this.audioTransceiver?.sender ||
        this.peerConnection?.getSenders().find((s) => !s.track || s.track.kind === 'audio') ||
        null;
    }

    if (sender && typeof sender.replaceTrack === 'function') {
      await sender.replaceTrack(track);
      this.audioSender = sender;
      console.log('[WebRTC Audio Diagnostic] Replaced sender track without SDP renegotiation:', track.id);
    } else if (this.peerConnection && typeof this.peerConnection.addTrack === 'function') {
      this.audioSender = this.peerConnection.addTrack(track, this.localAudioStream!);
      console.log('[WebRTC Audio Diagnostic] Added track to peerConnection:', track.id);
    }
  }

  /**
   * Enables microphone access.
   * Reuses an existing live stream if already available; requests a new stream only when needed.
   */
  async enableMicrophone(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported by your browser.');
    }

    // 1. Check if an active, live microphone track is already present
    if (this.localAudioStream) {
      const liveTracks = this.localAudioStream.getAudioTracks().filter(t => t.readyState === 'live');
      if (liveTracks.length > 0) {
        console.log(`[WebRTC Audio Diagnostic] Reusing existing live microphone track: ${liveTracks[0].id}`);
        const track = liveTracks[0];
        track.enabled = false; // Always start muted until PTT is held
        await this.attachLocalTrackToSender(track);
        this.unlockAudio();
        return true;
      }
    }

    // 2. Request new audio stream
    try {
      console.log('[WebRTC Audio Diagnostic] Requesting getUserMedia audio stream');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.localAudioStream = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false; // Muted by default

        audioTrack.onended = () => {
          console.warn('[WebRTC Audio Diagnostic] Local microphone track ended unexpectedly.');
          this.onLocalTrackEndedCallback?.();
        };

        audioTrack.onmute = () => {
          console.log('[WebRTC Audio Diagnostic] Local microphone track muted at hardware/OS level.');
        };

        audioTrack.onunmute = () => {
          console.log('[WebRTC Audio Diagnostic] Local microphone track unmuted at hardware/OS level.');
        };

        await this.attachLocalTrackToSender(audioTrack);
      }

      this.unlockAudio();
      return true;
    } catch (err: any) {
      console.error('[WebRTC Audio Diagnostic] getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device found.');
      }
      throw err;
    }
  }

  // ==========================================
  // Push-to-Talk Transmission
  // ==========================================

  /**
   * Sets push-to-talk transmission state.
   * Audio track transmission is independent of DataChannel availability.
   */
  setPushToTalk(speaking: boolean, sender: string): boolean {
    if (this.localAudioStream) {
      for (const track of this.localAudioStream.getAudioTracks()) {
        track.enabled = speaking;
      }
    }

    if (this.audioSender?.track) {
      this.audioSender.track.enabled = speaking;
    }

    const payload: VoiceStatusPayload = {
      speaking,
      voiceActive: !!this.localAudioStream
    };

    const currentEpoch = this.connectionEpoch;
    const msg: P2PMessage<VoiceStatusPayload> & { epoch?: number } = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      version: PROTOCOL_VERSION,
      type: 'voice-status',
      sender,
      payload,
      timestamp: Date.now(),
      epoch: currentEpoch
    };

    // Attempt sending over DataChannel
    const messageStr = JSON.stringify(msg);
    const sent = this.sendData(messageStr);

    // Fallback to SignalR if DataChannel is unavailable
    if (!sent && this.onFallbackSignalNeeded) {
      try {
        this.onFallbackSignalNeeded('voice-status', messageStr);
      } catch {}
    }

    return true;
  }

  // ==========================================
  // Remote Audio Playback & Muting
  // ==========================================

  private attachUserInteractionListeners(): void {
    if (typeof window !== 'undefined' && !this.interactionListenersAttached) {
      this.interactionListenersAttached = true;
      window.addEventListener('pointerdown', this.boundInteractionHandler, { capture: true });
      window.addEventListener('keydown', this.boundInteractionHandler, { capture: true });
    }
  }

  private removeUserInteractionListeners(): void {
    if (typeof window !== 'undefined' && this.interactionListenersAttached) {
      this.interactionListenersAttached = false;
      window.removeEventListener('pointerdown', this.boundInteractionHandler, { capture: true });
      window.removeEventListener('keydown', this.boundInteractionHandler, { capture: true });
    }
  }

  private handleUserGesture(): void {
    this.unlockAudio();
  }

  private attachRemoteAudio(stream: MediaStream): void {
    if (typeof document !== 'undefined') {
      if (!this.remoteAudioElement) {
        let el = document.getElementById('chessuno-remote-audio') as HTMLAudioElement | null;
        if (!el) {
          el = document.createElement('audio');
          el.id = 'chessuno-remote-audio';
          el.autoplay = true;
          (el as any).playsInline = true;
          el.style.display = 'none';
          document.body.appendChild(el);
        }
        this.remoteAudioElement = el;
      }

      this.remoteAudioElement.muted = this.isOpponentAudioMuted;
      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.volume = 1.0;
      this.playRemoteAudio();
    }
  }

  playRemoteAudio(): void {
    if (this.remoteAudioElement && this.remoteAudioElement.srcObject) {
      const playPromise = this.remoteAudioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.audioPlaybackPending = false;
            this.onAutoplayBlockedCallback?.(false);
            this.removeUserInteractionListeners();
          })
          .catch((err) => {
            if (err.name === 'NotAllowedError') {
              this.audioPlaybackPending = true;
              this.onAutoplayBlockedCallback?.(true);
              this.attachUserInteractionListeners();
              console.warn(
                '[WebRTC Audio Diagnostic] Remote audio playback blocked by autoplay policy. Waiting for user interaction.'
              );
            } else {
              console.warn('[WebRTC Audio Diagnostic] Remote audio playback error:', err.message);
            }
          });
      }
    }
  }

  unlockAudio(): void {
    if (this.remoteAudioElement && this.remoteAudioElement.srcObject) {
      const playPromise = this.remoteAudioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.audioPlaybackPending = false;
            this.onAutoplayBlockedCallback?.(false);
            this.removeUserInteractionListeners();
          })
          .catch((err) => {
            if (err.name === 'NotAllowedError') {
              this.audioPlaybackPending = true;
              this.onAutoplayBlockedCallback?.(true);
              this.attachUserInteractionListeners();
            } else {
              console.warn('[WebRTC Audio Diagnostic] unlockAudio play error:', err.message);
            }
          });
      }
    }
  }

  muteOpponent(muted: boolean): void {
    this.isOpponentAudioMuted = muted;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = muted;
    }
    console.log(`[WebRTC Audio Diagnostic] Opponent audio muted: ${muted}`);
  }

  // ==========================================
  // Cleanup & Teardown
  // ==========================================

  closeAudio(): void {
    console.log('[WebRTC Audio Diagnostic] Closing audio: stopping local tracks and detaching sender');
    this.removeUserInteractionListeners();
    this.audioPlaybackPending = false;
    this.onAutoplayBlockedCallback?.(false);

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((track) => track.stop());
      this.localAudioStream = null;
    }
    if (this.audioSender && typeof this.audioSender.replaceTrack === 'function') {
      try {
        this.audioSender.replaceTrack(null).catch(() => {});
      } catch {}
      this.audioSender = null;
    }
    if (this.remoteAudioElement) {
      if (typeof this.remoteAudioElement.pause === 'function') {
        this.remoteAudioElement.pause();
      }
      this.remoteAudioElement.srcObject = null;
    }
    this.remoteAudioStream = null;
    this.resetOpponentVoiceStatus();
  }

  closePeerConnection(): void {
    console.log(`[WebRTC Diagnostic] Closing peer connection (epoch ${this.connectionEpoch})`);
    this.clearConnectionTimeout();
    this.pendingCandidates = [];
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.audioTransceiver = null;
    this.audioSender = null;
    this.isMakingOffer = false;
  }

  close(preserveAudio: boolean = false): void {
    this.removeUserInteractionListeners();
    this.closePeerConnection();
    if (!preserveAudio) {
      this.closeAudio();
    }
  }
}
