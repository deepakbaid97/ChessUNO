import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import QueenCharacter from './QueenCharacter.svelte';

describe('QueenCharacter Component', () => {
  it('renders with default props', () => {
    const { getByTestId } = render(QueenCharacter);
    const root = getByTestId('queen-character');
    expect(root).toBeTruthy();
    expect(root.dataset.team).toBe('light');
    expect(root.dataset.expression).toBe('neutral');
    expect(root.dataset.animation).toBe('idle');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toContain('Chess queen character');

    // Check presence of all core layers
    expect(getByTestId('queen-leg-left')).toBeTruthy();
    expect(getByTestId('queen-leg-right')).toBeTruthy();
    expect(getByTestId('queen-body')).toBeTruthy();
    expect(getByTestId('queen-arm-left')).toBeTruthy();
    expect(getByTestId('queen-arm-right')).toBeTruthy();
    expect(getByTestId('queen-weapon')).toBeTruthy();
    expect(getByTestId('queen-head')).toBeTruthy();
    expect(getByTestId('queen-helmet')).toBeTruthy();
    expect(getByTestId('queen-face-rig')).toBeTruthy();
    expect(getByTestId('queen-face-expression')).toBeTruthy();
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('renders the %s expression', (expression) => {
    const { getByTestId } = render(QueenCharacter, { props: { expression } });
    const root = getByTestId('queen-character');
    expect(root.dataset.expression).toBe(expression);
    expect(root.classList.contains(`expression-${expression}`)).toBe(true);
  });

  it('swaps to distinct illustrated artwork for every expression', () => {
    const faceMarkup = (['neutral', 'happy', 'scared', 'angry'] as const).map(expression => {
      const { container } = render(QueenCharacter, { props: { expression } });
      return container.querySelector('.queen-face-expression')?.innerHTML;
    });
    expect(new Set(faceMarkup).size).toBe(4);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('renders the %s animation', (animation) => {
    const { getByTestId } = render(QueenCharacter, { props: { animation } });
    const root = getByTestId('queen-character');
    expect(root.dataset.animation).toBe(animation);
    expect(root.classList.contains(`animation-${animation}`)).toBe(true);
  });

  it('supports light and dark team factions with appropriate classes and data attributes', () => {
    const { getByTestId: getLight, unmount } = render(QueenCharacter, { props: { team: 'light' } });
    expect(getLight('queen-character').dataset.team).toBe('light');
    expect(getLight('queen-character').classList.contains('team-light')).toBe(true);
    unmount();

    const { getByTestId: getDark } = render(QueenCharacter, { props: { team: 'dark' } });
    expect(getDark('queen-character').dataset.team).toBe('dark');
    expect(getDark('queen-character').classList.contains('team-dark')).toBe(true);
  });

  it('supports custom size and testId props', () => {
    const { getByTestId } = render(QueenCharacter, {
      props: {
        size: 240,
        testId: 'custom-queen'
      }
    });
    const root = getByTestId('custom-queen');
    expect(root).toBeTruthy();
    expect(root.getAttribute('style')).toContain('--queen-size: 240px');
  });

  it('renders an illustrated queen on the 256x256 vector canvas', () => {
    const { getByTestId } = render(QueenCharacter);
    const crownSvg = getByTestId('queen-helmet').querySelector('svg');
    expect(crownSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
    const weaponSvg = getByTestId('queen-weapon').querySelector('svg');
    expect(weaponSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
  });

  it('decouples facial expression animation from action animation rig', () => {
    const { getByTestId } = render(QueenCharacter, {
      props: {
        expression: 'angry',
        animation: 'attack'
      }
    });
    const faceRig = getByTestId('queen-face-rig');
    const faceExpr = getByTestId('queen-face-expression');
    expect(faceRig).toBeTruthy();
    expect(faceExpr).toBeTruthy();
    expect(faceRig.contains(faceExpr)).toBe(true);
  });
});

