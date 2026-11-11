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
    expect(container.querySelectorAll('.pawn-layer svg')).toHaveLength(9);
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('accepts the %s expression', expression => {
    const { getByTestId } = render(PawnCharacter, { props: { expression } });
    expect(getByTestId('pawn-character').dataset.expression).toBe(expression);
  });

  it('swaps to distinct illustrated artwork for every expression', () => {
    const faceMarkup = (['neutral', 'happy', 'scared', 'angry'] as const).map(expression => {
      const { container } = render(PawnCharacter, { props: { expression } });
      return container.querySelector('.pawn-face-rig')?.innerHTML;
    });
    expect(new Set(faceMarkup).size).toBe(4);
  });

  it('renders an illustrated face layer on the shared character canvas', () => {
    const { getByTestId } = render(PawnCharacter, { props: { size: 320 } });
    const faceSvg = getByTestId('pawn-face-rig').querySelector('svg');
    expect(faceSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
    expect(getByTestId('pawn-head').querySelector('svg')).toBeTruthy();
    expect(getByTestId('pawn-helmet').querySelector('svg')).toBeTruthy();
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
    expect(container.querySelector('.pawn-face-rig svg')).toBeTruthy();
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

  it('isolates idle blink animation from expression animations using a nested wrapper', () => {
    const { getByTestId, container } = render(PawnCharacter, {
      props: { expression: 'happy', animation: 'idle' }
    });

    // Face rig holds the blink animation track
    const faceRig = getByTestId('pawn-face-rig');
    expect(faceRig).toBeTruthy();

    // Nested wrapper holds the expression animation track
    const faceExpression = getByTestId('pawn-face-expression');
    expect(faceExpression).toBeTruthy();
    expect(faceRig.contains(faceExpression)).toBe(true);
    expect(faceExpression.querySelector('svg')).toBeTruthy();

    // Verify CSS styles target separate elements so one does not override the other
    expect(pawnCharacterSource).toMatch(/\.animation-idle\s+\.pawn-face-rig\s*\{[^}]*animation:\s*pawn-blink/);
    expect(pawnCharacterSource).toMatch(/\.expression-happy\s+\.pawn-face-expression\s*\{[^}]*animation:\s*pawn-face-delight/);
    expect(pawnCharacterSource).toMatch(/\.expression-scared\s+\.pawn-face-expression\s*\{[^}]*animation:\s*pawn-tremble/);
    expect(pawnCharacterSource).toMatch(/\.expression-angry\s+\.pawn-face-expression\s*\{[^}]*animation:\s*pawn-angry/);

    // Ensure expression animations no longer target .pawn-face-rig directly
    expect(pawnCharacterSource).not.toMatch(/\.expression-(?:happy|scared|angry)\s+\.pawn-face-rig\s*\{/);
  });

  it('respects prefers-reduced-motion for all animation layers', () => {
    expect(pawnCharacterSource).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[^}]*\.pawn-character\s*\*[^}]*animation:\s*none\s*!important/);
  });
});
