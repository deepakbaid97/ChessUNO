<script lang="ts">
  import bodyArtwork from '../../assets/characters/knight/illustrated/body.svg?raw';
  import headArtwork from '../../assets/characters/knight/illustrated/head.svg?raw';
  import helmetArtwork from '../../assets/characters/knight/illustrated/helmet.svg?raw';
  import leftLegArtwork from '../../assets/characters/knight/illustrated/leg-left.svg?raw';
  import rightLegArtwork from '../../assets/characters/knight/illustrated/leg-right.svg?raw';
  import leftArmArtwork from '../../assets/characters/knight/illustrated/arm-left.svg?raw';
  import rightArmArtwork from '../../assets/characters/knight/illustrated/arm-right.svg?raw';
  import weaponArtwork from '../../assets/characters/knight/illustrated/weapon.svg?raw';
  import neutralFace from '../../assets/characters/knight/illustrated/face-neutral.svg?raw';
  import happyFace from '../../assets/characters/knight/illustrated/face-happy.svg?raw';
  import scaredFace from '../../assets/characters/knight/illustrated/face-scared.svg?raw';
  import angryFace from '../../assets/characters/knight/illustrated/face-angry.svg?raw';

  export type KnightExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type KnightAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type KnightTeam = 'light' | 'dark';

  export let expression: KnightExpression = 'neutral';
  export let animation: KnightAnimation = 'idle';
  export let team: KnightTeam = 'light';
  export let size = 180;
  export let label = 'Chess knight character';
  export let testId = 'knight-character';

  $: faceArtwork = { neutral: neutralFace, happy: happyFace, scared: scaredFace, angry: angryFace }[expression];
</script>

