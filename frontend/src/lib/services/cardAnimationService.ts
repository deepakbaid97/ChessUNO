import { writable } from 'svelte/store';
import type { CardModel, PlayerColor } from '../types/game';
import type {
  CardRevealState,
  CardEffectConfig,
  RevealRequestOptions,
  RevealPhase
} from '../types/animation';

export function getCardEffectConfig(card: CardModel): CardEffectConfig {
  const category = (card.category || '').toUpperCase();
  const id = (card.id || '').toLowerCase();
  const effectKey = (card.effectKey || '').toUpperCase();

  if (category === 'WILD' || id.includes('wild')) {
    return {
      accentColor: '#c084fc',
      glowColor: 'rgba(192, 132, 252, 0.65)',
      particleColors: ['#c084fc', '#f59e0b', '#e879f9', '#ffffff', '#fbbf24'],
      shockwaveColor: '#a855f7',
      flashColor: 'rgba(168, 85, 247, 0.55)',
      burstType: 'wild'
    };
  }

  if (id.includes('reverse') || effectKey.includes('SWAP')) {
    return {
      accentColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.7)',
      particleColors: ['#f59e0b', '#fbbf24', '#fef3c7', '#d97706', '#ffffff'],
      shockwaveColor: '#f59e0b',
      flashColor: 'rgba(245, 158, 11, 0.5)',
      burstType: 'reverse'
    };
  }

  if (id.includes('draw-two') || effectKey.includes('REVIVE')) {
    return {
      accentColor: '#4edea3',
      glowColor: 'rgba(78, 222, 163, 0.7)',
      particleColors: ['#4edea3', '#10b981', '#6ee7b7', '#ecfdf5', '#ffffff'],
      shockwaveColor: '#10b981',
      flashColor: 'rgba(78, 222, 163, 0.5)',
      burstType: 'revival'
    };
  }

  if (id.includes('skip') || effectKey.includes('SKIP')) {
    return {
      accentColor: '#ef4444',
      glowColor: 'rgba(239, 68, 68, 0.7)',
      particleColors: ['#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#ffffff'],
      shockwaveColor: '#ef4444',
      flashColor: 'rgba(239, 68, 68, 0.55)',
      burstType: 'skip'
    };
  }

  // Card 0 / Pass Turn Theme
  if (id === 'card-0' || card.value === 0 || effectKey.includes('PASS')) {
    return {
      accentColor: '#94a3b8',
      glowColor: 'rgba(148, 163, 184, 0.7)',
      particleColors: ['#94a3b8', '#cbd5e1', '#64748b', '#ffffff', '#e2e8f0'],
      shockwaveColor: '#64748b',
      flashColor: 'rgba(148, 163, 184, 0.55)',
      burstType: 'number'
    };
  }

  // Number Card Theme (Tactical electric cyan & warm amber)
  return {
    accentColor: '#60a5fa',
    glowColor: 'rgba(96, 165, 250, 0.7)',
    particleColors: ['#60a5fa', '#93c5fd', '#f59e0b', '#fbbf24', '#ffffff'],
    shockwaveColor: '#3b82f6',
    flashColor: 'rgba(96, 165, 250, 0.55)',
    burstType: 'number'
  };
}

const initialState: CardRevealState = {
  isActive: false,
  phase: 'idle',
  card: null,
  drawerColor: 'White',
  isLocalPlayer: true,
  sourceRect: null,
  targetRect: null,
  effectConfig: null,
  revealId: '',
  sequenceId: 0
};

export class CardAnimationService {
  private state = writable<CardRevealState>(initialState);
  private lastRevealedId: string | null = null;
  private failsafeTimer: ReturnType<typeof setTimeout> | null = null;
  private drawCounter = 0;
  private sequenceCounter = 0;

  public subscribe = this.state.subscribe;

  public triggerCardReveal(card: CardModel, options?: RevealRequestOptions): boolean {
    if (!card || !card.id) return false;

    const drawerColor = options?.drawerColor || 'White';
    const isLocalPlayer = options?.isLocalPlayer ?? true;
    const revealId = options?.drawKey ||
      (options?.revision !== undefined
        ? `rev-${options.revision}-${card.id}-${drawerColor}`
        : `${card.id}-${card.value}-${drawerColor}`);

    // Deduplication check: prevent multiple triggers from stale/redundant events
    if (!options?.force && this.lastRevealedId === revealId) {
      return false;
    }

    this.lastRevealedId = revealId;
    const sequenceId = ++this.sequenceCounter;

    if (this.failsafeTimer) {
      clearTimeout(this.failsafeTimer);
    }

    const effectConfig = getCardEffectConfig(card);

    this.state.set({
      isActive: true,
      phase: 'anticipation',
      card,
      drawerColor,
      isLocalPlayer,
      sourceRect: options?.sourceRect || null,
      targetRect: options?.targetRect || null,
      effectConfig,
      revealId,
      sequenceId
    });

    // Failsafe timeout: ensure overlay never stays stuck if tab inactive or sequence drops
    this.failsafeTimer = setTimeout(() => {
      this.dismiss();
    }, 3200);

    return true;
  }

  public setPhase(phase: RevealPhase) {
    this.state.update(s => ({ ...s, phase }));
    if (phase === 'complete') {
      this.dismiss();
    }
  }

  public dismiss() {
    if (this.failsafeTimer) {
      clearTimeout(this.failsafeTimer);
      this.failsafeTimer = null;
    }
    this.state.set({
      ...initialState,
      sequenceId: this.sequenceCounter
    });
  }

  public resetLastRevealed() {
    this.lastRevealedId = null;
  }

  public reset() {
    this.lastRevealedId = null;
    this.dismiss();
  }

  public getLastRevealedId(): string | null {
    return this.lastRevealedId;
  }
}

export const cardAnimationService = new CardAnimationService();
export const cardRevealStore = cardAnimationService;

