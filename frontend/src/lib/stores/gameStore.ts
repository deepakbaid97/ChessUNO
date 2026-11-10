import { writable } from 'svelte/store';
import type {
  PlayerColor,
  TurnPhase,
  CardModel,
  GameSnapshot,
  GameStateUpdate,
  MoveAcceptedData,
  CardDrawnData,
  PlayerConnectedData
} from '../types/game';
import { parseFenToMatrix, getSquareIndex } from '../utils/boardUtils';

export interface GameStoreState {
  gameId: string;
  invitationToken: string;
  invitationUrl: string;
  playerToken: string;
  assignedColor: PlayerColor;
  playerName: string;
  opponentName: string;
  boardFen: string;
  activePlayer: PlayerColor;
  turnPhase: TurnPhase;
  remainingMoves: number;
  remainingRevivals: number;
  canSwap: boolean;
  inCheck: boolean;
  gameStatus: string;
  winner: PlayerColor | null;
  remainingDeckCount: number;
  activeCard: CardModel | null;
  whiteReserves: string[];
  blackReserves: string[];
  legalMoves: string[];
  availableChoices: string[];
  revision: number;

  // UI Interactive State
  selectedSquare: string | null;
  validDestinations: string[];
  lastMove: { from: string; to: string } | null;
  logs: string[];
  pendingPromotion: { from: string; to: string } | null;
}

