import { writable } from 'svelte/store';
import { parseFenToMatrix, getSquareIndex } from '../utils/boardUtils';
import type { BattleAnimationState, BattleEvent, BattlePhase } from '../types/battle';

export function detectPawnCaptureEvent(
  prevFen: string,
  currentFen: string,
  lastMove: { from: string; to: string } | null
): BattleEvent | null {
  if (!prevFen || !currentFen || !lastMove || !lastMove.from || !lastMove.to) {
    return null;
  }

  const prevBoard = parseFenToMatrix(prevFen);
  const currentBoard = parseFenToMatrix(currentFen);

  const { row: fromRow, col: fromCol } = getSquareIndex(lastMove.from);
  const { row: toRow, col: toCol } = getSquareIndex(lastMove.to);

  const movedPiece = prevBoard[fromRow]?.[fromCol];
  if (!movedPiece || movedPiece.type !== 'Pawn') {
    return null;
  }

  const directCapturedPiece = prevBoard[toRow]?.[toCol];

  // Standard Pawn-on-Pawn Capture
  if (directCapturedPiece && directCapturedPiece.type === 'Pawn') {
    return {
      id: `pawn-capture-${lastMove.from}-${lastMove.to}-${Date.now()}`,
      attacker: { piece: 'Pawn', color: movedPiece.color },
      defender: { piece: 'Pawn', color: directCapturedPiece.color },
      from: lastMove.from,
      to: lastMove.to,
      isEnPassant: false
    };
  }

  // En-Passant Pawn Capture
  if (lastMove.from[0] !== lastMove.to[0] && !directCapturedPiece) {
    const enPassantCapturedPiece = prevBoard[fromRow]?.[toCol];
    if (
      enPassantCapturedPiece &&
      enPassantCapturedPiece.type === 'Pawn' &&
      enPassantCapturedPiece.color !== movedPiece.color
    ) {
      if (!currentBoard[fromRow]?.[toCol]) {
        return {
          id: `pawn-en-passant-${lastMove.from}-${lastMove.to}-${Date.now()}`,
          attacker: { piece: 'Pawn', color: movedPiece.color },
          defender: { piece: 'Pawn', color: enPassantCapturedPiece.color },
          from: lastMove.from,
          to: lastMove.to,
          isEnPassant: true
        };
      }
    }
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
  private lastProcessedKey = '';
  private sequenceCounter = 0;

  triggerBattle(event: BattleEvent, eventKey?: string): boolean {
    const key = eventKey || `${event.from}-${event.to}-${event.id}`;
    if (key === this.lastProcessedKey) {
      return false;
    }

    this.lastProcessedKey = key;
    this.sequenceCounter++;

    battleAnimationStore.set({
      isActive: true,
      currentEvent: event,
      phase: 'enter',
      eventId: event.id
    });

    return true;
  }

  setPhase(phase: BattlePhase) {
    battleAnimationStore.update(s => ({
      ...s,
      phase
    }));
  }

  dismiss() {
    battleAnimationStore.set({
      isActive: false,
      currentEvent: null,
      phase: 'idle',
      eventId: ''
    });
  }

  reset() {
    this.lastProcessedKey = '';
    this.sequenceCounter = 0;
    this.dismiss();
  }
}

export const battleAnimationService = new BattleAnimationService();

