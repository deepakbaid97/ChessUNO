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
  class:swap-target={isDestination && !!piece && !isCapture}
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

  {#if isSelected}
    <span class="selected-tag" aria-hidden="true">1ST</span>
  {/if}

  {#if piece}
    <div class="piece-scale">
      <ChessPiece type={piece.type} color={piece.color} />
    </div>
  {/if}

  {#if isDestination && !isCapture}
    <div class="dest-dot" class:occupied-target={!!piece} data-testid="dest-dot-{square}">
      {#if piece}
        <span class="target-check" aria-hidden="true">✓</span>
      {/if}
    </div>
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
  }

  .square.light {
    background-color: var(--square-light);
  }

  .square.dark {
    background-color: var(--square-dark);
  }

  .square.selected {
    background-color: var(--square-selected) !important;
    box-shadow: inset 0 0 0 2.5px var(--accent-gold);
  }

  .square.swap-target {
    background-color: rgba(78, 222, 163, 0.24) !important;
    box-shadow: inset 0 0 0 2px var(--accent-green);
  }

  .square.last-move:not(.selected) {
    background-color: var(--square-last-move);
  }

  .square.in-check {
    background: var(--square-check) !important;
    box-shadow: inset 0 0 0 2px var(--accent-red);
  }

  .selected-tag {
    position: absolute;
    top: 1px;
    left: 1px;
    padding: 1px 3px;
    border-radius: 2px;
    background-color: var(--accent-gold);
    color: #10131a;
    font-family: var(--font-mono);
    font-size: 0.5rem;
    font-weight: 700;
    line-height: 1;
    z-index: 6;
    pointer-events: none;
  }

  .piece-scale {
    width: 82%;
    height: 82%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .piece-scale :global(.piece-container) {
    width: 100% !important;
    height: 100% !important;
  }

  .coordinate {
    position: absolute;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 600;
    pointer-events: none;
    opacity: 0.65;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .square.light .coordinate {
    color: #4a3725;
  }

  .square.dark .coordinate {
    color: #f3ede0;
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
    background-color: rgba(78, 222, 163, 0.35);
    border: 2px solid var(--accent-green);
    pointer-events: none;
    z-index: 5;
  }

  .dest-dot.occupied-target {
    inset: 2px;
    width: auto;
    height: auto;
    border-radius: 2px;
    background-color: rgba(78, 222, 163, 0.16);
    border: 2px solid var(--accent-green);
  }

  .target-check {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background-color: var(--accent-green);
    color: #06281b;
    font-family: var(--font-mono);
    font-size: 0.52rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .capture-ring {
    position: absolute;
    inset: 2px;
    border-radius: 2px;
    border: 2.5px solid var(--accent-red);
    background-color: rgba(239, 68, 68, 0.18);
    pointer-events: none;
    z-index: 5;
  }

  @media (max-width: 600px) {
    .coordinate {
      font-size: 0.52rem;
    }
  }
</style>
