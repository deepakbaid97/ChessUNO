<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { GameApiService } from '../../services/gameApiService';
  import type { InvitationInfo } from '../../types/game';

  export let invitationToken: string;
  export let apiService: GameApiService = new GameApiService();

  const dispatch = createEventDispatcher<{
    join: { invitationToken: string; playerName: string };
    cancel: void;
  }>();

  let playerName = 'Challenger';
  let isLoading = true;
  let isValid = false;
  let errorMsg = '';
  let invitationInfo: InvitationInfo | null = null;
  let isSubmitting = false;

  async function validate() {
    if (!invitationToken) {
      errorMsg = 'No invitation token was provided.';
      isLoading = false;
      return;
    }

    try {
      invitationInfo = await apiService.getInvitationInfo(invitationToken);
      if (invitationInfo.status !== 'WaitingForPlayer') {
        errorMsg = 'This game session is already full or has concluded.';
        isValid = false;
      } else {
        isValid = true;
      }
    } catch (err: any) {
      errorMsg = err.message || 'Invitation token is invalid or expired.';
      isValid = false;
    } finally {
      isLoading = false;
    }
  }

  $: if (invitationToken) {
    validate();
  }

  function handleJoin() {
    if (playerName.trim() && isValid) {
      isSubmitting = true;
      dispatch('join', {
        invitationToken,
        playerName: playerName.trim()
      });
    }
  }
</script>

<div class="join-screen" data-testid="join-screen">
  <div class="join-card panel">
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Validating invitation with server...</p>
      </div>
    {:else if !isValid}
      <div class="error-state">
        <h3>Unable to Join Game</h3>
        <p class="error-text">{errorMsg}</p>
        <button class="btn btn-secondary" on:click={() => dispatch('cancel')}>Return to Lobby</button>
      </div>
    {:else}
      <div class="valid-state">
        <span class="invite-tag">Match Invitation</span>
        <h2>Join Match</h2>
        <p class="subtitle">You have been invited to challenge <strong>{invitationInfo?.creatorName}</strong>. Enter your name below to join as Black.</p>

        <div class="details-box">
          <div class="detail-row">
            <span>Host</span>
            <strong>{invitationInfo?.creatorName} (White)</strong>
          </div>
          <div class="detail-row">
            <span>Your Assigned Color</span>
            <strong class="color-tag black">Black</strong>
          </div>
          <div class="detail-row">
            <span>Match Status</span>
            <span class="status-badge">Ready to Start</span>
          </div>
        </div>

        <div class="form-group">
          <label for="player-name">Your Player Name</label>
          <input
            id="player-name"
            bind:value={playerName}
            placeholder="Enter your name"
            disabled={isSubmitting}
            data-testid="input-join-player-name"
          />
        </div>

        <div class="actions">
          <button class="btn btn-secondary" on:click={() => dispatch('cancel')} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            class="btn btn-gold"
            on:click={handleJoin}
            disabled={!playerName.trim() || isSubmitting}
            data-testid="btn-confirm-join"
          >
            {isSubmitting ? 'Connecting...' : 'Accept & Join Match'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .join-screen {
    max-width: 520px;
    margin: 24px auto;
    width: 100%;
  }

  .join-card {
    padding: 28px 24px;
    text-align: center;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 24px 0;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(245, 158, 11, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .invite-tag {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 10px;
    font-family: var(--font-mono);
  }

  h2 {
    font-size: 1.45rem;
    color: var(--text-main);
    margin-bottom: 6px;
  }

  h3 {
    font-size: 1.3rem;
    color: var(--accent-red);
    margin-bottom: 8px;
  }

  .subtitle {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin-bottom: 20px;
  }

  .error-text {
    color: #fca5a5;
    font-size: 0.9rem;
    margin-bottom: 20px;
  }

  .details-box {
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

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .detail-row span:first-child {
    color: var(--text-muted);
  }

  .color-tag.black {
    background-color: rgba(156, 163, 175, 0.14);
    color: #d1d5db;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.76rem;
    font-family: var(--font-mono);
  }

  .status-badge {
    color: var(--accent-green);
    font-weight: 700;
  }

  .form-group {
    text-align: left;
    margin-bottom: 20px;
  }

  .actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
