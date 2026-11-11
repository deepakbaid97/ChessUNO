import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import PawnCharacterPlayground from './PawnCharacterPlayground.svelte';

describe('PawnCharacterPlayground', () => {
  it('composes expression, action, team, and size controls in the preview', async () => {
    const { getByRole, getByTestId } = render(PawnCharacterPlayground);

    await fireEvent.click(getByRole('button', { name: 'angry' }));
    await fireEvent.click(getByRole('button', { name: 'attack' }));
    await fireEvent.click(getByRole('button', { name: 'dark' }));
    await tick();

    const pawn = getByTestId('pawn-character');
    expect(pawn.dataset).toMatchObject({ expression: 'angry', animation: 'attack', team: 'dark' });

    const size = getByRole('slider');
    await fireEvent.input(size, { target: { value: '300' } });
    await tick();
    expect(getByTestId('pawn-character').getAttribute('style')).toContain('--pawn-size: 300px');
  });

  it('renders expression and faction inspection lineups allowing quick selection', async () => {
    const { getByRole, getByTestId } = render(PawnCharacterPlayground);

    // Verify small-scale expression cards are rendered for all 4 moods
    for (const exp of ['neutral', 'happy', 'scared', 'angry']) {
      expect(getByTestId(`pawn-gallery-exp-${exp}`)).toBeTruthy();
    }

    // Verify faction cards are rendered for both teams
    expect(getByTestId('pawn-gallery-team-light')).toBeTruthy();
    expect(getByTestId('pawn-gallery-team-dark')).toBeTruthy();

    // Selecting from expression lineup updates the main hero pawn
    await fireEvent.click(getByRole('button', { name: 'Inspect scared expression preview' }));
    await tick();
    expect(getByTestId('pawn-character').dataset.expression).toBe('scared');

    // Selecting from faction lineup updates the main hero pawn
    await fireEvent.click(getByRole('button', { name: 'Inspect dark team variant preview' }));
    await tick();
    expect(getByTestId('pawn-character').dataset.team).toBe('dark');
  });

  it('provides a replay button to re-trigger action animations', async () => {
    const { getByRole, getByTestId } = render(PawnCharacterPlayground);

    await fireEvent.click(getByRole('button', { name: 'attack' }));
    await tick();
    expect(getByTestId('pawn-character').dataset.animation).toBe('attack');

    const replayBtn = getByRole('button', { name: /Replay attack/i });
    expect(replayBtn).toBeTruthy();
    await fireEvent.click(replayBtn);
    await tick();
    expect(getByTestId('pawn-character').dataset.animation).toBe('attack');
  });
});
