import { AutoplayRecoveryManager } from './autoplayRecovery';

export class AudioTrackManager {
  private localAudioStream: MediaStream | null = null;
  private remoteAudioStream: MediaStream | null = null;
  private audioTransceiver: RTCRtpTransceiver | null = null;
  private audioSender: RTCRtpSender | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private isOpponentAudioMuted: boolean = false;

  private onRemoteStreamCallback?: (stream: MediaStream | null) => void;
  private onLocalTrackEndedCallback?: () => void;
  private onResetOpponentVoiceStatus?: () => void;
  private peerConnectionGetter: () => RTCPeerConnection | null;

  public autoplayManager: AutoplayRecoveryManager;

  constructor(
    peerConnectionGetter: () => RTCPeerConnection | null,
    onResetOpponentVoiceStatus?: () => void
  ) {
    this.peerConnectionGetter = peerConnectionGetter;
    this.onResetOpponentVoiceStatus = onResetOpponentVoiceStatus;
    this.autoplayManager = new AutoplayRecoveryManager(() => this.remoteAudioElement);
  }

  setAudioElement(el: HTMLAudioElement | null): void {
    this.remoteAudioElement = el;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.autoplay = true;
      (this.remoteAudioElement as any).playsInline = true;
      this.remoteAudioElement.muted = this.isOpponentAudioMuted;
      if (this.remoteAudioStream) {
        this.remoteAudioElement.srcObject = this.remoteAudioStream;
        this.remoteAudioElement.volume = 1.0;
        this.autoplayManager.playAudio();
      }
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.remoteAudioElement;
  }

  setOnRemoteStream(cb?: (stream: MediaStream | null) => void): void {
    this.onRemoteStreamCallback = cb;
  }

  setOnLocalTrackEnded(cb?: () => void): void {
    this.onLocalTrackEndedCallback = cb;
  }

  getLocalAudioStream(): MediaStream | null {
    return this.localAudioStream;
  }

  getRemoteAudioStream(): MediaStream | null {
    return this.remoteAudioStream;
  }

  getAudioSender(): RTCRtpSender | null {
    return this.audioSender;
  }

  setAudioSender(sender: RTCRtpSender | null): void {
    this.audioSender = sender;
  }

  getAudioTransceiver(): RTCRtpTransceiver | null {
    return this.audioTransceiver;
  }

  setAudioTransceiver(tr: RTCRtpTransceiver | null): void {
    this.audioTransceiver = tr;
  }

  async attachLocalTrackToSender(track: MediaStreamTrack): Promise<void> {
    const pc = this.peerConnectionGetter();
    let sender = this.audioSender;
    if (pc && typeof pc.getTransceivers === 'function') {
      const audioTr = pc.getTransceivers().find(
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
        pc?.getSenders().find((s) => !s.track || s.track.kind === 'audio') ||
        null;
    }

    if (sender && typeof sender.replaceTrack === 'function') {
      await sender.replaceTrack(track);
      this.audioSender = sender;
      console.log('[WebRTC Audio Diagnostic] Replaced sender track without SDP renegotiation:', track.id);
    } else if (pc && typeof pc.addTrack === 'function') {
      this.audioSender = pc.addTrack(track, this.localAudioStream!);
      console.log('[WebRTC Audio Diagnostic] Added track to peerConnection:', track.id);
    }
  }

  async enableMicrophone(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported by your browser.');
    }

    // 1. Check if an active, live microphone track is already present
    if (this.localAudioStream) {
      const liveTracks = this.localAudioStream.getAudioTracks().filter((t) => t.readyState === 'live');
      if (liveTracks.length > 0) {
        console.log(`[WebRTC Audio Diagnostic] Reusing existing live microphone track: ${liveTracks[0].id}`);
        const track = liveTracks[0];
        track.enabled = false; // Always start muted until PTT is held
        await this.attachLocalTrackToSender(track);
        this.checkReceiversForRemoteTrack();
        this.autoplayManager.unlockAudio();
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

      this.checkReceiversForRemoteTrack();
      this.autoplayManager.unlockAudio();
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

  setPushToTalk(speaking: boolean): boolean {
    if (this.localAudioStream) {
      for (const track of this.localAudioStream.getAudioTracks()) {
        track.enabled = speaking;
      }
    }

    if (this.audioSender?.track) {
      this.audioSender.track.enabled = speaking;
    }

    return true;
  }

  attachRemoteAudio(stream: MediaStream): void {
    if (!this.remoteAudioElement && typeof document !== 'undefined') {
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

    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = this.isOpponentAudioMuted;
      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.volume = 1.0;
      this.autoplayManager.playAudio();
    }
  }

  checkReceiversForRemoteTrack(): void {
    const pc = this.peerConnectionGetter();
    if (!pc || this.remoteAudioStream || typeof pc.getReceivers !== 'function') return;

    const audioReceiver = pc.getReceivers().find(
      (r) => r.track && r.track.kind === 'audio' && r.track.readyState === 'live'
    );
    if (audioReceiver && audioReceiver.track) {
      console.log('[WebRTC Diagnostic] Found remote receiver track via getReceivers()');
      const stream = new MediaStream([audioReceiver.track]);
      this.remoteAudioStream = stream;
      this.onRemoteStreamCallback?.(stream);
      this.attachRemoteAudio(stream);
    }
  }

  muteOpponent(muted: boolean): void {
    this.isOpponentAudioMuted = muted;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.muted = muted;
    }
    console.log(`[WebRTC Audio Diagnostic] Opponent audio muted: ${muted}`);
  }

  closeAudio(): void {
    console.log('[WebRTC Audio Diagnostic] Closing audio: stopping local tracks and detaching sender');
    this.autoplayManager.reset();

    const streamToStop = this.localAudioStream;
    this.localAudioStream = null;

    // Detach from WebRTC sender first, then stop local hardware tracks
    if (this.audioSender && typeof this.audioSender.replaceTrack === 'function') {
      try {
        void this.audioSender.replaceTrack(null);
      } catch {
        // ignore
      }
      this.audioSender = null;
    }

    if (streamToStop) {
      streamToStop.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
    }

    if (this.remoteAudioElement) {
      if (typeof this.remoteAudioElement.pause === 'function') {
        this.remoteAudioElement.pause();
      }
      this.remoteAudioElement.srcObject = null;
    }
    this.remoteAudioStream = null;
    this.onResetOpponentVoiceStatus?.();
  }
}
