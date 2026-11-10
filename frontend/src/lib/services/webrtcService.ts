export interface RtcConfig {
  iceServers: RTCIceServer[];
}

export const PROTOCOL_VERSION = '1.0';

export type P2PMessageType = 'ping' | 'pong' | 'cursor' | 'chat';

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

  getQueuedCandidatesCount(): number {
    return this.pendingCandidates.length;
  }

  initializePeerConnection(config?: RtcConfig): void {
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

    this.peerConnection = new RTCPeerConnection(iceConfig);

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

  close(): void {
    this.clearConnectionTimeout();
    this.pendingCandidates = [];
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
  }
}