<div
  class="knight-character team-{team} expression-{expression} animation-{animation}"
  style="--knight-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid={testId}
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="knight-shadow" aria-hidden="true"></div>
  <div class="knight-action-rig" aria-hidden="true">
    <div class="knight-expression-rig">
      <div class="knight-layer knight-leg knight-leg-left" data-testid="knight-leg-left">{@html leftLegArtwork}</div>
      <div class="knight-layer knight-leg knight-leg-right" data-testid="knight-leg-right">{@html rightLegArtwork}</div>
      <div class="knight-layer knight-body" data-testid="knight-body">{@html bodyArtwork}</div>
      <div class="knight-layer knight-shield knight-arm-left" data-testid="knight-arm-left">{@html leftArmArtwork}</div>
      <div class="knight-layer knight-arm knight-arm-right" data-testid="knight-arm-right">{@html rightArmArtwork}</div>
      <div class="knight-layer knight-weapon" data-testid="knight-weapon">{@html weaponArtwork}</div>
      <div class="knight-layer knight-head" data-testid="knight-head">{@html headArtwork}</div>
      <div class="knight-layer knight-helmet" data-testid="knight-helmet">{@html helmetArtwork}</div>
      <div class="knight-layer knight-face-rig" data-testid="knight-face-rig">
        <div class="knight-face-expression" data-testid="knight-face-expression">
          {@html faceArtwork}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .knight-character {
    --knight-ink: #231c38;
    --knight-skin: #f5bc8c;
    --knight-skin-shadow: #d78461;
    --knight-cloth: #3578c4;
    --knight-cloth-light: #629de4;
    --knight-cloth-shadow: #1c4b82;
    --knight-metal: #e6eef5;
    --knight-metal-shadow: #9bb1c4;
    --knight-gold: #f5c542;
    --knight-belt: #4a384e;
    --knight-boot: #3c3247;
    --knight-plume: #e63946;
    --knight-plume-shadow: #9b1c1c;

    position: relative;
    display: inline-block;
    width: var(--knight-size);
    height: var(--knight-size);
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark {
    --knight-ink: #191427;
    --knight-skin: #c27a5e;
    --knight-skin-shadow: #874936;
    --knight-cloth: #6b3b75;
    --knight-cloth-light: #9458a0;
    --knight-cloth-shadow: #411e48;
    --knight-metal: #858b9c;
    --knight-metal-shadow: #4d5162;
    --knight-gold: #d4a03e;
    --knight-belt: #352538;
    --knight-boot: #282033;
    --knight-plume: #9d2b6b;
    --knight-plume-shadow: #5d143c;
  }

  .knight-shadow {
    position: absolute;
    z-index: 0;
    left: 20%;
    bottom: 4%;
    width: 60%;
    height: 12%;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(17, 12, 28, 0.42) 0%, rgba(17, 12, 28, 0) 72%);
    transform-origin: center center;
    transition: transform 0.25s ease;
  }

  .knight-action-rig {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    transform-origin: 50% 90%;
  }

  .knight-expression-rig {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .knight-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .knight-layer :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  /* Layer stacking order */
  .knight-leg-left { z-index: 2; transform-origin: 38% 75%; }
  .knight-leg-right { z-index: 2; transform-origin: 62% 75%; }
  .knight-body { z-index: 4; transform-origin: 50% 65%; }
  .knight-shield { z-index: 7; transform-origin: 32% 60%; }
  .knight-arm-right { z-index: 5; transform-origin: 75% 55%; }
  .knight-weapon { z-index: 6; transform-origin: 80% 70%; }
  .knight-head { z-index: 8; transform-origin: 50% 45%; }
  .knight-helmet { z-index: 9; transform-origin: 50% 30%; }
  .knight-face-rig { z-index: 10; transform-origin: 50% 48%; }
  .knight-face-expression { width: 100%; height: 100%; }

  /* =========================================================================
     ANIMATION RIG: IDLE (Heroic Warrior Breathing & Subtle Weapon Tilt)
     ========================================================================= */
  .animation-idle .knight-action-rig {
    animation: knightIdleBreath 2.6s ease-in-out infinite;
  }

  .animation-idle .knight-shadow {
    animation: knightShadowPulse 2.6s ease-in-out infinite;
  }

  .animation-idle .knight-helmet {
    animation: knightPlumeSway 2.6s ease-in-out infinite;
  }

  .animation-idle .knight-weapon {
    animation: knightSwordBalance 2.6s ease-in-out infinite;
  }

  .animation-idle .knight-shield {
    animation: knightShieldGuard 2.6s ease-in-out infinite;
  }

  .animation-idle .knight-face-rig {
    animation: knightIdleBlink 4.2s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: WALK (Energetic Gallop / Bounding Knight Stride)
     ========================================================================= */
  .animation-walk .knight-action-rig {
    animation: knightGallopBob 0.64s cubic-bezier(0.38, 0.1, 0.22, 1) infinite;
  }

  .animation-walk .knight-leg-left {
    animation: knightGallopLegL 0.64s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .knight-leg-right {
    animation: knightGallopLegR 0.64s cubic-bezier(0.35, 0.1, 0.25, 1) infinite;
  }

  .animation-walk .knight-shield {
    animation: knightGallopShield 0.64s ease-in-out infinite;
  }

  .animation-walk .knight-weapon {
    animation: knightGallopSword 0.64s ease-in-out infinite;
  }

  .animation-walk .knight-helmet {
    animation: knightGallopPlume 0.64s ease-in-out infinite;
  }

  .animation-walk .knight-shadow {
    animation: knightGallopShadow 0.64s ease-in-out infinite;
  }

  /* =========================================================================
     ANIMATION RIG: ATTACK (Reckless Lunge & Mighty Downward Slash)
     ========================================================================= */
  .animation-attack .knight-action-rig {
    animation: knightAttackLunge 0.88s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
  }

  .animation-attack .knight-weapon {
    animation: knightAttackSlash 0.88s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
  }

  .animation-attack .knight-arm-right {
    animation: knightAttackArm 0.88s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
  }

  .animation-attack .knight-shield {
    animation: knightAttackShield 0.88s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
  }

  .animation-attack .knight-helmet {
    animation: knightAttackHelmet 0.88s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
  }

  /* =========================================================================
     ANIMATION RIG: DEATH (Staggered Stumble, Dropped Shield & Dazed Defeat)
     ========================================================================= */
  .animation-death .knight-action-rig {
    animation: knightDefeatFall 1.05s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animation-death .knight-shield {
    animation: knightDefeatShield 1.05s ease-out forwards;
  }

  .animation-death .knight-weapon {
    animation: knightDefeatWeapon 1.05s ease-out forwards;
  }

  .animation-death .knight-helmet {
    animation: knightDefeatHelmet 1.05s ease-out forwards;
  }

  .animation-death .knight-shadow {
    animation: knightDefeatShadow 1.05s ease-out forwards;
  }

  /* =========================================================================
     EXPRESSION ACCENTS (Decoupled on .knight-face-expression)
     ========================================================================= */
  .expression-happy .knight-face-expression {
    animation: knightFaceVictory 1.4s ease-in-out infinite;
  }

  .expression-scared .knight-face-expression {
    animation: knightFacePanic 0.14s ease-in-out infinite;
  }

  .expression-angry .knight-face-expression {
    animation: knightFaceRoar 1.8s ease-in-out infinite;
  }

  /* =========================================================================
     KEYFRAMES
     ========================================================================= */
  @keyframes knightIdleBreath {
    0%, 100% { transform: translateY(0) scaleY(1); }
    50% { transform: translateY(-3px) scaleY(1.02); }
  }

  @keyframes knightShadowPulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(0.94); opacity: 0.75; }
  }

  @keyframes knightPlumeSway {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-2.5deg) translateY(-1px); }
  }

  @keyframes knightSwordBalance {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(2deg) translateY(-2px); }
  }

  @keyframes knightShieldGuard {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-1.5deg) translateY(-1px); }
  }

  @keyframes knightIdleBlink {
    0%, 88%, 94%, 100% { transform: scaleY(1); }
    91% { transform: scaleY(0.12); }
  }

  @keyframes knightGallopBob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-9px) rotate(2deg); }
    50% { transform: translateY(-2px) rotate(-1deg); }
    75% { transform: translateY(-12px) rotate(3deg); }
  }

  @keyframes knightGallopLegL {
    0%, 100% { transform: rotate(-14deg) translateY(0); }
    50% { transform: rotate(18deg) translateY(-6px); }
  }

  @keyframes knightGallopLegR {
    0%, 100% { transform: rotate(18deg) translateY(-6px); }
    50% { transform: rotate(-14deg) translateY(0); }
  }

  @keyframes knightGallopShield {
    0%, 100% { transform: rotate(-2deg) translateY(0); }
    50% { transform: rotate(4deg) translateY(-4px); }
  }

  @keyframes knightGallopSword {
    0%, 100% { transform: rotate(5deg) translateY(0); }
    50% { transform: rotate(-8deg) translateY(-5px); }
  }

  @keyframes knightGallopPlume {
    0%, 100% { transform: rotate(-4deg); }
    50% { transform: rotate(6deg); }
  }

  @keyframes knightGallopShadow {
    0%, 50%, 100% { transform: scale(1); opacity: 0.9; }
    25%, 75% { transform: scale(0.78); opacity: 0.6; }
  }

  @keyframes knightAttackLunge {
    0% { transform: translateX(0) rotate(0deg); }
    22% { transform: translateX(-16px) rotate(-5deg); }
    45% { transform: translateX(28px) translateY(-4px) rotate(4deg); }
    65% { transform: translateX(20px) translateY(0) rotate(2deg); }
    100% { transform: translateX(12px) translateY(0) rotate(0deg); }
  }

  @keyframes knightAttackSlash {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(-28deg) translateY(-14px); }
    45% { transform: rotate(48deg) translateX(12px) translateY(10px); }
    70% { transform: rotate(24deg) translateX(6px); }
    100% { transform: rotate(12deg); }
  }

  @keyframes knightAttackArm {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(-22deg); }
    45% { transform: rotate(35deg); }
    100% { transform: rotate(10deg); }
  }

  @keyframes knightAttackShield {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(12deg) translateY(-4px); }
    45% { transform: rotate(-10deg) translateX(-8px); }
    100% { transform: rotate(0deg); }
  }

  @keyframes knightAttackHelmet {
    0% { transform: rotate(0deg); }
    22% { transform: rotate(-8deg); }
    45% { transform: rotate(8deg); }
    100% { transform: rotate(0deg); }
  }

  @keyframes knightDefeatFall {
    0% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(-14px, -8px) rotate(-12deg); }
    60% { transform: translate(-28px, 12px) rotate(-32deg); }
    100% { transform: translate(-38px, 26px) rotate(-45deg); opacity: 0.35; }
  }

  @keyframes knightDefeatShield {
    0% { transform: rotate(0deg); }
    30% { transform: rotate(-20deg) translateX(-10px); }
    100% { transform: rotate(-55deg) translateX(-24px) translateY(22px); opacity: 0.4; }
  }

  @keyframes knightDefeatWeapon {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(25deg) translateY(-8px); }
    100% { transform: rotate(80deg) translateX(18px) translateY(28px); opacity: 0.3; }
  }

  @keyframes knightDefeatHelmet {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(-18deg) translateY(8px); }
  }

  @keyframes knightDefeatShadow {
    0% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(0.55) translateX(-20px); opacity: 0.3; }
  }

  @keyframes knightFaceVictory {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  @keyframes knightFacePanic {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-1.5px, 0.5px); }
    50% { transform: translate(1.5px, -1px); }
    75% { transform: translate(-1px, -0.5px); }
  }

  @keyframes knightFaceRoar {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @media (prefers-reduced-motion: reduce) {
    .knight-character,
    .knight-character * {
      animation: none !important;
      transition: none !important;
    }
  }
</style>

