export class AutoplayRecoveryManager {
  private isPlaybackPending: boolean = false;
  private interactionListenersAttached: boolean = false;
  private onAutoplayBlockedCallback?: (blocked: boolean) => void;
  private boundInteractionHandler = () => this.handleUserGesture();
  private audioElementGetter: () => HTMLAudioElement | null;

  constructor(audioElementGetter: () => HTMLAudioElement | null) {
    this.audioElementGetter = audioElementGetter;
  }

  setOnAutoplayBlocked(cb?: (blocked: boolean) => void): void {
    this.onAutoplayBlockedCallback = cb;
  }

  isPending(): boolean {
    return this.isPlaybackPending;
  }

  playAudio(): void {
    const el = this.audioElementGetter();
    if (!el || !el.srcObject) return;

    try {
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isPlaybackPending = false;
            this.onAutoplayBlockedCallback?.(false);
            this.removeUserInteractionListeners();
          })
          .catch((err) => {
            if (err.name === 'NotAllowedError') {
              this.isPlaybackPending = true;
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
    } catch (err: any) {
      console.warn('[WebRTC Audio Diagnostic] Synchronous play error:', err.message);
    }
  }

  handleUserGesture(): void {
    if (this.isPlaybackPending) {
      this.playAudio();
    }
  }

  unlockAudio(): void {
    this.playAudio();
  }

  attachUserInteractionListeners(): void {
    if (typeof window !== 'undefined' && !this.interactionListenersAttached) {
      this.interactionListenersAttached = true;
      window.addEventListener('pointerdown', this.boundInteractionHandler, { capture: true });
      window.addEventListener('keydown', this.boundInteractionHandler, { capture: true });
    }
  }

  removeUserInteractionListeners(): void {
    if (typeof window !== 'undefined' && this.interactionListenersAttached) {
      this.interactionListenersAttached = false;
      window.removeEventListener('pointerdown', this.boundInteractionHandler, { capture: true });
      window.removeEventListener('keydown', this.boundInteractionHandler, { capture: true });
    }
  }

  reset(): void {
    this.removeUserInteractionListeners();
    this.isPlaybackPending = false;
    this.onAutoplayBlockedCallback?.(false);
  }
}

