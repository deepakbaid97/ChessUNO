<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
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
        <div class="icon">⚠️</div>
        <h3>Unable to Join Game</h3>
        <p class="error-text">{errorMsg}</p>
        <button class="btn btn-secondary" on:click={() => dispatch('cancel')}>Return to Home</button>
      </div>
    {:else}
      <div class="valid-state">
        <div class="icon">⚔️</div>
        <h2>Match Invitation</h2>
        <p class="subtitle">You have been invited to challenge <strong>{invitationInfo?.creatorName}</strong>!</p>

        <div class="details-box">
          <div class="detail-row">
            <span>Host:</span>
            <strong>{invitationInfo?.creatorName} (White)</strong>
          </div>
          <div class="detail-row">
            <span>Your Assigned Color:</span>
            <strong class="color-tag black">Black (Response)</strong>
          </div>
          <div class="detail-row">
            <span>Match Status:</span>
            <span class="status-badge">Waiting For You</span>
          </div>
        </div>

        <div class="form-group">
          <label for="player-name">Your Challenger Name</label>
          <input
            id="player-name"
            bind:value={playerName}
            placeholder="e.g. Challenger"
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
    max-width: 560px;
    margin: 40px auto;
    width: 100%;
  }

  .join-card {
    padding: 36px 32px;
    text-align: center;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 30px 0;
  }

  .spinner {
    width: 44px;
    height: 44px;
    border: 3px solid rgba(251, 191, 36, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .icon {
    font-size: 2.8rem;
    margin-bottom: 12px;
  }

  h2 {
    font-size: 1.6rem;
    color: #fff;
    margin-bottom: 6px;
  }

  h3 {
    font-size: 1.4rem;
    color: var(--accent-red);
    margin-bottom: 8px;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    margin-bottom: 24px;
  }

  .error-text {
    color: #fca5a5;
    font-size: 0.95rem;
    margin-bottom: 24px;
  }

  .details-box {
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

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
  }

  .color-tag.black {
    background: rgba(168, 85, 247, 0.15);
    color: var(--accent-purple);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .status-badge {
    color: var(--accent-green);
    font-weight: 700;
  }

  .form-group {
    text-align: left;
    margin-bottom: 24px;
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
