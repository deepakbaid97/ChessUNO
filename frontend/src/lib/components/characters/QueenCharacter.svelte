<script lang="ts">
  import bodyArtwork from '../../assets/characters/queen/illustrated/body.svg?raw';
  import headArtwork from '../../assets/characters/queen/illustrated/head.svg?raw';
  import helmetArtwork from '../../assets/characters/queen/illustrated/helmet.svg?raw';
  import leftLegArtwork from '../../assets/characters/queen/illustrated/leg-left.svg?raw';
  import rightLegArtwork from '../../assets/characters/queen/illustrated/leg-right.svg?raw';
  import leftArmArtwork from '../../assets/characters/queen/illustrated/arm-left.svg?raw';
  import rightArmArtwork from '../../assets/characters/queen/illustrated/arm-right.svg?raw';
  import weaponArtwork from '../../assets/characters/queen/illustrated/weapon.svg?raw';
  import neutralFace from '../../assets/characters/queen/illustrated/face-neutral.svg?raw';
  import happyFace from '../../assets/characters/queen/illustrated/face-happy.svg?raw';
  import scaredFace from '../../assets/characters/queen/illustrated/face-scared.svg?raw';
  import angryFace from '../../assets/characters/queen/illustrated/face-angry.svg?raw';

  export type QueenExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type QueenAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type QueenTeam = 'light' | 'dark';

  export let expression: QueenExpression = 'neutral';
  export let animation: QueenAnimation = 'idle';
  export let team: QueenTeam = 'light';
  export let size = 180;
  export let label = 'Chess queen character';
  export let testId = 'queen-character';

  $: faceArtwork = { neutral: neutralFace, happy: happyFace, scared: scaredFace, angry: angryFace }[expression];
</script>

