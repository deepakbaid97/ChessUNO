import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import BishopCharacterPlayground from './BishopCharacterPlayground.svelte';

describe('BishopCharacterPlayground', () => {
  it('composes expression, action, team, and size controls in the preview', async () => {
    const { getByRole, getByTestId } = render(BishopCharacterPlayground);

    await fireEvent.click(getByRole('button', { name: 'angry' }));
    await fireEvent.click(getByRole('button', { name: 'attack' }));
    await fireEvent.click(getByRole('button', { name: 'dark' }));
    await tick();

    const bishop = getByTestId('bishop-character');
    expect(bishop.dataset).toMatchObject({ expression: 'angry', animation: 'attack', team: 'dark' });

    const size = getByRole('slider');
    await fireEvent.input(size, { target: { value: '300' } });
    await tick();
    expect(getByTestId('bishop-character').getAttribute('style')).toContain('--bishop-size: 300px');
  });

  it('renders expression and faction inspection lineups allowing quick selection', async () => {
    const { getByRole, getByTestId } = render(BishopCharacterPlayground);

    // Verify small-scale expression cards are rendered for all 4 moods
    for (const exp of ['neutral', 'happy', 'scared', 'angry']) {
      expect(getByTestId(`bishop-gallery-exp-${exp}`)).toBeTruthy();
    }

    // Verify faction cards are rendered for both teams
    expect(getByTestId('bishop-gallery-team-light')).toBeTruthy();
    expect(getByTestId('bishop-gallery-team-dark')).toBeTruthy();

    // Selecting from expression lineup updates the main hero bishop
    await fireEvent.click(getByRole('button', { name: 'Inspect scared expression preview' }));
    await tick();
    expect(getByTestId('bishop-character').dataset.expression).toBe('scared');

    // Selecting from faction lineup updates the main hero bishop
    await fireEvent.click(getByRole('button', { name: 'Inspect dark team variant preview' }));
    await tick();
    expect(getByTestId('bishop-character').dataset.team).toBe('dark');
  });

  it('provides a button to launch sample Bishop spell battle cinematic', async () => {
    const { getByRole, getByTestId } = render(BishopCharacterPlayground);

    const demoButton = getByRole('button', { name: /demo bishop spell cinematic/i });
    expect(demoButton).toBeTruthy();

    await fireEvent.click(demoButton);
    await tick();

    expect(getByTestId('battle-animation-overlay')).toBeTruthy();
  });
});
