<script lang="ts">
  import type { PlayerColor, PieceType } from '../../types/game';
  import ChessPiece from '../chess/ChessPiece.svelte';

  export let name: string;
  export let color: PlayerColor;
  export let isCurrentTurn: boolean = false;
  export let isConnected: boolean = true;
  export let reserves: string[] = [];
  export let isOpponent: boolean = false;

  $: initials = name ? name.substring(0, 2).toUpperCase() : '??';
  $: isWhite = color === 'White';

  function asPieceType(piece: string): PieceType {
    return piece as PieceType;
  }
</script>

<div
  class="player-info"
  class:opponent={isOpponent}
  class:active-turn={isCurrentTurn}
  data-testid={isOpponent ? 'opponent-info' : 'player-info'}
>
  <div class="player-identity">
    <div class="avatar-badge" class:white-avatar={isWhite} class:black-avatar={!isWhite}>
      <span>{initials}</span>
      <span
        class="connection-dot"
        class:online={isConnected}
        class:offline={!isConnected}
        title={isConnected ? 'Connected' : 'Disconnected'}
      ></span>
    </div>

    <div class="name-group">
      <div class="name-line">
        <span class="player-name">{name || (isOpponent ? 'Opponent' : 'You')}</span>
        <span class="color-badge {color.toLowerCase()}">{color}</span>
      </div>
      <div class="sub-line">
        {#if isCurrentTurn}
          <span class="turn-indicator">{isOpponent ? 'Opponent\'s Turn' : 'Your Turn'}</span>
        {:else}
          <span class="waiting-indicator">Standby</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="player-right">
    {#if reserves.length > 0}
      <div class="reserves-strip" title="Captured friendly pieces available for revival">
        <span class="reserves-label">Reserve ({reserves.length}):</span>
        <div class="reserves-icons">
          {#each reserves.slice(0, 6) as piece}
            <span class="reserve-mini">
              <ChessPiece type={asPieceType(piece)} {color} size={18} />
            </span>
          {/each}
          {#if reserves.length > 6}
            <span class="reserve-more">+{reserves.length - 6}</span>
          {/if}
        </div>
      </div>
    {/if}
    <slot name="actions" />
  </div>
</div>

<style>
  .player-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    transition: border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease;
  }

  .player-info.active-turn {
    border-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.08);
    box-shadow: 0 0 0 1px var(--accent-gold), 0 0 14px var(--accent-gold-glow);
    animation: activePanelBreath 2.8s infinite ease-in-out;
  }

  @keyframes activePanelBreath {
    0%, 100% {
      border-color: var(--accent-gold);
      box-shadow: 0 0 0 1px var(--accent-gold), 0 0 10px var(--accent-gold-glow);
    }
    50% {
      border-color: var(--accent-gold-bright);
      box-shadow: 0 0 0 1px var(--accent-gold-bright), 0 0 18px rgba(245, 158, 11, 0.45);
    }
  }

  .player-info.opponent.active-turn {
    border-color: rgba(255, 255, 255, 0.45);
    background-color: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2), 0 0 12px rgba(255, 255, 255, 0.1);
    animation: opponentTurnBreath 2.8s infinite ease-in-out;
  }

  @keyframes opponentTurnBreath {
    0%, 100% { border-color: rgba(255, 255, 255, 0.35); }
    50% { border-color: rgba(255, 255, 255, 0.65); box-shadow: 0 0 14px rgba(255, 255, 255, 0.18); }
  }

  .player-identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }

  .avatar-badge {
    position: relative;
    width: 34px;
    height: 34px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.8rem;
    flex-shrink: 0;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .active-turn .avatar-badge {
    transform: scale(1.05);
  }

  .white-avatar {
    background-color: #f3f4f6;
    color: #111827;
    border: 1.5px solid #d1d5db;
  }

  .black-avatar {
    background-color: #181b20;
    color: #f3f4f6;
    border: 1.5px solid #4b5563;
  }

  .connection-dot {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 2px solid var(--bg-surface);
  }

  .connection-dot.online {
    background-color: var(--accent-green);
    box-shadow: 0 0 6px var(--accent-green-glow);
    animation: connPulse 2.4s infinite ease-in-out;
  }

  @keyframes connPulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.18); opacity: 1; }
  }

  .connection-dot.offline {
    background-color: var(--accent-red);
    box-shadow: 0 0 6px var(--accent-red-glow);
    animation: offlinePulse 1.2s infinite ease-in-out;
  }

  @keyframes offlinePulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.25); opacity: 1; }
  }

  .name-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .player-name {
    font-weight: 700;
    font-size: 0.88rem;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .color-badge {
    font-size: 0.62rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
  }

  .color-badge.white {
    background-color: rgba(243, 244, 246, 0.14);
    color: #f9fafb;
    border: 1px solid rgba(243, 244, 246, 0.28);
  }

  .color-badge.black {
    background-color: rgba(156, 163, 175, 0.12);
    color: #d1d5db;
    border: 1px solid rgba(156, 163, 175, 0.28);
  }

  .sub-line {
    font-size: 0.72rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .turn-indicator {
    color: var(--accent-gold);
    font-weight: 700;
  }

  .waiting-indicator {
    color: var(--text-dim);
  }

  .player-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .reserves-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 5px;
    padding: 3px 8px;
  }

  .reserves-label {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .reserves-icons {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .reserve-mini {
    display: inline-flex;
    align-items: center;
  }

  .reserve-more {
    font-size: 0.68rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  @media (max-width: 900px) {
    .player-info {
      padding: 5px 10px;
    }

    .avatar-badge {
      width: 28px;
      height: 28px;
      font-size: 0.72rem;
    }

    .player-name {
      font-size: 0.8rem;
    }

    .sub-line {
      font-size: 0.66rem;
    }

    .reserves-label {
      display: none;
    }
  }
</style>
