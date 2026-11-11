<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { buildInvitationUrl } from './lib/config/apiConfig';
  import { GameApiService } from './lib/services/gameApiService';
  import { SignalRService } from './lib/services/signalrService';
  import { WebRtcService } from './lib/services/webrtcService';
  import { gameStore } from './lib/stores/gameStore';
  import { connectionStore } from './lib/stores/connectionStore';
  import { voiceStore } from './lib/stores/voiceStore';
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
  let customSeed: number | undefined = undefined;
  let isCreating = false;
  let isSubmitting = false;
  let isRestoringSession = false;
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

  function generateActionId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  $: storeState = $gameStore;
  $: connState = $connectionStore;

  $: if (currentView === 'WAITING' && ($gameStore.status === 'Ready' || $gameStore.status === 'InProgress' || !!$gameStore.playerBlackName)) {
    currentView = 'GAME';
  }

  let waitingPollTimer: any = null;
  $: if (currentView === 'WAITING') {
    if (!waitingPollTimer && storeState.gameId) {
      waitingPollTimer = setInterval(async () => {
        try {
          if (storeState.gameId) {
            const session = await apiService.getGameSession(storeState.gameId);
            if (session.playerBlackName || session.status === 'Ready' || session.status === 'InProgress' || session.status === 'Active') {
              if (storeState.gameId && storeState.playerToken) {
                await signalRService.joinGameRoom(storeState.gameId, storeState.playerToken);
              }
              currentView = 'GAME';
            }
          }
        } catch {}
      }, 1000);
    }
  } else {
    if (waitingPollTimer) {
      clearInterval(waitingPollTimer);
      waitingPollTimer = null;
    }
  }

  function syncWebRtcSession(forceRestart: boolean = false) {
    const session = get(gameStore);
    const isWhite = session.assignedColor === 'White';
    const isBlack = session.assignedColor === 'Black';
    const opponentPresent = !!session.opponentName || session.gameStatus !== 'WaitingForPlayer';

    if ((isWhite || isBlack) && opponentPresent) {
      if (forceRestart) {
        webrtcService?.restartConnection(isWhite);
      } else {
        webrtcService?.ensurePeerConnection(isWhite);
      }
    }
  }

  onMount(() => {
    // Setup WebRTC Service
    webrtcService = new WebRtcService(
      (signalType, payload) => {
        const session = get(gameStore);
        if (session.gameId && session.playerToken) {
          signalRService.sendSignal(session.gameId, session.playerToken, signalType, payload);
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

    webrtcService.setOnAutoplayBlocked((blocked) => {
      voiceStore.setAutoplayBlocked(blocked);
    });

    webrtcService.setOnVoiceStatus((sender, payload) => {
      voiceStore.setOpponentSpeaking(payload.speaking);
      voiceStore.setOpponentVoiceActive(payload.voiceActive);
    });

    webrtcService.setOnLocalTrackEnded(() => {
      voiceStore.setMicActive(false);
      voiceStore.setError('Microphone track ended unexpectedly.');
      showToast('Microphone disconnected.', 'error');
    });

    webrtcService.setOnFallbackSignalNeeded((signalType, payload) => {
      const session = get(gameStore);
      if (session.gameId && session.playerToken) {
        signalRService.sendSignal(session.gameId, session.playerToken, signalType, payload).catch(() => {});
      }
    });

    // Setup SignalR Callbacks
    signalRService.onGameStateSnapshot((snapshot) => {
      gameStore.applySnapshot(snapshot);
      connectionStore.setSignalR('Connected');
      syncWebRtcSession();
    });

    signalRService.onPlayerDisconnected((data) => {
      console.log('[SignalR Event] onPlayerDisconnected received:', data);
      showToast(`${data.playerName} (${data.color}) disconnected. Waiting for reconnection...`, 'error');
      connectionStore.setWebRtc('Disconnected');
      voiceStore.setOpponentSpeaking(false);
      voiceStore.setOpponentVoiceActive(false);
      webrtcService?.resetOpponentVoiceStatus();
    });

    signalRService.onActionRejected(async (data) => {
      console.warn('[SignalR Event] onActionRejected received:', data);
      isSubmitting = false;
      gameStore.clearSelection();

      if (data.reason === 'REVISION_MISMATCH') {
        showToast('Game state out of sync. Refreshing board...', 'error');
        if (storeState.gameId && storeState.playerToken) {
          await signalRService.joinGameRoom(storeState.gameId, storeState.playerToken);
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
      if (currentView === 'WAITING') {
        currentView = 'GAME';
      }
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
      console.log('[SignalR Event] onPlayerConnected received:', data);
      gameStore.onPlayerConnected(data);
      showToast(`${data.playerName} joined as ${data.color}!`, 'success');

      currentView = 'GAME';
      const isWhite = get(gameStore).assignedColor === 'White';
      syncWebRtcSession(isWhite);
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
      if (signalType === 'voice-status') {
        try {
          const parsed = JSON.parse(payload);
          if (parsed && parsed.payload) {
            webrtcService?.handleVoiceStatus(parsed.sender, parsed.payload, parsed.epoch);
          }
        } catch {}
        return;
      }
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

    // Check saved session in sessionStorage first (e.g., page refresh during match)
    let savedSession: any = null;
    try {
      const saved = sessionStorage.getItem('chess_uno_session');
      if (saved) savedSession = JSON.parse(saved);
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const tokenQuery = params.get('join');
    const seedParam = params.get('seed');
    if (seedParam) {
      const parsedSeed = parseInt(seedParam, 10);
      if (!isNaN(parsedSeed)) customSeed = parsedSeed;
    }
    const path = window.location.pathname;

    if (savedSession && savedSession.gameId && savedSession.playerToken) {
      isRestoringSession = true;
      gameStore.setPlayerSession(savedSession);
      signalRService.connect().then(async () => {
        connectionStore.setSignalR('Connected');
        const joined = await signalRService.joinGameRoom(savedSession.gameId, savedSession.playerToken);
        if (joined) {
          currentView = 'GAME';
          syncWebRtcSession();
          showToast('Reconnected to active match.', 'success');
        } else {
          sessionStorage.removeItem('chess_uno_session');
        }
      }).catch(() => {
        sessionStorage.removeItem('chess_uno_session');
      }).finally(() => {
        isRestoringSession = false;
      });
    } else if (tokenQuery) {
      directJoinToken = tokenQuery;
      currentView = 'JOIN';
    } else if (path.includes('/join/')) {
      const parts = path.split('/join/');
      if (parts[1]) {
        directJoinToken = parts[1].split('/')[0].split('?')[0];
        currentView = 'JOIN';
      }
    }
  });

  onDestroy(async () => {
    voiceStore.reset();
    webrtcService?.close();
    await signalRService.disconnect();
  });

  async function handleCreateGame(event: CustomEvent<{ playerName: string; seed?: number }>) {
    isCreating = true;
    errorMessage = '';
    try {
      const res = await apiService.createGame(event.detail.playerName, event.detail.seed);
      const effectiveInviteUrl = buildInvitationUrl(res.invitationToken);
      gameStore.setPlayerSession({
        gameId: res.gameId,
        playerToken: res.playerToken,
        assignedColor: res.assignedColor,
        playerName: event.detail.playerName,
        invitationUrl: effectiveInviteUrl,
        invitationToken: res.invitationToken
      });

      sessionStorage.setItem('chess_uno_session', JSON.stringify({
        gameId: res.gameId,
        playerToken: res.playerToken,
        assignedColor: res.assignedColor,
        playerName: event.detail.playerName,
        invitationUrl: effectiveInviteUrl,
        invitationToken: res.invitationToken
      }));

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
      console.log('[handleJoinGame] API returned:', res);
      gameStore.setPlayerSession({
        gameId: res.gameId,
        playerToken: res.playerToken,
        assignedColor: res.assignedColor,
        playerName: event.detail.playerName,
        invitationToken: event.detail.invitationToken
      });

      sessionStorage.setItem('chess_uno_session', JSON.stringify({
        gameId: res.gameId,
        playerToken: res.playerToken,
        assignedColor: res.assignedColor,
        playerName: event.detail.playerName,
        invitationUrl: res.invitationUrl,
        invitationToken: res.invitationToken
      }));

      await signalRService.connect();
      connectionStore.setSignalR('Connected');
      await signalRService.joinGameRoom(res.gameId, res.playerToken);

      syncWebRtcSession();
      try {
        window.history.replaceState({}, '', '/');
      } catch {}
      currentView = 'GAME';
      showToast(`Joined match as ${res.assignedColor}!`, 'success');
    } catch (err: any) {
      errorMessage = err.message || 'Failed to join match.';
      showToast(errorMessage, 'error');
    }
  }

  async function handleProposeMove(event: CustomEvent<{ from: string; to: string; promotion?: PieceType }>) {
    console.log('[handleProposeMove] Proposing move:', event.detail);
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      const actionId = generateActionId();
      const success = await signalRService.submitMove(
        storeState.gameId,
        storeState.playerToken,
        event.detail.from,
        event.detail.to,
        event.detail.promotion,
        actionId,
        storeState.revision
      );
      console.log('[handleProposeMove] submitMove result:', success);

      if (!success) {
        isSubmitting = false;
        gameStore.clearSelection();
        showToast('Move rejected by authoritative referee.', 'error');
      }
    } catch (err: any) {
      console.error('[handleProposeMove] Error:', err);
      isSubmitting = false;
      gameStore.clearSelection();
      showToast(`Move failed: ${err.message}`, 'error');
    }
  }

  async function handleDrawCard() {
    console.log('[handleDrawCard] Invoking DrawCard on hub with gameId:', storeState.gameId);
    try {
      const actionId = generateActionId();
      const success = await signalRService.drawCard(
        storeState.gameId,
        storeState.playerToken,
        actionId,
        storeState.revision
      );
      console.log('[handleDrawCard] Result:', success);
      if (!success) {
        showToast('Unable to draw card on server.', 'error');
      }
    } catch (err: any) {
      console.error('[handleDrawCard] Threw:', err);
      showToast(`Draw failed: ${err.message}`, 'error');
    }
  }

  async function handleSubmitChoice(event: CustomEvent<{ choice: string }>) {
    try {
      const actionId = generateActionId();
      const success = await signalRService.submitChoice(
        storeState.gameId,
        storeState.playerToken,
        event.detail.choice,
        actionId,
        storeState.revision
      );
      if (!success) {
        showToast('Choice rejected by server.', 'error');
      }
    } catch (err: any) {
      showToast(`Choice failed: ${err.message}`, 'error');
    }
  }

  async function handleEndTurn() {
    try {
      const actionId = generateActionId();
      const success = await signalRService.endTurn(
        storeState.gameId,
        storeState.playerToken,
        actionId,
        storeState.revision
      );
      if (!success) {
        showToast('Cannot end turn at this time.', 'error');
      }
    } catch (err: any) {
      showToast(`End turn failed: ${err.message}`, 'error');
    }
  }

  async function handleSubmitSwap(event: CustomEvent<{ sq1: string; sq2: string }>) {
    try {
      const actionId = generateActionId();
      const success = await signalRService.submitSwap(
        storeState.gameId,
        storeState.playerToken,
        event.detail.sq1,
        event.detail.sq2,
        actionId,
        storeState.revision
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
      const actionId = generateActionId();
      const success = await signalRService.submitRevival(
        storeState.gameId,
        storeState.playerToken,
        event.detail.pieceType,
        event.detail.targetSquare,
        actionId,
        storeState.revision
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
    sessionStorage.removeItem('chess_uno_session');
    voiceStore.reset();
    webrtcService?.close();
    await signalRService.disconnect();
    gameStore.reset();
    connectionStore.setSignalR('Disconnected');
    connectionStore.setWebRtc('Disconnected');
    currentView = 'LOBBY';
    // Clear URL query parameters
    window.history.pushState({}, '', window.location.pathname);
  }

  async function handleEnableVoice() {
    try {
      voiceStore.setError(null);
      await webrtcService.enableMicrophone();
      webrtcService.setPushToTalk(false, storeState.playerName || storeState.assignedColor);
      voiceStore.setVoiceEnabled(true);
      voiceStore.setMicActive(true);
      showToast('Voice connected! Hold Space or V to speak.', 'success');
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied.'
        : err.message || 'Could not access microphone.';
      voiceStore.setError(msg);
      showToast(msg, 'error');
    }
  }

  function handleLeaveVoice() {
    webrtcService.closeAudio();
    voiceStore.reset();
    showToast('Disconnected from voice chat.', 'info');
  }

  function handlePushToTalkStart() {
    webrtcService.setPushToTalk(true, storeState.playerName || storeState.assignedColor);
  }

  function handlePushToTalkEnd() {
    webrtcService.setPushToTalk(false, storeState.playerName || storeState.assignedColor);
  }

  function handleToggleMuteOpponent() {
    const isMuted = get(voiceStore).isOpponentMuted;
    webrtcService.muteOpponent(!isMuted);
    voiceStore.toggleOpponentMuted();
  }
</script>

<div class="app-container">
  <!-- Global App Header -->
  <header class="app-header">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3L9 7h6l-3-4z" />
          <path d="M7 11h10l-1.5 7h-7L7 11z" />
          <path d="M5 21h14" />
        </svg>
      </div>
      <div class="brand-text">
        <span class="brand-title">Chess UNO</span>
        <span class="brand-subtitle">Tactical Board &amp; Deck</span>
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
    {#if isRestoringSession}
      <div class="session-loader panel" role="status" aria-live="polite">
        <div class="loader-spinner"></div>
        <div class="loader-title">Restoring Match Session</div>
        <div class="loader-sub">Synchronizing board state with authoritative server...</div>
      </div>
    {:else if currentView === 'LOBBY'}
      <HomeScreen
        defaultSeed={customSeed}
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
        on:endTurn={handleEndTurn}
        on:submitChoice={handleSubmitChoice}
        on:submitSwap={handleSubmitSwap}
        on:submitRevival={handleSubmitRevival}
        on:showToast={(e) => showToast(e.detail.text, e.detail.type)}
        on:resign={handleResign}
        on:returnHome={handleReturnHome}
        on:playAgain={handleReturnHome}
        on:enableVoice={handleEnableVoice}
        on:leaveVoice={handleLeaveVoice}
        on:pushToTalkStart={handlePushToTalkStart}
        on:pushToTalkEnd={handlePushToTalkEnd}
        on:toggleMuteOpponent={handleToggleMuteOpponent}
        on:unlockAudio={() => webrtcService?.unlockAudio()}
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

  .session-loader {
    max-width: 420px;
    margin: 40px auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 10px;
    padding: 32px 24px;
  }

  .loader-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(245, 158, 11, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loader-title {
    font-family: var(--font-headline);
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent-gold-bright);
  }

  .loader-sub {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
