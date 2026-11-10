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
      <div class="outcome-emblem" aria-hidden="true">
        {#if isDraw}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18" />
            <path d="M5 7h14" />
            <path d="M3 13l2-6 2 6a2 2 0 0 1-4 0z" />
            <path d="M17 13l2-6 2 6a2 2 0 0 1-4 0z" />
          </svg>
        {:else if isWinner}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        {:else}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 9l6 6" />
            <path d="M15 9l-6 6" />
          </svg>
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
    inset: 0;
    background: rgba(10, 12, 16, 0.88);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.25s ease-out;
  }

  .gameover-card {
    background-color: var(--bg-surface);
    border: 1.5px solid var(--border-strong);
    border-radius: 12px;
    padding: 32px 28px;
    text-align: center;
    max-width: 420px;
    width: 92%;
    box-shadow: var(--shadow-lg);
    animation: modalPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes modalPop {
    0% { transform: scale(0.85) translateY(18px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }

  .gameover-card.victory {
    border-color: var(--accent-gold);
    box-shadow: 0 0 32px rgba(245, 158, 11, 0.25), var(--shadow-lg);
  }

  .gameover-card.defeat {
    border-color: var(--accent-red);
    box-shadow: 0 0 32px rgba(239, 68, 68, 0.25), var(--shadow-lg);
  }

  .gameover-card.draw {
    border-color: var(--accent-blue);
  }

  .outcome-emblem {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    margin: 0 auto 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    transition: transform 0.2s ease;
  }

  .victory .outcome-emblem {
    color: var(--accent-gold);
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.35);
    animation: trophyGlow 2.5s infinite ease-in-out;
  }

  @keyframes trophyGlow {
    0%, 100% { transform: scale(1); box-shadow: 0 0 16px rgba(245, 158, 11, 0.3); }
    50% { transform: scale(1.08); box-shadow: 0 0 28px rgba(245, 158, 11, 0.6); }
  }

  .defeat .outcome-emblem {
    color: var(--accent-red);
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 18px rgba(239, 68, 68, 0.3);
  }

  .draw .outcome-emblem {
    color: var(--accent-blue);
    border-color: rgba(59, 130, 246, 0.4);
  }

  h2 {
    font-size: 1.65rem;
    font-weight: 800;
    margin-bottom: 6px;
    letter-spacing: -0.02em;
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
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .summary-box {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 22px;
    text-align: left;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
  }

  .summary-item span {
    color: var(--text-muted);
  }

  .summary-item strong {
    color: var(--text-main);
    font-family: var(--font-mono);
  }

  .actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
