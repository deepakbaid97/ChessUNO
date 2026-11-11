import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import PawnCharacter from './PawnCharacter.svelte';
import pawnCharacterSource from './PawnCharacter.svelte?raw';

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

  it('anchors every facial layer within an explicitly positioned face rig', () => {
    const { getByTestId } = render(PawnCharacter, { props: { size: 320 } });

    for (const id of [
      'pawn-face-rig',
      'pawn-face',
      'pawn-eye-left',
      'pawn-eye-right',
      'pawn-brow-left',
      'pawn-brow-right',
      'pawn-mouth',
      'pawn-cheek-left',
      'pawn-cheek-right'
    ]) {
      expect(getByTestId(id), id).toBeTruthy();
    }

    expect(pawnCharacterSource).toMatch(/\.pawn-face-rig\s*\{\s*position:\s*absolute;\s*left:\s*0;\s*top:\s*0;/);
    expect(pawnCharacterSource).toMatch(/\.pawn-face\s*\{\s*position:\s*absolute;[^}]*width:\s*84%;[^}]*left:\s*8%;[^}]*bottom:\s*7%/s);
    expect(pawnCharacterSource).toMatch(/\.pawn-eye\s*\{\s*position:\s*absolute;/);
    expect(pawnCharacterSource).toMatch(/\.pawn-brow\s*\{\s*display:\s*none;\s*position:\s*absolute;/);
    expect(pawnCharacterSource).toMatch(/\.pawn-mouth\s*\{\s*position:\s*absolute;/);
    expect(pawnCharacterSource).toMatch(/\.pawn-cheek\s*\{\s*display:\s*none;\s*position:\s*absolute;/);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('accepts the %s animation', animation => {
    const { getByTestId } = render(PawnCharacter, { props: { animation } });
    expect(getByTestId('pawn-character').dataset.animation).toBe(animation);
  });

  it.each([
    ['happy', 'walk'],
    ['scared', 'attack'],
    ['angry', 'death']
  ] as const)('composes %s expression with the %s action', (expression, animation) => {
    const { container, getByTestId } = render(PawnCharacter, { props: { expression, animation } });
    const pawn = getByTestId('pawn-character');
    expect(pawn.dataset).toMatchObject({ expression, animation });
    expect(container.querySelector('.pawn-action-rig .pawn-expression-rig')).toBeTruthy();
    expect(container.querySelector('.pawn-face-rig .pawn-face')).toBeTruthy();
  });

  it.each([
    ['neutral', 'walk'],
    ['happy', 'attack'],
    ['scared', 'death'],
    ['angry', 'walk']
  ] as const)('keeps the %s face rig present during %s movement', (expression, animation) => {
    const { getByTestId } = render(PawnCharacter, { props: { expression, animation } });
    expect(getByTestId('pawn-face-rig')).toBeTruthy();
    expect(getByTestId('pawn-character').dataset).toMatchObject({ expression, animation });
  });

  it('updates presentation props without any external game state', async () => {
    const { component, getByTestId } = render(PawnCharacter, {
      props: { team: 'light', expression: 'neutral', animation: 'idle' }
    });
    component.$set({ team: 'dark', expression: 'angry', animation: 'attack' });
    await tick();

    const pawn = getByTestId('pawn-character');
    expect(pawn.dataset).toMatchObject({ team: 'dark', expression: 'angry', animation: 'attack' });
  });
});
