<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CardModel } from '../../types/game';
  import Card from './Card.svelte';

  export let card: CardModel | null = null;
  export let isOpen: boolean = false;
  export let isPlayable: boolean = true;
  export let playButtonText: string = 'Use Ability';

  const dispatch = createEventDispatcher<{
    close: void;
    confirmPlay: { card: CardModel };
  }>();

  function handlePlay() {
    if (card && isPlayable) {
      dispatch('confirmPlay', { card });
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

{#if isOpen && card}
  <div
    class="details-backdrop"
    on:click|self={() => dispatch('close')}
    on:keydown={handleKeyDown}
    tabindex="-1"
    role="presentation"
  >
    <div class="details-modal" role="dialog" aria-modal="true" aria-label="Card Details: {card.name}">
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">✕</button>

      <div class="card-preview">
        <Card {card} size="lg" elevation={false} />
      </div>

      <div class="details-body">
        <h2>{card.name}</h2>
        <span class="category-badge">{card.category} CARD</span>

        <div class="detail-section">
          <h4>Effect Overview</h4>
          <p>{card.description}</p>
        </div>

        <div class="detail-section">
          <h4>Effect Key</h4>
          <code>{card.effectKey}</code>
        </div>

        {#if card.category === 'NUMBER'}
          <div class="detail-section">
            <h4>Usage</h4>
            <p>Grants up to <strong>{card.value}</strong> standard chess moves. The same piece may move consecutively.</p>
          </div>
        {:else if card.id.includes('reverse')}
          <div class="detail-section">
            <h4>Usage</h4>
            <p>Select two friendly pieces on the board to swap their positions (Kings excluded).</p>
          </div>
        {:else if card.id.includes('draw-two')}
          <div class="detail-section">
            <h4>Usage</h4>
            <p>Revives up to 2 captured friendly pieces to empty squares on your half of the board.</p>
          </div>
        {:else if card.id.includes('skip')}
          <div class="detail-section">
            <h4>Usage</h4>
            <p>Opponent is skipped. You retain initiative and draw another turn card immediately.</p>
          </div>
        {/if}

        <div class="modal-actions">
          <button class="btn btn-secondary" on:click={() => dispatch('close')}>Close</button>
          {#if isPlayable}
            <button class="btn btn-gold" on:click={handlePlay}>{playButtonText}</button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .details-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(11, 15, 23, 0.85);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  .details-modal {
    position: relative;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 32px;
    max-width: 640px;
    width: 90%;
    display: flex;
    gap: 28px;
    box-shadow: var(--shadow-card);
  }

  @media (max-width: 640px) {
    .details-modal {
      flex-direction: column;
      align-items: center;
      padding: 24px;
      gap: 16px;
    }
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: #fff;
    background: var(--bg-card);
  }

  .card-preview {
    flex-shrink: 0;
  }

  .details-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h2 {
    font-size: 1.5rem;
    color: #fff;
    margin-bottom: 2px;
  }

  .category-badge {
    align-self: flex-start;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-card);
    color: var(--accent-gold);
    border: 1px solid var(--border-color);
  }

  .detail-section h4 {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .detail-section p {
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--text-main);
  }

  .detail-section code {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    background: #0f172a;
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--accent-blue);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: auto;
    padding-top: 16px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

