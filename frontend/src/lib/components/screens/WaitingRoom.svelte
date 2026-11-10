<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor } from '../../types/game';

  export let invitationUrl: string;
  export let invitationToken: string;
  export let assignedColor: PlayerColor = 'White';
  export let playerName: string = 'Host';
  export let connectionProgress: string = 'Connected to room. Waiting for player 2...';

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
      // Fallback
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

    <h2>Waiting for Opponent to Join</h2>
    <p class="subtitle">Share this unique invitation link with Player 2 to begin the match:</p>

    <div class="invite-container">
      <input
        readonly
        value={invitationUrl}
        aria-label="Invitation Link"
        data-testid="invite-url-input"
      />
      <button
        class="btn btn-gold"
        on:click={handleCopy}
        data-testid="btn-copy-invite"
      >
        {copied ? '✓ Copied!' : 'Copy Link'}
      </button>
    </div>

    <div class="match-info">
      <div class="info-row">
        <span>Host:</span>
        <strong>{playerName}</strong>
      </div>
      <div class="info-row">
        <span>Your Assigned Color:</span>
        <strong class="color-tag white">{assignedColor} (Initiative)</strong>
      </div>
      <div class="info-row">
        <span>Opponent Color:</span>
        <strong class="color-tag black">Black</strong>
      </div>
      <div class="info-row">
        <span>Token:</span>
        <code class="token-code">{invitationToken}</code>
      </div>
    </div>

    <div class="progress-bar-container">
      <div class="connection-status">
        <span class="status-dot pulsing"></span>
        <span class="status-text">{connectionProgress}</span>
      </div>
      <p class="auto-hint">The board will load automatically the moment Player 2 opens the link.</p>
    </div>

    <div class="cancel-area">
      <button class="btn btn-secondary btn-sm" on:click={() => dispatch('cancel')}>
        Cancel & Return to Lobby
      </button>
    </div>
  </div>
</div>

<style>
  .waiting-room-screen {
    max-width: 620px;
    margin: 40px auto;
    width: 100%;
  }

  .waiting-card {
    text-align: center;
    padding: 36px 32px;
  }

  .pulse-ring {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(251, 191, 36, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  h2 {
    font-size: 1.6rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 8px;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    margin-bottom: 24px;
    line-height: 1.4;
  }

  .invite-container {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  .invite-container input {
    margin-bottom: 0;
    font-family: var(--font-mono);
    font-size: 0.88rem;
    background: #0f172a;
    border-color: var(--border-color);
  }

  .match-info {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: left;
    margin-bottom: 24px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
  }

  .info-row span {
    color: var(--text-muted);
  }

  .color-tag {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .color-tag.white {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .color-tag.black {
    background: rgba(168, 85, 247, 0.15);
    color: var(--accent-purple);
  }

  .token-code {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--accent-blue);
  }

  .progress-bar-container {
    margin-bottom: 20px;
  }

  .connection-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 0.85rem;
    color: var(--accent-gold);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--accent-gold);
  }

  .pulsing {
    animation: dotPulse 1.2s infinite alternate;
  }

  .auto-hint {
    font-size: 0.82rem;
    color: var(--text-dim);
  }

  .cancel-area {
    margin-top: 10px;
  }

  .btn-sm {
    padding: 8px 16px;
    font-size: 0.85rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes dotPulse {
    from { opacity: 0.4; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.2); }
  }
</style>

