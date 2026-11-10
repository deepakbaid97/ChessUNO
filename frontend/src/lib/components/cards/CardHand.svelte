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
            <span class="deck-badge">DECK</span>
            <span class="deck-num">#{remainingDeckCount}</span>
          </div>
          <div class="deck-copy">
            <span class="deck-cta">Draw Turn Card</span>
            <span class="deck-sub">Tap to draw 1 card from the authoritative deck ({remainingDeckCount} left)</span>
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
        </div>

        <div class="controls-column">
          {#if isMyTurn && turnPhase === 'AwaitingChoice' && availableChoices.length > 0}
            <div class="choices-container" data-testid="choices-container">
              <div class="choices-title">SELECT TACTICAL ABILITY:</div>
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
              <div class="telemetry-pills">
                {#if remainingMoves > 0}
                  <span class="action-pill moves-pill">MOVES LEFT: {remainingMoves}</span>
                {/if}
                {#if remainingRevivals > 0}
                  <span class="action-pill revivals-pill">REVIVALS LEFT: {remainingRevivals}</span>
                {/if}
                {#if canSwap}
                  <span class="action-pill swap-pill">SWAP READY</span>
                {/if}
              </div>

              {#if canSwap}
                <button
                  class="btn btn-gold swap-action-btn"
                  on:click={() => dispatch('activateSwap')}
                  data-testid="btn-activate-swap"
                >
                  Select Pieces to Swap
                </button>
              {/if}

              {#if remainingRevivals > 0}
                <button
                  class="btn btn-primary revival-action-btn"
                  on:click={() => dispatch('activateRevival')}
                  data-testid="btn-activate-revival"
                >
                  Revive Piece ({remainingRevivals})
                </button>
              {/if}

              <div class="dock-bottom-row">
                <span class="deck-counter">DRAW DECK: {remainingDeckCount} LEFT</span>
                <button
                  class="pass-turn-link"
                  on:click={() => dispatch('endTurn')}
                  data-testid="btn-end-turn"
                >
                  Pass / End Turn ›
                </button>
              </div>
            </div>
          {:else}
            <div class="opponent-card-status">
              <span class="status-tag">OPPONENT TURN CARD</span>
              <p class="status-desc">{activeCard.description}</p>
              <span class="deck-counter">DRAW DECK: {remainingDeckCount} LEFT</span>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="empty-hand">
        <div class="card-placeholder">
          <span class="placeholder-title">{isMyTurn ? 'READY TO DRAW' : 'OPPONENT TURN'}</span>
          <span class="placeholder-sub">
            {isMyTurn ? 'Draw a card to start your turn.' : `Waiting for opponent • Deck: ${remainingDeckCount} left`}
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
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    padding: 10px 12px;
    border-radius: 4px;
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
    gap: 14px;
    padding: 10px 14px;
    border-radius: 4px;
    background-color: var(--bg-elevated);
    border: 1.5px solid var(--accent-gold);
    box-shadow: 0 0 0 2px var(--accent-gold-glow);
    cursor: pointer;
    text-align: left;
    color: var(--text-main);
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .draw-deck-btn:hover:not(:disabled) {
    background-color: var(--bg-card-hover);
  }

  .draw-deck-btn:active:not(:disabled) {
    transform: scale(0.99);
  }

  .draw-deck-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .deck-visual {
    position: relative;
    width: 52px;
    height: 70px;
    border-radius: 4px;
    background-color: var(--bg-lowest);
    border: 1.5px solid var(--accent-gold);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .deck-card-layer {
    position: absolute;
    inset: 3px;
    border-radius: 2px;
    border: 1px dashed rgba(245, 158, 11, 0.4);
  }

  .deck-badge {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--accent-gold-bright);
  }

  .deck-num {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    color: var(--text-muted);
  }

  .deck-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .deck-cta {
    font-family: var(--font-headline);
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--accent-gold-bright);
  }

  .deck-sub {
    font-size: 0.76rem;
    color: var(--text-muted);
    line-height: 1.25;
  }

  /* Active Card Dock (Side-by-side Card + Controls) */
  .active-card-dock {
    display: flex;
    align-items: stretch;
    gap: 12px;
    width: 100%;
  }

  .card-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .controls-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }

  /* Wild Card Choices */
  .choices-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .choices-title {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--accent-gold-bright);
  }

  .choices-buttons {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .choice-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 6px 10px;
    border-radius: 4px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-strong);
    color: var(--text-main);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .choice-btn:hover {
    border-color: var(--accent-gold);
    background-color: var(--bg-elevated);
  }

  .choice-name {
    font-family: var(--font-headline);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .choice-detail {
    font-size: 0.66rem;
    color: var(--text-muted);
  }

  /* Action Phase Controls */
  .action-buttons-group {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    height: 100%;
  }

  .telemetry-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .action-pill {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 3px;
  }

  .moves-pill {
    background-color: rgba(59, 130, 246, 0.15);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.35);
  }

  .revivals-pill {
    background-color: rgba(78, 222, 163, 0.15);
    color: var(--accent-green);
    border: 1px solid rgba(78, 222, 163, 0.35);
  }

  .swap-pill {
    background-color: rgba(245, 158, 11, 0.15);
    color: var(--accent-gold-bright);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .swap-action-btn,
  .revival-action-btn {
    width: 100%;
    font-size: 0.82rem;
    padding: 9px 12px;
  }

  .dock-bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 4px;
    border-top: 1px solid var(--border-subtle);
    margin-top: auto;
  }

  .deck-counter {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--text-dim);
    letter-spacing: 0.04em;
  }

  .pass-turn-link {
    background: none;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    padding: 4px 10px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .pass-turn-link:hover {
    color: var(--accent-gold-bright);
    border-color: var(--accent-gold);
  }

  .opponent-card-status {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    height: 100%;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px 10px;
  }

  .status-tag {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--accent-gold-bright);
  }

  .status-desc {
    font-size: 0.74rem;
    color: var(--text-main);
    line-height: 1.3;
  }

  /* Empty state */
  .empty-hand {
    width: 100%;
  }

  .card-placeholder {
    width: 100%;
    padding: 12px;
    border-radius: 4px;
    border: 1px dashed var(--border-color);
    background-color: var(--bg-lowest);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 3px;
  }

  .placeholder-title {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .placeholder-sub {
    font-size: 0.72rem;
    color: var(--text-dim);
  }

  @media (max-width: 900px) {
    .card-hand-container {
      padding: 6px 8px;
    }

    .draw-deck-btn {
      padding: 8px 10px;
      gap: 10px;
    }

    .deck-visual {
      width: 44px;
      height: 56px;
    }

    .deck-cta {
      font-size: 0.88rem;
    }

    .deck-sub {
      font-size: 0.7rem;
    }

    .active-card-dock {
      gap: 10px;
    }

    .choice-btn {
      padding: 4px 8px;
    }

    .choice-name {
      font-size: 0.74rem;
    }

    .choice-detail {
      font-size: 0.62rem;
    }
  }
</style>
