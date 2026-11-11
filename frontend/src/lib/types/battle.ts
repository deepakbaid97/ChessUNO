import type { PlayerColor } from './game';

export interface BattleCombatant {
  piece: 'Pawn';
  color: PlayerColor;
}

export interface BattleEvent {
  id: string;
  attacker: BattleCombatant;
  defender: BattleCombatant;
  from: string;
  to: string;
  isEnPassant?: boolean;
}

export type BattlePhase = 'idle' | 'enter' | 'clash' | 'impact' | 'outcome' | 'exit';

export interface BattleAnimationState {
  isActive: boolean;
  currentEvent: BattleEvent | null;
  phase: BattlePhase;
  eventId: string;
}

