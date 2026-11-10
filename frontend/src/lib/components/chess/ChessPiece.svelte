<script lang="ts">
  import type { PieceType, PlayerColor } from '../../types/game';

  export let type: PieceType;
  export let color: PlayerColor;
  export let size: number = 48;

  $: isWhite = color === 'White';
</script>

<div class="piece-container" style="width: {size}px; height: {size}px;" data-testid="piece-{color.toLowerCase()}-{type.toLowerCase()}">
  {#if type === 'Pawn'}
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <path
        d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
        fill={isWhite ? '#ffffff' : '#1c1917'}
        stroke={isWhite ? '#1c1917' : '#f5f5f4'}
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  {:else if type === 'Knight'}
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <path
        d="m 22,10 c 10.5,1 16.5,8 16,29 L 15,39 C 15,34 14,26 8,24 8,19 12,14 16,13 16,10 19,8 22,10 z"
        fill={isWhite ? '#ffffff' : '#1c1917'}
        stroke={isWhite ? '#1c1917' : '#f5f5f4'}
        stroke-width="1.5"
      />
      <circle cx="21" cy="18" r="2" fill={isWhite ? '#1c1917' : '#ffffff'} />
    </svg>
  {:else if type === 'Bishop'}
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g
        fill={isWhite ? '#ffffff' : '#1c1917'}
        stroke={isWhite ? '#1c1917' : '#f5f5f4'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
        <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
        <circle cx="22.5" cy="8" r="2" />
      </g>
      <path d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" stroke={isWhite ? '#1c1917' : '#ffffff'} stroke-width="1.5" stroke-linecap="round" />
    </svg>
  {:else if type === 'Rook'}
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g
        fill={isWhite ? '#ffffff' : '#1c1917'}
        stroke={isWhite ? '#1c1917' : '#f5f5f4'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
        <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
        <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 z" />
        <path d="M 12,14 L 33,14 L 31,32 L 14,32 z" />
      </g>
    </svg>
  {:else if type === 'Queen'}
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g
        fill={isWhite ? '#ffffff' : '#1c1917'}
        stroke={isWhite ? '#1c1917' : '#f5f5f4'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38,14 L 31,25 L 22.5,10 L 14,25 L 7,14 z" />
        <path d="M 9,26 L 36,26 L 34,36 L 11,36 z" />
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="14" cy="9" r="2" />
        <circle cx="22.5" cy="8" r="2" />
        <circle cx="31" cy="9" r="2" />
        <circle cx="39" cy="12" r="2" />
      </g>
    </svg>
  {:else if type === 'King'}
    <svg viewBox="0 0 45 45" width="100%" height="100%">
      <g
        fill={isWhite ? '#ffffff' : '#1c1917'}
        stroke={isWhite ? '#1c1917' : '#f5f5f4'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M 22.5,11.5 L 22.5,6 M 20,8 L 25,8" stroke={isWhite ? '#1c1917' : '#f5f5f4'} stroke-width="1.5" />
        <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
        <path d="M 11.5,37 C 17,40.5 27,40.5 33.5,37 C 33.5,35 32.5,30 29.5,27 C 26.5,24 18.5,24 15.5,27 C 12.5,30 11.5,35 11.5,37 z" />
        <path d="M 11.5,30 C 17,27 28,27 33.5,30" fill="none" />
        <path d="M 10,39 L 35,39 L 35,37 L 10,37 z" />
      </g>
    </svg>
  {/if}
</div>

<style>
  .piece-container {
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    pointer-events: none;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
    transition: transform 0.15s ease;
  }
</style>

