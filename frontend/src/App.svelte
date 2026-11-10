<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { GameApiService } from './lib/services/gameApiService';
  import { SignalRService } from './lib/services/signalrService';
  import { WebRtcService } from './lib/services/webrtcService';
  import { gameStore } from './lib/stores/gameStore';
  import { connectionStore } from './lib/stores/connectionStore';
  import type { PlayerColor, PieceType } from './lib/types/game';

  import HomeScreen from './lib/components/screens/HomeScreen.svelte';
  import WaitingRoom from './lib/components/screens/WaitingRoom.svelte';
  import JoinGameScreen from './lib/components/screens/JoinGameScreen.svelte';
  import GameArena from './lib/components/screens/GameArena.svelte';

  const apiService = new GameApiService();
  const signalRService = new SignalRService();
  let webrtcService: WebRtcService;

  type AppView = 'LOBBY' | 'WAITING' | 'JOIN' | 'GAME';
  let currentView: AppView = 'LOBBY';

  let directJoinToken = '';
  let isCreating = false;
  let isSubmitting = false;
  let errorMessage = '';

  // Toasts
  interface ToastMessage {
    id: number;
    text: string;
    type: 'info' | 'error' | 'success';
  }
  let toasts: ToastMessage[] = [];
  let toastCounter = 0;

  function showToast(text: string, type: 'info' | 'error' | 'success' = 'info') {
    const id = ++toastCounter;
    toasts = [...toasts, { id, text, type }];
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
    }, 4000);
  }

  $: storeState = $gameStore;
  $: connState = $connectionStore;

  onMount(() => {
    // Setup WebRTC Service
    webrtcService = new WebRtcService(
      (signalType, payload) => {
        if (storeState.gameId && storeState.playerToken) {
          signalRService.sendSignal(storeState.gameId, storeState.playerToken, signalType, payload);
        }
      },
      (p2pData) => {
        gameStore.log(`[P2P] Received: ${p2pData}`);
      },
      (iceState) => {
        connectionStore.setWebRtc(iceState);
        gameStore.log(`[WebRTC] ICE state changed to: ${iceState}`);
      }
    );

    // Setup SignalR Callbacks
    signalRService.onGameStateSnapshot((snapshot) => {
      gameStore.applySnapshot(snapshot);
      connectionStore.setSignalR('Connected');
    });

    signalRService.onGameStateUpdated((update) => {
      gameStore.applyUpdate(update);
    });

    signalRService.onMoveAccepted((data) => {
      gameStore.onMoveAccepted(data);
      isSubmitting = false;
    });

    signalRService.onCardDrawn((data) => {
      gameStore.onCardDrawn(data);
      showToast(`${data.player} drew ${data.cardName}`, 'info');
    });

    signalRService.onPlayerConnected((data) => {
      gameStore.onPlayerConnected(data);
      showToast(`${data.playerName} joined as ${data.color}!`, 'success');

      if (currentView === 'WAITING') {
        currentView = 'GAME';
        // Initiate WebRTC from White host
        if (storeState.assignedColor === 'White') {
          webrtcService.initializePeerConnection();
          webrtcService.createOffer();
        } else {
          webrtcService.initializePeerConnection();
        }
      }
    });

    signalRService.onPieceRevived((data) => {
      gameStore.log(`${data.player} revived ${data.piece} to ${data.targetSquare}`);
      showToast(`${data.player} revived ${data.piece} to ${data.targetSquare}`, 'info');
    });

    signalRService.onPiecesSwapped((data) => {
      gameStore.log(`${data.player} swapped pieces on ${data.square1} and ${data.square2}`);
      showToast(`${data.player} swapped ${data.square1} and ${data.square2}`, 'info');
    });

    signalRService.onReceiveSignal(async (signalType, payload) => {
      await webrtcService.handleSignal(signalType, payload);
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
      // Re-fetch authoritative legal moves/snapshot
      if (storeState.gameId && storeState.playerToken) {
        signalRService.joinGameRoom(storeState.gameId, storeState.playerToken);
      }
    });

    signalRService.onClose(() => {
      connectionStore.setSignalR('Disconnected');
    });

    // Check URL parameters for direct join: ?join=TOKEN or /join/TOKEN
    const params = new URLSearchParams(window.location.search);
    const tokenQuery = params.get('join');
    const path = window.location.pathname;

    if (tokenQuery) {
      directJoinToken = tokenQuery;
      currentView = 'JOIN';
    } else if (path.includes('/join/')) {
      const parts = path.split('/join/');
      if (parts[1]) {
        directJoinToken = parts[1].split('/')[0].split('?')[0];
        currentView = 'JOIN';
      }
    } else {
      // Restore session on browser refresh if available
      try {
        const saved = sessionStorage.getItem('chess_uno_session');
        if (saved) {
          const session = JSON.parse(saved);
          if (session.gameId && session.playerToken) {
            gameStore.setPlayerSession(session);
            signalRService.connect().then(async () => {
              connectionStore.setSignalR('Connected');
              const joined = await signalRService.joinGameRoom(session.gameId, session.playerToken);
              if (joined) {
                currentView = 'GAME';
                webrtcService.initializePeerConnection();
                showToast('Reconnected to active match.', 'success');
              } else {
                sessionStorage.removeItem('chess_uno_session');
              }
            }).catch(() => {
              sessionStorage.removeItem('chess_uno_session');
            });
          }
        }
      } catch {}
    }
  });

  onDestroy(async () => {
    webrtcService?.close();
    await signalRService.disconnect();
  });

  async function handleCreateGame(event: CustomEvent<{ playerName: string }>) {
    isCreating = true;
    errorMessage = '';
    try {
      const res = await apiService.createGame(event.detail.playerName);
      gameStore.setPlayerSession({
        gameId: res.gameId,
        playerToken: res.playerToken,
        assignedColor: res.assignedColor,
        playerName: event.detail.playerName,
        invitationUrl: res.invitationUrl,
        invitationToken: res.invitationToken
      });

      await signalRService.connect();
      connectionStore.setSignalR('Connected');
      await signalRService.joinGameRoom(res.gameId, res.playerToken);

      currentView = 'WAITING';
      showToast('Game session created! Share the link to start.', 'success');
    } catch (err: any) {
      errorMessage = err.message || 'Failed to create game session.';
      showToast(errorMessage, 'error');
    } finally {
      isCreating = false;
    }
  }

  async function handleJoinGame(event: CustomEvent<{ invitationToken: string; playerName: string }>) {
    errorMessage = '';
    try {
      const res = await apiService.joinGame(event.detail.invitationToken, event.detail.playerName);
      gameStore.setPlayerSession({
        gameId: res.gameId,
        playerToken: res.playerToken,
        assignedColor: res.assignedColor,
        playerName: event.detail.playerName,
        invitationToken: event.detail.invitationToken
      });

      await signalRService.connect();
      connectionStore.setSignalR('Connected');
      await signalRService.joinGameRoom(res.gameId, res.playerToken);

      webrtcService.initializePeerConnection();
      currentView = 'GAME';
      showToast(`Joined match as ${res.assignedColor}!`, 'success');
    } catch (err: any) {
      errorMessage = err.message || 'Failed to join match.';
      showToast(errorMessage, 'error');
    }
  }

  async function handleProposeMove(event: CustomEvent<{ from: string; to: string; promotion?: PieceType }>) {
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      const success = await signalRService.submitMove(
        storeState.gameId,
        storeState.playerToken,
        event.detail.from,
        event.detail.to,
        event.detail.promotion
      );

      if (!success) {
        isSubmitting = false;
        gameStore.clearSelection();
        showToast('Move rejected by authoritative referee.', 'error');
      }
    } catch (err: any) {
      isSubmitting = false;
      gameStore.clearSelection();
      showToast(`Move failed: ${err.message}`, 'error');
    }
  }

  async function handleDrawCard() {
    try {
      const success = await signalRService.drawCard(storeState.gameId, storeState.playerToken);
      if (!success) {
        showToast('Unable to draw card on server.', 'error');
      }
    } catch (err: any) {
      showToast(`Draw failed: ${err.message}`, 'error');
    }
  }

  async function handleSubmitSwap(event: CustomEvent<{ sq1: string; sq2: string }>) {
    try {
      const success = await signalRService.submitSwap(
        storeState.gameId,
        storeState.playerToken,
        event.detail.sq1,
        event.detail.sq2
      );
      if (!success) {
        showToast('Swap rejected by server. Ensure friendly non-king pieces are selected.', 'error');
      }
    } catch (err: any) {
      showToast(`Swap failed: ${err.message}`, 'error');
    }
  }

  async function handleSubmitRevival(event: CustomEvent<{ pieceType: string; targetSquare: string }>) {
    try {
      const success = await signalRService.submitRevival(
        storeState.gameId,
        storeState.playerToken,
        event.detail.pieceType,
        event.detail.targetSquare
      );
      if (!success) {
        showToast('Revival rejected. Target square must be empty and on your half of the board.', 'error');
      }
    } catch (err: any) {
      showToast(`Revival failed: ${err.message}`, 'error');
    }
  }

  async function handleResign() {
    try {
      await signalRService.resign(storeState.gameId, storeState.playerToken);
      showToast('You resigned the match.', 'info');
    } catch (err: any) {
      showToast(`Resign failed: ${err.message}`, 'error');
    }
  }

  async function handleReturnHome() {
    webrtcService?.close();
    await signalRService.disconnect();
    gameStore.reset();
    connectionStore.setSignalR('Disconnected');
    connectionStore.setWebRtc('Disconnected');
    currentView = 'LOBBY';
    // Clear URL query parameters
    window.history.pushState({}, '', window.location.pathname);
  }
