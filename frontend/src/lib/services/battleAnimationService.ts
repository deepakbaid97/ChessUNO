import { writable } from 'svelte/store';
import { parseFenToMatrix, getSquareIndex } from '../utils/boardUtils';
import type { BattleAnimationState, BattleEvent, BattlePhase, AttackStyle } from '../types/battle';
import type { PieceType } from '../types/game';

export const SUPPORTED_ATTACK_PIECES = new Set<PieceType>([
  'Pawn',
  'Knight',
  'Rook',
  'Bishop',
  'Queen',
  'King'
]);

export const SUPPORTED_DEFEND_PIECES = new Set<PieceType>([
  'Pawn',
  'Knight',
  'Rook',
  'Bishop',
  'Queen'
]);

// Maintained for backwards compatibility
export const SUPPORTED_BATTLE_PIECES = SUPPORTED_ATTACK_PIECES;
export const SUPPORTED_RENDER_PIECES = new Set<PieceType>([
  'Pawn',
  'Knight',
  'Rook',
  'Bishop',
  'Queen',
  'King'
]);

export function isSupportedBattlePiece(piece: string): piece is PieceType {
  return SUPPORTED_RENDER_PIECES.has(piece as PieceType);
}

export function isSupportedDefendingPiece(piece: string): piece is PieceType {
  return SUPPORTED_DEFEND_PIECES.has(piece as PieceType);
}

export function getAttackStyleForPiece(piece: PieceType): AttackStyle {
  switch (piece) {
    case 'Knight':
      return 'leap';
    case 'Rook':
      return 'smash';
    case 'Bishop':
      return 'spell';
    case 'Queen':
      return 'slash';
    case 'King':
      return 'strike';
    case 'Pawn':
    default:
      return 'charge';
  }
}

export function detectCaptureEvent(
  prevFen: string,
  currentFen: string,
  lastMove: { from: string; to: string } | null
): BattleEvent | null {
  if (!prevFen || !currentFen || !lastMove || !lastMove.from || !lastMove.to) {
    return null;
  }
  if (prevFen === currentFen) {
    return null;
  }

  const prevBoard = parseFenToMatrix(prevFen);
  const currentBoard = parseFenToMatrix(currentFen);

  const { row: fromRow, col: fromCol } = getSquareIndex(lastMove.from);
  const { row: toRow, col: toCol } = getSquareIndex(lastMove.to);

  const movedPiece = prevBoard[fromRow]?.[fromCol];
  if (!movedPiece || !SUPPORTED_ATTACK_PIECES.has(movedPiece.type)) {
    return null;
  }

  // Authoritative validation: 'from' square must be vacated in currentBoard
  if (currentBoard[fromRow]?.[fromCol] !== null) {
    return null;
  }

  // Authoritative validation: 'to' square in currentBoard must contain the moved piece's color
  const destinationPiece = currentBoard[toRow]?.[toCol];
  if (!destinationPiece || destinationPiece.color !== movedPiece.color) {
    return null;
  }

  const directCapturedPiece = prevBoard[toRow]?.[toCol];

  // Standard Direct Capture between supported pieces:
  // Opponent piece captured, must be in SUPPORTED_DEFEND_PIECES (King can never be captured)
  if (
    directCapturedPiece &&
    directCapturedPiece.color !== movedPiece.color &&
    SUPPORTED_DEFEND_PIECES.has(directCapturedPiece.type)
  ) {
    const attackStyle = getAttackStyleForPiece(movedPiece.type);
    return {
      id: `battle-capture-${lastMove.from}-${lastMove.to}-${Date.now()}`,
      attacker: { piece: movedPiece.type, color: movedPiece.color },
      defender: { piece: directCapturedPiece.type, color: directCapturedPiece.color },
      from: lastMove.from,
      to: lastMove.to,
      isEnPassant: false,
      attackStyle
    };
  }

  // En-Passant Pawn Capture (strictly Pawn captures Pawn diagonally)
  if (movedPiece.type === 'Pawn' && lastMove.from[0] !== lastMove.to[0] && !directCapturedPiece) {
    const enPassantCapturedPiece = prevBoard[fromRow]?.[toCol];
    if (
      enPassantCapturedPiece &&
      enPassantCapturedPiece.type === 'Pawn' &&
      enPassantCapturedPiece.color !== movedPiece.color &&
      currentBoard[fromRow]?.[toCol] === null
    ) {
      return {
        id: `pawn-en-passant-${lastMove.from}-${lastMove.to}-${Date.now()}`,
        attacker: { piece: 'Pawn', color: movedPiece.color },
        defender: { piece: 'Pawn', color: enPassantCapturedPiece.color },
        from: lastMove.from,
        to: lastMove.to,
        isEnPassant: true,
        attackStyle: 'charge'
      };
    }
  }

  return null;
}

export function detectPawnCaptureEvent(
  prevFen: string,
  currentFen: string,
  lastMove: { from: string; to: string } | null
): BattleEvent | null {
  const event = detectCaptureEvent(prevFen, currentFen, lastMove);
  if (event && event.attacker.piece === 'Pawn' && event.defender.piece === 'Pawn') {
    return event;
  }
  return null;
}

const initialState: BattleAnimationState = {
  isActive: false,
  currentEvent: null,
  phase: 'idle',
  eventId: ''
};

export const battleAnimationStore = writable<BattleAnimationState>(initialState);

class BattleAnimationService {
  private processedKeys = new Set<string>();
  private queue: { event: BattleEvent; eventKey: string }[] = [];
  private isCurrentlyActive = false;

  triggerBattle(event: BattleEvent, eventKey?: string): boolean {
    if (!event || !event.attacker || !event.defender) {
      return false;
    }
    // King can NEVER appear as the captured defender
    if (event.defender.piece === 'King') {
      return false;
    }
    if (!SUPPORTED_ATTACK_PIECES.has(event.attacker.piece) || !SUPPORTED_DEFEND_PIECES.has(event.defender.piece)) {
      return false;
    }

    const key = eventKey || `${event.from}-${event.to}-${event.id}`;
    if (this.processedKeys.has(key)) {
      return false;
    }

    this.processedKeys.add(key);

    if (this.isCurrentlyActive) {
      this.queue.push({ event, eventKey: key });
      return true;
    }

    this.playEvent(event);
    return true;
  }

  private playEvent(event: BattleEvent) {
    this.isCurrentlyActive = true;
    battleAnimationStore.set({
      isActive: true,
      currentEvent: event,
      phase: 'enter',
      eventId: event.id
    });
  }

  setPhase(phase: BattlePhase) {
    battleAnimationStore.update(s => ({
      ...s,
      phase
    }));
  }

  dismiss() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.playEvent(next.event);
    } else {
      this.isCurrentlyActive = false;
      battleAnimationStore.set({
        isActive: false,
        currentEvent: null,
        phase: 'idle',
        eventId: ''
      });
    }
  }

  reset() {
    this.processedKeys.clear();
    this.queue = [];
    this.isCurrentlyActive = false;
    battleAnimationStore.set({
      isActive: false,
      currentEvent: null,
      phase: 'idle',
      eventId: ''
    });
  }
}

export const battleAnimationService = new BattleAnimationService();

