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
  import { cardAnimationService } from '../../services/cardAnimationService';
  import BattleAnimationOverlay from '../animation/BattleAnimationOverlay.svelte';
  import { battleAnimationService, detectPawnCaptureEvent } from '../../services/battleAnimationService';
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

  $: storeState = $gameStore;
  $: connState = $connectionStore;

  $: isMyTurn = storeState.activePlayer === storeState.assignedColor && !isGameOver;
  $: opponentColor = (storeState.assignedColor === 'White' ? 'Black' : 'White') as PlayerColor;

  $: myReserves = storeState.assignedColor === 'White' ? storeState.whiteReserves : storeState.blackReserves;
  $: opponentReserves = storeState.assignedColor === 'White' ? storeState.blackReserves : storeState.whiteReserves;

  $: isGameOver = ['Checkmate', 'Stalemate', 'Resigned', 'DrawByInsufficientMaterial', 'DrawByFiftyMoveRule', 'DrawByThreefoldRepetition'].includes(storeState.gameStatus);

  // Auto-activate ability mode when drawing swap or revival cards
  $: if (isMyTurn && storeState.canSwap && activeAbilityMode === 'none') {
    activeAbilityMode = 'swap';
    firstSwapSquare = null;
    secondSwapSquare = null;
  }
  $: if (!storeState.canSwap && activeAbilityMode === 'swap') {
    activeAbilityMode = 'none';
    firstSwapSquare = null;
    secondSwapSquare = null;
  }
  $: if (isMyTurn && storeState.remainingRevivals > 0 && myReserves.length > 0 && activeAbilityMode === 'none') {
    activeAbilityMode = 'revival';
    if (!selectedRevivalPiece && myReserves.length === 1) {
      selectedRevivalPiece = myReserves[0];
    }
  }
  $: if (storeState.remainingRevivals === 0 && activeAbilityMode === 'revival') {
    activeAbilityMode = 'none';
    selectedRevivalPiece = null;
  }

  $: swapEligibleSquares = activeAbilityMode === 'swap'
    ? getEligibleSwapSquares(storeState.boardFen, storeState.assignedColor)
    : [];

  $: revivalEligibleSquares = activeAbilityMode === 'revival' && selectedRevivalPiece
    ? getEligibleRevivalSquares(storeState.boardFen, storeState.assignedColor, selectedRevivalPiece)
    : [];

  $: displayedValidDestinations = activeAbilityMode === 'swap'
    ? swapEligibleSquares.filter(sq => sq !== firstSwapSquare)
    : activeAbilityMode === 'revival'
      ? revivalEligibleSquares
      : storeState.validDestinations;

  $: displayedSelectedSquare = activeAbilityMode === 'swap'
    ? (firstSwapSquare || null)
    : storeState.selectedSquare;

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

  $: if (storeState.lastMove && (storeState.lastMove.from !== prevLastMove?.from || storeState.lastMove.to !== prevLastMove?.to)) {
    prevLastMove = storeState.lastMove;
    const actor = storeState.activePlayer === storeState.assignedColor ? (storeState.opponentName || 'Opponent') : 'You';
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

  let lastRevealedCardKey: string | null = null;
  let lastRevealedDrawCounter: number = 0;
  let previousActiveCardId: string | null = null;
  let previousTurnPhase: string = '';

  onMount(() => {
    // If mounting into an already active card (e.g. page reload mid-game), record it so we don't replay
    if (storeState?.activeCard?.id) {
      lastRevealedCardKey = `${storeState.activeCard.id}-${storeState.activeCard.value}-${storeState.revision}`;
      previousActiveCardId = storeState.activeCard.id;
      lastRevealedDrawCounter = storeState.drawEventCounter;
    }
    previousBoardFen = storeState?.boardFen || '';
  });

  let previousBoardFen: string = '';
  let lastHandledBattleKey: string = '';

  onDestroy(() => {
    cardAnimationService.dismiss();
    battleAnimationService.dismiss();
  });

  $: if (isGameOver) {
    cardAnimationService.dismiss();
    battleAnimationService.dismiss();
  }

  // Authoritative Battle Animation Trigger:
  // Detects accepted pawn-on-pawn captures and triggers central cinematic overlay
  $: if (storeState?.boardFen && storeState?.lastMove?.from && storeState?.lastMove?.to) {
    const moveKey = `${storeState.lastMove.from}-${storeState.lastMove.to}-${storeState.boardFen}`;
    if (moveKey !== lastHandledBattleKey) {
      if (previousBoardFen && previousBoardFen !== storeState.boardFen) {
        const battleEvent = detectPawnCaptureEvent(previousBoardFen, storeState.boardFen, storeState.lastMove);
        if (battleEvent) {
          lastHandledBattleKey = moveKey;
          battleAnimationService.triggerBattle(battleEvent, moveKey);
        }
      }
      previousBoardFen = storeState.boardFen;
    }
  } else if (storeState?.boardFen && storeState.boardFen !== previousBoardFen) {
    previousBoardFen = storeState.boardFen;
  }

  // Authoritative Card Reveal Trigger:
  // Detect fresh card draws reliably across turns for both local player and remote opponent
  $: if (storeState.activeCard && storeState.activeCard.id) {
    const cardKey = `${storeState.activeCard.id}-${storeState.activeCard.value}-${storeState.revision}`;
    const isNewDrawEvent = storeState.drawEventCounter > lastRevealedDrawCounter;
    const isNewCardArrival = previousActiveCardId === null;
    const isTransitionFromDrawPhase = previousTurnPhase === 'DrawPhase';

    const isFreshDraw = (isNewDrawEvent || isNewCardArrival || isTransitionFromDrawPhase) && (cardKey !== lastRevealedCardKey);

    if (isFreshDraw) {
      lastRevealedCardKey = cardKey;
      lastRevealedDrawCounter = storeState.drawEventCounter;
      previousActiveCardId = storeState.activeCard.id;

      const isLocal = storeState.activePlayer === storeState.assignedColor;

      const sourceRect = isLocal
        ? (getElementRect('[data-testid="draw-card-slot"]') || getElementRect('.draw-card-slot'))
        : getElementRect('[data-testid="opponent-info"]');

      const targetRect = getElementRect('.card-column') || getElementRect('[data-testid="card-hand"]');

      cardAnimationService.triggerCardReveal(storeState.activeCard, {
        drawerColor: storeState.activePlayer,
        isLocalPlayer: isLocal,
        sourceRect,
        targetRect,
        revision: storeState.revision,
        drawKey: `draw-${storeState.revision}-${storeState.activePlayer}-${storeState.activeCard.id}-${storeState.drawEventCounter}`
      });
    }
  }

  // Reset tracking when activeCard clears at turn end
  $: if (!storeState.activeCard) {
    previousActiveCardId = null;
    if (storeState.turnPhase === 'DrawPhase') {
      cardAnimationService.resetLastRevealed();
    }
  }

  $: previousTurnPhase = storeState.turnPhase;
</script>

<div class="game-arena" data-testid="game-arena">
  <div class="arena-layout">
    <!-- Opponent Info -->
    <div class="area-opponent">
      <PlayerInfo
        name={storeState.opponentName}
        color={opponentColor}
        isCurrentTurn={storeState.activePlayer === opponentColor && !isGameOver}
        isConnected={connState.signalR === 'Connected'}
        reserves={opponentReserves}
        isOpponent={true}
        isSpeaking={$voiceStore.isOpponentSpeaking}
      />
    </div>

    <!-- Chessboard -->
    <div class="area-board">
      {#if showMatchStartBanner && storeState.revision <= 1}
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
        fen={storeState.boardFen}
        perspective={storeState.assignedColor}
        activePlayer={storeState.activePlayer}
        {isMyTurn}
        selectedSquare={displayedSelectedSquare}
        validDestinations={displayedValidDestinations}
        lastMove={storeState.lastMove}
        inCheck={storeState.inCheck}
        isCheckmate={storeState.gameStatus === 'Checkmate'}
        {isSubmitting}
        mode={activeAbilityMode === 'none' ? 'normal' : activeAbilityMode}
        on:squareSelected={handleSquareSelected}
        on:moveProposed={handleMoveProposed}
      />
    </div>

    <!-- Player Info + Resign -->
    <div class="area-player">
      <PlayerInfo
        name={storeState.playerName}
        color={storeState.assignedColor}
        isCurrentTurn={isMyTurn}
        isConnected={connState.signalR === 'Connected'}
        reserves={myReserves}
        isOpponent={false}
      >
        <div slot="actions" class="player-actions-cluster">
          <PushToTalkControl
            opponentName={storeState.opponentName || 'Opponent'}
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
        inCheck={storeState.inCheck}
        {isGameOver}
        activeCardName={storeState.activeCard?.name}
      />

      {#if activeAbilityMode !== 'none'}
        <CardTargetSelector
          mode={activeAbilityMode}
          playerColor={storeState.assignedColor}
          reserves={myReserves}
          selectedPieceType={selectedRevivalPiece}
          {firstSwapSquare}
          {secondSwapSquare}
          on:selectReservePiece={(e) => { selectedRevivalPiece = e.detail.pieceType; }}
          on:cancel={handleCancelAbility}
        />
      {/if}

      <CardHand
        activeCard={storeState.activeCard}
        turnPhase={storeState.turnPhase}
        {isMyTurn}
        remainingMoves={storeState.remainingMoves}
        remainingRevivals={storeState.remainingRevivals}
        canSwap={storeState.canSwap}
        availableChoices={storeState.availableChoices || []}
        remainingDeckCount={storeState.remainingDeckCount}
        on:drawCard={() => dispatch('drawCard')}
        on:endTurn={() => dispatch('endTurn')}
        on:submitChoice={(e) => dispatch('submitChoice', e.detail)}
        on:activateSwap={handleActivateSwap}
        on:activateRevival={handleActivateRevival}
      />

      <GameHistory logs={storeState.logs} />
    </aside>
  </div>

  <!-- Game Completion Overlay -->
  <GameOverModal
    isOpen={isGameOver}
    winner={storeState.winner}
    playerColor={storeState.assignedColor}
    gameStatus={storeState.gameStatus}
    totalMoves={storeState.revision}
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

    .coach-banner {
      padding: 8px 10px;
      gap: 2px;
      min-width: 0;
    }

    .coach-headline {
      font-size: 0.88rem;
    }

    .coach-instruction {
      font-size: 0.74rem;
      line-height: 1.25;
    }
  }
</style>
