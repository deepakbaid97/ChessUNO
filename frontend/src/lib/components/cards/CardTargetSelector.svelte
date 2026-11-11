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
          {#each reserves as piece, index}
            <button
              type="button"
              class="reserve-btn"
              class:attention-pulse={!selectedPieceType}
              class:selected={selectedPieceType === piece}
              style="--pulse-delay: {index * 100}ms;"
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
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.15s ease, background-color 0.15s ease;
  }

  .reserve-btn:hover {
    border-color: var(--accent-gold);
    background-color: var(--bg-elevated);
    transform: translateY(-2px);
  }

  .reserve-btn:active {
    transform: scale(0.96);
  }

  .reserve-btn.selected {
    border-color: var(--accent-green);
    background-color: rgba(78, 222, 163, 0.16);
    box-shadow: 0 0 0 1px var(--accent-green), 0 0 8px var(--accent-green-glow);
    transform: scale(1.04);
  }

  .reserve-btn.attention-pulse {
    animation: reservePiecePulse 1.35s ease-in-out infinite alternate;
    animation-delay: var(--pulse-delay, 0ms);
    border-color: var(--accent-green);
  }

  @keyframes reservePiecePulse {
    0% {
      border-color: rgba(78, 222, 163, 0.45);
      box-shadow: 0 0 0 1px rgba(78, 222, 163, 0.2), 0 0 6px rgba(78, 222, 163, 0.15);
      background-color: var(--bg-surface);
    }
    100% {
      border-color: var(--accent-green);
      box-shadow: 0 0 0 2px var(--accent-green), 0 0 14px rgba(78, 222, 163, 0.55);
      background-color: rgba(78, 222, 163, 0.1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reserve-btn.attention-pulse {
      animation: none !important;
      transform: none !important;
    }
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
    min-width: 0;
  }

  .swap-slot {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-lowest);
    border: 1px dashed var(--border-strong);
    border-radius: 4px;
    padding: 4px 8px;
    min-width: 0;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .swap-slot.active-slot {
    border-style: dashed;
    border-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.1);
    box-shadow: 0 0 6px var(--accent-gold-glow);
  }

  .swap-slot.filled {
    border-style: solid;
    border-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.18);
    animation: slotFill 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes slotFill {
    from { transform: scale(0.92); }
    to { transform: scale(1); }
  }

  .swap-slot.pending-emerald {
    border-style: dashed;
    border-color: var(--accent-green);
    background-color: rgba(78, 222, 163, 0.1);
    box-shadow: 0 0 6px var(--accent-green-glow);
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
    flex-shrink: 0;
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
