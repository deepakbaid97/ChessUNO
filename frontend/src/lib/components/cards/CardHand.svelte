<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CardModel, TurnPhase } from '../../types/game';
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
  export let availableChoices: string[] = [];

  const dispatch = createEventDispatcher<{
    drawCard: void;
    activateSwap: void;
    activateRevival: void;
    endTurn: void;
    submitChoice: { choice: string };
  }>();

  interface ChoiceMeta {
    title: string;
    detail: string;
  }

  function getChoiceMeta(choice: string): ChoiceMeta {
    switch (choice) {
      case 'MOVE_1':
        return { title: '1 Chess Move', detail: 'Move any friendly piece once' };
      case 'REVIVE_UP_TO_TWO':
        return { title: 'Revive up to 2 Pieces', detail: 'Return captured pieces to your half' };
      case 'SWAP_OWN_PIECES':
        return { title: 'Swap 2 Friendly Pieces', detail: 'Exchange two non-King pieces' };
      case 'REVIVE_UP_TO_FOUR':
        return { title: 'Revive up to 4 Pieces', detail: 'Return up to 4 captured pieces' };
      case 'REVIVE_TWO_AND_MOVE_TWO':
        return { title: 'Revive 2 + Move 2', detail: 'Revive 2 pieces, then make 2 moves' };
      default:
        return { title: choice, detail: '' };
    }
  }

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
      <span class="section-label">Turn Card &amp; Controls</span>
      <span class="deck-count">Deck: <strong>{remainingDeckCount}</strong></span>
    </div>

    <div class="action-summary">
      {#if remainingMoves > 0}
        <span class="action-pill moves-pill">Moves left: <strong>{remainingMoves}</strong></span>
      {/if}
      {#if remainingRevivals > 0}
        <span class="action-pill revivals-pill">Revivals left: <strong>{remainingRevivals}</strong></span>
      {/if}
      {#if canSwap}
        <span class="action-pill swap-pill">Swap Active</span>
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
          <div class="deck-visual" aria-hidden="true">
            <span class="deck-card-layer"></span>
            <span class="deck-badge">UNO</span>
          </div>
          <div class="deck-copy">
            <span class="deck-cta">Draw Turn Card</span>
            <span class="deck-sub">Tap to draw 1 card from the deck and begin your turn</span>
          </div>
        </button>
      </div>
    {:else if activeCard}
      <div class="active-card-dock">
        <div class="card-column">
          <Card
            card={activeCard}
            size="md"
            on:select={handleCardClick}
          />
          <button type="button" class="inspect-link" on:click={() => { selectedCard = activeCard; showDetails = true; }}>
            Inspect rules
          </button>
        </div>

        <div class="controls-column">
          {#if isMyTurn && turnPhase === 'AwaitingChoice' && availableChoices.length > 0}
            <div class="choices-container" data-testid="choices-container">
              <div class="choices-title">Choose 1 Effect to Execute:</div>
              <div class="choices-buttons">
                {#each availableChoices as choice}
                  {@const meta = getChoiceMeta(choice)}
                  <button
                    class="choice-btn"
                    data-testid="btn-choice-{choice.toLowerCase()}"
                    on:click={() => dispatch('submitChoice', { choice })}
                  >
                    <span class="choice-name">{meta.title}</span>
                    {#if meta.detail}
                      <span class="choice-detail">{meta.detail}</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {:else if isMyTurn && turnPhase === 'ActionPhase'}
            <div class="action-buttons-group">
              <div class="active-effect-summary">
                <span class="effect-card-name">{activeCard.name}</span>
                <p class="effect-card-desc">{activeCard.description}</p>
              </div>

              {#if canSwap}
                <button
                  class="btn btn-gold btn-sm swap-action-btn"
                  on:click={() => dispatch('activateSwap')}
                  data-testid="btn-activate-swap"
                >
                  Select Pieces to Swap
                </button>
              {/if}

              {#if remainingRevivals > 0}
                <button
                  class="btn btn-primary btn-sm revival-action-btn"
                  on:click={() => dispatch('activateRevival')}
                  data-testid="btn-activate-revival"
                >
                  Select Reserve Piece ({remainingRevivals} left)
                </button>
              {/if}

              <button
                class="btn btn-secondary btn-sm end-turn-btn"
                on:click={() => dispatch('endTurn')}
                data-testid="btn-end-turn"
              >
                End Turn Early
              </button>
            </div>
          {:else}
            <div class="opponent-card-status">
              <span class="status-tag">Opponent's Drawn Card</span>
              <p class="status-desc">{activeCard.description}</p>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="empty-hand">
        <div class="card-placeholder">
          <span class="placeholder-title">{isMyTurn ? 'Ready to Draw' : 'Opponent\'s Turn'}</span>
          <span class="placeholder-sub">
            {isMyTurn ? 'Draw a card to start your turn.' : 'Waiting for opponent to draw a card from the deck.'}
          </span>
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
    padding: 12px 14px;
    border-radius: 8px;
  }

  .hand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 6px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .deck-count {
    font-size: 0.75rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .deck-count strong {
    color: var(--text-main);
  }

  .action-summary {
    display: flex;
    gap: 6px;
  }

  .action-pill {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: var(--font-mono);
  }

  .moves-pill {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.35);
  }

  .revivals-pill {
    background: rgba(16, 185, 129, 0.15);
    color: var(--accent-green);
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .swap-pill {
    background: rgba(245, 158, 11, 0.15);
    color: var(--accent-gold);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .cards-display {
    display: flex;
    align-items: stretch;
    justify-content: center;
  }

  /* Draw Card Button */
  .draw-card-slot {
    width: 100%;
  }

  .draw-deck-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    border-radius: 8px;
    background-color: var(--bg-elevated);
    border: 2px solid var(--accent-gold);
    box-shadow: 0 0 0 3px var(--accent-gold-glow);
    cursor: pointer;
    text-align: left;
    color: var(--text-main);
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .draw-deck-btn:hover:not(:disabled) {
    background-color: var(--bg-card-hover);
  }

  .draw-deck-btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .draw-deck-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .deck-visual {
    position: relative;
    width: 54px;
    height: 74px;
    border-radius: 6px;
    background-color: var(--bg-primary);
    border: 1.5px solid var(--accent-gold);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .deck-card-layer {
    position: absolute;
    inset: 3px;
    border-radius: 4px;
    border: 1px dashed rgba(245, 158, 11, 0.45);
  }

  .deck-badge {
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--accent-gold);
    font-family: var(--font-mono);
  }

  .deck-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .deck-cta {
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent-gold);
  }

  .deck-sub {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.3;
  }

  /* Active Card Dock (Side-by-side Card + Controls) */
  .active-card-dock {
    display: flex;
    align-items: stretch;
    gap: 14px;
    width: 100%;
  }

  .card-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .inspect-link {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 0.68rem;
    text-decoration: underline;
    cursor: pointer;
    padding: 2px 4px;
  }

  .inspect-link:hover {
    color: var(--text-main);
  }

  .controls-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  /* Wild Card Choices */
  .choices-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .choices-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent-gold);
  }

  .choices-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .choice-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 6px;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    color: var(--text-main);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .choice-btn:hover {
    border-color: var(--accent-gold);
    background-color: var(--bg-card-hover);
  }

  .choice-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .choice-detail {
    font-size: 0.68rem;
    color: var(--text-muted);
  }

  /* Action Phase Controls */
  .action-buttons-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .active-effect-summary {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 8px 10px;
  }

  .effect-card-name {
    display: block;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 2px;
  }

  .effect-card-desc {
    font-size: 0.74rem;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .swap-action-btn,
  .revival-action-btn,
  .end-turn-btn {
    width: 100%;
    font-size: 0.8rem;
    padding: 8px 12px;
  }

  .opponent-card-status {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 10px 12px;
  }

  .status-tag {
    display: block;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .status-desc {
    font-size: 0.78rem;
    color: var(--text-main);
    line-height: 1.35;
  }

  /* Empty state */
  .empty-hand {
    width: 100%;
  }

  .card-placeholder {
    width: 100%;
    padding: 16px;
    border-radius: 6px;
    border: 1px dashed var(--border-strong);
    background-color: var(--bg-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 4px;
  }

  .placeholder-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .placeholder-sub {
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  @media (max-width: 900px) {
    .card-hand-container {
      padding: 8px 10px;
    }

    .hand-header {
      margin-bottom: 6px;
      padding-bottom: 4px;
    }

    .draw-deck-btn {
      padding: 10px 12px;
      gap: 12px;
    }

    .deck-visual {
      width: 44px;
      height: 58px;
    }

    .deck-cta {
      font-size: 0.9rem;
    }

    .deck-sub {
      font-size: 0.72rem;
    }

    .active-card-dock {
      gap: 10px;
    }

    .inspect-link {
      display: none;
    }

    .active-effect-summary {
      padding: 6px 8px;
    }

    .effect-card-desc {
      font-size: 0.68rem;
    }

    .choice-btn {
      padding: 5px 8px;
    }

    .choice-name {
      font-size: 0.75rem;
    }

    .choice-detail {
      font-size: 0.64rem;
    }
  }
</style>
