import type { BoardPiece, PieceType, PlayerColor } from '../types/game';

export function charToPiece(char: string): BoardPiece {
  const isWhite = char === char.toUpperCase();
  const color: PlayerColor = isWhite ? 'White' : 'Black';
  const lower = char.toLowerCase();

  let type: PieceType = 'Pawn';
  switch (lower) {
    case 'p':
      type = 'Pawn';
      break;
    case 'n':
      type = 'Knight';
      break;
    case 'b':
      type = 'Bishop';
      break;
    case 'r':
      type = 'Rook';
      break;
    case 'q':
      type = 'Queen';
      break;
    case 'k':
      type = 'King';
      break;
  }

  return { type, color, char };
}

export function parseFenToMatrix(fen: string): (BoardPiece | null)[][] {
  const matrix: (BoardPiece | null)[][] = [];
  const placement = fen.split(' ')[0] || '';
  const ranks = placement.split('/');

  for (let r = 0; r < 8; r++) {
    const row: (BoardPiece | null)[] = [];
    const rankStr = ranks[r] || '8';

    for (const char of rankStr) {
      if (char >= '1' && char <= '8') {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) {
          row.push(null);
        }
      } else {
        row.push(charToPiece(char));
      }
    }
    matrix.push(row);
  }

  return matrix;
}

export function formatSquare(col: number, row: number): string {
  // col 0 = a, 7 = h. row 0 = rank 8, row 7 = rank 1.
  const fileChar = String.fromCharCode('a'.charCodeAt(0) + col);
  const rankNum = 8 - row;
  return `${fileChar}${rankNum}`;
}

export function getRankAndFile(square: string): { file: number; rank: number } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square.charAt(1), 10);
  return { file, rank };
}

export function getSquareIndex(square: string): { row: number; col: number } {
  const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square.charAt(1), 10);
  const row = 8 - rank;
  return { row, col };
}

export function getSquareColor(square: string): 'light' | 'dark' {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square.charAt(1), 10);
  // a1 is dark. file 0, rank 1 -> (0 + 1) % 2 === 1 -> dark
  return (file + rank) % 2 === 1 ? 'dark' : 'light';
}

export function getOrientedSquares(perspective: PlayerColor): string[] {
  const squares: string[] = [];
  if (perspective === 'White') {
    for (let r = 8; r >= 1; r--) {
      for (let f = 0; f < 8; f++) {
        const fileChar = String.fromCharCode('a'.charCodeAt(0) + f);
        squares.push(`${fileChar}${r}`);
      }
    }
  } else {
    for (let r = 1; r <= 8; r++) {
      for (let f = 7; f >= 0; f--) {
        const fileChar = String.fromCharCode('a'.charCodeAt(0) + f);
        squares.push(`${fileChar}${r}`);
      }
    }
  }
  return squares;
}

export function getOrientedSquareCoords(square: string, perspective: PlayerColor): { col: number; row: number } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square.charAt(1), 10);
  if (perspective === 'White') {
    return {
      col: file,
      row: 8 - rank
    };
  } else {
    return {
      col: 7 - file,
      row: rank - 1
    };
  }
}

export function isCaptureMove(from: string, to: string, board: (BoardPiece | null)[][]): boolean {
  const { row, col } = getSquareIndex(to);
  return board[row] && board[row][col] !== null;
}

export function isCheckSquare(square: string, inCheck: boolean, activeColor: PlayerColor, board: (BoardPiece | null)[][]): boolean {
  if (!inCheck) return false;
  const { row, col } = getSquareIndex(square);
  const piece = board[row] ? board[row][col] : null;
  return piece !== null && piece.type === 'King' && piece.color === activeColor;
}

export function getEligibleSwapSquares(fen: string, color: PlayerColor): string[] {
  const matrix = parseFenToMatrix(fen);
  const eligible: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = matrix[r][c];
      if (piece && piece.color === color && piece.type !== 'King') {
        eligible.push(formatSquare(c, r));
      }
    }
  }
  return eligible;
}

export function getEligibleRevivalSquares(fen: string, color: PlayerColor, pieceType?: string | null): string[] {
  const matrix = parseFenToMatrix(fen);
  const eligible: string[] = [];
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;
    const inOwnHalf = color === 'White' ? rank <= 4 : rank >= 5;
    if (!inOwnHalf) continue;
    if (pieceType === 'Pawn' && (rank === 1 || rank === 8)) continue;

    for (let c = 0; c < 8; c++) {
      const piece = matrix[r][c];
      if (!piece) {
        eligible.push(formatSquare(c, r));
      }
    }
  }
  return eligible;
}
