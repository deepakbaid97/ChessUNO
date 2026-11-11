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

  function selectAnimation(value: PawnAnimation) {
    animation = value;
    replayKey += 1;
  }

  function replayCurrentAction() {
    replayKey += 1;
  }

  function selectTeam(value: PawnTeam) {
    team = value;
  }
</script>

<main class="playground">
  <header class="playground-header">
    <a href="/" class="back-link">← Back to Chess UNO</a>
    <span>Character Lab / Pawn Prototype</span>
  </header>

  <section class="stage" aria-labelledby="pawn-lab-title">
    <div class="stage-copy">
      <p class="eyebrow">Illustrated Character Rig</p>
      <h1 id="pawn-lab-title">The brave little pawn.</h1>
      <p>
        Layered 2D vector character with independent armor, limbs, face expressions, and animations.
        Fully themed for light and dark factions.
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
      </div>
    </div>

    <div class="pawn-plinth">
      <div class="spark spark-one"></div>
      <div class="spark spark-two"></div>
      {#key replayKey}
        <PawnCharacter {expression} {animation} {team} {size} testId="pawn-character" />
      {/key}
    </div>
  </section>

  <section class="controls" aria-label="Pawn character controls">
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

    <label class="size-control" for="pawn-size">
      Scale <output>{size}px</output>
      <input id="pawn-size" type="range" min="120" max="360" step="10" bind:value={size} />
    </label>
  </section>

  <!-- Inspection Lineup Gallery -->
  <section class="gallery-section" aria-label="Expression and Faction Inspection Gallery">
    <div class="gallery-block">
      <div class="gallery-header">
        <h3>Expression Showcase (Small Scale - 80px)</h3>
        <p>Verify distinct readability at actual chess piece scale</p>
      </div>
      <div class="roster-grid">
        {#each expressions as exp}
          <button
            class="roster-card"
            class:selected={expression === exp}
            on:click={() => expression = exp}
            aria-label="Inspect {exp} expression preview"
          >
            <div class="card-pawn">
              <PawnCharacter
                expression={exp}
                animation="idle"
                {team}
                size={80}
                testId="pawn-gallery-exp-{exp}"
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
        <p>Side-by-side palette validation</p>
      </div>
      <div class="roster-grid faction-grid">
        {#each teams as t}
          <button
            class="roster-card faction-card"
            class:selected={team === t}
            on:click={() => selectTeam(t)}
            aria-label="Inspect {t} team variant preview"
          >
            <div class="card-pawn">
              <PawnCharacter
                {expression}
                animation="idle"
                team={t}
                size={96}
                testId="pawn-gallery-team-{t}"
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
    background: radial-gradient(circle at 70% 38%, #594a80 0, #28233e 32%, #161322 72%);
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

  .back-link {
    color: #f3ce73;
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .back-link:hover {
    color: #ffe6a3;
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
    margin-bottom: 12px;
  }

  .stage-copy h1 {
    max-width: 560px;
    font-size: clamp(2.8rem, 6vw, 5.8rem);
    line-height: 0.9;
    letter-spacing: -0.06em;
    margin: 0;
  }

  .stage-copy p:nth-of-type(2) {
    max-width: 420px;
    margin-top: 20px;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #c8bed1;
  }

  .status-chips {
    display: flex;
    gap: 8px;
    margin-top: 20px;
    flex-wrap: wrap;
  }

  .chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font: 500 0.72rem var(--font-mono, monospace);
    background: rgba(248, 239, 217, 0.08);
    border: 1px solid rgba(248, 239, 217, 0.16);
    color: #d6cee0;
  }

  .chip strong {
    color: #f3ce73;
    text-transform: capitalize;
  }

  .action-bar {
    margin-top: 18px;
  }

  .replay-btn {
    border: 1px solid #f3ce73;
    background: rgba(243, 206, 115, 0.12);
    color: #f3ce73;
    border-radius: 8px;
    padding: 7px 14px;
    font: 600 0.8rem var(--font-mono, monospace);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .replay-btn:hover {
    background: #f3ce73;
    color: #292237;
  }

  .pawn-plinth {
    position: relative;
    min-height: 420px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: radial-gradient(ellipse at 50% 78%, rgba(243, 206, 115, 0.22), transparent 48%);
  }

  .pawn-plinth::after {
    content: '';
    position: absolute;
    bottom: 17%;
    width: min(75%, 420px);
    height: 1px;
    background: rgba(248, 239, 217, 0.3);
  }

  .pawn-plinth :global(.pawn-character) {
    z-index: 1;
  }

  .spark {
    position: absolute;
    border-radius: 50%;
    background: #f3ce73;
    box-shadow: 0 0 18px #f3ce73;
  }

  .spark-one {
    width: 6px;
    height: 6px;
    left: 23%;
    top: 26%;
    animation: float 2.5s ease-in-out infinite;
  }

  .spark-two {
    width: 4px;
    height: 4px;
    right: 19%;
    top: 38%;
    animation: float 2.8s 0.4s ease-in-out infinite;
  }

  .controls {
    max-width: 1140px;
    display: grid;
    grid-template-columns: 1fr 1fr 0.7fr 210px;
    gap: 22px;
    padding: 24px 0 32px;
    border-top: 1px solid rgba(248, 239, 217, 0.22);
  }

  .control-group h2,
  .size-control {
    font: 600 0.7rem var(--font-mono, monospace);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #b9afc9;
  }

  .button-row {
    display: flex;
    gap: 7px;
    margin-top: 9px;
    flex-wrap: wrap;
  }

  .button-row button {
    border: 1px solid rgba(248, 239, 217, 0.23);
    border-radius: 999px;
    padding: 7px 13px;
    color: #eee7d7;
    background: transparent;
    cursor: pointer;
    font: 600 0.78rem var(--font-sans, sans-serif);
    text-transform: capitalize;
    transition: all 0.15s ease;
  }

  .button-row button:hover,
  .button-row button.active {
    color: #292237;
    background: #f3ce73;
    border-color: #f3ce73;
  }

  .size-control {
    display: grid;
    gap: 10px;
  }

  .size-control output {
    float: right;
    color: #f3ce73;
  }

  .size-control input {
    appearance: none;
    height: 4px;
    padding: 0;
    border: 0;
    background: #706683;
    accent-color: #f3ce73;
    cursor: pointer;
  }

  .size-control input::-webkit-slider-thumb {
    width: 16px;
    height: 16px;
  }

  .size-control input::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 0;
    background: #f3ce73;
  }

  /* Inspection Gallery */
  .gallery-section {
    max-width: 1140px;
    margin-top: 16px;
    padding-top: 24px;
    border-top: 1px solid rgba(248, 239, 217, 0.14);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
  }

  .gallery-header h3 {
    margin: 0;
    font: 600 0.85rem var(--font-mono, monospace);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #f3ce73;
  }

  .gallery-header p {
    margin: 4px 0 14px;
    font-size: 0.78rem;
    color: #a89eb6;
  }

  .roster-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .faction-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .roster-card {
    background: rgba(30, 24, 46, 0.6);
    border: 1px solid rgba(248, 239, 217, 0.16);
    border-radius: 12px;
    padding: 12px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #ddd4e6;
  }

  .roster-card:hover {
    border-color: #f3ce73;
    background: rgba(45, 36, 68, 0.8);
    transform: translateY(-2px);
  }

  .roster-card.selected {
    border-color: #f3ce73;
    box-shadow: 0 0 12px rgba(243, 206, 115, 0.3);
    background: rgba(55, 44, 82, 0.9);
  }

  .card-pawn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 86px;
  }

  .card-label {
    margin-top: 8px;
    font: 600 0.72rem var(--font-mono, monospace);
    text-transform: capitalize;
    letter-spacing: 0.04em;
  }

  @keyframes float {
    50% {
      transform: translateY(-16px);
      opacity: 0.3;
    }
  }

  @media (max-width: 900px) {
    .gallery-section {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 780px) {
    .playground {
      padding: 18px 20px 36px;
    }
    .playground-header span {
      display: none;
    }
    .stage {
      min-height: unset;
      grid-template-columns: 1fr;
      gap: 12px;
      padding-top: 36px;
    }
    .stage-copy h1 {
      font-size: clamp(2.6rem, 14vw, 4.4rem);
    }
    .pawn-plinth {
      min-height: 340px;
    }
    .controls {
      grid-template-columns: 1fr;
      gap: 17px;
    }
    .control-group.compact {
      grid-row: 3;
    }
    .roster-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spark {
      animation: none;
    }
  }
</style>
