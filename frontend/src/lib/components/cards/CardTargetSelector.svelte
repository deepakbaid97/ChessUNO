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
        <span class="step-tag">RESERVE POOL</span>
        <span class="step-hint">
          {selectedPieceType
            ? `Deploying ${selectedPieceType}: tap a highlighted square on your half`
            : 'Tap a captured piece to deploy:'}
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
              <ChessPiece type={asPieceType(piece)} color={playerColor} size={20} />
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
          <span class="slot-label">1ST</span>
          <strong class="slot-val">{firstSwapSquare ? firstSwapSquare.toUpperCase() : 'Tap Board...'}</strong>
        </div>

        <span class="swap-connector" aria-hidden="true">⇄</span>

        <div class="swap-slot" class:filled={!!secondSwapSquare} class:pending-emerald={!!firstSwapSquare && !secondSwapSquare}>
          <span class="slot-label">2ND</span>
          <strong class="slot-val">{secondSwapSquare ? secondSwapSquare.toUpperCase() : 'Tap Board...'}</strong>
        </div>
      </div>

      <div class="stepper-right">
        {#if firstSwapSquare}
          <button
            type="button"
            class="undo-btn"
            on:click={() => dispatch('cancel')}
          >
            Undo
          </button>
        {/if}
        <span class="reserve-badge">Reserve ({reserves.length})</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .target-selector {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    padding: 6px 10px;
    border-radius: 4px;
  }

  .selector-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .selector-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .step-tag {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 3px;
    background-color: rgba(78, 222, 163, 0.14);
    color: var(--accent-green);
    border: 1px solid rgba(78, 222, 163, 0.35);
  }

  .step-hint {
    font-size: 0.75rem;
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
    gap: 5px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 4px 9px;
    color: var(--text-main);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .reserve-btn:hover {
    border-color: var(--accent-gold);
    background-color: var(--bg-elevated);
  }

  .reserve-btn.selected {
    border-color: var(--accent-green);
    background-color: rgba(78, 222, 163, 0.16);
    box-shadow: 0 0 0 1px var(--accent-green);
  }

  .piece-name {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
  }

  .empty-reserves {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-muted);
  }

  .swap-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .swap-slot {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-lowest);
    border: 1px dashed var(--border-strong);
    border-radius: 4px;
    padding: 4px 8px;
  }

  .swap-slot.active-slot {
    border-style: dashed;
    border-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.1);
  }

  .swap-slot.filled {
    border-style: solid;
    border-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.18);
  }

  .swap-slot.pending-emerald {
    border-style: dashed;
    border-color: var(--accent-green);
    background-color: rgba(78, 222, 163, 0.1);
  }

  .slot-label {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--text-dim);
    font-weight: 700;
  }

  .slot-val {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--text-main);
  }

  .swap-slot.filled .slot-val {
    color: var(--accent-gold-bright);
  }

  .swap-slot.pending-emerald .slot-val {
    color: var(--accent-green);
  }

  .swap-connector {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text-dim);
  }

  .stepper-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .undo-btn {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-strong);
    color: var(--text-main);
    font-family: var(--font-headline);
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
  }

  .undo-btn:hover {
    border-color: var(--accent-gold);
  }

  .reserve-badge {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    color: var(--text-muted);
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    padding: 3px 7px;
    border-radius: 3px;
  }
</style>
