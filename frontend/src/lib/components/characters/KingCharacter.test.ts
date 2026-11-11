import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KingCharacter from './KingCharacter.svelte';

describe('KingCharacter Component', () => {
  it('renders with default props', () => {
    const { getByTestId } = render(KingCharacter);
    const root = getByTestId('king-character');
    expect(root).toBeTruthy();
    expect(root.dataset.team).toBe('light');
    expect(root.dataset.expression).toBe('neutral');
    expect(root.dataset.animation).toBe('idle');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toContain('Chess king character');

    // Check presence of all core layers
    expect(getByTestId('king-leg-left')).toBeTruthy();
    expect(getByTestId('king-leg-right')).toBeTruthy();
    expect(getByTestId('king-body')).toBeTruthy();
    expect(getByTestId('king-arm-left')).toBeTruthy();
    expect(getByTestId('king-arm-right')).toBeTruthy();
    expect(getByTestId('king-weapon')).toBeTruthy();
    expect(getByTestId('king-head')).toBeTruthy();
    expect(getByTestId('king-helmet')).toBeTruthy();
    expect(getByTestId('king-face-rig')).toBeTruthy();
    expect(getByTestId('king-face-expression')).toBeTruthy();
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('renders the %s expression', (expression) => {
    const { getByTestId } = render(KingCharacter, { props: { expression } });
    const root = getByTestId('king-character');
    expect(root.dataset.expression).toBe(expression);
    expect(root.classList.contains(`expression-${expression}`)).toBe(true);
  });

  it('swaps to distinct illustrated artwork for every expression', () => {
    const faceMarkup = (['neutral', 'happy', 'scared', 'angry'] as const).map(expression => {
      const { container } = render(KingCharacter, { props: { expression } });
      return container.querySelector('.king-face-expression')?.innerHTML;
    });
    expect(new Set(faceMarkup).size).toBe(4);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('renders the %s animation', (animation) => {
    const { getByTestId } = render(KingCharacter, { props: { animation } });
    const root = getByTestId('king-character');
    expect(root.dataset.animation).toBe(animation);
    expect(root.classList.contains(`animation-${animation}`)).toBe(true);
  });

  it('supports light and dark team factions with appropriate classes and data attributes', () => {
    const { getByTestId: getLight, unmount } = render(KingCharacter, { props: { team: 'light' } });
    expect(getLight('king-character').dataset.team).toBe('light');
    expect(getLight('king-character').classList.contains('team-light')).toBe(true);
    unmount();

    const { getByTestId: getDark } = render(KingCharacter, { props: { team: 'dark' } });
    expect(getDark('king-character').dataset.team).toBe('dark');
    expect(getDark('king-character').classList.contains('team-dark')).toBe(true);
  });

  it('supports custom size and testId props', () => {
    const { getByTestId } = render(KingCharacter, {
      props: {
        size: 240,
        testId: 'custom-king'
      }
    });
    const root = getByTestId('custom-king');
    expect(root).toBeTruthy();
    expect(root.getAttribute('style')).toContain('--king-size: 240px');
  });

  it('renders an illustrated king on the 256x256 vector canvas', () => {
    const { getByTestId } = render(KingCharacter);
    const crownSvg = getByTestId('king-helmet').querySelector('svg');
    expect(crownSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
    const weaponSvg = getByTestId('king-weapon').querySelector('svg');
    expect(weaponSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
  });

  it('decouples facial expression animation from action animation rig', () => {
    const { getByTestId } = render(KingCharacter, {
      props: {
        expression: 'scared',
        animation: 'death'
      }
    });
    const faceRig = getByTestId('king-face-rig');
    const faceExpr = getByTestId('king-face-expression');
    expect(faceRig).toBeTruthy();
    expect(faceExpr).toBeTruthy();
    expect(faceRig.contains(faceExpr)).toBe(true);
  });
});

