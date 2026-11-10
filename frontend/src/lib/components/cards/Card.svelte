<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CardModel } from '../../types/game';

  export let card: CardModel;
  export let isSelected: boolean = false;
  export let isPlayable: boolean = true;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let elevation: boolean = true;

  const dispatch = createEventDispatcher<{
    select: { card: CardModel };
  }>();

  function handleClick() {
    dispatch('select', { card });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  $: category = card.category.toUpperCase();
  $: isNumber = category === 'NUMBER';
  $: isAction = category === 'ACTION';
  $: isWild = category === 'WILD';

  function getCardIcon(card: CardModel): string {
    if (card.value !== null && card.value !== undefined) {
      return card.value.toString();
    }
    if (card.id.includes('reverse')) return '⇄';
    if (card.id.includes('skip')) return '⊘';
    if (card.id.includes('draw-two')) return '+2';
    if (card.id.includes('wild-draw-four')) return '+4';
    if (card.id.includes('wild')) return '★';
    return '♠';
  }
</script>

<div
  class="card-wrapper {size}"
  class:selected={isSelected}
  class:playable={isPlayable}
  class:number-card={isNumber}
  class:action-card={isAction}
  class:wild-card={isWild}
  class:elevate={elevation}
  on:click={handleClick}
  on:keydown={handleKeyDown}
  tabindex="0"
  role="button"
  aria-label="{card.name}: {card.description}"
  data-testid="card-{card.id}"
>
  <div class="card-inner">
    <div class="card-header">
      <span class="category-pill">{category}</span>
      <span class="value-badge">{getCardIcon(card)}</span>
    </div>

    <div class="card-center">
      <div class="center-symbol">{getCardIcon(card)}</div>
      <div class="card-title">{card.name}</div>
    </div>

    <div class="card-footer">
      <p class="description">{card.description}</p>
    </div>
  </div>
</div>

<style>
  .card-wrapper {
    position: relative;
    border-radius: 12px;
    padding: 2px;
    cursor: pointer;
    user-select: none;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, filter 0.2s ease;
    box-shadow: var(--shadow-md);
  }

  .card-wrapper.elevate:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: var(--shadow-card);
  }

  .card-wrapper.selected {
    transform: translateY(-12px) scale(1.04);
    box-shadow: 0 0 0 3px var(--accent-gold), var(--shadow-card);
  }

  .card-wrapper:not(.playable) {
    opacity: 0.6;
    filter: grayscale(0.4);
    cursor: not-allowed;
  }

  /* Category themes */
  .number-card {
    background: var(--card-num-bg);
    border: 1px solid var(--card-num-border);
  }

  .action-card {
    background: var(--card-act-bg);
    border: 1px solid var(--card-act-border);
  }

  .wild-card {
    background: var(--card-wild-bg);
    border: 1px solid var(--card-wild-border);
  }

  .card-inner {
    border-radius: 10px;
    padding: 12px 14px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.12) 0%, rgba(0, 0, 0, 0.3) 100%);
  }

  /* Sizes */
  .sm {
    width: 120px;
    height: 168px;
  }
  .sm .center-symbol { font-size: 2rem; }
  .sm .card-title { font-size: 0.8rem; }
  .sm .description { display: none; }

  .md {
    width: 154px;
    height: 220px;
  }
  .md .center-symbol { font-size: 2.8rem; }
  .md .card-title { font-size: 0.95rem; }
  .md .description { font-size: 0.72rem; }

  .lg {
    width: 220px;
    height: 310px;
  }
  .lg .center-symbol { font-size: 4rem; }
  .lg .card-title { font-size: 1.2rem; }
  .lg .description { font-size: 0.85rem; }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .category-pill {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.4);
    color: #fff;
  }

  .value-badge {
    font-size: 0.85rem;
    font-weight: 900;
    color: #fff;
  }

  .card-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin: 8px 0;
  }

  .center-symbol {
    font-weight: 900;
    color: #fff;
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  }

  .card-title {
    font-weight: 800;
    color: #fff;
    margin-top: 6px;
    letter-spacing: -0.01em;
  }

  .card-footer {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 6px;
    padding: 6px 8px;
    margin-top: auto;
  }

  .description {
    color: #e2e8f0;
    line-height: 1.25;
    text-align: center;
  }
</style>

