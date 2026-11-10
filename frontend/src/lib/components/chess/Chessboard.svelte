<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor, PieceType } from '../../types/game';
  import {
    parseFenToMatrix,
    getSquareIndex,
    getSquareColor,
    getOrientedSquares,
    isCaptureMove,
    isCheckSquare
  } from '../../utils/boardUtils';
  import ChessSquare from './ChessSquare.svelte';
  import PromotionModal from './PromotionModal.svelte';

  export let fen: string;
  export let perspective: PlayerColor = 'White';
  export let activePlayer: PlayerColor = 'White';
  export let isMyTurn: boolean = false;
  export let selectedSquare: string | null = null;
  export let validDestinations: string[] = [];
  export let lastMove: { from: string; to: string } | null = null;
  export let inCheck: boolean = false;
  export let isSubmitting: boolean = false;

  const dispatch = createEventDispatcher<{
    squareSelected: { square: string };
    moveProposed: { from: string; to: string; promotion?: PieceType };
  }>();

  let showPromotionModal = false;
  let pendingPromotionMove: { from: string; to: string } | null = null;

  $: boardMatrix = parseFenToMatrix(fen);
  $: orientedSquares = getOrientedSquares(perspective);

  function handleSquareClick(event: CustomEvent<{ square: string }>) {
    const clickedSquare = event.detail.square;

    // If already waiting for backend confirmation, ignore input
    if (isSubmitting) return;

    // If destination clicked when piece selected and it's our turn:
    if (isMyTurn && selectedSquare && validDestinations.includes(clickedSquare)) {
      // Check if it is a promotion move
      const { row: fromRow, col: fromCol } = getSquareIndex(selectedSquare);
      const piece = boardMatrix[fromRow]?.[fromCol];

      if (piece && piece.type === 'Pawn') {
        const destRank = parseInt(clickedSquare.charAt(1), 10);
        if ((piece.color === 'White' && destRank === 8) || (piece.color === 'Black' && destRank === 1)) {
          pendingPromotionMove = { from: selectedSquare, to: clickedSquare };
          showPromotionModal = true;
          return;
        }
      }

      // Propose standard move
      dispatch('moveProposed', {
        from: selectedSquare,
        to: clickedSquare
      });
      return;
    }

    // Otherwise notify parent of selection attempt
    dispatch('squareSelected', { square: clickedSquare });
  }

  function handlePromotionSelect(event: CustomEvent<{ pieceType: PieceType }>) {
    if (pendingPromotionMove) {
      dispatch('moveProposed', {
        from: pendingPromotionMove.from,
        to: pendingPromotionMove.to,
        promotion: event.detail.pieceType
      });
    }
    showPromotionModal = false;
    pendingPromotionMove = null;
  }

  function handlePromotionCancel() {
    showPromotionModal = false;
    pendingPromotionMove = null;
  }
</script>

<div class="chessboard-wrapper" class:disabled={!isMyTurn || isSubmitting}>
  <div class="chessboard" data-testid="chessboard">
    {#each orientedSquares as square, i}
      {@const { row, col } = getSquareIndex(square)}
      {@const piece = boardMatrix[row] ? boardMatrix[row][col] : null}
      {@const isSelected = selectedSquare === square}
      {@const isDest = validDestinations.includes(square)}
      {@const isCapt = isDest && selectedSquare ? isCaptureMove(selectedSquare, square, boardMatrix) : false}
      {@const isLast = (lastMove?.from === square || lastMove?.to === square)}
      {@const isCheck = isCheckSquare(square, inCheck, activePlayer, boardMatrix)}
      {@const isDark = getSquareColor(square) === 'dark'}
      {@const showRank = perspective === 'White' ? square.charAt(0) === 'a' : square.charAt(0) === 'h'}
      {@const showFile = perspective === 'White' ? square.charAt(1) === '1' : square.charAt(1) === '8'}

      <ChessSquare
        {square}
        {piece}
        {isDark}
        {isSelected}
        isDestination={isDest}
        isCapture={isCapt}
        isLastMove={isLast}
        isInCheck={isCheck}
        showCoordinateRank={showRank}
        showCoordinateFile={showFile}
        on:select={handleSquareClick}
      />
    {/each}
  </div>

  {#if isSubmitting}
    <div class="submitting-overlay" data-testid="board-loading">
      <div class="spinner"></div>
      <span>Verifying move...</span>
    </div>
  {/if}

  <PromotionModal
    isOpen={showPromotionModal}
    color={perspective}
    on:select={handlePromotionSelect}
    on:cancel={handlePromotionCancel}
  />
</div>

<style>
  .chessboard-wrapper {
    position: relative;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow-card), 0 0 0 8px #2b1f14, 0 0 0 10px #1a120b;
    border: 2px solid #3d2b1f;
  }

  .chessboard {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-template-rows: repeat(8, 1fr);
    width: 100%;
    aspect-ratio: 1 / 1;
    background-color: var(--square-dark);
  }

  .submitting-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--accent-gold);
    font-weight: 600;
    font-size: 0.95rem;
    z-index: 50;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(251, 191, 36, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

