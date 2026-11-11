<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { animate, spring } from 'motion';
  import { cardRevealStore, cardAnimationService } from '../../services/cardAnimationService';
  import type { CardRevealState, CardEffectConfig } from '../../types/animation';
  import {
    prefersReducedMotion,
    getCardSymbol,
    getTechCode,
    generateParticles,
    type ParticleDef
  } from '../../utils/cardDisplayUtils';

  let overlayEl: HTMLDivElement | null = null;
  let cardContainerEl: HTMLDivElement | null = null;
  let cardFlipperEl: HTMLDivElement | null = null;
  let shockwaveEl: HTMLDivElement | null = null;
  let bloomFlashEl: HTMLDivElement | null = null;
  let particlesContainerEl: HTMLDivElement | null = null;
  let emblemEl: HTMLDivElement | null = null;
  let titleEl: HTMLDivElement | null = null;

  let activeAnimations: any[] = [];
  let isAnimating = false;
  let currentSequenceId = 0;
  let lastHandledSequenceId = -1;

  let particles: ParticleDef[] = [];

  $: state = $cardRevealStore;
  $: card = state.card;
  $: effectConfig = state.effectConfig;
  $: cardCategory = ((card?.category || (card as any)?.type || 'ACTION') as string).toUpperCase();

  function stopAllAnimations() {
    for (const a of activeAnimations) {
      try {
        a?.stop?.();
      } catch {}
    }
    activeAnimations = [];
    isAnimating = false;
  }

  async function runCinematicSequence(revealState: CardRevealState) {
    if (!revealState.isActive || !revealState.card) return;

    // Interrupt/stop any previous sequence to avoid deadlocks
    stopAllAnimations();

    const seqId = ++currentSequenceId;
    isAnimating = true;

    if (prefersReducedMotion()) {
      cardAnimationService.dismiss();
      isAnimating = false;
      return;
    }

    particles = generateParticles(revealState.effectConfig);

    // Wait for Svelte DOM tick and ensure elements are mounted
    await tick();
    if (seqId !== currentSequenceId) return;

    if (!cardContainerEl || !cardFlipperEl) {
      await new Promise(r => requestAnimationFrame(r));
    }
    if (seqId !== currentSequenceId) return;

    if (!cardContainerEl || !cardFlipperEl) {
      cardAnimationService.dismiss();
      isAnimating = false;
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = vw / 2;
    const centerY = vh / 2;

    // Determine launch (source) position
    const src = revealState.sourceRect;
    const startX = src ? (src.x + src.width / 2) - centerX : (revealState.isLocalPlayer ? 0 : 0);
    const startY = src ? (src.y + src.height / 2) - centerY : (revealState.isLocalPlayer ? vh * 0.35 : -vh * 0.35);

    // Determine dock (target) position
    const tgt = revealState.targetRect;
    const endX = tgt ? (tgt.x + tgt.width / 2) - centerX : startX;
    const endY = tgt ? (tgt.y + tgt.height / 2) - centerY : startY;

    try {
      // ----------------------------------------------------
      // PHASE 1: Anticipation (0 - 0.22s)
      // ----------------------------------------------------
      cardAnimationService.setPhase('anticipation');

      // Place container at launch position
      cardContainerEl.style.transform = `translate3d(${startX}px, ${startY}px, 0px) scale(0.65)`;
      cardContainerEl.style.opacity = '1';
      cardFlipperEl.style.transform = 'rotateY(180deg) rotateX(10deg)';

      const anim1 = animate(
        cardContainerEl,
        {
          transform: [
            `translate3d(${startX}px, ${startY}px, 0px) scale(0.65) rotate(0deg)`,
            `translate3d(${startX - 2}px, ${startY + 3}px, 0px) scale(0.6) rotate(-2deg)`,
            `translate3d(${startX + 2}px, ${startY - 2}px, 0px) scale(0.62) rotate(2deg)`,
            `translate3d(${startX}px, ${startY}px, 0px) scale(0.64) rotate(0deg)`
          ]
        },
        { duration: 0.22, easing: 'ease-in-out' }
      );
      activeAnimations.push(anim1);
      await anim1;

      // ----------------------------------------------------
      // PHASE 2: Card Launch towards Center (0.22s - 0.62s)
      // ----------------------------------------------------
      cardAnimationService.setPhase('launch');

      const anim2a = animate(
        cardContainerEl,
        {
          transform: [
            `translate3d(${startX}px, ${startY}px, 0px) scale(0.64)`,
            `translate3d(${startX * 0.4}px, ${startY * 0.3 - 30}px, 0px) scale(1.6)`,
            `translate3d(0px, 0px, 0px) scale(2.3)`
          ]
        },
        { duration: 0.38, easing: [0.16, 1, 0.3, 1] }
      );

      const anim2b = animate(
        cardFlipperEl,
        {
          transform: [
            'rotateY(180deg) rotateX(10deg)',
            'rotateY(110deg) rotateX(4deg)',
            'rotateY(80deg) rotateX(0deg)'
          ]
        },
        { duration: 0.38, easing: 'ease-in' }
      );

      activeAnimations.push(anim2a, anim2b);
      await Promise.all([anim2a, anim2b]);

      // ----------------------------------------------------
      // PHASE 3: Card Reveal Flip & Spring Bounce (0.62s - 1.02s)
      // ----------------------------------------------------
      cardAnimationService.setPhase('reveal');

      const anim3a = animate(
        cardFlipperEl,
        {
          transform: ['rotateY(80deg)', 'rotateY(-10deg)', 'rotateY(0deg)']
        },
        { duration: 0.36, easing: [0.34, 1.56, 0.64, 1] }
      );

      const anim3b = animate(
        cardContainerEl,
        {
          transform: ['translate3d(0px, 0px, 0px) scale(2.3)', 'translate3d(0px, 0px, 0px) scale(2.55)', 'translate3d(0px, 0px, 0px) scale(2.45)']
        },
        { duration: 0.36, easing: [0.34, 1.56, 0.64, 1] }
      );

      activeAnimations.push(anim3a, anim3b);
      await Promise.all([anim3a, anim3b]);

      // ----------------------------------------------------
      // PHASE 4: Celebration (Shockwave, Particles, Emblem Pop) (1.02s - 1.38s)
      // ----------------------------------------------------
      cardAnimationService.setPhase('celebration');

      const celebrationPromises: Promise<any>[] = [];

      // Shockwave ring expansion
      if (shockwaveEl) {
        shockwaveEl.style.opacity = '1';
        const shockAnim = animate(
          shockwaveEl,
          {
            transform: ['translate3d(-50%, -50%, 0) scale(0.35)', 'translate3d(-50%, -50%, 0) scale(2.8)'],
            opacity: [1, 0]
          },
          { duration: 0.42, easing: [0.1, 0.8, 0.3, 1] }
        );
        celebrationPromises.push(shockAnim);
        activeAnimations.push(shockAnim);
      }

      // Bloom backlight flash
      if (bloomFlashEl) {
        bloomFlashEl.style.opacity = '0.9';
        const bloomAnim = animate(
          bloomFlashEl,
          {
            transform: ['translate3d(-50%, -50%, 0) scale(0.7)', 'translate3d(-50%, -50%, 0) scale(1.8)'],
            opacity: [0.9, 0]
          },
          { duration: 0.42, easing: 'ease-out' }
        );
        celebrationPromises.push(bloomAnim);
        activeAnimations.push(bloomAnim);
      }

      // Particle explosion
      if (particlesContainerEl) {
        const particleEls = particlesContainerEl.querySelectorAll<HTMLDivElement>('.particle');
        particleEls.forEach((pEl, i) => {
          const p = particles[i];
          if (!p) return;
          const targetX = Math.cos(p.angle) * p.distance;
          const targetY = Math.sin(p.angle) * p.distance;

          const pAnim = animate(
            pEl,
            {
              transform: [
                'translate3d(0px, 0px, 0px) scale(1)',
                `translate3d(${targetX * 0.6}px, ${targetY * 0.6}px, 0px) scale(1.3)`,
                `translate3d(${targetX}px, ${targetY}px, 0px) scale(0)`
              ],
              opacity: [1, 1, 0]
            },
            { duration: 0.42, easing: [0.16, 1, 0.3, 1] }
          );
          celebrationPromises.push(pAnim);
          activeAnimations.push(pAnim);
        });
      }

      // Emblem & Title bounce
      if (emblemEl) {
        const emblemAnim = animate(
          emblemEl,
          {
            transform: ['scale(0.8)', 'scale(1.28)', 'scale(1)']
          },
          { duration: 0.34, easing: [0.34, 1.56, 0.64, 1] }
        );
        celebrationPromises.push(emblemAnim);
        activeAnimations.push(emblemAnim);
      }

      await Promise.all(celebrationPromises);

      // Brief hold to absorb the triumph (~80ms)
      await new Promise(r => setTimeout(r, 80));

      // ----------------------------------------------------
      // PHASE 5: Return to Dock (1.46s - 1.76s)
      // ----------------------------------------------------
      cardAnimationService.setPhase('return');

      const anim5 = animate(
        cardContainerEl,
        {
          transform: [
            'translate3d(0px, 0px, 0px) scale(2.45)',
            `translate3d(${endX * 0.4}px, ${endY * 0.4}px, 0px) scale(1.6)`,
            `translate3d(${endX}px, ${endY}px, 0px) scale(1.0)`
          ],
          opacity: [1, 1, 0]
        },
        { duration: 0.34, easing: [0.3, 0, 0.8, 0.15] }
      );

      activeAnimations.push(anim5);
      await anim5;

      if (seqId !== currentSequenceId) return;

      // Completion
      cardAnimationService.setPhase('complete');
    } catch (err) {
      if (seqId === currentSequenceId) {
        console.warn('[CardRevealOverlay] Animation sequence interrupted:', err);
        cardAnimationService.dismiss();
      }
    } finally {
      if (seqId === currentSequenceId) {
        stopAllAnimations();
      }
    }
  }

  function handleSkip() {
    currentSequenceId++;
    stopAllAnimations();
    cardAnimationService.dismiss();
  }

  // Trigger sequence whenever reveal becomes active and new card/sequence appears
  $: if (state.isActive && state.card) {
    if (state.sequenceId !== lastHandledSequenceId) {
      lastHandledSequenceId = state.sequenceId;
      runCinematicSequence(state);
    }
  }

  onDestroy(() => {
    currentSequenceId++;
    stopAllAnimations();
    cardAnimationService.dismiss();
  });
</script>

{#if state.isActive && card}
  <button
    type="button"
    class="reveal-overlay"
    bind:this={overlayEl}
    on:click={handleSkip}
    aria-label="Cinematic Card Reveal: {card.name}. Tap to skip."
    data-testid="card-reveal-overlay"
  >
    <!-- Darkened backdrop with spotlight -->
    <div class="overlay-backdrop"></div>

    <!-- Light bloom flash (Phase 4) -->
    <div
      class="bloom-flash"
      bind:this={bloomFlashEl}
      style="--flash-color: {effectConfig?.flashColor || 'rgba(245, 158, 11, 0.5)'};"
    ></div>

    <!-- Expanding SVG shockwave (Phase 4) -->
    <div
      class="shockwave-ring"
      bind:this={shockwaveEl}
      style="--shockwave-color: {effectConfig?.shockwaveColor || '#f59e0b'};"
    ></div>

    <!-- Particle burst system (Phase 4) -->
    <div class="particles-origin" bind:this={particlesContainerEl}>
      {#each particles as p (p.id)}
        <div
          class="particle"
          class:star-particle={p.isStar}
          style="
            --p-color: {p.color};
            --p-size: {p.size}px;
          "
        ></div>
      {/each}
    </div>

    <!-- Floating 3D Card Object -->
    <div class="card-3d-stage" bind:this={cardContainerEl} data-testid="revealed-card-container">
      <div class="card-flip-flipper" bind:this={cardFlipperEl}>
        <!-- Card Back (Face Down during anticipation & launch) -->
        <div class="card-face card-back">
          <div class="back-inner">
            <div class="back-corner top-left">CHESS</div>
            <div class="back-corner bottom-right">UNO</div>
            <div class="back-emblem">
              <span class="back-icon">♟</span>
              <span class="back-title">UNO</span>
            </div>
            <div class="back-border-glow"></div>
          </div>
        </div>

        <!-- Card Front (Revealed Face Up) -->
        <div
          class="card-face card-front"
          class:number-card={cardCategory === 'NUMBER'}
          class:action-card={cardCategory === 'ACTION'}
          class:wild-card={cardCategory === 'WILD'}
          style="--accent-border: {effectConfig?.accentColor || '#f59e0b'}; --accent-glow: {effectConfig?.glowColor || 'rgba(245, 158, 11, 0.4)'};"
        >
          <div class="card-inner">
            <div class="card-header">
              <span class="category-pill">{cardCategory}</span>
              <span class="corner-index">{getCardSymbol(card)}</span>
            </div>

            <div class="card-center">
              <div
                class="center-emblem"
                class:text-emblem={getCardSymbol(card).length > 2}
                bind:this={emblemEl}
              >
                {getCardSymbol(card)}
              </div>
              <div class="card-title" bind:this={titleEl}>{card.name}</div>
              <span class="tech-tag">{getTechCode(card)}</span>
            </div>

            <div class="card-footer">
              <p class="description">{card.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </button>
{/if}

<style>
  .reveal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    pointer-events: none;
    perspective: 1200px;
    overflow: hidden;
  }

  .overlay-backdrop {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(11, 14, 21, 0.55) 0%, rgba(11, 14, 21, 0.86) 80%);
    pointer-events: none;
    animation: backdropIn 0.25s ease-out;
  }

  @keyframes backdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bloom-flash {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--flash-color) 0%, transparent 70%);
    pointer-events: none;
    opacity: 0;
    transform: translate3d(-50%, -50%, 0);
  }

  .shockwave-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    border: 3.5px solid var(--shockwave-color);
    box-shadow: 0 0 20px var(--shockwave-color);
    pointer-events: none;
    opacity: 0;
    transform: translate3d(-50%, -50%, 0);
  }

  .particles-origin {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--p-size);
    height: var(--p-size);
    border-radius: 50%;
    background-color: var(--p-color);
    box-shadow: 0 0 10px var(--p-color);
    pointer-events: none;
    opacity: 0;
  }

  .particle.star-particle {
    border-radius: 1px;
    transform: rotate(45deg);
  }

  /* 3D Stage & Card Container */
  .card-3d-stage {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120px;
    height: 168px;
    margin-left: -60px;
    margin-top: -84px;
    transform-style: preserve-3d;
    pointer-events: auto;
    cursor: pointer;
    will-change: transform, opacity;
  }

  .card-flip-flipper {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    will-change: transform;
  }

  .card-face {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8), 0 0 24px var(--accent-glow, rgba(245, 158, 11, 0.3));
    overflow: hidden;
  }

  /* Card Back */
  .card-back {
    background: linear-gradient(135deg, #181b22 0%, #0d0f14 100%);
    border: 2px solid var(--accent-gold);
    transform: rotateY(180deg);
  }

  .back-inner {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
  }

  .back-corner {
    position: absolute;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--accent-gold-bright);
  }

  .back-corner.top-left {
    top: 6px;
    left: 6px;
  }

  .back-corner.bottom-right {
    bottom: 6px;
    right: 6px;
  }

  .back-emblem {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .back-icon {
    font-size: 2.2rem;
    color: var(--accent-gold);
    text-shadow: 0 0 12px var(--accent-gold-glow);
  }

  .back-title {
    font-family: var(--font-headline);
    font-size: 0.88rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--accent-gold-bright);
  }

  .back-border-glow {
    position: absolute;
    inset: 4px;
    border-radius: 4px;
    border: 1px dashed rgba(245, 158, 11, 0.4);
    pointer-events: none;
  }

  /* Card Front */
  .card-front {
    background-color: var(--bg-elevated);
    border: 2px solid var(--accent-border, var(--accent-gold));
    transform: rotateY(0deg);
  }

  .card-front.number-card {
    background: linear-gradient(150deg, #1b2434 0%, #111722 100%);
  }

  .card-front.action-card {
    background: linear-gradient(150deg, #272226 0%, #171417 100%);
  }

  .card-front.wild-card {
    background: linear-gradient(150deg, #261e32 0%, #15111d 100%);
  }

  .card-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8px 10px;
  }

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
    font-size: 1.85rem;
    font-weight: 800;
    color: var(--accent-gold-bright);
    line-height: 1.05;
    font-family: var(--font-headline);
  }

  .number-card .center-emblem {
    color: #93c5fd;
    text-shadow: 0 0 16px rgba(96, 165, 250, 0.6);
  }

  .wild-card .center-emblem {
    color: #d8b4fe;
    text-shadow: 0 0 16px rgba(192, 132, 252, 0.6);
  }

  .center-emblem.text-emblem {
    font-size: 1.25rem;
    letter-spacing: 0.04em;
  }

  .card-title {
    font-family: var(--font-headline);
    font-size: 0.8rem;
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
    background-color: rgba(11, 14, 21, 0.6);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    padding: 3px 4px;
    margin-top: auto;
  }

  .description {
    font-size: 0.62rem;
    color: var(--text-muted);
    line-height: 1.2;
    text-align: center;
  }

  @media (max-width: 900px) {
    .card-3d-stage {
      width: 104px;
      height: 146px;
      margin-left: -52px;
      margin-top: -73px;
    }
  }
</style>
