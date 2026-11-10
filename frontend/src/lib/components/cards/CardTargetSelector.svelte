<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor, PieceType } from '../../types/game';
  import ChessPiece from '../chess/ChessPiece.svelte';

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

  function asPieceType(piece: string): PieceType {
    return piece as PieceType;
  }
</script>

<div class="target-selector" data-testid="target-selector">
  {#if mode === 'revival'}
    <div class="selector-row">
      <div class="selector-label">
        <span class="step-tag">Reserve Pool</span>
        <span class="step-hint">
          {selectedPieceType
            ? `Deploying ${selectedPieceType}: tap a highlighted square on your half`
            : 'Tap a captured piece to place on the board:'}
        </span>
      </div>

      {#if reserves.length === 0}
        <span class="empty-reserves">No captured pieces in reserve.</span>
      {:else}
        <div class="reserves-list">
          {#each reserves as piece}
            <button
              type="button"
              class="reserve-btn"
              class:selected={selectedPieceType === piece}
              on:click={() => dispatch('selectReservePiece', { pieceType: piece })}
              data-testid="reserve-{piece.toLowerCase()}"
            >
              <ChessPiece type={asPieceType(piece)} color={playerColor} size={22} />
              <span class="piece-name">{piece}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else if mode === 'swap'}
    <div class="selector-row">
      <div class="swap-stepper">
        <div class="swap-slot" class:filled={!!firstSwapSquare} class:active-slot={!firstSwapSquare}>
          <span class="slot-label">1st Piece</span>
          <strong class="slot-val">{firstSwapSquare ? firstSwapSquare.toUpperCase() : 'Tap board'}</strong>
        </div>

        <span class="swap-connector" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>

        <div class="swap-slot" class:filled={!!secondSwapSquare} class:active-slot={!!firstSwapSquare && !secondSwapSquare}>
          <span class="slot-label">2nd Piece</span>
          <strong class="slot-val">{secondSwapSquare ? secondSwapSquare.toUpperCase() : 'Tap board'}</strong>
        </div>
      </div>

      {#if firstSwapSquare}
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          on:click={() => dispatch('cancel')}
        >
          Reset Selection
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .target-selector {
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    padding: 8px 12px;
    border-radius: 8px;
  }

  .selector-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .selector-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .step-tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: rgba(16, 185, 129, 0.16);
    color: var(--accent-green);
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .step-hint {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .reserves-list {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .reserve-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-surface);
    border: 1.5px solid var(--border-strong);
    border-radius: 6px;
    padding: 5px 10px;
    color: var(--text-main);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .reserve-btn:hover {
    border-color: var(--accent-gold);
    background-color: var(--bg-card-hover);
  }

  .reserve-btn.selected {
    border-color: var(--accent-green);
    background-color: rgba(16, 185, 129, 0.18);
    box-shadow: 0 0 0 2px var(--accent-green-glow);
  }

  .piece-name {
    font-size: 0.78rem;
    font-weight: 600;
  }

  .empty-reserves {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .swap-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .swap-slot {
    flex: 1;
    background-color: var(--bg-primary);
    border: 1px dashed var(--border-strong);
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .swap-slot.active-slot {
    border-style: solid;
    border-color: var(--accent-gold);
  }

  .swap-slot.filled {
    border-style: solid;
    border-color: var(--accent-green);
    background-color: rgba(16, 185, 129, 0.12);
  }

  .slot-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .slot-val {
    font-size: 0.82rem;
    font-family: var(--font-mono);
    color: var(--text-main);
  }

  .swap-connector {
    color: var(--accent-gold);
    display: flex;
    align-items: center;
  }

  .btn-xs {
    padding: 4px 10px;
    font-size: 0.74rem;
  }

  @media (max-width: 900px) {
    .target-selector {
      padding: 6px 8px;
    }

    .reserve-btn {
      padding: 4px 8px;
    }

    .swap-slot {
      padding: 4px 8px;
    }
  }
</style>
