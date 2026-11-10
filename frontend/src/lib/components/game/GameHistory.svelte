<script lang="ts">
  export let logs: string[] = [];
  export let maxItems: number = 50;

  let isMobileExpanded = false;

  $: displayLogs = logs.slice(0, maxItems);
  $: latestLog = displayLogs[0] || 'Match started. Awaiting opening draw.';
</script>

<div class="history-panel panel" class:mobile-expanded={isMobileExpanded} data-testid="game-history">
  <div class="history-header">
    <div class="header-left">
      <h4>Match Log</h4>
      <span class="event-count">{logs.length}</span>
    </div>

    <div class="latest-ticker">
      <span class="ticker-text">{latestLog}</span>
    </div>

    <button
      type="button"
      class="toggle-history-btn"
      on:click={() => { isMobileExpanded = !isMobileExpanded; }}
    >
      {isMobileExpanded ? 'Hide' : 'Log'}
    </button>
  </div>

  <div class="history-list">
    {#if displayLogs.length === 0}
      <p class="empty-history">Match started. Awaiting opening actions.</p>
    {:else}
      {#each displayLogs as log, i}
        <div class="history-item" class:newest={i === 0}>
          <span class="bullet"></span>
          <span class="log-text">{log}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .history-panel {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    padding: 12px 14px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    max-height: 210px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 6px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  h4 {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .event-count {
    font-size: 0.68rem;
    font-family: var(--font-mono);
    background-color: var(--bg-elevated);
    color: var(--text-muted);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .latest-ticker {
    display: none;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .ticker-text {
    display: block;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .toggle-history-btn {
    display: none;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding-right: 4px;
  }

  .history-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 0.76rem;
    color: var(--text-muted);
    line-height: 1.3;
    font-family: var(--font-mono);
  }

  .history-item.newest {
    color: var(--text-main);
    font-weight: 600;
  }

  .bullet {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--text-dim);
    flex-shrink: 0;
    transform: translateY(-1px);
  }

  .history-item.newest .bullet {
    background-color: var(--accent-gold);
  }

  .empty-history {
    font-size: 0.78rem;
    color: var(--text-dim);
    padding: 4px 0;
  }

  @media (max-width: 900px) {
    .history-panel {
      padding: 6px 10px;
      max-height: none;
    }

    .history-header {
      margin-bottom: 0;
      border-bottom: none;
      padding-bottom: 0;
    }

    .latest-ticker {
      display: block;
    }

    .toggle-history-btn {
      display: inline-block;
    }

    .history-list {
      display: none;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--border-subtle);
      max-height: 120px;
    }

    .history-panel.mobile-expanded .history-list {
      display: flex;
    }
  }
</style>