const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function createGameStore() {
  const initialState: GameStoreState = {
    gameId: '',
    invitationToken: '',
    invitationUrl: '',
    playerToken: '',
    assignedColor: 'White',
    playerName: 'Player',
    opponentName: 'Opponent',
    boardFen: initialFen,
    activePlayer: 'White',
    turnPhase: 'DrawPhase',
    remainingMoves: 0,
    remainingRevivals: 0,
    canSwap: false,
    inCheck: false,
    gameStatus: 'WaitingForPlayer',
    winner: null,
    remainingDeckCount: 108,
    activeCard: null,
    whiteReserves: [],
    blackReserves: [],
    legalMoves: [],
    availableChoices: [],
    revision: 0,
    selectedSquare: null,
    validDestinations: [],
    lastMove: null,
    logs: [],
    pendingPromotion: null
  };

  const { subscribe, set, update } = writable<GameStoreState>(initialState);

  function log(message: string) {
    update(s => ({
      ...s,
      logs: [`[${new Date().toLocaleTimeString()}] ${message}`, ...s.logs.slice(0, 99)]
    }));
  }

  return {
    subscribe,
    set,
    update,
    log,
    reset: () => set(initialState),

    setPlayerSession: (session: {
      gameId: string;
      playerToken: string;
      assignedColor: PlayerColor;
      playerName: string;
      invitationUrl?: string;
      invitationToken?: string;
    }) => {
      update(s => ({
        ...s,
        gameId: session.gameId,
        playerToken: session.playerToken,
        assignedColor: session.assignedColor,
        playerName: session.playerName,
        invitationUrl: session.invitationUrl || s.invitationUrl,
        invitationToken: session.invitationToken || s.invitationToken
      }));
    },

    applySnapshot: (snapshot: GameSnapshot) => {
      update(s => {
        return {
          ...s,
          gameId: snapshot.gameId || s.gameId,
          assignedColor: snapshot.assignedColor || s.assignedColor,
          boardFen: snapshot.boardFen || s.boardFen,
          activePlayer: snapshot.activePlayer || s.activePlayer,
          turnPhase: snapshot.turnPhase || s.turnPhase,
          remainingMoves: snapshot.remainingMoves ?? s.remainingMoves,
          remainingRevivals: snapshot.remainingRevivals ?? s.remainingRevivals,
          canSwap: snapshot.canSwap ?? s.canSwap,
          inCheck: snapshot.inCheck ?? s.inCheck,
          gameStatus: snapshot.gameStatus || snapshot.status || s.gameStatus,
          winner: snapshot.winner ?? s.winner,
          remainingDeckCount: snapshot.remainingDeckCount ?? s.remainingDeckCount,
          activeCard: snapshot.activeCard !== undefined ? snapshot.activeCard : s.activeCard,
          whiteReserves: snapshot.whiteReserves || s.whiteReserves,
          blackReserves: snapshot.blackReserves || s.blackReserves,
          legalMoves: snapshot.legalMoves || s.legalMoves,
          availableChoices: snapshot.availableChoices || [],
          revision: snapshot.revision || s.revision,
          opponentName: snapshot.assignedColor === 'White'
            ? (snapshot.playerBlackName || s.opponentName)
            : (snapshot.playerWhiteName || s.opponentName),
          selectedSquare: null,
          validDestinations: []
        };
      });
      log(`Game state snapshot loaded (Rev ${snapshot.revision}).`);
    },

    applyUpdate: (updateData: GameStateUpdate) => {
      update(s => {
        // Anti-regression: discard older revisions
        if (updateData.revision !== undefined && updateData.revision < s.revision) {
          return s;
        }

        return {
          ...s,
          boardFen: updateData.boardFen || s.boardFen,
          activePlayer: updateData.activePlayer || s.activePlayer,
          turnPhase: updateData.turnPhase || s.turnPhase,
          remainingMoves: updateData.remainingMoves ?? s.remainingMoves,
          remainingRevivals: updateData.remainingRevivals ?? s.remainingRevivals,
          canSwap: updateData.canSwap ?? s.canSwap,
          inCheck: updateData.inCheck ?? s.inCheck,
          gameStatus: updateData.gameStatus || s.gameStatus,
          winner: updateData.winner ?? s.winner,
          revision: updateData.revision ?? (s.revision + 1),
          remainingDeckCount: updateData.remainingDeckCount ?? s.remainingDeckCount,
          activeCard: updateData.activeCard !== undefined ? updateData.activeCard : s.activeCard,
          whiteReserves: updateData.whiteReserves || s.whiteReserves,
          blackReserves: updateData.blackReserves || s.blackReserves,
          legalMoves: updateData.legalMoves || s.legalMoves,
          availableChoices: updateData.availableChoices || [],
          selectedSquare: null,
          validDestinations: []
        };
      });
    },

    onMoveAccepted: (data: MoveAcceptedData) => {
      update(s => ({
        ...s,
        boardFen: data.boardFen,
        lastMove: { from: data.from, to: data.to },
        selectedSquare: null,
        validDestinations: [],
        pendingPromotion: null
      }));
      log(`${data.player} moved: ${data.from} ➔ ${data.to}`);
    },

    onCardDrawn: (data: CardDrawnData) => {
      update(s => ({
        ...s,
        remainingDeckCount: data.remainingDeckCount
      }));
      log(`${data.player} drew card: ${data.cardName}`);
    },

    onEffectChosen: (data: { player: string; choice: string }) => {
      log(`${data.player} chose ability: ${data.choice}`);
    },

    onPlayerConnected: (data: PlayerConnectedData) => {
      update(s => ({
        ...s,
        opponentName: data.playerName,
        gameStatus: 'Ready',
        revision: data.revision !== undefined ? data.revision : (s.revision > 0 ? s.revision + 1 : s.revision)
      }));
      log(`Opponent connected: ${data.playerName} (${data.color})`);
    },

    selectSquare: (square: string) => {
      update(s => {
        // If square is already selected, unselect
        if (s.selectedSquare === square) {
          return { ...s, selectedSquare: null, validDestinations: [] };
        }

        // Only allowed to initiate selection of friendly piece on active player's turn
        const matrix = parseFenToMatrix(s.boardFen);
        const { row, col } = getSquareIndex(square);
        const piece = matrix[row]?.[col];

        if (!piece || piece.color !== s.assignedColor) {
          return { ...s, selectedSquare: null, validDestinations: [] };
        }

        // Filter valid destinations from authoritative legal moves (e.g., 'e2e4' -> 'e4')
        const destinations = s.legalMoves
          .filter(m => m.startsWith(square))
          .map(m => m.substring(2, 4));

        return {
          ...s,
          selectedSquare: square,
          validDestinations: Array.from(new Set(destinations))
        };
      });
    },

    clearSelection: () => {
      update(s => ({
        ...s,
        selectedSquare: null,
        validDestinations: []
      }));
    },

    setPendingPromotion: (move: { from: string; to: string } | null) => {
      update(s => ({ ...s, pendingPromotion: move }));
    }
  };
}

export const gameStore = createGameStore();

