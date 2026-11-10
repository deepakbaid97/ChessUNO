import type { CardModel, PlayerColor } from './game';

export type RevealPhase =
  | 'idle'
  | 'anticipation'
  | 'launch'
  | 'reveal'
  | 'celebration'
  | 'return'
  | 'complete';

export interface CardEffectConfig {
  accentColor: string;
  glowColor: string;
  particleColors: string[];
  shockwaveColor: string;
  flashColor: string;
  burstType: 'number' | 'reverse' | 'revival' | 'wild' | 'skip';
}

export interface RevealCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardRevealState {
  isActive: boolean;
  phase: RevealPhase;
  card: CardModel | null;
  drawerColor: PlayerColor;
  isLocalPlayer: boolean;
  sourceRect: RevealCoordinates | null;
  targetRect: RevealCoordinates | null;
  effectConfig: CardEffectConfig | null;
  revealId: string;
}

export interface RevealRequestOptions {
  drawerColor?: PlayerColor;
  isLocalPlayer?: boolean;
  sourceRect?: RevealCoordinates | null;
  targetRect?: RevealCoordinates | null;
  force?: boolean;
}
