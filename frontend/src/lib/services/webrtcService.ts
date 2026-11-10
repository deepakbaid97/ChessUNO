export interface RtcConfig {
  iceServers: RTCIceServer[];
}

export class WebRtcService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
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

  initializePeerConnection(config?: RtcConfig): void {
    const iceConfig: RTCConfiguration = config || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(iceConfig);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignalNeeded('candidate', JSON.stringify(event.candidate));
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        this.onConnectionStateChange(this.peerConnection.iceConnectionState);
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.setDataChannel(event.channel);
    };
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
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.onSignalNeeded('answer', JSON.stringify(answer));
    } else if (signalType === 'answer') {
      const answer = JSON.parse(payload);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } else if (signalType === 'candidate') {
      const candidate = JSON.parse(payload);
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private setDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    this.dataChannel.onmessage = (event) => {
      this.onDataMessage(event.data);
    };
  }

  sendData(message: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false; // Fallback to server needed
  }

  close(): void {
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
  }
}

