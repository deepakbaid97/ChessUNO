<script lang="ts">
  import bodyArtwork from '../../assets/characters/pawn/illustrated/body.svg?raw';
  import headArtwork from '../../assets/characters/pawn/illustrated/head.svg?raw';
  import helmetArtwork from '../../assets/characters/pawn/illustrated/helmet.svg?raw';
  import leftArmArtwork from '../../assets/characters/pawn/illustrated/arm-left.svg?raw';
  import rightArmArtwork from '../../assets/characters/pawn/illustrated/arm-right.svg?raw';
  import leftLegArtwork from '../../assets/characters/pawn/illustrated/leg-left.svg?raw';
  import rightLegArtwork from '../../assets/characters/pawn/illustrated/leg-right.svg?raw';
  import weaponArtwork from '../../assets/characters/pawn/illustrated/weapon.svg?raw';
  import neutralFace from '../../assets/characters/pawn/illustrated/face-neutral.svg?raw';
  import happyFace from '../../assets/characters/pawn/illustrated/face-happy.svg?raw';
  import scaredFace from '../../assets/characters/pawn/illustrated/face-scared.svg?raw';
  import angryFace from '../../assets/characters/pawn/illustrated/face-angry.svg?raw';

  export type PawnExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type PawnAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type PawnTeam = 'light' | 'dark';

  export let expression: PawnExpression = 'neutral';
  export let animation: PawnAnimation = 'idle';
  export let team: PawnTeam = 'light';
  export let size = 180;
  export let label = 'Chess pawn character';
  export let testId = 'pawn-character';

  $: faceArtwork = { neutral: neutralFace, happy: happyFace, scared: scaredFace, angry: angryFace }[expression];
</script>

<div
  class="pawn-character team-{team} expression-{expression} animation-{animation}"
  style="--pawn-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid={testId}
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="pawn-shadow" aria-hidden="true"></div>
  <div class="pawn-action-rig" aria-hidden="true">
    <div class="pawn-expression-rig">
      <div class="pawn-layer pawn-leg pawn-leg-left" data-testid="pawn-leg-left">{@html leftLegArtwork}</div>
      <div class="pawn-layer pawn-leg pawn-leg-right" data-testid="pawn-leg-right">{@html rightLegArtwork}</div>
      <div class="pawn-layer pawn-body" data-testid="pawn-body">{@html bodyArtwork}</div>
      <div class="pawn-layer pawn-arm pawn-arm-left" data-testid="pawn-arm-left">{@html leftArmArtwork}</div>
      <div class="pawn-layer pawn-arm pawn-arm-right" data-testid="pawn-arm-right">{@html rightArmArtwork}</div>
      <div class="pawn-layer pawn-weapon" data-testid="pawn-weapon">{@html weaponArtwork}</div>
      <div class="pawn-layer pawn-head" data-testid="pawn-head">{@html headArtwork}</div>
      <div class="pawn-layer pawn-helmet" data-testid="pawn-helmet">{@html helmetArtwork}</div>
      <div class="pawn-layer pawn-face-rig" data-testid="pawn-face-rig">{@html faceArtwork}</div>
    </div>
  </div>
</div>

