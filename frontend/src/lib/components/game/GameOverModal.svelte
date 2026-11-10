<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor } from '../../types/game';

  export let isOpen: boolean = false;
  export let winner: PlayerColor | null = null;
  export let playerColor: PlayerColor = 'White';
  export let gameStatus: string = '';
  export let totalMoves: number = 0;

  const dispatch = createEventDispatcher<{
    returnHome: void;
    playAgain: void;
  }>();

  $: isWinner = winner === playerColor;
  $: isDraw = !winner && (gameStatus.includes('Draw') || gameStatus === 'Stalemate');

  function getTitle(): string {
    if (isDraw) return 'Match Drawn';
    if (isWinner) return 'Victory!';
    return 'Defeat';
  }

  function getSubtitle(): string {
    if (gameStatus === 'Checkmate') {
      return isWinner ? 'You delivered checkmate or captured the king!' : 'Your king was checkmated or captured.';
    }
    if (gameStatus === 'Resigned') {
      return isWinner ? 'Opponent resigned the match.' : 'You resigned the match.';
    }
    if (gameStatus === 'Stalemate') {
      return 'Game ended in stalemate.';
    }
    return `Game concluded (${gameStatus}).`;
  }
</script>

{#if isOpen}
  <div class="gameover-backdrop" data-testid="game-over-modal">
    <div class="gameover-card panel" class:victory={isWinner} class:defeat={!isWinner && !isDraw} class:draw={isDraw}>
      <div class="trophy-icon">
        {#if isDraw}
          ⚖️
        {:else if isWinner}
          🏆
        {:else}
          ⚔️
        {/if}
      </div>

      <h2>{getTitle()}</h2>
      <p class="subtitle">{getSubtitle()}</p>

      <div class="summary-box">
        <div class="summary-item">
          <span>Winner</span>
          <strong>{winner ? `${winner} Player` : 'None (Draw)'}</strong>
        </div>
        <div class="summary-item">
          <span>Termination</span>
          <strong>{gameStatus}</strong>
        </div>
        {#if totalMoves > 0}
          <div class="summary-item">
            <span>Total Revisions</span>
            <strong>{totalMoves}</strong>
          </div>
        {/if}
      </div>

      <div class="actions">
        <button class="btn btn-secondary" on:click={() => dispatch('returnHome')} data-testid="btn-return-home">
          Return to Lobby
        </button>
        <button class="btn btn-gold" on:click={() => dispatch('playAgain')} data-testid="btn-play-again">
          New Game
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .gameover-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(11, 15, 23, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.25s ease-out;
  }

  .gameover-card {
    background: var(--bg-surface);
    border: 2px solid var(--border-color);
    border-radius: 16px;
    padding: 36px 32px;
    text-align: center;
    max-width: 440px;
    width: 90%;
    box-shadow: var(--shadow-card);
  }

  .gameover-card.victory {
    border-color: var(--accent-gold);
    box-shadow: 0 0 24px var(--accent-gold-glow), var(--shadow-card);
  }

  .gameover-card.defeat {
    border-color: var(--accent-red);
    box-shadow: 0 0 24px var(--accent-red-glow), var(--shadow-card);
  }

  .gameover-card.draw {
    border-color: var(--accent-blue);
    box-shadow: 0 0 24px rgba(56, 189, 248, 0.3), var(--shadow-card);
  }

  .trophy-icon {
    font-size: 3.5rem;
    margin-bottom: 12px;
  }

  h2 {
    font-size: 1.8rem;
    font-weight: 800;
    margin-bottom: 6px;
  }

  .victory h2 {
    color: var(--accent-gold);
  }

  .defeat h2 {
    color: var(--accent-red);
  }

  .draw h2 {
    color: var(--accent-blue);
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    margin-bottom: 24px;
  }

  .summary-box {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
    text-align: left;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  .summary-item span {
    color: var(--text-muted);
  }

  .summary-item strong {
    color: var(--text-main);
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

