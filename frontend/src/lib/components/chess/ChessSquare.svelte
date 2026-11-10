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
    <ChessPiece type={piece.type} color={piece.color} />
  {/if}

  {#if isDestination && !isCapture}
    <div class="dest-dot" data-testid="dest-dot-{square}"></div>
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
    transition: background-color 0.15s ease;
  }

  .square.light {
    background-color: var(--square-light);
  }

  .square.dark {
    background-color: var(--square-dark);
  }

  .square.selected {
    background-color: var(--square-selected) !important;
    box-shadow: inset 0 0 0 2px var(--accent-gold);
  }

  .square.last-move:not(.selected) {
    background-color: var(--square-last-move);
  }

  .square.in-check {
    background: var(--square-check) !important;
  }

  .coordinate {
    position: absolute;
    font-size: 0.7rem;
    font-weight: 700;
    pointer-events: none;
    opacity: 0.75;
  }

  .square.light .coordinate {
    color: var(--square-dark);
  }

  .square.dark .coordinate {
    color: var(--square-light);
  }

  .coord-rank {
    top: 2px;
    left: 4px;
  }

  .coord-file {
    bottom: 2px;
    right: 4px;
  }

  .dest-dot {
    position: absolute;
    width: 28%;
    height: 28%;
    border-radius: 50%;
    background-color: var(--square-dest-highlight);
    box-shadow: 0 0 6px var(--accent-green-glow);
    pointer-events: none;
  }

  .capture-ring {
    position: absolute;
    width: 82%;
    height: 82%;
    border-radius: 50%;
    border: 4px solid var(--accent-red);
    box-shadow: 0 0 8px var(--accent-red-glow);
    pointer-events: none;
  }
</style>

