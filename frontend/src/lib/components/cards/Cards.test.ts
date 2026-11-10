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

  it('CardHand displays choice buttons and emits submitChoice when AwaitingChoice', async () => {
    const { getByTestId, component } = render(CardHand, {
      props: {
        turnPhase: 'AwaitingChoice',
        isMyTurn: true,
        activeCard: {
          id: 'card-wild',
          name: 'Wild',
          category: 'WILD',
          description: 'Choose ability.',
          effectKey: 'WILD_CHOICE'
        },
        availableChoices: ['MOVE_1', 'REVIVE_UP_TO_TWO', 'SWAP_OWN_PIECES']
      }
    });

    expect(getByTestId('choices-container')).toBeTruthy();
    const moveBtn = getByTestId('btn-choice-move_1');
    expect(moveBtn).toBeTruthy();

    let chosen: any = null;
    component.$on('submitChoice', (e) => {
      chosen = e.detail;
    });

    await fireEvent.click(moveBtn);
    expect(chosen).toEqual({ choice: 'MOVE_1' });
  });

  it('CardHand displays quick swap action button and emits activateSwap when canSwap is true in ActionPhase', async () => {
    const { getByTestId, component } = render(CardHand, {
      props: {
        turnPhase: 'ActionPhase',
        isMyTurn: true,
        activeCard: actionCard,
        canSwap: true,
        remainingMoves: 0
      }
    });

    const swapBtn = getByTestId('btn-activate-swap');
    expect(swapBtn).toBeTruthy();

    let swapTriggered = false;
    component.$on('activateSwap', () => {
      swapTriggered = true;
    });

    await fireEvent.click(swapBtn);
    expect(swapTriggered).toBe(true);
  });

  it('CardHand displays quick revival action button and emits activateRevival when remainingRevivals > 0 in ActionPhase', async () => {
    const { getByTestId, component } = render(CardHand, {
      props: {
        turnPhase: 'ActionPhase',
        isMyTurn: true,
        activeCard: {
          id: 'card-draw-two',
          name: 'Draw Two (+2)',
          category: 'ACTION',
          description: 'Revives up to 2 captured friendly pieces.',
          effectKey: 'REVIVE_UP_TO_TWO'
        },
        remainingRevivals: 2,
        remainingMoves: 0
      }
    });

    const revivalBtn = getByTestId('btn-activate-revival');
    expect(revivalBtn).toBeTruthy();

    let revivalTriggered = false;
    component.$on('activateRevival', () => {
      revivalTriggered = true;
    });

    await fireEvent.click(revivalBtn);
    expect(revivalTriggered).toBe(true);
  });
});

