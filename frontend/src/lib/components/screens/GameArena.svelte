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
        // Dispatch swap action
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
    selectedRevivalPiece = null;
  }

  function handleCancelAbility() {
    activeAbilityMode = 'none';
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
  <!-- Top Section: Opponent Bar -->
  <header class="arena-header">
    <PlayerInfo
      name={storeState.opponentName}
      color={opponentColor}
      isCurrentTurn={storeState.activePlayer === opponentColor}
      isConnected={connState.signalR === 'Connected'}
      reserves={opponentReserves}
      isOpponent={true}
    />
  </header>

  <!-- Ability Target Selector Bar (if Swap/Revive active) -->
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

  <!-- Center & Main Arena: Board + Side Panel -->
  <div class="arena-main">
    <div class="board-column">
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

    <aside class="sidebar-column">
      <!-- Player Card Hand & Actions -->
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

      <!-- Match History & Resign Menu -->
      <GameHistory logs={storeState.logs} />

      <div class="arena-footer-actions">
        <button class="btn btn-danger btn-sm" on:click={handleResign} disabled={isGameOver} data-testid="btn-resign">
          🏳️ Resign Match
        </button>
      </div>
    </aside>
  </div>

  <!-- Bottom Section: Current Player Bar -->
  <footer class="arena-footer">
    <PlayerInfo
      name={storeState.playerName}
      color={storeState.assignedColor}
      isCurrentTurn={isMyTurn}
      isConnected={connState.signalR === 'Connected'}
      reserves={myReserves}
      isOpponent={false}
    />
  </footer>

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
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
  }

  .arena-header, .arena-footer {
    width: 100%;
  }

  .arena-main {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 24px;
    align-items: start;
  }

  .board-column {
    display: flex;
    justify-content: center;
  }

  .sidebar-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .arena-footer-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-sm {
    padding: 8px 16px;
    font-size: 0.85rem;
  }

  /* Responsive layout for Mobile & Tablet */
  @media (max-width: 920px) {
    .arena-main {
      grid-template-columns: 1fr;
    }

    .sidebar-column {
      max-width: 520px;
      margin: 0 auto;
      width: 100%;
    }
  }
</style>

