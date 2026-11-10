<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BoardPiece } from '../../types/game';
  import ChessPiece from './ChessPiece.svelte';

  export let square: string;
  export let piece: BoardPiece | null = null;
  export let isDark: boolean = false;
  export let isSelected: boolean = false;
  export let isDestination: boolean = false;
  export let isCapture: boolean = false;
  export let isLastMove: boolean = false;
  export let isInCheck: boolean = false;
  export let showCoordinateRank: boolean = false;
  export let showCoordinateFile: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { square: string };
  }>();

  function handleClick() {
    dispatch('select', { square });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  $: fileChar = square.charAt(0);
  $: rankChar = square.charAt(1);
</script>

<div
  class="square"
  class:dark={isDark}
  class:light={!isDark}
  class:selected={isSelected}
  class:destination-highlight={isDestination && !!piece && !isCapture}
  class:last-move={isLastMove}
  class:in-check={isInCheck}
  on:click={handleClick}
  on:keydown={handleKeyDown}
  tabindex="0"
  role="button"
  aria-label="Square {square}{piece ? ` containing ${piece.color} ${piece.type}` : ''}"
  data-square={square}
  data-testid="square-{square}"
>
  {#if showCoordinateRank}
    <span class="coordinate coord-rank">{rankChar}</span>
  {/if}
  {#if showCoordinateFile}
    <span class="coordinate coord-file">{fileChar}</span>
  {/if}

  {#if piece}
    <div class="piece-scale">
      <ChessPiece type={piece.type} color={piece.color} />
    </div>
  {/if}

  {#if isDestination && !isCapture}
    <div class="dest-dot" class:occupied-target={!!piece} data-testid="dest-dot-{square}"></div>
  {:else if isDestination && isCapture}
    <div class="capture-ring" data-testid="capture-ring-{square}"></div>
  {/if}
</div>

<style>
  .square {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.12s ease;
    overflow: hidden;
  }

  .square.light {
    background-color: var(--square-light);
  }

  .square.dark {
    background-color: var(--square-dark);
  }

  .square.selected {
    background-color: var(--square-selected) !important;
    box-shadow: inset 0 0 0 3px var(--accent-gold);
  }

  .square.destination-highlight {
    box-shadow: inset 0 0 0 3px var(--accent-green);
  }

  .square.last-move:not(.selected) {
    background-color: var(--square-last-move);
  }

  .square.in-check {
    background: var(--square-check) !important;
  }

  .piece-scale {
    width: 82%;
    height: 82%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .piece-scale :global(.piece-container) {
    width: 100% !important;
    height: 100% !important;
  }

  .coordinate {
    position: absolute;
    font-size: 0.65rem;
    font-weight: 700;
    pointer-events: none;
    opacity: 0.82;
    line-height: 1;
  }

  .square.light .coordinate {
    color: #5c4631;
  }

  .square.dark .coordinate {
    color: #efe7d6;
  }

  .coord-rank {
    top: 2px;
    left: 3px;
  }

  .coord-file {
    bottom: 2px;
    right: 3px;
  }

  .dest-dot {
    position: absolute;
    width: 30%;
    height: 30%;
    border-radius: 50%;
    background-color: #10b981;
    border: 2px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    z-index: 5;
  }

  .dest-dot.occupied-target {
    width: 86%;
    height: 86%;
    background-color: rgba(16, 185, 129, 0.22);
    border: 3px dashed #10b981;
    box-shadow: none;
  }

  .capture-ring {
    position: absolute;
    width: 86%;
    height: 86%;
    border-radius: 50%;
    border: 4px solid var(--accent-red);
    box-shadow: 0 0 6px var(--accent-red-glow);
    pointer-events: none;
    z-index: 5;
  }

  @media (max-width: 600px) {
    .coordinate {
      font-size: 0.55rem;
    }
  }
</style>
