<script lang="ts">
  import bodyArtwork from '../../assets/characters/bishop/illustrated/body.svg?raw';
  import headArtwork from '../../assets/characters/bishop/illustrated/head.svg?raw';
  import helmetArtwork from '../../assets/characters/bishop/illustrated/helmet.svg?raw';
  import leftLegArtwork from '../../assets/characters/bishop/illustrated/leg-left.svg?raw';
  import rightLegArtwork from '../../assets/characters/bishop/illustrated/leg-right.svg?raw';
  import leftArmArtwork from '../../assets/characters/bishop/illustrated/arm-left.svg?raw';
  import rightArmArtwork from '../../assets/characters/bishop/illustrated/arm-right.svg?raw';
  import weaponArtwork from '../../assets/characters/bishop/illustrated/weapon.svg?raw';
  import neutralFace from '../../assets/characters/bishop/illustrated/face-neutral.svg?raw';
  import happyFace from '../../assets/characters/bishop/illustrated/face-happy.svg?raw';
  import scaredFace from '../../assets/characters/bishop/illustrated/face-scared.svg?raw';
  import angryFace from '../../assets/characters/bishop/illustrated/face-angry.svg?raw';

  export type BishopExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type BishopAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type BishopTeam = 'light' | 'dark';

  export let expression: BishopExpression = 'neutral';
  export let animation: BishopAnimation = 'idle';
  export let team: BishopTeam = 'light';
  export let size = 180;
  export let label = 'Chess bishop character';
  export let testId = 'bishop-character';

  $: faceArtwork = { neutral: neutralFace, happy: happyFace, scared: scaredFace, angry: angryFace }[expression];
</script>

