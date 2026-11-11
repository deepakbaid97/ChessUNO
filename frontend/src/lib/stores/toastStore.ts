import { writable } from 'svelte/store';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'error' | 'success';
}

function createToastStore() {
  const { subscribe, update, set } = writable<ToastMessage[]>([]);
  let toastCounter = 0;

  function show(text: string, type: 'info' | 'error' | 'success' = 'info', durationMs: number = 4000) {
    const id = ++toastCounter;
    const item: ToastMessage = { id, text, type };
    update((items) => [...items, item]);

    if (durationMs > 0 && typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        remove(id);
      }, durationMs);
    }
    return id;
  }

  function remove(id: number) {
    update((items) => items.filter((t) => t.id !== id));
  }

  function clear() {
    set([]);
  }

  return {
    subscribe,
    show,
    remove,
    clear
  };
}

export const toastStore = createToastStore();
export const showToast = toastStore.show;

