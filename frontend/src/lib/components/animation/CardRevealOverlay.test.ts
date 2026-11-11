import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CardRevealOverlay from './CardRevealOverlay.svelte';
import { cardAnimationService } from '../../services/cardAnimationService';
import type { CardModel } from '../../types/game';

describe('CardRevealOverlay Component', () => {
  const mockCard: CardModel = {
    id: 'card-num-4',
    name: '4 Moves',
    category: 'NUMBER',
    description: 'Make up to 4 chess moves this turn.',
    effectKey: 'MOVE_4',
    value: 4
  };

  beforeEach(() => {
    vi.useFakeTimers();
    cardAnimationService.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when cardRevealStore is idle', () => {
    const { queryByTestId } = render(CardRevealOverlay);
    expect(queryByTestId('card-reveal-overlay')).toBeNull();
  });

  it('renders overlay when card animation is triggered with authoritative card', async () => {
    const { getByTestId, getByText } = render(CardRevealOverlay);

    cardAnimationService.triggerCardReveal(mockCard, {
      drawerColor: 'White',
      isLocalPlayer: true
    });

    // Wait for Svelte reactivity
    await vi.advanceTimersByTimeAsync(20);

    const overlay = getByTestId('card-reveal-overlay');
    expect(overlay).toBeTruthy();
    expect(getByText('4 Moves')).toBeTruthy();
    expect(getByText('Make up to 4 chess moves this turn.')).toBeTruthy();
    expect(getByText('NUMBER')).toBeTruthy();
  });

  it('pops and renders Card 0 with 0 symbol and pass turn description instead of skipping', async () => {
    const zeroCard: CardModel = {
      id: 'card-0',
      name: '0 Card',
      category: 'NUMBER',
      description: 'Pass turn without making any chess moves.',
      effectKey: 'PASS_TURN_EFFECT',
      value: 0
    };

    const { getByTestId, getByText, getAllByText } = render(CardRevealOverlay);

    cardAnimationService.triggerCardReveal(zeroCard, {
      drawerColor: 'White',
      isLocalPlayer: true
    });

    await vi.advanceTimersByTimeAsync(20);

    const overlay = getByTestId('card-reveal-overlay');
    expect(overlay).toBeTruthy();
    expect(getByText('0 Card')).toBeTruthy();
    expect(getByText('Pass turn without making any chess moves.')).toBeTruthy();
    // Symbol '0' appears in corner-index and center-emblem
    expect(getAllByText('0').length).toBeGreaterThanOrEqual(1);
  });

  it('pops and renders Draw Two card with +2 symbol and revival styling', async () => {
    const drawTwoCard: CardModel = {
      id: 'card-draw-two',
      name: 'Draw Two (+2)',
      category: 'ACTION',
      description: 'Revive up to 2 captured friendly pieces.',
      effectKey: 'REVIVE_UP_TO_TWO',
      value: null
    };

    const { getByTestId, getByText, getAllByText } = render(CardRevealOverlay);

    cardAnimationService.triggerCardReveal(drawTwoCard, {
      drawerColor: 'Black',
      isLocalPlayer: false
    });

    await vi.advanceTimersByTimeAsync(20);

    const overlay = getByTestId('card-reveal-overlay');
    expect(overlay).toBeTruthy();
    expect(getByText('Draw Two (+2)')).toBeTruthy();
    expect(getByText('Revive up to 2 captured friendly pieces.')).toBeTruthy();
    expect(getAllByText('+2').length).toBeGreaterThanOrEqual(1);
  });

  it('dismisses immediately on user tap/skip', async () => {
    const { getByTestId, queryByTestId } = render(CardRevealOverlay);

    cardAnimationService.triggerCardReveal(mockCard);
    await vi.advanceTimersByTimeAsync(20);

    const overlay = getByTestId('card-reveal-overlay');
    await fireEvent.click(overlay);

    await vi.advanceTimersByTimeAsync(10);
    expect(queryByTestId('card-reveal-overlay')).toBeNull();
  });
});

