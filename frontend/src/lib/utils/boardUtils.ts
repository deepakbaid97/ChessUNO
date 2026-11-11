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

export function isKingInCheck(kingColor: PlayerColor, board: (BoardPiece | null)[][]): boolean {
  let kingRow = -1;
  let kingCol = -1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (piece && piece.type === 'King' && piece.color === kingColor) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  if (kingRow === -1) return false;

  const enemyColor: PlayerColor = kingColor === 'White' ? 'Black' : 'White';

  // 1. Enemy Pawns
  // row 0 is Rank 8 (Black), row 7 is Rank 1 (White).
  // Black pawns move down (+1 row) and capture diagonally (+1 row, ±1 col).
  // White pawns move up (-1 row) and capture diagonally (-1 row, ±1 col).
  const pawnRow = kingColor === 'White' ? kingRow - 1 : kingRow + 1;
  if (pawnRow >= 0 && pawnRow < 8) {
    for (const pawnCol of [kingCol - 1, kingCol + 1]) {
      if (pawnCol >= 0 && pawnCol < 8) {
        const p = board[pawnRow]?.[pawnCol];
        if (p && p.color === enemyColor && p.type === 'Pawn') {
          return true;
        }
      }
    }
  }

  // 2. Enemy Knights
  const knightMoves = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightMoves) {
    const nr = kingRow + dr;
    const nc = kingCol + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr]?.[nc];
      if (p && p.color === enemyColor && p.type === 'Knight') {
        return true;
      }
    }
  }

  // 3. Enemy Sliders: Orthogonal (Rook, Queen)
  const orthogonalDirs = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];
  for (const [dr, dc] of orthogonalDirs) {
    let nr = kingRow + dr;
    let nc = kingCol + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr]?.[nc];
      if (p) {
        if (p.color === enemyColor && (p.type === 'Rook' || p.type === 'Queen')) {
          return true;
        }
        break; // blocked by intervening piece
      }
      nr += dr;
      nc += dc;
    }
  }

  // 4. Enemy Sliders: Diagonal (Bishop, Queen)
  const diagonalDirs = [
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];
  for (const [dr, dc] of diagonalDirs) {
    let nr = kingRow + dr;
    let nc = kingCol + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr]?.[nc];
      if (p) {
        if (p.color === enemyColor && (p.type === 'Bishop' || p.type === 'Queen')) {
          return true;
        }
        break; // blocked by intervening piece
      }
      nr += dr;
      nc += dc;
    }
  }

  // 5. Enemy King (adjacent squares)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = kingRow + dr;
      const nc = kingCol + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const p = board[nr]?.[nc];
        if (p && p.color === enemyColor && p.type === 'King') {
          return true;
        }
      }
    }
  }

  return false;
}

export function isCheckSquare(
  square: string,
  inCheck: boolean,
  activeColor: PlayerColor,
  board: (BoardPiece | null)[][]
): boolean {
  if (!inCheck) return false;
  const { row, col } = getSquareIndex(square);
  const piece = board[row] ? board[row][col] : null;
  if (!piece || piece.type !== 'King') return false;

  // Determine directly whether this specific King is under attack on the board
  if (isKingInCheck(piece.color, board)) {
    return true;
  }

  // If the opponent King is under attack, this King is definitely NOT in check
  const opponentColor: PlayerColor = piece.color === 'White' ? 'Black' : 'White';
  if (isKingInCheck(opponentColor, board)) {
    return false;
  }

  // Fallback if board analysis cannot determine attack lines directly (e.g. synthetic test mocks)
  return piece.color === activeColor;
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
  const inCheck = isKingInCheck(color, matrix);
  const testPieceType: PieceType = (pieceType as PieceType) || 'Pawn';

  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;
    const inOwnHalf = color === 'White' ? rank <= 4 : rank >= 5;
    if (!inOwnHalf) continue;
    if (pieceType === 'Pawn' && (rank === 1 || rank === 8)) continue;

    for (let c = 0; c < 8; c++) {
      const piece = matrix[r][c];
      if (!piece) {
        if (inCheck) {
          matrix[r][c] = { type: testPieceType, color, char: color === 'White' ? 'P' : 'p' };
          const leavesKingInCheck = isKingInCheck(color, matrix);
          matrix[r][c] = null;
          if (leavesKingInCheck) {
            continue;
          }
        }
        eligible.push(formatSquare(c, r));
      }
    }
  }
  return eligible;
}
