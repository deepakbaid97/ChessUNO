<script lang="ts">
  export let logs: string[] = [];
  export let maxItems: number = 50;

  $: displayLogs = logs.slice(0, maxItems);
</script>

<div class="history-panel panel" data-testid="game-history">
  <div class="history-header">
    <h4>Match History & Events</h4>
    <span class="event-count">{logs.length} events</span>
  </div>

  <div class="history-list">
    {#if displayLogs.length === 0}
      <p class="empty-history">Game started. Awaiting opening moves...</p>
    {:else}
      {#each displayLogs as log, i}
        <div class="history-item" class:newest={i === 0}>
          <span class="bullet">▪</span>
          <span class="log-text">{log}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .history-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    padding: 16px 20px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: 280px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
  }

  h4 {
    font-size: 0.95rem;
    color: var(--text-main);
  }

  .event-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 4px;
  }

  .history-item {
    display: flex;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.3;
    font-family: var(--font-mono);
  }

  .history-item.newest {
    color: var(--text-main);
    font-weight: 600;
  }

  .history-item.newest .bullet {
    color: var(--accent-gold);
  }

  .bullet {
    color: var(--text-dim);
  }

  .empty-history {
    font-size: 0.85rem;
    color: var(--text-dim);
    font-style: italic;
    padding: 8px 0;
  }
</style>

