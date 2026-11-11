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

export class WebRtcService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private connectionTimeoutTimer: any = null;

  // Voice Chat / Audio Properties
  private localAudioStream: MediaStream | null = null;
  private remoteAudioStream: MediaStream | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private audioSender: RTCRtpSender | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private onRemoteStreamCallback?: (stream: MediaStream | null) => void;
  private onVoiceStatusCallback?: (sender: string, payload: VoiceStatusPayload) => void;

  private onSignalNeeded: (signalType: string, payload: string) => void;
  private onDataMessage: (data: string) => void;
  private onConnectionStateChange: (state: RTCIceConnectionState) => void;

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

  setOnRemoteStream(cb: (stream: MediaStream | null) => void): void {
    this.onRemoteStreamCallback = cb;
  }

  setOnVoiceStatus(cb: (sender: string, payload: VoiceStatusPayload) => void): void {
    this.onVoiceStatusCallback = cb;
  }

  getQueuedCandidatesCount(): number {
    return this.pendingCandidates.length;
  }

  initializePeerConnection(config?: RtcConfig): void {
    if (this.peerConnection) {
      this.close();
    }

    let iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ];

    try {
      const envServers = (import.meta as any).env?.VITE_ICE_SERVERS;
      if (envServers) {
        iceServers = JSON.parse(envServers);
      }
    } catch {}

    const iceConfig: RTCConfiguration = config || { iceServers };

    if (typeof RTCPeerConnection !== 'undefined') {
      this.peerConnection = new RTCPeerConnection(iceConfig);

      // Pre-add audio transceiver so SDP offer/answer negotiates audio upfront
      if (typeof this.peerConnection.addTransceiver === 'function') {
        try {
          this.audioTransceiver = this.peerConnection.addTransceiver('audio', {
            direction: 'sendrecv'
          });
          this.audioSender = this.audioTransceiver.sender;
        } catch (err) {
          console.warn('[WebRTC] Audio transceiver setup warning:', err);
        }
      }

      // If local audio stream was already obtained before peer connection was created
      if (this.localAudioStream) {
        const audioTrack = this.localAudioStream.getAudioTracks()[0];
        if (audioTrack) {
          if (this.audioSender && typeof this.audioSender.replaceTrack === 'function') {
            this.audioSender.replaceTrack(audioTrack).catch(err => {
              console.warn('[WebRTC] replaceTrack warning:', err);
            });
          } else if (typeof this.peerConnection.addTrack === 'function') {
            this.audioSender = this.peerConnection.addTrack(audioTrack, this.localAudioStream);
          }
        }
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.onSignalNeeded('candidate', JSON.stringify(event.candidate));
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection) {
          const state = this.peerConnection.iceConnectionState;
          if (state === 'connected' || state === 'completed') {
            this.clearConnectionTimeout();
          }
          this.onConnectionStateChange(state);
        }
      };

      this.peerConnection.ondatachannel = (event) => {
        this.setDataChannel(event.channel);
      };

      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteAudioStream = event.streams[0];
          this.attachRemoteAudio(this.remoteAudioStream);
          this.onRemoteStreamCallback?.(this.remoteAudioStream);
        }
      };
    }

    // 12-second negotiation timeout: if connection not established, notify fallback
    this.startConnectionTimeout();
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimeoutTimer = setTimeout(() => {
      if (this.peerConnection && this.peerConnection.iceConnectionState !== 'connected' && this.peerConnection.iceConnectionState !== 'completed') {
        console.warn('[WebRTC] Connection negotiation timed out. Falling back to SignalR.');
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

    // Create DataChannel from initiating side
    const channel = this.peerConnection.createDataChannel('chess-uno-p2p', {
      ordered: true
    });
    this.setDataChannel(channel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.onSignalNeeded('offer', JSON.stringify(offer));
  }

  async handleSignal(signalType: string, payload: string): Promise<void> {
    if (!this.peerConnection) return;

    if (signalType === 'offer') {
      const offer = JSON.parse(payload);
      const desc = typeof RTCSessionDescription !== 'undefined' ? new RTCSessionDescription(offer) : offer;
      await this.peerConnection.setRemoteDescription(desc);
      await this.drainPendingCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.onSignalNeeded('answer', JSON.stringify(answer));
    } else if (signalType === 'answer') {
      const answer = JSON.parse(payload);
      const desc = typeof RTCSessionDescription !== 'undefined' ? new RTCSessionDescription(answer) : answer;
      await this.peerConnection.setRemoteDescription(desc);
      await this.drainPendingCandidates();
    } else if (signalType === 'candidate') {
      const candidate = JSON.parse(payload);
      if (!this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
        // Queue candidates until remote description is set
        this.pendingCandidates.push(candidate);
      } else {
        await this.addCandidateSafe(candidate);
      }
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.peerConnection || this.pendingCandidates.length === 0) return;
    const toDrain = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const c of toDrain) {
      await this.addCandidateSafe(c);
    }
  }

  private async addCandidateSafe(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const cand = typeof RTCIceCandidate !== 'undefined' ? new RTCIceCandidate(candidate) : candidate;
      await this.peerConnection?.addIceCandidate(cand);
    } catch (err) {
      console.warn('[WebRTC] Safe candidate addition handled warning:', err);
    }
  }

  private setDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    this.dataChannel.onopen = () => {
      this.clearConnectionTimeout();
      console.log('[WebRTC] DataChannel open and ready');
    };
    this.dataChannel.onerror = (err) => {
      console.warn('[WebRTC] DataChannel error:', err);
    };
    this.dataChannel.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
    };
    this.dataChannel.onmessage = (event) => {
      try {
        const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (parsed && parsed.type === 'voice-status' && parsed.payload) {
          this.onVoiceStatusCallback?.(parsed.sender, parsed.payload);
        }
      } catch {}
      this.onDataMessage(event.data);
    };
  }

  sendData(message: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false; // Fallback to SignalR needed
  }

  sendTypedMessage<T = any>(type: P2PMessageType, sender: string, payload?: T): boolean {
    const msg: P2PMessage<T> = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
  // Audio & Push-to-Talk Implementation
  // ==========================================

  async enableMicrophone(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported by your browser.');
    }

    try {
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
        // Start muted by default — Push-to-Talk enables it while pressed
        audioTrack.enabled = false;

        if (this.audioSender && typeof this.audioSender.replaceTrack === 'function') {
          await this.audioSender.replaceTrack(audioTrack);
        } else if (this.peerConnection && typeof this.peerConnection.addTrack === 'function') {
          this.audioSender = this.peerConnection.addTrack(audioTrack, stream);
        }
      }
      return true;
    } catch (err: any) {
      console.error('[WebRTC Audio] getUserMedia error:', err);
      throw err;
    }
  }

  setPushToTalk(speaking: boolean, sender: string): boolean {
    if (this.localAudioStream) {
      const tracks = this.localAudioStream.getAudioTracks();
      for (const track of tracks) {
        track.enabled = speaking;
      }
    }

    return this.sendTypedMessage<VoiceStatusPayload>('voice-status', sender, {
      speaking,
      voiceActive: !!this.localAudioStream
    });
  }

  private attachRemoteAudio(stream: MediaStream): void {
    if (typeof Audio !== 'undefined') {
      if (!this.remoteAudioElement) {
        this.remoteAudioElement = new Audio();
        this.remoteAudioElement.autoplay = true;
        (this.remoteAudioElement as any).playsInline = true;
      }
      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.play().catch(err => {
        console.warn('[WebRTC Audio] Remote audio playback handled warning:', err);
      });
    }
  }

  muteOpponent(muted: boolean): void {
    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = muted;
    }
  }

  closeAudio(): void {
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(track => track.stop());
      this.localAudioStream = null;
    }
    if (this.audioSender && typeof this.audioSender.replaceTrack === 'function') {
      try {
        this.audioSender.replaceTrack(null).catch(() => {});
      } catch {}
      this.audioSender = null;
    }
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause();
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement = null;
    }
    this.remoteAudioStream = null;
  }

  close(): void {
    this.clearConnectionTimeout();
    this.closeAudio();
    this.pendingCandidates = [];
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
    this.audioTransceiver = null;
  }
}
