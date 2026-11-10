<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CardModel, PlayerColor, TurnPhase } from '../../types/game';
  import Card from './Card.svelte';
  import CardDetails from './CardDetails.svelte';

  export let activeCard: CardModel | null = null;
  export let turnPhase: TurnPhase = 'DrawPhase';
  export let isMyTurn: boolean = false;
  export let remainingMoves: number = 0;
  export let remainingRevivals: number = 0;
  export let canSwap: boolean = false;
  export let remainingDeckCount: number = 108;
  export let isDrawing: boolean = false;

  const dispatch = createEventDispatcher<{
    drawCard: void;
    activateSwap: void;
    activateRevival: void;
    endTurn: void;
  }>();

  let selectedCard: CardModel | null = null;
  let showDetails: boolean = false;

  function handleCardClick(event: CustomEvent<{ card: CardModel }>) {
    selectedCard = event.detail.card;
    showDetails = true;
  }

  function handleConfirmPlay(event: CustomEvent<{ card: CardModel }>) {
    const card = event.detail.card;
    showDetails = false;

    if (card.id.includes('reverse') || canSwap) {
      dispatch('activateSwap');
    } else if (card.id.includes('draw-two') || remainingRevivals > 0) {
      dispatch('activateRevival');
    }
  }
</script>

<div class="card-hand-container panel" data-testid="card-hand">
  <div class="hand-header">
    <div class="title-group">
      <h3>Active Turn Card</h3>
      <span class="deck-count">Deck: <strong>{remainingDeckCount}</strong> cards</span>
    </div>

    <div class="action-summary">
      {#if remainingMoves > 0}
        <span class="action-pill moves-pill">Moves: <strong>{remainingMoves}</strong></span>
      {/if}
      {#if remainingRevivals > 0}
        <span class="action-pill revivals-pill">Revivals: <strong>{remainingRevivals}</strong></span>
      {/if}
      {#if canSwap}
        <span class="action-pill swap-pill">Swap Ready</span>
      {/if}
    </div>
  </div>

  <div class="cards-display">
    {#if turnPhase === 'DrawPhase' && isMyTurn}
      <div class="draw-card-slot" data-testid="draw-card-slot">
        <button
          class="draw-deck-btn"
          on:click={() => dispatch('drawCard')}
          disabled={isDrawing}
          data-testid="draw-card-btn"
        >
          <div class="deck-back">
            <span class="deck-logo">♟ UNO</span>
            <span class="deck-prompt">Click to Draw</span>
          </div>
        </button>
      </div>
    {:else if activeCard}
      <div class="active-card-wrapper">
        <Card
          card={activeCard}
          size="md"
          on:select={handleCardClick}
        />
        <div class="card-hint">Click card to view details or activate</div>
        {#if isMyTurn && turnPhase === 'ActionPhase'}
          <button class="btn btn-secondary btn-sm end-turn-btn" on:click={() => dispatch('endTurn')} data-testid="btn-end-turn">
            End Turn ⏭️
          </button>
        {/if}
      </div>
    {:else}
      <div class="empty-hand">
        <div class="card-placeholder">
          <span>{isMyTurn ? 'Waiting to draw...' : 'Opponent turn'}</span>
        </div>
      </div>
    {/if}
  </div>

  <CardDetails
    card={selectedCard}
    isOpen={showDetails}
    isPlayable={isMyTurn && (canSwap || remainingRevivals > 0)}
    on:close={() => { showDetails = false; }}
    on:confirmPlay={handleConfirmPlay}
  />
</div>

<style>
  .card-hand-container {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    padding: 16px 20px;
    border-radius: 12px;
  }

  .hand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .deck-count {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .deck-count strong {
    color: var(--accent-gold);
  }

  .action-summary {
    display: flex;
    gap: 8px;
  }

  .action-pill {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .moves-pill {
    background: rgba(56, 189, 248, 0.15);
    color: var(--accent-blue);
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .revivals-pill {
    background: rgba(34, 197, 94, 0.15);
    color: var(--accent-green);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .swap-pill {
    background: rgba(251, 191, 36, 0.15);
    color: var(--accent-gold);
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .cards-display {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 230px;
    padding: 8px 0;
  }

  .active-card-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .card-hint {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .end-turn-btn {
    margin-top: 8px;
    width: 100%;
    font-size: 0.8rem;
    padding: 6px 12px;
  }

  .draw-card-slot {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .draw-deck-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .draw-deck-btn:hover:not(:disabled) {
    transform: translateY(-8px) scale(1.03);
  }

  .draw-deck-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .deck-back {
    width: 154px;
    height: 220px;
    border-radius: 12px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 2px dashed var(--accent-gold);
    box-shadow: 0 0 16px var(--accent-gold-glow);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #fff;
  }

  .deck-logo {
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--accent-gold);
  }

  .deck-prompt {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .empty-hand {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-placeholder {
    width: 154px;
    height: 220px;
    border-radius: 12px;
    border: 1px dashed var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
    font-size: 0.85rem;
    font-weight: 500;
  }
</style>

