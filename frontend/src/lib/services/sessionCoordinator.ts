import { get } from 'svelte/store';
import { gameStore } from '../stores/gameStore';
import { connectionStore } from '../stores/connectionStore';
import { voiceStore } from '../stores/voiceStore';
import { showToast } from '../stores/toastStore';
import { trackGameEvent } from './analytics';
import type { SignalRService } from './signalrService';
import type { WebRtcService } from './webrtcService';

export interface SessionCoordinatorOptions {
  signalRService: SignalRService;
  getWebRtcService: () => WebRtcService | null | undefined;
  onNavigateToGame: () => void;
  onClearSubmitting: () => void;
}

export function setupSignalRListeners(options: SessionCoordinatorOptions): void {
  const { signalRService, getWebRtcService, onNavigateToGame, onClearSubmitting } = options;

  function syncWebRtc(forceRestart: boolean = false) {
    const session = get(gameStore);
    const isWhite = session.assignedColor === 'White';
    const isBlack = session.assignedColor === 'Black';
    const opponentPresent = !!session.opponentName || session.gameStatus !== 'WaitingForPlayer';

    const webrtc = getWebRtcService();
    if ((isWhite || isBlack) && opponentPresent) {
      if (forceRestart) {
        webrtc?.restartConnection(isWhite);
      } else {
        webrtc?.ensurePeerConnection(isWhite);
      }
    }
  }

  signalRService.onGameStateSnapshot((snapshot) => {
    gameStore.applySnapshot(snapshot);
    connectionStore.setSignalR('Connected');
    syncWebRtc();
  });

  signalRService.onPlayerDisconnected((data) => {
    console.log('[SignalR Event] onPlayerDisconnected received:', data);
    showToast(`${data.playerName} (${data.color}) disconnected. Waiting for reconnection...`, 'error');
    connectionStore.setWebRtc('Disconnected');
    voiceStore.setOpponentSpeaking(false);
    voiceStore.setOpponentVoiceActive(false);
    getWebRtcService()?.handleVoiceStatus('Opponent', { speaking: false, voiceActive: false });
  });

  signalRService.onActionRejected(async (data) => {
    console.warn('[SignalR Event] onActionRejected received:', data);
    onClearSubmitting();
    gameStore.clearSelection();

    const session = get(gameStore);
    if (data.reason === 'REVISION_MISMATCH') {
      showToast('Game state out of sync. Refreshing board...', 'error');
      if (session.gameId && session.playerToken) {
        await signalRService.joinGameRoom(session.gameId, session.playerToken);
      }
    } else if (data.reason === 'NOT_YOUR_TURN') {
      showToast('It is not your turn!', 'error');
    } else if (data.reason === 'ILLEGAL_MOVE') {
      showToast('Illegal chess move rejected by authoritative referee.', 'error');
    } else if (data.reason === 'SESSION_TERMINAL') {
      showToast('Match has concluded.', 'info');
    } else {
      showToast(`Action rejected: ${data.reason}`, 'error');
    }
  });

  signalRService.onGameStateUpdated((update) => {
    gameStore.applyUpdate(update);
    onNavigateToGame();
  });

  signalRService.onMoveAccepted((data) => {
    gameStore.onMoveAccepted(data);
    onClearSubmitting();
  });

  signalRService.onCardDrawn((data) => {
    gameStore.onCardDrawn(data);
    trackGameEvent('card_drawn', { player: data.player, card_name: data.cardName });
    showToast(`${data.player} drew ${data.cardName}`, 'info');
  });

  signalRService.onPlayerConnected((data) => {
    console.log('[SignalR Event] onPlayerConnected received:', data);
    gameStore.onPlayerConnected(data);
    trackGameEvent('player_connected', { player_name: data.playerName, color: data.color });
    showToast(`${data.playerName} joined as ${data.color}!`, 'success');

    onNavigateToGame();
    const isWhite = get(gameStore).assignedColor === 'White';
    syncWebRtc(isWhite);
  });

  signalRService.onPieceRevived((data) => {
    gameStore.log(`${data.player} revived ${data.piece} to ${data.targetSquare}`);
    showToast(`${data.player} revived ${data.piece} to ${data.targetSquare}`, 'info');
  });

  signalRService.onPiecesSwapped((data) => {
    gameStore.log(`${data.player} swapped pieces on ${data.square1} and ${data.square2}`);
    showToast(`${data.player} swapped ${data.square1} and ${data.square2}`, 'info');
  });

  signalRService.onEffectChosen((data) => {
    gameStore.onEffectChosen(data);
    showToast(`${data.player} chose ability: ${data.choice}`, 'info');
  });

  signalRService.onReceiveSignal(async (signalType, payload) => {
    const webrtc = getWebRtcService();
    if (signalType === 'voice-status') {
      try {
        const parsed = JSON.parse(payload);
        if (parsed && parsed.payload) {
          webrtc?.handleVoiceStatus(parsed.sender, parsed.payload, parsed.epoch);
        }
      } catch {}
      return;
    }
    await webrtc?.handleSignal(signalType, payload);
  });

  signalRService.onReconnecting(() => {
    connectionStore.setSignalR('Reconnecting');
    connectionStore.incrementReconnect();
    showToast('Connection interrupted. Reconnecting to game...', 'error');
  });

  signalRService.onReconnected(() => {
    connectionStore.setSignalR('Connected');
    connectionStore.resetReconnect();
    showToast('Reconnected to game session.', 'success');
    const session = get(gameStore);
    if (session.gameId && session.playerToken) {
      signalRService.joinGameRoom(session.gameId, session.playerToken);
    }
  });

  signalRService.onClose(() => {
    connectionStore.setSignalR('Disconnected');
  });
}

