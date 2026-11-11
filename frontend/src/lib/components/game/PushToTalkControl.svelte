<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';
  import { voiceStore } from '../../stores/voiceStore';

  export let opponentName: string = 'Opponent';
  export let disabled: boolean = false;

  const dispatch = createEventDispatcher<{
    enableVoice: void;
    leaveVoice: void;
    pushToTalkStart: void;
    pushToTalkEnd: void;
    toggleMuteOpponent: void;
  }>();

  let state = $voiceStore;
  $: state = $voiceStore;

  let isHolding = false;

  function handleStart(e?: Event) {
    if (disabled || !$voiceStore.isVoiceEnabled || !$voiceStore.isMicActive || isHolding) return;
    if (e && e.cancelable) {
      e.preventDefault();
    }
    isHolding = true;
    voiceStore.setPushToTalkActive(true);
    dispatch('pushToTalkStart');
  }

  function handleEnd(e?: Event) {
    if (!isHolding) return;
    if (e && e.cancelable) {
      e.preventDefault();
    }
    isHolding = false;
    voiceStore.setPushToTalkActive(false);
    dispatch('pushToTalkEnd');
  }

  function handlePointerDown(e: PointerEvent) {
    if (disabled || !$voiceStore.isVoiceEnabled || !$voiceStore.isMicActive || isHolding) return;
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}
    handleStart(e);
  }

  function handlePointerUp(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {}
    handleEnd(e);
  }

  function handlePointerCancel(e: PointerEvent) {
    try {
      (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {}
    handleEnd(e);
  }

  function handleLostPointerCapture(e: Event) {
    handleEnd(e);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled || !$voiceStore.isVoiceEnabled || !$voiceStore.isMicActive) return;
    if (e.repeat) return;

    const target = e.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target?.isContentEditable ||
      target?.getAttribute?.('role') === 'textbox'
    ) {
      return;
    }

    if (e.code === 'KeyV' || e.code === 'Space' || e.key === 'v' || e.key === 'V' || e.key === ' ') {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
      }
      handleStart();
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'KeyV' || e.code === 'Space' || e.key === 'v' || e.key === 'V' || e.key === ' ') {
      handleEnd();
    }
  }

  function handleWindowBlur() {
    if (isHolding) {
      handleEnd();
    }
  }

  onDestroy(() => {
    if (isHolding) {
      handleEnd();
    }
  });
</script>

<svelte:window
  on:keydown={handleKeyDown}
  on:keyup={handleKeyUp}
  on:blur={handleWindowBlur}
/>

