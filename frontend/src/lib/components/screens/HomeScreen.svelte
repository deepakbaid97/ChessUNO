<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isCreating: boolean = false;
  export let errorMessage: string = '';

  const dispatch = createEventDispatcher<{
    createGame: { playerName: string };
    joinGame: { invitationToken: string; playerName: string };
  }>();

  let createPlayerName = 'Alice';
  let joinPlayerName = 'Bob';
  let joinToken = '';

  function handleCreate() {
    if (createPlayerName.trim()) {
      dispatch('createGame', { playerName: createPlayerName.trim() });
    }
  }

  function handleJoin() {
    // If user pasted a full URL, extract token if needed
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
    <div class="hero-badge">Phase 4 Strategic Experience</div>
    <h1>♟️ Chess UNO</h1>
    <p class="tagline">Traditional Chess depth electrified with UNO cards and tactical abilities.</p>
  </div>

  {#if errorMessage}
    <div class="error-banner" data-testid="error-banner">
      <span>⚠️ {errorMessage}</span>
    </div>
  {/if}

  <div class="modes-grid">
    <div class="mode-card panel">
      <div class="card-icon">👑</div>
      <h3>Create Match</h3>
      <p class="mode-desc">Host a match as White. Generate a shareable invitation link for your opponent.</p>

      <div class="form-group">
        <label for="create-name">Commander Name</label>
        <input
          id="create-name"
          bind:value={createPlayerName}
          placeholder="e.g. Grandmaster"
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
        {isCreating ? 'Creating Match...' : 'Create Game & Invite'}
      </button>
    </div>

    <div class="mode-card panel">
      <div class="card-icon">⚔️</div>
      <h3>Join Match</h3>
      <p class="mode-desc">Enter an invitation token or URL to play as Black against a host.</p>

      <div class="form-group">
        <label for="join-name">Your Name</label>
        <input
          id="join-name"
          bind:value={joinPlayerName}
          placeholder="e.g. Challenger"
          data-testid="input-join-name"
        />
      </div>

      <div class="form-group">
        <label for="join-token">Invitation Token or URL</label>
        <input
          id="join-token"
          bind:value={joinToken}
          placeholder="Paste invitation token or link"
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
    <h4>Core Rules Snapshot</h4>
    <div class="rules-grid">
      <div class="rule-item">
        <span class="rule-icon">🎴</span>
        <div>
          <strong>Draw Mandatory</strong>
          <p>Every turn starts by drawing 1 card from the authoritative deck.</p>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-icon">🔢</span>
        <div>
          <strong>Number Cards (0-9)</strong>
          <p>Grants up to N chess moves. Consecutive moves with the same piece are allowed.</p>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-icon">✨</span>
        <div>
          <strong>Special Actions</strong>
          <p>Reverse swaps two friendly pieces; Draw Two revives captured pieces; Skip retains turn initiative.</p>
        </div>
      </div>
      <div class="rule-item">
        <span class="rule-icon">🛡️</span>
        <div>
          <strong>King Safety</strong>
          <p>You cannot finish a turn with your King in check. Delivering checkmate wins the match.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .home-screen {
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 880px;
    margin: 0 auto;
    width: 100%;
  }

  .hero-section {
    text-align: center;
    padding: 20px 0 10px;
  }

  .hero-badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-gold);
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    padding: 4px 12px;
    border-radius: 9999px;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    margin-bottom: 8px;
    background: linear-gradient(135deg, #fff 0%, var(--accent-gold) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tagline {
    font-size: 1.1rem;
    color: var(--text-muted);
    max-width: 580px;
    margin: 0 auto;
  }

  .error-banner {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid var(--accent-red);
    color: #fca5a5;
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .modes-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
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

  .card-icon {
    font-size: 2.2rem;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 1.3rem;
    color: #fff;
    margin-bottom: 6px;
  }

  .mode-desc {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .btn-block {
    width: 100%;
    margin-top: auto;
    padding: 12px 20px;
  }

  .rules-highlight {
    background: var(--bg-surface);
  }

  .rules-highlight h4 {
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent-gold);
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
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

  .rule-icon {
    font-size: 1.5rem;
  }

  .rule-item strong {
    display: block;
    font-size: 0.9rem;
    color: var(--text-main);
    margin-bottom: 2px;
  }

  .rule-item p {
    font-size: 0.82rem;
    color: var(--text-muted);
    line-height: 1.35;
  }
</style>

