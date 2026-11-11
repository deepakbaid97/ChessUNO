<script lang="ts">
  import KnightCharacter, { type KnightAnimation, type KnightExpression, type KnightTeam } from './KnightCharacter.svelte';
  import BattleAnimationOverlay from '../animation/BattleAnimationOverlay.svelte';
  import { battleAnimationService } from '../../services/battleAnimationService';

  const expressions: KnightExpression[] = ['neutral', 'happy', 'scared', 'angry'];
  const animations: KnightAnimation[] = ['idle', 'walk', 'attack', 'death'];
  const teams: KnightTeam[] = ['light', 'dark'];

  let expression: KnightExpression = 'neutral';
  let animation: KnightAnimation = 'idle';
  let team: KnightTeam = 'light';
  let size = 240;
  let replayKey = 0;

  function selectAnimation(value: KnightAnimation) {
    animation = value;
    replayKey += 1;
  }

  function replayCurrentAction() {
    replayKey += 1;
  }

  function selectTeam(value: KnightTeam) {
    team = value;
  }

  function launchCinematicDemo() {
    battleAnimationService.reset();
    battleAnimationService.triggerBattle({
      id: `knight-demo-${Date.now()}`,
      attacker: { piece: 'Knight', color: team === 'light' ? 'White' : 'Black' },
      defender: { piece: 'Pawn', color: team === 'light' ? 'Black' : 'White' },
      from: 'b1',
      to: 'c3',
      attackStyle: 'leap'
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
      <span class="current-lab">Knight Lab</span>
      <span class="nav-divider">|</span>
      <a href="/rook-playground" class="nav-sublink">Rook Lab</a>
      <span class="nav-divider">|</span>
      <a href="/bishop-playground" class="nav-sublink">Bishop Lab</a>
    </div>
    <span>Character Lab / Knight Prototype</span>
  </header>

  <section class="stage" aria-labelledby="knight-lab-title">
    <div class="stage-copy">
      <p class="eyebrow">Illustrated Character Rig</p>
      <h1 id="knight-lab-title">The reckless champion.</h1>
      <p>
        Brave, reckless, and slightly overconfident equestrian Knight.
        Layered 2D vector character with horse-crested armet helmet, chivalric heater shield,
        and broadsword.
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
        <button class="demo-btn" on:click={launchCinematicDemo} aria-label="Demo Knight Duel Cinematic">
          ⚔ Demo Knight Duel Cinematic
        </button>
      </div>
    </div>

    <div class="knight-plinth">
      <div class="spark spark-one"></div>
      <div class="spark spark-two"></div>
      {#key replayKey}
        <KnightCharacter {expression} {animation} {team} {size} testId="knight-character" />
      {/key}
    </div>
  </section>

  <section class="controls" aria-label="Knight character controls">
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

    <label class="size-control" for="knight-size">
      Scale <output>{size}px</output>
      <input id="knight-size" type="range" min="120" max="360" step="10" bind:value={size} />
    </label>
  </section>

  <!-- Inspection Lineup Gallery -->
  <section class="gallery-section" aria-label="Expression and Faction Inspection Gallery">
    <div class="gallery-block">
      <div class="gallery-header">
        <h3>Expression Showcase (Small Scale - 80px)</h3>
        <p>Distinct readability for reckless expressions at chess piece scale</p>
      </div>
      <div class="roster-grid">
        {#each expressions as exp}
          <button
            class="roster-card"
            class:selected={expression === exp}
            on:click={() => expression = exp}
            aria-label="Inspect {exp} expression preview"
          >
            <div class="card-knight">
              <KnightCharacter
                expression={exp}
                animation="idle"
                {team}
                size={80}
                testId="knight-gallery-exp-{exp}"
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
        <p>Royal chivalric steel vs Obsidian dark iron</p>
      </div>
      <div class="roster-grid faction-grid">
        {#each teams as t}
          <button
            class="roster-card faction-card"
            class:selected={team === t}
            on:click={() => selectTeam(t)}
            aria-label="Inspect {t} team variant preview"
          >
            <div class="card-knight">
              <KnightCharacter
                {expression}
                animation="idle"
                team={t}
                size={96}
                testId="knight-gallery-team-{t}"
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
    --ink: #2c2540;
    min-height: 100dvh;
    color: var(--cream);
    background: radial-gradient(circle at 70% 38%, #523f73 0, #241d38 32%, #14101e 72%);
    padding: 24px clamp(20px, 5vw, 76px) 64px;
    overflow-x: hidden;
  }

  .playground-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font: 600 0.72rem var(--font-mono, monospace);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #b9afc9;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .nav-divider {
    color: rgba(248, 239, 217, 0.25);
  }

  .back-link,
  .nav-sublink {
    color: #f3ce73;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .back-link:hover,
  .nav-sublink:hover {
    color: #ffe6a3;
  }

  .current-lab {
    color: #ffffff;
    font-weight: 700;
  }

  .stage {
    min-height: calc(100dvh - 380px);
    display: grid;
    grid-template-columns: minmax(260px, 0.85fr) minmax(340px, 1.15fr);
    align-items: center;
    gap: 36px;
    padding-top: 20px;
  }

  .eyebrow {
    color: #f3ce73;
    font: 700 0.72rem var(--font-mono, monospace);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 8px;
  }

  h1 {
    font: 800 clamp(2rem, 3.8vw, 3.2rem) / 1.05 var(--font-display, Georgia, serif);
    letter-spacing: -0.03em;
    margin: 0 0 16px;
  }

  .stage-copy p {
    color: #c8bed1;
    font-size: 0.95rem;
    line-height: 1.5;
    max-width: 44ch;
    margin: 0 0 20px;
  }

  .status-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 22px;
  }

  .chip {
    padding: 4px 10px;
    border-radius: 999px;
    font: 500 0.75rem var(--font-mono, monospace);
    background: rgba(248, 239, 217, 0.08);
    border: 1px solid rgba(248, 239, 217, 0.15);
  }

  .chip strong {
    color: #f3ce73;
    text-transform: capitalize;
  }

  .action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .replay-btn,
  .demo-btn {
    border-radius: 999px;
    padding: 8px 18px;
    font: 700 0.82rem var(--font-mono, monospace);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .replay-btn {
    background: #f3ce73;
    color: #211c2e;
    border: none;
  }

  .replay-btn:hover {
    background: #ffe399;
    transform: translateY(-1px);
  }

  .demo-btn {
    background: rgba(243, 206, 115, 0.14);
    border: 1.5px solid #f3ce73;
    color: #f3ce73;
  }

  .demo-btn:hover {
    background: rgba(243, 206, 115, 0.25);
    color: #fff;
    transform: translateY(-1px);
  }

  .knight-plinth {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 420px;
    border-radius: 28px;
    background: radial-gradient(circle at center 60%, rgba(243, 206, 115, 0.12) 0, rgba(255, 255, 255, 0.02) 65%, transparent 70%);
    border: 1px solid rgba(248, 239, 217, 0.1);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 32px;
    align-items: flex-end;
    padding: 24px;
    margin-top: 24px;
    border-radius: 20px;
    background: rgba(18, 14, 28, 0.6);
    border: 1px solid rgba(248, 239, 217, 0.12);
  }

  .control-group h2 {
    font: 700 0.7rem var(--font-mono, monospace);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #b9afc9;
    margin: 0 0 8px;
  }

  .button-row {
    display: flex;
    gap: 6px;
  }

  .button-row button {
    background: rgba(248, 239, 217, 0.08);
    border: 1px solid rgba(248, 239, 217, 0.16);
    color: #ddd4e6;
    padding: 6px 14px;
    border-radius: 999px;
    font: 600 0.78rem var(--font-mono, monospace);
    text-transform: capitalize;
    cursor: pointer;
    transition: all 0.12s ease;
  }

  .button-row button:hover {
    background: rgba(243, 206, 115, 0.18);
    border-color: #f3ce73;
    color: #fff;
  }

  .button-row button.active {
    background: #f3ce73;
    color: #211c2e;
    border-color: #f3ce73;
  }

  .size-control {
    display: flex;
    flex-direction: column;
    font: 700 0.7rem var(--font-mono, monospace);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #b9afc9;
    gap: 8px;
  }

  .size-control input[type="range"] {
    accent-color: #f3ce73;
    width: 140px;
  }

  .gallery-section {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 24px;
    margin-top: 36px;
  }

  .gallery-block {
    background: rgba(18, 14, 28, 0.45);
    border: 1px solid rgba(248, 239, 217, 0.1);
    border-radius: 20px;
    padding: 20px;
  }

  .gallery-header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .gallery-header p {
    margin: 4px 0 16px;
    color: #a89cb5;
    font-size: 0.78rem;
  }

  .roster-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .roster-grid.faction-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .roster-card {
    background: rgba(248, 239, 217, 0.04);
    border: 1.5px solid rgba(248, 239, 217, 0.12);
    border-radius: 14px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .roster-card:hover {
    border-color: #f3ce73;
    background: rgba(243, 206, 115, 0.08);
  }

  .roster-card.selected {
    border-color: #f3ce73;
    background: rgba(243, 206, 115, 0.16);
  }

  .card-label {
    margin-top: 6px;
    font: 600 0.72rem var(--font-mono, monospace);
    text-transform: capitalize;
    color: #ddd4e6;
  }

  @media (max-width: 860px) {
    .stage {
      grid-template-columns: 1fr;
    }
    .gallery-section {
      grid-template-columns: 1fr;
    }
    .roster-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>