<div class="ptt-container" class:active-speaking={state.isPushToTalkActive} data-testid="push-to-talk-control">
  {#if !state.isSupported}
    <div class="ptt-unsupported" title="Microphone access is unavailable on this device or insecure context (HTTPS required outside localhost).">
      <span class="icon">🔇</span>
      <span>Voice Unavailable</span>
    </div>
  {:else if !state.isVoiceEnabled}
    <!-- Enable Voice Button -->
    <button
      class="btn btn-join-voice"
      on:click={() => dispatch('enableVoice')}
      {disabled}
      title="Join WebRTC Voice Chat (Push-to-Talk)"
      data-testid="btn-enable-voice"
    >
      <span class="mic-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </span>
      <span>Join Voice</span>
    </button>
  {:else}
    <!-- Voice Connected: PTT button + Opponent Voice Status + Leave button -->
    <div class="ptt-active-bar">
      <!-- Main Push-to-Talk Button -->
      <button
        type="button"
        class="btn btn-ptt"
        class:transmitting={state.isPushToTalkActive}
        on:pointerdown={handlePointerDown}
        on:pointerup={handlePointerUp}
        on:pointercancel={handlePointerCancel}
        on:lostpointercapture={handleLostPointerCapture}
        {disabled}
        title="Hold Space or V key, or press and hold this button to speak"
        data-testid="btn-push-to-talk"
      >
        <span class="ptt-icon-wrap" aria-hidden="true">
          {#if state.isPushToTalkActive}
            <span class="live-dot"></span>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          {/if}
        </span>
        <span class="ptt-text">
          {#if state.isPushToTalkActive}
            <strong>TRANSMITTING...</strong>
          {:else}
            <span>Push to Talk <kbd>V</kbd></span>
          {/if}
        </span>
      </button>

      <!-- Opponent Voice / Speaker Toggle -->
      <div class="opponent-voice-status" class:speaking={state.isOpponentSpeaking}>
        <button
          type="button"
          class="btn-speaker"
          class:muted={state.isOpponentMuted}
          on:click={() => dispatch('toggleMuteOpponent')}
          title={state.isOpponentMuted ? 'Unmute opponent' : 'Mute opponent audio'}
          data-testid="btn-mute-opponent"
        >
          {#if state.isOpponentMuted}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
            </svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          {/if}
        </button>

        {#if state.isOpponentSpeaking}
          <div class="speaking-indicator" title="{opponentName} is speaking">
            <span class="bar bar1"></span>
            <span class="bar bar2"></span>
            <span class="bar bar3"></span>
            <span class="speaking-label">{opponentName}</span>
          </div>
        {/if}
      </div>

      <!-- Leave Voice Button -->
      <button
        type="button"
        class="btn-leave-voice"
        on:click={() => dispatch('leaveVoice')}
        title="Disconnect from voice chat"
        data-testid="btn-leave-voice"
      >
        ✕
      </button>
    </div>
  {/if}

  {#if state.error}
    <div class="voice-error-toast" role="alert">
      <span>{state.error}</span>
    </div>
  {/if}
</div>

<style>
  .ptt-container {
    display: inline-flex;
    align-items: center;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  }

  .ptt-unsupported {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    color: var(--text-dim, #6b7280);
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
  }

  .btn-join-voice {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #e5e7eb;
    background: rgba(30, 41, 59, 0.75);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-join-voice:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.9);
    border-color: var(--accent-gold, #f59e0b);
    color: #ffffff;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
  }

  .btn-join-voice:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ptt-active-bar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(15, 23, 42, 0.85);
    padding: 2px 4px 2px 2px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
  }

  .btn-ptt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 0.74rem;
    font-weight: 700;
    color: #e2e8f0;
    background: rgba(30, 41, 59, 0.9);
    border: 1px solid rgba(100, 116, 139, 0.35);
    border-radius: 5px;
    cursor: pointer;
    touch-action: none;
    transition: all 0.15s ease-out;
  }

  .btn-ptt:hover:not(:disabled):not(.transmitting) {
    background: rgba(51, 65, 85, 1);
    border-color: rgba(148, 163, 184, 0.6);
  }

  .btn-ptt.transmitting {
    background: #059669;
    color: #ffffff;
    border-color: #34d399;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.55);
    animation: pttPulse 1.2s infinite ease-in-out;
  }

  @keyframes pttPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 16px rgba(16, 185, 129, 0.8); }
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #ffffff;
    animation: liveBlink 0.8s infinite alternate;
  }

  @keyframes liveBlink {
    0% { opacity: 0.4; }
    100% { opacity: 1; }
  }

  kbd {
    display: inline-block;
    padding: 1px 4px;
    font-size: 0.65rem;
    font-family: monospace;
    font-weight: 700;
    line-height: 1;
    color: #cbd5e1;
    background-color: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    margin-left: 2px;
  }

  .opponent-voice-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .btn-speaker {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #94a3b8;
    cursor: pointer;
    padding: 0;
    transition: all 0.2s ease;
  }

  .btn-speaker:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .btn-speaker.muted {
    color: #ef4444;
  }

  .speaking-indicator {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 5px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 4px;
  }

  .speaking-label {
    font-size: 0.65rem;
    font-weight: 700;
    color: #34d399;
    margin-left: 2px;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar {
    display: inline-block;
    width: 2px;
    background-color: #34d399;
    border-radius: 1px;
    animation: soundWave 0.8s infinite ease-in-out alternate;
  }

  .bar1 { height: 6px; animation-delay: 0.1s; }
  .bar2 { height: 10px; animation-delay: 0.3s; }
  .bar3 { height: 7px; animation-delay: 0.2s; }

  @keyframes soundWave {
    0% { height: 3px; }
    100% { height: 12px; }
  }

  .btn-leave-voice {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    transition: color 0.15s ease;
  }

  .btn-leave-voice:hover {
    color: #ef4444;
  }

  .voice-error-toast {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 6px;
    padding: 4px 8px;
    background-color: #991b1b;
    color: #fee2e2;
    font-size: 0.68rem;
    border-radius: 4px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    z-index: 10;
  }
</style>
