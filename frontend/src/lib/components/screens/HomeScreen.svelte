<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isCreating: boolean = false;
  export let errorMessage: string = '';

  const dispatch = createEventDispatcher<{
    createGame: { playerName: string; seed?: number };
    joinGame: { invitationToken: string; playerName: string };
  }>();

  let createPlayerName = 'Alice';
  let joinPlayerName = 'Bob';
  let joinToken = '';

  export let defaultSeed: number | undefined = undefined;

  function handleCreate() {
    if (createPlayerName.trim()) {
      const payload: { playerName: string; seed?: number } = { playerName: createPlayerName.trim() };
      if (defaultSeed !== undefined) {
        payload.seed = defaultSeed;
      }
      dispatch('createGame', payload);
    }
  }

  function handleJoin() {
    let token = joinToken.trim();
    if (token.includes('/join/')) {
      token = token.split('/join/')[1].split('?')[0].split('/')[0];
    } else if (token.includes('join=')) {
      const match = token.match(/join=([^&]+)/);
      if (match) token = match[1];
    }

    if (token && joinPlayerName.trim()) {
      dispatch('joinGame', {
        invitationToken: token,
        playerName: joinPlayerName.trim()
      });
    }
  }
</script>

<div class="home-screen" data-testid="home-screen">
  <div class="hero-section">
    <div class="hero-tag">Tactical Chess Variant</div>
    <h1>Chess UNO</h1>
    <p class="tagline">Classical chess governed by an authoritative action deck. Draw a card every turn to move, swap, or revive pieces.</p>
  </div>

  {#if errorMessage}
    <div class="error-banner" data-testid="error-banner">
      <span>{errorMessage}</span>
    </div>
  {/if}

  <div class="modes-grid">
    <div class="mode-card panel">
      <div class="mode-header">
        <span class="mode-tag white-tag">White • Host</span>
        <h3>Create Match</h3>
      </div>
      <p class="mode-desc">Start a new game session as White and generate an invitation link for your opponent.</p>

      <div class="form-group">
        <label for="create-name">Player Name</label>
        <input
          id="create-name"
          bind:value={createPlayerName}
          placeholder="Enter your name"
          disabled={isCreating}
          data-testid="input-create-name"
        />
      </div>

      <button
        class="btn btn-gold btn-block"
        on:click={handleCreate}
        disabled={isCreating || !createPlayerName.trim()}
        data-testid="btn-create-game"
      >
        {isCreating ? 'Creating Match...' : 'Create Match & Get Link'}
      </button>
    </div>

    <div class="mode-card panel">
      <div class="mode-header">
        <span class="mode-tag black-tag">Black • Challenger</span>
        <h3>Join Match</h3>
      </div>
      <p class="mode-desc">Paste an invitation link or token from a host to join their board as Black.</p>

      <div class="form-group">
        <label for="join-name">Player Name</label>
        <input
          id="join-name"
          bind:value={joinPlayerName}
          placeholder="Enter your name"
          data-testid="input-join-name"
        />
      </div>

      <div class="form-group">
        <label for="join-token">Invitation Link or Token</label>
        <input
          id="join-token"
          bind:value={joinToken}
          placeholder="Paste invitation URL or token"
          data-testid="input-join-token"
        />
      </div>

      <button
        class="btn btn-primary btn-block"
        on:click={handleJoin}
        disabled={!joinToken.trim() || !joinPlayerName.trim()}
        data-testid="btn-join-game"
      >
        Join Match
      </button>
    </div>
  </div>

  <div class="rules-highlight panel">
    <div class="rules-header">
      <h4>How Each Turn Works</h4>
    </div>
    <div class="rules-grid">
      <div class="rule-item">
        <span class="rule-step">01</span>
        <div>
          <strong>Draw 1 Card</strong>
          <p>Every turn begins by drawing a card from the shared 108-card deck.</p>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-step">02</span>
        <div>
          <strong>Number Cards (0–4)</strong>
          <p>Make up to N legal chess moves. You may move the same piece multiple times.</p>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-step">03</span>
        <div>
          <strong>Reverse &amp; Draw Two</strong>
          <p>Reverse swaps two of your non-King pieces. Draw Two revives up to 2 captured pieces onto your half.</p>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-step">04</span>
        <div>
          <strong>Checkmate or King Capture</strong>
          <p>Win by delivering checkmate or capturing the enemy King during a multi-move turn.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .home-screen {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 840px;
    margin: 0 auto;
    width: 100%;
    padding: 8px 0 24px;
  }

  .hero-section {
    text-align: center;
    padding: 12px 0 4px;
  }

  .hero-tag {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 3px 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    font-family: var(--font-mono);
  }

  h1 {
    font-size: 2.1rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-bottom: 8px;
    color: var(--text-main);
  }

  .tagline {
    font-size: 0.95rem;
    color: var(--text-muted);
    max-width: 540px;
    margin: 0 auto;
    line-height: 1.45;
  }

  .error-banner {
    background-color: rgba(239, 68, 68, 0.14);
    border: 1px solid var(--accent-red);
    color: #fca5a5;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .modes-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  @media (max-width: 680px) {
    .modes-grid {
      grid-template-columns: 1fr;
    }
  }

  .mode-card {
    display: flex;
    flex-direction: column;
  }

  .mode-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 6px;
  }

  .mode-tag {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 3px;
    font-family: var(--font-mono);
  }

  .white-tag {
    background-color: rgba(243, 244, 246, 0.12);
    color: #f9fafb;
    border: 1px solid rgba(243, 244, 246, 0.25);
  }

  .black-tag {
    background-color: rgba(59, 130, 246, 0.14);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  h3 {
    font-size: 1.2rem;
    color: var(--text-main);
  }

  .mode-desc {
    font-size: 0.84rem;
    color: var(--text-muted);
    margin-bottom: 18px;
    line-height: 1.4;
  }

  .form-group {
    margin-bottom: 14px;
  }

  .btn-block {
    width: 100%;
    margin-top: auto;
    padding: 11px 18px;
  }

  .rules-highlight {
    background-color: var(--bg-surface);
  }

  .rules-header {
    margin-bottom: 14px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
  }

  .rules-highlight h4 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .rules-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 640px) {
    .rules-grid {
      grid-template-columns: 1fr;
    }
  }

  .rule-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .rule-step {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    padding: 3px 6px;
    flex-shrink: 0;
  }

  .rule-item strong {
    display: block;
    font-size: 0.86rem;
    color: var(--text-main);
    margin-bottom: 2px;
  }

  .rule-item p {
    font-size: 0.78rem;
    color: var(--text-muted);
    line-height: 1.38;
  }
</style>
