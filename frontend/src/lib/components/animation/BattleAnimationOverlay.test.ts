import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import BattleAnimationOverlay from './BattleAnimationOverlay.svelte';
import { battleAnimationService } from '../../services/battleAnimationService';

describe('BattleAnimationOverlay Component', () => {
  beforeEach(() => {
    battleAnimationService.reset();
  });

  it('renders nothing when battle animation is inactive', () => {
    const { queryByTestId } = render(BattleAnimationOverlay);
    expect(queryByTestId('battle-animation-overlay')).toBeNull();
  });

  it('renders attacker and defender pawn characters with correct factions when active', async () => {
    const { getByTestId } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'capture-1',
      attacker: { piece: 'Pawn', color: 'White' },
      defender: { piece: 'Pawn', color: 'Black' },
      from: 'd4',
      to: 'e5'
    });
    await tick();

    const overlay = getByTestId('battle-animation-overlay');
    expect(overlay).toBeTruthy();

    const attacker = getByTestId('battle-attacker');
    expect(attacker).toBeTruthy();
    expect(attacker.dataset.team).toBe('light');

    const defender = getByTestId('battle-defender');
    expect(defender).toBeTruthy();
    expect(defender.dataset.team).toBe('dark');
  });

  it('dismisses when clicking the overlay (skip interaction)', async () => {
    const { getByTestId, queryByTestId } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'capture-2',
      attacker: { piece: 'Pawn', color: 'Black' },
      defender: { piece: 'Pawn', color: 'White' },
      from: 'e5',
      to: 'd4'
    });
    await tick();

    const overlay = getByTestId('battle-animation-overlay');
    expect(overlay).toBeTruthy();

    await fireEvent.click(overlay);
    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
  });

  it('provides a skip button for quick dismissal', async () => {
    const { getByRole, queryByTestId } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'capture-3',
      attacker: { piece: 'Pawn', color: 'White' },
      defender: { piece: 'Pawn', color: 'Black' },
      from: 'c4',
      to: 'd5'
    });
    await tick();

    const skipButton = getByRole('button', { name: /skip/i });
    expect(skipButton).toBeTruthy();

    await fireEvent.click(skipButton);
    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
  });
});

