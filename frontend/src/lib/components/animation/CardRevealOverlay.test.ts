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

