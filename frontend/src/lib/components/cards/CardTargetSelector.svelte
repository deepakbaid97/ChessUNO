<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor } from '../../types/game';

  export let mode: 'swap' | 'revival' = 'swap';
  export let playerColor: PlayerColor = 'White';
  export let reserves: string[] = [];
  export let selectedPieceType: string | null = null;
  export let firstSwapSquare: string | null = null;
  export let secondSwapSquare: string | null = null;

  const dispatch = createEventDispatcher<{
    selectReservePiece: { pieceType: string };
    cancel: void;
  }>();

  const pieceIcons: Record<string, string> = {
    Pawn: '♟',
    Knight: '♞',
    Bishop: '♝',
    Rook: '♜',
    Queen: '♛'
  };
</script>

<div class="target-selector panel" data-testid="target-selector">
  {#if mode === 'revival'}
    <div class="header">
      <h4>Revival Ability Active</h4>
      <p class="subtitle">Select a captured friendly piece from your reserve, then click an empty square on your half of the board:</p>
    </div>

    {#if reserves.length === 0}
      <p class="empty-reserves">No captured pieces available in your reserve pool.</p>
    {:else}
      <div class="reserves-list">
        {#each reserves as piece}
          <button
            class="reserve-btn"
            class:selected={selectedPieceType === piece}
            on:click={() => dispatch('selectReservePiece', { pieceType: piece })}
            data-testid="reserve-{piece.toLowerCase()}"
          >
            <span class="piece-symbol">{pieceIcons[piece] || piece}</span>
            <span class="piece-name">{piece}</span>
          </button>
        {/each}
      </div>
    {/if}
  {:else if mode === 'swap'}
    <div class="header">
      <h4>Reverse / Swap Ability Active</h4>
      <p class="subtitle">Select two of your own friendly pieces on the board to swap their positions (Kings and opponent pieces cannot be swapped):</p>
    </div>

    <div class="swap-status">
      <div class="swap-box" class:filled={firstSwapSquare}>
        <span>Piece 1:</span>
        <strong>{firstSwapSquare || 'Select on board'}</strong>
      </div>
      <span class="swap-arrow">⇄</span>
      <div class="swap-box" class:filled={secondSwapSquare}>
        <span>Piece 2:</span>
        <strong>{secondSwapSquare || 'Select on board'}</strong>
      </div>
    </div>
  {/if}

  <div class="selector-actions">
    <button class="btn btn-secondary btn-sm" on:click={() => dispatch('cancel')}>Cancel Ability</button>
  </div>
</div>

<style>
  .target-selector {
    background: var(--bg-card);
    border: 1px solid var(--accent-gold);
    box-shadow: var(--shadow-glow);
    padding: 16px 20px;
    margin-bottom: 16px;
    border-radius: 10px;
    animation: slideDown 0.2s ease-out;
  }

  .header h4 {
    color: var(--accent-gold);
    font-size: 1rem;
    margin-bottom: 4px;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 14px;
  }

  .reserves-list {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .reserve-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px 14px;
    color: var(--text-main);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reserve-btn:hover {
    border-color: var(--accent-gold);
    background: var(--bg-card-hover);
  }

  .reserve-btn.selected {
    border-color: var(--accent-green);
    background: rgba(34, 197, 94, 0.15);
    box-shadow: 0 0 8px var(--accent-green-glow);
  }

  .piece-symbol {
    font-size: 1.4rem;
  }

  .piece-name {
    font-size: 0.85rem;
    font-weight: 600;
  }

  .empty-reserves {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 14px;
  }

  .swap-status {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
  }

  .swap-box {
    background: var(--bg-surface);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    padding: 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 130px;
  }

  .swap-box.filled {
    border-style: solid;
    border-color: var(--accent-gold);
    background: rgba(251, 191, 36, 0.1);
  }

  .swap-box span {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .swap-box strong {
    font-size: 0.95rem;
    color: var(--text-main);
  }

  .swap-arrow {
    font-size: 1.5rem;
    color: var(--accent-gold);
  }

  .btn-sm {
    padding: 6px 14px;
    font-size: 0.85rem;
  }

  .selector-actions {
    display: flex;
    justify-content: flex-end;
  }

  @keyframes slideDown {
    from { transform: translateY(-8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
