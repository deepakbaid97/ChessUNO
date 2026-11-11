import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BishopCharacter from './BishopCharacter.svelte';

describe('BishopCharacter Component', () => {
  it('renders with default props', () => {
    const { getByTestId } = render(BishopCharacter);
    const root = getByTestId('bishop-character');
    expect(root).toBeTruthy();
    expect(root.dataset.team).toBe('light');
    expect(root.dataset.expression).toBe('neutral');
    expect(root.dataset.animation).toBe('idle');
    expect(root.getAttribute('role')).toBe('img');
    expect(root.getAttribute('aria-label')).toContain('Chess bishop character');

    // Check presence of all core layers
    expect(getByTestId('bishop-leg-left')).toBeTruthy();
    expect(getByTestId('bishop-leg-right')).toBeTruthy();
    expect(getByTestId('bishop-body')).toBeTruthy();
    expect(getByTestId('bishop-arm-left')).toBeTruthy();
    expect(getByTestId('bishop-arm-right')).toBeTruthy();
    expect(getByTestId('bishop-weapon')).toBeTruthy();
    expect(getByTestId('bishop-head')).toBeTruthy();
    expect(getByTestId('bishop-helmet')).toBeTruthy();
    expect(getByTestId('bishop-face-rig')).toBeTruthy();
    expect(getByTestId('bishop-face-expression')).toBeTruthy();
  });

  it.each(['neutral', 'happy', 'scared', 'angry'] as const)('renders the %s expression', (expression) => {
    const { getByTestId } = render(BishopCharacter, { props: { expression } });
    const root = getByTestId('bishop-character');
    expect(root.dataset.expression).toBe(expression);
    expect(root.classList.contains(`expression-${expression}`)).toBe(true);
  });

  it('swaps to distinct illustrated artwork for every expression', () => {
    const faceMarkup = (['neutral', 'happy', 'scared', 'angry'] as const).map(expression => {
      const { container } = render(BishopCharacter, { props: { expression } });
      return container.querySelector('.bishop-face-expression')?.innerHTML;
    });
    expect(new Set(faceMarkup).size).toBe(4);
  });

  it.each(['idle', 'walk', 'attack', 'death'] as const)('renders the %s animation', (animation) => {
    const { getByTestId } = render(BishopCharacter, { props: { animation } });
    const root = getByTestId('bishop-character');
    expect(root.dataset.animation).toBe(animation);
    expect(root.classList.contains(`animation-${animation}`)).toBe(true);
  });

  it('supports light and dark team factions with appropriate classes and data attributes', () => {
    const { getByTestId: getLight, unmount } = render(BishopCharacter, { props: { team: 'light' } });
    expect(getLight('bishop-character').dataset.team).toBe('light');
    expect(getLight('bishop-character').classList.contains('team-light')).toBe(true);
    unmount();

    const { getByTestId: getDark } = render(BishopCharacter, { props: { team: 'dark' } });
    expect(getDark('bishop-character').dataset.team).toBe('dark');
    expect(getDark('bishop-character').classList.contains('team-dark')).toBe(true);
  });

  it('supports custom size and testId props', () => {
    const { getByTestId } = render(BishopCharacter, {
      props: {
        size: 240,
        testId: 'custom-bishop'
      }
    });
    const root = getByTestId('custom-bishop');
    expect(root).toBeTruthy();
    expect(root.getAttribute('style')).toContain('--bishop-size: 240px');
  });

  it('renders an illustrated bishop on the 256x256 vector canvas', () => {
    const { getByTestId } = render(BishopCharacter);
    const helmetSvg = getByTestId('bishop-helmet').querySelector('svg');
    expect(helmetSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
    const weaponSvg = getByTestId('bishop-weapon').querySelector('svg');
    expect(weaponSvg?.getAttribute('viewBox')).toBe('0 0 256 256');
  });

  it('decouples facial expression animation from action animation rig', () => {
    const { getByTestId } = render(BishopCharacter, {
      props: {
        expression: 'angry',
        animation: 'attack'
      }
    });
    const faceRig = getByTestId('bishop-face-rig');
    const faceExpr = getByTestId('bishop-face-expression');
    expect(faceRig).toBeTruthy();
    expect(faceExpr).toBeTruthy();
    expect(faceRig.contains(faceExpr)).toBe(true);
  });
});

