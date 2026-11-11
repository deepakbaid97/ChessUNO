<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { PlayerColor, PieceType } from '../../types/game';
  import {
    parseFenToMatrix,
    getSquareIndex,
    getEligibleSwapSquares,
    getEligibleRevivalSquares
  } from '../../utils/boardUtils';
  import { gameStore } from '../../stores/gameStore';
  import { connectionStore } from '../../stores/connectionStore';
  import PlayerInfo from '../game/PlayerInfo.svelte';
  import Chessboard from '../chess/Chessboard.svelte';
  import CardHand from '../cards/CardHand.svelte';
  import CardTargetSelector from '../cards/CardTargetSelector.svelte';
  import GameHistory from '../game/GameHistory.svelte';
  import GameOverModal from '../game/GameOverModal.svelte';
  import CardRevealOverlay from '../animation/CardRevealOverlay.svelte';
  import { cardAnimationService, cardRevealStore } from '../../services/cardAnimationService';
  import BattleAnimationOverlay from '../animation/BattleAnimationOverlay.svelte';
  import { battleAnimationService, detectCaptureEvent } from '../../services/battleAnimationService';
  import PushToTalkControl from '../game/PushToTalkControl.svelte';
  import TurnCoachBanner from '../game/TurnCoachBanner.svelte';
  import { computeCoachGuide } from '../../utils/coachGuide';
  import { voiceStore } from '../../stores/voiceStore';

  export let isSubmitting: boolean = false;

  const dispatch = createEventDispatcher<{
    proposeMove: { from: string; to: string; promotion?: PieceType };
    drawCard: void;
    endTurn: void;
    submitChoice: { choice: string };
    submitSwap: { sq1: string; sq2: string };
    submitRevival: { pieceType: string; targetSquare: string };
    showToast: { text: string; type: 'info' | 'error' | 'success' };
    resign: void;
    returnHome: void;
    playAgain: void;
    enableVoice: void;
    leaveVoice: void;
    pushToTalkStart: void;
    pushToTalkEnd: void;
    toggleMuteOpponent: void;
    unlockAudio: void;
  }>();

  // Active target mode for Reverse / Revival
  let activeAbilityMode: 'none' | 'swap' | 'revival' = 'none';
  let firstSwapSquare: string | null = null;
  let secondSwapSquare: string | null = null;
  let selectedRevivalPiece: string | null = null;

  let storeState = $gameStore;
  let connState = $connectionStore;

  $: storeState = $gameStore;
  $: connState = $connectionStore;

  $: isGameOver = ['Checkmate', 'Stalemate', 'Resigned', 'DrawByInsufficientMaterial', 'DrawByFiftyMoveRule', 'DrawByThreefoldRepetition'].includes(storeState?.gameStatus || '');
  $: isMyTurn = !!(storeState?.activePlayer && storeState?.assignedColor && storeState.activePlayer === storeState.assignedColor && !isGameOver);
  $: opponentColor = ((storeState?.assignedColor === 'White' ? 'Black' : 'White') || 'Black') as PlayerColor;

  $: myReserves = storeState?.assignedColor === 'White' ? (storeState.whiteReserves || []) : (storeState?.blackReserves || []);
  $: opponentReserves = storeState?.assignedColor === 'White' ? (storeState?.blackReserves || []) : (storeState?.whiteReserves || []);

  // Auto-activate ability mode when drawing swap or revival cards
  $: if (isMyTurn && storeState?.canSwap && activeAbilityMode === 'none') {
    activeAbilityMode = 'swap';
    firstSwapSquare = null;
    secondSwapSquare = null;
  }
  $: if (!storeState?.canSwap && activeAbilityMode === 'swap') {
    activeAbilityMode = 'none';
    firstSwapSquare = null;
    secondSwapSquare = null;
  }
  $: if (isMyTurn && (storeState?.remainingRevivals || 0) > 0 && myReserves.length > 0 && activeAbilityMode === 'none') {
    activeAbilityMode = 'revival';
    if (!selectedRevivalPiece && myReserves.length === 1) {
      selectedRevivalPiece = myReserves[0];
    }
  }
  $: if ((storeState?.remainingRevivals || 0) === 0 && activeAbilityMode === 'revival') {
    activeAbilityMode = 'none';
    selectedRevivalPiece = null;
  }

  $: swapEligibleSquares = activeAbilityMode === 'swap' && storeState?.boardFen && storeState?.assignedColor
    ? getEligibleSwapSquares(storeState.boardFen, storeState.assignedColor)
    : [];

  $: revivalEligibleSquares = activeAbilityMode === 'revival' && selectedRevivalPiece && storeState?.boardFen && storeState?.assignedColor
    ? getEligibleRevivalSquares(storeState.boardFen, storeState.assignedColor, selectedRevivalPiece)
    : [];

  $: displayedValidDestinations = activeAbilityMode === 'swap'
    ? swapEligibleSquares.filter(sq => sq !== firstSwapSquare)
    : activeAbilityMode === 'revival'
      ? revivalEligibleSquares
      : (storeState?.validDestinations || []);

  $: displayedSelectedSquare = activeAbilityMode === 'swap'
    ? (firstSwapSquare || null)
    : (storeState?.selectedSquare || null);

  $: coachGuide = computeCoachGuide({
    isGameOver,
    isMyTurn,
    storeState,
    opponentColor,
    activeAbilityMode,
    firstSwapSquare,
    myReserves,
    selectedRevivalPiece
  });

  function handleSquareSelected(event: CustomEvent<{ square: string }>) {
    cardAnimationService.dismiss();
    const square = event.detail.square;

    if (activeAbilityMode === 'swap') {
      if (!storeState?.boardFen || !storeState?.assignedColor) return;
      const eligible = getEligibleSwapSquares(storeState.boardFen, storeState.assignedColor);
      if (!eligible.includes(square)) {
        const matrix = parseFenToMatrix(storeState.boardFen);
        const { row, col } = getSquareIndex(square);
        const piece = matrix[row]?.[col];
        if (!piece) {
          dispatch('showToast', { text: 'Select an occupied square with your own friendly piece to swap.', type: 'error' });
        } else if (piece.type === 'King') {
          dispatch('showToast', { text: 'Kings cannot be swapped.', type: 'error' });
        } else if (piece.color !== storeState.assignedColor) {
          dispatch('showToast', { text: 'Reverse can only swap your own friendly pieces. Opponent pieces cannot be swapped.', type: 'error' });
        }
        return;
      }

      if (!firstSwapSquare) {
        firstSwapSquare = square;
      } else if (firstSwapSquare === square) {
        firstSwapSquare = null;
      } else {
        secondSwapSquare = square;
        dispatch('submitSwap', {
          sq1: firstSwapSquare,
          sq2: secondSwapSquare
        });
        activeAbilityMode = 'none';
        firstSwapSquare = null;
        secondSwapSquare = null;
      }
      return;
    }

    if (activeAbilityMode === 'revival') {
      if (!selectedRevivalPiece) {
        dispatch('showToast', { text: 'Please select a captured piece from your reserves first.', type: 'error' });
        return;
      }
      if (!storeState?.boardFen || !storeState?.assignedColor) return;
      const eligible = getEligibleRevivalSquares(storeState.boardFen, storeState.assignedColor, selectedRevivalPiece);
      if (!eligible.includes(square)) {
        dispatch('showToast', { text: 'Revival square must be an empty square in your half of the board.', type: 'error' });
        return;
      }
      dispatch('submitRevival', {
        pieceType: selectedRevivalPiece,
        targetSquare: square
      });
      activeAbilityMode = 'none';
      selectedRevivalPiece = null;
      return;
    }

    // Standard piece selection
    gameStore.selectSquare(square);
  }

  function handleMoveProposed(event: CustomEvent<{ from: string; to: string; promotion?: PieceType }>) {
    cardAnimationService.dismiss();
    if (activeAbilityMode === 'swap') {
      dispatch('submitSwap', {
        sq1: event.detail.from,
        sq2: event.detail.to
      });
      activeAbilityMode = 'none';
      firstSwapSquare = null;
      secondSwapSquare = null;
      return;
    }
    dispatch('proposeMove', event.detail);
  }

  function handleActivateSwap() {
    activeAbilityMode = 'swap';
    firstSwapSquare = null;
    secondSwapSquare = null;
  }

  function handleActivateRevival() {
    activeAbilityMode = 'revival';
    selectedRevivalPiece = myReserves.length === 1 ? myReserves[0] : null;
  }

  function handleCancelAbility() {
    firstSwapSquare = null;
    secondSwapSquare = null;
    selectedRevivalPiece = null;
  }

  function handleResign() {
    if (confirm('Are you sure you want to resign this match?')) {
      dispatch('resign');
    }
  }

  let floatingMoveToast: { actor: string; from: string; to: string } | null = null;
  let moveToastTimer: ReturnType<typeof setTimeout> | null = null;
  let prevLastMove: { from: string; to: string } | null = null;
  let showMatchStartBanner = true;

  setTimeout(() => {
    showMatchStartBanner = false;
  }, 2400);

  $: if (storeState?.lastMove && (storeState.lastMove.from !== prevLastMove?.from || storeState.lastMove.to !== prevLastMove?.to)) {
    prevLastMove = storeState.lastMove;
    const actor = storeState?.activePlayer === storeState?.assignedColor ? (storeState?.opponentName || 'Opponent') : 'You';
    floatingMoveToast = {
      actor,
      from: storeState.lastMove.from.toUpperCase(),
      to: storeState.lastMove.to.toUpperCase()
    };
    if (moveToastTimer) clearTimeout(moveToastTimer);
    moveToastTimer = setTimeout(() => {
      floatingMoveToast = null;
    }, 2200);
  }

  function getElementRect(selector: string): { x: number; y: number; width: number; height: number } | null {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  let previousBoardFen: string = '';
  let lastHandledMoveCounter: number = 0;
  let lastRevealedCardKey: string | null = null;
  let lastRevealedDrawCounter: number = 0;
  let previousActiveCardId: string | null = null;
  let previousTurnPhase: string = '';

  onMount(() => {
    // If mounting into an already active card (e.g. page reload mid-game), record it so we don't replay
    if (storeState?.activeCard?.id) {
      const drawerColor: PlayerColor = (storeState?.lastDrawerColor || storeState?.activePlayer || 'White') as PlayerColor;
      lastRevealedCardKey = `draw-${storeState.drawEventCounter || 0}-${storeState.activeCard.id}-${storeState.activeCard.value ?? 'x'}-${drawerColor}`;
      previousActiveCardId = storeState.activeCard.id;
      lastRevealedDrawCounter = storeState.drawEventCounter || 0;
    }
    previousBoardFen = storeState?.boardFen || '';
    lastHandledMoveCounter = storeState?.moveEventCounter || 0;
  });

  onDestroy(() => {
    cardAnimationService.dismiss();
    battleAnimationService.reset();
  });

  $: if (isGameOver) {
    battleAnimationService.reset();
  }

  // Authoritative Battle Animation Trigger:
  // Detects accepted captures between supported pieces (Pawn, Knight, Rook) when a new move is confirmed/accepted
  $: if (storeState && (storeState.moveEventCounter || 0) > lastHandledMoveCounter) {
    const moveData = storeState.lastAcceptedMove;
    const currentFen = storeState.boardFen;
    lastHandledMoveCounter = storeState.moveEventCounter || 0;

    if (moveData && previousBoardFen && previousBoardFen !== currentFen) {
      const battleEvent = detectCaptureEvent(previousBoardFen, currentFen, {
        from: moveData.from,
        to: moveData.to
      });
      if (battleEvent) {
        const moveKey = `battle-${storeState.revision}-${storeState.moveEventCounter}-${moveData.from}-${moveData.to}`;
        battleAnimationService.triggerBattle(battleEvent, moveKey);
      }
    }
    previousBoardFen = currentFen;
  } else if (storeState?.boardFen && storeState.boardFen !== previousBoardFen) {
    previousBoardFen = storeState.boardFen;
  }

  // Authoritative Card Reveal Trigger:
  // Detects fresh card draws reliably across turns (including Card 0, Draw cards, etc.) for both local player and remote opponent
  $: {
    const currentDrawCounter = storeState?.drawEventCounter || 0;
    const isNewDrawEvent = currentDrawCounter > lastRevealedDrawCounter;

    // A card should be revealed ONLY when:
    // 1. A new card draw event occurred (e.g. onCardDrawn fired, incrementing drawEventCounter)
    // 2. Or a new activeCard arrives during an active ActionPhase/AwaitingChoice (e.g. initial game state or direct transition)
    // CRITICAL: A card must NEVER be revealed when a turn ends and transitions back to DrawPhase!
    const cardToReveal = isNewDrawEvent
      ? (storeState?.lastDrawnCard || storeState?.activeCard)
      : (storeState?.turnPhase !== 'DrawPhase' ? storeState?.activeCard : null);

    if (cardToReveal?.id) {
      const drawerColor: PlayerColor = (storeState?.lastDrawerColor || storeState?.activePlayer || 'White') as PlayerColor;
      const cardKey = `draw-${currentDrawCounter}-${cardToReveal.id}-${cardToReveal.value ?? 'x'}-${drawerColor}`;
      const isNewCardInActionPhase = storeState?.turnPhase !== 'DrawPhase' && cardToReveal.id !== previousActiveCardId;

      const isFreshDraw = (isNewDrawEvent || isNewCardInActionPhase) && (cardKey !== lastRevealedCardKey);

      if (isFreshDraw) {
        lastRevealedCardKey = cardKey;
        lastRevealedDrawCounter = currentDrawCounter;
        previousActiveCardId = cardToReveal.id;

        const isLocal = drawerColor === storeState?.assignedColor;

        const sourceRect = isLocal
          ? (getElementRect('[data-testid="draw-card-slot"]') || getElementRect('.draw-card-slot'))
          : getElementRect('[data-testid="opponent-info"]');

        const targetRect = getElementRect('.card-column') || getElementRect('[data-testid="card-hand"]');

        cardAnimationService.triggerCardReveal(cardToReveal, {
          drawerColor,
          isLocalPlayer: isLocal,
          sourceRect,
          targetRect,
          revision: storeState?.revision,
          drawKey: cardKey
        });
      }
    }
  }

  // Reset active card id when returning to DrawPhase
  $: if (!storeState?.activeCard && storeState?.turnPhase === 'DrawPhase') {
    previousActiveCardId = null;
  }

  $: previousTurnPhase = storeState?.turnPhase || '';
</script>

<div class="game-arena" data-testid="game-arena">
  <div class="arena-layout">
    <!-- Opponent Info -->
    <div class="area-opponent">
      <PlayerInfo
        name={storeState?.opponentName || 'Opponent'}
        color={opponentColor}
        isCurrentTurn={storeState?.activePlayer === opponentColor && !isGameOver}
        isConnected={connState?.signalR === 'Connected'}
        reserves={opponentReserves}
        isOpponent={true}
        isSpeaking={$voiceStore?.isOpponentSpeaking}
      />
    </div>

    <!-- Chessboard -->
    <div class="area-board">
      {#if showMatchStartBanner && (storeState?.revision ?? 0) <= 1}
        <div class="match-start-pill" aria-live="polite">
          <span class="start-dot"></span>
          <span>MATCH START • WHITE TO MOVE</span>
        </div>
      {:else if floatingMoveToast}
        <div class="floating-move-toast" aria-live="polite">
          <span class="move-toast-actor">{floatingMoveToast.actor}:</span>
          <span class="move-toast-text">{floatingMoveToast.from} ➔ {floatingMoveToast.to}</span>
        </div>
      {/if}

      <Chessboard
        fen={storeState?.boardFen || '8/8/8/8/8/8/8/8'}
        perspective={storeState?.assignedColor || 'White'}
        activePlayer={storeState?.activePlayer || 'White'}
        {isMyTurn}
        selectedSquare={displayedSelectedSquare}
        validDestinations={displayedValidDestinations}
        lastMove={storeState?.lastMove || null}
        inCheck={!!storeState?.inCheck}
        isCheckmate={storeState?.gameStatus === 'Checkmate'}
        {isSubmitting}
        mode={activeAbilityMode === 'none' ? 'normal' : activeAbilityMode}
        on:squareSelected={handleSquareSelected}
        on:moveProposed={handleMoveProposed}
      />
    </div>

    <!-- Player Info + Resign -->
    <div class="area-player">
      <PlayerInfo
        name={storeState?.playerName || 'Player'}
        color={storeState?.assignedColor || 'White'}
        isCurrentTurn={isMyTurn}
        isConnected={connState?.signalR === 'Connected'}
        reserves={myReserves}
        isOpponent={false}
        hasActiveRevivals={activeAbilityMode === 'revival' || (storeState?.remainingRevivals || 0) > 0}
      >
        <div slot="actions" class="player-actions-cluster">
          <PushToTalkControl
            opponentName={storeState?.opponentName || 'Opponent'}
            disabled={isGameOver}
            on:enableVoice={() => dispatch('enableVoice')}
            on:leaveVoice={() => dispatch('leaveVoice')}
            on:pushToTalkStart={() => dispatch('pushToTalkStart')}
            on:pushToTalkEnd={() => dispatch('pushToTalkEnd')}
            on:toggleMuteOpponent={() => dispatch('toggleMuteOpponent')}
            on:unlockAudio={() => dispatch('unlockAudio')}
          />
          <button
            class="btn btn-danger btn-resign"
            on:click={handleResign}
            disabled={isGameOver}
            data-testid="btn-resign"
          >
            Resign
          </button>
        </div>
      </PlayerInfo>
    </div>

    <!-- Command Panel: Coach Banner + Target Selector + Card Dock + Match Log -->
    <aside class="area-command">
      <TurnCoachBanner
        {coachGuide}
        inCheck={!!storeState?.inCheck}
        {isGameOver}
        activeCardName={storeState?.activeCard?.name}
      />

      {#if activeAbilityMode !== 'none'}
        <CardTargetSelector
          mode={activeAbilityMode}
          playerColor={storeState?.assignedColor || 'White'}
          reserves={myReserves}
          selectedPieceType={selectedRevivalPiece}
          {firstSwapSquare}
          {secondSwapSquare}
          on:selectReservePiece={(e) => { selectedRevivalPiece = e.detail.pieceType; }}
          on:cancel={handleCancelAbility}
        />
      {/if}

      <CardHand
        activeCard={storeState?.activeCard || null}
        turnPhase={storeState?.turnPhase || 'DrawPhase'}
        {isMyTurn}
        isDrawing={isSubmitting}
        remainingMoves={storeState?.remainingMoves || 0}
        remainingRevivals={storeState?.remainingRevivals || 0}
        canSwap={!!storeState?.canSwap}
        availableChoices={storeState?.availableChoices || []}
        remainingDeckCount={storeState?.remainingDeckCount || 0}
        on:drawCard={() => dispatch('drawCard')}
        on:endTurn={() => dispatch('endTurn')}
        on:submitChoice={(e) => dispatch('submitChoice', e.detail)}
        on:activateSwap={handleActivateSwap}
        on:activateRevival={handleActivateRevival}
      />

      <GameHistory logs={storeState?.logs || []} />
    </aside>
  </div>

  <!-- Game Completion Overlay -->
  <GameOverModal
    isOpen={isGameOver && !$cardRevealStore.isActive}
    winner={storeState?.winner || null}
    playerColor={storeState?.assignedColor || 'White'}
    gameStatus={storeState?.gameStatus || ''}
    totalMoves={storeState?.revision || 0}
    on:returnHome={() => dispatch('returnHome')}
    on:playAgain={() => dispatch('playAgain')}
  />

  <!-- Cinematic Card Reveal Animation Overlay -->
  <CardRevealOverlay />

  <!-- Cinematic Battle Animation Overlay -->
  <BattleAnimationOverlay />
</div>

<style>
  .game-arena {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .arena-layout {
    display: grid;
    grid-template-columns: minmax(340px, 500px) minmax(320px, 420px);
    grid-template-areas:
      "opponent command"
      "board    command"
      "player   command";
    gap: 10px 24px;
    justify-content: center;
    align-items: start;
    width: 100%;
    min-width: 0;
  }

  .area-opponent {
    grid-area: opponent;
    width: 100%;
  }

  .area-board {
    grid-area: board;
    position: relative;
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .match-start-pill,
  .floating-move-toast {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 3px 12px;
    border-radius: 20px;
    background-color: var(--bg-surface);
    border: 1px solid var(--accent-gold);
    box-shadow: 0 0 12px var(--accent-gold-glow), var(--shadow-md);
    color: var(--accent-gold-bright);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    z-index: 30;
    pointer-events: none;
    animation: toastFloatIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
  }

  @keyframes toastFloatIn {
    from { transform: translate(-50%, -8px) scale(0.9); opacity: 0; }
    to { transform: translate(-50%, 0) scale(1); opacity: 1; }
  }

  .start-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--accent-green);
    animation: dotPulse 1.2s infinite alternate;
  }

  @keyframes dotPulse {
    from { transform: scale(0.8); opacity: 0.6; }
    to { transform: scale(1.3); opacity: 1; }
  }

  .move-toast-actor {
    color: var(--text-muted);
  }

  .move-toast-text {
    color: var(--accent-gold-bright);
  }

  .area-player {
    grid-area: player;
    width: 100%;
  }

  .area-command {
    grid-area: command;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .player-actions-cluster {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-resign {
    padding: 5px 10px;
    font-size: 0.75rem;
  }

  /* Single-Screen Mobile Viewport Layout */
  @media (max-width: 900px) {
    .arena-layout {
      grid-template-columns: 1fr;
      grid-template-areas:
        "opponent"
        "board"
        "command"
        "player";
      gap: 6px;
      max-width: 100%;
      margin: 0 auto;
      width: 100%;
    }

    .area-command {
      gap: 6px;
      min-width: 0;
    }
  }
</style>
