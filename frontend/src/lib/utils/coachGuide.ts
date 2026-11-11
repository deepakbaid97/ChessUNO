import type { GameSessionState, PlayerColor } from '../types/game';
import { isKingInCheck, parseFenToMatrix, getEligibleRevivalSquares } from './boardUtils';

export interface CoachGuide {
  badge: string;
  tone: 'your-turn' | 'opponent-turn' | 'check' | 'ability';
  headline: string;
  instruction: string;
}

export interface CoachGuideInput {
  isGameOver: boolean;
  isMyTurn: boolean;
  storeState: GameSessionState;
  opponentColor: PlayerColor;
  activeAbilityMode: 'none' | 'swap' | 'revival';
  firstSwapSquare: string | null;
  myReserves: string[];
  selectedRevivalPiece: string | null;
}

export function computeCoachGuide(input: CoachGuideInput): CoachGuide {
  const {
    isGameOver,
    isMyTurn,
    storeState,
    opponentColor,
    activeAbilityMode,
    firstSwapSquare,
    myReserves,
    selectedRevivalPiece
  } = input;

  if (isGameOver) {
    return {
      badge: 'MATCH COMPLETE',
      tone: 'opponent-turn',
      headline: `Game Over — ${storeState.gameStatus}`,
      instruction: storeState.winner ? `${storeState.winner} wins the match.` : 'The match ended in a draw.'
    };
  }

  if (!isMyTurn) {
    return {
      badge: 'OPPONENT TURN',
      tone: 'opponent-turn',
      headline: `Waiting for ${storeState.opponentName || opponentColor}`,
      instruction: `${opponentColor} is completing their turn. Watch the board and turn card below.`
    };
  }

  const boardMatrix = storeState.boardFen ? parseFenToMatrix(storeState.boardFen) : null;
  const isMyKingAttacked = boardMatrix ? isKingInCheck(storeState.assignedColor, boardMatrix) : false;
  const isOpponentKingAttacked = boardMatrix ? isKingInCheck(opponentColor, boardMatrix) : false;
  const myKingInCheck = storeState.inCheck && (isMyKingAttacked || !isOpponentKingAttacked);
  const opponentInCheck = storeState.inCheck && isOpponentKingAttacked && !isMyKingAttacked;

  if (storeState.turnPhase === 'DrawPhase') {
    return {
      badge: myKingInCheck ? 'YOUR TURN • IN CHECK' : 'YOUR TURN • STEP 1',
      tone: myKingInCheck ? 'check' : 'your-turn',
      headline: 'Draw Your Turn Card',
      instruction: 'Tap "Draw Turn Card" below to reveal your action for this turn.'
    };
  }

  if (storeState.turnPhase === 'AwaitingChoice') {
    return {
      badge: 'YOUR TURN • WILD CHOICE',
      tone: 'ability',
      headline: `${storeState.activeCard?.name || 'Wild Card'}: Select an Ability`,
      instruction: 'Choose one of the tactical options in the card panel below to execute.'
    };
  }

  if (activeAbilityMode === 'swap' || storeState.canSwap) {
    if (!firstSwapSquare) {
      return {
        badge: 'REVERSE • STEP 1 OF 2',
        tone: 'ability',
        headline: 'Select 1st Friendly Piece to Swap',
        instruction: 'Tap any of your highlighted pieces on the board (Kings cannot be swapped).'
      };
    }
    return {
      badge: 'REVERSE • STEP 2 OF 2',
      tone: 'ability',
      headline: `Swap ${firstSwapSquare.toUpperCase()} with 2nd Piece`,
      instruction: 'Tap another highlighted friendly piece on the board to exchange their positions.'
    };
  }

  if (activeAbilityMode === 'revival' || storeState.remainingRevivals > 0) {
    if (myReserves.length === 0) {
      return {
        badge: 'REVIVAL • NO RESERVES',
        tone: 'your-turn',
        headline: 'No Captured Pieces to Revive',
        instruction: 'Your reserve pool is empty. Tap "End Turn Early" below to finish your turn.'
      };
    }
    if (myKingInCheck) {
      const eligible = selectedRevivalPiece
        ? getEligibleRevivalSquares(storeState.boardFen, storeState.assignedColor, selectedRevivalPiece)
        : getEligibleRevivalSquares(storeState.boardFen, storeState.assignedColor);

      if (eligible.length === 0) {
        return {
          badge: 'IN CHECK • NO REVIVAL SQUARES',
          tone: 'check',
          headline: 'Cannot Revive While in Check',
          instruction: 'No placement can protect your King from check. Tap "Pass / End Turn" to continue.'
        };
      }

      if (!selectedRevivalPiece) {
        return {
          badge: `IN CHECK • REVIVAL (${storeState.remainingRevivals} LEFT)`,
          tone: 'check',
          headline: 'Select Piece to Block Check',
          instruction: 'Tap a reserve piece to place it between the attacker and your King.'
        };
      }

      return {
        badge: `IN CHECK • REVIVAL (${storeState.remainingRevivals} LEFT)`,
        tone: 'check',
        headline: `Deploy ${selectedRevivalPiece} to Block Check`,
        instruction: 'Tap a highlighted green square to block the enemy check on your King.'
      };
    }

    if (!selectedRevivalPiece) {
      return {
        badge: `REVIVAL (${storeState.remainingRevivals} LEFT) • STEP 1`,
        tone: 'ability',
        headline: 'Select a Captured Piece from Reserve',
        instruction: 'Tap a piece in the Reserve Pool bar below, then place it on your half of the board.'
      };
    }
    const rankRange = storeState.assignedColor === 'White' ? 'ranks 1–4' : 'ranks 5–8';
    return {
      badge: `REVIVAL (${storeState.remainingRevivals} LEFT) • STEP 2`,
      tone: 'ability',
      headline: `Deploy ${selectedRevivalPiece} to the Board`,
      instruction: `Tap any green highlighted square on your half of the board (${rankRange}).`
    };
  }

  if (storeState.remainingMoves > 0) {
    const moveWord = storeState.remainingMoves === 1 ? 'move' : 'moves';
    if (!storeState.selectedSquare) {
      if (myKingInCheck) {
        return {
          badge: `IN CHECK • ${storeState.remainingMoves} ${moveWord.toUpperCase()} LEFT`,
          tone: 'check',
          headline: 'Protect Your King',
          instruction: `Tap one of your pieces on the board to view legal destinations (${storeState.remainingMoves} ${moveWord} remaining).`
        };
      }
      if (opponentInCheck) {
        return {
          badge: `OPPONENT IN CHECK • ${storeState.remainingMoves} ${moveWord.toUpperCase()} LEFT`,
          tone: 'your-turn',
          headline: `Attack! ${opponentColor} King is in Check`,
          instruction: `Select a ${storeState.assignedColor} piece to press your advantage (${storeState.remainingMoves} ${moveWord} remaining).`
        };
      }
      return {
        badge: `YOUR TURN • ${storeState.remainingMoves} ${moveWord.toUpperCase()} LEFT`,
        tone: 'your-turn',
        headline: `Select a ${storeState.assignedColor} Piece to Move`,
        instruction: `Tap one of your pieces on the board to view legal destinations (${storeState.remainingMoves} ${moveWord} remaining).`
      };
    }
    return {
      badge: `PIECE ${storeState.selectedSquare.toUpperCase()} SELECTED`,
      tone: myKingInCheck ? 'check' : 'your-turn',
      headline: `Choose Destination for ${storeState.selectedSquare.toUpperCase()}`,
      instruction: `Tap a green dot (or red capture ring) on the board to move, or tap another piece.`
    };
  }

  return {
    badge: 'YOUR TURN',
    tone: 'your-turn',
    headline: 'Turn Actions Complete',
    instruction: 'Tap "End Turn Early" below if your turn has not completed automatically.'
  };
}
