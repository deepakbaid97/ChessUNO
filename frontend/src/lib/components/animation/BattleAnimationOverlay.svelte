<script lang="ts">
  import { onDestroy } from 'svelte';
  import PawnCharacter, { type PawnAnimation, type PawnExpression } from '../characters/PawnCharacter.svelte';
  import { battleAnimationStore, battleAnimationService } from '../../services/battleAnimationService';
  import { prefersReducedMotion } from '../../utils/cardDisplayUtils';

  $: state = $battleAnimationStore;
  $: active = state.isActive;
  $: currentEvent = state.currentEvent;

  $: attackerTeam = currentEvent?.attacker.color === 'White' ? 'light' : 'dark';
  $: defenderTeam = currentEvent?.defender.color === 'White' ? 'light' : 'dark';

  let attackerAnimation: PawnAnimation = 'walk';
  let attackerExpression: PawnExpression = 'neutral';
  let defenderAnimation: PawnAnimation = 'idle';
  let defenderExpression: PawnExpression = 'neutral';

  let stagePhase: 'enter' | 'charge' | 'clash' | 'reaction' | 'exit' = 'enter';
  let shakeActive = false;
  let flashActive = false;
  let sparks: { id: number; dx: number; dy: number; color: string; size: number }[] = [];

  let timeouts: ReturnType<typeof setTimeout>[] = [];

  function clearAllTimeouts() {
    timeouts.forEach(t => clearTimeout(t));
    timeouts = [];
  }

  function handleDismiss() {
    clearAllTimeouts();
    battleAnimationService.dismiss();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === ' ') {
      handleDismiss();
    }
  }

  function generateSparks() {
    const colors = ['#f3ce73', '#ffffff', '#f43f5e', '#fbbf24', '#ffedd5'];
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      dx: (Math.random() - 0.45) * 160,
      dy: (Math.random() - 0.7) * 140,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 4
    }));
  }

  $: if (active && currentEvent) {
    clearAllTimeouts();

    if (prefersReducedMotion()) {
      timeouts.push(setTimeout(() => handleDismiss(), 350));
    } else {
      // Step 1: Enter (0ms)
      stagePhase = 'enter';
      attackerAnimation = 'walk';
      attackerExpression = 'neutral';
      defenderAnimation = 'idle';
      defenderExpression = 'neutral';
      shakeActive = false;
      flashActive = false;
      sparks = [];

      // Step 2: Charge & Anticipation (300ms)
      timeouts.push(
        setTimeout(() => {
          stagePhase = 'charge';
          attackerAnimation = 'walk';
          attackerExpression = 'angry';
          defenderExpression = 'scared';
        }, 300)
      );

      // Step 3: Attack Strike & Impact (580ms)
      timeouts.push(
        setTimeout(() => {
          stagePhase = 'clash';
          attackerAnimation = 'attack';
          attackerExpression = 'angry';
          defenderExpression = 'scared';
          shakeActive = true;
          flashActive = true;
          sparks = generateSparks();
        }, 580)
      );

      // Step 4: Outcome - Defender falls, Attacker victorious (820ms)
      timeouts.push(
        setTimeout(() => {
          stagePhase = 'reaction';
          shakeActive = false;
          flashActive = false;
          attackerAnimation = 'idle';
          attackerExpression = 'happy';
          defenderAnimation = 'death';
          defenderExpression = 'scared';
        }, 820)
      );

      // Step 5: Auto dismiss (1420ms)
      timeouts.push(
        setTimeout(() => {
          stagePhase = 'exit';
          handleDismiss();
        }, 1420)
      );
    }
  }

  onDestroy(() => {
    clearAllTimeouts();
  });
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if active && currentEvent}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
  <div
    class="battle-overlay"
    class:phase-exit={stagePhase === 'exit'}
    data-testid="battle-animation-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Pawn battle capture cinematic"
    tabindex="-1"
    on:click={handleDismiss}
    on:keydown={(e) => { if (e.key === 'Escape' || e.key === ' ') handleDismiss(); }}
  >
    <div class="backdrop-glow" aria-hidden="true"></div>

    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
    <div class="battle-arena" class:shake={shakeActive} role="document" on:click|stopPropagation>
      <header class="battle-header">
        <span class="battle-tag">PAWN DUEL</span>
        <h2 class="battle-title">
          {currentEvent.attacker.color} Pawn strikes {currentEvent.defender.color} Pawn
        </h2>
      </header>

      <div class="combat-stage">
        <!-- Floor Ring Plinth -->
        <div class="stage-plinth" aria-hidden="true">
          <div class="plinth-ring ring-outer"></div>
          <div class="plinth-ring ring-inner"></div>
        </div>

        <!-- Attacker Slot (Left) -->
        <div class="combatant-slot slot-attacker phase-{stagePhase}">
          <PawnCharacter
            team={attackerTeam}
            animation={attackerAnimation}
            expression={attackerExpression}
            size={180}
            testId="battle-attacker"
          />
        </div>

        <!-- Clash Center FX (Sparks & Flash) -->
        <div class="clash-origin" aria-hidden="true">
          {#if flashActive}
            <div class="clash-flash"></div>
          {/if}
          {#each sparks as s (s.id)}
            <div
              class="spark-particle"
              style="--dx: {s.dx}px; --dy: {s.dy}px; --color: {s.color}; --size: {s.size}px;"
            ></div>
          {/each}
        </div>

        <!-- Defender Slot (Right, flipped) -->
        <div class="combatant-slot slot-defender phase-{stagePhase}">
          <PawnCharacter
            team={defenderTeam}
            animation={defenderAnimation}
            expression={defenderExpression}
            size={180}
            testId="battle-defender"
          />
        </div>
      </div>

      <footer class="battle-footer">
        <button class="skip-btn" on:click|stopPropagation={handleDismiss} aria-label="Skip battle animation">
          Skip ✕
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .battle-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 48%, rgba(26, 20, 42, 0.82) 0%, rgba(10, 8, 17, 0.94) 80%);
    backdrop-filter: blur(6px);
    cursor: pointer;
    animation: fadeIn 0.22s ease-out forwards;
    user-select: none;
  }

  .battle-overlay.phase-exit {
    animation: fadeOut 0.2s ease-in forwards;
  }

  .backdrop-glow {
    position: absolute;
    width: min(85vw, 640px);
    height: min(85vw, 640px);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(243, 206, 115, 0.15) 0%, rgba(168, 85, 247, 0.08) 50%, transparent 70%);
    pointer-events: none;
  }

  .battle-arena {
    position: relative;
    width: min(92vw, 620px);
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: default;
  }

  .battle-arena.shake {
    animation: screenRumble 0.24s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  .battle-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .battle-tag {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(243, 206, 115, 0.15);
    border: 1px solid rgba(243, 206, 115, 0.4);
    color: #f3ce73;
    font: 700 0.68rem var(--font-mono, monospace);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .battle-title {
    margin: 8px 0 0;
    color: #f8efd9;
    font: 700 1.25rem var(--font-sans, sans-serif);
    letter-spacing: -0.02em;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  }

  .combat-stage {
    position: relative;
    width: 100%;
    height: 260px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
  }

  .stage-plinth {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 82%;
    height: 48px;
    pointer-events: none;
  }

  .plinth-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }

  .ring-outer {
    border: 1.5px solid rgba(248, 239, 217, 0.25);
    background: radial-gradient(ellipse at center, rgba(243, 206, 115, 0.18), transparent 70%);
    box-shadow: 0 0 24px rgba(243, 206, 115, 0.2);
  }

  .ring-inner {
    inset: 6px;
    border: 1px dashed rgba(243, 206, 115, 0.35);
  }

  .combatant-slot {
    position: relative;
    z-index: 2;
    transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  /* Attacker (Left) movement states */
  .slot-attacker.phase-enter {
    transform: translateX(-50px);
    opacity: 0.8;
  }

  .slot-attacker.phase-charge {
    transform: translateX(30px);
  }

  .slot-attacker.phase-clash {
    transform: translateX(54px) scale(1.08);
  }

  .slot-attacker.phase-reaction {
    transform: translateX(35px) scale(1.05);
  }

  /* Defender (Right) flipped facing left */
  .slot-defender {
    transform: scaleX(-1);
  }

  .slot-defender.phase-enter {
    transform: scaleX(-1) translateX(-50px);
    opacity: 0.8;
  }

  .slot-defender.phase-charge {
    transform: scaleX(-1) translateX(0);
  }

  .slot-defender.phase-clash {
    transform: scaleX(-1) translateX(-30px);
  }

  .slot-defender.phase-reaction {
    transform: scaleX(-1) translateX(-55px) rotate(-8deg);
  }

  /* Clash point FX */
  .clash-origin {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 5;
  }

  .clash-flash {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 140px;
    height: 140px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(243, 206, 115, 0.6) 45%, transparent 75%);
    animation: impactFlash 0.22s ease-out forwards;
  }

  .spark-particle {
    position: absolute;
    left: 50%;
    top: 50%;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--color);
    box-shadow: 0 0 8px var(--color);
    animation: sparkFly 0.42s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
  }

  .battle-footer {
    margin-top: 14px;
    text-align: center;
  }

  .skip-btn {
    background: rgba(248, 239, 217, 0.08);
    border: 1px solid rgba(248, 239, 217, 0.2);
    border-radius: 999px;
    color: #c8bed1;
    font: 600 0.72rem var(--font-mono, monospace);
    padding: 5px 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .skip-btn:hover {
    color: #f3ce73;
    border-color: #f3ce73;
    background: rgba(243, 206, 115, 0.12);
  }

  @keyframes impactFlash {
    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
  }

  @keyframes sparkFly {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
  }

  @keyframes screenRumble {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-4px, 2px); }
    40% { transform: translate(4px, -3px); }
    60% { transform: translate(-3px, -2px); }
    80% { transform: translate(3px, 1px); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .battle-overlay,
    .battle-overlay *,
    .battle-arena.shake {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
