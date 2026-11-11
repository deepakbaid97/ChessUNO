import { describe, it, expect } from 'vitest';
import {
  parseFenToMatrix,
  getSquareColor,
  formatSquare,
  getRankAndFile,
  getSquareIndex,
  getOrientedSquares,
  getOrientedSquareCoords,
  charToPiece,
  isCaptureMove,
  isKingInCheck,
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

  it('filters revival squares when King is in check so only squares blocking check are eligible', () => {
    // White king at e1 checked by Black rook at e8. Squares e2, e3, e4 on White's half block the check
    const fenWhiteInRookCheck = '4r3/8/8/8/8/8/8/4K3 w - - 0 1';
    const squares = getEligibleRevivalSquares(fenWhiteInRookCheck, 'White', 'Bishop');
    expect(squares).toHaveLength(3);
    expect(squares).toEqual(expect.arrayContaining(['e2', 'e3', 'e4']));
    expect(squares).not.toContain('f2');
    expect(squares).not.toContain('d2');
  });

  it('returns no revival squares when King is in check from adjacent piece and cannot be blocked', () => {
    // White king at e1 checked by Black queen at f1. No square can block adjacent attacker
    const fenWhiteInAdjacentCheck = '4k3/8/8/8/8/8/8/4Kq2 w - - 0 1';
    const squares = getEligibleRevivalSquares(fenWhiteInAdjacentCheck, 'White', 'Pawn');
    expect(squares).toEqual([]);
  });

  it('returns no revival squares when King is in check from knight since knight checks cannot be blocked', () => {
    // White king at e1 checked by Black knight at f3
    const fenWhiteInKnightCheck = '4k3/8/8/8/8/5n2/8/4K3 w - - 0 1';
    const squares = getEligibleRevivalSquares(fenWhiteInKnightCheck, 'White', 'Rook');
    expect(squares).toEqual([]);
  });

  it('computes oriented grid coordinates for piece movement animation', () => {
    // White perspective: a8 is (0, 0), h1 is (7, 7), e2 is (4, 6), e4 is (4, 4)
    expect(getOrientedSquareCoords('a8', 'White')).toEqual({ col: 0, row: 0 });
    expect(getOrientedSquareCoords('h1', 'White')).toEqual({ col: 7, row: 7 });
    expect(getOrientedSquareCoords('e2', 'White')).toEqual({ col: 4, row: 6 });
    expect(getOrientedSquareCoords('e4', 'White')).toEqual({ col: 4, row: 4 });

    // Black perspective: h1 is (0, 0), a8 is (7, 7), e7 is (3, 6), e5 is (3, 4)
    expect(getOrientedSquareCoords('h1', 'Black')).toEqual({ col: 0, row: 0 });
    expect(getOrientedSquareCoords('a8', 'Black')).toEqual({ col: 7, row: 7 });
    expect(getOrientedSquareCoords('e7', 'Black')).toEqual({ col: 3, row: 6 });
    expect(getOrientedSquareCoords('e5', 'Black')).toEqual({ col: 3, row: 4 });
  });

  describe('isKingInCheck', () => {
    it('returns false for initial board', () => {
      const board = parseFenToMatrix(initialFen);
      expect(isKingInCheck('White', board)).toBe(false);
      expect(isKingInCheck('Black', board)).toBe(false);
    });

    it('detects pawn checks correctly for White and Black kings', () => {
      // White king at e4 attacked by Black pawn at d5
      const fenWhiteInPawnCheck = '4k3/8/8/3p4/4K3/8/8/8 w - - 0 1';
      const boardWhite = parseFenToMatrix(fenWhiteInPawnCheck);
      expect(isKingInCheck('White', boardWhite)).toBe(true);
      expect(isKingInCheck('Black', boardWhite)).toBe(false);

      // Black king at e5 attacked by White pawn at d4
      const fenBlackInPawnCheck = '8/8/8/4k3/3P4/8/8/4K3 b - - 0 1';
      const boardBlack = parseFenToMatrix(fenBlackInPawnCheck);
      expect(isKingInCheck('Black', boardBlack)).toBe(true);
      expect(isKingInCheck('White', boardBlack)).toBe(false);
    });

    it('detects knight checks correctly', () => {
      // White king at e1 attacked by Black knight at f3
      const fen = '4k3/8/8/8/8/5n2/8/4K3 w - - 0 1';
      const board = parseFenToMatrix(fen);
      expect(isKingInCheck('White', board)).toBe(true);
      expect(isKingInCheck('Black', board)).toBe(false);
    });

    it('detects bishop/queen diagonal checks and respects blockers', () => {
      // Black king at e8 attacked by White bishop at b5 with open diagonal (d7 and c6 empty)
      const fenCheck = 'rnb1kbnr/pp2pppp/8/1B6/4p3/8/PPPPPPPP/RNBQK1NR b KQkq - 1 3';
      const boardCheck = parseFenToMatrix(fenCheck);
      expect(isKingInCheck('Black', boardCheck)).toBe(true);
      expect(isKingInCheck('White', boardCheck)).toBe(false);

      // Blocked by pawn at d7: no check
      const fenBlocked = 'rnb1kbnr/pppp1ppp/8/1B6/4p3/8/PPPPPPPP/RNBQK1NR b KQkq - 1 3';
      const boardBlocked = parseFenToMatrix(fenBlocked);
      expect(isKingInCheck('Black', boardBlocked)).toBe(false);
    });

    it('detects rook/queen orthogonal checks and respects blockers', () => {
      // White king at e1 attacked by Black rook at e8 on open file
      const fenCheck = '4k3/8/8/8/8/8/8/4K2r w - - 0 1'; // White king at e1 attacked by Black rook at h1
      const boardCheck = parseFenToMatrix(fenCheck);
      expect(isKingInCheck('White', boardCheck)).toBe(true);

      // Blocked by friendly pawn at g1
      const fenBlocked = '4k3/8/8/8/8/8/8/4K1Pr w - - 0 1';
      const boardBlocked = parseFenToMatrix(fenBlocked);
      expect(isKingInCheck('White', boardBlocked)).toBe(false);
    });
  });

  describe('isCheckSquare', () => {
    it('highlights White King when Black gives check to White, regardless of activePlayer', () => {
      // Black queen at h4 gives check to White king at e1
      // e.g. Scholar/Fool attack: White king on e1, Black queen on h4, e1-h4 open
      const fen = 'rnb1kbnr/pppp1ppp/8/8/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3';
      const board = parseFenToMatrix(fen);

      // Even if activePlayer is Black (who delivered check):
      expect(isCheckSquare('e1', true, 'Black', board)).toBe(true); // White King MUST be highlighted
      expect(isCheckSquare('e8', true, 'Black', board)).toBe(false); // Black King must NOT be highlighted

      // And when activePlayer is White:
      expect(isCheckSquare('e1', true, 'White', board)).toBe(true);
      expect(isCheckSquare('e8', true, 'White', board)).toBe(false);

      // Non-king squares must always return false
      expect(isCheckSquare('h4', true, 'Black', board)).toBe(false);
      expect(isCheckSquare('d1', true, 'Black', board)).toBe(false);
    });

    it('highlights Black King when White gives check to Black, regardless of activePlayer', () => {
      // White queen at h5 gives check to Black king at e8
      const fen = 'rnbqkbnr/ppppp2p/5p2/7Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3';
      const board = parseFenToMatrix(fen);

      // Even if activePlayer is White:
      expect(isCheckSquare('e8', true, 'White', board)).toBe(true); // Black King MUST be highlighted
      expect(isCheckSquare('e1', true, 'White', board)).toBe(false); // White King must NOT be highlighted

      // When activePlayer is Black:
      expect(isCheckSquare('e8', true, 'Black', board)).toBe(true);
      expect(isCheckSquare('e1', true, 'Black', board)).toBe(false);
    });

    it('returns false when inCheck is false', () => {
      const fen = 'rnb1kbnr/pppp1ppp/8/8/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3';
      const board = parseFenToMatrix(fen);
      expect(isCheckSquare('e1', false, 'White', board)).toBe(false);
      expect(isCheckSquare('e8', false, 'Black', board)).toBe(false);
    });
  });
});

