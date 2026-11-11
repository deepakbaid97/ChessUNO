import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import QueenCharacterPlayground from './QueenCharacterPlayground.svelte';

describe('QueenCharacterPlayground', () => {
  it('composes expression, action, team, and size controls in the preview', async () => {
    const { getByRole, getByTestId } = render(QueenCharacterPlayground);

    await fireEvent.click(getByRole('button', { name: 'angry' }));
    await fireEvent.click(getByRole('button', { name: 'attack' }));
    await fireEvent.click(getByRole('button', { name: 'dark' }));
    await tick();

    const queen = getByTestId('queen-character');
    expect(queen.dataset).toMatchObject({ expression: 'angry', animation: 'attack', team: 'dark' });

    const size = getByRole('slider');
    await fireEvent.input(size, { target: { value: '300' } });
    await tick();
    expect(getByTestId('queen-character').getAttribute('style')).toContain('--queen-size: 300px');
  });

  it('renders expression and faction inspection lineups allowing quick selection', async () => {
    const { getByRole, getByTestId } = render(QueenCharacterPlayground);

    // Verify small-scale expression cards are rendered for all 4 moods
    for (const exp of ['neutral', 'happy', 'scared', 'angry']) {
      expect(getByTestId(`queen-gallery-exp-${exp}`)).toBeTruthy();
    }

    // Verify faction cards are rendered for both teams
    expect(getByTestId('queen-gallery-team-light')).toBeTruthy();
    expect(getByTestId('queen-gallery-team-dark')).toBeTruthy();

    // Selecting from expression lineup updates the main hero queen
    await fireEvent.click(getByRole('button', { name: 'Inspect scared expression preview' }));
    await tick();
    expect(getByTestId('queen-character').dataset.expression).toBe('scared');

    // Selecting from faction lineup updates the main hero queen
    await fireEvent.click(getByRole('button', { name: 'Inspect dark team variant preview' }));
    await tick();
    expect(getByTestId('queen-character').dataset.team).toBe('dark');
  });

  it('provides a button to launch sample Queen energy slash battle cinematic', async () => {
    const { getByRole, getByTestId } = render(QueenCharacterPlayground);

    const demoButton = getByRole('button', { name: /demo queen slash cinematic/i });
    expect(demoButton).toBeTruthy();

    await fireEvent.click(demoButton);
    await tick();

    expect(getByTestId('battle-animation-overlay')).toBeTruthy();
  });
});

