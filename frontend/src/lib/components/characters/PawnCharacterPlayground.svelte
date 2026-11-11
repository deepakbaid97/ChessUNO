<script lang="ts">
  import PawnCharacter, { type PawnAnimation, type PawnExpression, type PawnTeam } from './PawnCharacter.svelte';

  const expressions: PawnExpression[] = ['neutral', 'happy', 'scared', 'angry'];
  const animations: PawnAnimation[] = ['idle', 'walk', 'attack', 'death'];
  const teams: PawnTeam[] = ['light', 'dark'];
  let expression: PawnExpression = 'neutral';
  let animation: PawnAnimation = 'idle';
  let team: PawnTeam = 'light';
  let size = 240;
  let replayKey = 0;

  function selectAnimation(value: PawnAnimation) { animation = value; replayKey += 1; }
  function selectTeam(value: PawnTeam) { team = value; }
</script>

<main class="playground">
  <header class="playground-header"><a href="/" class="back-link">← Back to Chess UNO</a><span>Character Lab / Pawn prototype</span></header>
  <section class="stage" aria-labelledby="pawn-lab-title">
    <div class="stage-copy"><p class="eyebrow">Layered character system</p><h1 id="pawn-lab-title">The brave little pawn.</h1><p>Independent head, limbs, body, and sword layers—ready for final illustrated assets.</p></div>
    <div class="pawn-plinth"><div class="spark spark-one"></div><div class="spark spark-two"></div>{#key replayKey}<PawnCharacter {expression} {animation} {team} {size} />{/key}</div>
  </section>
  <section class="controls" aria-label="Pawn character controls">
    <div class="control-group"><h2>Expression</h2><div class="button-row">{#each expressions as option}<button class:active={expression === option} on:click={() => expression = option} aria-pressed={expression === option}>{option}</button>{/each}</div></div>
    <div class="control-group"><h2>Action</h2><div class="button-row">{#each animations as option}<button class:active={animation === option} on:click={() => selectAnimation(option)} aria-pressed={animation === option}>{option}</button>{/each}</div></div>
    <div class="control-group compact"><h2>Faction</h2><div class="button-row">{#each teams as option}<button class:active={team === option} on:click={() => selectTeam(option)} aria-pressed={team === option}>{option}</button>{/each}</div></div>
    <label class="size-control" for="pawn-size">Scale <output>{size}px</output><input id="pawn-size" type="range" min="120" max="360" step="10" bind:value={size} /></label>
  </section>
</main>

<style>
  :global(body) { background: #161322; } .playground { --cream:#f8efd9; --ink:#2c2540; min-height:100dvh; color:var(--cream); background:radial-gradient(circle at 70% 38%, #594a80 0, #28233e 32%, #161322 72%); padding:24px clamp(20px,5vw,76px) 48px; overflow:hidden; }.playground-header { display:flex; justify-content:space-between; align-items:center; font:600 .72rem var(--font-mono); letter-spacing:.08em; text-transform:uppercase; color:#b9afc9; }.back-link { color:#f3ce73; text-decoration:none; }.stage { min-height:calc(100dvh - 250px); display:grid; grid-template-columns:minmax(250px,.85fr) minmax(340px,1.15fr); align-items:center; gap:36px; }.eyebrow { color:#f3ce73; font:700 .72rem var(--font-mono); letter-spacing:.12em; text-transform:uppercase; margin-bottom:16px; }.stage-copy h1 { max-width:560px; font-size:clamp(3.1rem,7vw,6.7rem); line-height:.87; letter-spacing:-.07em; }.stage-copy p:last-child { max-width:370px; margin-top:24px; font-size:1rem; line-height:1.6; color:#c8bed1; }.pawn-plinth { position:relative; min-height:420px; display:flex; justify-content:center; align-items:center; background:radial-gradient(ellipse at 50% 78%, rgba(243,206,115,.22), transparent 45%); }.pawn-plinth::after { content:''; position:absolute; bottom:17%; width:min(75%,420px); height:1px; background:rgba(248,239,217,.3); }.pawn-plinth :global(.pawn-character) { z-index:1; }.spark { position:absolute; border-radius:50%; background:#f3ce73; box-shadow:0 0 18px #f3ce73; }.spark-one { width:6px;height:6px;left:23%;top:26%;animation:float 2.5s ease-in-out infinite; }.spark-two { width:4px;height:4px;right:19%;top:38%;animation:float 2.8s .4s ease-in-out infinite; }.controls { max-width:1140px; display:grid; grid-template-columns:1fr 1fr .7fr 210px; gap:22px; padding-top:24px; border-top:1px solid rgba(248,239,217,.22); }.control-group h2,.size-control { font:600 .7rem var(--font-mono); letter-spacing:.1em; text-transform:uppercase; color:#b9afc9; }.button-row { display:flex; gap:7px; margin-top:9px; flex-wrap:wrap; }.button-row button { border:1px solid rgba(248,239,217,.23); border-radius:999px; padding:7px 11px; color:#eee7d7; background:transparent; cursor:pointer; font:600 .78rem var(--font-sans); text-transform:capitalize; }.button-row button:hover,.button-row button.active { color:#292237; background:#f3ce73; border-color:#f3ce73; }.size-control { display:grid; gap:10px; }.size-control output { float:right; color:#f3ce73; }.size-control input { appearance:none; height:4px; padding:0; border:0; background:#706683; accent-color:#f3ce73; }.size-control input::-webkit-slider-thumb { width:16px;height:16px; }.size-control input::-moz-range-thumb { width:14px;height:14px;border-radius:50%;border:0;background:#f3ce73; } @keyframes float { 50% { transform:translateY(-16px); opacity:.3; } } @media (max-width:780px) { .playground { padding:18px 20px 36px; }.playground-header span { display:none; }.stage { min-height:unset; grid-template-columns:1fr; gap:4px; padding-top:54px; }.stage-copy h1 { font-size:clamp(3.1rem,17vw,5rem); }.pawn-plinth { min-height:370px; }.controls { grid-template-columns:1fr; gap:17px; }.control-group.compact { grid-row:3; } } @media (prefers-reduced-motion:reduce) { .spark { animation:none; } }
</style>
