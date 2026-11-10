import { writable } from 'svelte/store';

export type SignalRConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting';
export type WebRtcConnectionStatus = 'Disconnected' | 'connecting' | 'connected' | 'failed' | 'closed';

export interface ConnectionState {
  signalR: SignalRConnectionStatus;
  webRtc: WebRtcConnectionStatus;
  reconnectAttempts: number;
  lastError: string | null;
}

export function createConnectionStore() {
  const { subscribe, set, update } = writable<ConnectionState>({
    signalR: 'Disconnected',
    webRtc: 'Disconnected',
    reconnectAttempts: 0,
    lastError: null
  });

  return {
    subscribe,
    set,
    update,
    setSignalR: (status: SignalRConnectionStatus) =>
      update(s => ({ ...s, signalR: status })),
    setWebRtc: (status: WebRtcConnectionStatus) =>
      update(s => ({ ...s, webRtc: status })),
    setError: (error: string | null) =>
      update(s => ({ ...s, lastError: error })),
    incrementReconnect: () =>
      update(s => ({ ...s, reconnectAttempts: s.reconnectAttempts + 1 })),
    resetReconnect: () =>
      update(s => ({ ...s, reconnectAttempts: 0, lastError: null }))
  };
}

export const connectionStore = createConnectionStore();

