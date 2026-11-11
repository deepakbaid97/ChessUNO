import type { PlayerColor, PieceType } from './game';

export type AttackStyle = 'strike' | 'charge' | 'leap' | 'slash' | 'smash';

export interface BattleCombatant {
  piece: PieceType;
  color: PlayerColor;
}

export interface BattleEvent {
  id: string;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  from: string;
  to: string;
  isEnPassant?: boolean;
  attackStyle?: AttackStyle;
}

export type BattlePhase = 'idle' | 'enter' | 'clash' | 'impact' | 'outcome' | 'exit';

export interface BattleAnimationState {
  isActive: boolean;
  currentEvent: BattleEvent | null;
  phase: BattlePhase;
  eventId: string;
}

