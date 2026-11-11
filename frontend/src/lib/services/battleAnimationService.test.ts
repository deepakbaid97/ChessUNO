import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  battleAnimationService,
  battleAnimationStore,
  detectCaptureEvent,
  detectPawnCaptureEvent
} from './battleAnimationService';

describe('battleAnimationService', () => {
  beforeEach(() => {
    battleAnimationService.reset();
  });

  describe('detectCaptureEvent (generalized piece capture detection)', () => {
    it('detects a standard white pawn capturing a black pawn', () => {
      // White pawn on d4, Black pawn on e5
      const prevFen = 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
      // After d4xe5
      const currentFen = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2';
      const lastMove = { from: 'd4', to: 'e5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'Black' });
      expect(event?.attackStyle).toBe('charge');
      expect(event?.from).toBe('d4');
      expect(event?.to).toBe('e5');
    });

    it('detects an en-passant pawn capture', () => {
      const prevFen = 'rnbqkbnr/pppp2pp/8/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
      const currentFen = 'rnbqkbnr/pppp2pp/5P2/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3';
      const lastMove = { from: 'e5', to: 'f6' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.isEnPassant).toBe(true);
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'Black' });
    });

    it('detects a White Knight capturing a Black Pawn', () => {
      // White Knight on f3, Black Pawn on e5
      const prevFen = 'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2';
      // After f3xe5 (Nxe5)
      const currentFen = 'rnbqkbnr/pppp1ppp/8/4N3/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 2';
      const lastMove = { from: 'f3', to: 'e5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Knight', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'Black' });
      expect(event?.attackStyle).toBe('leap');
      expect(event?.from).toBe('f3');
      expect(event?.to).toBe('e5');
    });

    it('detects a White Pawn capturing a Black Knight', () => {
      // White Pawn on e4, Black Knight on d5
      const prevFen = 'rnbqkb1r/ppp1pppp/8/3n4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';
      // After e4xd5 (exd5)
      const currentFen = 'rnbqkb1r/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3';
      const lastMove = { from: 'e4', to: 'd5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Knight', color: 'Black' });
      expect(event?.attackStyle).toBe('charge');
    });

    it('detects a Knight capturing another Knight', () => {
      // White Knight on c3, Black Knight on d5
      const prevFen = 'r1bqkbnr/ppp1pppp/8/3n4/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 3';
      // After c3xd5 (Nxd5)
      const currentFen = 'r1bqkbnr/ppp1pppp/8/3N4/8/8/PPPPPPPP/R1BQKBNR b KQkq - 0 3';
      const lastMove = { from: 'c3', to: 'd5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Knight', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Knight', color: 'Black' });
      expect(event?.attackStyle).toBe('leap');
    });

    it('detects a Rook capturing a Pawn with smash attack style', () => {
      // White Rook on d1, Black Pawn on d5
      const prevFen = 'rnbqkbnr/ppp1pppp/8/3p4/8/8/PPP1PPPP/3RKB1R w KQkq - 0 3';
      // After d1xd5 (Rxd5)
      const currentFen = 'rnbqkbnr/ppp1pppp/8/3R4/8/8/PPP1PPPP/4KB1R b KQkq - 0 3';
      const lastMove = { from: 'd1', to: 'd5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Rook', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'Black' });
      expect(event?.attackStyle).toBe('smash');
      expect(event?.from).toBe('d1');
      expect(event?.to).toBe('d5');
    });

    it('detects a Pawn capturing a Rook with charge attack style', () => {
      // Black Pawn on a6, White Rook on b5
      const prevFen = 'rnbqkbnr/1ppppppp/p7/1R6/8/8/PPPPPPPP/RNBQKBN1 b Qkq - 0 3';
      // After a6xb5 (axb5)
      const currentFen = 'rnbqkbnr/1ppppppp/8/1p6/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 4';
      const lastMove = { from: 'a6', to: 'b5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'Black' });
      expect(event?.defender).toEqual({ piece: 'Rook', color: 'White' });
      expect(event?.attackStyle).toBe('charge');
    });

    it('detects a Rook capturing a Knight with smash attack style', () => {
      // White Rook on e1, Black Knight on e5
      const prevFen = 'rnbqkb1r/pppp1ppp/8/4n3/8/8/PPPPPPPP/4R1K1 w KQkq - 0 3';
      // After e1xe5 (Rxe5)
      const currentFen = 'rnbqkb1r/pppp1ppp/8/4R3/8/8/PPPPPPPP/6K1 b Qkq - 0 3';
      const lastMove = { from: 'e1', to: 'e5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Rook', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Knight', color: 'Black' });
      expect(event?.attackStyle).toBe('smash');
    });

    it('detects a Knight capturing a Rook with leap attack style', () => {
      // White Knight on c7, Black Rook on a8
      const prevFen = 'rnbqkbnr/ppNp1ppp/8/8/8/8/PPPPPPPP/R1BQKBNR w KQkq - 0 4';
      // After c7xa8 (Nxa8)
      const currentFen = 'Nnbqkbnr/pp1p1ppp/8/8/8/8/PPPPPPPP/R1BQKBNR b KQkq - 0 4';
      const lastMove = { from: 'c7', to: 'a8' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Knight', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Rook', color: 'Black' });
      expect(event?.attackStyle).toBe('leap');
    });

    it('detects a Rook capturing another Rook with smash attack style', () => {
      // White Rook on a1, Black Rook on a8
      const prevFen = 'rnbqkbnr/1ppppppp/8/8/8/8/1PPPPPPP/R3KBNR w KQkq - 0 5';
      // After a1xa8 (Rxa8)
      const currentFen = 'Rnbqkbnr/1ppppppp/8/8/8/8/1PPPPPPP/4KBNR b Kkq - 0 5';
      const lastMove = { from: 'a1', to: 'a8' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Rook', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Rook', color: 'Black' });
      expect(event?.attackStyle).toBe('smash');
    });

    it('returns null when an unsupported piece type is the attacker (e.g. Queen captures Knight or Rook)', () => {
      // Queen on d1 captures Knight on d5
      const prevFen = 'r1bqkbnr/ppp1pppp/8/3n4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 3';
      const currentFen = 'r1bqkbnr/ppp1pppp/8/3Q4/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 3';
      const lastMove = { from: 'd1', to: 'd5' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).toBeNull();
    });

    it('returns null when an unsupported piece type is the defender (e.g. Rook captures Bishop)', () => {
      // White Rook on d1 captures Black Bishop on d7
      const prevFen = 'rnbqk1nr/pppbpppp/8/8/8/8/PPPPPPPP/RN1QKBNR w KQkq - 0 4';
      const currentFen = 'rnbqk1nr/pppRpppp/8/8/8/8/PPPPPPPP/1N1QKBNR b Kkq - 0 4';
      const lastMove = { from: 'd1', to: 'd7' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).toBeNull();
    });

    it('returns null for non-capture rook movement', () => {
      // White Rook on a1 moves to a4 (empty square)
      const prevFen = 'rnbqkbnr/1ppppppp/8/8/8/8/1PPPPPPP/R3KBNR w KQkq - 0 5';
      const currentFen = 'rnbqkbnr/1ppppppp/8/8/R7/8/1PPPPPPP/4KBNR b Kkq - 1 5';
      const lastMove = { from: 'a1', to: 'a4' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).toBeNull();
    });

    it('returns null for non-capture knight movement', () => {
      // White Knight on b1 moves to c3 (empty square)
      const prevFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const currentFen = 'rnbqkbnr/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR b KQkq - 1 1';
      const lastMove = { from: 'b1', to: 'c3' };

      const event = detectCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).toBeNull();
    });
  });

  describe('detectPawnCaptureEvent (legacy compatibility)', () => {
    it('detects pawn-vs-pawn captures', () => {
      const prevFen = 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
      const currentFen = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2';
      const lastMove = { from: 'd4', to: 'e5' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker.piece).toBe('Pawn');
      expect(event?.defender.piece).toBe('Pawn');
    });

    it('returns null when knight is involved in capture for detectPawnCaptureEvent', () => {
      const prevFen = 'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2';
      const currentFen = 'rnbqkbnr/pppp1ppp/8/4N3/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 2';
      const lastMove = { from: 'f3', to: 'e5' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).toBeNull();
    });

    it('returns null when lastMove is null or invalid', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      expect(detectPawnCaptureEvent(fen, fen, null)).toBeNull();
      expect(detectPawnCaptureEvent('', fen, { from: 'e2', to: 'e4' })).toBeNull();
      expect(detectPawnCaptureEvent(fen, fen, { from: 'e2', to: 'e4' })).toBeNull();
    });

    it('rejects stale lastMove when board state does not match the move', () => {
      // Suppose lastMove was d4-e5 from previous turn, but current transition is a card revival or different move
      const prevFen = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2';
      // Black plays h7-h6, but stale lastMove is still d4-e5
      const currentFen = 'rnbqkbnr/pppp1pp1/7p/4P3/8/8/PPP1PPPP/RNBQKBNR w KQkq - 0 3';
      const staleMove = { from: 'd4', to: 'e5' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, staleMove);
      expect(event).toBeNull();
    });

    it('rejects card-induced FEN changes that are not pawn captures', () => {
      // e.g. Revive a pawn to an empty square
      const prevFen = 'rnbqkbnr/pppp1ppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const currentFen = 'rnbqkbnr/pppp1ppp/8/8/4P3/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      const move = { from: 'e2', to: 'e3' }; // Fake or stale move

      const event = detectPawnCaptureEvent(prevFen, currentFen, move);
      expect(event).toBeNull();
    });
  });

  describe('lifecycle and duplicate prevention', () => {
    const sampleEvent = {
      id: 'test-event-1',
      attacker: { piece: 'Pawn' as const, color: 'White' as const },
      defender: { piece: 'Pawn' as const, color: 'Black' as const },
      from: 'd4',
      to: 'e5'
    };

    it('activates store on triggerBattle and progresses through phases', () => {
      const triggered = battleAnimationService.triggerBattle(sampleEvent);
      expect(triggered).toBe(true);

      let state = get(battleAnimationStore);
      expect(state.isActive).toBe(true);
      expect(state.currentEvent).toEqual(sampleEvent);
      expect(state.phase).toBe('enter');

      battleAnimationService.setPhase('clash');
      expect(get(battleAnimationStore).phase).toBe('clash');

      battleAnimationService.dismiss();
      state = get(battleAnimationStore);
      expect(state.isActive).toBe(false);
      expect(state.phase).toBe('idle');
      expect(state.currentEvent).toBeNull();
    });

    it('prevents duplicate battle triggers for the same event key or move', () => {
      const firstTrigger = battleAnimationService.triggerBattle(sampleEvent, 'd4-e5-fen1');
      expect(firstTrigger).toBe(true);

      // Attempting immediate duplicate with same key
      const duplicateTrigger = battleAnimationService.triggerBattle(sampleEvent, 'd4-e5-fen1');
      expect(duplicateTrigger).toBe(false);

      // Even after dismissal, the same move key is not replayed
      battleAnimationService.dismiss();
      const replayedTrigger = battleAnimationService.triggerBattle(sampleEvent, 'd4-e5-fen1');
      expect(replayedTrigger).toBe(false);

      // A different move key is accepted
      const nextMoveTrigger = battleAnimationService.triggerBattle(
        { ...sampleEvent, id: 'test-event-2', from: 'c4', to: 'd5' },
        'c4-d5-fen2'
      );
      expect(nextMoveTrigger).toBe(true);
    });

    it('gracefully handles queueing overlapping battles without losing events', () => {
      const firstTrigger = battleAnimationService.triggerBattle(sampleEvent, 'key-1');
      expect(firstTrigger).toBe(true);
      expect(get(battleAnimationStore).currentEvent?.id).toBe('test-event-1');

      // Second battle triggers while first is still active: it should be queued
      const secondEvent = { ...sampleEvent, id: 'test-event-2', from: 'c4', to: 'd5' };
      const secondTrigger = battleAnimationService.triggerBattle(secondEvent, 'key-2');
      expect(secondTrigger).toBe(true);

      // The currently playing event should still be the first one
      expect(get(battleAnimationStore).currentEvent?.id).toBe('test-event-1');

      // Dismissing the first battle automatically advances the queue and starts the second battle
      battleAnimationService.dismiss();
      expect(get(battleAnimationStore).isActive).toBe(true);
      expect(get(battleAnimationStore).currentEvent?.id).toBe('test-event-2');

      // Dismissing the second battle brings state back to idle
      battleAnimationService.dismiss();
      expect(get(battleAnimationStore).isActive).toBe(false);
      expect(get(battleAnimationStore).currentEvent).toBeNull();
    });

    it('clears queue and state on reset', () => {
      battleAnimationService.triggerBattle(sampleEvent, 'key-1');
      const secondEvent = { ...sampleEvent, id: 'test-event-2', from: 'c4', to: 'd5' };
      battleAnimationService.triggerBattle(secondEvent, 'key-2');

      battleAnimationService.reset();

      const state = get(battleAnimationStore);
      expect(state.isActive).toBe(false);
      expect(state.currentEvent).toBeNull();
      expect(state.phase).toBe('idle');
    });
  });
});

