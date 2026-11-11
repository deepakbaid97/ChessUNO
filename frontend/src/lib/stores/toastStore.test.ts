import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toastStore, showToast } from './toastStore';
import { get } from 'svelte/store';

describe('toastStore', () => {
  beforeEach(() => {
    toastStore.clear();
    vi.useFakeTimers();
  });

  it('adds and removes a toast message correctly', () => {
    const id = showToast('Game saved!', 'success', 2000);
    let items = get(toastStore);
    expect(items.length).toBe(1);
    expect(items[0].text).toBe('Game saved!');
    expect(items[0].type).toBe('success');

    toastStore.remove(id);
    items = get(toastStore);
    expect(items.length).toBe(0);
  });

  it('automatically removes toast after duration', () => {
    showToast('Auto dismiss alert', 'info', 1000);
    expect(get(toastStore).length).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(get(toastStore).length).toBe(0);
  });

  it('clear() removes all active toasts', () => {
    showToast('Toast 1', 'info', 5000);
    showToast('Toast 2', 'error', 5000);
    expect(get(toastStore).length).toBe(2);

    toastStore.clear();
    expect(get(toastStore).length).toBe(0);
  });
});