</script>

<div class="app-container">
  <!-- Global App Header -->
  <header class="app-header">
    <div class="brand">
      <span class="brand-icon">♟️</span>
      <div>
        <div class="brand-title">Chess UNO</div>
        <div class="brand-subtitle">Multiplayer Strategy</div>
      </div>
    </div>

    <!-- Connection Indicator Pills -->
    <div class="status-bar">
      <span
        class="badge"
        class:badge-connected={connState.signalR === 'Connected'}
        class:badge-waiting={connState.signalR === 'Connecting' || connState.signalR === 'Reconnecting'}
        class:badge-disconnected={connState.signalR === 'Disconnected'}
        data-testid="badge-signalr"
      >
        SignalR: {connState.signalR}
      </span>
      <span
        class="badge"
        class:badge-connected={connState.webRtc === 'connected'}
        class:badge-waiting={connState.webRtc === 'connecting'}
        class:badge-disconnected={connState.webRtc === 'Disconnected' || connState.webRtc === 'failed' || connState.webRtc === 'closed'}
        data-testid="badge-webrtc"
      >
        WebRTC: {connState.webRtc}
      </span>
    </div>
  </header>

  <!-- Screens -->
  <main class="main-content">
    {#if currentView === 'LOBBY'}
      <HomeScreen
        {isCreating}
        {errorMessage}
        on:createGame={handleCreateGame}
        on:joinGame={handleJoinGame}
      />
    {:else if currentView === 'WAITING'}
      <WaitingRoom
        invitationUrl={storeState.invitationUrl}
        invitationToken={storeState.invitationToken}
        assignedColor={storeState.assignedColor}
        playerName={storeState.playerName}
        on:cancel={handleReturnHome}
      />
    {:else if currentView === 'JOIN'}
      <JoinGameScreen
        invitationToken={directJoinToken}
        {apiService}
        on:join={handleJoinGame}
        on:cancel={handleReturnHome}
      />
    {:else if currentView === 'GAME'}
      <GameArena
        {isSubmitting}
        on:proposeMove={handleProposeMove}
        on:drawCard={handleDrawCard}
        on:submitSwap={handleSubmitSwap}
        on:submitRevival={handleSubmitRevival}
        on:resign={handleResign}
        on:returnHome={handleReturnHome}
        on:playAgain={handleReturnHome}
      />
    {/if}
  </main>

  <!-- Notification Toasts -->
  <div class="toast-container" data-testid="toast-container">
    {#each toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}">
        {toast.text}
      </div>
    {/each}
  </div>
</div>

<style>
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .status-bar {
    display: flex;
    gap: 8px;
  }

  .toast-info {
    border-left: 4px solid var(--accent-blue);
  }

  .toast-success {
    border-left: 4px solid var(--accent-green);
  }

  .toast-error {
    border-left: 4px solid var(--accent-red);
  }
</style>
