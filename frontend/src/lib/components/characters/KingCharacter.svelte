<script lang="ts">
  import bodyArtwork from '../../assets/characters/king/illustrated/body.svg?raw';
  import headArtwork from '../../assets/characters/king/illustrated/head.svg?raw';
  import helmetArtwork from '../../assets/characters/king/illustrated/helmet.svg?raw';
  import leftLegArtwork from '../../assets/characters/king/illustrated/leg-left.svg?raw';
  import rightLegArtwork from '../../assets/characters/king/illustrated/leg-right.svg?raw';
  import leftArmArtwork from '../../assets/characters/king/illustrated/arm-left.svg?raw';
  import rightArmArtwork from '../../assets/characters/king/illustrated/arm-right.svg?raw';
  import weaponArtwork from '../../assets/characters/king/illustrated/weapon.svg?raw';
  import neutralFace from '../../assets/characters/king/illustrated/face-neutral.svg?raw';
  import happyFace from '../../assets/characters/king/illustrated/face-happy.svg?raw';
  import scaredFace from '../../assets/characters/king/illustrated/face-scared.svg?raw';
  import angryFace from '../../assets/characters/king/illustrated/face-angry.svg?raw';

  export type KingExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type KingAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type KingTeam = 'light' | 'dark';

  export let expression: KingExpression = 'neutral';
  export let animation: KingAnimation = 'idle';
  export let team: KingTeam = 'light';
  export let size = 180;
  export let label = 'Chess king character';
  export let testId = 'king-character';

  $: faceArtwork = { neutral: neutralFace, happy: happyFace, scared: scaredFace, angry: angryFace }[expression];
</script>

