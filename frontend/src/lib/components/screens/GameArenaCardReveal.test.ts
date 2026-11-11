import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import GameArena from './GameArena.svelte';
import { gameStore } from '../../stores/gameStore';
import { cardRevealStore, cardAnimationService } from '../../services/cardAnimationService';
import type { CardModel } from '../../types/game';

describe('GameArena Card Reveal Integration (Card 0 & Draws)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gameStore.reset();
    cardAnimationService.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reliably pops and shows Card 0 when drawn instead of skipping animation', async () => {
    const zeroCard: CardModel = {
      id: 'card-0',
      name: '0 Card',
      category: 'NUMBER',
      description: 'Pass turn without making any chess moves.',
      effectKey: 'PASS_TURN_EFFECT',
      value: 0
    };

    gameStore.update(s => ({
      ...s,
      boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      assignedColor: 'White',
      activePlayer: 'White',
      turnPhase: 'DrawPhase',
      revision: 1
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // Verify initial idle state
    expect(queryByTestId('card-reveal-overlay')).toBeNull();
    expect(get(cardRevealStore).isActive).toBe(false);

    // Simulate Card 0 drawn event
    gameStore.onCardDrawn({
      player: 'White',
      cardName: '0 Card',
      remainingDeckCount: 107,
      card: zeroCard
    });

    await tick();

    // The reveal animation MUST be active and pop the Card 0
    expect(get(cardRevealStore).isActive).toBe(true);
    expect(get(cardRevealStore).card?.id).toBe('card-0');
    expect(get(cardRevealStore).card?.value).toBe(0);
    expect(get(cardRevealStore).drawerColor).toBe('White');

    // Overlay mounts in DOM
    await vi.advanceTimersByTimeAsync(25);
    expect(queryByTestId('card-reveal-overlay')).toBeTruthy();
  });

  it('reliably pops and shows Draw Two card when drawn', async () => {
    const drawTwoCard: CardModel = {
      id: 'card-draw-two',
      name: 'Draw Two (+2)',
      category: 'ACTION',
      description: 'Revive up to 2 captured friendly pieces.',
      effectKey: 'REVIVE_UP_TO_TWO',
      value: null
    };

    gameStore.update(s => ({
      ...s,
      boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      assignedColor: 'White',
      activePlayer: 'White',
      turnPhase: 'DrawPhase',
      revision: 2
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // Simulate Draw Two card arrival
    gameStore.onCardDrawn({
      player: 'White',
      cardName: 'Draw Two (+2)',
      remainingDeckCount: 106,
      card: drawTwoCard
    });

    await tick();

    expect(get(cardRevealStore).isActive).toBe(true);
    expect(get(cardRevealStore).card?.id).toBe('card-draw-two');
    expect(get(cardRevealStore).card?.name).toBe('Draw Two (+2)');

    await vi.advanceTimersByTimeAsync(25);
    expect(queryByTestId('card-reveal-overlay')).toBeTruthy();
  });

  it('triggers reveal on consecutive card draws across turns without stale deduplication blocking', async () => {
    const cardOne: CardModel = {
      id: 'card-1',
      name: '1 Card',
      category: 'NUMBER',
      description: 'Make 1 chess move.',
      effectKey: 'MOVE_1',
      value: 1
    };

    gameStore.update(s => ({
      ...s,
      boardFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      assignedColor: 'White',
      activePlayer: 'White',
      turnPhase: 'DrawPhase',
      revision: 1
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // Turn 1: White draws card-1
    gameStore.onCardDrawn({
      player: 'White',
      cardName: '1 Card',
      remainingDeckCount: 107,
      card: cardOne
    });
    await tick();

    expect(get(cardRevealStore).isActive).toBe(true);
    expect(get(cardRevealStore).card?.id).toBe('card-1');

    // Turn ends, card dismissed
    cardAnimationService.dismiss();
    expect(get(cardRevealStore).isActive).toBe(false);

    // Turn 2: Black draws the exact same card-1
    gameStore.update(s => ({
      ...s,
      activePlayer: 'Black',
      turnPhase: 'DrawPhase',
      activeCard: null,
      revision: 2
    }));
    await tick();

    gameStore.onCardDrawn({
      player: 'Black',
      cardName: '1 Card',
      remainingDeckCount: 106,
      card: cardOne
    });
    await tick();

    // Must trigger fresh reveal for Black's draw too
    expect(get(cardRevealStore).isActive).toBe(true);
    expect(get(cardRevealStore).drawerColor).toBe('Black');
  });

  it('shows Card 0 reveal animation even when drawn in terminal check state before GameOverModal opens', async () => {
    const zeroCard: CardModel = {
      id: 'card-0',
      name: '0 Card',
      category: 'NUMBER',
      description: 'Pass turn without making any chess moves.',
      effectKey: 'PASS_TURN_EFFECT',
      value: 0
    };

    // White in check, drawing 0 moves triggers defeat
    gameStore.update(s => ({
      ...s,
      boardFen: '4r3/8/8/8/8/8/8/4K3 w - - 0 1',
      assignedColor: 'White',
      activePlayer: 'White',
      turnPhase: 'DrawPhase',
      inCheck: true,
      revision: 1
    }));

    const { queryByTestId } = render(GameArena);
    await tick();

    // Card drawn event arrives
    gameStore.onCardDrawn({
      player: 'White',
      cardName: '0 Card',
      remainingDeckCount: 100,
      card: zeroCard
    });

    // Checkmate state update arrives
    gameStore.applyUpdate({
      boardFen: '4r3/8/8/8/8/8/8/4K3 w - - 0 1',
      gameStatus: 'Checkmate',
      winner: 'Black',
      revision: 2
    });

    await tick();

    // Card reveal MUST be active and showing
    expect(get(cardRevealStore).isActive).toBe(true);
    expect(get(cardRevealStore).card?.id).toBe('card-0');

    // GameOverModal must NOT prematurely occlude the card while active
    expect(queryByTestId('game-over-modal')).toBeNull();

    // After card animation completes/dismisses:
    cardAnimationService.dismiss();
    await tick();

    // Now GameOverModal is visible
    expect(queryByTestId('game-over-modal')).toBeTruthy();
  });
});

