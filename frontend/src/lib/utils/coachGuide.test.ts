import { describe, it, expect } from 'vitest';
import { computeCoachGuide } from './coachGuide';
import type { GameSessionState } from '../types/game';

describe('computeCoachGuide', () => {
  const baseState: GameSessionState = {
    gameId: 'game-1',
    boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    assignedColor: 'White',
    activePlayer: 'White',
    gameStatus: 'InProgress',
    turnPhase: 'DrawPhase',
    revision: 1,
    remainingMoves: 0,
    remainingRevivals: 0,
    canSwap: false,
    inCheck: false,
    selectedSquare: null,
    validDestinations: [],
    whiteReserves: [],
    blackReserves: [],
    logs: [],
    remainingDeckCount: 20
  };

  it('shows DRAW TURN CARD when turnPhase is DrawPhase', () => {
    const guide = computeCoachGuide({
      isGameOver: false,
      isMyTurn: true,
      storeState: { ...baseState, turnPhase: 'DrawPhase' },
      opponentColor: 'Black',
      activeAbilityMode: 'none',
      firstSwapSquare: null,
      myReserves: [],
      selectedRevivalPiece: null
    });

    expect(guide.headline).toBe('Draw Your Turn Card');
    expect(guide.tone).toBe('your-turn');
  });

  it('shows OPPONENT TURN when it is not my turn', () => {
    const guide = computeCoachGuide({
      isGameOver: false,
      isMyTurn: false,
      storeState: { ...baseState, activePlayer: 'Black' },
      opponentColor: 'Black',
      activeAbilityMode: 'none',
      firstSwapSquare: null,
      myReserves: [],
      selectedRevivalPiece: null
    });

    expect(guide.badge).toBe('OPPONENT TURN');
    expect(guide.tone).toBe('opponent-turn');
  });

  it('shows GAME OVER when game is completed', () => {
    const guide = computeCoachGuide({
      isGameOver: true,
      isMyTurn: false,
      storeState: { ...baseState, gameStatus: 'Checkmate', winner: 'White' },
      opponentColor: 'Black',
      activeAbilityMode: 'none',
      firstSwapSquare: null,
      myReserves: [],
      selectedRevivalPiece: null
    });

    expect(guide.badge).toBe('MATCH COMPLETE');
    expect(guide.instruction).toContain('White wins the match.');
  });
});

