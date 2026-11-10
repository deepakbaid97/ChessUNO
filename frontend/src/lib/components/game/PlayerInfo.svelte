<script lang="ts">
  import type { PlayerColor } from '../../types/game';

  export let name: string;
  export let color: PlayerColor;
  export let isCurrentTurn: boolean = false;
  export let isConnected: boolean = true;
  export let reserves: string[] = [];
  export let isOpponent: boolean = false;

  $: initials = name ? name.substring(0, 2).toUpperCase() : '??';
  $: isWhite = color === 'White';
</script>

<div
  class="player-info"
  class:opponent={isOpponent}
  class:active-turn={isCurrentTurn}
  data-testid={isOpponent ? 'opponent-info' : 'player-info'}
>
  <div class="avatar-badge" class:white-avatar={isWhite} class:black-avatar={!isWhite}>
    <span>{initials}</span>
    <span
      class="connection-dot"
      class:online={isConnected}
      class:offline={!isConnected}
      title={isConnected ? 'Connected' : 'Disconnected'}
    ></span>
  </div>

  <div class="player-meta">
    <div class="name-row">
      <span class="player-name">{name}</span>
      <span class="color-badge {color.toLowerCase()}">{color}</span>
    </div>

    <div class="status-row">
      {#if isCurrentTurn}
        <span class="turn-indicator pulse">Turn to Move</span>
      {:else}
        <span class="waiting-indicator">Waiting</span>
      {/if}

      {#if reserves.length > 0}
        <span class="reserves-count" title="Captured friendly pieces in reserve">
          Reserves: <strong>{reserves.length}</strong>
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  .player-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    transition: all 0.2s ease;
  }

  .player-info.active-turn {
    border-color: var(--accent-gold);
    box-shadow: 0 0 12px var(--accent-gold-glow);
    background: rgba(251, 191, 36, 0.05);
  }

  .avatar-badge {
    position: relative;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.95rem;
    box-shadow: var(--shadow-sm);
  }

  .white-avatar {
    background: #f8fafc;
    color: #0f172a;
    border: 2px solid #e2e8f0;
  }

  .black-avatar {
    background: #0f172a;
    color: #f8fafc;
    border: 2px solid #334155;
  }

  .connection-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bg-surface);
  }

  .connection-dot.online {
    background-color: var(--accent-green);
    box-shadow: 0 0 4px var(--accent-green-glow);
  }

  .connection-dot.offline {
    background-color: var(--accent-red);
  }

  .player-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .player-name {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-main);
  }

  .color-badge {
    font-size: 0.7rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .color-badge.white {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .color-badge.black {
    background: rgba(168, 85, 247, 0.15);
    color: var(--accent-purple);
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
  }

  .turn-indicator {
    color: var(--accent-gold);
    font-weight: 700;
  }

  .waiting-indicator {
    color: var(--text-muted);
  }

  .reserves-count {
    color: var(--text-muted);
  }

  .reserves-count strong {
    color: var(--accent-blue);
  }

  .pulse {
    animation: textPulse 1.5s infinite alternate;
  }

  @keyframes textPulse {
    from { opacity: 0.8; }
    to { opacity: 1; text-shadow: 0 0 6px var(--accent-gold-glow); }
  }
</style>

