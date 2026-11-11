<script lang="ts">
  /**
   * Temporary layered CSS artwork. Final transparent PNG/WebP layers can replace
   * the matching elements without changing this component's public API.
   */
  export type PawnExpression = 'neutral' | 'happy' | 'scared' | 'angry';
  export type PawnAnimation = 'idle' | 'walk' | 'attack' | 'death';
  export type PawnTeam = 'light' | 'dark';

  export let expression: PawnExpression = 'neutral';
  export let animation: PawnAnimation = 'idle';
  export let team: PawnTeam = 'light';
  export let size = 180;
  export let label = 'Chess pawn character';
</script>

<div
  class="pawn-character team-{team} expression-{expression} animation-{animation}"
  style="--pawn-size: {size}px;"
  role="img"
  aria-label="{label}, {team} team, {expression} expression, {animation} animation"
  data-testid="pawn-character"
  data-team={team}
  data-expression={expression}
  data-animation={animation}
>
  <div class="pawn-shadow" aria-hidden="true"></div>
  <div class="pawn-action-rig" aria-hidden="true">
    <div class="pawn-expression-rig">
      <div class="pawn-leg pawn-leg-left"></div>
      <div class="pawn-leg pawn-leg-right"></div>
      <div class="pawn-body">
        <div class="pawn-belt"><span></span></div>
      </div>
      <div class="pawn-arm pawn-arm-left"><span class="pawn-hand"></span></div>
      <div class="pawn-arm pawn-arm-right"><span class="pawn-hand"></span></div>
      <div class="pawn-sword"><span class="pawn-sword-grip"></span><span class="pawn-sword-blade"></span></div>
      <div class="pawn-head">
        <div class="pawn-helmet"><span class="pawn-helmet-shine"></span></div>
        <div class="pawn-face-rig" data-testid="pawn-face-rig">
          <div class="pawn-face" data-testid="pawn-face">
            <span class="pawn-eye pawn-eye-left" data-testid="pawn-eye-left"></span>
            <span class="pawn-eye pawn-eye-right" data-testid="pawn-eye-right"></span>
            <span class="pawn-brow pawn-brow-left" data-testid="pawn-brow-left"></span>
            <span class="pawn-brow pawn-brow-right" data-testid="pawn-brow-right"></span>
            <span class="pawn-mouth" data-testid="pawn-mouth"></span>
            <span class="pawn-cheek pawn-cheek-left" data-testid="pawn-cheek-left"></span>
            <span class="pawn-cheek pawn-cheek-right" data-testid="pawn-cheek-right"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .pawn-character {
    --ink: #302535;
    --skin: #f5ba88;
    --skin-shadow: #dd865f;
    --cloth: #5d9bce;
    --cloth-shadow: #356d9f;
    --metal: #d9e4ec;
    --metal-shadow: #91a4b1;
    position: relative;
    width: var(--pawn-size);
    height: var(--pawn-size);
    display: inline-block;
    isolation: isolate;
    user-select: none;
    pointer-events: none;
  }

  .team-dark { --skin: #c77e60; --skin-shadow: #894936; --cloth: #755b9f; --cloth-shadow: #44366f; --metal: #8392ad; --metal-shadow: #505a70; }
  .pawn-shadow { position: absolute; z-index: 0; width: 52%; height: 8%; border-radius: 50%; background: rgba(28, 17, 34, .28); left: 24%; bottom: 5%; filter: blur(3px); }
  /* Action and expression transforms intentionally live on separate nested rigs. */
  .pawn-action-rig, .pawn-expression-rig { position: absolute; inset: 0; transform-origin: 50% 88%; }
  .pawn-face-rig { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 50% 62%; }
  .pawn-head, .pawn-body, .pawn-leg, .pawn-arm, .pawn-sword { position: absolute; box-sizing: border-box; }
  .pawn-leg { width: 15%; height: 25%; bottom: 12%; border: calc(var(--pawn-size) * .018) solid var(--ink); border-radius: 45% 45% 36% 36%; background: var(--cloth-shadow); transform-origin: 50% 8%; z-index: 1; }
  .pawn-leg-left { left: 35%; } .pawn-leg-right { right: 35%; }
  .pawn-body { z-index: 3; width: 47%; height: 37%; left: 26.5%; bottom: 23%; border: calc(var(--pawn-size) * .019) solid var(--ink); border-radius: 44% 44% 31% 31%; background: linear-gradient(100deg, var(--cloth) 0 62%, var(--cloth-shadow) 63%); transform-origin: 50% 90%; }
  .pawn-belt { position: absolute; top: 61%; width: 100%; height: 13%; background: var(--ink); } .pawn-belt span { position: absolute; left: 42%; top: -35%; width: 18%; height: 160%; border: calc(var(--pawn-size) * .01) solid var(--ink); border-radius: 25%; background: #f5c75d; }
  .pawn-arm { z-index: 2; width: 16%; height: 31%; top: 45%; border: calc(var(--pawn-size) * .018) solid var(--ink); border-radius: 48%; background: var(--cloth); transform-origin: 50% 10%; }
  .pawn-arm-left { left: 22%; transform: rotate(16deg); } .pawn-arm-right { right: 22%; transform: rotate(-16deg); }
  .pawn-hand { position: absolute; left: 8%; bottom: -15%; width: 85%; height: 30%; border: calc(var(--pawn-size) * .014) solid var(--ink); border-radius: 50%; background: var(--skin); }
  .pawn-head { z-index: 5; width: 46%; height: 40%; left: 27%; top: 11%; border: calc(var(--pawn-size) * .02) solid var(--ink); border-radius: 48% 48% 44% 44%; background: var(--skin); transform-origin: 50% 95%; }
  .pawn-helmet { position: absolute; z-index: 2; width: 113%; height: 45%; left: -6.5%; top: -18%; border: calc(var(--pawn-size) * .02) solid var(--ink); border-radius: 60% 60% 31% 31%; background: linear-gradient(110deg, var(--metal) 0 53%, var(--metal-shadow) 55%); }
  .pawn-helmet::after { content: ''; position: absolute; width: 24%; height: 56%; left: 38%; top: -45%; border: calc(var(--pawn-size) * .018) solid var(--ink); border-bottom: 0; border-radius: 50% 50% 0 0; background: var(--metal-shadow); }
  .pawn-helmet-shine { position: absolute; width: 25%; height: 20%; left: 20%; top: 23%; border-radius: 50%; background: rgba(255,255,255,.48); transform: rotate(-24deg); }
  /* Every facial percentage resolves against this stable mask, not the moving body. */
  .pawn-face { position: absolute; z-index: 3; width: 84%; height: 57%; left: 8%; bottom: 7%; overflow: visible; border-radius: 0 0 42% 42%; }
  .pawn-eye { position: absolute; width: 14%; height: 25%; top: 16%; border: calc(var(--pawn-size) * .012) solid var(--ink); border-radius: 50%; background: #fffaf1; transform-origin: center; }
  .pawn-eye::after { content: ''; position: absolute; width: 45%; height: 48%; left: 28%; top: 27%; border-radius: 50%; background: var(--ink); }
  .pawn-eye-left { left: 22%; } .pawn-eye-right { right: 22%; }
  .pawn-brow { display: none; position: absolute; z-index: 4; width: 21%; height: 6%; top: 5%; border-radius: 50%; background: var(--ink); transform-origin: center; }
  .pawn-brow-left { left: 18%; transform: rotate(-16deg); } .pawn-brow-right { right: 18%; transform: rotate(16deg); }
  .pawn-mouth { position: absolute; width: 27%; height: 14%; left: 36.5%; bottom: 8%; border-bottom: calc(var(--pawn-size) * .014) solid var(--ink); border-radius: 0 0 50% 50%; }
  .pawn-cheek { display: none; position: absolute; width: 16%; height: 10%; bottom: 20%; border-radius: 50%; background: rgba(224, 104, 104, .55); }.pawn-cheek-left { left: 6%; }.pawn-cheek-right { right: 6%; }
  .pawn-sword { z-index: 1; display: none; width: 10%; height: 47%; top: 31%; right: 11%; transform: rotate(30deg); transform-origin: 50% 88%; }.pawn-sword-grip { position: absolute; width: 175%; height: 10%; left: -38%; bottom: 11%; border: calc(var(--pawn-size) * .012) solid var(--ink); border-radius: 4px; background: #e5b254; }.pawn-sword-blade { position: absolute; width: 46%; height: 83%; left: 27%; top: 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); border: calc(var(--pawn-size) * .012) solid var(--ink); background: #e5eef4; }

  .expression-happy .pawn-mouth { height: 21%; bottom: 7%; background: var(--ink); border: 0; border-radius: 0 0 50% 50%; }.expression-happy .pawn-mouth::after { content: ''; position: absolute; width: 62%; height: 25%; top: 5%; left: 19%; border-radius: 50%; background: #f8dbd0; }.expression-happy .pawn-cheek { display: block; }
  .expression-scared .pawn-eye { width: 18%; height: 31%; top: 10%; }.expression-scared .pawn-mouth { width: 19%; height: 20%; left: 40.5%; bottom: 7%; border: calc(var(--pawn-size) * .014) solid var(--ink); border-radius: 50%; }.expression-scared .pawn-brow { display: block; }.expression-scared .pawn-brow-left { transform: rotate(22deg); }.expression-scared .pawn-brow-right { transform: rotate(-22deg); }
  .expression-angry .pawn-brow { display: block; }.expression-angry .pawn-brow-left { transform: rotate(25deg); }.expression-angry .pawn-brow-right { transform: rotate(-25deg); }.expression-angry .pawn-mouth { width: 26%; left: 37%; bottom: 12%; border-bottom: 0; border-top: calc(var(--pawn-size) * .014) solid var(--ink); border-radius: 50% 50% 0 0; }

  .animation-idle .pawn-action-rig { animation: pawn-breathe 2.4s ease-in-out infinite; }.animation-idle .pawn-eye { animation: pawn-blink 4.8s step-end infinite; }
  .animation-walk .pawn-action-rig { animation: pawn-walk-bounce .52s ease-in-out infinite; }.animation-walk .pawn-leg-left { animation: pawn-step-left .52s ease-in-out infinite; }.animation-walk .pawn-leg-right { animation: pawn-step-right .52s ease-in-out infinite; }.animation-walk .pawn-arm-left { animation: pawn-arm-left .52s ease-in-out infinite; }.animation-walk .pawn-arm-right { animation: pawn-arm-right .52s ease-in-out infinite; }
  .animation-attack .pawn-sword { display: block; animation: pawn-sword-swing .8s cubic-bezier(.18,.9,.28,1) both; }.animation-attack .pawn-action-rig { animation: pawn-lunge .8s cubic-bezier(.18,.9,.28,1) both; }.animation-attack .pawn-arm-right { animation: pawn-strike-arm .8s cubic-bezier(.18,.9,.28,1) both; }
  .animation-death .pawn-action-rig { animation: pawn-fall 1s cubic-bezier(.25,.7,.32,1) both; }.animation-death .pawn-shadow { animation: pawn-shadow-fade 1s ease-out both; }
  .expression-happy .pawn-face-rig { animation: pawn-face-delight .58s ease-in-out infinite; }.expression-scared .pawn-face-rig { animation: pawn-tremble .12s linear infinite; }.expression-angry .pawn-face-rig { animation: pawn-angry .19s ease-in-out 5; }
  @keyframes pawn-breathe { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(1%) scaleY(1.025); } } @keyframes pawn-blink { 0%, 91%, 100% { transform: scaleY(1); } 94%, 97% { transform: scaleY(.08); } }
  @keyframes pawn-walk-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7%); } } @keyframes pawn-step-left { 0%,100% { transform: rotate(19deg); } 50% { transform: rotate(-16deg); } } @keyframes pawn-step-right { 0%,100% { transform: rotate(-16deg); } 50% { transform: rotate(19deg); } } @keyframes pawn-arm-left { 0%,100% { transform: rotate(30deg); } 50% { transform: rotate(-7deg); } } @keyframes pawn-arm-right { 0%,100% { transform: rotate(-30deg); } 50% { transform: rotate(7deg); } }
  @keyframes pawn-lunge { 0% { transform: translateX(0) rotate(0); } 22% { transform: translateX(-7%) rotate(-7deg); } 58% { transform: translateX(20%) rotate(8deg); } 100% { transform: translateX(0) rotate(0); } } @keyframes pawn-sword-swing { 0%,22% { transform: rotate(30deg); } 58% { transform: rotate(-72deg); } 100% { transform: rotate(30deg); } } @keyframes pawn-strike-arm { 0%,22% { transform: rotate(-16deg); } 58% { transform: rotate(-65deg); } 100% { transform: rotate(-16deg); } }
  @keyframes pawn-fall { 0% { transform: rotate(0) translate(0); opacity: 1; } 34% { transform: rotate(-10deg) translate(-2%, -4%); } 100% { transform: rotate(76deg) translate(18%, 14%); opacity: 0; } } @keyframes pawn-shadow-fade { to { transform: scale(.45); opacity: 0; } } @keyframes pawn-face-delight { 50% { transform: scale(1.04, .96); } } @keyframes pawn-tremble { 0%,100% { transform: translateX(-2%) rotate(-1deg); } 50% { transform: translateX(2%) rotate(1deg); } } @keyframes pawn-angry { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4%); } 75% { transform: translateX(4%); } }
  @media (prefers-reduced-motion: reduce) { .pawn-character *, .pawn-character { animation: none !important; } }
</style>
