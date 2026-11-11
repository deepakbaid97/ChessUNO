import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  battleAnimationService,
  battleAnimationStore,
  detectPawnCaptureEvent
} from './battleAnimationService';

describe('battleAnimationService', () => {
  beforeEach(() => {
    battleAnimationService.reset();
  });

  describe('detectPawnCaptureEvent', () => {
    it('detects a standard white pawn capturing a black pawn', () => {
      // White pawn on d4, Black pawn on e5
      const prevFen = 'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2';
      // After d4xe5
      const currentFen = 'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2';
      const lastMove = { from: 'd4', to: 'e5' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'Black' });
      expect(event?.from).toBe('d4');
      expect(event?.to).toBe('e5');
    });

    it('detects a black pawn capturing a white pawn', () => {
      // White pawn on e4, Black pawn on d5
      const prevFen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
      // After d5xe4
      const currentFen = 'rnbqkbnr/ppp1pppp/8/8/4p3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3';
      const lastMove = { from: 'd5', to: 'e4' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'Black' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'White' });
    });

    it('detects an en-passant pawn capture', () => {
      // Black just played f7-f5 adjacent to White pawn on e5
      const prevFen = 'rnbqkbnr/pppp2pp/8/4Pp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
      // White plays e5xf6 (en-passant)
      const currentFen = 'rnbqkbnr/pppp2pp/5P2/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3';
      const lastMove = { from: 'e5', to: 'f6' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).not.toBeNull();
      expect(event?.isEnPassant).toBe(true);
      expect(event?.attacker).toEqual({ piece: 'Pawn', color: 'White' });
      expect(event?.defender).toEqual({ piece: 'Pawn', color: 'Black' });
    });

    it('returns null for normal pawn movement without capture', () => {
      const prevFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const currentFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const lastMove = { from: 'e2', to: 'e4' };

      const event = detectPawnCaptureEvent(prevFen, currentFen, lastMove);
      expect(event).toBeNull();
    });

    it('returns null when a non-pawn piece captures or is captured', () => {
      // Knight on f3 captures pawn on e5
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

