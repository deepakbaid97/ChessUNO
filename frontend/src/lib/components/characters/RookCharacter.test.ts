import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RookCharacter from './RookCharacter.svelte';

describe('RookCharacter Component', () => {
  it('renders with default props', () => {
    const { getByTestId } = render(RookCharacter);
    const root = getByTestId('rook-character');
    expect(root).toBeTruthy();
    expect(root.dataset.team).toBe('light');
    expect(root.dataset.expression).toBe('neutral');
    expect(root.dataset.animation).toBe('idle');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toContain('Chess rook character');

    // Check presence of all core layers
    expect(getByTestId('rook-leg-left')).toBeTruthy();
    expect(getByTestId('rook-leg-right')).toBeTruthy();
    expect(getByTestId('rook-body')).toBeTruthy();
    expect(getByTestId('rook-arm-left')).toBeTruthy();
    expect(getByTestId('rook-arm-right')).toBeTruthy();
    expect(getByTestId('rook-weapon')).toBeTruthy();
    expect(getByTestId('rook-head')).toBeTruthy();
    expect(getByTestId('rook-helmet')).toBeTruthy();
    expect(getByTestId('rook-face-rig')).toBeTruthy();
    expect(getByTestId('rook-face-expression')).toBeTruthy();
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('renders the %s expression', (expression) => {
    const { getByTestId } = render(RookCharacter, { props: { expression } });
    const root = getByTestId('rook-character');
    expect(root.dataset.expression).toBe(expression);
    expect(root.classList.contains(`expression-${expression}`)).toBe(true);
  });

  it('swaps to distinct illustrated artwork for every expression', () => {
    const faceMarkup = (['neutral', 'happy', 'scared', 'angry'] as const).map(expression => {
      const { container } = render(RookCharacter, { props: { expression } });
      return container.querySelector('.rook-face-expression')?.innerHTML;
    });
    expect(new Set(faceMarkup).size).toBe(4);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('renders the %s animation', (animation) => {
    const { getByTestId } = render(RookCharacter, { props: { animation } });
    const root = getByTestId('rook-character');
    expect(root.dataset.animation).toBe(animation);
    expect(root.classList.contains(`animation-${animation}`)).toBe(true);
  });

  it('supports light and dark team factions with appropriate classes and data attributes', () => {
    const { getByTestId: getLight, unmount } = render(RookCharacter, { props: { team: 'light' } });
    expect(getLight('rook-character').dataset.team).toBe('light');
    expect(getLight('rook-character').classList.contains('team-light')).toBe(true);
    unmount();

    const { getByTestId: getDark } = render(RookCharacter, { props: { team: 'dark' } });
    expect(getDark('rook-character').dataset.team).toBe('dark');
    expect(getDark('rook-character').classList.contains('team-dark')).toBe(true);
  });

  it('supports custom size and testId props', () => {
    const { getByTestId } = render(RookCharacter, {
      props: {
        size: 240,
        testId: 'custom-rook'
      }
    });
    const root = getByTestId('custom-rook');
    expect(root).toBeTruthy();
    expect(root.getAttribute('style')).toContain('--rook-size: 240px');
  });

  it('renders an illustrated fortress rook on the 256x256 vector canvas', () => {
    const { getByTestId } = render(RookCharacter);
    const helmetSvg = getByTestId('rook-helmet').querySelector('svg');
    expect(helmetSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
    const weaponSvg = getByTestId('rook-weapon').querySelector('svg');
    expect(weaponSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
  });

  it('decouples facial expression animation from action animation rig', () => {
    const { getByTestId } = render(RookCharacter, {
      props: {
        expression: 'angry',
        animation: 'attack'
      }
    });
    const faceRig = getByTestId('rook-face-rig');
    const faceExpr = getByTestId('rook-face-expression');
    expect(faceRig).toBeTruthy();
    expect(faceExpr).toBeTruthy();
    expect(faceRig.contains(faceExpr)).toBe(true);
  });
});

