<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PieceType, PlayerColor } from '../../types/game';
  import ChessPiece from './ChessPiece.svelte';

  export let color: PlayerColor = 'White';
  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { pieceType: PieceType };
    cancel: void;
  }>();

  const promotionOptions: PieceType[] = ['Queen', 'Rook', 'Bishop', 'Knight'];

  function choosePiece(type: PieceType) {
    dispatch('select', { pieceType: type });
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    on:click|self={() => dispatch('cancel')}
    on:keydown={(e) => { if (e.key === 'Escape') dispatch('cancel'); }}
    tabindex="-1"
    role="presentation"
  >
    <div class="modal-content" role="dialog" aria-modal="true" aria-label="Choose Promotion Piece">
      <h3>Pawn Promotion</h3>
      <p>Select piece to promote your pawn into:</p>

      <div class="options-grid">
        {#each promotionOptions as opt}
          <button class="option-btn" on:click={() => choosePiece(opt)} data-testid="promo-{opt.toLowerCase()}">
            <ChessPiece type={opt} {color} size={52} />
            <span class="piece-label">{opt}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease-out;
  }

  .modal-content {
    background-color: var(--bg-surface);
    border: 1px solid var(--accent-gold);
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    box-shadow: var(--shadow-card);
    max-width: 380px;
    width: 90%;
  }

  h3 {
    font-size: 1.25rem;
    color: var(--accent-gold);
    margin-bottom: 8px;
  }

  p {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 20px;
  }

  .options-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .option-btn {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .option-btn:hover {
    background: var(--bg-card-hover);
    border-color: var(--accent-gold);
    transform: translateY(-2px);
  }

  .piece-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-main);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
