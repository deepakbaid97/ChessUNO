import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KnightCharacter from './KnightCharacter.svelte';

describe('KnightCharacter Component', () => {
  it('renders with default props', () => {
    const { getByTestId } = render(KnightCharacter);
    const root = getByTestId('knight-character');
    expect(root).toBeTruthy();
    expect(root.dataset.team).toBe('light');
    expect(root.dataset.expression).toBe('neutral');
    expect(root.dataset.animation).toBe('idle');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toContain('Chess knight character');

    // Check presence of all core layers
    expect(getByTestId('knight-leg-left')).toBeTruthy();
    expect(getByTestId('knight-leg-right')).toBeTruthy();
    expect(getByTestId('knight-body')).toBeTruthy();
    expect(getByTestId('knight-arm-left')).toBeTruthy();
    expect(getByTestId('knight-arm-right')).toBeTruthy();
    expect(getByTestId('knight-weapon')).toBeTruthy();
    expect(getByTestId('knight-head')).toBeTruthy();
    expect(getByTestId('knight-helmet')).toBeTruthy();
    expect(getByTestId('knight-face-rig')).toBeTruthy();
    expect(getByTestId('knight-face-expression')).toBeTruthy();
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('renders the %s expression', (expression) => {
    const { getByTestId } = render(KnightCharacter, { props: { expression } });
    const root = getByTestId('knight-character');
    expect(root.dataset.expression).toBe(expression);
    expect(root.classList.contains(`expression-${expression}`)).toBe(true);
  });

  it('swaps to distinct illustrated artwork for every expression', () => {
    const faceMarkup = (['neutral', 'happy', 'scared', 'angry'] as const).map(expression => {
      const { container } = render(KnightCharacter, { props: { expression } });
      return container.querySelector('.knight-face-expression')?.innerHTML;
    });
    expect(new Set(faceMarkup).size).toBe(4);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('renders the %s animation', (animation) => {
    const { getByTestId } = render(KnightCharacter, { props: { animation } });
    const root = getByTestId('knight-character');
    expect(root.dataset.animation).toBe(animation);
    expect(root.classList.contains(`animation-${animation}`)).toBe(true);
  });

  it('supports light and dark team factions with appropriate classes and data attributes', () => {
    const { getByTestId: getLight, unmount } = render(KnightCharacter, { props: { team: 'light' } });
    expect(getLight('knight-character').dataset.team).toBe('light');
    expect(getLight('knight-character').classList.contains('team-light')).toBe(true);
    unmount();

    const { getByTestId: getDark } = render(KnightCharacter, { props: { team: 'dark' } });
    expect(getDark('knight-character').dataset.team).toBe('dark');
    expect(getDark('knight-character').classList.contains('team-dark')).toBe(true);
  });

  it('supports custom size and testId props', () => {
    const { getByTestId } = render(KnightCharacter, {
      props: {
        size: 240,
        testId: 'custom-knight'
      }
    });
    const root = getByTestId('custom-knight');
    expect(root).toBeTruthy();
    expect(root.getAttribute('style')).toContain('--knight-size: 240px');
  });

  it('renders an illustrated knight on the 256x256 vector canvas', () => {
    const { getByTestId } = render(KnightCharacter);
    const helmetSvg = getByTestId('knight-helmet').querySelector('svg');
    expect(helmetSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
    const weaponSvg = getByTestId('knight-weapon').querySelector('svg');
    expect(weaponSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
  });

  it('decouples facial expression animation from action animation rig', () => {
    const { getByTestId } = render(KnightCharacter, {
      props: {
        expression: 'angry',
        animation: 'attack'
      }
    });
    const faceRig = getByTestId('knight-face-rig');
    const faceExpr = getByTestId('knight-face-expression');
    expect(faceRig).toBeTruthy();
    expect(faceExpr).toBeTruthy();
    expect(faceRig.contains(faceExpr)).toBe(true);
  });
});
