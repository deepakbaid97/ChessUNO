<script lang="ts">
  import { createEventDispatcher } from 'svelte';
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

  // Live Tactical Coach state for clear visual hierarchy and next-step guidance
  interface CoachGuide {
    badge: string;
    tone: 'your-turn' | 'opponent-turn' | 'check' | 'ability';
    headline: string;
    instruction: string;
  }

  $: coachGuide = ((): CoachGuide => {
    if (isGameOver) {
      return {
        badge: 'MATCH COMPLETE',
        tone: 'opponent-turn',
        headline: `Game Over — ${storeState.gameStatus}`,
        instruction: storeState.winner ? `${storeState.winner} wins the match.` : 'The match ended in a draw.'
      };
    }

    if (!isMyTurn) {
      return {
        badge: 'OPPONENT TURN',
        tone: 'opponent-turn',
        headline: `Waiting for ${storeState.opponentName || opponentColor}`,
        instruction: `${opponentColor} is completing their turn. Watch the board and turn card below.`
      };
    }

    if (storeState.turnPhase === 'DrawPhase') {
      return {
        badge: storeState.inCheck ? 'YOUR TURN • IN CHECK' : 'YOUR TURN • STEP 1',
        tone: storeState.inCheck ? 'check' : 'your-turn',
        headline: 'Draw Your Turn Card',
        instruction: 'Tap "Draw Turn Card" below to reveal your action for this turn.'
      };
    }

    if (storeState.turnPhase === 'AwaitingChoice') {
      return {
        badge: 'YOUR TURN • WILD CHOICE',
        tone: 'ability',
        headline: `${storeState.activeCard?.name || 'Wild Card'}: Select an Ability`,
        instruction: 'Choose one of the tactical options in the card panel below to execute.'
      };
    }

    if (activeAbilityMode === 'swap' || storeState.canSwap) {
      if (!firstSwapSquare) {
        return {
          badge: 'REVERSE • STEP 1 OF 2',
          tone: 'ability',
          headline: 'Select 1st Friendly Piece to Swap',
          instruction: 'Tap any of your highlighted pieces on the board (Kings cannot be swapped).'
        };
      }
      return {
        badge: 'REVERSE • STEP 2 OF 2',
        tone: 'ability',
        headline: `Swap ${firstSwapSquare.toUpperCase()} with 2nd Piece`,
        instruction: 'Tap another highlighted friendly piece on the board to exchange their positions.'
      };
    }

    if (activeAbilityMode === 'revival' || storeState.remainingRevivals > 0) {
      if (myReserves.length === 0) {
        return {
          badge: 'REVIVAL • NO RESERVES',
          tone: 'your-turn',
          headline: 'No Captured Pieces to Revive',
          instruction: 'Your reserve pool is empty. Tap "End Turn Early" below to finish your turn.'
        };
      }
      if (!selectedRevivalPiece) {
        return {
          badge: `REVIVAL (${storeState.remainingRevivals} LEFT) • STEP 1`,
          tone: 'ability',
          headline: 'Select a Captured Piece from Reserve',
          instruction: 'Tap a piece in the Reserve Pool bar below, then place it on your half of the board.'
        };
      }
      const rankRange = storeState.assignedColor === 'White' ? 'ranks 1–4' : 'ranks 5–8';
      return {
        badge: `REVIVAL (${storeState.remainingRevivals} LEFT) • STEP 2`,
        tone: 'ability',
        headline: `Deploy ${selectedRevivalPiece} to the Board`,
        instruction: `Tap any green highlighted square on your half of the board (${rankRange}).`
      };
    }

    if (storeState.remainingMoves > 0) {
      const moveWord = storeState.remainingMoves === 1 ? 'move' : 'moves';
      if (!storeState.selectedSquare) {
        return {
          badge: storeState.inCheck ? `IN CHECK • ${storeState.remainingMoves} ${moveWord.toUpperCase()} LEFT` : `YOUR TURN • ${storeState.remainingMoves} ${moveWord.toUpperCase()} LEFT`,
          tone: storeState.inCheck ? 'check' : 'your-turn',
          headline: storeState.inCheck ? 'Protect Your King' : `Select a ${storeState.assignedColor} Piece to Move`,
          instruction: `Tap one of your pieces on the board to view legal destinations (${storeState.remainingMoves} ${moveWord} remaining).`
        };
      }
      return {
        badge: `PIECE ${storeState.selectedSquare.toUpperCase()} SELECTED`,
        tone: storeState.inCheck ? 'check' : 'your-turn',
        headline: `Choose Destination for ${storeState.selectedSquare.toUpperCase()}`,
        instruction: `Tap a green dot (or red capture ring) on the board to move, or tap another piece.`
      };
    }

    return {
      badge: 'YOUR TURN',
      tone: 'your-turn',
      headline: 'Turn Actions Complete',
      instruction: 'Tap "End Turn Early" below if your turn has not completed automatically.'
    };
  })();

  function handleSquareSelected(event: CustomEvent<{ square: string }>) {
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
      />
    </div>

    <!-- Chessboard -->
    <div class="area-board">
      <Chessboard
        fen={storeState.boardFen}
        perspective={storeState.assignedColor}
        activePlayer={storeState.activePlayer}
        {isMyTurn}
        selectedSquare={displayedSelectedSquare}
        validDestinations={displayedValidDestinations}
        lastMove={storeState.lastMove}
        inCheck={storeState.inCheck}
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
        <button
          slot="actions"
          class="btn btn-danger btn-resign"
          on:click={handleResign}
          disabled={isGameOver}
          data-testid="btn-resign"
        >
          Resign
        </button>
      </PlayerInfo>
    </div>

    <!-- Command Panel: Coach Banner + Target Selector + Card Dock + Match Log -->
    <aside class="area-command">
      <section
        class="coach-banner tone-{coachGuide.tone}"
        data-testid="turn-coach"
        aria-live="polite"
      >
        <div class="coach-top">
          <span class="coach-badge">{coachGuide.badge}</span>
          {#if storeState.inCheck && !isGameOver}
            <span class="check-alert">KING IN CHECK</span>
          {/if}
        </div>
        <h2 class="coach-headline">{coachGuide.headline}</h2>
        <p class="coach-instruction">{coachGuide.instruction}</p>
      </section>

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
</div>

<style>
  .game-arena {
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    flex: 1;
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
  }

  .area-opponent {
    grid-area: opponent;
    width: 100%;
  }

  .area-board {
    grid-area: board;
    display: flex;
    justify-content: center;
    width: 100%;
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

  /* Live Tactical Coach Banner */
  .coach-banner {
    padding: 12px 14px;
    border-radius: 8px;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-strong);
    border-left: 4px solid var(--border-strong);
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .coach-banner.tone-your-turn {
    border-color: rgba(245, 158, 11, 0.45);
    border-left-color: var(--accent-gold);
    background-color: rgba(245, 158, 11, 0.07);
  }

  .coach-banner.tone-ability {
    border-color: rgba(16, 185, 129, 0.45);
    border-left-color: var(--accent-green);
    background-color: rgba(16, 185, 129, 0.08);
  }

  .coach-banner.tone-check {
    border-color: rgba(239, 68, 68, 0.55);
    border-left-color: var(--accent-red);
    background-color: rgba(239, 68, 68, 0.1);
  }

  .coach-banner.tone-opponent-turn {
    border-color: var(--border-color);
    border-left-color: var(--text-dim);
    background-color: var(--bg-surface);
  }

  .coach-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .coach-badge {
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .tone-your-turn .coach-badge {
    color: var(--accent-gold);
  }

  .tone-ability .coach-badge {
    color: var(--accent-green);
  }

  .tone-check .coach-badge {
    color: #fca5a5;
  }

  .check-alert {
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 2px 6px;
    border-radius: 3px;
    background-color: var(--accent-red);
    color: #ffffff;
    font-family: var(--font-mono);
  }

  .coach-headline {
    font-size: 0.98rem;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.25;
  }

  .coach-instruction {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.35;
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
      max-width: 500px;
      margin: 0 auto;
      width: 100%;
    }

    .area-command {
      gap: 6px;
    }

    .coach-banner {
      padding: 8px 10px;
      gap: 2px;
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
