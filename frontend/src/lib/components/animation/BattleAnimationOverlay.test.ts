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

  it('progresses to queued event when skipping the active cinematic', async () => {
    const { getByRole, getByTestId, queryByTestId } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'capture-first',
      attacker: { piece: 'Pawn', color: 'White' },
      defender: { piece: 'Pawn', color: 'Black' },
      from: 'c4',
      to: 'd5'
    }, 'first-key');

    // Queue a second event
    battleAnimationService.triggerBattle({
      id: 'capture-second',
      attacker: { piece: 'Pawn', color: 'Black' },
      defender: { piece: 'Pawn', color: 'White' },
      from: 'f5',
      to: 'g4'
    }, 'second-key');

    await tick();
    expect(getByTestId('battle-attacker').dataset.team).toBe('light');

    // Skip the first cinematic
    const skipButton = getByRole('button', { name: /skip/i });
    await fireEvent.click(skipButton);
    await tick();

    // Now the second cinematic should be active (Black attacking White -> team 'dark')
    expect(getByTestId('battle-animation-overlay')).toBeTruthy();
    expect(getByTestId('battle-attacker').dataset.team).toBe('dark');

    // Skip the second cinematic
    const skipButton2 = getByRole('button', { name: /skip/i });
    await fireEvent.click(skipButton2);
    await tick();

    // Both done -> overlay dismissed
    expect(queryByTestId('battle-animation-overlay')).toBeNull();
  });

  it('dismisses on Escape key press', async () => {
    const { queryByTestId } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'capture-esc',
      attacker: { piece: 'Pawn', color: 'White' },
      defender: { piece: 'Pawn', color: 'Black' },
      from: 'e4',
      to: 'd5'
    });
    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeTruthy();

    await fireEvent.keyDown(window, { key: 'Escape' });
    await tick();

    expect(queryByTestId('battle-animation-overlay')).toBeNull();
  });

  it('renders generic combatants: Knight attacking Pawn', async () => {
    const { getByTestId, getByRole } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'knight-attack-pawn',
      attacker: { piece: 'Knight', color: 'White' },
      defender: { piece: 'Pawn', color: 'Black' },
      from: 'b1',
      to: 'c3',
      attackStyle: 'leap'
    });
    await tick();

    const overlay = getByTestId('battle-animation-overlay');
    expect(overlay).toBeTruthy();

    const attacker = getByTestId('battle-attacker');
    expect(attacker).toBeTruthy();
    expect(attacker.getAttribute('aria-label')).toContain('knight');
    expect(attacker.dataset.team).toBe('light');

    const defender = getByTestId('battle-defender');
    expect(defender).toBeTruthy();
    expect(defender.getAttribute('aria-label')).toContain('pawn');
    expect(defender.dataset.team).toBe('dark');

    const heading = getByRole('heading', { level: 2 });
    expect(heading.textContent).toContain('White Knight strikes Black Pawn');
  });

  it('renders Knight defender against Knight attacker with KNIGHT CLASH tag', async () => {
    const { getByTestId, getByText } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'knight-vs-knight',
      attacker: { piece: 'Knight', color: 'Black' },
      defender: { piece: 'Knight', color: 'White' },
      from: 'f6',
      to: 'e4',
      attackStyle: 'leap'
    });
    await tick();

    expect(getByText('KNIGHT CLASH')).toBeTruthy();

    const attacker = getByTestId('battle-attacker');
    expect(attacker.getAttribute('aria-label')).toContain('knight');
    expect(attacker.dataset.team).toBe('dark');

    const defender = getByTestId('battle-defender');
    expect(defender.getAttribute('aria-label')).toContain('knight');
    expect(defender.dataset.team).toBe('light');
  });

  it('renders Pawn attacker against Knight defender', async () => {
    const { getByTestId, getByRole } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'pawn-vs-knight',
      attacker: { piece: 'Pawn', color: 'White' },
      defender: { piece: 'Knight', color: 'Black' },
      from: 'e4',
      to: 'd5',
      attackStyle: 'charge'
    });
    await tick();

    const attacker = getByTestId('battle-attacker');
    expect(attacker.getAttribute('aria-label')).toContain('pawn');
    expect(attacker.dataset.team).toBe('light');

    const defender = getByTestId('battle-defender');
    expect(defender.getAttribute('aria-label')).toContain('knight');
    expect(defender.dataset.team).toBe('dark');

    const heading = getByRole('heading', { level: 2 });
    expect(heading.textContent).toContain('White Pawn strikes Black Knight');
  });

  it('safely skips cinematic and never renders substitute Pawn for unsupported piece types', async () => {
    const { queryByTestId } = render(BattleAnimationOverlay);

    battleAnimationService.triggerBattle({
      id: 'queen-vs-knight',
      attacker: { piece: 'Queen' as any, color: 'White' },
      defender: { piece: 'Knight', color: 'Black' },
      from: 'd1',
      to: 'd5'
    });
    await tick();

    // Must NOT render overlay or substitute pawn
    expect(queryByTestId('battle-animation-overlay')).toBeNull();
    expect(queryByTestId('battle-attacker')).toBeNull();
  });
});

