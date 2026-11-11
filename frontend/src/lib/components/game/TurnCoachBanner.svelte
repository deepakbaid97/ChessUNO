<script lang="ts">
  import type { CoachGuide } from '../../utils/coachGuide';

  export let coachGuide: CoachGuide;
  export let inCheck: boolean = false;
  export let isGameOver: boolean = false;
  export let activeCardName: string | undefined = undefined;
</script>

<section
  class="coach-banner tone-{coachGuide.tone}"
  data-testid="turn-coach"
  aria-live="polite"
>
  <div class="coach-top">
    <span class="coach-badge">
      <span class="badge-dot"></span>
      {coachGuide.badge}
    </span>
    {#if inCheck && !isGameOver}
      <span class="check-alert">KING IN CHECK</span>
    {:else if activeCardName}
      <span class="card-mod-tag">[CARD MOD: {activeCardName.toUpperCase()}]</span>
    {/if}
  </div>
  <h2 class="coach-headline">{coachGuide.headline}</h2>
  <p class="coach-instruction">{coachGuide.instruction}</p>
</section>

<style>
  .coach-banner {
    padding: 12px 14px;
    border-radius: 8px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-strong);
    border-left: 4px solid var(--border-strong);
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .coach-banner.tone-your-turn {
    border-color: rgba(245, 158, 11, 0.45);
    border-left-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.07);
  }

  .coach-banner.tone-ability {
    border-color: rgba(16, 185, 129, 0.45);
    border-left-color: var(--accent-green);
    background-color: rgba(16, 185, 129, 0.08);
  }

  .coach-banner.tone-check {
    border-color: rgba(239, 68, 68, 0.55);
    border-left-color: var(--accent-red);
    background-color: rgba(239, 68, 68, 0.1);
  }

  .coach-banner.tone-opponent-turn {
    border-color: var(--border-color);
    border-left-color: var(--text-dim);
    background-color: var(--bg-surface);
  }

  .coach-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .coach-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    padding: 2px 7px;
    border-radius: 3px;
    background-color: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border-color);
    color: var(--text-muted);
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .tone-your-turn .coach-badge {
    color: var(--accent-gold-bright);
    background-color: rgba(245, 158, 11, 0.16);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .tone-ability .coach-badge {
    color: var(--accent-green);
    background-color: rgba(78, 222, 163, 0.15);
    border-color: rgba(78, 222, 163, 0.35);
  }

  .tone-check .coach-badge {
    color: #fca5a5;
    background-color: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.45);
  }

  .card-mod-tag {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .check-alert {
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 2px 6px;
    border-radius: 3px;
    background-color: var(--accent-red);
    color: #ffffff;
    font-family: var(--font-mono);
  }

  .coach-headline {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.25;
  }

  .coach-instruction {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.35;
  }
</style>
