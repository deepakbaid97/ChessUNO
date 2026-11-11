<script lang="ts">
  import bodyArtwork from '../../assets/characters/rook/illustrated/body.svg?raw';
  import headArtwork from '../../assets/characters/rook/illustrated/head.svg?raw';
  import helmetArtwork from '../../assets/characters/rook/illustrated/helmet.svg?raw';
  import leftLegArtwork from '../../assets/characters/rook/illustrated/leg-left.svg?raw';
  import rightLegArtwork from '../../assets/characters/rook/illustrated/leg-right.svg?raw';
  import leftArmArtwork from '../../assets/characters/rook/illustrated/arm-left.svg?raw';
  import rightArmArtwork from '../../assets/characters/rook/illustrated/arm-right.svg?raw';
  import weaponArtwork from '../../assets/characters/rook/illustrated/weapon.svg?raw';
  import neutralFace from '../../assets/characters/rook/illustrated/face-neutral.svg?raw';
  import happyFace from '../../assets/characters/rook/illustrated/face-happy.svg?raw';
  import scaredFace from '../../assets/characters/rook/illustrated/face-scared.svg?raw';
  import angryFace from '../../assets/characters/rook/illustrated/face-angry.svg?raw';

  export type RookExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type RookAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type RookTeam = 'light' | 'dark';

  export let expression: RookExpression = 'neutral';
  export let animation: RookAnimation = 'idle';
  export let team: RookTeam = 'light';
  export let size = 180;
  export let label = 'Chess rook character';
  export let testId = 'rook-character';

  $: faceArtwork = { neutral: neutralFace, happy: happyFace, scared: scaredFace, angry: angryFace }[expression];
</script>

