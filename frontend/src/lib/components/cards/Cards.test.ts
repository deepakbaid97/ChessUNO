import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Card from './Card.svelte';
import CardHand from './CardHand.svelte';
import type { CardModel } from '../../types/game';

describe('Card and CardHand Components', () => {
  const dummyCard: CardModel = {
    id: 'card-3',
    name: '3 Card',
    category: 'NUMBER',
    description: 'Make up to 3 legal chess moves.',
    effectKey: 'MOVE_3',
    value: 3
  };

  const actionCard: CardModel = {
    id: 'card-reverse',
    name: 'Reverse',
    category: 'ACTION',
    description: 'Swap positions of two eligible friendly non-king pieces.',
    effectKey: 'SWAP_OWN_PIECES',
    value: null
  };

  it('renders card with category, value, name, and description', () => {
    const { getByText, getByTestId } = render(Card, {
      props: { card: dummyCard }
    });

    expect(getByTestId('card-card-3')).toBeTruthy();
    expect(getByText('NUMBER')).toBeTruthy();
    expect(getByText('3 Card')).toBeTruthy();
    expect(getByText('Make up to 3 legal chess moves.')).toBeTruthy();
  });

  it('emits select event when card is clicked', async () => {
    const { component, getByTestId } = render(Card, {
      props: { card: dummyCard }
    });

    let selected: any = null;
    component.$on('select', (e) => {
      selected = e.detail;
    });

    await fireEvent.click(getByTestId('card-card-3'));
    expect(selected).toEqual({ card: dummyCard });
  });

  it('CardHand displays draw deck button in DrawPhase when it is player turn', async () => {
    const { getByTestId, component } = render(CardHand, {
      props: {
        turnPhase: 'DrawPhase',
        isMyTurn: true,
        remainingDeckCount: 108
      }
    });

    expect(getByTestId('draw-card-slot')).toBeTruthy();
    const btn = getByTestId('draw-card-btn');
    expect(btn).toBeTruthy();

    let drawn = false;
    component.$on('drawCard', () => {
      drawn = true;
    });

    await fireEvent.click(btn);
    expect(drawn).toBe(true);
  });

  it('CardHand displays active card during ActionPhase', () => {
    const { getByTestId, queryByTestId } = render(CardHand, {
      props: {
        turnPhase: 'ActionPhase',
        isMyTurn: true,
        activeCard: actionCard,
        remainingMoves: 0,
        canSwap: true
      }
    });

    expect(queryByTestId('draw-card-slot')).toBeNull();
    expect(getByTestId('card-card-reverse')).toBeTruthy();
  });
});

