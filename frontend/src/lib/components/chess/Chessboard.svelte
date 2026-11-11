<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PlayerColor, PieceType, BoardPiece } from '../../types/game';
  import {
    parseFenToMatrix,
    getSquareIndex,
    getSquareColor,
    getOrientedSquares,
    getOrientedSquareCoords,
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
  export let mode: 'normal' | 'swap' | 'revival' = 'normal';
  export let isCheckmate: boolean = false;

  const dispatch = createEventDispatcher<{
    squareSelected: { square: string };
    moveProposed: { from: string; to: string; promotion?: PieceType };
  }>();

  let showPromotionModal = false;
  let pendingPromotionMove: { from: string; to: string } | null = null;

  let prevBoardMatrix: (BoardPiece | null)[][] | null = null;
  let captureSquare: string | null = null;
  let captureTimer: ReturnType<typeof setTimeout> | null = null;
  let lastMoveKey = '';

  $: boardMatrix = parseFenToMatrix(fen);
  $: orientedSquares = getOrientedSquares(perspective);

  // Monitor move changes to trigger slide animation & capture impact
  $: if (lastMove && lastMove.from && lastMove.to) {
    const currentKey = `${lastMove.from}-${lastMove.to}-${fen}`;
    if (currentKey !== lastMoveKey) {
      lastMoveKey = currentKey;
      if (prevBoardMatrix) {
        const { row: toRow, col: toCol } = getSquareIndex(lastMove.to);
        const hadPiece = prevBoardMatrix[toRow]?.[toCol];
        if (hadPiece) {
          captureSquare = lastMove.to;
          if (captureTimer) clearTimeout(captureTimer);
          captureTimer = setTimeout(() => {
            captureSquare = null;
          }, 450);
        }
      }
    }
  }
  $: prevBoardMatrix = boardMatrix;

  function getSlideOffset(square: string, move: { from: string; to: string } | null, playerPerspective: PlayerColor) {
    if (!move || move.to !== square || !move.from) return null;
    const fromCoords = getOrientedSquareCoords(move.from, playerPerspective);
    const toCoords = getOrientedSquareCoords(move.to, playerPerspective);
    return {
      deltaX: (fromCoords.col - toCoords.col) * 100,
      deltaY: (fromCoords.row - toCoords.row) * 100
    };
  }

  function handleSquareClick(event: CustomEvent<{ square: string }>) {
    const clickedSquare = event.detail.square;

    // If already waiting for backend confirmation, ignore input
    if (isSubmitting) return;

    // If destination clicked when piece selected and it's our turn (standard chess move only):
    if (mode === 'normal' && isMyTurn && selectedSquare && validDestinations.includes(clickedSquare)) {
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

<div
  class="chessboard-wrapper"
  class:active-turn={isMyTurn}
  class:swap-mode={mode === 'swap'}
  class:revival-mode={mode === 'revival'}
  class:checkmate-mode={isCheckmate}
  class:disabled={!isMyTurn || isSubmitting}
>
  <div class="chessboard" data-testid="chessboard">
    {#each orientedSquares as square}
      {@const { row, col } = getSquareIndex(square)}
      {@const piece = boardMatrix[row] ? boardMatrix[row][col] : null}
      {@const isSelected = selectedSquare === square}
      {@const isDest = validDestinations.includes(square)}
      {@const isCapt = mode === 'normal' && isDest && selectedSquare ? isCaptureMove(selectedSquare, square, boardMatrix) : false}
      {@const isLast = (lastMove?.from === square || lastMove?.to === square)}
      {@const isCheck = isCheckSquare(square, inCheck, activePlayer, boardMatrix)}
      {@const isDark = getSquareColor(square) === 'dark'}
      {@const showRank = perspective === 'White' ? square.charAt(0) === 'a' : square.charAt(0) === 'h'}
      {@const showFile = perspective === 'White' ? square.charAt(1) === '1' : square.charAt(1) === '8'}
      {@const slide = getSlideOffset(square, lastMove, perspective)}
      {@const isCaptImpact = captureSquare === square}
      {@const isRevivalTarget = mode === 'revival' && isDest}
      {@const isSwapTarget = mode === 'swap' && isDest}

      <ChessSquare
        {square}
        {piece}
        {isDark}
        {isSelected}
        isDestination={isDest}
        isCapture={isCapt}
        isLastMove={isLast}
        isInCheck={isCheck}
        slideOffset={slide}
        isCaptureImpact={isCaptImpact}
        showCoordinateRank={showRank}
        showCoordinateFile={showFile}
        {isRevivalTarget}
        {isSwapTarget}
        on:select={handleSquareClick}
      />
    {/each}
  </div>

  {#if inCheck && !isCheckmate}
    <div class="check-banner" data-testid="check-banner" aria-live="assertive">
      <span class="check-pulse-dot" aria-hidden="true"></span>
      <span>CHECK</span>
    </div>
  {/if}

  {#if isCheckmate}
    <div class="checkmate-banner" data-testid="checkmate-banner" aria-live="assertive">
      <span class="checkmate-text">CHECKMATE</span>
    </div>
  {/if}

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
    max-width: 500px;
    margin: 0 auto;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    border: 3px solid #2b303c;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .chessboard-wrapper.active-turn {
    border-color: var(--accent-gold);
    box-shadow: 0 0 0 1px var(--accent-gold-glow), var(--shadow-lg);
  }

  .chessboard-wrapper.swap-mode {
    border-color: var(--accent-gold);
  }

  .chessboard-wrapper.revival-mode {
    border-color: var(--accent-green);
  }

  .chessboard-wrapper.checkmate-mode {
    border-color: var(--accent-red);
    box-shadow: 0 0 24px rgba(239, 68, 68, 0.45), var(--shadow-lg);
  }

  .check-banner {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 12px;
    border-radius: 20px;
    background-color: rgba(239, 68, 68, 0.92);
    box-shadow: 0 0 16px rgba(239, 68, 68, 0.65), var(--shadow-md);
    color: #ffffff;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    z-index: 20;
    pointer-events: none;
    animation: checkBannerIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes checkBannerIn {
    from { transform: translate(-50%, -10px) scale(0.8); opacity: 0; }
    to { transform: translate(-50%, 0) scale(1); opacity: 1; }
  }

  .check-pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #ffffff;
    animation: checkDotPulse 0.8s infinite alternate ease-in-out;
  }

  @keyframes checkDotPulse {
    from { transform: scale(0.7); opacity: 0.6; }
    to { transform: scale(1.3); opacity: 1; }
  }

  .checkmate-banner {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle, rgba(15, 17, 21, 0.4) 0%, rgba(15, 17, 21, 0.82) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 25;
    pointer-events: none;
    animation: checkmateFadeIn 0.4s ease-out;
  }

  @keyframes checkmateFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .checkmate-text {
    font-family: var(--font-headline);
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--accent-gold-bright);
    text-shadow: 0 0 20px rgba(245, 158, 11, 0.7), 0 4px 12px rgba(0, 0, 0, 0.9);
    animation: checkmatePop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes checkmatePop {
    0% { transform: scale(0.6); opacity: 0; }
    70% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
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
    background: rgba(15, 17, 21, 0.72);
    backdrop-filter: blur(2px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--accent-gold);
    font-weight: 600;
    font-size: 0.9rem;
    z-index: 50;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(245, 158, 11, 0.2);
    border-top-color: var(--accent-gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 900px) {
    .chessboard-wrapper {
      max-width: min(94vw, 44dvh);
      border-width: 2px;
    }
  }
</style>