<style>
  .pawn-character {
    --pawn-ink: #29233d;
    --pawn-skin: #f4b783;
    --pawn-skin-shadow: #d78461;
    --pawn-cloth: #4f96cb;
    --pawn-cloth-light: #79bce7;
    --pawn-cloth-shadow: #2e689f;
    --pawn-metal: #e4edf2;
    --pawn-metal-shadow: #9eb4c3;
    --pawn-gold: #f2c858;
    --pawn-belt: #51394c;
    --pawn-boot: #463650;
    --pawn-hair: #714958;
    --pawn-blush: #ed8d91;
    position: relative;
    display: inline-block;
    width: var(--pawn-size);
    height: var(--pawn-size);
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark {
    --pawn-skin: #bb745c;
    --pawn-skin-shadow: #804838;
    --pawn-cloth: #6d5d9d;
    --pawn-cloth-light: #998bc4;
    --pawn-cloth-shadow: #43356e;
    --pawn-metal: #a8b4c8;
    --pawn-metal-shadow: #68748d;
    --pawn-gold: #dcae52;
    --pawn-belt: #392b48;
    --pawn-boot: #302a42;
    --pawn-hair: #392a43;
    --pawn-blush: #a95b70;
  }

  .pawn-shadow {
    position: absolute;
    z-index: 0;
    width: 52%;
    height: 7%;
    left: 24%;
    bottom: 5%;
    border-radius: 50%;
    background: rgba(22, 16, 34, 0.32);
    filter: blur(3px);
  }

  .pawn-action-rig,
  .pawn-expression-rig,
  .pawn-layer {
    position: absolute;
    inset: 0;
  }

  .pawn-action-rig,
  .pawn-expression-rig {
    transform-origin: 50% 88%;
  }

  .pawn-layer {
    transform-origin: 50% 70%;
  }

  .pawn-layer :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .pawn-leg {
    z-index: 1;
    transform-origin: 50% 79%;
  }

  .pawn-body {
    z-index: 3;
  }

  .pawn-arm {
    z-index: 4;
    transform-origin: 50% 54%;
  }

  .pawn-head {
    z-index: 5;
  }

  .pawn-helmet {
    z-index: 7;
  }

  .pawn-face-rig {
    z-index: 6;
    transform-origin: 50% 48%;
  }

  .pawn-weapon {
    z-index: 2;
    opacity: 0;
    transform-origin: 72% 73%;
  }

  /* Idle Animations */
  .animation-idle .pawn-action-rig {
    animation: pawn-breathe 2.4s ease-in-out infinite;
  }

  .animation-idle .pawn-face-rig {
    animation: pawn-blink 4.8s step-end infinite;
  }

  /* Walk Animations */
  .animation-walk .pawn-action-rig {
    animation: pawn-walk-bounce 0.52s ease-in-out infinite;
  }

  .animation-walk .pawn-leg-left {
    animation: pawn-step-left 0.52s ease-in-out infinite;
  }

  .animation-walk .pawn-leg-right {
    animation: pawn-step-right 0.52s ease-in-out infinite;
  }

  .animation-walk .pawn-arm-left {
    animation: pawn-arm-left 0.52s ease-in-out infinite;
  }

  .animation-walk .pawn-arm-right {
    animation: pawn-arm-right 0.52s ease-in-out infinite;
  }

  /* Attack Animations */
  .animation-attack .pawn-action-rig {
    animation: pawn-lunge 0.8s cubic-bezier(0.18, 0.9, 0.28, 1) both;
  }

  .animation-attack .pawn-arm-right {
    animation: pawn-strike-arm 0.8s cubic-bezier(0.18, 0.9, 0.28, 1) both;
  }

  .animation-attack .pawn-weapon {
    opacity: 1;
    animation: pawn-sword-swing 0.8s cubic-bezier(0.18, 0.9, 0.28, 1) both;
  }

  /* Death Animations */
  .animation-death .pawn-action-rig {
    animation: pawn-fall 1s cubic-bezier(0.25, 0.7, 0.32, 1) both;
  }

  .animation-death .pawn-shadow {
    animation: pawn-shadow-fade 1s ease-out both;
  }

  /* Expression Overlays */
  .expression-happy .pawn-face-rig {
    animation: pawn-face-delight 0.58s ease-in-out infinite;
  }

  .expression-scared .pawn-face-rig {
    animation: pawn-tremble 0.12s linear infinite;
  }

  .expression-angry .pawn-face-rig {
    animation: pawn-angry 0.19s ease-in-out 5;
  }

  @keyframes pawn-breathe {
    0%, 100% {
      transform: translateY(0) scaleY(1);
    }
    50% {
      transform: translateY(1%) scaleY(1.025);
    }
  }

  @keyframes pawn-blink {
    0%, 91%, 100% {
      transform: scaleY(1);
    }
    94%, 97% {
      transform: scaleY(0.08);
    }
  }

  @keyframes pawn-walk-bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-7%);
    }
  }

  @keyframes pawn-step-left {
    0%, 100% {
      transform: rotate(4deg);
    }
    50% {
      transform: rotate(-8deg);
    }
  }

  @keyframes pawn-step-right {
    0%, 100% {
      transform: rotate(-8deg);
    }
    50% {
      transform: rotate(4deg);
    }
  }

  @keyframes pawn-arm-left {
    0%, 100% {
      transform: rotate(7deg);
    }
    50% {
      transform: rotate(-12deg);
    }
  }

  @keyframes pawn-arm-right {
    0%, 100% {
      transform: rotate(-7deg);
    }
    50% {
      transform: rotate(12deg);
    }
  }

  @keyframes pawn-lunge {
    0% {
      transform: translateX(0) rotate(0);
    }
    22% {
      transform: translateX(-7%) rotate(-7deg);
    }
    58% {
      transform: translateX(20%) rotate(8deg);
    }
    100% {
      transform: translateX(0) rotate(0);
    }
  }

  @keyframes pawn-sword-swing {
    0%, 22% {
      transform: rotate(0);
      opacity: 0;
    }
    28% {
      opacity: 1;
    }
    58% {
      transform: rotate(-62deg);
      opacity: 1;
    }
    100% {
      transform: rotate(0);
      opacity: 0;
    }
  }

  @keyframes pawn-strike-arm {
    0%, 22% {
      transform: rotate(0);
    }
    58% {
      transform: rotate(-34deg);
    }
    100% {
      transform: rotate(0);
    }
  }

  @keyframes pawn-fall {
    0% {
      transform: rotate(0) translate(0);
      opacity: 1;
    }
    34% {
      transform: rotate(-10deg) translate(-2%, -4%);
    }
    100% {
      transform: rotate(76deg) translate(18%, 14%);
      opacity: 0;
    }
  }

  @keyframes pawn-shadow-fade {
    to {
      transform: scale(0.45);
      opacity: 0;
    }
  }

  @keyframes pawn-face-delight {
    50% {
      transform: scale(1.045, 0.96);
    }
  }

  @keyframes pawn-tremble {
    0%, 100% {
      transform: translateX(-2%) rotate(-1deg);
    }
    50% {
      transform: translateX(2%) rotate(1deg);
    }
  }

  @keyframes pawn-angry {
    0%, 100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-3%);
    }
    75% {
      transform: translateX(3%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pawn-character *,
    .pawn-character {
      animation: none !important;
    }
  }
</style>
