<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor } from '../../types/game';

  export let invitationUrl: string;
  export let invitationToken: string;
  export let assignedColor: PlayerColor = 'White';
  export let playerName: string = 'Host';
  export let connectionProgress: string = 'Connected to room. Waiting for Player 2...';

  const dispatch = createEventDispatcher<{
    cancel: void;
  }>();

  let copied = false;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2500);
    } catch {
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2500);
    }
  }
</script>

<div class="waiting-room-screen" data-testid="waiting-room">
  <div class="waiting-card panel">
    <div class="pulse-ring">
      <div class="spinner"></div>
    </div>

    <h2>Waiting for Opponent</h2>
    <p class="subtitle">Share this invitation link with Player 2 to start the match:</p>

    <div class="invite-container">
      <input
        readonly
        value={invitationUrl}
        aria-label="Invitation Link"
        spellcheck="false"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        data-testid="invite-url-input"
      />
      <button
        class="btn btn-gold"
        on:click={handleCopy}
        data-testid="btn-copy-invite"
      >
        {copied ? 'Copied' : 'Copy Link'}
      </button>
    </div>

    <div class="match-info">
      <div class="info-row">
        <span>Host</span>
        <strong>{playerName}</strong>
      </div>
      <div class="info-row">
        <span>Your Color</span>
        <strong class="color-tag white">{assignedColor} (First Turn)</strong>
      </div>
      <div class="info-row">
        <span>Opponent Color</span>
        <strong class="color-tag black">Black</strong>
      </div>
      <div class="info-row">
        <span>Session Token</span>
        <code class="token-code">{invitationToken}</code>
      </div>
    </div>

    <div class="progress-bar-container">
      <div class="connection-status">
        <span class="status-dot pulsing"></span>
        <span class="status-text">{connectionProgress}</span>
      </div>
      <p class="auto-hint">The board will launch automatically as soon as your opponent joins.</p>
    </div>

    <div class="cancel-area">
      <button class="btn btn-secondary btn-sm" on:click={() => dispatch('cancel')}>
        Cancel &amp; Return to Lobby
      </button>
    </div>
  </div>
</div>

<style>
  .waiting-room-screen {
    max-width: 560px;
    margin: 24px auto;
    width: 100%;
  }

  .waiting-card {
    text-align: center;
    padding: 28px 24px;
  }

  .pulse-ring {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(245, 158, 11, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  h2 {
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--text-main);
    margin-bottom: 6px;
  }

  .subtitle {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .invite-container {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .invite-container input {
    margin-bottom: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    background-color: var(--bg-primary);
    border-color: var(--border-strong);
  }

  .match-info {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
    margin-bottom: 20px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.84rem;
  }

  .info-row span {
    color: var(--text-muted);
  }

  .color-tag {
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: var(--font-mono);
  }

  .color-tag.white {
    background-color: rgba(243, 244, 246, 0.14);
    color: #ffffff;
  }

  .color-tag.black {
    background-color: rgba(156, 163, 175, 0.14);
    color: #d1d5db;
  }

  .token-code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--accent-blue);
  }

  .progress-bar-container {
    margin-bottom: 18px;
  }

  .connection-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 0.8rem;
    color: var(--accent-gold);
    font-weight: 600;
    margin-bottom: 6px;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: var(--accent-gold);
  }

  .pulsing {
    animation: dotPulse 1.2s infinite alternate;
  }

  .auto-hint {
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  .cancel-area {
    margin-top: 8px;
  }

  .btn-sm {
    padding: 7px 14px;
    font-size: 0.8rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes dotPulse {
    from { opacity: 0.4; }
    to { opacity: 1; }
  }
</style>
