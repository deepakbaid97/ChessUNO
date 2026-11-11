import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import PawnCharacter from './PawnCharacter.svelte';

describe('PawnCharacter', () => {
  it('renders the requested team and its independent character layers', () => {
    const { getByTestId, container } = render(PawnCharacter, { props: { team: 'dark', size: 220 } });
    const pawn = getByTestId('pawn-character');
    expect(pawn.dataset.team).toBe('dark');
    expect(pawn.getAttribute('style')).toContain('--pawn-size: 220px');
    expect(container.querySelector('.pawn-head')).toBeTruthy();
    expect(container.querySelector('.pawn-body')).toBeTruthy();
    expect(container.querySelectorAll('.pawn-arm, .pawn-leg')).toHaveLength(4);
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('accepts the %s expression', expression => {
    const { getByTestId } = render(PawnCharacter, { props: { expression } });
    expect(getByTestId('pawn-character').dataset.expression).toBe(expression);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('accepts the %s animation', animation => {
    const { getByTestId } = render(PawnCharacter, { props: { animation } });
    expect(getByTestId('pawn-character').dataset.animation).toBe(animation);
  });

  it('updates presentation props without any external game state', async () => {
    const { component, getByTestId } = render(PawnCharacter, {
      props: { team: 'light', expression: 'neutral', animation: 'idle' }
    });
    component.$set({ team: 'dark', expression: 'angry', animation: 'attack' });
    await Promise.resolve();

    const pawn = getByTestId('pawn-character');
    expect(pawn.dataset).toMatchObject({ team: 'dark', expression: 'angry', animation: 'attack' });
  });
});
