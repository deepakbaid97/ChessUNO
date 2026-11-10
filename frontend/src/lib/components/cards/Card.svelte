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

  function getTechCode(card: CardModel): string {
    if (card.value !== null && card.value !== undefined) {
      return `[MOV: ${card.value}]`;
    }
    if (card.id.includes('reverse')) return '[REVERSE]';
    if (card.id.includes('skip')) return '[INITIATIVE]';
    if (card.id.includes('draw-two')) return '[REVIVE 2]';
    if (card.id.includes('wild-draw-four')) return '[WILD +4]';
    if (card.id.includes('wild')) return '[CHOICE]';
    return `[${card.effectKey}]`;
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
      <span class="tech-tag">{getTechCode(card)}</span>
    </div>

    <div class="card-footer">
      <p class="description">{card.description}</p>
    </div>
  </div>
</div>

<style>
  .card-wrapper {
    position: relative;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
    background-color: var(--bg-elevated);
  }

  .card-wrapper.elevate:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card);
  }

  .card-wrapper.selected {
    box-shadow: 0 0 0 2px var(--accent-gold), var(--shadow-card);
  }

  .card-wrapper:not(.playable) {
    opacity: 0.5;
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
    border-radius: 5px;
    padding: 8px 10px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* Sizes */
  .sm {
    width: 96px;
    height: 134px;
  }
  .sm .center-emblem { font-size: 1.35rem; }
  .sm .card-title { font-size: 0.72rem; }
  .sm .description { display: none; }

  .md {
    width: 124px;
    height: 172px;
  }
  .md .center-emblem { font-size: 1.85rem; }
  .md .center-emblem.text-emblem { font-size: 1.2rem; letter-spacing: 0.04em; }
  .md .card-title { font-size: 0.8rem; }
  .md .description { font-size: 0.65rem; }

  .lg {
    width: 184px;
    height: 256px;
  }
  .lg .center-emblem { font-size: 2.8rem; }
  .lg .center-emblem.text-emblem { font-size: 1.8rem; }
  .lg .card-title { font-size: 1.05rem; }
  .lg .description { font-size: 0.78rem; }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .category-pill {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 1px 4px;
    border-radius: 2px;
    background-color: rgba(11, 14, 21, 0.65);
    color: var(--accent-gold-bright);
    font-family: var(--font-mono);
  }

  .corner-index {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .card-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    margin: 2px 0;
  }

  .center-emblem {
    font-weight: 700;
    color: var(--accent-gold-bright);
    line-height: 1.05;
    font-family: var(--font-headline);
  }

  .number-card .center-emblem {
    color: #93c5fd;
  }

  .wild-card .center-emblem {
    color: #d8b4fe;
  }

  .card-title {
    font-family: var(--font-headline);
    font-weight: 700;
    color: var(--text-main);
    margin-top: 3px;
    letter-spacing: 0.01em;
  }

  .tech-tag {
    font-family: var(--font-mono);
    font-size: 0.56rem;
    color: var(--accent-green);
    margin-top: 1px;
  }

  .card-footer {
    background-color: rgba(11, 14, 21, 0.55);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    padding: 4px 5px;
    margin-top: auto;
  }

  .description {
    color: var(--text-muted);
    line-height: 1.2;
    text-align: center;
  }

  @media (max-width: 900px) {
    .md {
      width: 96px;
      height: 124px;
    }
    .md .card-inner {
      padding: 6px 7px;
    }
    .md .center-emblem {
      font-size: 1.35rem;
    }
    .md .center-emblem.text-emblem {
      font-size: 0.95rem;
    }
    .md .card-title {
      font-size: 0.68rem;
      margin-top: 1px;
    }
    .md .tech-tag {
      font-size: 0.5rem;
    }
    .md .card-footer {
      padding: 3px 4px;
    }
    .md .description {
      font-size: 0.54rem;
      line-height: 1.12;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
</style>