<div
  class="king-character team-{team} expression-{expression} animation-{animation}"
  style="--king-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid={testId}
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="king-shadow" aria-hidden="true"></div>
  <div class="king-action-rig" aria-hidden="true">
    <div class="king-expression-rig">
      <div class="king-layer king-leg king-leg-left" data-testid="king-leg-left">{@html leftLegArtwork}</div>
      <div class="king-layer king-leg king-leg-right" data-testid="king-leg-right">{@html rightLegArtwork}</div>
      <div class="king-layer king-body" data-testid="king-body">{@html bodyArtwork}</div>
      <div class="king-layer king-arm king-arm-left" data-testid="king-arm-left">{@html leftArmArtwork}</div>
      <div class="king-layer king-arm king-arm-right" data-testid="king-arm-right">{@html rightArmArtwork}</div>
      <div class="king-layer king-weapon" data-testid="king-weapon">{@html weaponArtwork}</div>
      <div class="king-layer king-head" data-testid="king-head">{@html headArtwork}</div>
      <div class="king-layer king-helmet" data-testid="king-helmet">{@html helmetArtwork}</div>
      <div class="king-layer king-face-rig" data-testid="king-face-rig">
        <div class="king-face-expression" data-testid="king-face-expression">
          {@html faceArtwork}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .king-character {
    --king-ink: #1a202c;
    --king-metal: #edf2f7;
    --king-metal-shadow: #cbd5e0;
    --king-cape: #2b6cb0;
    --king-cape-shadow: #1a365d;
    --king-ermine: #edf2f7;
    --king-gold: #ecc94b;
    --king-gold-shadow: #b7791f;
    --king-gem: #e53e3e;
    --king-energy: #f6e05e;
    --king-hair: #4a5568;
    --king-hair-shadow: #2d3748;
    --king-skin: #fbd38d;
    --king-skin-shadow: #dd6b20;

    position: relative;
    display: inline-block;
    width: var(--king-size);
    height: var(--king-size);
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark {
    --king-ink: #10151f;
    --king-metal: #2d3748;
    --king-metal-shadow: #1a202c;
    --king-cape: #44337a;
    --king-cape-shadow: #21183c;
    --king-ermine: #cbd5e0;
    --king-gold: #c05621;
    --king-gold-shadow: #7b341e;
    --king-gem: #9b2c2c;
    --king-energy: #f6ad55;
    --king-hair: #1a202c;
    --king-hair-shadow: #0f131a;
    --king-skin: #b7791f;
    --king-skin-shadow: #744210;
  }

  .king-shadow {
    position: absolute;
    z-index: 0;
    left: 20%;
    bottom: 2%;
    width: 60%;
    height: 15%;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(16, 21, 31, 0.5) 0%, rgba(16, 21, 31, 0) 72%);
    transform-origin: 50% 50%;
    pointer-events: none;
  }

  .king-action-rig {
    position: relative;
    width: 100%;
    height: 100%;
    transform-origin: 50% 88%;
  }

  .king-expression-rig {
    position: absolute;
    inset: 0;
    transform-origin: 50% 50%;
  }

  .king-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .king-layer :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* Z-Index Hierarchy */
  .king-leg-left { z-index: 1; transform-origin: 42% 84%; }
  .king-leg-right { z-index: 1; transform-origin: 58% 84%; }
  .king-body { z-index: 2; transform-origin: 50% 65%; }
  .king-arm-left { z-index: 3; transform-origin: 32% 64%; }
  .king-arm-right { z-index: 3; transform-origin: 72% 64%; }
  .king-weapon { z-index: 4; transform-origin: 78% 70%; }
  .king-head { z-index: 5; transform-origin: 50% 42%; }
  .king-helmet { z-index: 6; transform-origin: 50% 28%; }
  .king-face-rig { z-index: 7; transform-origin: 50% 42%; }
  .king-face-expression { width: 100%; height: 100%; }

  /* =========================================================================
     ANIMATION RIG: IDLE (Dignified Majestic Breathing & Heavy Presence)
     ========================================================================= */
  .animation-idle .king-action-rig {
    animation: kingIdleBreath 3.4s ease-in-out infinite;
  }

  .animation-idle .king-shadow {
    animation: kingShadowBreath 3.4s ease-in-out infinite;
  }

  .animation-idle .king-weapon {
    animation: kingWeaponIdle 3.4s ease-in-out infinite;
  }

  .animation-idle .king-face-rig {
    animation: kingIdleBlink 5.2s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: WALK (Stately Heavy Royal Stride)
     ========================================================================= */
  .animation-walk .king-action-rig {
    animation: kingWalkStride 0.96s cubic-bezier(0.4, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .king-body {
    animation: kingWalkCape 0.96s ease-in-out infinite;
  }

  .animation-walk .king-leg-left {
    animation: kingWalkLegL 0.96s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .king-leg-right {
    animation: kingWalkLegR 0.96s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .king-arm-left {
    animation: kingWalkArmL 0.96s ease-in-out infinite;
  }

  .animation-walk .king-weapon {
    animation: kingWalkWeapon 0.96s ease-in-out infinite;
  }

  .animation-walk .king-shadow {
    animation: kingWalkShadow 0.96s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: ATTACK (Royal Defensive Counterstrike)
     ========================================================================= */
  .animation-attack .king-action-rig {
    animation: kingAttackCounter 0.96s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .king-arm-left {
    animation: kingAttackParryGuard 0.96s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .king-weapon {
    animation: kingAttackSceptreStrike 0.96s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .king-arm-right {
    animation: kingAttackArmCounter 0.96s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .king-helmet {
    animation: kingAttackCrownNod 0.96s ease-in-out forwards;
  }

  /* =========================================================================
     ANIMATION RIG: DEATH (Checkmate & Crown Fall)
     ========================================================================= */
  .animation-death .king-action-rig {
    animation: kingDefeatCheckmate 1.15s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animation-death .king-weapon {
    animation: kingDefeatSceptreDrop 1.15s ease-out forwards;
  }

  .animation-death .king-helmet {
    animation: kingDefeatCrownTumble 1.15s ease-out forwards;
  }

  .animation-death .king-shadow {
    animation: kingDefeatShadow 1.15s ease-out forwards;
  }

  /* =========================================================================
     EXPRESSION ACCENTS (Decoupled on .king-face-expression)
     ========================================================================= */
  .expression-happy .king-face-expression {
    animation: kingFaceHearty 2s ease-in-out infinite;
  }

  .expression-scared .king-face-expression {
    animation: kingFacePanic 0.22s linear infinite;
  }

  .expression-angry .king-face-expression {
    animation: kingFaceFury 1.2s ease-in-out infinite;
  }

  /* =========================================================================
     KEYFRAME DEFINITIONS
     ========================================================================= */
  @keyframes kingIdleBreath {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3.5px); }
  }

  @keyframes kingShadowBreath {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(0.93); opacity: 0.72; }
  }

  @keyframes kingWeaponIdle {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-1.5deg) translateY(-2px); }
  }

  @keyframes kingIdleBlink {
    0%, 94%, 98%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.12); }
  }

  @keyframes kingWalkStride {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50% { transform: translateY(-5px) rotate(1deg); }
  }

  @keyframes kingWalkCape {
    0%, 100% { transform: skewX(-2deg); }
    50% { transform: skewX(2.5deg); }
  }

  @keyframes kingWalkLegL {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px) translateX(-2px); }
  }

  @keyframes kingWalkLegR {
    0%, 100% { transform: translateY(-5px) translateX(2px); }
    50% { transform: translateY(0); }
  }

  @keyframes kingWalkArmL {
    0%, 100% { transform: rotate(-2deg); }
    50% { transform: rotate(2deg); }
  }

  @keyframes kingWalkWeapon {
    0%, 100% { transform: rotate(-2.5deg); }
    50% { transform: rotate(3deg); }
  }

  @keyframes kingWalkShadow {
    0%, 100% { transform: scale(0.92) translateX(-3px); }
    50% { transform: scale(0.86) translateX(3px); }
  }

  /* Attack: Defensive Ward Brace -> Heavy Forward Counterstrike -> Royal Resolute Guard */
  @keyframes kingAttackCounter {
    0% { transform: translate(0, 0) scale(1); }
    22% { transform: translate(-8px, 4px) rotate(-3deg) scale(0.97); } /* Defensive brace */
    46% { transform: translate(22px, -2px) rotate(2deg) scale(1.08); }  /* Royal counterstrike */
    72% { transform: translate(14px, 0) scale(1.04); }                  /* Resolute stand */
    100% { transform: translate(0, 0) scale(1); }
  }

  @keyframes kingAttackParryGuard {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(18deg) translate(6px, -4px); } /* Left arm wards incoming blow */
    46% { transform: rotate(-10deg) translate(-4px, 2px); }
    100% { transform: rotate(0deg); }
  }

  @keyframes kingAttackSceptreStrike {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(-24deg) translateY(-8px); }     /* Raised sceptre coiled back */
    46% { transform: rotate(44deg) translate(18px, 8px); }  /* Downward royal smash/strike */
    72% { transform: rotate(12deg) translate(6px, 2px); }
    100% { transform: rotate(0deg); }
  }

  @keyframes kingAttackArmCounter {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(-14deg); }
    46% { transform: rotate(28deg); }
    100% { transform: rotate(0deg); }
  }

  @keyframes kingAttackCrownNod {
    0%, 100% { transform: rotate(0deg); }
    22% { transform: rotate(-2deg); }
    46% { transform: rotate(3deg); }
  }

  /* Defeat: Checkmate Fall */
  @keyframes kingDefeatCheckmate {
    0% { transform: scale(1) translateY(0); opacity: 1; }
    28% { transform: scale(1.03) translateY(-4px) rotate(-4deg); }
    55% { transform: scale(0.92) translateY(12px) rotate(14deg); opacity: 0.85; }
    100% { transform: scale(0.74) translateY(26px) rotate(20deg); opacity: 0.35; filter: grayscale(0.5); }
  }

  @keyframes kingDefeatSceptreDrop {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(72deg) translate(28px, 36px); opacity: 0.4; }
  }

  @keyframes kingDefeatCrownTumble {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-26deg) translate(-16px, 14px); }
  }

  @keyframes kingDefeatShadow {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(0.6) translateX(-10px); opacity: 0.25; }
  }

  @keyframes kingFaceHearty {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  @keyframes kingFacePanic {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1.5px, 0.5px); }
    50% { transform: translate(1.5px, -1px); }
    75% { transform: translate(-1px, -0.5px); }
  }

  @keyframes kingFaceFury {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04) translateY(-1px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .king-character,
    .king-character * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>

