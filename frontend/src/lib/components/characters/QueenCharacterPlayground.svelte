<script lang="ts">
  import QueenCharacter, { type QueenAnimation, type QueenExpression, type QueenTeam } from './QueenCharacter.svelte';
  import BattleAnimationOverlay from '../animation/BattleAnimationOverlay.svelte';
  import { battleAnimationService } from '../../services/battleAnimationService';

  const expressions: QueenExpression[] = ['neutral', 'happy', 'scared', 'angry'];
  const animations: QueenAnimation[] = ['idle', 'walk', 'attack', 'death'];
  const teams: QueenTeam[] = ['light', 'dark'];

  let expression: QueenExpression = 'neutral';
  let animation: QueenAnimation = 'idle';
  let team: QueenTeam = 'light';
  let size = 240;
  let replayKey = 0;

  function selectAnimation(value: QueenAnimation) {
    animation = value;
    replayKey += 1;
  }

  function replayCurrentAction() {
    replayKey += 1;
  }

  function selectTeam(value: QueenTeam) {
    team = value;
  }

  function launchCinematicDemo() {
    battleAnimationService.reset();
    battleAnimationService.triggerBattle({
      id: `queen-demo-${Date.now()}`,
      attacker: { piece: 'Queen', color: team === 'light' ? 'White' : 'Black' },
      defender: { piece: 'Pawn', color: team === 'light' ? 'Black' : 'White' },
      from: 'd1',
      to: 'd7',
      attackStyle: 'slash'
    });
  }
</script>

<BattleAnimationOverlay />

