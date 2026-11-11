import { DEFAULT_ICE_SERVERS, parseIceServers } from './webrtc/iceConfig';
import { AudioTrackManager } from './webrtc/audioTrackManager';
import {
  PROTOCOL_VERSION,
  type P2PMessage,
  type P2PMessageType,
  type QueuedCandidate,
  type RtcConfig,
  type VoiceStatusPayload
} from './webrtc/types';

export {
  DEFAULT_ICE_SERVERS,
  parseIceServers,
  PROTOCOL_VERSION,
  type P2PMessage,
  type P2PMessageType,
  type QueuedCandidate,
  type RtcConfig,
  type VoiceStatusPayload
};

export class WebRtcService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionEpoch: number = 0;
  private remoteEpoch?: number;
  private isMakingOffer: boolean = false;
  private isPolite: boolean = false;
  private pendingCandidates: QueuedCandidate[] = [];
  private connectionTimeoutTimer: any = null;

  // Voice Chat / Audio Subsystem Manager
  private audioManager: AudioTrackManager;
  private opponentSpeakingWatchdogTimer: any = null;

  private onVoiceStatusCallback?: (sender: string, payload: VoiceStatusPayload) => void;
  private onFallbackSignalNeeded?: (signalType: string, payload: string) => void;

  private onSignalNeeded: (signalType: string, payload: string) => void;
  private onDataMessage: (data: string) => void;
  private onConnectionStateChange: (state: RTCIceConnectionState) => void;

  static readonly DEFAULT_ICE_SERVERS = DEFAULT_ICE_SERVERS;

  static parseIceServers(rawConfig?: string): RTCIceServer[] {
    return parseIceServers(rawConfig);
  }

  constructor(
    onSignalNeeded: (signalType: string, payload: string) => void,
    onDataMessage: (data: string) => void,
    onConnectionStateChange: (state: RTCIceConnectionState) => void
  ) {
    this.onSignalNeeded = onSignalNeeded;
    this.onDataMessage = onDataMessage;
    this.onConnectionStateChange = onConnectionStateChange;

    this.audioManager = new AudioTrackManager(
      () => this.peerConnection,
      () => this.resetOpponentVoiceStatus()
    );
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
    return this.audioManager.getLocalAudioStream();
  }

  getRemoteAudioStream(): MediaStream | null {
    return this.audioManager.getRemoteAudioStream();
  }

  isAudioPlaybackPending(): boolean {
    return this.audioManager.autoplayManager.isPending();
  }

  isOpponentMuted(): boolean {
    return (this.audioManager as any).isOpponentAudioMuted;
  }

  getQueuedCandidatesCount(): number {
    return this.pendingCandidates.length;
  }

  getAudioSender(): RTCRtpSender | null {
    return this.audioManager.getAudioSender();
  }

  getAudioTransceiver(): RTCRtpTransceiver | null {
    return this.audioManager.getAudioTransceiver();
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioManager.getAudioElement();
  }

  setOnRemoteStream(cb: (stream: MediaStream | null) => void): void {
    this.audioManager.setOnRemoteStream(cb);
  }

  setOnAutoplayBlocked(cb: (blocked: boolean) => void): void {
    this.audioManager.autoplayManager.setOnAutoplayBlocked(cb);
  }

  setOnVoiceStatus(cb: (sender: string, payload: VoiceStatusPayload) => void): void {
    this.onVoiceStatusCallback = cb;
  }

  setOnLocalTrackEnded(cb: () => void): void {
    this.audioManager.setOnLocalTrackEnded(cb);
  }

  setOnFallbackSignalNeeded(cb: (signalType: string, payload: string) => void): void {
    this.onFallbackSignalNeeded = cb;
  }

  setAudioElement(el: HTMLAudioElement | null): void {
    this.audioManager.setAudioElement(el);
  }

  // Backwards compatibility property accessors for existing tests and internals
  get localAudioStream(): MediaStream | null {
    return this.audioManager.getLocalAudioStream();
  }
  set localAudioStream(stream: MediaStream | null) {
    (this.audioManager as any).localAudioStream = stream;
  }

  get remoteAudioStream(): MediaStream | null {
    return this.audioManager.getRemoteAudioStream();
  }
  set remoteAudioStream(stream: MediaStream | null) {
    (this.audioManager as any).remoteAudioStream = stream;
  }

  get audioSender(): RTCRtpSender | null {
    return this.audioManager.getAudioSender();
  }
  set audioSender(sender: RTCRtpSender | null) {
    this.audioManager.setAudioSender(sender);
  }

  get audioTransceiver(): RTCRtpTransceiver | null {
    return this.audioManager.getAudioTransceiver();
  }
  set audioTransceiver(tr: RTCRtpTransceiver | null) {
    this.audioManager.setAudioTransceiver(tr);
  }

  get remoteAudioElement(): HTMLAudioElement | null {
    return this.audioManager.getAudioElement();
  }
  set remoteAudioElement(el: HTMLAudioElement | null) {
    this.audioManager.setAudioElement(el);
  }

  get audioPlaybackPending(): boolean {
    return this.audioManager.autoplayManager.isPending();
  }
  set audioPlaybackPending(val: boolean) {
    (this.audioManager.autoplayManager as any).isPlaybackPending = val;
  }

  get isOpponentAudioMuted(): boolean {
    return (this.audioManager as any).isOpponentAudioMuted;
  }
  set isOpponentAudioMuted(val: boolean) {
    (this.audioManager as any).isOpponentAudioMuted = val;
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
      const localStream = this.audioManager.getLocalAudioStream();
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
          this.audioManager.attachLocalTrackToSender(audioTracks[0]).catch((err) => {
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
            this.audioManager.checkReceiversForRemoteTrack();
          } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            this.resetOpponentVoiceStatus();
          }
          this.onConnectionStateChange(state);
        }
      };

      this.peerConnection.ondatachannel = (event) => {
        console.log('[WebRTC Diagnostic] Received remote data channel:', event.channel.label);
        this.setDataChannel(event.channel);
      };

      this.peerConnection.ontrack = (event) => {
        console.log('[WebRTC Diagnostic] Remote track received:', event.track.kind, event.track.id);
        if (event.track.kind === 'audio') {
          console.log('[WebRTC Diagnostic] Attaching remote audio track:', {
            kind: event.track.kind,
            id: event.track.id,
            enabled: event.track.enabled,
            readyState: event.track.readyState
          });
          const stream =
            event.streams && event.streams[0]
              ? event.streams[0]
              : new MediaStream([event.track]);

          (this.audioManager as any).remoteAudioStream = stream;
          (this.audioManager as any).onRemoteStreamCallback?.(stream);
          this.audioManager.attachRemoteAudio(stream);

          event.track.onunmute = () => {
            console.log('[WebRTC Diagnostic] Remote track unmuted, initiating audio playback');
            this.audioManager.autoplayManager.playAudio();
          };

          event.track.onmute = () => {
            console.log('[WebRTC Diagnostic] Remote track muted');
          };

          event.track.onended = () => {
            console.warn('[WebRTC Diagnostic] Remote audio track ended.');
            (this.audioManager as any).remoteAudioStream = null;
            (this.audioManager as any).onRemoteStreamCallback?.(null);
            this.resetOpponentVoiceStatus();
          };
        }
      };
    }

    return this.peerConnection;
  }

  /**
   * Central orchestrator for ensuring a healthy WebRTC connection.
   */
  ensurePeerConnection(isInitiator: boolean = false): void {
    this.isPolite = !isInitiator;

    const pc = this.initializePeerConnection();
    if (!pc) return;

    if (isInitiator && (!this.dataChannel || this.dataChannel.readyState !== 'open')) {
      if (
        pc.signalingState === 'stable' &&
        !this.isMakingOffer &&
        pc.iceConnectionState !== 'connected' &&
        pc.iceConnectionState !== 'checking'
      ) {
        console.log('[WebRTC Diagnostic] Designated initiator starting negotiation offer');
        this.createOffer();
      }
    }
  }

  /**
   * Recreates connection cleanly upon unrecoverable ICE failure or room rejoin.
   */
  restartConnection(isInitiator: boolean = false): void {
    console.log(`[WebRTC Diagnostic] Controlled connection restart initiated (isInitiator: ${isInitiator})`);
    this.closePeerConnection();
    this.ensurePeerConnection(isInitiator);
  }

  /**
   * Deterministic offer creation with glare avoidance.
   */
  async createOffer(): Promise<void> {
    if (!this.peerConnection) {
      this.initializePeerConnection();
    }
    if (!this.peerConnection) return;

    if (this.isMakingOffer) {
      console.warn('[WebRTC Diagnostic] Skipping duplicate createOffer: offer already in progress.');
      return;
    }

    try {
      this.isMakingOffer = true;
      const currentEpoch = this.connectionEpoch;
      console.log(`[WebRTC Diagnostic] Creating offer (epoch: ${currentEpoch})`);

      // Ensure caller creates DataChannel
      if (!this.dataChannel || this.dataChannel.readyState === 'closed') {
        const channel = this.peerConnection.createDataChannel('chess-uno-p2p', {
          ordered: true
        });
        this.setDataChannel(channel);
      }

      // Add audio transceiver if not already present
      if (typeof this.peerConnection.addTransceiver === 'function') {
        const existingTransceivers = this.peerConnection.getTransceivers ? this.peerConnection.getTransceivers() : [];
        const hasAudio = existingTransceivers.some((t) => t.receiver.track && t.receiver.track.kind === 'audio');
        if (!hasAudio) {
          const audioTr = this.peerConnection.addTransceiver('audio', {
            direction: 'sendrecv'
          });
          this.audioManager.setAudioTransceiver(audioTr);
          this.audioManager.setAudioSender(audioTr.sender);
          console.log('[WebRTC Diagnostic] Offerer added audio transceiver direction: sendrecv');
        }
      }

      const offer = await this.peerConnection.createOffer();
      if (currentEpoch !== this.connectionEpoch) {
        console.warn('[WebRTC Diagnostic] Stale offer created during epoch change; discarding.');
        return;
      }

      await this.peerConnection.setLocalDescription(offer);

      this.startConnectionTimeout();

      this.onSignalNeeded(
        'offer',
        JSON.stringify({
          epoch: currentEpoch,
          offer: this.peerConnection.localDescription || offer
        })
      );
    } catch (err) {
      console.error('[WebRTC Diagnostic] Error during createOffer:', err);
    } finally {
      this.isMakingOffer = false;
    }
  }

  async handleOfferSignal(payloadStr: string): Promise<void> {
    return this.handleSignal('offer', payloadStr);
  }

  async handleAnswerSignal(payloadStr: string): Promise<void> {
    return this.handleSignal('answer', payloadStr);
  }

  async handleCandidateSignal(payloadStr: string): Promise<void> {
    return this.handleSignal('candidate', payloadStr);
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
      const offerData = parsed.sdp ? parsed : parsed.offer || parsed;
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
      this.audioManager.checkReceiversForRemoteTrack();

      // Ensure audio transceiver and sender are bound to the negotiated audio m-line
      if (typeof this.peerConnection.getTransceivers === 'function') {
        const transceivers = this.peerConnection.getTransceivers();
        const audioTr = transceivers.find((t) => t.receiver.track && t.receiver.track.kind === 'audio');
        if (audioTr) {
          this.audioManager.setAudioTransceiver(audioTr);
          this.audioManager.setAudioSender(audioTr.sender);
          if (audioTr.direction !== 'sendrecv') {
            try {
              audioTr.direction = 'sendrecv';
            } catch {}
          }
          console.log('[WebRTC Diagnostic] Associated negotiated audio transceiver (mid:', audioTr.mid, ')');
        }
      }

      // Attach existing live microphone track to answerer's audio sender if present
      const localStream = this.audioManager.getLocalAudioStream();
      if (localStream) {
        const liveTracks = localStream.getAudioTracks().filter((t) => t.readyState === 'live');
        if (liveTracks.length > 0) {
          await this.audioManager.attachLocalTrackToSender(liveTracks[0]);
        }
      }

      const answer = await this.peerConnection.createAnswer();
      if (currentEpoch !== this.connectionEpoch) return;

      await this.peerConnection.setLocalDescription(answer);

      this.onSignalNeeded(
        'answer',
        JSON.stringify({
          epoch: currentEpoch,
          inReplyToEpoch: this.remoteEpoch,
          answer: this.peerConnection.localDescription || answer
        })
      );

      await this.drainPendingCandidates();
    } else if (signalType === 'answer') {
      console.log(`[WebRTC Diagnostic] Received answer signal (epoch: ${currentEpoch})`);
      if (parsed.epoch !== undefined) {
        this.remoteEpoch = parsed.epoch;
      }
      const answerData = parsed.sdp ? parsed : parsed.answer || parsed;
      const desc =
        typeof RTCSessionDescription !== 'undefined'
          ? new RTCSessionDescription(answerData)
          : answerData;

      if (this.peerConnection.signalingState === 'have-local-offer') {
        await this.peerConnection.setRemoteDescription(desc);
        if (!this.peerConnection) return;
        this.audioManager.checkReceiversForRemoteTrack();
        await this.drainPendingCandidates();
      } else {
        console.warn(
          `[WebRTC Diagnostic] Ignoring answer in invalid signaling state: ${this.peerConnection.signalingState}`
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

      // Queue candidate if remote description not yet set
      if (!this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
        console.log(`[WebRTC Diagnostic] Queueing ICE candidate (epoch ${currentEpoch})`);
        this.pendingCandidates.push({
          epoch: currentEpoch,
          candidate: candidateData
        });
        return;
      }

      try {
        const iceCandidate =
          typeof RTCIceCandidate !== 'undefined'
            ? new RTCIceCandidate(candidateData)
            : candidateData;
        await this.peerConnection.addIceCandidate(iceCandidate);
      } catch (err) {
        console.warn('[WebRTC Diagnostic] Error adding ICE candidate:', err);
      }
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];

    console.log(`[WebRTC Diagnostic] Draining ${candidates.length} queued ICE candidates`);
    for (const item of candidates) {
      if (item.epoch !== this.connectionEpoch) {
        console.log(`[WebRTC Diagnostic] Discarding queued candidate from stale epoch ${item.epoch}`);
        continue;
      }
      try {
        const iceCandidate =
          typeof RTCIceCandidate !== 'undefined'
            ? new RTCIceCandidate(item.candidate)
            : item.candidate;
        await this.peerConnection.addIceCandidate(iceCandidate);
      } catch (err) {
        console.warn('[WebRTC Diagnostic] Error applying queued candidate:', err);
      }
    }
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
      }
    }, 15000);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  // ==========================================
  // Data Channel & P2P Messaging
  // ==========================================

  private setDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('[WebRTC Diagnostic] DataChannel open and ready');
    };

    channel.onclose = () => {
      console.log('[WebRTC Diagnostic] DataChannel closed');
    };

    channel.onerror = (err) => {
      console.warn('[WebRTC Diagnostic] DataChannel error:', err);
    };

    channel.onmessage = (event) => {
      try {
        const data = event.data;
        const msg = JSON.parse(data);
        if (WebRtcService.isValidMessage(msg)) {
          this.handleMessage(msg);
        }
      } catch {
        this.onDataMessage(event.data);
      }
    };
  }

  getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  private handleMessage(message: P2PMessage): void {
    if (message.type === 'voice-status') {
      const payload = message.payload as VoiceStatusPayload;
      const msgEpoch = (message as any).epoch;
      this.handleVoiceStatus(message.sender, payload, msgEpoch);
      return;
    }

    this.onDataMessage(JSON.stringify(message));
  }

  /**
   * Unified voice status handler.
   */
  handleVoiceStatus(sender: string, payload: VoiceStatusPayload, epoch?: number): void {
    console.log('[WebRTC Diagnostic] Received voice-status message:', { sender, payload, epoch });

    if (this.remoteEpoch !== undefined && epoch !== undefined && epoch < this.remoteEpoch) {
      console.warn(
        `[WebRTC Diagnostic] Discarded voice-status from stale epoch ${epoch} (remote epoch: ${this.remoteEpoch})`
      );
      return;
    }

    if (this.opponentSpeakingWatchdogTimer) {
      clearTimeout(this.opponentSpeakingWatchdogTimer);
      this.opponentSpeakingWatchdogTimer = null;
    }

    if (payload.speaking) {
      this.opponentSpeakingWatchdogTimer = setTimeout(() => {
        console.warn('[WebRTC Diagnostic] Opponent speaking watchdog timeout triggered, clearing speaking indicator.');
        if (this.onVoiceStatusCallback) {
          this.onVoiceStatusCallback(sender, { speaking: false, voiceActive: payload.voiceActive });
        }
      }, 15000);
    }

    if (this.onVoiceStatusCallback) {
      this.onVoiceStatusCallback(sender, payload);
    }
  }

  handleIncomingVoiceStatus(sender: string, payload: VoiceStatusPayload, epoch?: number): void {
    this.handleVoiceStatus(sender, payload, epoch);
  }

  private resetOpponentVoiceStatus(): void {
    if (this.opponentSpeakingWatchdogTimer) {
      clearTimeout(this.opponentSpeakingWatchdogTimer);
      this.opponentSpeakingWatchdogTimer = null;
    }
    if (this.onVoiceStatusCallback) {
      this.onVoiceStatusCallback('Opponent', { speaking: false, voiceActive: false });
    }
  }

  sendData(data: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(data);
        return true;
      } catch (err) {
        console.warn('[WebRTC Diagnostic] DataChannel send error:', err);
        return false;
      }
    }
    return false;
  }

  sendP2PMessage(message: P2PMessage): boolean {
    if (!WebRtcService.isValidMessage(message)) return false;
    return this.sendData(JSON.stringify(message));
  }

  sendTypedMessage<T = any>(type: P2PMessageType, sender: string, payload?: T): boolean {
    const message: P2PMessage<T> = {
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
    return this.sendP2PMessage(message);
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
  // Microphone Stream & Track Lifecycle (Delegated)
  // ==========================================

  async attachLocalTrackToSender(track: MediaStreamTrack): Promise<void> {
    return this.audioManager.attachLocalTrackToSender(track);
  }

  async enableMicrophone(): Promise<boolean> {
    return this.audioManager.enableMicrophone();
  }

  // ==========================================
  // Push-to-Talk Transmission
  // ==========================================

  setPushToTalk(speaking: boolean, sender: string): boolean {
    this.audioManager.setPushToTalk(speaking);

    const payload: VoiceStatusPayload = {
      speaking,
      voiceActive: !!this.audioManager.getLocalAudioStream()
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

    const messageStr = JSON.stringify(msg);
    const sent = this.sendData(messageStr);

    if (!sent && this.onFallbackSignalNeeded) {
      try {
        this.onFallbackSignalNeeded('voice-status', messageStr);
      } catch {}
    }

    return true;
  }

  // ==========================================
  // Remote Audio Playback & Muting (Delegated)
  // ==========================================

  private handleUserGesture(): void {
    this.audioManager.autoplayManager.handleUserGesture();
  }

  private attachRemoteAudio(stream: MediaStream): void {
    this.audioManager.attachRemoteAudio(stream);
  }

  private checkReceiversForRemoteTrack(): void {
    this.audioManager.checkReceiversForRemoteTrack();
  }

  playRemoteAudio(): void {
    this.audioManager.autoplayManager.playAudio();
  }

  unlockAudio(): void {
    this.audioManager.autoplayManager.unlockAudio();
  }

  muteOpponent(muted: boolean): void {
    this.audioManager.muteOpponent(muted);
  }

  // ==========================================
  // Cleanup & Teardown
  // ==========================================

  closeAudio(): void {
    this.audioManager.closeAudio();
  }

  closePeerConnection(): void {
    console.log(`[WebRTC Diagnostic] Closing peer connection (epoch ${this.connectionEpoch})`);
    this.clearConnectionTimeout();
    this.pendingCandidates = [];
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.audioManager.setAudioTransceiver(null);
    this.audioManager.setAudioSender(null);
    this.isMakingOffer = false;
  }

  close(preserveAudio: boolean = false): void {
    this.audioManager.autoplayManager.removeUserInteractionListeners();
    this.closePeerConnection();
    if (!preserveAudio) {
      this.closeAudio();
    }
  }
}
