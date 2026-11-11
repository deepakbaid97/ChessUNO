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

  it('shows clear guidance when King is in check and revival can block check', () => {
    // White king at e1 checked by Black rook at e8. Squares e2, e3, e4 can block check
    const fen = '4r3/8/8/8/8/8/8/4K3 w - - 0 1';
    const guide = computeCoachGuide({
      isGameOver: false,
      isMyTurn: true,
      storeState: {
        ...baseState,
        boardFen: fen,
        inCheck: true,
        remainingRevivals: 1,
        turnPhase: 'ActionPhase'
      },
      opponentColor: 'Black',
      activeAbilityMode: 'revival',
      firstSwapSquare: null,
      myReserves: ['Bishop'],
      selectedRevivalPiece: 'Bishop'
    });

    expect(guide.badge).toContain('IN CHECK • REVIVAL');
    expect(guide.tone).toBe('check');
    expect(guide.headline).toContain('Deploy Bishop to Block Check');
    expect(guide.instruction).toContain('block the enemy check on your King');
  });

  it('informs the player when King is in check and no revival squares can protect King', () => {
    // White king at e1 checked by Black queen at f1. Adjacent check cannot be blocked
    const fen = '4k3/8/8/8/8/8/8/4Kq2 w - - 0 1';
    const guide = computeCoachGuide({
      isGameOver: false,
      isMyTurn: true,
      storeState: {
        ...baseState,
        boardFen: fen,
        inCheck: true,
        remainingRevivals: 2,
        turnPhase: 'ActionPhase'
      },
      opponentColor: 'Black',
      activeAbilityMode: 'revival',
      firstSwapSquare: null,
      myReserves: ['Pawn'],
      selectedRevivalPiece: 'Pawn'
    });

    expect(guide.badge).toBe('IN CHECK • NO REVIVAL SQUARES');
    expect(guide.tone).toBe('check');
    expect(guide.headline).toBe('Cannot Revive While in Check');
    expect(guide.instruction).toContain('No placement can protect your King from check');
  });
});