<div
  class="rook-character team-{team} expression-{expression} animation-{animation}"
  style="--rook-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid={testId}
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="rook-shadow" aria-hidden="true"></div>
  <div class="rook-action-rig" aria-hidden="true">
    <div class="rook-expression-rig">
      <div class="rook-layer rook-leg rook-leg-left" data-testid="rook-leg-left">{@html leftLegArtwork}</div>
      <div class="rook-layer rook-leg rook-leg-right" data-testid="rook-leg-right">{@html rightLegArtwork}</div>
      <div class="rook-layer rook-body" data-testid="rook-body">{@html bodyArtwork}</div>
      <div class="rook-layer rook-shield rook-arm-left" data-testid="rook-arm-left">{@html leftArmArtwork}</div>
      <div class="rook-layer rook-arm rook-arm-right" data-testid="rook-arm-right">{@html rightArmArtwork}</div>
      <div class="rook-layer rook-weapon" data-testid="rook-weapon">{@html weaponArtwork}</div>
      <div class="rook-layer rook-head" data-testid="rook-head">{@html headArtwork}</div>
      <div class="rook-layer rook-helmet" data-testid="rook-helmet">{@html helmetArtwork}</div>
      <div class="rook-layer rook-face-rig" data-testid="rook-face-rig">
        <div class="rook-face-expression" data-testid="rook-face-expression">
          {@html faceArtwork}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .rook-character {
    --rook-ink: #211e2f;
    --rook-stone: #d9e2ec;
    --rook-stone-shadow: #8da2b5;
    --rook-metal: #f0f4f8;
    --rook-metal-shadow: #9aaec4;
    --rook-cloth: #486581;
    --rook-cloth-shadow: #243b53;
    --rook-gold: #e9b949;
    --rook-skin: #f0b382;
    --rook-skin-shadow: #cc7d52;
    --rook-belt: #3e2c3a;
    --rook-boot: #334e68;

    position: relative;
    display: inline-block;
    width: var(--rook-size);
    height: var(--rook-size);
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark {
    --rook-ink: #161424;
    --rook-stone: #627d98;
    --rook-stone-shadow: #334e68;
    --rook-metal: #9fb3c8;
    --rook-metal-shadow: #486581;
    --rook-cloth: #742a2a;
    --rook-cloth-shadow: #491b1b;
    --rook-gold: #c0841d;
    --rook-skin: #b87352;
    --rook-skin-shadow: #7d432b;
    --rook-belt: #291e2b;
    --rook-boot: #1e293b;
  }

  .rook-shadow {
    position: absolute;
    z-index: 0;
    left: 12%;
    bottom: 3%;
    width: 76%;
    height: 14%;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(16, 12, 26, 0.52) 0%, rgba(16, 12, 26, 0) 72%);
    transform-origin: center center;
    transition: transform 0.25s ease;
  }

  .rook-action-rig {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    transform-origin: 50% 92%;
  }

  .rook-expression-rig {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .rook-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rook-layer :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* Layer stacking order */
  .rook-leg-left { z-index: 2; transform-origin: 34% 78%; }
  .rook-leg-right { z-index: 2; transform-origin: 66% 78%; }
  .rook-body { z-index: 4; transform-origin: 50% 65%; }
  .rook-shield { z-index: 7; transform-origin: 26% 62%; }
  .rook-arm-right { z-index: 5; transform-origin: 78% 55%; }
  .rook-weapon { z-index: 6; transform-origin: 82% 72%; }
  .rook-head { z-index: 8; transform-origin: 50% 45%; }
  .rook-helmet { z-index: 9; transform-origin: 50% 32%; }
  .rook-face-rig { z-index: 10; transform-origin: 50% 48%; }
  .rook-face-expression { width: 100%; height: 100%; }

  /* =========================================================================
     ANIMATION RIG: IDLE (Heavy Immovable Breathing & Grounded Presence)
     ========================================================================= */
  .animation-idle .rook-action-rig {
    animation: rookIdleBreath 3.2s ease-in-out infinite;
  }

  .animation-idle .rook-shadow {
    animation: rookShadowPulse 3.2s ease-in-out infinite;
  }

  .animation-idle .rook-weapon {
    animation: rookWeaponRest 3.2s ease-in-out infinite;
  }

  .animation-idle .rook-shield {
    animation: rookShieldPlant 3.2s ease-in-out infinite;
  }

  .animation-idle .rook-face-rig {
    animation: rookIdleBlink 5.2s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: WALK (Thunderous Heavy Fortress Stomp)
     ========================================================================= */
  .animation-walk .rook-action-rig {
    animation: rookStompBob 0.88s cubic-bezier(0.4, 0.1, 0.2, 1) infinite;
  }

  .animation-walk .rook-leg-left {
    animation: rookStompLegL 0.88s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .rook-leg-right {
    animation: rookStompLegR 0.88s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .rook-shield {
    animation: rookStompShield 0.88s ease-in-out infinite;
  }

  .animation-walk .rook-weapon {
    animation: rookStompWeapon 0.88s ease-in-out infinite;
  }

  .animation-walk .rook-shadow {
    animation: rookStompShadow 0.88s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: ATTACK (Heavy War Hammer Smash / Fortress Slam)
     ========================================================================= */
  .animation-attack .rook-action-rig {
    animation: rookAttackBody 0.95s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .rook-weapon {
    animation: rookAttackHammer 0.95s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .rook-arm-right {
    animation: rookAttackArm 0.95s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .rook-shield {
    animation: rookAttackShield 0.95s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  /* =========================================================================
     ANIMATION RIG: DEATH (Fortress Breach & Crumbling Collapse)
     ========================================================================= */
  .animation-death .rook-action-rig {
    animation: rookDefeatFall 1.1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animation-death .rook-shield {
    animation: rookDefeatShield 1.1s ease-out forwards;
  }

  .animation-death .rook-weapon {
    animation: rookDefeatWeapon 1.1s ease-out forwards;
  }

  .animation-death .rook-helmet {
    animation: rookDefeatHelmet 1.1s ease-out forwards;
  }

  .animation-death .rook-shadow {
    animation: rookDefeatShadow 1.1s ease-out forwards;
  }

  /* =========================================================================
     EXPRESSION ACCENTS (Decoupled on .rook-face-expression)
     ========================================================================= */
  .expression-happy .rook-face-expression {
    animation: rookFacePride 1.8s ease-in-out infinite;
  }

  .expression-scared .rook-face-expression {
    animation: rookFaceTremble 0.15s ease-in-out infinite;
  }

  .expression-angry .rook-face-expression {
    animation: rookFaceRumble 2.2s ease-in-out infinite;
  }

  /* =========================================================================
     KEYFRAMES
     ========================================================================= */
  @keyframes rookIdleBreath {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-2px) scaleY(1.015); }
  }

  @keyframes rookShadowPulse {
    0%, 100% { transform: scale(1); opacity: 0.95; }
    50% { transform: scale(0.96); opacity: 0.85; }
  }

  @keyframes rookWeaponRest {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(1.5deg) translateY(-1px); }
  }

  @keyframes rookShieldPlant {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }

  @keyframes rookIdleBlink {
    0%, 90%, 95%, 100% { transform: scaleY(1); }
    92.5% { transform: scaleY(0.12); }
  }

  @keyframes rookStompBob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-8px) rotate(-1.5deg); }
    50% { transform: translateY(2px) rotate(0deg); }
    75% { transform: translateY(-8px) rotate(1.5deg); }
  }

  @keyframes rookStompLegL {
    0%, 100% { transform: rotate(-10deg) translateY(0); }
    50% { transform: rotate(14deg) translateY(-8px); }
  }

  @keyframes rookStompLegR {
    0%, 100% { transform: rotate(14deg) translateY(-8px); }
    50% { transform: rotate(-10deg) translateY(0); }
  }

  @keyframes rookStompShield {
    0%, 100% { transform: rotate(0deg) translateY(0); }
    50% { transform: rotate(-3deg) translateY(-3px); }
  }

  @keyframes rookStompWeapon {
    0%, 100% { transform: rotate(0deg) translateY(0); }
    50% { transform: rotate(4deg) translateY(-4px); }
  }

  @keyframes rookStompShadow {
    0%, 50%, 100% { transform: scale(1); opacity: 0.95; }
    25%, 75% { transform: scale(0.85); opacity: 0.75; }
  }

  @keyframes rookAttackBody {
    0% { transform: translateX(0) rotate(0deg); }
    28% { transform: translateX(-14px) rotate(-4deg); }
    52% { transform: translateX(24px) translateY(2px) rotate(3deg); }
    72% { transform: translateX(18px) rotate(1deg); }
    100% { transform: translateX(10px) rotate(0deg); }
  }

  @keyframes rookAttackHammer {
    0% { transform: rotate(0deg); }
    28% { transform: rotate(-45deg) translateY(-22px) translateX(-6px); }
    52% { transform: rotate(55deg) translateX(16px) translateY(18px); }
    75% { transform: rotate(26deg) translateX(8px); }
    100% { transform: rotate(12deg); }
  }

  @keyframes rookAttackArm {
    0% { transform: rotate(0deg); }
    28% { transform: rotate(-30deg); }
    52% { transform: rotate(40deg); }
    100% { transform: rotate(10deg); }
  }

  @keyframes rookAttackShield {
    0% { transform: rotate(0deg); }
    28% { transform: rotate(-6deg) translateX(-4px); }
    52% { transform: rotate(12deg) translateX(12px); }
    100% { transform: rotate(0deg); }
  }

  @keyframes rookDefeatFall {
    0% { transform: translate(0, 0) rotate(0deg); }
    20% { transform: translate(-10px, -4px) rotate(-6deg); }
    55% { transform: translate(-22px, 14px) rotate(-22deg); }
    100% { transform: translate(-30px, 28px) rotate(-34deg); opacity: 0.35; }
  }

  @keyframes rookDefeatShield {
    0% { transform: rotate(0deg); }
    35% { transform: rotate(-15deg) translateX(-8px); }
    100% { transform: rotate(-48deg) translateX(-28px) translateY(24px); opacity: 0.4; }
  }

  @keyframes rookDefeatWeapon {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(20deg) translateY(-6px); }
    100% { transform: rotate(75deg) translateX(22px) translateY(32px); opacity: 0.3; }
  }

  @keyframes rookDefeatHelmet {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-14deg) translateY(6px); }
  }

  @keyframes rookDefeatShadow {
    0% { transform: scale(1); opacity: 0.95; }
    100% { transform: scale(0.6) translateX(-18px); opacity: 0.3; }
  }

  @keyframes rookFacePride {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1.5px); }
  }

  @keyframes rookFaceTremble {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1.5px, 0.5px); }
    50% { transform: translate(1.5px, -1px); }
    75% { transform: translate(-1px, -0.5px); }
  }

  @keyframes rookFaceRumble {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }

  @media (prefers-reduced-motion: reduce) {
    .rook-character,
    .rook-character * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>

