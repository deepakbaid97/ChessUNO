import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import KnightCharacterPlayground from './KnightCharacterPlayground.svelte';

describe('KnightCharacterPlayground', () => {
  it('composes expression, action, team, and size controls in the preview', async () => {
    const { getByRole, getByTestId } = render(KnightCharacterPlayground);

    await fireEvent.click(getByRole('button', { name: 'angry' }));
    await fireEvent.click(getByRole('button', { name: 'attack' }));
    await fireEvent.click(getByRole('button', { name: 'dark' }));
    await tick();

    const knight = getByTestId('knight-character');
    expect(knight.dataset).toMatchObject({ expression: 'angry', animation: 'attack', team: 'dark' });

    const size = getByRole('slider');
    await fireEvent.input(size, { target: { value: '300' } });
    await tick();
    expect(getByTestId('knight-character').getAttribute('style')).toContain('--knight-size: 300px');
  });

  it('renders expression and faction inspection lineups allowing quick selection', async () => {
    const { getByRole, getByTestId } = render(KnightCharacterPlayground);

    // Verify small-scale expression cards are rendered for all 4 moods
    for (const exp of ['neutral', 'happy', 'scared', 'angry']) {
      expect(getByTestId(`knight-gallery-exp-${exp}`)).toBeTruthy();
    }

    // Verify faction cards are rendered for both teams
    expect(getByTestId('knight-gallery-team-light')).toBeTruthy();
    expect(getByTestId('knight-gallery-team-dark')).toBeTruthy();

    // Selecting from expression lineup updates the main hero knight
    await fireEvent.click(getByRole('button', { name: 'Inspect scared expression preview' }));
    await tick();
    expect(getByTestId('knight-character').dataset.expression).toBe('scared');

    // Selecting from faction lineup updates the main hero knight
    await fireEvent.click(getByRole('button', { name: 'Inspect dark team variant preview' }));
    await tick();
    expect(getByTestId('knight-character').dataset.team).toBe('dark');
  });

  it('provides a button to launch sample Knight battle cinematic', async () => {
    const { getByRole, getByTestId } = render(KnightCharacterPlayground);

    const demoButton = getByRole('button', { name: /demo knight duel cinematic/i });
    expect(demoButton).toBeTruthy();

    await fireEvent.click(demoButton);
    await tick();

    expect(getByTestId('battle-animation-overlay')).toBeTruthy();
  });
});

