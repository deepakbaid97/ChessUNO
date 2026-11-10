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
