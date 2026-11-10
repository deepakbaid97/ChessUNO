import { describe, it, expect } from 'vitest';
import {
  parseFenToMatrix,
  getSquareColor,
  formatSquare,
  getRankAndFile,
  getSquareIndex,
  getOrientedSquares,
  charToPiece,
  isCaptureMove,
  isCheckSquare,
  getEligibleSwapSquares,
  getEligibleRevivalSquares
} from './boardUtils';

describe('boardUtils', () => {
  const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('parses initial FEN into an 8x8 matrix correctly', () => {
    const board = parseFenToMatrix(initialFen);
    expect(board.length).toBe(8);
    expect(board[0].length).toBe(8);

    // Rank 8 (black pieces)
    expect(board[0][0]).toEqual({ type: 'Rook', color: 'Black', char: 'r' });
    expect(board[0][4]).toEqual({ type: 'King', color: 'Black', char: 'k' });

    // Rank 7 (black pawns)
    expect(board[1][0]).toEqual({ type: 'Pawn', color: 'Black', char: 'p' });

    // Rank 6 (empty)
    expect(board[2][0]).toBeNull();

    // Rank 2 (white pawns)
    expect(board[6][0]).toEqual({ type: 'Pawn', color: 'White', char: 'P' });

    // Rank 1 (white pieces)
    expect(board[7][0]).toEqual({ type: 'Rook', color: 'White', char: 'R' });
    expect(board[7][4]).toEqual({ type: 'King', color: 'White', char: 'K' });
  });

  it('computes square color correctly', () => {
    expect(getSquareColor('a1')).toBe('dark');
    expect(getSquareColor('a8')).toBe('light');
    expect(getSquareColor('h1')).toBe('light');
    expect(getSquareColor('e4')).toBe('light');
    expect(getSquareColor('d4')).toBe('dark');
  });

  it('converts file and rank to square and vice-versa', () => {
    expect(formatSquare(0, 0)).toBe('a8');
    expect(formatSquare(7, 7)).toBe('h1');
    expect(getRankAndFile('e4')).toEqual({ file: 4, rank: 4 });
  });

  it('provides board orientation based on player color', () => {
    const whiteSquares = getOrientedSquares('White');
    expect(whiteSquares[0]).toBe('a8');
    expect(whiteSquares[63]).toBe('h1');

    const blackSquares = getOrientedSquares('Black');
    expect(blackSquares[0]).toBe('h1');
    expect(blackSquares[63]).toBe('a8');
  });

  it('detects capture moves by checking piece on destination', () => {
    const board = parseFenToMatrix(initialFen);
    expect(isCaptureMove('e2', 'e4', board)).toBe(false);
    expect(isCaptureMove('e4', 'd5', parseFenToMatrix('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'))).toBe(true);
  });

  it('calculates eligible swap squares strictly for friendly non-king pieces', () => {
    const whiteSwapSquares = getEligibleSwapSquares(initialFen, 'White');
    expect(whiteSwapSquares.length).toBe(15);
    expect(whiteSwapSquares).not.toContain('e1'); // White King
    expect(whiteSwapSquares).toContain('a2');
    expect(whiteSwapSquares).toContain('d1'); // White Queen
    // Must NOT contain any black pieces
    expect(whiteSwapSquares).not.toContain('e7');
    expect(whiteSwapSquares).not.toContain('c8');

    const blackSwapSquares = getEligibleSwapSquares(initialFen, 'Black');
    expect(blackSwapSquares.length).toBe(15);
    expect(blackSwapSquares).not.toContain('e8'); // Black King
    expect(blackSwapSquares).toContain('e7');
    expect(blackSwapSquares).toContain('d8'); // Black Queen
    // Must NOT contain any white pieces
    expect(blackSwapSquares).not.toContain('e2');
    expect(blackSwapSquares).not.toContain('c1');
  });

  it('calculates eligible revival squares in own half for empty squares', () => {
    const whiteRevivalSquares = getEligibleRevivalSquares(initialFen, 'White');
    // In initial position, ranks 1 and 2 are full. Ranks 3 and 4 have 8 empty squares each = 16
    expect(whiteRevivalSquares.length).toBe(16);
    expect(whiteRevivalSquares).toContain('e3');
    expect(whiteRevivalSquares).toContain('e4');
    expect(whiteRevivalSquares).not.toContain('e5'); // Opponent half
    expect(whiteRevivalSquares).not.toContain('e2'); // Occupied
  });
});