<div
  class="queen-character team-{team} expression-{expression} animation-{animation}"
  style="--queen-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid={testId}
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="queen-shadow" aria-hidden="true"></div>
  <div class="queen-action-rig" aria-hidden="true">
    <div class="queen-expression-rig">
      <div class="queen-layer queen-leg queen-leg-left" data-testid="queen-leg-left">{@html leftLegArtwork}</div>
      <div class="queen-layer queen-leg queen-leg-right" data-testid="queen-leg-right">{@html rightLegArtwork}</div>
      <div class="queen-layer queen-body" data-testid="queen-body">{@html bodyArtwork}</div>
      <div class="queen-layer queen-arm queen-arm-left" data-testid="queen-arm-left">{@html leftArmArtwork}</div>
      <div class="queen-layer queen-arm queen-arm-right" data-testid="queen-arm-right">{@html rightArmArtwork}</div>
      <div class="queen-layer queen-weapon" data-testid="queen-weapon">{@html weaponArtwork}</div>
      <div class="queen-layer queen-head" data-testid="queen-head">{@html headArtwork}</div>
      <div class="queen-layer queen-helmet" data-testid="queen-helmet">{@html helmetArtwork}</div>
      <div class="queen-layer queen-face-rig" data-testid="queen-face-rig">
        <div class="queen-face-expression" data-testid="queen-face-expression">
          {@html faceArtwork}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .queen-character {
    --queen-ink: #1a202c;
    --queen-metal: #edf2f7;
    --queen-metal-shadow: #cbd5e0;
    --queen-cape: #e53e3e;
    --queen-cape-shadow: #9b2c2c;
    --queen-gold: #ecc94b;
    --queen-gold-shadow: #b7791f;
    --queen-gem: #e53e3e;
    --queen-energy: #63b3ed;
    --queen-hair: #2d3748;
    --queen-hair-shadow: #171923;
    --queen-skin: #fbd38d;
    --queen-skin-shadow: #dd6b20;

    position: relative;
    display: inline-block;
    width: var(--queen-size);
    height: var(--queen-size);
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark {
    --queen-ink: #0f131a;
    --queen-metal: #2d3748;
    --queen-metal-shadow: #1a202c;
    --queen-cape: #553c9a;
    --queen-cape-shadow: #322659;
    --queen-gold: #dd6b20;
    --queen-gold-shadow: #9c4221;
    --queen-gem: #b83280;
    --queen-energy: #f687b3;
    --queen-hair: #171923;
    --queen-hair-shadow: #0d0f14;
    --queen-skin: #b7791f;
    --queen-skin-shadow: #744210;
  }

  .queen-shadow {
    position: absolute;
    z-index: 0;
    left: 22%;
    bottom: 2%;
    width: 56%;
    height: 14%;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(15, 19, 26, 0.45) 0%, rgba(15, 19, 26, 0) 72%);
    transform-origin: 50% 50%;
    pointer-events: none;
  }

  .queen-action-rig {
    position: relative;
    width: 100%;
    height: 100%;
    transform-origin: 50% 88%;
  }

  .queen-expression-rig {
    position: absolute;
    inset: 0;
    transform-origin: 50% 50%;
  }

  .queen-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .queen-layer :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* Z-Index Hierarchy */
  .queen-leg-left { z-index: 1; transform-origin: 42% 84%; }
  .queen-leg-right { z-index: 1; transform-origin: 58% 84%; }
  .queen-body { z-index: 2; transform-origin: 50% 65%; }
  .queen-arm-left { z-index: 3; transform-origin: 32% 64%; }
  .queen-arm-right { z-index: 3; transform-origin: 72% 64%; }
  .queen-weapon { z-index: 4; transform-origin: 78% 70%; }
  .queen-head { z-index: 5; transform-origin: 50% 42%; }
  .queen-helmet { z-index: 6; transform-origin: 50% 28%; }
  .queen-face-rig { z-index: 7; transform-origin: 50% 42%; }
  .queen-face-expression { width: 100%; height: 100%; }

  /* =========================================================================
     ANIMATION RIG: IDLE (Regal Poise & Majestic Breathing)
     ========================================================================= */
  .animation-idle .queen-action-rig {
    animation: queenIdleBreath 3.2s ease-in-out infinite;
  }

  .animation-idle .queen-shadow {
    animation: queenShadowBreath 3.2s ease-in-out infinite;
  }

  .animation-idle .queen-weapon {
    animation: queenWeaponIdle 3.2s ease-in-out infinite;
  }

  .animation-idle .queen-face-rig {
    animation: queenIdleBlink 5.0s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: WALK (Confident Commanding March)
     ========================================================================= */
  .animation-walk .queen-action-rig {
    animation: queenWalkStride 0.9s cubic-bezier(0.4, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .queen-body {
    animation: queenWalkCape 0.9s ease-in-out infinite;
  }

  .animation-walk .queen-leg-left {
    animation: queenWalkLegL 0.9s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .queen-leg-right {
    animation: queenWalkLegR 0.9s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .queen-arm-left {
    animation: queenWalkArmL 0.9s ease-in-out infinite;
  }

  .animation-walk .queen-weapon {
    animation: queenWalkWeapon 0.9s ease-in-out infinite;
  }

  .animation-walk .queen-shadow {
    animation: queenWalkShadow 0.9s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: ATTACK (Energy Slash - Dash & Lightning Arc Sweep)
     ========================================================================= */
  .animation-attack .queen-action-rig {
    animation: queenAttackDash 0.88s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .queen-weapon {
    animation: queenAttackBladeSweep 0.88s cubic-bezier(0.15, 0.85, 0.25, 1) forwards;
  }

  .animation-attack .queen-arm-right {
    animation: queenAttackArmSlash 0.88s cubic-bezier(0.15, 0.85, 0.25, 1) forwards;
  }

  .animation-attack .queen-arm-left {
    animation: queenAttackPoise 0.88s ease-in-out forwards;
  }

  .animation-attack .queen-helmet {
    animation: queenAttackCrownTilt 0.88s ease-in-out forwards;
  }

  /* =========================================================================
     ANIMATION RIG: DEATH (Regal Defeat & Graceful Kneeling Collapse)
     ========================================================================= */
  .animation-death .queen-action-rig {
    animation: queenDefeatFall 1.1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animation-death .queen-weapon {
    animation: queenDefeatBladeDrop 1.1s ease-out forwards;
  }

  .animation-death .queen-helmet {
    animation: queenDefeatCrownRoll 1.1s ease-out forwards;
  }

  .animation-death .queen-shadow {
    animation: queenDefeatShadow 1.1s ease-out forwards;
  }

  /* =========================================================================
     EXPRESSION ACCENTS (Decoupled on .queen-face-expression)
     ========================================================================= */
  .expression-happy .queen-face-expression {
    animation: queenFacePride 2s ease-in-out infinite;
  }

  .expression-scared .queen-face-expression {
    animation: queenFaceGasp 0.25s linear infinite;
  }

  .expression-angry .queen-face-expression {
    animation: queenFaceWrath 1.2s ease-in-out infinite;
  }

  /* =========================================================================
     KEYFRAME DEFINITIONS
     ========================================================================= */
  @keyframes queenIdleBreath {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  @keyframes queenShadowBreath {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(0.92); opacity: 0.7; }
  }

  @keyframes queenWeaponIdle {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-2deg) translateY(-2px); }
  }

  @keyframes queenIdleBlink {
    0%, 94%, 98%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.1); }
  }

  @keyframes queenWalkStride {
    0%, 100% { transform: translateY(0) rotate(-1.5deg); }
    50% { transform: translateY(-6px) rotate(1.5deg); }
  }

  @keyframes queenWalkCape {
    0%, 100% { transform: skewX(-2deg); }
    50% { transform: skewX(3deg); }
  }

  @keyframes queenWalkLegL {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px) translateX(-2px); }
  }

  @keyframes queenWalkLegR {
    0%, 100% { transform: translateY(-5px) translateX(2px); }
    50% { transform: translateY(0); }
  }

  @keyframes queenWalkArmL {
    0%, 100% { transform: rotate(-2deg); }
    50% { transform: rotate(3deg); }
  }

  @keyframes queenWalkWeapon {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(4deg); }
  }

  @keyframes queenWalkShadow {
    0%, 100% { transform: scale(0.9) translateX(-3px); }
    50% { transform: scale(0.85) translateX(3px); }
  }

  /* Attack: Anticipation Coil -> Lightning Forward Slash -> Elegant Victory Pose */
  @keyframes queenAttackDash {
    0% { transform: translate(0, 0) scale(1); }
    18% { transform: translate(-12px, 2px) rotate(-4deg) scale(0.96); } /* Coiled anticipation */
    42% { transform: translate(24px, -2px) rotate(3deg) scale(1.1); }   /* Rapid dash strike */
    68% { transform: translate(16px, 0) rotate(1deg) scale(1.06); }     /* Follow-through */
    100% { transform: translate(0, 0) scale(1); }                        /* Regal return */
  }

  @keyframes queenAttackBladeSweep {
    0% { transform: rotate(0deg); }
    18% { transform: rotate(-28deg) translate(-10px, -6px); }            /* High guard coil */
    42% { transform: rotate(56deg) translate(22px, 6px); }               /* Horizontal slash arc */
    68% { transform: rotate(18deg) translate(8px, 0); }                  /* Blade flourish */
    100% { transform: rotate(0deg); }
  }

  @keyframes queenAttackArmSlash {
    0% { transform: rotate(0deg); }
    18% { transform: rotate(-16deg); }
    42% { transform: rotate(32deg); }
    100% { transform: rotate(0deg); }
  }

  @keyframes queenAttackPoise {
    0%, 100% { transform: rotate(0deg); }
    18% { transform: rotate(8deg); }
    42% { transform: rotate(-12deg); }
  }

  @keyframes queenAttackCrownTilt {
    0%, 100% { transform: rotate(0deg); }
    18% { transform: rotate(-3deg); }
    42% { transform: rotate(4deg); }
  }

  /* Defeat: Composure Shatter & Royal Fall */
  @keyframes queenDefeatFall {
    0% { transform: scale(1) translateY(0); opacity: 1; }
    30% { transform: scale(1.04) translateY(-6px) rotate(-6deg); }
    60% { transform: scale(0.92) translateY(10px) rotate(12deg); opacity: 0.85; }
    100% { transform: scale(0.72) translateY(24px) rotate(22deg); opacity: 0.35; filter: grayscale(0.5); }
  }

  @keyframes queenDefeatBladeDrop {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(78deg) translate(34px, 38px); opacity: 0.4; }
  }

  @keyframes queenDefeatCrownRoll {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-30deg) translate(-14px, 16px); }
  }

  @keyframes queenDefeatShadow {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(0.55) translateX(-12px); opacity: 0.2; }
  }

  @keyframes queenFacePride {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  @keyframes queenFaceGasp {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1.5px, 0.5px); }
    50% { transform: translate(1.5px, -1px); }
    75% { transform: translate(-1px, -0.5px); }
  }

  @keyframes queenFaceWrath {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04) translateY(-1px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .queen-character,
    .queen-character * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
