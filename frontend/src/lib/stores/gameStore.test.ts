import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createGameStore } from './gameStore';
import type { GameSnapshot, GameStateUpdate } from '../types/game';

describe('gameStore', () => {
  let store: ReturnType<typeof createGameStore>;

  beforeEach(() => {
    store = createGameStore();
  });

  const dummySnapshot: GameSnapshot = {
    gameId: 'test-game-1',
    status: 'WaitingForPlayer',
    assignedColor: 'White',
    boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    activePlayer: 'White',
    turnPhase: 'DrawPhase',
    remainingMoves: 0,
    remainingRevivals: 0,
    canSwap: false,
    inCheck: false,
    gameStatus: 'Active',
    winner: null,
    remainingDeckCount: 108,
    playerWhiteName: 'Alice',
    playerBlackName: undefined,
    activeCard: null,
    whiteReserves: [],
    blackReserves: [],
    legalMoves: ['e2e3', 'e2e4', 'g1f3'],
    revision: 1
  };

  it('initializes with default state', () => {
    const state = get(store);
    expect(state.gameId).toBe('');
    expect(state.revision).toBe(0);
    expect(state.selectedSquare).toBeNull();
  });

  it('loads snapshot properly', () => {
    store.applySnapshot(dummySnapshot);
    const state = get(store);
    expect(state.gameId).toBe('test-game-1');
    expect(state.assignedColor).toBe('White');
    expect(state.revision).toBe(1);
    expect(state.legalMoves).toContain('e2e4');
  });

  it('filters legal destinations for selected square', () => {
    store.applySnapshot(dummySnapshot);
    store.selectSquare('e2');
    const state = get(store);
    expect(state.selectedSquare).toBe('e2');
    expect(state.validDestinations).toEqual(['e3', 'e4']);

    store.selectSquare('g1');
    expect(get(store).validDestinations).toEqual(['f3']);
  });

  it('prevents selecting empty or enemy square when no piece selected', () => {
    store.applySnapshot(dummySnapshot);
    // e4 is empty
    store.selectSquare('e4');
    expect(get(store).selectedSquare).toBeNull();

    // e7 is black pawn, but player is White
    store.selectSquare('e7');
    expect(get(store).selectedSquare).toBeNull();
  });

  it('rejects stale state revisions', () => {
    store.applySnapshot(dummySnapshot);
    expect(get(store).revision).toBe(1);

    const staleUpdate: GameStateUpdate = {
      boardFen: 'stale-fen',
      activePlayer: 'Black',
      turnPhase: 'ActionPhase',
      remainingMoves: 1,
      gameStatus: 'Active',
      revision: 0
    };

    store.applyUpdate(staleUpdate);
    expect(get(store).revision).toBe(1);
    expect(get(store).boardFen).toBe(dummySnapshot.boardFen);

    const freshUpdate: GameStateUpdate = {
      boardFen: 'fresh-fen',
      activePlayer: 'White',
      turnPhase: 'ActionPhase',
      remainingMoves: 2,
      gameStatus: 'Active',
      revision: 2
    };

    store.applyUpdate(freshUpdate);
    expect(get(store).revision).toBe(2);
    expect(get(store).boardFen).toBe('fresh-fen');
  });
});

