import type { CardEffectConfig } from '../types/animation';

export interface ParticleDef {
  id: number;
  color: string;
  size: number;
  angle: number;
  distance: number;
  isStar: boolean;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getCardSymbol(card: any): string {
  if (!card) return '';
  if (card.value !== null && card.value !== undefined) {
    return card.value.toString();
  }
  if (card.id.includes('reverse')) return 'SWAP';
  if (card.id.includes('skip')) return 'SKIP';
  if (card.id.includes('draw-two')) return '+2';
  if (card.id.includes('wild-draw-four')) return 'W+4';
  if (card.id.includes('wild')) return 'WILD';
  return 'ACT';
}

export function getTechCode(card: any): string {
  if (!card) return '';
  if (card.value !== null && card.value !== undefined) {
    return `[MOV: ${card.value}]`;
  }
  if (card.id.includes('reverse')) return '[REVERSE]';
  if (card.id.includes('skip')) return '[INITIATIVE]';
  if (card.id.includes('draw-two')) return '[REVIVE 2]';
  if (card.id.includes('wild-draw-four')) return '[WILD +4]';
  if (card.id.includes('wild')) return '[CHOICE]';
  return `[${card.effectKey || 'TACTICAL'}]`;
}

export function generateParticles(config: CardEffectConfig | null): ParticleDef[] {
  const colors = config?.particleColors || ['#f59e0b', '#fbbf24', '#ffffff', '#60a5fa'];
  const count = 16;
  const items: ParticleDef[] = [];
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * 2 * Math.PI;
    const jitter = (Math.random() - 0.5) * 0.4;
    const angle = baseAngle + jitter;
    const distance = 85 + Math.random() * 85;
    const size = 5 + Math.random() * 6;
    const color = colors[i % colors.length];
    const isStar = i % 3 === 0;
    items.push({ id: i, color, size, angle, distance, isStar });
  }
  return items;
}

