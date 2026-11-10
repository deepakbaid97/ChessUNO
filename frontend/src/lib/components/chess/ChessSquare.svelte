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
  export let slideOffset: { deltaX: number; deltaY: number } | null = null;
  export let isCaptureImpact: boolean = false;

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
    <div
      class="piece-scale"
      class:piece-sliding={!!slideOffset}
      style={slideOffset ? `--slide-x: ${slideOffset.deltaX}%; --slide-y: ${slideOffset.deltaY}%;` : ''}
    >
      <ChessPiece type={piece.type} color={piece.color} />
    </div>
  {/if}

  {#if isCaptureImpact}
    <div class="capture-impact-ripple" aria-hidden="true"></div>
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
    box-shadow: inset 0 0 0 2.5px var(--accent-gold), 0 0 14px var(--accent-gold-glow);
  }

  .square.swap-target {
    background-color: rgba(78, 222, 163, 0.24) !important;
    box-shadow: inset 0 0 0 2px var(--accent-green);
  }

  .square.last-move:not(.selected) {
    background-color: var(--square-last-move);
  }

  .square.in-check {
    animation: checkPulse 1.2s ease-in-out infinite;
  }

  @keyframes checkPulse {
    0%, 100% {
      background: var(--square-check) !important;
      box-shadow: inset 0 0 0 2px var(--accent-red), inset 0 0 14px rgba(239, 68, 68, 0.6);
    }
    50% {
      background: radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.4) 75%) !important;
      box-shadow: inset 0 0 0 3px #ff7878, inset 0 0 24px rgba(239, 68, 68, 0.95), 0 0 12px rgba(239, 68, 68, 0.6);
    }
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
    animation: tagPop 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes tagPop {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .piece-scale {
    width: 82%;
    height: 82%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease;
  }

  .piece-scale.piece-sliding {
    animation: slidePiece 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  @keyframes slidePiece {
    from {
      transform: translate(var(--slide-x), var(--slide-y));
    }
    to {
      transform: translate(0, 0);
    }
  }

  .square.selected .piece-scale {
    transform: translateY(-4px) scale(1.08);
    filter: drop-shadow(0 4px 10px rgba(245, 158, 11, 0.5)) drop-shadow(0 0 6px rgba(245, 158, 11, 0.35));
  }

  .capture-impact-ripple {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid var(--accent-red);
    box-shadow: 0 0 14px var(--accent-red-glow);
    pointer-events: none;
    z-index: 8;
    animation: captureRipple 0.38s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
  }

  @keyframes captureRipple {
    0% {
      transform: scale(0.2);
      opacity: 1;
      border-color: #ff9999;
    }
    50% {
      opacity: 0.9;
    }
    100% {
      transform: scale(1.4);
      opacity: 0;
      border-color: var(--accent-red);
    }
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
    background-color: rgba(78, 222, 163, 0.45);
    border: 2px solid var(--accent-green);
    box-shadow: 0 0 8px var(--accent-green-glow);
    pointer-events: none;
    z-index: 5;
    animation: dotEntrance 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), dotPulse 1.8s ease-in-out infinite alternate;
  }

  @keyframes dotEntrance {
    0% { transform: scale(0.2); opacity: 0; }
    80% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes dotPulse {
    0% { transform: scale(1); box-shadow: 0 0 4px var(--accent-green-glow); }
    100% { transform: scale(1.1); box-shadow: 0 0 10px rgba(78, 222, 163, 0.65); }
  }

  .dest-dot.occupied-target {
    inset: 2px;
    width: auto;
    height: auto;
    border-radius: 4px;
    background-color: rgba(78, 222, 163, 0.2);
    border: 2px solid var(--accent-green);
    animation: dotEntrance 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
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
    border-radius: 4px;
    border: 2.5px solid var(--accent-red);
    background-color: rgba(239, 68, 68, 0.2);
    box-shadow: inset 0 0 8px rgba(239, 68, 68, 0.45);
    pointer-events: none;
    z-index: 5;
    animation: ringEntrance 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), ringPulse 1.6s ease-in-out infinite alternate;
  }

  @keyframes ringEntrance {
    0% { transform: scale(0.6); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes ringPulse {
    0% { border-color: var(--accent-red); box-shadow: inset 0 0 4px rgba(239, 68, 68, 0.3); }
    100% { border-color: #ff7878; box-shadow: inset 0 0 12px 2px rgba(239, 68, 68, 0.65); }
  }

  @media (max-width: 600px) {
    .coordinate {
      font-size: 0.52rem;
    }
  }
</style>
