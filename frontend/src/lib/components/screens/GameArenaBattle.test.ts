import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import GameArena from './GameArena.svelte';
import { gameStore } from '../../stores/gameStore';
import { battleAnimationService, battleAnimationStore } from '../../services/battleAnimationService';
import { get } from 'svelte/store';

describe('GameArena Battle Animation Integration', () => {
  beforeEach(() => {
    battleAnimationService.reset();
    gameStore.reset();
  });

  it('triggers battle animation when a confirmed move results in a capture (e.g. King captures Queen)', async () => {
    const prevFen = 'rnb1kbnr/pppppppp/8/8/4q3/4K3/PPPP1PPP/RNBQ1BNR w kq - 0 3';
    const currentFen = 'rnb1kbnr/pppppppp/8/8/4K3/8/PPPP1PPP/RNBQ1BNR b kq - 0 3';

    // Initialize board
    gameStore.update(s => ({
      ...s,
      boardFen: prevFen,
      assignedColor: 'White',
      activePlayer: 'White'
    }));

    const { getByTestId, queryByTestId } = render(GameArena);
    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();

    // Trigger authoritative accepted move (King on e3 captures Queen on e4)
    gameStore.onMoveAccepted({
      player: 'White',
      from: 'e3',
      to: 'e4',
      boardFen: currentFen,
      activePlayer: 'Black',
      turnPhase: 'ActionPhase',
      remainingMoves: 1,
      inCheck: false,
      gameStatus: 'InProgress',
      winner: null,
      legalMoves: []
    });

    await tick();

    const overlay = getByTestId('battle-animation-overlay');
    expect(overlay).toBeTruthy();

    const attacker = getByTestId('battle-attacker');
    expect(attacker.getAttribute('aria-label')).toContain('king');
    expect(attacker.dataset.team).toBe('light');

    const defender = getByTestId('battle-defender');
    expect(defender.getAttribute('aria-label')).toContain('queen');
    expect(defender.dataset.team).toBe('dark');
  });

  it('triggers battle animation for remote player captures', async () => {
    const prevFen = 'rnbqkbnr/ppp1pppp/8/3p4/8/2B5/PPPPPPPP/RN1QKBNR w KQkq - 0 3';
    const currentFen = 'rnbqkbnr/ppp1pppp/8/3B4/8/8/PPPPPPPP/RN1QKBNR b KQkq - 0 3';

    // Local player is Black; remote White player makes Bishop captures Pawn move
    gameStore.update(s => ({
      ...s,
      boardFen: prevFen,
      assignedColor: 'Black',
      activePlayer: 'White'
    }));

    const { getByTestId } = render(GameArena);
    await tick();

    // Remote move accepted via SignalR
    gameStore.onMoveAccepted({
      player: 'White',
      from: 'c3',
      to: 'd5',
      boardFen: currentFen,
      activePlayer: 'Black',
      turnPhase: 'ActionPhase',
      remainingMoves: 1,
      inCheck: false,
      gameStatus: 'InProgress',
      winner: null,
      legalMoves: []
    });

    await tick();

    const overlay = getByTestId('battle-animation-overlay');
    expect(overlay).toBeTruthy();

    const attacker = getByTestId('battle-attacker');
    expect(attacker.getAttribute('aria-label')).toContain('bishop');
    expect(attacker.dataset.team).toBe('light');

    const defender = getByTestId('battle-defender');
    expect(defender.getAttribute('aria-label')).toContain('pawn');
    expect(defender.dataset.team).toBe('dark');
  });

  it('does NOT trigger battle animation on reconnect snapshots', async () => {
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const snapshotFen = 'r1bqkbnr/ppp1pppp/8/3p4/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 3';

    gameStore.update(s => ({
      ...s,
      boardFen: initialFen,
      assignedColor: 'White',
      activePlayer: 'White'
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // Reconnect snapshot arriving with changed board FEN without accepted move
    gameStore.applySnapshot({
      gameId: 'test-game',
      boardFen: snapshotFen,
      activePlayer: 'White',
      turnPhase: 'DrawPhase',
      remainingMoves: 0,
      remainingRevivals: 0,
      canSwap: false,
      inCheck: false,
      gameStatus: 'InProgress',
      winner: null,
      remainingDeckCount: 100,
      activeCard: null,
      whiteReserves: [],
      blackReserves: [],
      legalMoves: [],
      availableChoices: [],
      revision: 4
    });

    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
    expect(get(battleAnimationStore).isActive).toBe(false);
  });

  it('does NOT trigger battle animation on card draw, discard, or card effects', async () => {
    const prevFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    gameStore.update(s => ({
      ...s,
      boardFen: prevFen,
      assignedColor: 'White',
      activePlayer: 'White'
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // Card drawn event
    gameStore.onCardDrawn({
      card: {
        id: 'card-1',
        name: 'Reverse',
        color: 'Blue',
        value: 'Reverse',
        type: 'Reverse',
        description: 'Swap two pieces'
      },
      playerColor: 'White',
      remainingDeckCount: 99,
      revision: 1
    });

    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
    expect(get(battleAnimationStore).isActive).toBe(false);
  });

  it('does NOT trigger battle animation when King is defender', async () => {
    const prevFen = '4k3/8/8/4Q3/8/8/8/4K3 w - - 0 1';
    const currentFen = '4Q3/8/8/8/8/8/8/4K3 b - - 0 1';

    gameStore.update(s => ({
      ...s,
      boardFen: prevFen,
      assignedColor: 'White',
      activePlayer: 'White'
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // If an invalid move capturing King was accepted
    gameStore.onMoveAccepted({
      player: 'White',
      from: 'e5',
      to: 'e8',
      boardFen: currentFen,
      activePlayer: 'Black',
      turnPhase: 'ActionPhase',
      remainingMoves: 1,
      inCheck: false,
      gameStatus: 'InProgress',
      winner: null,
      legalMoves: []
    });

    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
    expect(get(battleAnimationStore).isActive).toBe(false);
  });

  it('prevents duplicate battle events if the same move is re-evaluated', async () => {
    const prevFen = 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
    const currentFen = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2';

    gameStore.update(s => ({
      ...s,
      boardFen: prevFen,
      assignedColor: 'White',
      activePlayer: 'White'
    }));

    const { getByTestId, queryByTestId } = render(GameArena);
    await tick();

    gameStore.onMoveAccepted({
      player: 'White',
      from: 'd4',
      to: 'e5',
      boardFen: currentFen,
      activePlayer: 'Black',
      turnPhase: 'ActionPhase',
      remainingMoves: 1,
      inCheck: false,
      gameStatus: 'InProgress',
      winner: null,
      legalMoves: []
    });
    await tick();

    expect(getByTestId('battle-animation-overlay')).toBeTruthy();

    // Dismiss current battle
    battleAnimationService.dismiss();
    await tick();
    expect(queryByTestId('battle-animation-overlay')).toBeNull();

    // Simulate same move without new moveEventCounter
    gameStore.update(s => ({ ...s }));
    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
  });
});
