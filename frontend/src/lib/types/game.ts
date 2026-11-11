export type PlayerColor = 'White' | 'Black';

export type PieceType = 'Pawn' | 'Knight' | 'Bishop' | 'Rook' | 'Queen' | 'King';

export interface BoardPiece {
  type: PieceType;
  color: PlayerColor;
  char: string;
}

export type TurnPhase = 'DrawPhase' | 'ActionPhase' | 'AwaitingChoice' | 'TurnEnded';

export type GameStatus =
  | 'WaitingForPlayer'
  | 'Ready'
  | 'Active'
  | 'Check'
  | 'Checkmate'
  | 'Stalemate'
  | 'DrawByInsufficientMaterial'
  | 'DrawByFiftyMoveRule'
  | 'DrawByThreefoldRepetition'
  | 'Resigned'
  | 'Timeout';

export interface CardModel {
  id: string;
  name: string;
  category: 'NUMBER' | 'ACTION' | 'WILD' | string;
  description: string;
  effectKey: string;
  value?: number | null;
}

export interface GameSnapshot {
  gameId: string;
  status: string;
  assignedColor: PlayerColor;
  boardFen: string;
  activePlayer: PlayerColor;
  turnPhase: TurnPhase;
  remainingMoves: number;
  remainingRevivals: number;
  canSwap: boolean;
  inCheck: boolean;
  gameStatus: string;
  winner?: PlayerColor | null;
  remainingDeckCount: number;
  playerWhiteName?: string;
  playerBlackName?: string;
  activeCard?: CardModel | null;
  whiteReserves: string[];
  blackReserves: string[];
  legalMoves: string[];
  revision: number;
  availableChoices?: string[];
  sessionStatus?: string;
}

export interface GameStateUpdate {
  boardFen: string;
  activePlayer: PlayerColor;
  turnPhase: TurnPhase;
  remainingMoves: number;
  remainingRevivals?: number;
  canSwap?: boolean;
  inCheck?: boolean;
  gameStatus: string;
  winner?: PlayerColor | null;
  revision: number;
  remainingDeckCount?: number;
  activeCard?: CardModel | null;
  whiteReserves?: string[];
  blackReserves?: string[];
  legalMoves?: string[];
  availableChoices?: string[];
  sessionStatus?: string;
}

export interface MoveAcceptedData {
  player: string;
  from: string;
  to: string;
  boardFen: string;
}

export interface CardDrawnData {
  player: string;
  cardName: string;
  remainingDeckCount: number;
  card?: CardModel;
}

export interface PlayerConnectedData {
  playerName: string;
  color: string;
  isReconnected?: boolean;
  revision?: number;
}

export interface PieceRevivedData {
  player: string;
  piece: string;
  targetSquare: string;
  boardFen: string;
}

export interface PiecesSwappedData {
  player: string;
  square1: string;
  square2: string;
  boardFen: string;
}

export interface EffectChosenData {
  player: string;
  choice: string;
}

export interface InvitationInfo {
  gameId: string;
  status: string;
  creatorName: string;
  assignedColor: PlayerColor;
}

export interface CreateGameResponse {
  gameId: string;
  invitationToken: string;
  invitationUrl: string;
  playerId: string;
  playerToken: string;
  assignedColor: PlayerColor;
  status: string;
}

export interface JoinGameResponse {
  gameId: string;
  playerId: string;
  playerToken: string;
  assignedColor: PlayerColor;
  status: string;
}

export interface GameSessionView {
  gameId: string;
  status: string;
  playerWhiteName?: string;
  playerBlackName?: string;
  boardFen: string;
  revision: number;
}

