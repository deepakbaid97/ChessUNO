import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { cardAnimationService, getCardEffectConfig } from './cardAnimationService';
import type { CardModel } from '../types/game';

describe('cardAnimationService', () => {
  const numberCard: CardModel = {
    id: 'card-num-3',
    name: '3 Moves',
    category: 'NUMBER',
    description: 'Make up to 3 chess moves this turn.',
    effectKey: 'MOVE_3',
    value: 3
  };

  const reverseCard: CardModel = {
    id: 'card-reverse-1',
    name: 'Reverse',
    category: 'ACTION',
    description: 'Swap two of your pieces.',
    effectKey: 'SWAP_FRIENDLY_PIECES',
    value: null
  };

  const revivalCard: CardModel = {
    id: 'card-draw-two-1',
    name: 'Draw Two',
    category: 'ACTION',
    description: 'Revive up to 2 pieces.',
    effectKey: 'REVIVE_UP_TO_TWO',
    value: null
  };

  const wildCard: CardModel = {
    id: 'card-wild-1',
    name: 'Wild Card',
    category: 'WILD',
    description: 'Choose your tactical effect.',
    effectKey: 'WILD_CHOICE',
    value: null
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cardAnimationService.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('configures distinct effect themes by card category and ID', () => {
    const numConfig = getCardEffectConfig(numberCard);
    expect(numConfig.burstType).toBe('number');
    expect(numConfig.shockwaveColor).toBe('#3b82f6');

    const revConfig = getCardEffectConfig(reverseCard);
    expect(revConfig.burstType).toBe('reverse');
    expect(revConfig.accentColor).toBe('#f59e0b');

    const drawConfig = getCardEffectConfig(revivalCard);
    expect(drawConfig.burstType).toBe('revival');
    expect(drawConfig.accentColor).toBe('#4edea3');

    const wConfig = getCardEffectConfig(wildCard);
    expect(wConfig.burstType).toBe('wild');
    expect(wConfig.accentColor).toBe('#c084fc');
  });

  it('triggers reveal on valid card and transitions into anticipation phase', () => {
    const triggered = cardAnimationService.triggerCardReveal(numberCard, {
      drawerColor: 'White',
      isLocalPlayer: true
    });

    expect(triggered).toBe(true);

    const state = get(cardAnimationService);
    expect(state.isActive).toBe(true);
    expect(state.phase).toBe('anticipation');
    expect(state.card?.id).toBe('card-num-3');
    expect(state.drawerColor).toBe('White');
    expect(state.isLocalPlayer).toBe(true);
  });

  it('suppresses duplicate animation events for the same card draw', () => {
    const first = cardAnimationService.triggerCardReveal(numberCard, {
      drawerColor: 'White'
    });
    expect(first).toBe(true);

    const duplicate = cardAnimationService.triggerCardReveal(numberCard, {
      drawerColor: 'White'
    });
    expect(duplicate).toBe(false);
  });

  it('allows same card to trigger animation on subsequent turn with different revision', () => {
    // Turn 1 draw
    const turn1 = cardAnimationService.triggerCardReveal(numberCard, {
      drawerColor: 'White',
      revision: 2,
      drawKey: 'draw-2-White-card-num-3-1'
    });
    expect(turn1).toBe(true);

    // Stale duplicate event for Turn 1 is suppressed
    const duplicateTurn1 = cardAnimationService.triggerCardReveal(numberCard, {
      drawerColor: 'White',
      revision: 2,
      drawKey: 'draw-2-White-card-num-3-1'
    });
    expect(duplicateTurn1).toBe(false);

    // Turn 3: White draws the exact same card-num-3 again
    const turn3 = cardAnimationService.triggerCardReveal(numberCard, {
      drawerColor: 'White',
      revision: 6,
      drawKey: 'draw-6-White-card-num-3-2'
    });
    expect(turn3).toBe(true);
    expect(get(cardAnimationService).sequenceId).toBeGreaterThan(1);
  });

  it('resets last revealed ID when resetLastRevealed is called', () => {
    const first = cardAnimationService.triggerCardReveal(numberCard, { drawerColor: 'White' });
    expect(first).toBe(true);

    // Without reset, duplicate is blocked
    expect(cardAnimationService.triggerCardReveal(numberCard, { drawerColor: 'White' })).toBe(false);

    // Turn ends, reset called
    cardAnimationService.resetLastRevealed();

    // Now drawing same card is accepted
    const second = cardAnimationService.triggerCardReveal(numberCard, { drawerColor: 'White' });
    expect(second).toBe(true);
  });

  it('allows forced re-trigger when force flag is set', () => {
    cardAnimationService.triggerCardReveal(numberCard);
    const forced = cardAnimationService.triggerCardReveal(numberCard, { force: true });
    expect(forced).toBe(true);
  });

  it('cleans up via dismiss and reset', () => {
    cardAnimationService.triggerCardReveal(numberCard);
    expect(get(cardAnimationService).isActive).toBe(true);

    cardAnimationService.dismiss();
    expect(get(cardAnimationService).isActive).toBe(false);
    expect(get(cardAnimationService).card).toBeNull();
  });

  it('failsafe timer automatically dismisses overlay after timeout', () => {
    cardAnimationService.triggerCardReveal(numberCard);
    expect(get(cardAnimationService).isActive).toBe(true);

    vi.advanceTimersByTime(3500);

    expect(get(cardAnimationService).isActive).toBe(false);
  });
});