<div
  class="bishop-character team-{team} expression-{expression} animation-{animation}"
  style="--bishop-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid={testId}
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="bishop-shadow" aria-hidden="true"></div>
  <div class="bishop-action-rig" aria-hidden="true">
    <div class="bishop-expression-rig">
      <div class="bishop-layer bishop-leg bishop-leg-left" data-testid="bishop-leg-left">{@html leftLegArtwork}</div>
      <div class="bishop-layer bishop-leg bishop-leg-right" data-testid="bishop-leg-right">{@html rightLegArtwork}</div>
      <div class="bishop-layer bishop-body" data-testid="bishop-body">{@html bodyArtwork}</div>
      <div class="bishop-layer bishop-arm bishop-arm-left" data-testid="bishop-arm-left">{@html leftArmArtwork}</div>
      <div class="bishop-layer bishop-arm bishop-arm-right" data-testid="bishop-arm-right">{@html rightArmArtwork}</div>
      <div class="bishop-layer bishop-weapon" data-testid="bishop-weapon">{@html weaponArtwork}</div>
      <div class="bishop-layer bishop-head" data-testid="bishop-head">{@html headArtwork}</div>
      <div class="bishop-layer bishop-helmet" data-testid="bishop-helmet">{@html helmetArtwork}</div>
      <div class="bishop-layer bishop-face-rig" data-testid="bishop-face-rig">
        <div class="bishop-face-expression" data-testid="bishop-face-expression">
          {@html faceArtwork}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .bishop-character {
    --bishop-ink: #211e2f;
    --bishop-robe: #6b46c1;
    --bishop-robe-shadow: #44337a;
    --bishop-cowl: #805ad5;
    --bishop-stole: #edf2f7;
    --bishop-stole-shadow: #cbd5e0;
    --bishop-gold: #ecc94b;
    --bishop-gold-shadow: #b7791f;
    --bishop-magic: #4fd1c5;
    --bishop-magic-bright: #e6fffa;
    --bishop-skin: #fbd38d;
    --bishop-skin-shadow: #dd6b20;
    --bishop-boot: #2d3748;

    position: relative;
    display: inline-block;
    width: var(--bishop-size);
    height: var(--bishop-size);
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark {
    --bishop-ink: #120e24;
    --bishop-robe: #2b1f47;
    --bishop-robe-shadow: #19102c;
    --bishop-cowl: #3c295f;
    --bishop-stole: #4a5568;
    --bishop-stole-shadow: #2d3748;
    --bishop-gold: #c05621;
    --bishop-gold-shadow: #7b341e;
    --bishop-magic: #ed64a6;
    --bishop-magic-bright: #fff5f7;
    --bishop-skin: #b7791f;
    --bishop-skin-shadow: #744210;
    --bishop-boot: #1a202c;
  }

  .bishop-shadow {
    position: absolute;
    z-index: 0;
    left: 20%;
    bottom: 2%;
    width: 60%;
    height: 14%;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(17, 13, 29, 0.45) 0%, rgba(17, 13, 29, 0) 72%);
    transform-origin: 50% 50%;
    pointer-events: none;
  }

  .bishop-action-rig {
    position: relative;
    width: 100%;
    height: 100%;
    transform-origin: 50% 88%;
  }

  .bishop-expression-rig {
    position: absolute;
    inset: 0;
    transform-origin: 50% 50%;
  }

  .bishop-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .bishop-layer :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* Z-Index Hierarchy */
  .bishop-leg-left { z-index: 1; transform-origin: 40% 86%; }
  .bishop-leg-right { z-index: 1; transform-origin: 62% 86%; }
  .bishop-body { z-index: 2; transform-origin: 50% 65%; }
  .bishop-arm-left { z-index: 4; transform-origin: 32% 64%; }
  .bishop-arm-right { z-index: 3; transform-origin: 74% 64%; }
  .bishop-weapon { z-index: 5; transform-origin: 80% 68%; }
  .bishop-head { z-index: 6; transform-origin: 50% 42%; }
  .bishop-helmet { z-index: 7; transform-origin: 50% 30%; }
  .bishop-face-rig { z-index: 8; transform-origin: 50% 42%; }
  .bishop-face-expression { width: 100%; height: 100%; }

  /* =========================================================================
     ANIMATION RIG: IDLE (Mystical Levitation & Ethereal Breathing)
     ========================================================================= */
  .animation-idle .bishop-action-rig {
    animation: bishopIdleFloat 3.4s ease-in-out infinite;
  }

  .animation-idle .bishop-shadow {
    animation: bishopIdleShadow 3.4s ease-in-out infinite;
  }

  .animation-idle .bishop-arm-left {
    animation: bishopOrbHover 2.6s ease-in-out infinite;
  }

  .animation-idle .bishop-weapon {
    animation: bishopStaffSway 3.4s ease-in-out infinite;
  }

  .animation-idle .bishop-face-rig {
    animation: bishopIdleBlink 4.8s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: WALK (Mystical Gliding Hover & Robe Drift)
     ========================================================================= */
  .animation-walk .bishop-action-rig {
    animation: bishopWalkGlide 1.1s cubic-bezier(0.4, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .bishop-body {
    animation: bishopWalkRobe 1.1s ease-in-out infinite;
  }

  .animation-walk .bishop-leg-left {
    animation: bishopWalkFootL 1.1s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .bishop-leg-right {
    animation: bishopWalkFootR 1.1s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .bishop-arm-left {
    animation: bishopWalkOrb 1.1s ease-in-out infinite;
  }

  .animation-walk .bishop-weapon {
    animation: bishopWalkStaff 1.1s ease-in-out infinite;
  }

  .animation-walk .bishop-shadow {
    animation: bishopWalkShadow 1.1s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: ATTACK (Arcane Charge & Spell Projectile Cast)
     ========================================================================= */
  .animation-attack .bishop-action-rig {
    animation: bishopAttackCast 1.05s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .bishop-arm-left {
    animation: bishopAttackOrbChannel 1.05s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .bishop-weapon {
    animation: bishopAttackStaffThrust 1.05s cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
  }

  .animation-attack .bishop-helmet {
    animation: bishopAttackMitreTilt 1.05s ease-in-out forwards;
  }

  /* =========================================================================
     ANIMATION RIG: DEATH (Arcane Fizzle & Dissolution Collapse)
     ========================================================================= */
  .animation-death .bishop-action-rig {
    animation: bishopDefeatCollapse 1.15s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animation-death .bishop-weapon {
    animation: bishopDefeatStaffDrop 1.15s ease-out forwards;
  }

  .animation-death .bishop-arm-left {
    animation: bishopDefeatOrbFizzle 1.15s ease-out forwards;
  }

  .animation-death .bishop-helmet {
    animation: bishopDefeatMitreFall 1.15s ease-out forwards;
  }

  .animation-death .bishop-shadow {
    animation: bishopDefeatShadow 1.15s ease-out forwards;
  }

  /* =========================================================================
     EXPRESSION ACCENTS (Decoupled on .bishop-face-expression)
     ========================================================================= */
  .expression-happy .bishop-face-expression {
    animation: bishopFaceTriumph 2s ease-in-out infinite;
  }

  .expression-scared .bishop-face-expression {
    animation: bishopFaceShiver 0.25s linear infinite;
  }

  .expression-angry .bishop-face-expression {
    animation: bishopFaceIncantation 1.2s ease-in-out infinite;
  }

  /* =========================================================================
     KEYFRAME DEFINITIONS
     ========================================================================= */
  @keyframes bishopIdleFloat {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-7px) rotate(1deg); }
  }

  @keyframes bishopIdleShadow {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(0.85); opacity: 0.6; }
  }

  @keyframes bishopOrbHover {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-5px) rotate(-3deg); }
  }

  @keyframes bishopStaffSway {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(2.5deg) translateY(-2px); }
  }

  @keyframes bishopIdleBlink {
    0%, 94%, 98%, 100% { transform: scaleY(1); }
    96% { transform: scaleY(0.12); }
  }

  @keyframes bishopWalkGlide {
    0%, 100% { transform: translateY(-2px) rotate(-1.5deg); }
    50% { transform: translateY(-8px) rotate(1.5deg); }
  }

  @keyframes bishopWalkRobe {
    0%, 100% { transform: skewX(-2deg); }
    50% { transform: skewX(2deg); }
  }

  @keyframes bishopWalkFootL {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px) translateX(-2px); }
  }

  @keyframes bishopWalkFootR {
    0%, 100% { transform: translateY(-5px) translateX(2px); }
    50% { transform: translateY(0); }
  }

  @keyframes bishopWalkOrb {
    0%, 100% { transform: translate(-3px, -2px) scale(0.96); }
    50% { transform: translate(3px, -6px) scale(1.04); }
  }

  @keyframes bishopWalkStaff {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(4deg); }
  }

  @keyframes bishopWalkShadow {
    0%, 100% { transform: scale(0.9) translateX(-4px); }
    50% { transform: scale(0.8) translateX(4px); }
  }

  /* Attack: Channel -> Forward Blast -> Mystical Recovery */
  @keyframes bishopAttackCast {
    0% { transform: translate(0, 0) scale(1); }
    22% { transform: translate(-10px, -4px) rotate(-6deg) scale(0.96); } /* Channel step */
    45% { transform: translate(18px, -2px) rotate(4deg) scale(1.08); }  /* Spell release burst */
    70% { transform: translate(12px, 0) rotate(2deg) scale(1.04); }
    100% { transform: translate(0, 0) scale(1); }
  }

  @keyframes bishopAttackOrbChannel {
    0% { transform: translate(0, 0) scale(1); }
    22% { transform: translate(-8px, -12px) scale(1.3) rotate(-15deg); } /* Orb swells with energy */
    45% { transform: translate(24px, 4px) scale(1.4) rotate(10deg); }   /* Projectile launch */
    75% { transform: translate(6px, 0) scale(1.05); }
    100% { transform: translate(0, 0) scale(1); }
  }

  @keyframes bishopAttackStaffThrust {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(-12deg) translateY(-8px); }
    45% { transform: rotate(18deg) translate(14px, 4px); }
    75% { transform: rotate(6deg) translate(4px, 0); }
    100% { transform: rotate(0deg); }
  }

  @keyframes bishopAttackMitreTilt {
    0%, 100% { transform: rotate(0deg); }
    22% { transform: rotate(-4deg); }
    45% { transform: rotate(5deg); }
  }

  /* Defeat: Dissolution & Collapse */
  @keyframes bishopDefeatCollapse {
    0% { transform: scale(1) translateY(0); opacity: 1; filter: none; }
    30% { transform: scale(1.05) translateY(-8px) rotate(-8deg); filter: brightness(1.4); }
    60% { transform: scale(0.9) translateY(12px) rotate(14deg); opacity: 0.8; }
    100% { transform: scale(0.7) translateY(24px) rotate(18deg); opacity: 0.35; filter: grayscale(0.5); }
  }

  @keyframes bishopDefeatStaffDrop {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(65deg) translate(30px, 35px); opacity: 0.4; }
  }

  @keyframes bishopDefeatOrbFizzle {
    0% { transform: scale(1); opacity: 1; }
    35% { transform: scale(1.5); opacity: 1; filter: brightness(2); }
    100% { transform: scale(0.1); opacity: 0; }
  }

  @keyframes bishopDefeatMitreFall {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-22deg) translate(-10px, 14px); }
  }

  @keyframes bishopDefeatShadow {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(0.5) translateX(-10px); opacity: 0.2; }
  }

  @keyframes bishopFaceTriumph {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @keyframes bishopFaceShiver {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1.5px, 0.5px); }
    50% { transform: translate(1.5px, -1px); }
    75% { transform: translate(-1px, -0.5px); }
  }

  @keyframes bishopFaceIncantation {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04) translateY(-1px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .bishop-character,
    .bishop-character * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
