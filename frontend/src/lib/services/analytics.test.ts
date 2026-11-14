import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initAnalytics,
  isAnalyticsEnabled,
  trackScreen,
  trackPageView,
  trackGameEvent,
  resetAnalyticsForTesting
} from './analytics';

describe('Analytics Service', () => {
  beforeEach(() => {
    resetAnalyticsForTesting();
  });

  it('does not initialize when no measurement ID is provided', () => {
    const initialized = initAnalytics('');
    expect(initialized).toBe(false);
    expect(isAnalyticsEnabled()).toBe(false);
    expect(document.getElementById('ga-gtag-script')).toBeNull();
  });

  it('initializes and injects script when measurement ID is provided', () => {
    const initialized = initAnalytics('G-TEST12345');
    expect(initialized).toBe(true);
    expect(isAnalyticsEnabled()).toBe(true);

    const script = document.getElementById('ga-gtag-script') as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.src).toContain('id=G-TEST12345');
    expect(typeof window.gtag).toBe('function');
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });

  it('prevents injecting duplicate script tags on multiple calls', () => {
    initAnalytics('G-TEST12345');
    initAnalytics('G-TEST12345');

    const scripts = document.querySelectorAll('#ga-gtag-script');
    expect(scripts.length).toBe(1);
  });

  it('tracks screen transitions via gtag', () => {
    initAnalytics('G-TEST12345');
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    trackScreen('GAME');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'screen_view', {
      screen_name: 'GAME',
      page_title: 'Chess UNO - GAME'
    });
  });

  it('tracks page views via gtag', () => {
    initAnalytics('G-TEST12345');
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    trackPageView('/lobby', 'Custom Lobby Title');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/lobby',
      page_title: 'Custom Lobby Title'
    });
  });

  it('tracks custom game events with parameters', () => {
    initAnalytics('G-TEST12345');
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    trackGameEvent('create_game', { assigned_color: 'White', has_seed: false });
    expect(gtagSpy).toHaveBeenCalledWith('event', 'create_game', {
      assigned_color: 'White',
      has_seed: false
    });
  });

  it('does nothing safely when analytics is disabled', () => {
    expect(isAnalyticsEnabled()).toBe(false);
    expect(() => {
      trackScreen('LOBBY');
      trackPageView();
      trackGameEvent('move_proposed', { from: 'e2', to: 'e4' });
    }).not.toThrow();
  });
});
