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

  function getCardSymbol(card: CardModel): string {
    if (card.value !== null && card.value !== undefined) {
      return card.value.toString();
    }
    if (card.id.includes('reverse')) return 'SWAP';
    if (card.id.includes('skip')) return 'SKIP';
    if (card.id.includes('draw-two')) return '+2';
    if (card.id.includes('wild-draw-four')) return 'W+4';
    if (card.id.includes('wild')) return 'WILD';
    return 'ACT';
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
      <span class="corner-index">{getCardSymbol(card)}</span>
    </div>

    <div class="card-center">
      <div class="center-emblem" class:text-emblem={getCardSymbol(card).length > 2}>
        {getCardSymbol(card)}
      </div>
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
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
  }

  .card-wrapper.elevate:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }

  .card-wrapper.selected {
    box-shadow: 0 0 0 2px var(--accent-gold), var(--shadow-card);
  }

  .card-wrapper:not(.playable) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Category themes */
  .number-card {
    background-color: var(--card-num-bg);
    border: 1.5px solid var(--card-num-border);
  }

  .action-card {
    background-color: var(--card-act-bg);
    border: 1.5px solid var(--card-act-border);
  }

  .wild-card {
    background-color: var(--card-wild-bg);
    border: 1.5px solid var(--card-wild-border);
  }

  .card-inner {
    border-radius: 7px;
    padding: 10px 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.22) 100%);
  }

  /* Sizes */
  .sm {
    width: 104px;
    height: 144px;
  }
  .sm .center-emblem { font-size: 1.5rem; }
  .sm .card-title { font-size: 0.75rem; }
  .sm .description { display: none; }

  .md {
    width: 136px;
    height: 184px;
  }
  .md .center-emblem { font-size: 2.1rem; }
  .md .center-emblem.text-emblem { font-size: 1.35rem; letter-spacing: 0.04em; }
  .md .card-title { font-size: 0.85rem; }
  .md .description { font-size: 0.68rem; }

  .lg {
    width: 190px;
    height: 260px;
  }
  .lg .center-emblem { font-size: 3rem; }
  .lg .center-emblem.text-emblem { font-size: 1.9rem; }
  .lg .card-title { font-size: 1.05rem; }
  .lg .description { font-size: 0.8rem; }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .category-pill {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 2px 5px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.88);
    font-family: var(--font-mono);
  }

  .corner-index {
    font-size: 0.72rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.9);
    font-family: var(--font-mono);
  }

  .card-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin: 4px 0;
  }

  .center-emblem {
    font-weight: 800;
    color: #ffffff;
    line-height: 1.05;
    font-family: var(--font-mono);
  }

  .card-title {
    font-weight: 700;
    color: #ffffff;
    margin-top: 4px;
    letter-spacing: -0.01em;
  }

  .card-footer {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 4px;
    padding: 5px 6px;
    margin-top: auto;
  }

  .description {
    color: #e5e7eb;
    line-height: 1.22;
    text-align: center;
  }

  @media (max-width: 900px) {
    .md {
      width: 112px;
      height: 136px;
    }
    .md .card-inner {
      padding: 7px 8px;
    }
    .md .center-emblem {
      font-size: 1.55rem;
    }
    .md .center-emblem.text-emblem {
      font-size: 1.05rem;
    }
    .md .card-title {
      font-size: 0.74rem;
      margin-top: 2px;
    }
    .md .card-footer {
      padding: 4px 5px;
    }
    .md .description {
      font-size: 0.6rem;
      line-height: 1.15;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
</style>