<main class="playground">
  <header class="playground-header">
    <div class="nav-links">
      <a href="/" class="back-link">← Back to Chess UNO</a>
      <span class="nav-divider">|</span>
      <a href="/pawn-playground" class="nav-sublink">Pawn Lab</a>
      <span class="nav-divider">|</span>
      <a href="/knight-playground" class="nav-sublink">Knight Lab</a>
      <span class="nav-divider">|</span>
      <a href="/rook-playground" class="nav-sublink">Rook Lab</a>
      <span class="nav-divider">|</span>
      <a href="/bishop-playground" class="nav-sublink">Bishop Lab</a>
      <span class="nav-divider">|</span>
      <span class="current-lab">Queen Lab</span>
      <span class="nav-divider">|</span>
      <a href="/king-playground" class="nav-sublink">King Lab</a>
    </div>
    <span>Character Lab / Queen Prototype</span>
  </header>

  <section class="stage" aria-labelledby="queen-lab-title">
    <div class="stage-copy">
      <p class="eyebrow">Illustrated Character Rig</p>
      <h1 id="queen-lab-title">The sovereign commander.</h1>
      <p>
        Confident, elegant, commanding, and intimidating.
        Layered 2D vector character with a jewel-encrusted imperial crown, polished royal plate armor,
        flowing velvet mantle, and a lightning-fast royal energy blade.
      </p>

      <div class="status-chips" aria-label="Current character configuration">
        <span class="chip faction-chip">Faction: <strong>{team}</strong></span>
        <span class="chip expression-chip">Mood: <strong>{expression}</strong></span>
        <span class="chip action-chip">Action: <strong>{animation}</strong></span>
      </div>

      <div class="action-bar">
        <button class="replay-btn" on:click={replayCurrentAction}>
          ↻ Replay {animation}
        </button>
        <button class="demo-btn" on:click={launchCinematicDemo} aria-label="Demo Queen Slash Cinematic">
          ⚔️ Demo Queen Slash Cinematic
        </button>
      </div>
    </div>

    <div class="queen-plinth">
      <div class="spark spark-one"></div>
      <div class="spark spark-two"></div>
      {#key replayKey}
        <QueenCharacter {expression} {animation} {team} {size} testId="queen-character" />
      {/key}
    </div>
  </section>

  <section class="controls" aria-label="Queen character controls">
    <div class="control-group">
      <h2>Expression</h2>
      <div class="button-row">
        {#each expressions as option}
          <button
            class:active={expression === option}
            on:click={() => expression = option}
            aria-pressed={expression === option}
          >
            {option}
          </button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <h2>Action</h2>
      <div class="button-row">
        {#each animations as option}
          <button
            class:active={animation === option}
            on:click={() => selectAnimation(option)}
            aria-pressed={animation === option}
          >
            {option}
          </button>
        {/each}
      </div>
    </div>

    <div class="control-group compact">
      <h2>Faction</h2>
      <div class="button-row">
        {#each teams as option}
          <button
            class:active={team === option}
            on:click={() => selectTeam(option)}
            aria-pressed={team === option}
          >
            {option}
          </button>
        {/each}
      </div>
    </div>

    <label class="size-control" for="queen-size">
      Scale <output>{size}px</output>
      <input id="queen-size" type="range" min="120" max="360" step="10" bind:value={size} />
    </label>
  </section>

  <!-- Inspection Lineup Gallery -->
  <section class="gallery-section" aria-label="Expression and Faction Inspection Gallery">
    <div class="gallery-block">
      <div class="gallery-header">
        <h3>Expression Showcase (Small Scale - 80px)</h3>
        <p>Sharp, commanding royal expressions readable at square scale</p>
      </div>
      <div class="roster-grid">
        {#each expressions as exp}
          <button
            class="roster-card"
            class:selected={expression === exp}
            on:click={() => expression = exp}
            aria-label="Inspect {exp} expression preview"
          >
            <div class="card-queen">
              <QueenCharacter
                expression={exp}
                animation="idle"
                {team}
                size={80}
                testId="queen-gallery-exp-{exp}"
              />
            </div>
            <span class="card-label">{exp}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="gallery-block">
      <div class="gallery-header">
        <h3>Faction Comparison (Light vs Dark)</h3>
        <p>Platinum Silver & Imperial Scarlet vs Midnight Obsidian & Royal Violet</p>
      </div>
      <div class="roster-grid faction-grid">
        {#each teams as t}
          <button
            class="roster-card faction-card"
            class:selected={team === t}
            on:click={() => selectTeam(t)}
            aria-label="Inspect {t} team variant preview"
          >
            <div class="card-queen">
              <QueenCharacter
                {expression}
                animation="idle"
                team={t}
                size={96}
                testId="queen-gallery-team-{t}"
              />
            </div>
            <span class="card-label">{t} Team</span>
          </button>
        {/each}
      </div>
    </div>
  </section>
</main>

<style>
  .playground {
    --cream: #f8efd9;
    --ink: #1a202c;
    min-height: 100dvh;
    color: var(--cream);
    background: radial-gradient(circle at 70% 38%, #4a1d24 0, #1f141a 36%, #100b10 76%);
    padding: 24px clamp(20px, 5vw, 76px) 64px;
    overflow-x: hidden;
  }

  .playground-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font: 600 0.72rem var(--font-mono, monospace);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #feb2b2;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(254, 178, 178, 0.2);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-link,
  .nav-sublink {
    color: #fed7d7;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .back-link:hover,
  .nav-sublink:hover {
    color: #63b3ed;
  }

  .nav-divider {
    color: rgba(254, 178, 178, 0.35);
  }

  .current-lab {
    color: #63b3ed;
    font-weight: 700;
  }

  .stage {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr);
    align-items: center;
    gap: clamp(24px, 6vw, 72px);
    padding: clamp(32px, 6vh, 64px) 0;
  }

  .eyebrow {
    font: 700 0.72rem var(--font-mono, monospace);
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #63b3ed;
    margin: 0 0 12px;
  }

  h1 {
    font-size: clamp(2.4rem, 5vw, 4rem);
    line-height: 1.05;
    margin: 0 0 16px;
    color: #ffffff;
    text-shadow: 0 4px 24px rgba(99, 179, 237, 0.25);
  }

  .stage-copy p {
    font-size: 1.06rem;
    line-height: 1.55;
    color: #fed7d7;
    max-width: 540px;
    margin: 0 0 24px;
  }

  .status-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }

  .chip {
    padding: 6px 14px;
    border-radius: 999px;
    font: 500 0.8rem var(--font-mono, monospace);
    background: rgba(229, 62, 62, 0.2);
    border: 1px solid rgba(254, 178, 178, 0.35);
    color: #fed7d7;
  }

  .chip strong {
    color: #63b3ed;
    text-transform: capitalize;
  }

  .action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .replay-btn,
  .demo-btn {
    padding: 10px 20px;
    border-radius: 999px;
    font: 600 0.88rem var(--font-mono, monospace);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .replay-btn {
    background: #c53030;
    border: 1px solid #e53e3e;
    color: #ffffff;
    box-shadow: 0 4px 16px rgba(197, 48, 48, 0.35);
  }

  .replay-btn:hover {
    background: #e53e3e;
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(229, 62, 62, 0.45);
  }

  .demo-btn {
    background: rgba(99, 179, 237, 0.15);
    border: 1px solid #63b3ed;
    color: #63b3ed;
  }

  .demo-btn:hover {
    background: rgba(99, 179, 237, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 0 16px rgba(99, 179, 237, 0.35);
  }

  .queen-plinth {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 380px;
    border-radius: 28px;
    background: radial-gradient(circle at center, rgba(229, 62, 62, 0.32) 0%, rgba(31, 20, 26, 0.6) 65%, transparent 80%);
    border: 1px solid rgba(254, 178, 178, 0.2);
    box-shadow: 0 20px 60px rgba(16, 11, 16, 0.7);
  }

  .spark {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #63b3ed;
    box-shadow: 0 0 12px #63b3ed;
    opacity: 0.65;
    animation: sparkOrbit 6s ease-in-out infinite alternate;
  }

  .spark-one { top: 18%; left: 18%; }
  .spark-two { bottom: 22%; right: 20%; animation-delay: -3s; }

  @keyframes sparkOrbit {
    0% { transform: translateY(0) scale(0.8); }
    100% { transform: translateY(-18px) scale(1.3); }
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: clamp(16px, 3vw, 36px);
    padding: 24px;
    border-radius: 20px;
    background: rgba(31, 20, 26, 0.7);
    border: 1px solid rgba(254, 178, 178, 0.25);
    backdrop-filter: blur(8px);
    margin-bottom: 48px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h2 {
    font: 600 0.72rem var(--font-mono, monospace);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #feb2b2;
    margin: 0;
  }

  .button-row {
    display: flex;
    gap: 6px;
  }

  .button-row button {
    padding: 8px 16px;
    border-radius: 10px;
    font: 600 0.8rem var(--font-mono, monospace);
    text-transform: capitalize;
    background: rgba(229, 62, 62, 0.15);
    border: 1px solid rgba(254, 178, 178, 0.25);
    color: #fed7d7;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .button-row button:hover {
    background: rgba(229, 62, 62, 0.3);
    color: #ffffff;
  }

  .button-row button.active {
    background: #c53030;
    border-color: #e53e3e;
    color: #ffffff;
    box-shadow: 0 2px 10px rgba(197, 48, 48, 0.4);
  }

  .size-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font: 600 0.72rem var(--font-mono, monospace);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #feb2b2;
    margin-left: auto;
  }

  .size-control output {
    color: #63b3ed;
    font-weight: 700;
  }

  .size-control input[type="range"] {
    accent-color: #63b3ed;
    cursor: pointer;
  }

  /* Gallery lineup section */
  .gallery-section {
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  .gallery-block {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .gallery-header h3 {
    margin: 0 0 4px;
    font-size: 1.15rem;
    color: #ffffff;
  }

  .gallery-header p {
    margin: 0;
    font-size: 0.88rem;
    color: #feb2b2;
  }

  .roster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 14px;
  }

  .faction-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .roster-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 12px;
    border-radius: 16px;
    background: rgba(31, 20, 26, 0.5);
    border: 1px solid rgba(254, 178, 178, 0.2);
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .roster-card:hover {
    background: rgba(46, 28, 38, 0.7);
    border-color: #63b3ed;
    transform: translateY(-2px);
  }

  .roster-card.selected {
    background: rgba(197, 48, 48, 0.25);
    border-color: #63b3ed;
    box-shadow: 0 0 16px rgba(99, 179, 237, 0.25);
  }

  .card-queen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 90px;
  }

  .card-label {
    font: 600 0.78rem var(--font-mono, monospace);
    color: #fed7d7;
    text-transform: capitalize;
  }

  @media (max-width: 860px) {
    .stage {
      grid-template-columns: 1fr;
    }
    .size-control {
      margin-left: 0;
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spark {
      animation: none !important;
    }
  }
</style>

