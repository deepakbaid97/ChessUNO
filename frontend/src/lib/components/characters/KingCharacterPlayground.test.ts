import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import KingCharacterPlayground from './KingCharacterPlayground.svelte';

describe('KingCharacterPlayground', () => {
  it('composes expression, action, team, and size controls in the preview', async () => {
    const { getByRole, getByTestId } = render(KingCharacterPlayground);

    await fireEvent.click(getByRole('button', { name: 'scared' }));
    await fireEvent.click(getByRole('button', { name: 'attack' }));
    await fireEvent.click(getByRole('button', { name: 'dark' }));
    await tick();

    const king = getByTestId('king-character');
    expect(king.dataset).toMatchObject({ expression: 'scared', animation: 'attack', team: 'dark' });

    const size = getByRole('slider');
    await fireEvent.input(size, { target: { value: '300' } });
    await tick();
    expect(getByTestId('king-character').getAttribute('style')).toContain('--king-size: 300px');
  });

  it('renders expression and faction inspection lineups allowing quick selection', async () => {
    const { getByRole, getByTestId } = render(KingCharacterPlayground);

    // Verify small-scale expression cards are rendered for all 4 moods
    for (const exp of ['neutral', 'happy', 'scared', 'angry']) {
      expect(getByTestId(`king-gallery-exp-${exp}`)).toBeTruthy();
    }

    // Verify faction cards are rendered for both teams
    expect(getByTestId('king-gallery-team-light')).toBeTruthy();
    expect(getByTestId('king-gallery-team-dark')).toBeTruthy();

    // Selecting from expression lineup updates the main hero king
    await fireEvent.click(getByRole('button', { name: 'Inspect scared expression preview' }));
    await tick();
    expect(getByTestId('king-character').dataset.expression).toBe('scared');

    // Selecting from faction lineup updates the main hero king
    await fireEvent.click(getByRole('button', { name: 'Inspect dark team variant preview' }));
    await tick();
    expect(getByTestId('king-character').dataset.team).toBe('dark');
  });

  it('provides a button to launch sample King counterattack battle cinematic', async () => {
    const { getByRole, getByTestId } = render(KingCharacterPlayground);

    const demoButton = getByRole('button', { name: /demo king strike cinematic/i });
    expect(demoButton).toBeTruthy();

    await fireEvent.click(demoButton);
    await tick();

    expect(getByTestId('battle-animation-overlay')).toBeTruthy();
  });
});

